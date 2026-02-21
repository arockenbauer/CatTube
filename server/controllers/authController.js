import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import db from '../models/database.js';
import config from '../config.js';
import logger from '../utils/logger.js';

function generateTokens(userId) {
  const accessToken = jwt.sign({ userId }, config.jwtSecret, { expiresIn: config.jwtExpiry });
  const refreshToken = jwt.sign({ userId }, config.jwtRefreshSecret, { expiresIn: config.jwtRefreshExpiry });
  return { accessToken, refreshToken };
}

function formatUser(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    displayName: user.display_name,
    avatarUrl: user.avatar_url,
    bannerUrl: user.banner_url,
    bio: user.bio,
    level: user.level,
    subscriberCount: user.subscriber_count,
    totalViews: user.total_views,
    createdAt: user.created_at
  };
}

export async function register(req, res) {
  try {
    const { username, email, password, displayName } = req.validated;

    const existing = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email);
    if (existing) {
      return res.status(409).json({ error: 'Username or email already taken' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const emailToken = uuidv4();

    const result = db.prepare(`
      INSERT INTO users (username, email, password_hash, display_name, email_token)
      VALUES (?, ?, ?, ?, ?)
    `).run(username, email, passwordHash, displayName || username, emailToken);

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
    const tokens = generateTokens(user.id);
    db.prepare('UPDATE users SET refresh_token = ? WHERE id = ?').run(tokens.refreshToken, user.id);

    logger.info(`User registered: ${username}`);

    res.status(201).json({
      user: formatUser(user),
      ...tokens,
      emailVerificationToken: emailToken
    });
  } catch (err) {
    logger.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
}

export async function login(req, res) {
  try {
    const { login, password } = req.validated;

    const user = db.prepare('SELECT * FROM users WHERE username = ? OR email = ?').get(login, login);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.is_banned) {
      return res.status(403).json({ error: 'Account banned', reason: user.ban_reason });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const tokens = generateTokens(user.id);
    db.prepare('UPDATE users SET refresh_token = ? WHERE id = ?').run(tokens.refreshToken, user.id);

    const fingerprint = req.headers['x-fingerprint'];
    if (fingerprint) {
      db.prepare('UPDATE users SET fingerprint = ? WHERE id = ?').run(fingerprint, user.id);
    }

    logger.info(`User logged in: ${user.username}`);

    res.json({
      user: formatUser(user),
      ...tokens
    });
  } catch (err) {
    logger.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
}

export async function refreshToken(req, res) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    const decoded = jwt.verify(refreshToken, config.jwtRefreshSecret);
    const user = db.prepare('SELECT * FROM users WHERE id = ? AND refresh_token = ?').get(decoded.userId, refreshToken);
    if (!user) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const tokens = generateTokens(user.id);
    db.prepare('UPDATE users SET refresh_token = ? WHERE id = ?').run(tokens.refreshToken, user.id);

    res.json(tokens);
  } catch {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
}

export async function verifyEmail(req, res) {
  try {
    const { token } = req.params;
    const user = db.prepare('SELECT id FROM users WHERE email_token = ?').get(token);
    if (!user) {
      return res.status(404).json({ error: 'Invalid verification token' });
    }

    db.prepare('UPDATE users SET email_verified = 1, email_token = NULL WHERE id = ?').run(user.id);
    res.json({ message: 'Email verified successfully' });
  } catch (err) {
    logger.error('Email verify error:', err);
    res.status(500).json({ error: 'Verification failed' });
  }
}

export async function requestPasswordReset(req, res) {
  try {
    const { email } = req.validated;
    const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (!user) {
      return res.json({ message: 'If email exists, reset link sent' });
    }

    const resetToken = uuidv4();
    const expiry = new Date(Date.now() + 3600000).toISOString();
    db.prepare('UPDATE users SET reset_token = ?, reset_token_expiry = ? WHERE id = ?').run(resetToken, expiry, user.id);

    logger.info(`Password reset requested for user ${user.id}, token: ${resetToken}`);

    res.json({ message: 'If email exists, reset link sent', resetToken });
  } catch (err) {
    logger.error('Reset request error:', err);
    res.status(500).json({ error: 'Reset request failed' });
  }
}

export async function resetPassword(req, res) {
  try {
    const { token, password } = req.validated;
    const user = db.prepare('SELECT id, reset_token_expiry FROM users WHERE reset_token = ?').get(token);
    if (!user) {
      return res.status(400).json({ error: 'Invalid reset token' });
    }

    if (new Date(user.reset_token_expiry) < new Date()) {
      return res.status(400).json({ error: 'Reset token expired' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    db.prepare('UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expiry = NULL, refresh_token = NULL WHERE id = ?').run(passwordHash, user.id);

    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    logger.error('Reset password error:', err);
    res.status(500).json({ error: 'Password reset failed' });
  }
}

export async function getMe(req, res) {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json({ user: formatUser(user) });
}

export async function updateProfile(req, res) {
  try {
    const updates = req.validated;
    const sets = [];
    const values = [];

    if (updates.displayName) { sets.push('display_name = ?'); values.push(updates.displayName); }
    if (updates.bio !== undefined) { sets.push('bio = ?'); values.push(updates.bio); }
    if (updates.avatarUrl) { sets.push('avatar_url = ?'); values.push(updates.avatarUrl); }
    if (updates.bannerUrl) { sets.push('banner_url = ?'); values.push(updates.bannerUrl); }

    if (sets.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    sets.push("updated_at = datetime('now')");
    values.push(req.user.id);

    db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...values);

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    res.json({ user: formatUser(user) });
  } catch (err) {
    logger.error('Update profile error:', err);
    res.status(500).json({ error: 'Profile update failed' });
  }
}

export async function logout(req, res) {
  db.prepare('UPDATE users SET refresh_token = NULL WHERE id = ?').run(req.user.id);
  res.json({ message: 'Logged out' });
}

import jwt from 'jsonwebtoken';
import config from '../config.js';
import db from '../models/database.js';

export function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    const user = db.prepare('SELECT id, username, email, display_name, avatar_url, level, is_banned, shadow_banned FROM users WHERE id = ?').get(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    if (user.is_banned) {
      return res.status(403).json({ error: 'Account banned' });
    }
    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    const user = db.prepare('SELECT id, username, email, display_name, avatar_url, level, is_banned, shadow_banned FROM users WHERE id = ?').get(decoded.userId);
    req.user = user && !user.is_banned ? user : null;
  } catch {
    req.user = null;
  }
  next();
}

export function requireLevel(minLevel) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (req.user.level < minLevel) {
      const levelNames = { 0: 'Basic', 1: 'Creator', 2: 'Premium', 3: 'Admin' };
      return res.status(403).json({
        error: `Requires ${levelNames[minLevel] || 'higher'} level or above`
      });
    }
    next();
  };
}

export function requireAdmin(req, res, next) {
  return requireLevel(3)(req, res, next);
}

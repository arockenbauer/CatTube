import cache from '../utils/redis.js';
import config from '../config.js';

export async function rateLimitAction(req, res, next) {
  const identifier = req.user ? `user:${req.user.id}` : `ip:${req.ip}`;
  const key = `ratelimit:action:${identifier}`;
  const count = await cache.incr(key);
  if (count === 1) {
    await cache.expire(key, 60);
  }
  if (count > config.antiSpam.maxActionsPerMinute) {
    return res.status(429).json({ error: 'Too many actions. Slow down!' });
  }
  next();
}

export async function rateLimitUpload(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Auth required' });
  const key = `ratelimit:upload:${req.user.id}`;
  const count = await cache.incr(key);
  if (count === 1) {
    await cache.expire(key, 86400);
  }
  if (count > config.antiSpam.maxUploadsPerDay) {
    return res.status(429).json({ error: 'Upload limit reached for today' });
  }
  next();
}

export async function checkViewCooldown(userId, videoId, ip) {
  const identifier = userId ? `user:${userId}` : `ip:${ip}`;
  const key = `viewcooldown:${identifier}:${videoId}`;
  const existing = await cache.get(key);
  if (existing) return false;
  await cache.set(key, '1', config.antiSpam.viewCooldownMinutes * 60);
  return true;
}

export async function detectViewSpike(videoId) {
  const key = `viewspike:${videoId}`;
  const count = await cache.incr(key);
  if (count === 1) {
    await cache.expire(key, config.antiSpam.spikeWindowMinutes * 60);
  }
  return count > config.antiSpam.spikeThreshold;
}

export async function checkFingerprint(fingerprint, action) {
  if (!fingerprint) return false;
  const key = `fp:${action}:${fingerprint}`;
  const count = await cache.incr(key);
  if (count === 1) {
    await cache.expire(key, 3600);
  }
  return count > 50;
}

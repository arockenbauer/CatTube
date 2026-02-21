import db from '../models/database.js';
import cache from '../utils/redis.js';
import logger from '../utils/logger.js';

export async function getRecommendations(userId, currentVideoId, limit = 20) {
  const cacheKey = userId ? `reco:${userId}:${currentVideoId || 'home'}` : `reco:anon:${currentVideoId || 'home'}`;
  const cached = await cache.get(cacheKey);
  if (cached) {
    try { return JSON.parse(cached); } catch {}
  }

  try {
    let userTags = [];
    let watchedVideoIds = [];
    let watchedCreatorIds = [];

    if (userId) {
      const history = db.prepare(`
        SELECT DISTINCT wh.video_id, v.user_id FROM watch_history wh
        JOIN videos v ON wh.video_id = v.id
        WHERE wh.user_id = ? ORDER BY wh.watched_at DESC LIMIT 50
      `).all(userId);

      watchedVideoIds = history.map(h => h.video_id);
      watchedCreatorIds = history.map(h => h.user_id);

      if (watchedVideoIds.length > 0) {
        const placeholders = watchedVideoIds.map(() => '?').join(',');
        userTags = db.prepare(`
          SELECT tag, COUNT(*) as cnt FROM video_tags
          WHERE video_id IN (${placeholders})
          GROUP BY tag ORDER BY cnt DESC LIMIT 20
        `).all(...watchedVideoIds).map(t => t.tag);
      }
    }

    let currentTags = [];
    let currentVideo = null;
    if (currentVideoId) {
      currentVideo = db.prepare('SELECT * FROM videos WHERE id = ? OR uuid = ?').get(currentVideoId, currentVideoId);
      if (currentVideo) {
        currentTags = db.prepare('SELECT tag FROM video_tags WHERE video_id = ?').all(currentVideo.id).map(t => t.tag);
      }
    }

    const excludeIds = currentVideo ? [currentVideo.id] : [];

    let videos = db.prepare(`
      SELECT v.*, u.username, u.display_name, u.avatar_url, u.subscriber_count
      FROM videos v JOIN users u ON v.user_id = u.id
      WHERE v.status = 'published' AND v.visibility = 'public'
      ${excludeIds.length ? `AND v.id NOT IN (${excludeIds.join(',')})` : ''}
      ORDER BY v.published_at DESC
      LIMIT 200
    `).all();

    const scored = videos.map(v => {
      let score = 0;

      const vTags = db.prepare('SELECT tag FROM video_tags WHERE video_id = ?').all(v.id).map(t => t.tag);

      const currentOverlap = vTags.filter(t => currentTags.includes(t)).length;
      score += currentOverlap * 15;

      const userOverlap = vTags.filter(t => userTags.includes(t)).length;
      score += userOverlap * 8;

      if (watchedVideoIds.includes(v.id)) {
        score -= 50;
      }

      const ageHours = (Date.now() - new Date(v.published_at || v.created_at).getTime()) / 3600000;
      const recencyBoost = Math.max(0, 20 - ageHours / 24);
      score += recencyBoost;

      const engagement = v.view_count > 0
        ? ((v.like_count - v.dislike_count) / v.view_count) * 100
        : 0;
      score += Math.min(engagement * 2, 20);

      score += Math.log2(Math.max(v.view_count, 1)) * 2;

      const creatorFrequency = watchedCreatorIds.filter(id => id === v.user_id).length;
      if (creatorFrequency > 3) {
        score -= (creatorFrequency - 3) * 5;
      }

      if (v.avg_watch_percent > 50) {
        score += 5;
      }

      score += (Math.random() - 0.5) * 10;

      return { ...v, _score: score, _tags: vTags };
    });

    scored.sort((a, b) => b._score - a._score);
    const results = scored.slice(0, limit).map(v => ({
      id: v.id, uuid: v.uuid, title: v.title, thumbnailUrl: v.thumbnail_url,
      duration: v.duration, isShort: !!v.is_short, viewCount: v.view_count,
      likeCount: v.like_count, createdAt: v.created_at, publishedAt: v.published_at,
      tags: v._tags,
      channel: {
        id: v.user_id, username: v.username, displayName: v.display_name,
        avatarUrl: v.avatar_url, subscriberCount: v.subscriber_count
      }
    }));

    await cache.set(cacheKey, JSON.stringify(results), 300);
    return results;
  } catch (err) {
    logger.error('Recommendation error:', err);
    return [];
  }
}

export async function getShortsRecommendations(userId, limit = 20) {
  const cacheKey = `reco:shorts:${userId || 'anon'}`;
  const cached = await cache.get(cacheKey);
  if (cached) {
    try { return JSON.parse(cached); } catch {}
  }

  const shorts = db.prepare(`
    SELECT v.*, u.username, u.display_name, u.avatar_url, u.subscriber_count
    FROM videos v JOIN users u ON v.user_id = u.id
    WHERE v.status = 'published' AND v.visibility = 'public' AND v.is_short = 1
    ORDER BY (v.view_count * 2 + v.like_count * 5) / MAX(1, julianday('now') - julianday(v.published_at) + 1) DESC,
      RANDOM()
    LIMIT ?
  `).all(limit);

  const results = shorts.map(v => {
    const files = db.prepare('SELECT resolution, file_path, file_size FROM video_files WHERE video_id = ?').all(v.id);
    return {
      id: v.id, uuid: v.uuid, title: v.title, thumbnailUrl: v.thumbnail_url,
      duration: v.duration, isShort: true, viewCount: v.view_count,
      likeCount: v.like_count, dislikeCount: v.dislike_count, commentCount: v.comment_count,
      createdAt: v.created_at,
      files: files.map(f => ({ resolution: f.resolution, url: f.file_path, size: f.file_size })),
      channel: {
        id: v.user_id, username: v.username, displayName: v.display_name, avatarUrl: v.avatar_url
      }
    };
  });

  await cache.set(cacheKey, JSON.stringify(results), 180);
  return results;
}

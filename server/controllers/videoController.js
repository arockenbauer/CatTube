import { v4 as uuidv4 } from 'uuid';
import db from '../models/database.js';
import config from '../config.js';
import { getQueue } from '../utils/queue.js';
import { getUploadDir, deleteVideoFiles } from '../services/storageService.js';
import { checkViewCooldown, detectViewSpike, checkFingerprint } from '../middlewares/antiSpam.js';
import cache from '../utils/redis.js';
import logger from '../utils/logger.js';
import { join } from 'path';
import { renameSync } from 'fs';

function formatVideo(v, userId = null) {
  const result = {
    id: v.id,
    uuid: v.uuid,
    title: v.title,
    description: v.description,
    thumbnailUrl: v.thumbnail_url,
    duration: v.duration,
    isShort: !!v.is_short,
    status: v.status,
    visibility: v.visibility,
    viewCount: v.view_count,
    likeCount: v.like_count,
    dislikeCount: v.dislike_count,
    commentCount: v.comment_count,
    category: v.category,
    createdAt: v.created_at,
    publishedAt: v.published_at
  };

  if (v.username) {
    result.channel = {
      id: v.user_id,
      username: v.username,
      displayName: v.display_name,
      avatarUrl: v.avatar_url,
      subscriberCount: v.subscriber_count
    };
  }

  if (userId) {
    const liked = db.prepare('SELECT id FROM likes WHERE user_id = ? AND video_id = ?').get(userId, v.id);
    const disliked = db.prepare('SELECT id FROM dislikes WHERE user_id = ? AND video_id = ?').get(userId, v.id);
    result.isLiked = !!liked;
    result.isDisliked = !!disliked;
  }

  const tags = db.prepare('SELECT tag FROM video_tags WHERE video_id = ?').all(v.id).map(t => t.tag);
  result.tags = tags;

  const files = db.prepare('SELECT resolution, file_path, file_size FROM video_files WHERE video_id = ?').all(v.id);
  result.files = files.map(f => ({ resolution: f.resolution, url: f.file_path, size: f.file_size }));

  return result;
}

export async function uploadVideo(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video file provided' });
    }

    const { title, description, tags, category, visibility } = req.validated;
    const uuid = uuidv4();
    const videoDir = getUploadDir(uuid);
    const originalPath = join(videoDir, 'original' + getExtension(req.file.originalname));

    renameSync(req.file.path, originalPath);

    const result = db.prepare(`
      INSERT INTO videos (uuid, user_id, title, description, category, visibility, original_filename, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'processing')
    `).run(uuid, req.user.id, title, description || '', category || 'other', visibility || 'public', req.file.originalname);

    const videoId = result.lastInsertRowid;

    if (tags) {
      const tagList = tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean).slice(0, 20);
      const insertTag = db.prepare('INSERT OR IGNORE INTO video_tags (video_id, tag) VALUES (?, ?)');
      for (const tag of tagList) {
        insertTag.run(videoId, tag);
      }
    }

    const queue = getQueue('video-processing');
    if (queue) {
      await queue.add('process-video', { videoId, inputPath: originalPath }, { attempts: 3 });
    }

    const video = db.prepare(`
      SELECT v.*, u.username, u.display_name, u.avatar_url, u.subscriber_count
      FROM videos v JOIN users u ON v.user_id = u.id WHERE v.id = ?
    `).get(videoId);

    res.status(201).json({ video: formatVideo(video) });
  } catch (err) {
    logger.error('Upload error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
}

function getExtension(filename) {
  const idx = filename.lastIndexOf('.');
  return idx >= 0 ? filename.substring(idx) : '.mp4';
}

export async function getVideo(req, res) {
  try {
    const { uuid } = req.params;
    const cacheKey = `video:${uuid}`;

    const v = db.prepare(`
      SELECT v.*, u.username, u.display_name, u.avatar_url, u.subscriber_count
      FROM videos v JOIN users u ON v.user_id = u.id
      WHERE v.uuid = ?
    `).get(uuid);

    if (!v) {
      return res.status(404).json({ error: 'Video not found' });
    }

    const isOwner = req.user && v.user_id === req.user.id;
    const isAdmin = req.user && req.user.level >= 3;

    if (v.status !== 'published' && !isOwner && !isAdmin) {
      return res.status(404).json({ error: 'Video not found' });
    }

    if (v.visibility === 'private' && !isOwner && !isAdmin) {
      return res.status(404).json({ error: 'Video not found' });
    }

    const video = formatVideo(v, req.user?.id);

    if (req.user) {
      const sub = db.prepare('SELECT id FROM subscriptions WHERE subscriber_id = ? AND channel_id = ?')
        .get(req.user.id, video.channel?.id);
      video.isSubscribed = !!sub;
    }

    res.json({ video });
  } catch (err) {
    logger.error('Get video error:', err);
    res.status(500).json({ error: 'Failed to get video' });
  }
}

export async function getVideoStatus(req, res) {
  try {
    const { uuid } = req.params;
    const v = db.prepare('SELECT id, uuid, status, title, thumbnail_url, duration, is_short, target_resolutions FROM videos WHERE uuid = ?').get(uuid);
    if (!v) return res.status(404).json({ error: 'Video not found' });
    const files = db.prepare('SELECT resolution FROM video_files WHERE video_id = ?').all(v.id);
    res.json({
      uuid: v.uuid, status: v.status, title: v.title,
      thumbnailUrl: v.thumbnail_url, duration: v.duration,
      isShort: !!v.is_short,
      completedResolutions: files.map(f => f.resolution),
      targetResolutions: v.target_resolutions ? v.target_resolutions.split(',') : []
    });
  } catch (err) {
    logger.error('Get video status error:', err);
    res.status(500).json({ error: 'Failed to get status' });
  }
}

export async function getVideos(req, res) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 24, 50);
    const offset = (page - 1) * limit;
    const category = req.query.category;
    const sort = req.query.sort || 'recent';

    let where = "WHERE v.status = 'published' AND v.visibility = 'public' AND v.is_short = 0";
    const params = [];

    if (category && category !== 'all') {
      where += ' AND v.category = ?';
      params.push(category);
    }

    let orderBy;
    switch (sort) {
      case 'popular': orderBy = 'v.view_count DESC'; break;
      case 'trending': orderBy = 'v.view_count / MAX(1, (julianday("now") - julianday(v.published_at) + 1)) DESC'; break;
      default: orderBy = 'v.published_at DESC';
    }

    const videos = db.prepare(`
      SELECT v.*, u.username, u.display_name, u.avatar_url, u.subscriber_count
      FROM videos v JOIN users u ON v.user_id = u.id
      ${where}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    const total = db.prepare(`SELECT COUNT(*) as count FROM videos v ${where}`).get(...params).count;

    res.json({
      videos: videos.map(v => formatVideo(v, req.user?.id)),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (err) {
    logger.error('Get videos error:', err);
    res.status(500).json({ error: 'Failed to get videos' });
  }
}

export async function getShorts(req, res) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const offset = (page - 1) * limit;

    const shorts = db.prepare(`
      SELECT v.*, u.username, u.display_name, u.avatar_url, u.subscriber_count
      FROM videos v JOIN users u ON v.user_id = u.id
      WHERE v.status = 'published' AND v.visibility = 'public' AND v.is_short = 1
      ORDER BY v.published_at DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset);

    res.json({ videos: shorts.map(v => formatVideo(v, req.user?.id)) });
  } catch (err) {
    logger.error('Get shorts error:', err);
    res.status(500).json({ error: 'Failed to get shorts' });
  }
}

export async function getTrending(req, res) {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);

    const videos = db.prepare(`
      SELECT v.*, u.username, u.display_name, u.avatar_url, u.subscriber_count,
        (v.view_count * 2 + v.like_count * 5 - v.dislike_count * 3) /
        MAX(1, (julianday('now') - julianday(v.published_at) + 1)) AS trend_score
      FROM videos v JOIN users u ON v.user_id = u.id
      WHERE v.status = 'published' AND v.visibility = 'public'
        AND v.published_at >= datetime('now', '-7 days')
      ORDER BY trend_score DESC
      LIMIT ?
    `).all(limit);

    res.json({ videos: videos.map(v => formatVideo(v, req.user?.id)) });
  } catch (err) {
    logger.error('Get trending error:', err);
    res.status(500).json({ error: 'Failed to get trending' });
  }
}

export async function recordView(req, res) {
  try {
    const { uuid } = req.params;
    const { watchDuration, watchPercent, fingerprint } = req.body;

    const video = db.prepare('SELECT id, user_id FROM videos WHERE uuid = ?').get(uuid);
    if (!video) return res.status(404).json({ error: 'Video not found' });

    const userId = req.user?.id || null;
    const ip = req.ip;

    if (fingerprint) {
      const fpBlocked = await checkFingerprint(fingerprint, 'view');
      if (fpBlocked) return res.json({ counted: false, reason: 'rate_limited' });
    }

    const canCount = await checkViewCooldown(userId, video.id, ip);
    if (!canCount) {
      return res.json({ counted: false, reason: 'cooldown' });
    }

    const isShadowBanned = req.user?.shadow_banned;
    if (!isShadowBanned) {
      const spike = await detectViewSpike(video.id);
      if (!spike) {
        db.prepare('UPDATE videos SET view_count = view_count + 1 WHERE id = ?').run(video.id);
        db.prepare('UPDATE users SET total_views = total_views + 1 WHERE id = ?').run(video.user_id);
      }
    }

    db.prepare(`
      INSERT INTO views (user_id, video_id, ip_address, watch_duration, watch_percent, fingerprint)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, video.id, ip, watchDuration || 0, watchPercent || 0, fingerprint || null);

    if (userId) {
      const existing = db.prepare('SELECT id FROM watch_history WHERE user_id = ? AND video_id = ?').get(userId, video.id);
      if (existing) {
        db.prepare(`
          UPDATE watch_history SET watch_duration = ?, watch_percent = ?, last_position = ?, watched_at = datetime('now')
          WHERE user_id = ? AND video_id = ?
        `).run(watchDuration || 0, watchPercent || 0, watchDuration || 0, userId, video.id);
      } else {
        db.prepare(`
          INSERT INTO watch_history (user_id, video_id, watch_duration, watch_percent, last_position)
          VALUES (?, ?, ?, ?, ?)
        `).run(userId, video.id, watchDuration || 0, watchPercent || 0, watchDuration || 0);
      }
    }

    await cache.del(`video:${uuid}`);

    res.json({ counted: true });
  } catch (err) {
    logger.error('Record view error:', err);
    res.status(500).json({ error: 'Failed to record view' });
  }
}

export async function likeVideo(req, res) {
  try {
    const { uuid } = req.params;
    const video = db.prepare('SELECT id FROM videos WHERE uuid = ?').get(uuid);
    if (!video) return res.status(404).json({ error: 'Video not found' });

    const existing = db.prepare('SELECT id FROM likes WHERE user_id = ? AND video_id = ?').get(req.user.id, video.id);
    if (existing) {
      db.prepare('DELETE FROM likes WHERE id = ?').run(existing.id);
      db.prepare('UPDATE videos SET like_count = MAX(0, like_count - 1) WHERE id = ?').run(video.id);
      await cache.del(`video:${uuid}`);
      return res.json({ liked: false });
    }

    db.prepare('DELETE FROM dislikes WHERE user_id = ? AND video_id = ?').run(req.user.id, video.id);
    const hadDislike = db.prepare('SELECT changes() as c').get().c;
    if (hadDislike) {
      db.prepare('UPDATE videos SET dislike_count = MAX(0, dislike_count - 1) WHERE id = ?').run(video.id);
    }

    db.prepare('INSERT INTO likes (user_id, video_id) VALUES (?, ?)').run(req.user.id, video.id);
    db.prepare('UPDATE videos SET like_count = like_count + 1 WHERE id = ?').run(video.id);

    await cache.del(`video:${uuid}`);
    res.json({ liked: true });
  } catch (err) {
    logger.error('Like error:', err);
    res.status(500).json({ error: 'Failed to like video' });
  }
}

export async function dislikeVideo(req, res) {
  try {
    const { uuid } = req.params;
    const video = db.prepare('SELECT id FROM videos WHERE uuid = ?').get(uuid);
    if (!video) return res.status(404).json({ error: 'Video not found' });

    const existing = db.prepare('SELECT id FROM dislikes WHERE user_id = ? AND video_id = ?').get(req.user.id, video.id);
    if (existing) {
      db.prepare('DELETE FROM dislikes WHERE id = ?').run(existing.id);
      db.prepare('UPDATE videos SET dislike_count = MAX(0, dislike_count - 1) WHERE id = ?').run(video.id);
      await cache.del(`video:${uuid}`);
      return res.json({ disliked: false });
    }

    db.prepare('DELETE FROM likes WHERE user_id = ? AND video_id = ?').run(req.user.id, video.id);
    const hadLike = db.prepare('SELECT changes() as c').get().c;
    if (hadLike) {
      db.prepare('UPDATE videos SET like_count = MAX(0, like_count - 1) WHERE id = ?').run(video.id);
    }

    db.prepare('INSERT INTO dislikes (user_id, video_id) VALUES (?, ?)').run(req.user.id, video.id);
    db.prepare('UPDATE videos SET dislike_count = dislike_count + 1 WHERE id = ?').run(video.id);

    await cache.del(`video:${uuid}`);
    res.json({ disliked: true });
  } catch (err) {
    logger.error('Dislike error:', err);
    res.status(500).json({ error: 'Failed to dislike video' });
  }
}

export async function updateVideo(req, res) {
  try {
    const { uuid } = req.params;
    const video = db.prepare('SELECT * FROM videos WHERE uuid = ? AND user_id = ?').get(uuid, req.user.id);
    if (!video && req.user.level < 3) {
      return res.status(404).json({ error: 'Video not found' });
    }

    const updates = req.validated;
    const sets = [];
    const values = [];

    if (updates.title) { sets.push('title = ?'); values.push(updates.title); }
    if (updates.description !== undefined) { sets.push('description = ?'); values.push(updates.description); }
    if (updates.category) { sets.push('category = ?'); values.push(updates.category); }
    if (updates.visibility) { sets.push('visibility = ?'); values.push(updates.visibility); }

    if (sets.length > 0) {
      sets.push("updated_at = datetime('now')");
      values.push(video ? video.id : db.prepare('SELECT id FROM videos WHERE uuid = ?').get(uuid).id);
      db.prepare(`UPDATE videos SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    }

    if (updates.tags !== undefined) {
      const vid = video || db.prepare('SELECT id FROM videos WHERE uuid = ?').get(uuid);
      db.prepare('DELETE FROM video_tags WHERE video_id = ?').run(vid.id);
      if (updates.tags) {
        const tagList = updates.tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean).slice(0, 20);
        const insertTag = db.prepare('INSERT OR IGNORE INTO video_tags (video_id, tag) VALUES (?, ?)');
        for (const tag of tagList) {
          insertTag.run(vid.id, tag);
        }
      }
    }

    await cache.del(`video:${uuid}`);
    const updated = db.prepare(`
      SELECT v.*, u.username, u.display_name, u.avatar_url, u.subscriber_count
      FROM videos v JOIN users u ON v.user_id = u.id WHERE v.uuid = ?
    `).get(uuid);

    res.json({ video: formatVideo(updated) });
  } catch (err) {
    logger.error('Update video error:', err);
    res.status(500).json({ error: 'Failed to update video' });
  }
}

export async function deleteVideo(req, res) {
  try {
    const { uuid } = req.params;
    const video = db.prepare('SELECT * FROM videos WHERE uuid = ?').get(uuid);
    if (!video) return res.status(404).json({ error: 'Video not found' });

    if (video.user_id !== req.user.id && req.user.level < 3) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    deleteVideoFiles(video.uuid);
    db.prepare('DELETE FROM videos WHERE id = ?').run(video.id);
    await cache.del(`video:${uuid}`);

    res.json({ message: 'Video deleted' });
  } catch (err) {
    logger.error('Delete video error:', err);
    res.status(500).json({ error: 'Failed to delete video' });
  }
}

export async function getMyVideos(req, res) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const offset = (page - 1) * limit;

    const videos = db.prepare(`
      SELECT v.*, u.username, u.display_name, u.avatar_url, u.subscriber_count
      FROM videos v JOIN users u ON v.user_id = u.id
      WHERE v.user_id = ?
      ORDER BY v.created_at DESC
      LIMIT ? OFFSET ?
    `).all(req.user.id, limit, offset);

    const total = db.prepare('SELECT COUNT(*) as count FROM videos WHERE user_id = ?').get(req.user.id).count;

    res.json({
      videos: videos.map(v => formatVideo(v)),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (err) {
    logger.error('Get my videos error:', err);
    res.status(500).json({ error: 'Failed to get videos' });
  }
}

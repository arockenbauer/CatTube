import db from '../models/database.js';
import logger from '../utils/logger.js';

export async function getNotifications(req, res) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const offset = (page - 1) * limit;

    const notifications = db.prepare(`
      SELECT * FROM notifications WHERE user_id = ?
      ORDER BY created_at DESC LIMIT ? OFFSET ?
    `).all(req.user.id, limit, offset);

    const unreadCount = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0').get(req.user.id).count;

    res.json({
      notifications: notifications.map(n => ({
        id: n.id, type: n.type, title: n.title, message: n.message,
        link: n.link, isRead: !!n.is_read, createdAt: n.created_at
      })),
      unreadCount
    });
  } catch (err) {
    logger.error('Get notifications error:', err);
    res.status(500).json({ error: 'Failed to get notifications' });
  }
}

export async function markRead(req, res) {
  try {
    const { id } = req.params;
    if (id === 'all') {
      db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user.id);
    } else {
      db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(parseInt(id), req.user.id);
    }
    res.json({ message: 'Marked as read' });
  } catch (err) {
    logger.error('Mark read error:', err);
    res.status(500).json({ error: 'Failed to mark as read' });
  }
}

export async function getHistory(req, res) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const offset = (page - 1) * limit;

    const history = db.prepare(`
      SELECT wh.*, v.uuid, v.title, v.thumbnail_url, v.duration, v.is_short,
        u.username, u.display_name, u.avatar_url
      FROM watch_history wh
      JOIN videos v ON wh.video_id = v.id
      JOIN users u ON v.user_id = u.id
      WHERE wh.user_id = ?
      ORDER BY wh.watched_at DESC
      LIMIT ? OFFSET ?
    `).all(req.user.id, limit, offset);

    res.json({
      history: history.map(h => ({
        id: h.id, watchedAt: h.watched_at, watchDuration: h.watch_duration,
        watchPercent: h.watch_percent, lastPosition: h.last_position,
        video: {
          uuid: h.uuid, title: h.title, thumbnailUrl: h.thumbnail_url,
          duration: h.duration, isShort: !!h.is_short,
          channel: { username: h.username, displayName: h.display_name, avatarUrl: h.avatar_url }
        }
      }))
    });
  } catch (err) {
    logger.error('Get history error:', err);
    res.status(500).json({ error: 'Failed to get history' });
  }
}

export async function reportContent(req, res) {
  try {
    const { reason, details } = req.validated;
    const { videoId, commentId, userId } = req.body;

    db.prepare(`
      INSERT INTO reports (reporter_id, video_id, comment_id, user_id, reason, details)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(req.user.id, videoId || null, commentId || null, userId || null, reason, details || '');

    res.status(201).json({ message: 'Report submitted' });
  } catch (err) {
    logger.error('Report error:', err);
    res.status(500).json({ error: 'Failed to submit report' });
  }
}

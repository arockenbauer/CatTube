import db from '../models/database.js';
import logger from '../utils/logger.js';

export async function search(req, res) {
  try {
    const { q, sort, duration, type, page: p, limit: l } = req.validated;
    const page = p || 1;
    const limit = l || 20;
    const offset = (page - 1) * limit;

    const searchTerm = `%${q.toLowerCase()}%`;
    let where = "WHERE v.status = 'published' AND v.visibility = 'public'";
    const params = [];

    where += ` AND (LOWER(v.title) LIKE ? OR LOWER(v.description) LIKE ? OR LOWER(u.username) LIKE ?
      OR v.id IN (SELECT video_id FROM video_tags WHERE LOWER(tag) LIKE ?))`;
    params.push(searchTerm, searchTerm, searchTerm, searchTerm);

    if (type === 'short') {
      where += ' AND v.is_short = 1';
    } else if (type === 'video') {
      where += ' AND v.is_short = 0';
    }

    if (duration === 'short') {
      where += ' AND v.duration <= 240';
    } else if (duration === 'medium') {
      where += ' AND v.duration > 240 AND v.duration <= 1200';
    } else if (duration === 'long') {
      where += ' AND v.duration > 1200';
    }

    let orderBy;
    switch (sort) {
      case 'date': orderBy = 'v.published_at DESC'; break;
      case 'views': orderBy = 'v.view_count DESC'; break;
      case 'duration': orderBy = 'v.duration DESC'; break;
      default: {
        orderBy = `(
          CASE WHEN LOWER(v.title) LIKE ? THEN 10 ELSE 0 END +
          CASE WHEN LOWER(v.description) LIKE ? THEN 3 ELSE 0 END +
          v.view_count * 0.001 +
          v.like_count * 0.01
        ) DESC`;
        params.push(searchTerm, searchTerm);
      }
    }

    const videos = db.prepare(`
      SELECT v.*, u.username, u.display_name, u.avatar_url, u.subscriber_count
      FROM videos v JOIN users u ON v.user_id = u.id
      ${where}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    const total = db.prepare(`
      SELECT COUNT(*) as count FROM videos v JOIN users u ON v.user_id = u.id ${where}
    `).get(...(sort === 'relevance' || !sort ? params.slice(0, -2) : params)).count;

    if (type === 'channel') {
      const channels = db.prepare(`
        SELECT u.*, (SELECT COUNT(*) FROM videos WHERE user_id = u.id AND status = 'published') as video_count
        FROM users u WHERE LOWER(u.username) LIKE ? OR LOWER(u.display_name) LIKE ?
        ORDER BY u.subscriber_count DESC
        LIMIT ? OFFSET ?
      `).all(searchTerm, searchTerm, limit, offset);

      return res.json({
        channels: channels.map(c => ({
          id: c.id, username: c.username, displayName: c.display_name,
          avatarUrl: c.avatar_url, subscriberCount: c.subscriber_count,
          videoCount: c.video_count
        })),
        videos: [],
        pagination: { page, limit, total: channels.length }
      });
    }

    res.json({
      videos: videos.map(v => ({
        id: v.id, uuid: v.uuid, title: v.title, description: v.description,
        thumbnailUrl: v.thumbnail_url, duration: v.duration, isShort: !!v.is_short,
        viewCount: v.view_count, likeCount: v.like_count, createdAt: v.created_at,
        publishedAt: v.published_at,
        channel: { id: v.user_id, username: v.username, displayName: v.display_name, avatarUrl: v.avatar_url }
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (err) {
    logger.error('Search error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
}

export async function getSuggestions(req, res) {
  try {
    const q = req.query.q;
    if (!q || q.length < 2) return res.json({ suggestions: [] });

    const term = `%${q.toLowerCase()}%`;
    const titles = db.prepare(`
      SELECT DISTINCT title FROM videos
      WHERE LOWER(title) LIKE ? AND status = 'published' AND visibility = 'public'
      ORDER BY view_count DESC LIMIT 8
    `).all(term).map(r => r.title);

    const tags = db.prepare(`
      SELECT DISTINCT tag FROM video_tags WHERE LOWER(tag) LIKE ? LIMIT 5
    `).all(term).map(r => r.tag);

    res.json({ suggestions: [...new Set([...titles, ...tags])].slice(0, 10) });
  } catch (err) {
    logger.error('Suggestions error:', err);
    res.status(500).json({ error: 'Failed to get suggestions' });
  }
}

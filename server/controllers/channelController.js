import db from '../models/database.js';
import logger from '../utils/logger.js';

function formatChannel(u, requesterId = null) {
  const result = {
    id: u.id,
    username: u.username,
    displayName: u.display_name,
    avatarUrl: u.avatar_url,
    bannerUrl: u.banner_url,
    bio: u.bio,
    level: u.level,
    subscriberCount: u.subscriber_count,
    totalViews: u.total_views,
    videoCount: u.video_count || 0,
    createdAt: u.created_at
  };

  if (requesterId) {
    const sub = db.prepare('SELECT id FROM subscriptions WHERE subscriber_id = ? AND channel_id = ?').get(requesterId, u.id);
    result.isSubscribed = !!sub;
  }

  return result;
}

export async function getChannel(req, res) {
  try {
    const { username } = req.params;
    const user = db.prepare(`
      SELECT u.*, (SELECT COUNT(*) FROM videos WHERE user_id = u.id AND status = 'published' AND visibility = 'public') as video_count
      FROM users u WHERE u.username = ?
    `).get(username);

    if (!user) return res.status(404).json({ error: 'Channel not found' });

    res.json({ channel: formatChannel(user, req.user?.id) });
  } catch (err) {
    logger.error('Get channel error:', err);
    res.status(500).json({ error: 'Failed to get channel' });
  }
}

export async function getChannelVideos(req, res) {
  try {
    const { username } = req.params;
    const user = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (!user) return res.status(404).json({ error: 'Channel not found' });

    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const offset = (page - 1) * limit;
    const sort = req.query.sort === 'popular' ? 'v.view_count DESC' : 'v.published_at DESC';
    const type = req.query.type;

    let where = "WHERE v.user_id = ? AND v.status = 'published' AND v.visibility = 'public'";
    if (type === 'shorts') where += ' AND v.is_short = 1';
    else if (type === 'videos') where += ' AND v.is_short = 0';

    const videos = db.prepare(`
      SELECT v.*, u.username, u.display_name, u.avatar_url, u.subscriber_count
      FROM videos v JOIN users u ON v.user_id = u.id
      ${where} ORDER BY ${sort} LIMIT ? OFFSET ?
    `).all(user.id, limit, offset);

    const total = db.prepare(`SELECT COUNT(*) as count FROM videos v ${where}`).get(user.id).count;

    res.json({
      videos: videos.map(v => ({
        id: v.id, uuid: v.uuid, title: v.title, thumbnailUrl: v.thumbnail_url,
        duration: v.duration, isShort: !!v.is_short, viewCount: v.view_count,
        likeCount: v.like_count, createdAt: v.created_at, publishedAt: v.published_at,
        channel: { id: v.user_id, username: v.username, displayName: v.display_name, avatarUrl: v.avatar_url }
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (err) {
    logger.error('Get channel videos error:', err);
    res.status(500).json({ error: 'Failed to get channel videos' });
  }
}

export async function subscribe(req, res) {
  try {
    const { username } = req.params;
    const channel = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });
    if (channel.id === req.user.id) return res.status(400).json({ error: 'Cannot subscribe to yourself' });

    const existing = db.prepare('SELECT id FROM subscriptions WHERE subscriber_id = ? AND channel_id = ?').get(req.user.id, channel.id);
    if (existing) {
      db.prepare('DELETE FROM subscriptions WHERE id = ?').run(existing.id);
      db.prepare('UPDATE users SET subscriber_count = MAX(0, subscriber_count - 1) WHERE id = ?').run(channel.id);
      return res.json({ subscribed: false });
    }

    db.prepare('INSERT INTO subscriptions (subscriber_id, channel_id) VALUES (?, ?)').run(req.user.id, channel.id);
    db.prepare('UPDATE users SET subscriber_count = subscriber_count + 1 WHERE id = ?').run(channel.id);

    db.prepare(`
      INSERT INTO notifications (user_id, type, title, message)
      VALUES (?, 'subscriber', 'New Subscriber!', ?)
    `).run(channel.id, `${req.user.display_name} subscribed to your channel`);

    res.json({ subscribed: true });
  } catch (err) {
    logger.error('Subscribe error:', err);
    res.status(500).json({ error: 'Failed to subscribe' });
  }
}

export async function getSubscriptions(req, res) {
  try {
    const subs = db.prepare(`
      SELECT u.id, u.username, u.display_name, u.avatar_url, u.subscriber_count
      FROM subscriptions s JOIN users u ON s.channel_id = u.id
      WHERE s.subscriber_id = ?
      ORDER BY s.created_at DESC
    `).all(req.user.id);

    res.json({ subscriptions: subs.map(u => ({
      id: u.id, username: u.username, displayName: u.display_name,
      avatarUrl: u.avatar_url, subscriberCount: u.subscriber_count
    })) });
  } catch (err) {
    logger.error('Get subscriptions error:', err);
    res.status(500).json({ error: 'Failed to get subscriptions' });
  }
}

export async function getSubscriptionFeed(req, res) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 24, 50);
    const offset = (page - 1) * limit;

    const videos = db.prepare(`
      SELECT v.*, u.username, u.display_name, u.avatar_url, u.subscriber_count
      FROM videos v
      JOIN users u ON v.user_id = u.id
      JOIN subscriptions s ON s.channel_id = v.user_id AND s.subscriber_id = ?
      WHERE v.status = 'published' AND v.visibility = 'public'
      ORDER BY v.published_at DESC
      LIMIT ? OFFSET ?
    `).all(req.user.id, limit, offset);

    res.json({
      videos: videos.map(v => ({
        id: v.id, uuid: v.uuid, title: v.title, thumbnailUrl: v.thumbnail_url,
        duration: v.duration, isShort: !!v.is_short, viewCount: v.view_count,
        createdAt: v.created_at, publishedAt: v.published_at,
        channel: { id: v.user_id, username: v.username, displayName: v.display_name, avatarUrl: v.avatar_url }
      }))
    });
  } catch (err) {
    logger.error('Get sub feed error:', err);
    res.status(500).json({ error: 'Failed to get feed' });
  }
}

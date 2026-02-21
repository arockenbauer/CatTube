import db from '../models/database.js';
import logger from '../utils/logger.js';

export async function getDashboard(req, res) {
  try {
    const userId = req.user.id;

    const totalViews = db.prepare('SELECT COALESCE(SUM(view_count), 0) as total FROM videos WHERE user_id = ?').get(userId).total;
    const totalLikes = db.prepare('SELECT COALESCE(SUM(like_count), 0) as total FROM videos WHERE user_id = ?').get(userId).total;
    const totalDislikes = db.prepare('SELECT COALESCE(SUM(dislike_count), 0) as total FROM videos WHERE user_id = ?').get(userId).total;
    const totalVideos = db.prepare('SELECT COUNT(*) as total FROM videos WHERE user_id = ?').get(userId).total;
    const subscribers = db.prepare('SELECT subscriber_count FROM users WHERE id = ?').get(userId).subscriber_count;

    const totalWatchTime = db.prepare(`
      SELECT COALESCE(SUM(v.watch_duration), 0) as total
      FROM views v JOIN videos vid ON v.video_id = vid.id
      WHERE vid.user_id = ?
    `).get(userId).total;

    const avgRetention = db.prepare(`
      SELECT COALESCE(AVG(v.watch_percent), 0) as avg
      FROM views v JOIN videos vid ON v.video_id = vid.id
      WHERE vid.user_id = ?
    `).get(userId).avg;

    const recentSubs = db.prepare(`
      SELECT COUNT(*) as count FROM subscriptions
      WHERE channel_id = ? AND created_at >= datetime('now', '-30 days')
    `).get(userId).count;

    const dailyViews = db.prepare(`
      SELECT DATE(v.created_at) as date, COUNT(*) as views
      FROM views v JOIN videos vid ON v.video_id = vid.id
      WHERE vid.user_id = ? AND v.created_at >= datetime('now', '-30 days')
      GROUP BY DATE(v.created_at)
      ORDER BY date ASC
    `).all(userId);

    const dailySubs = db.prepare(`
      SELECT DATE(created_at) as date, COUNT(*) as subs
      FROM subscriptions
      WHERE channel_id = ? AND created_at >= datetime('now', '-30 days')
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `).all(userId);

    const topVideos = db.prepare(`
      SELECT id, uuid, title, thumbnail_url, view_count, like_count, dislike_count, duration, created_at
      FROM videos WHERE user_id = ? AND status = 'published'
      ORDER BY view_count DESC LIMIT 10
    `).all(userId);

    const videoCTR = topVideos.map(v => {
      const impressions = db.prepare(`
        SELECT COUNT(*) as count FROM views WHERE video_id = ?
      `).get(v.id).count;
      return {
        uuid: v.uuid, title: v.title, thumbnailUrl: v.thumbnail_url,
        viewCount: v.view_count, likeCount: v.like_count, dislikeCount: v.dislike_count,
        duration: v.duration, createdAt: v.created_at,
        ctr: impressions > 0 ? ((v.view_count / Math.max(impressions, 1)) * 100).toFixed(1) : '0.0'
      };
    });

    res.json({
      overview: {
        totalViews, totalLikes, totalDislikes, totalVideos, subscribers,
        totalWatchTimeMinutes: Math.round(totalWatchTime / 60),
        avgRetentionPercent: Math.round(avgRetention),
        recentSubscribers: recentSubs
      },
      charts: { dailyViews, dailySubs },
      topVideos: videoCTR
    });
  } catch (err) {
    logger.error('Dashboard error:', err);
    res.status(500).json({ error: 'Failed to get dashboard' });
  }
}

export async function getVideoAnalytics(req, res) {
  try {
    const { uuid } = req.params;
    const video = db.prepare('SELECT * FROM videos WHERE uuid = ? AND user_id = ?').get(uuid, req.user.id);
    if (!video) return res.status(404).json({ error: 'Video not found' });

    const dailyViews = db.prepare(`
      SELECT DATE(created_at) as date, COUNT(*) as views, AVG(watch_percent) as avgRetention
      FROM views WHERE video_id = ? AND created_at >= datetime('now', '-30 days')
      GROUP BY DATE(created_at) ORDER BY date ASC
    `).all(video.id);

    const viewSources = db.prepare(`
      SELECT COUNT(*) as total FROM views WHERE video_id = ?
    `).get(video.id);

    res.json({
      video: {
        uuid: video.uuid, title: video.title, viewCount: video.view_count,
        likeCount: video.like_count, dislikeCount: video.dislike_count,
        commentCount: video.comment_count, duration: video.duration,
        publishedAt: video.published_at
      },
      charts: { dailyViews },
      totalUniqueViews: viewSources.total
    });
  } catch (err) {
    logger.error('Video analytics error:', err);
    res.status(500).json({ error: 'Failed to get analytics' });
  }
}

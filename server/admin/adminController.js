import db from '../models/database.js';
import { deleteVideoFiles } from '../services/storageService.js';
import logger from '../utils/logger.js';

function logAction(adminId, action, targetType, targetId, details) {
  db.prepare(`
    INSERT INTO admin_logs (admin_id, action, target_type, target_id, details)
    VALUES (?, ?, ?, ?, ?)
  `).run(adminId, action, targetType, targetId, details || null);
}

export async function getAdminDashboard(req, res) {
  try {
    const totalUsers = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
    const totalVideos = db.prepare('SELECT COUNT(*) as c FROM videos').get().c;
    const totalViews = db.prepare('SELECT COALESCE(SUM(view_count), 0) as c FROM videos').get().c;
    const totalComments = db.prepare('SELECT COUNT(*) as c FROM comments WHERE is_deleted = 0').get().c;
    const pendingReports = db.prepare("SELECT COUNT(*) as c FROM reports WHERE status = 'pending'").get().c;
    const bannedUsers = db.prepare('SELECT COUNT(*) as c FROM users WHERE is_banned = 1').get().c;
    const processingVideos = db.prepare("SELECT COUNT(*) as c FROM videos WHERE status = 'processing'").get().c;

    const newUsersToday = db.prepare("SELECT COUNT(*) as c FROM users WHERE created_at >= datetime('now', '-1 day')").get().c;
    const newVideosToday = db.prepare("SELECT COUNT(*) as c FROM videos WHERE created_at >= datetime('now', '-1 day')").get().c;

    const dailyStats = db.prepare(`
      SELECT DATE(created_at) as date, COUNT(*) as users
      FROM users WHERE created_at >= datetime('now', '-30 days')
      GROUP BY DATE(created_at) ORDER BY date ASC
    `).all();

    const dailyVideoStats = db.prepare(`
      SELECT DATE(created_at) as date, COUNT(*) as videos
      FROM videos WHERE created_at >= datetime('now', '-30 days')
      GROUP BY DATE(created_at) ORDER BY date ASC
    `).all();

    res.json({
      stats: {
        totalUsers, totalVideos, totalViews, totalComments,
        pendingReports, bannedUsers, processingVideos,
        newUsersToday, newVideosToday
      },
      charts: { dailyUsers: dailyStats, dailyVideos: dailyVideoStats }
    });
  } catch (err) {
    logger.error('Admin dashboard error:', err);
    res.status(500).json({ error: 'Failed to get dashboard' });
  }
}

export async function getUsers(req, res) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;
    const search = req.query.search;

    let where = '';
    const params = [];
    if (search) {
      where = 'WHERE username LIKE ? OR email LIKE ? OR display_name LIKE ?';
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    const users = db.prepare(`
      SELECT id, username, email, display_name, avatar_url, level, is_banned, shadow_banned,
        email_verified, subscriber_count, total_views, created_at
      FROM users ${where}
      ORDER BY created_at DESC LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    const total = db.prepare(`SELECT COUNT(*) as c FROM users ${where}`).get(...params).c;

    res.json({
      users, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (err) {
    logger.error('Admin get users error:', err);
    res.status(500).json({ error: 'Failed to get users' });
  }
}

export async function updateUserLevel(req, res) {
  try {
    const { userId } = req.params;
    const { level } = req.body;
    if (level === undefined || level < 0 || level > 3) {
      return res.status(400).json({ error: 'Invalid level (0-3)' });
    }

    db.prepare('UPDATE users SET level = ?, updated_at = datetime(\'now\') WHERE id = ?').run(level, parseInt(userId));
    logAction(req.user.id, 'update_level', 'user', parseInt(userId), `Set level to ${level}`);

    res.json({ message: 'User level updated' });
  } catch (err) {
    logger.error('Update level error:', err);
    res.status(500).json({ error: 'Failed to update level' });
  }
}

export async function banUser(req, res) {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    db.prepare('UPDATE users SET is_banned = 1, ban_reason = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .run(reason || 'Banned by admin', parseInt(userId));
    logAction(req.user.id, 'ban_user', 'user', parseInt(userId), reason);

    res.json({ message: 'User banned' });
  } catch (err) {
    logger.error('Ban user error:', err);
    res.status(500).json({ error: 'Failed to ban user' });
  }
}

export async function unbanUser(req, res) {
  try {
    const { userId } = req.params;
    db.prepare('UPDATE users SET is_banned = 0, ban_reason = NULL, updated_at = datetime(\'now\') WHERE id = ?')
      .run(parseInt(userId));
    logAction(req.user.id, 'unban_user', 'user', parseInt(userId), null);

    res.json({ message: 'User unbanned' });
  } catch (err) {
    logger.error('Unban user error:', err);
    res.status(500).json({ error: 'Failed to unban user' });
  }
}

export async function shadowBanUser(req, res) {
  try {
    const { userId } = req.params;
    const user = db.prepare('SELECT shadow_banned FROM users WHERE id = ?').get(parseInt(userId));
    const newVal = user.shadow_banned ? 0 : 1;
    db.prepare('UPDATE users SET shadow_banned = ? WHERE id = ?').run(newVal, parseInt(userId));
    logAction(req.user.id, newVal ? 'shadow_ban' : 'shadow_unban', 'user', parseInt(userId), null);

    res.json({ shadowBanned: !!newVal });
  } catch (err) {
    logger.error('Shadow ban error:', err);
    res.status(500).json({ error: 'Failed to toggle shadow ban' });
  }
}

export async function adminDeleteVideo(req, res) {
  try {
    const { videoId } = req.params;
    const video = db.prepare('SELECT * FROM videos WHERE id = ?').get(parseInt(videoId));
    if (!video) return res.status(404).json({ error: 'Video not found' });

    deleteVideoFiles(video.uuid);
    db.prepare('DELETE FROM videos WHERE id = ?').run(video.id);
    logAction(req.user.id, 'delete_video', 'video', video.id, video.title);

    res.json({ message: 'Video deleted' });
  } catch (err) {
    logger.error('Admin delete video error:', err);
    res.status(500).json({ error: 'Failed to delete video' });
  }
}

export async function getVideos(req, res) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;
    const status = req.query.status;
    const search = req.query.search;

    let where = 'WHERE 1=1';
    const params = [];
    if (status) { where += ' AND v.status = ?'; params.push(status); }
    if (search) { where += ' AND (v.title LIKE ? OR u.username LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }

    const videos = db.prepare(`
      SELECT v.*, u.username, u.display_name
      FROM videos v JOIN users u ON v.user_id = u.id
      ${where} ORDER BY v.created_at DESC LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    const total = db.prepare(`SELECT COUNT(*) as c FROM videos v JOIN users u ON v.user_id = u.id ${where}`).get(...params).c;

    res.json({
      videos: videos.map(v => ({
        id: v.id, uuid: v.uuid, title: v.title, status: v.status, visibility: v.visibility,
        viewCount: v.view_count, likeCount: v.like_count, duration: v.duration,
        isShort: !!v.is_short, createdAt: v.created_at,
        author: { username: v.username, displayName: v.display_name }
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (err) {
    logger.error('Admin get videos error:', err);
    res.status(500).json({ error: 'Failed to get videos' });
  }
}

export async function getReports(req, res) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;
    const status = req.query.status || 'pending';

    const reports = db.prepare(`
      SELECT r.*, ru.username as reporter_username,
        v.title as video_title, v.uuid as video_uuid,
        tu.username as target_username
      FROM reports r
      LEFT JOIN users ru ON r.reporter_id = ru.id
      LEFT JOIN videos v ON r.video_id = v.id
      LEFT JOIN users tu ON r.user_id = tu.id
      WHERE r.status = ?
      ORDER BY r.created_at DESC LIMIT ? OFFSET ?
    `).all(status, limit, offset);

    const total = db.prepare('SELECT COUNT(*) as c FROM reports WHERE status = ?').get(status).c;

    res.json({
      reports: reports.map(r => ({
        id: r.id, reason: r.reason, details: r.details, status: r.status,
        createdAt: r.created_at, reporter: r.reporter_username,
        videoTitle: r.video_title, videoUuid: r.video_uuid,
        targetUser: r.target_username
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (err) {
    logger.error('Admin get reports error:', err);
    res.status(500).json({ error: 'Failed to get reports' });
  }
}

export async function resolveReport(req, res) {
  try {
    const { reportId } = req.params;
    const { action } = req.body;

    db.prepare(`
      UPDATE reports SET status = 'resolved', resolved_by = ?, resolved_at = datetime('now')
      WHERE id = ?
    `).run(req.user.id, parseInt(reportId));

    logAction(req.user.id, 'resolve_report', 'report', parseInt(reportId), action);

    res.json({ message: 'Report resolved' });
  } catch (err) {
    logger.error('Resolve report error:', err);
    res.status(500).json({ error: 'Failed to resolve report' });
  }
}

export async function getLogs(req, res) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const offset = (page - 1) * limit;

    const logs = db.prepare(`
      SELECT al.*, u.username as admin_username
      FROM admin_logs al JOIN users u ON al.admin_id = u.id
      ORDER BY al.created_at DESC LIMIT ? OFFSET ?
    `).all(limit, offset);

    res.json({
      logs: logs.map(l => ({
        id: l.id, action: l.action, targetType: l.target_type, targetId: l.target_id,
        details: l.details, adminUsername: l.admin_username, createdAt: l.created_at
      }))
    });
  } catch (err) {
    logger.error('Admin get logs error:', err);
    res.status(500).json({ error: 'Failed to get logs' });
  }
}

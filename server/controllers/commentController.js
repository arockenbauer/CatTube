import db from '../models/database.js';
import logger from '../utils/logger.js';

function formatComment(c) {
  return {
    id: c.id,
    content: c.content,
    likeCount: c.like_count,
    isPinned: !!c.is_pinned,
    isDeleted: !!c.is_deleted,
    parentId: c.parent_id,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
    author: c.username ? {
      id: c.user_id,
      username: c.username,
      displayName: c.display_name,
      avatarUrl: c.avatar_url
    } : undefined,
    isLiked: !!c._isLiked,
    replyCount: c._replyCount || 0
  };
}

export async function getComments(req, res) {
  try {
    const { uuid } = req.params;
    const video = db.prepare('SELECT id FROM videos WHERE uuid = ?').get(uuid);
    if (!video) return res.status(404).json({ error: 'Video not found' });

    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const offset = (page - 1) * limit;
    const sort = req.query.sort === 'oldest' ? 'ASC' : 'DESC';

    const comments = db.prepare(`
      SELECT c.*, u.username, u.display_name, u.avatar_url
      FROM comments c JOIN users u ON c.user_id = u.id
      WHERE c.video_id = ? AND c.parent_id IS NULL AND c.is_deleted = 0
      ORDER BY c.is_pinned DESC, c.created_at ${sort}
      LIMIT ? OFFSET ?
    `).all(video.id, limit, offset);

    const enriched = comments.map(c => {
      const replyCount = db.prepare('SELECT COUNT(*) as count FROM comments WHERE parent_id = ? AND is_deleted = 0').get(c.id).count;
      let isLiked = false;
      if (req.user) {
        isLiked = !!db.prepare('SELECT id FROM comment_likes WHERE user_id = ? AND comment_id = ?').get(req.user.id, c.id);
      }
      c._replyCount = replyCount;
      c._isLiked = isLiked;
      return formatComment(c);
    });

    const total = db.prepare('SELECT COUNT(*) as count FROM comments WHERE video_id = ? AND parent_id IS NULL AND is_deleted = 0').get(video.id).count;

    res.json({
      comments: enriched,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (err) {
    logger.error('Get comments error:', err);
    res.status(500).json({ error: 'Failed to get comments' });
  }
}

export async function getReplies(req, res) {
  try {
    const { commentId } = req.params;
    const replies = db.prepare(`
      SELECT c.*, u.username, u.display_name, u.avatar_url
      FROM comments c JOIN users u ON c.user_id = u.id
      WHERE c.parent_id = ? AND c.is_deleted = 0
      ORDER BY c.created_at ASC
    `).all(parseInt(commentId));

    res.json({ replies: replies.map(c => { c._replyCount = 0; c._isLiked = false; return formatComment(c); }) });
  } catch (err) {
    logger.error('Get replies error:', err);
    res.status(500).json({ error: 'Failed to get replies' });
  }
}

export async function addComment(req, res) {
  try {
    const { uuid } = req.params;
    const { content, parentId } = req.validated;
    const video = db.prepare('SELECT id, user_id FROM videos WHERE uuid = ?').get(uuid);
    if (!video) return res.status(404).json({ error: 'Video not found' });

    if (parentId) {
      const parent = db.prepare('SELECT id FROM comments WHERE id = ? AND video_id = ?').get(parentId, video.id);
      if (!parent) return res.status(404).json({ error: 'Parent comment not found' });
    }

    const result = db.prepare(`
      INSERT INTO comments (user_id, video_id, parent_id, content)
      VALUES (?, ?, ?, ?)
    `).run(req.user.id, video.id, parentId || null, content);

    db.prepare('UPDATE videos SET comment_count = comment_count + 1 WHERE id = ?').run(video.id);

    if (video.user_id !== req.user.id) {
      db.prepare(`
        INSERT INTO notifications (user_id, type, title, message, link)
        VALUES (?, 'comment', 'New Comment', ?, ?)
      `).run(video.user_id, `${req.user.display_name} commented on your video`, `/watch/${uuid}`);
    }

    const comment = db.prepare(`
      SELECT c.*, u.username, u.display_name, u.avatar_url
      FROM comments c JOIN users u ON c.user_id = u.id WHERE c.id = ?
    `).get(result.lastInsertRowid);

    comment._replyCount = 0;
    comment._isLiked = false;

    res.status(201).json({ comment: formatComment(comment) });
  } catch (err) {
    logger.error('Add comment error:', err);
    res.status(500).json({ error: 'Failed to add comment' });
  }
}

export async function deleteComment(req, res) {
  try {
    const { commentId } = req.params;
    const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(parseInt(commentId));
    if (!comment) return res.status(404).json({ error: 'Comment not found' });

    if (comment.user_id !== req.user.id && req.user.level < 3) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    db.prepare('UPDATE comments SET is_deleted = 1, content = "[deleted]" WHERE id = ?').run(comment.id);
    db.prepare('UPDATE videos SET comment_count = MAX(0, comment_count - 1) WHERE id = ?').run(comment.video_id);

    res.json({ message: 'Comment deleted' });
  } catch (err) {
    logger.error('Delete comment error:', err);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
}

export async function likeComment(req, res) {
  try {
    const { commentId } = req.params;
    const id = parseInt(commentId);
    const existing = db.prepare('SELECT id FROM comment_likes WHERE user_id = ? AND comment_id = ?').get(req.user.id, id);

    if (existing) {
      db.prepare('DELETE FROM comment_likes WHERE id = ?').run(existing.id);
      db.prepare('UPDATE comments SET like_count = MAX(0, like_count - 1) WHERE id = ?').run(id);
      return res.json({ liked: false });
    }

    db.prepare('INSERT INTO comment_likes (user_id, comment_id) VALUES (?, ?)').run(req.user.id, id);
    db.prepare('UPDATE comments SET like_count = like_count + 1 WHERE id = ?').run(id);
    res.json({ liked: true });
  } catch (err) {
    logger.error('Like comment error:', err);
    res.status(500).json({ error: 'Failed to like comment' });
  }
}

export async function pinComment(req, res) {
  try {
    const { commentId } = req.params;
    const comment = db.prepare('SELECT c.*, v.user_id as video_owner FROM comments c JOIN videos v ON c.video_id = v.id WHERE c.id = ?').get(parseInt(commentId));
    if (!comment) return res.status(404).json({ error: 'Comment not found' });

    if (comment.video_owner !== req.user.id && req.user.level < 3) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    db.prepare('UPDATE comments SET is_pinned = 0 WHERE video_id = ?').run(comment.video_id);
    db.prepare('UPDATE comments SET is_pinned = 1 WHERE id = ?').run(comment.id);

    res.json({ pinned: true });
  } catch (err) {
    logger.error('Pin comment error:', err);
    res.status(500).json({ error: 'Failed to pin comment' });
  }
}

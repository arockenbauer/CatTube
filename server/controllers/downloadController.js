import { v4 as uuidv4 } from 'uuid';
import { createReadStream, existsSync, statSync } from 'fs';
import { join } from 'path';
import db from '../models/database.js';
import config from '../config.js';
import logger from '../utils/logger.js';

export async function generateDownloadToken(req, res) {
  try {
    const { uuid } = req.params;
    const { resolution } = req.query;

    if (req.user.level < 2) {
      return res.status(403).json({ error: 'Premium required for downloads' });
    }

    const video = db.prepare('SELECT id, uuid FROM videos WHERE uuid = ?').get(uuid);
    if (!video) return res.status(404).json({ error: 'Video not found' });

    const file = db.prepare('SELECT * FROM video_files WHERE video_id = ? AND resolution = ?')
      .get(video.id, resolution || '720p');
    if (!file) return res.status(404).json({ error: 'Resolution not available' });

    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 60000).toISOString();

    db.prepare(`
      INSERT INTO download_tokens (user_id, video_id, token, expires_at)
      VALUES (?, ?, ?, ?)
    `).run(req.user.id, video.id, token, expiresAt);

    res.json({ downloadToken: token, expiresIn: 60 });
  } catch (err) {
    logger.error('Generate download token error:', err);
    res.status(500).json({ error: 'Failed to generate download token' });
  }
}

export async function downloadVideo(req, res) {
  try {
    const { token } = req.params;

    const dl = db.prepare(`
      SELECT dt.*, v.uuid, v.title, vf.file_path, vf.resolution
      FROM download_tokens dt
      JOIN videos v ON dt.video_id = v.id
      JOIN video_files vf ON vf.video_id = v.id
      WHERE dt.token = ? AND dt.used = 0
      LIMIT 1
    `).get(token);

    if (!dl) return res.status(404).json({ error: 'Invalid or expired download token' });
    if (new Date(dl.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Download token expired' });
    }

    const filePath = join(config.uploadsDir, '..', dl.file_path);
    if (!existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    db.prepare('UPDATE download_tokens SET used = 1 WHERE id = ?').run(dl.id);

    const stat = statSync(filePath);
    const filename = `${dl.title.replace(/[^a-zA-Z0-9-_ ]/g, '')}_${dl.resolution}.mp4`;

    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    createReadStream(filePath).pipe(res);
  } catch (err) {
    logger.error('Download error:', err);
    res.status(500).json({ error: 'Download failed' });
  }
}

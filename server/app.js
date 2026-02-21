import express from 'express';
import { createServer } from 'http';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import hpp from 'hpp';
import rateLimit from 'express-rate-limit';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';

import config from './config.js';
import logger from './utils/logger.js';
import db from './models/database.js';
import { initRedis } from './utils/redis.js';
import { initQueue, createQueue } from './utils/queue.js';
import { startVideoWorker } from './workers/videoWorker.js';
import { initSocket } from './services/socketService.js';
import { sanitizeMiddleware } from './utils/sanitize.js';

import authRoutes from './routes/auth.js';
import videoRoutes from './routes/videos.js';
import commentRoutes from './routes/comments.js';
import channelRoutes from './routes/channels.js';
import searchRoutes from './routes/search.js';
import notificationRoutes from './routes/notifications.js';
import studioRoutes from './routes/studio.js';
import adminRoutes from './routes/admin.js';
import downloadRoutes from './routes/download.js';
import recommendationRoutes from './routes/recommendations.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

mkdirSync(join(__dirname, 'data'), { recursive: true });
mkdirSync(join(__dirname, 'uploads'), { recursive: true });

import('./migrate.js').catch(err => logger.error('Migration error:', err));

const app = express();
const server = createServer(app);

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false
}));
app.use(cors(config.cors));
app.use(cookieParser());
app.use(hpp());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(sanitizeMiddleware);

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' }
});
app.use('/api', limiter);

app.use('/uploads', express.static(join(__dirname, 'uploads'), {
  setHeaders: (res) => {
    res.setHeader('Accept-Ranges', 'bytes');
  }
}));

app.use('/api/auth', authRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/channels', channelRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/studio', studioRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/download', downloadRoutes);
app.use('/api/recommendations', recommendationRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

const clientDist = join(__dirname, '..', 'client', 'dist');
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    res.sendFile(join(clientDist, 'index.html'));
  });
}

app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large (max 5GB)' });
  }
  if (err.message === 'Invalid video format') {
    return res.status(400).json({ error: 'Invalid video format. Supported: mp4, webm, mov, avi, mkv' });
  }
  res.status(500).json({ error: 'Internal server error' });
});

function processAdminsTxt() {
  const adminsFile = join(__dirname, 'admins.txt');
  if (!existsSync(adminsFile)) return;
  try {
    const content = readFileSync(adminsFile, 'utf-8').trim();
    if (!content) return;
    const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
    const remaining = [];
    for (const username of lines) {
      const user = db.prepare('SELECT id, level FROM users WHERE username = ?').get(username);
      if (user) {
        if (user.level < 3) {
          db.prepare('UPDATE users SET level = 3 WHERE id = ?').run(user.id);
          logger.info(`Promoted "${username}" to Admin via admins.txt`);
        } else {
          logger.info(`"${username}" is already Admin, skipping`);
        }
      } else {
        remaining.push(username);
        logger.warn(`User "${username}" from admins.txt not found, keeping in file`);
      }
    }
    writeFileSync(adminsFile, remaining.join('\n') + (remaining.length ? '\n' : ''), 'utf-8');
  } catch (err) {
    logger.error('Error processing admins.txt:', err);
  }
}

async function start() {
  await initRedis(config.redisUrl);

  const queueConnection = await initQueue();
  createQueue('video-processing', queueConnection);
  startVideoWorker(queueConnection);

  processAdminsTxt();

  initSocket(server);

  server.listen(config.port, () => {
    logger.info(`CatTube server running on port ${config.port}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

start().catch(err => {
  logger.error('Failed to start server:', err);
  process.exit(1);
});

export default app;

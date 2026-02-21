import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const config = {
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',
  port: process.env.PORT || 4000,
  jwtSecret: process.env.JWT_SECRET || 'catube-dev-secret-change-me',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'catube-refresh-dev-secret-change-me',
  jwtExpiry: '15m',
  jwtRefreshExpiry: '7d',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  dbPath: join(__dirname, 'data', 'catube.db'),
  uploadsDir: join(__dirname, 'uploads'),
  maxFileSize: 5 * 1024 * 1024 * 1024,
  allowedVideoTypes: ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska'],
  resolutions: [
    { name: '360p', width: 640, height: 360, bitrate: '800k' },
    { name: '480p', width: 854, height: 480, bitrate: '1500k' },
    { name: '720p', width: 1280, height: 720, bitrate: '2500k' },
    { name: '1080p', width: 1920, height: 1080, bitrate: '5000k' },
    { name: '1440p', width: 2560, height: 1440, bitrate: '10000k' },
    { name: '2160p', width: 3840, height: 2160, bitrate: '20000k' }
  ],
  antiSpam: {
    viewCooldownMinutes: 5,
    maxActionsPerMinute: 30,
    maxUploadsPerDay: 20,
    spikeThreshold: 100,
    spikeWindowMinutes: 10
  },
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true
  }
};

export default config;

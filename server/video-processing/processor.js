import { execFile, spawn } from 'child_process';
import { promisify } from 'util';
import { existsSync, mkdirSync, statSync } from 'fs';
import { join } from 'path';
import config from '../config.js';
import db from '../models/database.js';
import logger from '../utils/logger.js';

const execFileAsync = promisify(execFile);

function ffmpegPath() {
  return process.env.FFMPEG_PATH || 'ffmpeg';
}

function ffprobePath() {
  return process.env.FFPROBE_PATH || 'ffprobe';
}

async function getVideoInfo(inputPath) {
  try {
    const { stdout } = await execFileAsync(ffprobePath(), [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      inputPath
    ]);
    const info = JSON.parse(stdout);
    const videoStream = info.streams.find(s => s.codec_type === 'video');
    return {
      duration: parseFloat(info.format.duration) || 0,
      width: videoStream ? videoStream.width : 0,
      height: videoStream ? videoStream.height : 0,
      bitrate: info.format.bit_rate ? parseInt(info.format.bit_rate) : 0,
      codec: videoStream ? videoStream.codec_name : 'unknown'
    };
  } catch (err) {
    logger.error('ffprobe error:', err);
    throw new Error('Failed to analyze video');
  }
}

async function generateThumbnail(inputPath, outputPath, duration) {
  const seekTime = Math.min(duration * 0.25, 10);
  try {
    await execFileAsync(ffmpegPath(), [
      '-y', '-ss', String(seekTime),
      '-i', inputPath,
      '-vframes', '1',
      '-q:v', '2',
      '-vf', 'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2',
      outputPath
    ]);
    return true;
  } catch (err) {
    logger.error('Thumbnail generation error:', err);
    return false;
  }
}

function transcodeToResolution(inputPath, outputPath, res) {
  return new Promise((resolve, reject) => {
    const args = [
      '-y', '-i', inputPath,
      '-c:v', 'libx264',
      '-preset', 'medium',
      '-crf', '23',
      '-b:v', res.bitrate,
      '-maxrate', res.bitrate,
      '-bufsize', String(parseInt(res.bitrate) * 2) + 'k',
      '-vf', `scale=${res.width}:${res.height}:force_original_aspect_ratio=decrease,pad=${res.width}:${res.height}:(ow-iw)/2:(oh-ih)/2`,
      '-c:a', 'aac',
      '-b:a', '128k',
      '-threads', '1',
      '-movflags', '+faststart',
      outputPath
    ];

    const proc = spawn(ffmpegPath(), args);
    let stderr = '';
    proc.stderr.on('data', (data) => { stderr += data.toString(); });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg exited with code ${code}: ${stderr.slice(-500)}`));
    });
    proc.on('error', reject);
  });
}

function getApplicableResolutions(sourceHeight) {
  const applicable = config.resolutions.filter(r => r.height <= sourceHeight);
  if (applicable.length === 0) {
    return [config.resolutions[0]];
  }
  return applicable;
}

export async function processVideo(job) {
  const { videoId, inputPath } = job.data;
  logger.info(`Processing video ${videoId} from ${inputPath}`);

  const video = db.prepare('SELECT * FROM videos WHERE id = ?').get(videoId);
  if (!video) {
    throw new Error(`Video ${videoId} not found`);
  }

  try {
    db.prepare("UPDATE videos SET status = 'transcoding' WHERE id = ?").run(videoId);

    const info = await getVideoInfo(inputPath);
    const duration = info.duration;
    const isShort = duration > 0 && duration <= 60;
    const sourceHeight = info.height;

    logger.info(`Video ${videoId}: source resolution ${info.width}x${info.height}, duration ${duration.toFixed(1)}s`);

    db.prepare('UPDATE videos SET duration = ?, is_short = ? WHERE id = ?').run(duration, isShort ? 1 : 0, videoId);

    const videoDir = join(config.uploadsDir, video.uuid);
    mkdirSync(videoDir, { recursive: true });

    const applicableResolutions = getApplicableResolutions(sourceHeight);
    const targetNames = applicableResolutions.map(r => r.name).join(',');
    db.prepare('UPDATE videos SET target_resolutions = ? WHERE id = ?').run(targetNames, videoId);

    logger.info(`Video ${videoId}: will encode to [${targetNames}] (source: ${sourceHeight}p)`);

    const thumbPath = join(videoDir, 'thumbnail.jpg');
    const thumbPromise = generateThumbnail(inputPath, thumbPath, duration).then(ok => {
      if (ok) {
        db.prepare('UPDATE videos SET thumbnail_url = ? WHERE id = ?').run(`/uploads/${video.uuid}/thumbnail.jpg`, videoId);
        logger.info(`Video ${videoId}: thumbnail generated`);
      }
    });

    const transcodePromises = applicableResolutions.map(res => {
      const outputPath = join(videoDir, `${res.name}.mp4`);
      logger.info(`Transcoding ${videoId} to ${res.name} (parallel)...`);

      return transcodeToResolution(inputPath, outputPath, res).then(() => {
        const fileSize = existsSync(outputPath) ? statSync(outputPath).size : 0;
        db.prepare(`
          INSERT INTO video_files (video_id, resolution, file_path, file_size, width, height, bitrate)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(videoId, res.name, `/uploads/${video.uuid}/${res.name}.mp4`, fileSize, res.width, res.height, res.bitrate);
        logger.info(`Transcoded ${videoId} to ${res.name} (${(fileSize / 1024 / 1024).toFixed(1)}MB)`);
      });
    });

    await Promise.all([thumbPromise, ...transcodePromises]);

    db.prepare(`
      UPDATE videos SET status = 'published', published_at = datetime('now'), updated_at = datetime('now') WHERE id = ?
    `).run(videoId);

    const owner = db.prepare('SELECT id FROM users WHERE id = ?').get(video.user_id);
    if (owner) {
      db.prepare(`
        INSERT INTO notifications (user_id, type, title, message, link)
        VALUES (?, 'video_ready', 'Video Ready!', ?, ?)
      `).run(owner.id, `Your video "${video.title}" has been processed and published.`, `/watch/${video.uuid}`);
    }

    logger.info(`Video ${videoId} processing complete! (${isShort ? 'Short' : 'Video'}, ${duration.toFixed(1)}s, ${applicableResolutions.length} resolutions)`);
  } catch (err) {
    logger.error(`Video ${videoId} processing failed:`, err);
    db.prepare("UPDATE videos SET status = 'failed' WHERE id = ?").run(videoId);
    throw err;
  }
}

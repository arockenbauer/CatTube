import { existsSync, mkdirSync, createReadStream, statSync, unlinkSync, readdirSync, rmdirSync } from 'fs';
import { join } from 'path';
import config from '../config.js';
import logger from '../utils/logger.js';

mkdirSync(config.uploadsDir, { recursive: true });

export function getUploadDir(videoUuid) {
  const dir = join(config.uploadsDir, videoUuid);
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function getFilePath(relativePath) {
  return join(config.uploadsDir, '..', relativePath);
}

export function fileExists(relativePath) {
  return existsSync(join(config.uploadsDir, '..', relativePath));
}

export function getFileStream(absolutePath, options = {}) {
  return createReadStream(absolutePath, options);
}

export function getFileSize(absolutePath) {
  try {
    return statSync(absolutePath).size;
  } catch {
    return 0;
  }
}

export function deleteVideoFiles(videoUuid) {
  const dir = join(config.uploadsDir, videoUuid);
  try {
    if (existsSync(dir)) {
      const files = readdirSync(dir);
      for (const file of files) {
        unlinkSync(join(dir, file));
      }
      rmdirSync(dir);
      logger.info(`Deleted video files for ${videoUuid}`);
    }
  } catch (err) {
    logger.error(`Error deleting video files for ${videoUuid}:`, err);
  }
}

export function deleteTempFile(path) {
  try {
    if (existsSync(path)) {
      unlinkSync(path);
    }
  } catch (err) {
    logger.error(`Error deleting temp file ${path}:`, err);
  }
}

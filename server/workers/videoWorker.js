import { createWorker } from '../utils/queue.js';
import { processVideo } from '../video-processing/processor.js';
import logger from '../utils/logger.js';

let worker = null;

export function startVideoWorker(connection) {
  worker = createWorker('video-processing', async (job) => {
    logger.info(`[VideoWorker] Starting job ${job.id || job.name}`);
    await processVideo(job);
  }, connection);

  worker.on('completed', (job) => {
    logger.info(`[VideoWorker] Job completed: ${job.id || job.name}`);
  });

  worker.on('failed', (job, err) => {
    logger.error(`[VideoWorker] Job failed: ${job.id || job.name}`, err);
  });

  logger.info('[VideoWorker] Video processing worker started');
  return worker;
}

export function getWorker() {
  return worker;
}

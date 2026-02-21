import logger from './logger.js';
import config from '../config.js';
import { EventEmitter } from 'events';

let Queue, Worker, useBullMQ = false;

class InMemoryQueue extends EventEmitter {
  constructor(name) {
    super();
    this.name = name;
    this.jobs = [];
    this.processing = false;
    this.processor = null;
  }

  async add(jobName, data, opts = {}) {
    const job = {
      id: `${this.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: jobName,
      data,
      opts,
      timestamp: Date.now(),
      attempts: 0
    };
    this.jobs.push(job);
    logger.info(`[InMemoryQueue:${this.name}] Job added: ${jobName} (${job.id})`);
    this._processNext();
    return job;
  }

  async _processNext() {
    if (this.processing || this.jobs.length === 0 || !this.processor) return;
    this.processing = true;
    const job = this.jobs.shift();
    try {
      job.attempts++;
      await this.processor(job);
      this.emit('completed', job);
      logger.info(`[InMemoryQueue:${this.name}] Job completed: ${job.id}`);
    } catch (err) {
      logger.error(`[InMemoryQueue:${this.name}] Job failed: ${job.id}`, err);
      if (job.attempts < (job.opts.attempts || 3)) {
        this.jobs.push(job);
      } else {
        this.emit('failed', job, err);
      }
    }
    this.processing = false;
    this._processNext();
  }

  process(fn) {
    this.processor = fn;
    this._processNext();
  }

  async getWaitingCount() { return this.jobs.length; }
  async getActiveCount() { return this.processing ? 1 : 0; }
  async close() { this.jobs = []; }
}

class InMemoryWorker extends EventEmitter {
  constructor(name, processor) {
    super();
    this.name = name;
    this.queue = queues.get(name);
    if (this.queue) {
      this.queue.process(processor);
      this.queue.on('completed', (job) => this.emit('completed', job));
      this.queue.on('failed', (job, err) => this.emit('failed', job, err));
    }
  }
  async close() {}
}

const queues = new Map();

async function initQueue() {
  try {
    const bullmq = await import('bullmq');
    const IORedis = (await import('ioredis')).default;
    const connection = new IORedis(config.redisUrl, {
      maxRetriesPerRequest: null,
      retryStrategy() { return null; },
      connectTimeout: 3000,
      lazyConnect: true,
      enableOfflineQueue: false
    });
    connection.on('error', () => {});
    await connection.connect();
    Queue = bullmq.Queue;
    Worker = bullmq.Worker;
    useBullMQ = true;
    logger.info('BullMQ initialized with Redis');
    return connection;
  } catch (err) {
    logger.warn(`BullMQ unavailable (${err.message}), using in-memory queue fallback`);
    useBullMQ = false;
    return null;
  }
}

function createQueue(name, connection) {
  if (useBullMQ && connection) {
    const q = new Queue(name, { connection });
    queues.set(name, q);
    return q;
  }
  const q = new InMemoryQueue(name);
  queues.set(name, q);
  return q;
}

function createWorker(name, processor, connection) {
  if (useBullMQ && connection) {
    const w = new Worker(name, processor, {
      connection,
      concurrency: 2,
      limiter: { max: 2, duration: 1000 }
    });
    return w;
  }
  return new InMemoryWorker(name, processor);
}

function getQueue(name) {
  return queues.get(name);
}

export { initQueue, createQueue, createWorker, getQueue };

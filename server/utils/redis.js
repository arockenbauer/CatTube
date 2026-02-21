import logger from './logger.js';

let redisClient = null;
let useRedis = false;

const memoryStore = new Map();
const memoryExpiry = new Map();

function cleanExpired() {
  const now = Date.now();
  for (const [key, expiry] of memoryExpiry.entries()) {
    if (expiry <= now) {
      memoryStore.delete(key);
      memoryExpiry.delete(key);
    }
  }
}

setInterval(cleanExpired, 30000);

async function initRedis(url) {
  try {
    const { default: Redis } = await import('ioredis');
    redisClient = new Redis(url, {
      maxRetriesPerRequest: 0,
      retryStrategy() { return null; },
      connectTimeout: 3000,
      lazyConnect: true,
      enableOfflineQueue: false
    });

    redisClient.on('error', () => {});

    await redisClient.connect();
    useRedis = true;
    logger.info('Redis connected successfully');
  } catch (err) {
    logger.warn(`Redis unavailable (${err.message}), using in-memory fallback`);
    useRedis = false;
    if (redisClient) {
      try { redisClient.disconnect(false); } catch {}
    }
    redisClient = null;
  }
}

const cache = {
  async get(key) {
    if (useRedis && redisClient) {
      try {
        return await redisClient.get(key);
      } catch {
        useRedis = false;
      }
    }
    const expiry = memoryExpiry.get(key);
    if (expiry && expiry <= Date.now()) {
      memoryStore.delete(key);
      memoryExpiry.delete(key);
      return null;
    }
    return memoryStore.get(key) || null;
  },

  async set(key, value, exSeconds) {
    if (useRedis && redisClient) {
      try {
        if (exSeconds) {
          await redisClient.set(key, value, 'EX', exSeconds);
        } else {
          await redisClient.set(key, value);
        }
        return;
      } catch {
        useRedis = false;
      }
    }
    memoryStore.set(key, value);
    if (exSeconds) {
      memoryExpiry.set(key, Date.now() + exSeconds * 1000);
    }
  },

  async del(key) {
    if (useRedis && redisClient) {
      try {
        await redisClient.del(key);
        return;
      } catch {
        useRedis = false;
      }
    }
    memoryStore.delete(key);
    memoryExpiry.delete(key);
  },

  async incr(key) {
    if (useRedis && redisClient) {
      try {
        return await redisClient.incr(key);
      } catch {
        useRedis = false;
      }
    }
    const val = parseInt(memoryStore.get(key) || '0', 10) + 1;
    memoryStore.set(key, String(val));
    return val;
  },

  async expire(key, seconds) {
    if (useRedis && redisClient) {
      try {
        await redisClient.expire(key, seconds);
        return;
      } catch {
        useRedis = false;
      }
    }
    memoryExpiry.set(key, Date.now() + seconds * 1000);
  },

  async ttl(key) {
    if (useRedis && redisClient) {
      try {
        return await redisClient.ttl(key);
      } catch {
        useRedis = false;
      }
    }
    const expiry = memoryExpiry.get(key);
    if (!expiry) return -1;
    const remaining = Math.ceil((expiry - Date.now()) / 1000);
    return remaining > 0 ? remaining : -2;
  },

  async sadd(key, ...members) {
    if (useRedis && redisClient) {
      try {
        return await redisClient.sadd(key, ...members);
      } catch {
        useRedis = false;
      }
    }
    let set = memoryStore.get(key);
    if (!(set instanceof Set)) {
      set = new Set();
      memoryStore.set(key, set);
    }
    let added = 0;
    for (const m of members) {
      if (!set.has(m)) { set.add(m); added++; }
    }
    return added;
  },

  async sismember(key, member) {
    if (useRedis && redisClient) {
      try {
        return await redisClient.sismember(key, member);
      } catch {
        useRedis = false;
      }
    }
    const set = memoryStore.get(key);
    return set instanceof Set ? (set.has(member) ? 1 : 0) : 0;
  },

  async scard(key) {
    if (useRedis && redisClient) {
      try {
        return await redisClient.scard(key);
      } catch {
        useRedis = false;
      }
    }
    const set = memoryStore.get(key);
    return set instanceof Set ? set.size : 0;
  },

  async keys(pattern) {
    if (useRedis && redisClient) {
      try {
        return await redisClient.keys(pattern);
      } catch {
        useRedis = false;
      }
    }
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return [...memoryStore.keys()].filter(k => regex.test(k));
  },

  isRedisActive() {
    return useRedis;
  }
};

export { initRedis, cache };
export default cache;

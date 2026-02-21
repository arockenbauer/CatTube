import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { dirname } from 'path';
import config from '../config.js';
import logger from '../utils/logger.js';

mkdirSync(dirname(config.dbPath), { recursive: true });

const db = new Database(config.dbPath, {
  verbose: process.env.NODE_ENV === 'development' ? (msg) => logger.debug(msg) : null
});

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

export default db;

import bcrypt from 'bcryptjs';
import db from './models/database.js';
import './migrate.js';
import logger from './utils/logger.js';

async function seed() {
  logger.info('Seeding database...');

  const existingAdmin = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
  if (existingAdmin) {
    logger.info('Database already seeded');
    return;
  }

  const adminHash = await bcrypt.hash('admin123', 12);
  const creatorHash = await bcrypt.hash('creator123', 12);
  const userHash = await bcrypt.hash('user123', 12);
  const premiumHash = await bcrypt.hash('premium123', 12);

  db.prepare(`
    INSERT INTO users (username, email, password_hash, display_name, level, email_verified, bio)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run('admin', 'admin@catube.local', adminHash, 'CatTube Admin', 3, 1, 'The supreme cat overlord');

  db.prepare(`
    INSERT INTO users (username, email, password_hash, display_name, level, email_verified, bio)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run('creator', 'creator@catube.local', creatorHash, 'Cat Creator', 1, 1, 'I make cat videos!');

  db.prepare(`
    INSERT INTO users (username, email, password_hash, display_name, level, email_verified, bio)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run('viewer', 'viewer@catube.local', userHash, 'Cat Viewer', 0, 1, 'I watch cat videos all day');

  db.prepare(`
    INSERT INTO users (username, email, password_hash, display_name, level, email_verified, bio)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run('premium', 'premium@catube.local', premiumHash, 'Premium Cat', 2, 1, 'Premium purrchaser');

  logger.info('Seed complete! Users created:');
  logger.info('  admin / admin123 (Admin)');
  logger.info('  creator / creator123 (Creator)');
  logger.info('  viewer / user123 (Basic)');
  logger.info('  premium / premium123 (Premium)');
}

seed().catch(err => {
  logger.error('Seed error:', err);
  process.exit(1);
});

# 🐱 CatTube - YouTube Clone Platform

A production-ready, fully functional YouTube clone built with Node.js, Express, React, and SQLite. Features video uploads, transcoding, shorts, recommendations, admin panel, and anti-spam protection.

## ✨ Features

### Core Platform
- 🎬 **Video Uploads** - Upload videos up to 5GB with automatic transcoding
- ⚡ **Smart Transcoding** - Detects source resolution and encodes up to 4K (parallel processing)
- 🎞️ **Shorts** - Auto-detection of videos under 60 seconds
- 🎯 **Recommendations** - Hybrid algorithm with engagement, tags, watch history
- 🔍 **Full-Text Search** - Search by title, description, tags, creator
- 📊 **Creator Studio** - Analytics, stats, video management
- 🛡️ **Admin Panel** - User management, bans, video deletion, moderation
- 🔐 **RBAC** - 4-tier permission system (Basic/Creator/Premium/Admin)

### Video Player
- 🎚️ Multi-quality streaming (360p → 4K)
- ⏱️ Playback speed control (0.25x → 2x)
- 🎭 Theater mode & mini player
- 📥 Premium download (Premium users)
- 🖱️ Keyboard shortcuts (space, arrows, f, m, t)

### User Features
- 👤 Account management with JWT auth
- 🔗 Subscriptions & notifications
- 👍 Likes, dislikes, comments & replies
- 📜 Watch history
- 🎬 Channel pages with subscriber counts
- 👤 User profiles with avatar & banner

### Security & Anti-Spam
- 🚫 Rate limiting (IP-based)
- 👁️ View cooldown (5 min per user)
- 🔍 Fingerprint detection (multi-account)
- 📈 Spike detection (100 views in 10 min)
- 🚫 Shadow ban system
- ✅ Input sanitization (XSS protection)
- 🛡️ Helmet security headers
- 🔏 CORS & CSRF protection

## 🛠️ Tech Stack

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: SQLite3 (WAL mode)
- **Cache/Queue**: Redis (fallback: in-memory)
- **Job Queue**: BullMQ (fallback: in-memory)
- **Video Processing**: FFmpeg
- **Auth**: JWT (access + refresh tokens)
- **Hashing**: bcryptjs
- **Validation**: Zod
- **Logging**: Winston
- **Real-time**: Socket.io

### Frontend
- **Framework**: React 18 + Vite
- **Styling**: Tailwind CSS
- **State**: Zustand
- **HTTP**: Axios
- **Icons**: react-icons
- **Routing**: React Router v6

### Infrastructure
- **Containerization**: Docker & Docker Compose
- **Reverse Proxy**: Nginx
- **File Storage**: Local filesystem (S3-compatible abstraction)

## 📦 Installation

### Prerequisites
- Node.js 18+
- FFmpeg
- Docker (optional, for containerized setup)

### Quick Start

1. **Clone & Install**
```bash
cd catube
npm install
cd client && npm install && cd ..
```

2. **Database & Migrations**
```bash
cd server
npm run migrate
cd ..
```

3. **Start Development**
```bash
# Terminal 1 - Backend (port 4000)
cd server && npm run dev

# Terminal 2 - Frontend (port 3000)
cd client && npm run dev
```

Visit `http://localhost:3000`

### Docker Setup

```bash
docker-compose up -d
```

Containers:
- **web** (Node.js): http://localhost:4000
- **client** (Vite): http://localhost:3000
- **redis**: localhost:6379 (optional, service continues if unavailable)

## 📁 Project Structure

```
catube/
├── server/
│   ├── app.js                  # Express app & server setup
│   ├── config.js               # Configuration
│   ├── package.json
│   ├── migrate.js              # Database migrations
│   ├── seed.js                 # Sample data
│   ├── admins.txt              # Admin promotion file (one username per line)
│   ├── controllers/            # Request handlers
│   ├── routes/                 # API routes
│   ├── middlewares/            # Auth, validation, anti-spam
│   ├── models/                 # Database schema
│   ├── services/               # Business logic
│   ├── workers/                # Background job handlers
│   ├── video-processing/       # FFmpeg transcoding
│   ├── algorithms/             # Recommendation engine
│   ├── utils/                  # Helpers, cache, queue, logger
│   ├── admin/                  # Admin utilities
│   └── uploads/                # Video storage
└── client/
    ├── src/
    │   ├── App.jsx
    │   ├── pages/              # Page components
    │   ├── components/         # Reusable components
    │   ├── layouts/            # Layout wrappers
    │   ├── store/              # Zustand stores
    │   ├── services/           # API & Socket services
    │   ├── hooks/              # Custom React hooks
    │   └── styles/             # CSS
    ├── index.html
    ├── package.json
    └── vite.config.js
```

## 🚀 Configuration

### Environment Variables (Backend)

Create `.env` in `/server`:
```env
NODE_ENV=production
PORT=4000
BASE_URL=http://localhost:3000
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret
REDIS_URL=redis://localhost:6379
FFMPEG_PATH=/usr/bin/ffmpeg
FFPROBE_PATH=/usr/bin/ffprobe
CORS_ORIGIN=http://localhost:3000
```

### Admin Management

Add usernames to `/server/admins.txt` (one per line):
```
username1
username2
```

On startup, the server promotes these users to Admin level (3) and removes processed lines.

## 📊 Database Schema

### Core Tables
- **users** - Accounts, levels (0-3), ban status
- **videos** - Metadata, status, visibility
- **video_files** - Encoded versions (360p-4K)
- **likes/dislikes** - Engagement tracking
- **subscriptions** - Follow relationships
- **views** - Watch analytics & anti-fraud
- **comments** - Threaded comments
- **watch_history** - User watch records
- **notifications** - User notifications
- **admin_logs** - Moderation actions
- **reports** - Content reports

## 🎥 Video Upload Workflow

1. User uploads video → Stored in temp directory
2. Video added to processing queue
3. **Parallel Processing**:
   - FFprobe detects source resolution
   - Transcodes to applicable resolutions (≤ source height)
   - Generates thumbnail at 25% mark
   - Thumbnail: scaled to 1280×720
4. Files stored as `/uploads/{uuid}/{resolution}.mp4`
5. Video marked as "published"
6. Notification sent to creator

### Resolutions & Bitrates
| Resolution | Bitrate |
|------------|---------|
| 360p       | 800k    |
| 480p       | 1.5M    |
| 720p       | 2.5M    |
| 1080p      | 5M      |
| 1440p      | 10M     |
| 2160p (4K) | 20M     |

## 🤖 Recommendation Algorithm

Score = (interest weight × tags similarity) + (watch history) + (watch duration %) + (recent popularity) + (engagement rate) - (spam penalty)

Uses Redis caching for performance. Falls back to in-memory cache if Redis unavailable.

## 🛡️ Anti-Spam System

### View Protection
- **Cooldown**: 5 minutes between view counts (per user/IP)
- **Fingerprinting**: Browser fingerprint detection
- **Spike Detection**: Max 100 views in 10-minute window
- **Shadow Ban**: Automatic ban for suspicious patterns

### Action Limiting
- Max 30 actions/minute per IP
- Max 20 uploads/day per user
- Rate-limited endpoints

## 🔐 Security Features

- ✅ **Helmet** - HTTP security headers
- ✅ **CORS** - Configured origin whitelist
- ✅ **Input Sanitization** - XSS protection via xss library
- ✅ **HPP** - HTTP Parameter Pollution protection
- ✅ **JWT Refresh** - Auto-refresh with interceptor queue
- ✅ **Password Hashing** - bcryptjs (10 rounds)
- ✅ **Logging** - Winston logs all errors

## 📱 Pages

### Public
- **Home** - Feed with recommendations
- **Trending** - Trending videos
- **Shorts** - Vertical scroll shorts
- **Search** - Full-text search with filters
- **Watch** - Video player with comments
- **Channel** - Creator profile & videos
- **Login/Register** - Auth pages

### Authenticated
- **Upload** - Video upload with status tracking
- **Notifications** - User notifications
- **History** - Watch history
- **Subscriptions** - Subscribed channels

### Creator (Level 1+)
- **Studio** - Analytics & video management

### Premium (Level 2+)
- **Download** - Premium video download

### Admin (Level 3)
- **Admin Panel** - User management, moderation

## 🎮 Keyboard Shortcuts (Video Player)

| Key | Action |
|-----|--------|
| `Space` / `K` | Play/Pause |
| `←` | Rewind 10s |
| `→` | Forward 10s |
| `F` | Fullscreen |
| `M` | Mute |
| `T` | Theater mode |

## 🔄 Redis & Queue Fallback

**Service**: Redis connects to `localhost:6379` by default.

**If Redis unavailable**:
- 💾 Cache → In-memory Map
- 📦 Queue → In-memory processor
- No data loss, full functionality maintained

The system **attempts once** at startup. If failed, logs warning and continues.

## 🐳 Docker Commands

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f web

# Stop services
docker-compose down

# Rebuild images
docker-compose up -d --build
```

## 🚗 Scripts

### Backend
```bash
npm start          # Production server
npm run dev        # Watch mode
npm run migrate    # Run migrations
npm run seed       # Seed sample data
```

### Frontend
```bash
npm run dev        # Dev server
npm run build      # Production build
npm run preview    # Preview build
```

## 📊 Admin Actions

### User Management
- View all users
- Change user level (0-3)
- Ban/Unban users
- Shadow ban accounts

### Content Moderation
- View all videos
- Delete videos
- View reports
- Mark reports as resolved

### Logs
- View admin actions log
- Filter by action type
- Track moderation history

## 🐛 Troubleshooting

### FFmpeg not found
```bash
# macOS
brew install ffmpeg

# Ubuntu
sudo apt-get install ffmpeg

# Set in .env
FFMPEG_PATH=/usr/local/bin/ffmpeg
FFPROBE_PATH=/usr/local/bin/ffprobe
```

### Database locked
SQLite uses WAL mode for concurrent access. If locked:
```bash
rm server/data/catube.db-wal server/data/catube.db-shm
npm run migrate
```

### Redis connection spam
This is **expected** if Redis is not running. The app falls back gracefully with in-memory cache.

### Large video uploads timeout
Timeout is set to **unlimited** (0). Ensure client has enough bandwidth.

## 📈 Performance

- **Parallel video encoding** - Multiple resolutions simultaneously
- **Redis caching** - Recommendation scoring, view cooldown
- **Database indexes** - On critical columns (user, video, status, etc.)
- **SQLite WAL mode** - Better concurrent read performance
- **Socket.io** - Real-time viewer count updates
- **Lazy loading** - Comments, watch history pagination

## 🎯 Future Enhancements

- [ ] Livestream support
- [ ] Video chapters & timestamps
- [ ] Community posts
- [ ] Stories feature
- [ ] Playlist management
- [ ] Advanced analytics
- [ ] Multi-language subtitles
- [ ] CDN integration
- [ ] S3/CloudStorage integration
- [ ] Monetization features
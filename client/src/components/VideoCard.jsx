import { Link } from 'react-router-dom';
import { formatViews, formatDuration, formatTimeAgo } from '../hooks/useApi.js';

export default function VideoCard({ video, horizontal = false }) {
  if (!video) return null;

  if (horizontal) {
    return (
      <Link to={`/watch/${video.uuid}`} className="flex gap-3 group">
        <div className="relative w-40 flex-shrink-0 aspect-video rounded-lg overflow-hidden bg-cat-card">
          {video.thumbnailUrl ? (
            <img src={video.thumbnailUrl} alt={video.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-2xl">🐱</div>
          )}
          <span className="absolute bottom-1 right-1 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded">
            {formatDuration(video.duration)}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm line-clamp-2 group-hover:text-cat-accent">{video.title}</h3>
          {video.channel && (
            <p className="text-xs text-cat-textSecondary mt-1">{video.channel.displayName}</p>
          )}
          <p className="text-xs text-cat-textSecondary">
            {formatViews(video.viewCount)} · {formatTimeAgo(video.publishedAt || video.createdAt)}
          </p>
        </div>
      </Link>
    );
  }

  return (
    <Link to={`/watch/${video.uuid}`} className="group">
      <div className="relative aspect-video rounded-xl overflow-hidden bg-cat-card mb-3">
        {video.thumbnailUrl ? (
          <img src={video.thumbnailUrl} alt={video.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl bg-cat-card">🐱</div>
        )}
        <span className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded font-medium">
          {formatDuration(video.duration)}
        </span>
        {video.isShort && (
          <span className="absolute top-2 left-2 bg-cat-accent text-white text-xs px-2 py-0.5 rounded-full font-medium">
            Short
          </span>
        )}
      </div>
      <div className="flex gap-3">
        {video.channel && (
          <div className="w-9 h-9 rounded-full bg-cat-accent flex items-center justify-center text-sm font-bold flex-shrink-0 overflow-hidden">
            {video.channel.avatarUrl && video.channel.avatarUrl !== '/default-avatar.png' ? (
              <img src={video.channel.avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              video.channel.displayName?.[0]?.toUpperCase() || '?'
            )}
          </div>
        )}
        <div className="min-w-0">
          <h3 className="font-semibold text-sm line-clamp-2 group-hover:text-cat-accent transition-colors">{video.title}</h3>
          {video.channel && (
            <p className="text-xs text-cat-textSecondary mt-1 hover:text-cat-text">{video.channel.displayName}</p>
          )}
          <p className="text-xs text-cat-textSecondary">
            {formatViews(video.viewCount)} · {formatTimeAgo(video.publishedAt || video.createdAt)}
          </p>
        </div>
      </div>
    </Link>
  );
}

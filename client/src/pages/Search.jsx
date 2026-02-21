import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../services/api.js';
import VideoCard from '../components/VideoCard.jsx';
import { formatViews, formatTimeAgo, formatDuration } from '../hooks/useApi.js';

export default function Search() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const [videos, setVideos] = useState([]);
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sort, setSort] = useState('relevance');
  const [type, setType] = useState('');
  const [duration, setDuration] = useState('');

  useEffect(() => {
    if (!query) return;
    setLoading(true);
    const params = new URLSearchParams({ q: query, sort });
    if (type) params.set('type', type);
    if (duration) params.set('duration', duration);

    api.get(`/search?${params}`)
      .then(({ data }) => {
        setVideos(data.videos || []);
        setChannels(data.channels || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [query, sort, type, duration]);

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-lg font-semibold mb-4">
        {query ? `Results for "${query}"` : 'Search CatTube'}
      </h2>

      <div className="flex gap-2 mb-6 flex-wrap">
        {[{ label: 'Relevance', value: 'relevance' }, { label: 'Date', value: 'date' },
          { label: 'Views', value: 'views' }, { label: 'Duration', value: 'duration' }].map(s => (
          <button key={s.value} onClick={() => setSort(s.value)}
            className={`px-3 py-1 rounded-full text-sm ${sort === s.value ? 'bg-white text-black' : 'bg-cat-card hover:bg-cat-hover'}`}>
            {s.label}
          </button>
        ))}
        <span className="w-px bg-cat-border" />
        {[{ label: 'All', value: '' }, { label: 'Videos', value: 'video' },
          { label: 'Shorts', value: 'short' }, { label: 'Channels', value: 'channel' }].map(t => (
          <button key={t.value} onClick={() => setType(t.value)}
            className={`px-3 py-1 rounded-full text-sm ${type === t.value ? 'bg-white text-black' : 'bg-cat-card hover:bg-cat-hover'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex gap-4 animate-pulse">
              <div className="w-64 aspect-video bg-cat-card rounded-lg flex-shrink-0" />
              <div className="flex-1">
                <div className="h-5 bg-cat-card rounded w-3/4 mb-2" />
                <div className="h-4 bg-cat-card rounded w-1/2 mb-2" />
                <div className="h-3 bg-cat-card rounded w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {channels.length > 0 && (
            <div className="mb-6">
              {channels.map(c => (
                <Link key={c.id} to={`/channel/${c.username}`} className="flex items-center gap-4 p-3 hover:bg-cat-card rounded-lg">
                  <div className="w-16 h-16 rounded-full bg-cat-accent flex items-center justify-center text-xl font-bold">
                    {c.displayName?.[0]?.toUpperCase()}
                  </div>
                  <div>
                    <div className="font-semibold">{c.displayName}</div>
                    <div className="text-sm text-cat-textSecondary">@{c.username} · {c.subscriberCount} subscribers · {c.videoCount} videos</div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {videos.length === 0 && channels.length === 0 ? (
            <div className="text-center py-20 text-cat-textSecondary">
              <div className="text-6xl mb-4">🔍</div>
              <p className="text-lg">No results found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {videos.map(v => (
                <Link key={v.uuid} to={`/watch/${v.uuid}`} className="flex gap-4 group">
                  <div className="relative w-64 flex-shrink-0 aspect-video rounded-lg overflow-hidden bg-cat-card">
                    {v.thumbnailUrl ? (
                      <img src={v.thumbnailUrl} alt={v.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-3xl">🐱</div>
                    )}
                    <span className="absolute bottom-1 right-1 bg-black/80 text-xs px-1.5 py-0.5 rounded">{formatDuration(v.duration)}</span>
                  </div>
                  <div className="flex-1 min-w-0 py-1">
                    <h3 className="font-semibold line-clamp-2 group-hover:text-cat-accent">{v.title}</h3>
                    <p className="text-sm text-cat-textSecondary mt-1">
                      {formatViews(v.viewCount)} · {formatTimeAgo(v.publishedAt)}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="w-6 h-6 rounded-full bg-cat-card flex items-center justify-center text-xs font-bold">
                        {v.channel?.displayName?.[0]?.toUpperCase()}
                      </div>
                      <span className="text-sm text-cat-textSecondary">{v.channel?.displayName}</span>
                    </div>
                    <p className="text-sm text-cat-textSecondary mt-2 line-clamp-1">{v.description}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

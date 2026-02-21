import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api.js';
import useAuthStore from '../store/authStore.js';
import { formatDuration, formatTimeAgo } from '../hooks/useApi.js';

export default function History() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) { navigate('/login'); return; }
    api.get('/notifications/history?limit=50')
      .then(({ data }) => setHistory(data.history || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isAuthenticated, navigate]);

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Watch History</h1>
      {loading ? (
        <div className="flex justify-center py-20"><div className="text-4xl animate-bounce">🐱</div></div>
      ) : history.length === 0 ? (
        <div className="text-center py-20 text-cat-textSecondary">
          <div className="text-6xl mb-4">📺</div>
          <p>No watch history</p>
        </div>
      ) : (
        <div className="space-y-3">
          {history.map(h => (
            <Link key={h.id} to={`/watch/${h.video.uuid}`} className="flex gap-4 group hover:bg-cat-card/50 p-2 rounded-lg">
              <div className="relative w-48 flex-shrink-0 aspect-video rounded-lg overflow-hidden bg-cat-card">
                {h.video.thumbnailUrl ? (
                  <img src={h.video.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl">🐱</div>
                )}
                <span className="absolute bottom-1 right-1 bg-black/80 text-xs px-1 py-0.5 rounded">{formatDuration(h.video.duration)}</span>
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                  <div className="h-full bg-cat-accent" style={{ width: `${h.watchPercent}%` }} />
                </div>
              </div>
              <div className="flex-1 py-1">
                <h3 className="font-semibold group-hover:text-cat-accent line-clamp-2">{h.video.title}</h3>
                <p className="text-sm text-cat-textSecondary mt-1">{h.video.channel?.displayName}</p>
                <p className="text-xs text-cat-textSecondary mt-1">Watched {formatTimeAgo(h.watchedAt)}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

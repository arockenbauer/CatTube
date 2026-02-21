import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api.js';
import VideoCard from '../components/VideoCard.jsx';
import useAuthStore from '../store/authStore.js';
import { formatNumber } from '../hooks/useApi.js';

export default function Subscriptions() {
  const [feed, setFeed] = useState([]);
  const [channels, setChannels] = useState([]);
  const [tab, setTab] = useState('feed');
  const [loading, setLoading] = useState(true);
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) { navigate('/login'); return; }
    Promise.all([
      api.get('/channels/feed?limit=30'),
      api.get('/channels/subscriptions')
    ]).then(([feedRes, subRes]) => {
      setFeed(feedRes.data.videos || []);
      setChannels(subRes.data.subscriptions || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [isAuthenticated, navigate]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Subscriptions</h1>

      <div className="flex gap-4 border-b border-cat-border mb-6">
        {['feed', 'channels'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-3 text-sm font-semibold capitalize border-b-2 ${
              tab === t ? 'border-cat-accent text-cat-accent' : 'border-transparent text-cat-textSecondary hover:text-white'
            }`}>
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="text-4xl animate-bounce">🐱</div></div>
      ) : tab === 'feed' ? (
        feed.length === 0 ? (
          <div className="text-center py-20 text-cat-textSecondary">
            <div className="text-6xl mb-4">📺</div>
            <p>Subscribe to channels to see their videos here</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {feed.map(v => <VideoCard key={v.uuid} video={v} />)}
          </div>
        )
      ) : (
        channels.length === 0 ? (
          <div className="text-center py-20 text-cat-textSecondary">
            <div className="text-6xl mb-4">👀</div>
            <p>You haven't subscribed to any channels yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {channels.map(c => (
              <Link key={c.id} to={`/channel/${c.username}`} className="card p-4 flex items-center gap-4 hover:bg-cat-hover transition-colors">
                <div className="w-14 h-14 rounded-full bg-cat-accent flex items-center justify-center text-xl font-bold flex-shrink-0">
                  {c.avatarUrl && c.avatarUrl !== '/default-avatar.png' ? (
                    <img src={c.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
                  ) : (
                    c.displayName?.[0]?.toUpperCase()
                  )}
                </div>
                <div>
                  <div className="font-semibold">{c.displayName}</div>
                  <div className="text-sm text-cat-textSecondary">{formatNumber(c.subscriberCount)} subscribers</div>
                </div>
              </Link>
            ))}
          </div>
        )
      )}
    </div>
  );
}

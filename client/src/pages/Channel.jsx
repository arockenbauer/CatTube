import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api.js';
import VideoCard from '../components/VideoCard.jsx';
import useAuthStore from '../store/authStore.js';
import { formatNumber } from '../hooks/useApi.js';

export default function Channel() {
  const { username } = useParams();
  const [channel, setChannel] = useState(null);
  const [videos, setVideos] = useState([]);
  const [tab, setTab] = useState('videos');
  const [loading, setLoading] = useState(true);
  const { user, isAuthenticated } = useAuthStore();

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get(`/channels/${username}`),
      api.get(`/channels/${username}/videos?type=${tab === 'shorts' ? 'shorts' : 'videos'}&limit=30`)
    ]).then(([chRes, vidRes]) => {
      setChannel(chRes.data.channel);
      setVideos(vidRes.data.videos || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [username, tab]);

  const handleSubscribe = async () => {
    if (!isAuthenticated) return;
    try {
      const { data } = await api.post(`/channels/${username}/subscribe`);
      setChannel(c => ({
        ...c,
        isSubscribed: data.subscribed,
        subscriberCount: data.subscribed ? c.subscriberCount + 1 : c.subscriberCount - 1
      }));
    } catch {}
  };

  if (loading) {
    return <div className="flex justify-center py-20"><div className="text-4xl animate-bounce">🐱</div></div>;
  }

  if (!channel) {
    return <div className="text-center py-20"><div className="text-6xl mb-4">😿</div><p>Channel not found</p></div>;
  }

  return (
    <div>
      <div className="relative h-40 bg-gradient-to-r from-cat-accent/30 to-purple-600/30 rounded-xl mb-4 overflow-hidden">
        {channel.bannerUrl && <img src={channel.bannerUrl} alt="" className="w-full h-full object-cover" />}
      </div>

      <div className="flex items-start gap-6 mb-6 px-2">
        <div className="w-20 h-20 rounded-full bg-cat-accent flex items-center justify-center text-3xl font-bold flex-shrink-0 -mt-10 border-4 border-cat-dark overflow-hidden">
          {channel.avatarUrl && channel.avatarUrl !== '/default-avatar.png' ? (
            <img src={channel.avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            channel.displayName?.[0]?.toUpperCase()
          )}
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{channel.displayName}</h1>
          <p className="text-sm text-cat-textSecondary">
            @{channel.username} · {formatNumber(channel.subscriberCount)} subscribers · {channel.videoCount} videos
          </p>
          {channel.bio && <p className="text-sm text-cat-textSecondary mt-1">{channel.bio}</p>}
        </div>
        {isAuthenticated && user?.id !== channel.id && (
          <button onClick={handleSubscribe}
            className={`px-6 py-2 rounded-full font-semibold ${
              channel.isSubscribed ? 'bg-cat-card hover:bg-cat-hover' : 'bg-white text-black hover:bg-gray-200'
            }`}>
            {channel.isSubscribed ? 'Subscribed' : 'Subscribe'}
          </button>
        )}
      </div>

      <div className="flex gap-4 border-b border-cat-border mb-6">
        {['videos', 'shorts'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-3 text-sm font-semibold capitalize border-b-2 ${
              tab === t ? 'border-cat-accent text-cat-accent' : 'border-transparent text-cat-textSecondary hover:text-white'
            }`}>
            {t}
          </button>
        ))}
      </div>

      {videos.length === 0 ? (
        <div className="text-center py-20 text-cat-textSecondary">
          <div className="text-6xl mb-4">📹</div>
          <p>No {tab} yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {videos.map(v => <VideoCard key={v.uuid} video={v} />)}
        </div>
      )}
    </div>
  );
}

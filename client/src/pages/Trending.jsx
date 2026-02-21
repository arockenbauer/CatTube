import { useState, useEffect } from 'react';
import api from '../services/api.js';
import VideoCard from '../components/VideoCard.jsx';

export default function Trending() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/videos/trending?limit=50')
      .then(({ data }) => setVideos(data.videos || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">🔥 Trending</h1>
      {loading ? (
        <div className="flex justify-center py-20"><div className="text-4xl animate-bounce">🐱</div></div>
      ) : videos.length === 0 ? (
        <div className="text-center py-20 text-cat-textSecondary">
          <div className="text-6xl mb-4">📊</div>
          <p>Nothing trending yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {videos.map(v => <VideoCard key={v.uuid} video={v} />)}
        </div>
      )}
    </div>
  );
}

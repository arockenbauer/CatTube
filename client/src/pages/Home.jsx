import { useState, useEffect } from 'react';
import api from '../services/api.js';
import VideoCard from '../components/VideoCard.jsx';

const categories = ['All', 'Music', 'Gaming', 'Education', 'Entertainment', 'Sports', 'News', 'Tech', 'Cooking', 'Other'];

export default function Home() {
  const [videos, setVideos] = useState([]);
  const [recommended, setRecommended] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('All');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const params = category === 'All' ? '' : `&category=${category.toLowerCase()}`;
        const [videosRes, recoRes] = await Promise.all([
          api.get(`/videos?limit=24${params}`),
          api.get('/recommendations?limit=12')
        ]);
        setVideos(videosRes.data.videos || []);
        setRecommended(recoRes.data.videos || []);
      } catch {} finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [category]);

  return (
    <div>
      <div className="flex gap-2 overflow-x-auto pb-3 mb-6 scrollbar-none">
        {categories.map(cat => (
          <button key={cat} onClick={() => setCategory(cat)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              category === cat ? 'bg-white text-black' : 'bg-cat-card hover:bg-cat-hover text-cat-text'
            }`}>
            {cat}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-video bg-cat-card rounded-xl mb-3" />
              <div className="flex gap-3">
                <div className="w-9 h-9 rounded-full bg-cat-card flex-shrink-0" />
                <div className="flex-1">
                  <div className="h-4 bg-cat-card rounded mb-2 w-3/4" />
                  <div className="h-3 bg-cat-card rounded w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {recommended.length > 0 && category === 'All' && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold mb-4">Recommended for you</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {recommended.map(v => <VideoCard key={v.uuid} video={v} />)}
              </div>
            </div>
          )}

          <div>
            {category === 'All' && <h2 className="text-lg font-semibold mb-4">Latest Videos</h2>}
            {videos.length === 0 ? (
              <div className="text-center py-20 text-cat-textSecondary">
                <div className="text-6xl mb-4">😿</div>
                <p className="text-lg">No videos yet</p>
                <p className="text-sm mt-1">Be the first to upload!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {videos.map(v => <VideoCard key={v.uuid} video={v} />)}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiEye, FiThumbsUp, FiThumbsDown, FiUsers, FiClock, FiFilm, FiTrendingUp } from 'react-icons/fi';
import api from '../services/api.js';
import useAuthStore from '../store/authStore.js';
import { formatNumber, formatDuration, formatTimeAgo } from '../hooks/useApi.js';

export default function Studio() {
  const [dashboard, setDashboard] = useState(null);
  const [myVideos, setMyVideos] = useState([]);
  const [tab, setTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) { navigate('/login'); return; }
    Promise.all([
      api.get('/studio/dashboard'),
      api.get('/videos/my?limit=50')
    ]).then(([dashRes, vidRes]) => {
      setDashboard(dashRes.data);
      setMyVideos(vidRes.data.videos || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [isAuthenticated, navigate]);

  if (loading) {
    return <div className="flex justify-center py-20"><div className="text-4xl animate-bounce">🐱</div></div>;
  }

  const o = dashboard?.overview || {};

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Creator Studio</h1>
        <Link to="/upload" className="btn-primary">Upload Video</Link>
      </div>

      <div className="flex gap-4 border-b border-cat-border mb-6">
        {['overview', 'content', 'analytics'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-3 text-sm font-semibold capitalize border-b-2 ${
              tab === t ? 'border-cat-accent text-cat-accent' : 'border-transparent text-cat-textSecondary hover:text-white'
            }`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Total Views', value: formatNumber(o.totalViews), icon: FiEye, color: 'text-blue-400' },
              { label: 'Subscribers', value: formatNumber(o.subscribers), icon: FiUsers, color: 'text-green-400' },
              { label: 'Total Likes', value: formatNumber(o.totalLikes), icon: FiThumbsUp, color: 'text-cat-accent' },
              { label: 'Watch Time', value: `${formatNumber(o.totalWatchTimeMinutes)}m`, icon: FiClock, color: 'text-purple-400' },
              { label: 'Videos', value: o.totalVideos, icon: FiFilm, color: 'text-yellow-400' },
              { label: 'Avg Retention', value: `${o.avgRetentionPercent || 0}%`, icon: FiTrendingUp, color: 'text-pink-400' },
              { label: 'Recent Subs', value: formatNumber(o.recentSubscribers), icon: FiUsers, color: 'text-emerald-400' },
              { label: 'Dislikes', value: formatNumber(o.totalDislikes), icon: FiThumbsDown, color: 'text-red-400' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={color} size={18} />
                  <span className="text-sm text-cat-textSecondary">{label}</span>
                </div>
                <div className="text-2xl font-bold">{value}</div>
              </div>
            ))}
          </div>

          {dashboard?.charts && (
            <div className="card p-4 mb-6">
              <h3 className="font-semibold mb-3">Daily Views (Last 30 days)</h3>
              <div className="flex items-end gap-1 h-32">
                {(dashboard.charts.dailyViews || []).map((d, i) => {
                  const maxViews = Math.max(...(dashboard.charts.dailyViews || []).map(x => x.views), 1);
                  return (
                    <div key={i} className="flex-1 group relative">
                      <div
                        className="bg-cat-accent/70 hover:bg-cat-accent rounded-t transition-colors w-full"
                        style={{ height: `${(d.views / maxViews) * 100}%`, minHeight: '2px' }}
                      />
                      <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block bg-cat-card px-2 py-1 rounded text-xs whitespace-nowrap z-10">
                        {d.date}: {d.views} views
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'content' && (
        <div className="space-y-2">
          {myVideos.length === 0 ? (
            <div className="text-center py-20 text-cat-textSecondary">
              <div className="text-6xl mb-4">📹</div>
              <p>No videos yet</p>
              <Link to="/upload" className="btn-primary mt-4 inline-block">Upload your first video</Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-cat-border text-cat-textSecondary">
                    <th className="text-left p-3">Video</th>
                    <th className="text-left p-3">Status</th>
                    <th className="text-right p-3">Views</th>
                    <th className="text-right p-3">Likes</th>
                    <th className="text-right p-3">Comments</th>
                    <th className="text-right p-3">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {myVideos.map(v => (
                    <tr key={v.uuid} className="border-b border-cat-border/50 hover:bg-cat-hover/50">
                      <td className="p-3">
                        <Link to={`/watch/${v.uuid}`} className="flex items-center gap-3 hover:text-cat-accent">
                          <div className="w-24 aspect-video rounded bg-cat-card flex-shrink-0 overflow-hidden">
                            {v.thumbnailUrl ? <img src={v.thumbnailUrl} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center">🐱</div>}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate">{v.title}</p>
                            <p className="text-xs text-cat-textSecondary">{formatDuration(v.duration)} {v.isShort && '· Short'}</p>
                          </div>
                        </Link>
                      </td>
                      <td className="p-3">
                        <span className={`badge ${v.status === 'published' ? 'bg-green-900/50 text-green-400' : v.status === 'processing' ? 'bg-yellow-900/50 text-yellow-400' : 'bg-red-900/50 text-red-400'}`}>
                          {v.status}
                        </span>
                      </td>
                      <td className="p-3 text-right">{formatNumber(v.viewCount)}</td>
                      <td className="p-3 text-right">{formatNumber(v.likeCount)}</td>
                      <td className="p-3 text-right">{formatNumber(v.commentCount)}</td>
                      <td className="p-3 text-right text-cat-textSecondary">{formatTimeAgo(v.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'analytics' && (
        <div className="card p-6">
          <h3 className="font-semibold mb-4">Top Videos by CTR</h3>
          <div className="space-y-3">
            {(dashboard?.topVideos || []).map(v => (
              <div key={v.uuid} className="flex items-center gap-4 p-2 hover:bg-cat-hover rounded-lg">
                <div className="w-20 aspect-video rounded bg-cat-card overflow-hidden flex-shrink-0">
                  {v.thumbnailUrl ? <img src={v.thumbnailUrl} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-sm">🐱</div>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{v.title}</p>
                  <p className="text-xs text-cat-textSecondary">{formatNumber(v.viewCount)} views</p>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-cat-accent">{v.ctr}% CTR</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

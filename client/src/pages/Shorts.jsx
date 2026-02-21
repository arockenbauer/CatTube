import { useState, useEffect, useRef, useCallback } from 'react';
import { FiThumbsUp, FiThumbsDown, FiMessageSquare, FiShare2, FiX, FiCheck, FiMenu, FiHome, FiTrendingUp, FiFilm, FiClock, FiUsers, FiSettings, FiUpload } from 'react-icons/fi';
import { Link, NavLink } from 'react-router-dom';
import api from '../services/api.js';
import useAuthStore from '../store/authStore.js';
import { formatNumber, formatTimeAgo } from '../hooks/useApi.js';

const BASE_URL = window.location.origin;

const sidebarLinks = [
  { to: '/', icon: FiHome, label: 'Home' },
  { to: '/trending', icon: FiTrendingUp, label: 'Trending' },
  { to: '/shorts', icon: FiFilm, label: 'Shorts' },
  { to: '/subscriptions', icon: FiUsers, label: 'Subscriptions' },
  { to: '/history', icon: FiClock, label: 'History' },
  { to: '/upload', icon: FiUpload, label: 'Upload' },
];

function CommentsPanel({ uuid, onClose }) {
  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const { isAuthenticated, user } = useAuthStore();

  useEffect(() => {
    api.get(`/comments/video/${uuid}?limit=30`)
      .then(({ data }) => setComments(data.comments || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [uuid]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    try {
      const { data } = await api.post(`/comments/video/${uuid}`, { content: text.trim() });
      setComments(prev => [data.comment, ...prev]);
      setText('');
    } catch {}
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative w-full max-w-[420px] max-h-[60vh] bg-cat-darker rounded-t-2xl flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-cat-border">
          <h3 className="font-semibold">Comments</h3>
          <button onClick={onClose} className="p-1 hover:bg-cat-hover rounded-full"><FiX size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <div className="text-center py-8"><div className="text-3xl animate-bounce">🐱</div></div>
          ) : comments.length === 0 ? (
            <p className="text-center text-cat-textSecondary py-8">No comments yet</p>
          ) : comments.map(c => (
            <div key={c.id} className="flex gap-2">
              <div className="w-8 h-8 rounded-full bg-cat-card flex items-center justify-center text-xs font-bold flex-shrink-0">
                {c.author?.displayName?.[0]?.toUpperCase() || '?'}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold">{c.author?.displayName}</span>
                  <span className="text-xs text-cat-textSecondary">{formatTimeAgo(c.createdAt)}</span>
                </div>
                <p className="text-sm mt-0.5">{c.content}</p>
              </div>
            </div>
          ))}
        </div>
        {isAuthenticated && (
          <form onSubmit={handleSubmit} className="p-3 border-t border-cat-border flex gap-2">
            <input type="text" value={text} onChange={e => setText(e.target.value)}
              placeholder="Add a comment..." className="flex-1 bg-cat-card rounded-full px-4 py-2 text-sm" />
            <button type="submit" disabled={!text.trim()}
              className="bg-cat-accent text-white rounded-full px-4 py-2 text-sm disabled:opacity-50">Send</button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function Shorts() {
  const [shorts, setShorts] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showComments, setShowComments] = useState(null);
  const [shareToast, setShareToast] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const containerRef = useRef(null);
  const videoRefs = useRef({});
  const { isAuthenticated, user } = useAuthStore();

  useEffect(() => {
    api.get('/recommendations/shorts?limit=20')
      .then(({ data }) => { setShorts(data.videos || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    Object.entries(videoRefs.current).forEach(([idx, video]) => {
      if (video) {
        if (parseInt(idx) === currentIndex) {
          video.play().catch(() => {});
        } else {
          video.pause();
          video.currentTime = 0;
        }
      }
    });
  }, [currentIndex]);

  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const scrollTop = container.scrollTop;
    const itemHeight = container.clientHeight;
    const newIndex = Math.round(scrollTop / itemHeight);
    if (newIndex !== currentIndex && newIndex >= 0 && newIndex < shorts.length) {
      setCurrentIndex(newIndex);
    }
  }, [currentIndex, shorts.length]);

  const handleLike = async (short, idx) => {
    if (!isAuthenticated) return;
    try {
      const { data } = await api.post(`/videos/${short.uuid}/like`);
      setShorts(prev => prev.map((s, i) => i === idx ? {
        ...s,
        isLiked: data.liked,
        isDisliked: false,
        likeCount: data.liked ? s.likeCount + 1 : s.likeCount - 1
      } : s));
    } catch {}
  };

  const handleDislike = async (short, idx) => {
    if (!isAuthenticated) return;
    try {
      const { data } = await api.post(`/videos/${short.uuid}/dislike`);
      setShorts(prev => prev.map((s, i) => i === idx ? {
        ...s,
        isDisliked: data.disliked,
        isLiked: false,
        dislikeCount: data.disliked ? (s.dislikeCount || 0) + 1 : Math.max(0, (s.dislikeCount || 0) - 1)
      } : s));
    } catch {}
  };

  const handleShare = async (short) => {
    const url = `${BASE_URL}/watch/${short.uuid}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
    }
    setShareToast(true);
    setTimeout(() => setShareToast(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-cat-dark">
        <div className="text-4xl animate-bounce">🐱</div>
      </div>
    );
  }

  const linkClass = ({ isActive }) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
      isActive ? 'bg-cat-hover text-white font-semibold' : 'text-cat-textSecondary hover:bg-cat-hover hover:text-white'
    }`;

  return (
    <div className="fixed inset-0 bg-cat-dark z-40">
      {shareToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[70] bg-cat-card border border-cat-border px-4 py-2 rounded-lg shadow-xl flex items-center gap-2">
          <FiCheck className="text-green-400" /> Link copied!
        </div>
      )}

      <nav className="fixed top-0 left-0 right-0 h-14 bg-cat-darker border-b border-cat-border flex items-center px-4 z-50">
        <div className="flex items-center gap-4">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-cat-hover rounded-full">
            <FiMenu size={20} />
          </button>
          <Link to="/" className="flex items-center gap-2 text-xl font-bold">
            <span className="text-2xl">🐱</span>
            <span className="text-cat-accent">Cat</span>Tube
          </Link>
          <span className="text-sm bg-cat-card px-2 py-0.5 rounded-full">Shorts</span>
        </div>
      </nav>

      <aside className={`fixed left-0 top-14 bottom-0 bg-cat-darker border-r border-cat-border overflow-y-auto z-40 transition-all duration-300 ${
        sidebarOpen ? 'w-60' : 'w-16'
      }`}>
        <div className="py-2">
          {sidebarLinks.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} className={linkClass}>
              <Icon size={20} className="flex-shrink-0" />
              {sidebarOpen && <span className="truncate">{label}</span>}
            </NavLink>
          ))}
          {isAuthenticated && user?.level >= 3 && (
            <>
              <div className={`my-2 border-t border-cat-border ${sidebarOpen ? 'mx-3' : 'mx-2'}`} />
              <NavLink to="/admin" className={linkClass}>
                <FiSettings size={20} className="flex-shrink-0 text-red-400" />
                {sidebarOpen && <span className="truncate text-red-400">Admin</span>}
              </NavLink>
            </>
          )}
        </div>
      </aside>

      <div className={`h-full pt-14 transition-all duration-300 ${sidebarOpen ? 'ml-60' : 'ml-16'}`}>
        <div ref={containerRef} onScroll={handleScroll}
          className="h-full overflow-y-scroll snap-y snap-mandatory scrollbar-none">
          {shorts.map((short, idx) => (
            <div key={short.uuid} className="h-full snap-start flex items-center justify-center relative">
              <div className="relative h-full max-w-[400px] w-full mx-auto bg-black">
                <video
                  ref={el => videoRefs.current[idx] = el}
                  src={short.files?.[0]?.url || `/uploads/${short.uuid}/360p.mp4`}
                  loop
                  playsInline
                  muted={idx !== currentIndex}
                  className="h-full w-full object-contain"
                  onClick={(e) => {
                    if (e.target.paused) e.target.play().catch(() => {});
                    else e.target.pause();
                  }}
                />

                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                  <Link to={`/channel/${short.channel?.username}`} className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-full bg-cat-accent flex items-center justify-center text-xs font-bold">
                      {short.channel?.displayName?.[0]?.toUpperCase() || '?'}
                    </div>
                    <span className="text-sm font-semibold">{short.channel?.displayName}</span>
                  </Link>
                  <p className="text-sm">{short.title}</p>
                </div>

                <div className="absolute right-3 bottom-24 flex flex-col items-center gap-6">
                  <button onClick={() => handleLike(short, idx)} className="flex flex-col items-center gap-1">
                    <div className={`w-12 h-12 rounded-full bg-cat-card/80 flex items-center justify-center ${short.isLiked ? 'text-cat-accent' : ''}`}>
                      <FiThumbsUp size={22} />
                    </div>
                    <span className="text-xs">{formatNumber(short.likeCount)}</span>
                  </button>
                  <button onClick={() => handleDislike(short, idx)} className="flex flex-col items-center gap-1">
                    <div className={`w-12 h-12 rounded-full bg-cat-card/80 flex items-center justify-center ${short.isDisliked ? 'text-cat-accent' : ''}`}>
                      <FiThumbsDown size={22} />
                    </div>
                    <span className="text-xs">{short.isDisliked ? 'Disliked' : 'Dislike'}</span>
                  </button>
                  <button onClick={() => setShowComments(short.uuid)} className="flex flex-col items-center gap-1">
                    <div className="w-12 h-12 rounded-full bg-cat-card/80 flex items-center justify-center">
                      <FiMessageSquare size={22} />
                    </div>
                    <span className="text-xs">{formatNumber(short.commentCount) || 'Comment'}</span>
                  </button>
                  <button onClick={() => handleShare(short)} className="flex flex-col items-center gap-1">
                    <div className="w-12 h-12 rounded-full bg-cat-card/80 flex items-center justify-center">
                      <FiShare2 size={22} />
                    </div>
                    <span className="text-xs">Share</span>
                  </button>
                </div>
              </div>
            </div>
          ))}

          {shorts.length === 0 && (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="text-6xl mb-4">😿</div>
                <p className="text-lg">No shorts yet</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {showComments && (
        <CommentsPanel uuid={showComments} onClose={() => setShowComments(null)} />
      )}
    </div>
  );
}

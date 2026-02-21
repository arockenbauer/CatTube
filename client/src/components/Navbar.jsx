import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiMenu, FiSearch, FiBell, FiUpload, FiUser, FiLogOut, FiSettings, FiFilm } from 'react-icons/fi';
import useAuthStore from '../store/authStore.js';
import useUIStore from '../store/uiStore.js';
import api from '../services/api.js';

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const toggleSidebar = useUIStore(s => s.toggleSidebar);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [notifCount, setNotifCount] = useState(0);
  const navigate = useNavigate();
  const searchRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (isAuthenticated) {
      api.get('/notifications?limit=1').then(({ data }) => setNotifCount(data.unreadCount || 0)).catch(() => {});
    }
  }, [isAuthenticated]);

  useEffect(() => {
    const handleClick = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) setShowSuggestions(false);
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
      setShowSuggestions(false);
    }
  };

  const fetchSuggestions = async (q) => {
    if (q.length < 2) { setSuggestions([]); return; }
    try {
      const { data } = await api.get(`/search/suggestions?q=${encodeURIComponent(q)}`);
      setSuggestions(data.suggestions || []);
    } catch { setSuggestions([]); }
  };

  return (
    <nav className="fixed top-0 left-0 right-0 h-14 bg-cat-darker border-b border-cat-border flex items-center px-4 z-50">
      <div className="flex items-center gap-4 flex-shrink-0">
        <button onClick={toggleSidebar} className="p-2 hover:bg-cat-hover rounded-full">
          <FiMenu size={20} />
        </button>
        <Link to="/" className="flex items-center gap-2 text-xl font-bold">
          <span className="text-2xl">🐱</span>
          <span className="text-cat-accent">Cat</span>
          <span>Tube</span>
        </Link>
      </div>

      <form onSubmit={handleSearch} className="flex-1 max-w-2xl mx-auto px-4" ref={searchRef}>
        <div className="relative">
          <div className="flex">
            <input
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); fetchSuggestions(e.target.value); }}
              onFocus={() => setShowSuggestions(true)}
              placeholder="Search CatTube..."
              className="w-full bg-cat-dark border border-cat-border rounded-l-full px-4 py-1.5 focus:border-cat-accent"
            />
            <button type="submit" className="bg-cat-card border border-l-0 border-cat-border rounded-r-full px-5 hover:bg-cat-hover">
              <FiSearch size={18} />
            </button>
          </div>
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-cat-card border border-cat-border rounded-lg shadow-xl z-50 overflow-hidden">
              {suggestions.map((s, i) => (
                <button key={i} onClick={() => { setQuery(s); navigate(`/search?q=${encodeURIComponent(s)}`); setShowSuggestions(false); }}
                  className="w-full text-left px-4 py-2 hover:bg-cat-hover flex items-center gap-2">
                  <FiSearch size={14} className="text-cat-textSecondary" />
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </form>

      <div className="flex items-center gap-2 flex-shrink-0">
        {isAuthenticated ? (
          <>
            <Link to="/upload" className="p-2 hover:bg-cat-hover rounded-full" title="Upload">
              <FiUpload size={20} />
            </Link>
            <Link to="/notifications" className="p-2 hover:bg-cat-hover rounded-full relative" title="Notifications">
              <FiBell size={20} />
              {notifCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-cat-accent text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {notifCount > 9 ? '9+' : notifCount}
                </span>
              )}
            </Link>
            <div className="relative" ref={menuRef}>
              <button onClick={() => setShowMenu(!showMenu)} className="w-8 h-8 rounded-full bg-cat-accent flex items-center justify-center text-sm font-bold overflow-hidden">
                {user?.avatarUrl && user.avatarUrl !== '/default-avatar.png' ? (
                  <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  user?.displayName?.[0]?.toUpperCase() || '?'
                )}
              </button>
              {showMenu && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-cat-card border border-cat-border rounded-lg shadow-xl z-50 overflow-hidden">
                  <div className="p-4 border-b border-cat-border">
                    <div className="font-semibold">{user?.displayName}</div>
                    <div className="text-sm text-cat-textSecondary">@{user?.username}</div>
                    <div className="mt-1">
                      {user?.level === 3 && <span className="badge-admin">Admin</span>}
                      {user?.level === 2 && <span className="badge-premium">Premium</span>}
                      {user?.level === 1 && <span className="badge-creator">Creator</span>}
                    </div>
                  </div>
                  <Link to={`/channel/${user?.username}`} onClick={() => setShowMenu(false)} className="flex items-center gap-3 px-4 py-3 hover:bg-cat-hover">
                    <FiUser size={18} /> Your Channel
                  </Link>
                  <Link to="/studio" onClick={() => setShowMenu(false)} className="flex items-center gap-3 px-4 py-3 hover:bg-cat-hover">
                    <FiFilm size={18} /> Creator Studio
                  </Link>
                  {user?.level >= 3 && (
                    <Link to="/admin" onClick={() => setShowMenu(false)} className="flex items-center gap-3 px-4 py-3 hover:bg-cat-hover text-red-400">
                      <FiSettings size={18} /> Admin Panel
                    </Link>
                  )}
                  <button onClick={() => { logout(); setShowMenu(false); }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-cat-hover text-cat-danger">
                    <FiLogOut size={18} /> Log Out
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <Link to="/login" className="btn-primary flex items-center gap-2 text-sm">
            <FiUser size={16} /> Sign In
          </Link>
        )}
      </div>
    </nav>
  );
}

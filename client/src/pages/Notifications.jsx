import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiBell, FiCheck } from 'react-icons/fi';
import api from '../services/api.js';
import useAuthStore from '../store/authStore.js';
import { formatTimeAgo } from '../hooks/useApi.js';

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) { navigate('/login'); return; }
    api.get('/notifications?limit=50')
      .then(({ data }) => setNotifications(data.notifications || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isAuthenticated, navigate]);

  const markAllRead = async () => {
    await api.put('/notifications/all/read').catch(() => {});
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const markRead = async (id) => {
    await api.put(`/notifications/${id}/read`).catch(() => {});
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2"><FiBell /> Notifications</h1>
        {notifications.some(n => !n.isRead) && (
          <button onClick={markAllRead} className="btn-secondary text-sm flex items-center gap-1">
            <FiCheck size={14} /> Mark all as read
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="text-4xl animate-bounce">🐱</div></div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-20 text-cat-textSecondary">
          <div className="text-6xl mb-4">🔔</div>
          <p>No notifications yet</p>
        </div>
      ) : (
        <div className="space-y-1">
          {notifications.map(n => (
            <div key={n.id}
              onClick={() => { markRead(n.id); if (n.link) navigate(n.link); }}
              className={`flex items-start gap-4 p-4 rounded-lg cursor-pointer transition-colors ${
                n.isRead ? 'hover:bg-cat-hover/50' : 'bg-cat-card hover:bg-cat-hover'
              }`}>
              <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${n.isRead ? 'bg-transparent' : 'bg-cat-accent'}`} />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{n.title}</p>
                <p className="text-sm text-cat-textSecondary mt-0.5">{n.message}</p>
                <p className="text-xs text-cat-textSecondary mt-1">{formatTimeAgo(n.createdAt)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

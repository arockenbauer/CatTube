import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiUsers, FiFilm, FiEye, FiMessageSquare, FiFlag, FiAlertTriangle, FiLoader, FiUserPlus, FiShield, FiTrash2 } from 'react-icons/fi';
import api from '../services/api.js';
import useAuthStore from '../store/authStore.js';
import { formatNumber, formatTimeAgo } from '../hooks/useApi.js';

export default function AdminPanel() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [tab, setTab] = useState('dashboard');
  const [dashboard, setDashboard] = useState(null);
  const [users, setUsers] = useState([]);
  const [videos, setVideos] = useState([]);
  const [reports, setReports] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!user || user.level < 3) { navigate('/'); return; }
    fetchTab();
  }, [tab, user]);

  const fetchTab = async () => {
    setLoading(true);
    try {
      switch (tab) {
        case 'dashboard': {
          const { data } = await api.get('/admin/dashboard');
          setDashboard(data);
          break;
        }
        case 'users': {
          const { data } = await api.get(`/admin/users?limit=50${searchTerm ? `&search=${searchTerm}` : ''}`);
          setUsers(data.users || []);
          break;
        }
        case 'videos': {
          const { data } = await api.get(`/admin/videos?limit=50${searchTerm ? `&search=${searchTerm}` : ''}`);
          setVideos(data.videos || []);
          break;
        }
        case 'reports': {
          const { data } = await api.get('/admin/reports?status=pending');
          setReports(data.reports || []);
          break;
        }
        case 'logs': {
          const { data } = await api.get('/admin/logs?limit=50');
          setLogs(data.logs || []);
          break;
        }
      }
    } catch {} finally { setLoading(false); }
  };

  const updateLevel = async (userId, level) => {
    await api.put(`/admin/users/${userId}/level`, { level });
    fetchTab();
  };

  const banUser = async (userId) => {
    await api.post(`/admin/users/${userId}/ban`, { reason: 'Banned by admin' });
    fetchTab();
  };

  const unbanUser = async (userId) => {
    await api.post(`/admin/users/${userId}/unban`);
    fetchTab();
  };

  const deleteVideo = async (videoId) => {
    await api.delete(`/admin/videos/${videoId}`);
    fetchTab();
  };

  const resolveReport = async (reportId) => {
    await api.put(`/admin/reports/${reportId}/resolve`, { action: 'resolved' });
    fetchTab();
  };

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: FiEye },
    { id: 'users', label: 'Users', icon: FiUsers },
    { id: 'videos', label: 'Videos', icon: FiFilm },
    { id: 'reports', label: 'Reports', icon: FiFlag },
    { id: 'logs', label: 'Logs', icon: FiShield }
  ];

  const levelNames = { 0: 'Basic', 1: 'Creator', 2: 'Premium', 3: 'Admin' };
  const levelColors = { 0: 'text-gray-400', 1: 'text-blue-400', 2: 'text-yellow-400', 3: 'text-red-400' };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <FiShield className="text-red-400" /> Admin Panel
      </h1>

      <div className="flex gap-2 border-b border-cat-border mb-6 overflow-x-auto">
        {tabs.map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setSearchTerm(''); }}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 whitespace-nowrap ${
              tab === t.id ? 'border-red-400 text-red-400' : 'border-transparent text-cat-textSecondary hover:text-white'
            }`}>
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><FiLoader className="animate-spin text-3xl" /></div>
      ) : (
        <>
          {tab === 'dashboard' && dashboard && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {[
                { label: 'Users', value: dashboard.stats.totalUsers, icon: FiUsers },
                { label: 'Videos', value: dashboard.stats.totalVideos, icon: FiFilm },
                { label: 'Total Views', value: formatNumber(dashboard.stats.totalViews), icon: FiEye },
                { label: 'Comments', value: formatNumber(dashboard.stats.totalComments), icon: FiMessageSquare },
                { label: 'Reports', value: dashboard.stats.pendingReports, icon: FiFlag },
                { label: 'Banned', value: dashboard.stats.bannedUsers, icon: FiAlertTriangle },
                { label: 'Processing', value: dashboard.stats.processingVideos, icon: FiLoader },
                { label: 'New Users Today', value: dashboard.stats.newUsersToday, icon: FiUserPlus },
                { label: 'New Videos Today', value: dashboard.stats.newVideosToday, icon: FiFilm },
              ].map(s => (
                <div key={s.label} className="card p-4">
                  <s.icon className="text-cat-textSecondary mb-2" size={20} />
                  <div className="text-2xl font-bold">{s.value}</div>
                  <div className="text-xs text-cat-textSecondary">{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {tab === 'users' && (
            <div>
              <div className="mb-4">
                <input type="text" placeholder="Search users..." value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchTab()}
                  className="w-full max-w-md" />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-cat-border text-cat-textSecondary text-left">
                      <th className="p-3">User</th>
                      <th className="p-3">Email</th>
                      <th className="p-3">Level</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Joined</th>
                      <th className="p-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id} className="border-b border-cat-border/50 hover:bg-cat-hover/50">
                        <td className="p-3 font-medium">{u.display_name} <span className="text-cat-textSecondary">@{u.username}</span></td>
                        <td className="p-3 text-cat-textSecondary">{u.email}</td>
                        <td className="p-3">
                          <select value={u.level} onChange={(e) => updateLevel(u.id, parseInt(e.target.value))}
                            className={`bg-transparent text-sm ${levelColors[u.level]} cursor-pointer`}>
                            {Object.entries(levelNames).map(([lv, name]) => (
                              <option key={lv} value={lv} className="bg-cat-dark">{name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="p-3">
                          {u.is_banned ? <span className="text-red-400">Banned</span> : <span className="text-green-400">Active</span>}
                          {u.shadow_banned ? <span className="text-yellow-400 ml-1">(Shadow)</span> : ''}
                        </td>
                        <td className="p-3 text-cat-textSecondary">{formatTimeAgo(u.created_at)}</td>
                        <td className="p-3">
                          {u.is_banned ? (
                            <button onClick={() => unbanUser(u.id)} className="text-green-400 hover:underline text-xs">Unban</button>
                          ) : (
                            <button onClick={() => banUser(u.id)} className="text-red-400 hover:underline text-xs">Ban</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'videos' && (
            <div>
              <div className="mb-4">
                <input type="text" placeholder="Search videos..." value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchTab()}
                  className="w-full max-w-md" />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-cat-border text-cat-textSecondary text-left">
                      <th className="p-3">Title</th>
                      <th className="p-3">Author</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Views</th>
                      <th className="p-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {videos.map(v => (
                      <tr key={v.id} className="border-b border-cat-border/50 hover:bg-cat-hover/50">
                        <td className="p-3 font-medium">{v.title} {v.isShort && <span className="badge bg-cat-accent/20 text-cat-accent ml-1">Short</span>}</td>
                        <td className="p-3 text-cat-textSecondary">{v.author?.username}</td>
                        <td className="p-3">
                          <span className={`badge ${v.status === 'published' ? 'bg-green-900/50 text-green-400' : 'bg-yellow-900/50 text-yellow-400'}`}>{v.status}</span>
                        </td>
                        <td className="p-3">{formatNumber(v.viewCount)}</td>
                        <td className="p-3">
                          <button onClick={() => deleteVideo(v.id)} className="text-red-400 hover:underline text-xs flex items-center gap-1">
                            <FiTrash2 size={12} /> Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'reports' && (
            <div className="space-y-3">
              {reports.length === 0 ? (
                <div className="text-center py-12 text-cat-textSecondary">No pending reports 🎉</div>
              ) : reports.map(r => (
                <div key={r.id} className="card p-4 flex items-start justify-between">
                  <div>
                    <div className="font-semibold">{r.reason}</div>
                    <div className="text-sm text-cat-textSecondary mt-1">{r.details}</div>
                    <div className="text-xs text-cat-textSecondary mt-1">
                      Reported by {r.reporter} · {formatTimeAgo(r.createdAt)}
                      {r.videoTitle && <span> · Video: {r.videoTitle}</span>}
                      {r.targetUser && <span> · User: {r.targetUser}</span>}
                    </div>
                  </div>
                  <button onClick={() => resolveReport(r.id)} className="btn-secondary text-xs">Resolve</button>
                </div>
              ))}
            </div>
          )}

          {tab === 'logs' && (
            <div className="space-y-2">
              {logs.map(l => (
                <div key={l.id} className="flex items-center gap-4 p-3 card text-sm">
                  <span className="text-cat-textSecondary w-32 flex-shrink-0">{formatTimeAgo(l.createdAt)}</span>
                  <span className="font-medium">{l.adminUsername}</span>
                  <span className="text-cat-accent">{l.action}</span>
                  <span className="text-cat-textSecondary">{l.targetType} #{l.targetId}</span>
                  {l.details && <span className="text-cat-textSecondary truncate">{l.details}</span>}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

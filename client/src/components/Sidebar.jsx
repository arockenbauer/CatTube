import { NavLink } from 'react-router-dom';
import { FiHome, FiTrendingUp, FiFilm, FiClock, FiThumbsUp, FiUsers, FiSettings, FiUpload } from 'react-icons/fi';
import useUIStore from '../store/uiStore.js';
import useAuthStore from '../store/authStore.js';

const mainLinks = [
  { to: '/', icon: FiHome, label: 'Home' },
  { to: '/trending', icon: FiTrendingUp, label: 'Trending' },
  { to: '/shorts', icon: FiFilm, label: 'Shorts' },
  { to: '/subscriptions', icon: FiUsers, label: 'Subscriptions' },
];

const userLinks = [
  { to: '/history', icon: FiClock, label: 'History' },
  { to: '/upload', icon: FiUpload, label: 'Upload' },
];

export default function Sidebar() {
  const sidebarOpen = useUIStore(s => s.sidebarOpen);
  const { isAuthenticated, user } = useAuthStore();

  const linkClass = ({ isActive }) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
      isActive ? 'bg-cat-hover text-white font-semibold' : 'text-cat-textSecondary hover:bg-cat-hover hover:text-white'
    }`;

  return (
    <aside className={`fixed left-0 top-14 bottom-0 bg-cat-darker border-r border-cat-border overflow-y-auto z-40 transition-all duration-300 ${
      sidebarOpen ? 'w-60' : 'w-16'
    }`}>
      <div className="py-2">
        {mainLinks.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} className={linkClass}>
            <Icon size={20} className="flex-shrink-0" />
            {sidebarOpen && <span className="truncate">{label}</span>}
          </NavLink>
        ))}

        {isAuthenticated && (
          <>
            <div className={`my-2 border-t border-cat-border ${sidebarOpen ? 'mx-3' : 'mx-2'}`} />
            {sidebarOpen && <div className="px-3 py-2 text-xs text-cat-textSecondary uppercase tracking-wider">You</div>}
            {userLinks.map(({ to, icon: Icon, label }) => (
              <NavLink key={to} to={to} className={linkClass}>
                <Icon size={20} className="flex-shrink-0" />
                {sidebarOpen && <span className="truncate">{label}</span>}
              </NavLink>
            ))}
          </>
        )}

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

      {sidebarOpen && (
        <div className="p-3 mt-4 border-t border-cat-border text-xs text-cat-textSecondary">
          <p>CatTube &copy; {new Date().getFullYear()}</p>
          <p className="mt-1">Made with 🐱 and ❤️</p>
        </div>
      )}
    </aside>
  );
}

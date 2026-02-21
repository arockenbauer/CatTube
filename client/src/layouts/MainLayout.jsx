import { Outlet } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import Sidebar from '../components/Sidebar.jsx';
import MiniPlayer from '../components/MiniPlayer.jsx';
import useUIStore from '../store/uiStore.js';

export default function MainLayout() {
  const sidebarOpen = useUIStore(s => s.sidebarOpen);
  const miniPlayer = useUIStore(s => s.miniPlayer);

  return (
    <div className="min-h-screen bg-cat-dark">
      <Navbar />
      <div className="flex pt-14">
        <Sidebar />
        <main className={`flex-1 transition-all duration-300 ${sidebarOpen ? 'ml-60' : 'ml-16'}`}>
          <div className="p-4">
            <Outlet />
          </div>
        </main>
      </div>
      {miniPlayer && <MiniPlayer />}
    </div>
  );
}

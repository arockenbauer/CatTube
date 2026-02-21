import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import useAuthStore from './store/authStore.js';
import MainLayout from './layouts/MainLayout.jsx';
import Home from './pages/Home.jsx';
import Watch from './pages/Watch.jsx';
import Shorts from './pages/Shorts.jsx';
import Search from './pages/Search.jsx';
import Channel from './pages/Channel.jsx';
import Studio from './pages/Studio.jsx';
import AdminPanel from './pages/AdminPanel.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Trending from './pages/Trending.jsx';
import History from './pages/History.jsx';
import Subscriptions from './pages/Subscriptions.jsx';
import Upload from './pages/Upload.jsx';
import Notifications from './pages/Notifications.jsx';
import NotFound from './pages/NotFound.jsx';

export default function App() {
  const init = useAuthStore(s => s.init);
  const isLoading = useAuthStore(s => s.isLoading);

  useEffect(() => { init(); }, [init]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-cat-dark">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-bounce">🐱</div>
          <div className="text-cat-textSecondary text-lg">Loading CatTube...</div>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/shorts" element={<Shorts />} />
      <Route element={<MainLayout />}>
        <Route index element={<Home />} />
        <Route path="/watch/:uuid" element={<Watch />} />
        <Route path="/search" element={<Search />} />
        <Route path="/channel/:username" element={<Channel />} />
        <Route path="/studio" element={<Studio />} />
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="/trending" element={<Trending />} />
        <Route path="/history" element={<History />} />
        <Route path="/subscriptions" element={<Subscriptions />} />
        <Route path="/upload" element={<Upload />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

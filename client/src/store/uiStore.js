import { create } from 'zustand';

const useUIStore = create((set) => ({
  sidebarOpen: true,
  sidebarCollapsed: false,
  theaterMode: false,
  miniPlayer: null,

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  setTheaterMode: (theater) => set({ theaterMode: theater }),
  setMiniPlayer: (video) => set({ miniPlayer: video }),
  closeMiniPlayer: () => set({ miniPlayer: null })
}));

export default useUIStore;

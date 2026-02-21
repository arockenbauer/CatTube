import { FiX, FiMaximize2 } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import useUIStore from '../store/uiStore.js';

export default function MiniPlayer() {
  const miniPlayer = useUIStore(s => s.miniPlayer);
  const closeMiniPlayer = useUIStore(s => s.closeMiniPlayer);
  const navigate = useNavigate();

  if (!miniPlayer) return null;

  return (
    <div className="fixed bottom-4 right-4 w-80 z-50 card shadow-2xl overflow-hidden">
      <div className="relative aspect-video bg-black">
        <video
          src={miniPlayer.files?.[0]?.url}
          autoPlay
          className="w-full h-full object-contain"
        />
        <div className="absolute top-1 right-1 flex gap-1">
          <button onClick={() => { navigate(`/watch/${miniPlayer.uuid}`); closeMiniPlayer(); }}
            className="p-1 bg-black/60 rounded hover:bg-black/80">
            <FiMaximize2 size={14} />
          </button>
          <button onClick={closeMiniPlayer} className="p-1 bg-black/60 rounded hover:bg-black/80">
            <FiX size={14} />
          </button>
        </div>
      </div>
      <div className="p-2">
        <p className="text-xs font-semibold truncate">{miniPlayer.title}</p>
        <p className="text-xs text-cat-textSecondary truncate">{miniPlayer.channel?.displayName}</p>
      </div>
    </div>
  );
}

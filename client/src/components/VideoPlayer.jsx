import { useState, useRef, useEffect, useCallback } from 'react';
import { FiPlay, FiPause, FiVolume2, FiVolumeX, FiMaximize, FiMinimize, FiSkipForward, FiSkipBack, FiSettings, FiDownload, FiMonitor } from 'react-icons/fi';
import useAuthStore from '../store/authStore.js';
import useUIStore from '../store/uiStore.js';
import api from '../services/api.js';

export default function VideoPlayer({ video, onTimeUpdate }) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const progressRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [buffered, setBuffered] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [quality, setQuality] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const hideTimer = useRef(null);
  const { user } = useAuthStore();
  const { theaterMode, setTheaterMode, setMiniPlayer } = useUIStore();

  const files = video?.files || [];
  const currentFile = files.find(f => f.resolution === quality) || files[0];

  useEffect(() => {
    if (files.length > 0 && !quality) {
      const preferred = files.find(f => f.resolution === '720p') || files[files.length - 1];
      setQuality(preferred.resolution);
    }
  }, [files, quality]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !currentFile) return;
    const wasPlaying = !v.paused;
    const time = v.currentTime;
    v.src = currentFile.url;
    v.currentTime = time;
    if (wasPlaying) v.play().catch(() => {});
  }, [quality]);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play().catch(() => {}); setPlaying(true); }
    else { v.pause(); setPlaying(false); }
  }, []);

  const handleTimeUpdate = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    setCurrentTime(v.currentTime);
    setDuration(v.duration || 0);
    if (v.buffered.length > 0) {
      setBuffered(v.buffered.end(v.buffered.length - 1));
    }
    onTimeUpdate?.(v.currentTime, v.duration);
  }, [onTimeUpdate]);

  const skip = useCallback((seconds) => {
    const v = videoRef.current;
    if (v) v.currentTime = Math.max(0, Math.min(v.currentTime + seconds, v.duration));
  }, []);

  const handleProgressClick = useCallback((e) => {
    const v = videoRef.current;
    const bar = progressRef.current;
    if (!v || !bar) return;
    const rect = bar.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    v.currentTime = pos * v.duration;
  }, []);

  const toggleFullscreen = useCallback(() => {
    const c = containerRef.current;
    if (!c) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
      setFullscreen(false);
    } else {
      c.requestFullscreen().then(() => setFullscreen(true)).catch(() => {});
    }
  }, []);

  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (playing) setShowControls(false);
    }, 3000);
  }, [playing]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      switch (e.key) {
        case ' ': case 'k': e.preventDefault(); togglePlay(); break;
        case 'ArrowRight': e.preventDefault(); skip(10); break;
        case 'ArrowLeft': e.preventDefault(); skip(-10); break;
        case 'f': e.preventDefault(); toggleFullscreen(); break;
        case 'm': e.preventDefault(); setMuted(m => !m); break;
        case 't': e.preventDefault(); setTheaterMode(!theaterMode); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, skip, toggleFullscreen, theaterMode, setTheaterMode]);

  const formatTime = (s) => {
    if (!s || isNaN(s)) return '0:00';
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const handleDownload = async () => {
    if (!user || user.level < 2) return;
    try {
      const { data } = await api.post(`/download/token/${video.uuid}?resolution=${quality}`);
      window.open(`/api/download/${data.downloadToken}`, '_blank');
    } catch {}
  };

  const speeds = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

  return (
    <div
      ref={containerRef}
      className={`relative bg-black group ${theaterMode ? 'w-full' : ''} ${fullscreen ? '' : 'rounded-xl overflow-hidden'}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => playing && setShowControls(false)}
    >
      <video
        ref={videoRef}
        className="w-full aspect-video cursor-pointer"
        onClick={togglePlay}
        onDoubleClick={toggleFullscreen}
        onTimeUpdate={handleTimeUpdate}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onLoadedMetadata={(e) => setDuration(e.target.duration)}
        muted={muted}
        volume={volume}
        playsInline
      />

      {!playing && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-16 h-16 rounded-full bg-black/60 flex items-center justify-center">
            <FiPlay size={30} className="text-white ml-1" />
          </div>
        </div>
      )}

      <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent transition-opacity ${showControls ? 'opacity-100' : 'opacity-0'}`}>
        <div ref={progressRef} className="relative h-1 mx-2 mt-4 cursor-pointer group/progress hover:h-2 transition-all" onClick={handleProgressClick}>
          <div className="absolute inset-0 bg-white/20 rounded-full" />
          <div className="absolute inset-y-0 left-0 bg-white/40 rounded-full" style={{ width: `${duration ? (buffered / duration) * 100 : 0}%` }} />
          <div className="absolute inset-y-0 left-0 bg-cat-accent rounded-full" style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}>
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-cat-accent opacity-0 group-hover/progress:opacity-100 transition-opacity" />
          </div>
        </div>

        <div className="flex items-center gap-2 px-2 py-1.5">
          <button onClick={togglePlay} className="p-1.5 hover:bg-white/10 rounded-full">
            {playing ? <FiPause size={20} /> : <FiPlay size={20} />}
          </button>
          <button onClick={() => skip(-10)} className="p-1.5 hover:bg-white/10 rounded-full">
            <FiSkipBack size={18} />
          </button>
          <button onClick={() => skip(10)} className="p-1.5 hover:bg-white/10 rounded-full">
            <FiSkipForward size={18} />
          </button>

          <div className="flex items-center gap-1 group/vol">
            <button onClick={() => setMuted(!muted)} className="p-1.5 hover:bg-white/10 rounded-full">
              {muted || volume === 0 ? <FiVolumeX size={18} /> : <FiVolume2 size={18} />}
            </button>
            <input
              type="range" min="0" max="1" step="0.05" value={muted ? 0 : volume}
              onChange={(e) => { setVolume(parseFloat(e.target.value)); setMuted(false); }}
              className="w-0 group-hover/vol:w-20 transition-all accent-cat-accent"
            />
          </div>

          <span className="text-xs text-white/80 ml-1">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

          <div className="flex-1" />

          <div className="relative">
            <button onClick={() => { setShowSettings(!showSettings); setShowSpeedMenu(false); }} className="p-1.5 hover:bg-white/10 rounded-full">
              <FiSettings size={18} />
            </button>
            {showSettings && (
              <div className="absolute bottom-full right-0 mb-2 w-56 bg-cat-card border border-cat-border rounded-lg shadow-xl overflow-hidden">
                <div className="p-2 text-xs font-semibold text-cat-textSecondary">Quality</div>
                {files.map(f => (
                  <button key={f.resolution} onClick={() => { setQuality(f.resolution); setShowSettings(false); }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-cat-hover ${quality === f.resolution ? 'text-cat-accent font-semibold' : ''}`}>
                    {f.resolution} {quality === f.resolution && '✓'}
                  </button>
                ))}
                <div className="border-t border-cat-border" />
                <div className="p-2 text-xs font-semibold text-cat-textSecondary">Speed</div>
                {speeds.map(s => (
                  <button key={s} onClick={() => { setPlaybackRate(s); if (videoRef.current) videoRef.current.playbackRate = s; setShowSettings(false); }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-cat-hover ${playbackRate === s ? 'text-cat-accent font-semibold' : ''}`}>
                    {s}x {playbackRate === s && '✓'}
                  </button>
                ))}
              </div>
            )}
          </div>

          {user?.level >= 2 && (
            <button onClick={handleDownload} className="p-1.5 hover:bg-white/10 rounded-full" title="Download (Premium)">
              <FiDownload size={18} />
            </button>
          )}

          <button onClick={() => setTheaterMode(!theaterMode)} className="p-1.5 hover:bg-white/10 rounded-full" title="Theater Mode (t)">
            <FiMonitor size={18} />
          </button>

          <button onClick={toggleFullscreen} className="p-1.5 hover:bg-white/10 rounded-full" title="Fullscreen (f)">
            {fullscreen ? <FiMinimize size={18} /> : <FiMaximize size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
}

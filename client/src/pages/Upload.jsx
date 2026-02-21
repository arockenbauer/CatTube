import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiUploadCloud, FiX, FiLoader, FiCheck, FiFilm } from 'react-icons/fi';
import api from '../services/api.js';
import useAuthStore from '../store/authStore.js';

const categories = ['Music', 'Gaming', 'Education', 'Entertainment', 'Sports', 'News', 'Tech', 'Cooking', 'Other'];

export default function Upload() {
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [category, setCategory] = useState('Other');
  const [visibility, setVisibility] = useState('public');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(null);
  const [processingStatus, setProcessingStatus] = useState(null);
  const fileRef = useRef(null);
  const pollRef = useRef(null);
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    navigate('/login');
    return null;
  }

  const pollStatus = useCallback((uuid) => {
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await api.get(`/videos/${uuid}/status`);
        setProcessingStatus(data);
        if (data.status === 'published') {
          clearInterval(pollRef.current);
          setTimeout(() => navigate(`/watch/${uuid}`), 1500);
        }
      } catch {}
    }, 2000);
  }, [navigate]);

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      if (!title) setTitle(f.name.replace(/\.[^/.]+$/, ''));
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file || !title.trim()) return;
    setUploading(true);
    setError('');
    setProgress(0);

    const formData = new FormData();
    formData.append('video', file);
    formData.append('title', title.trim());
    formData.append('description', description);
    formData.append('tags', tags);
    formData.append('category', category);
    formData.append('visibility', visibility);

    try {
      const { data } = await api.post('/videos/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          if (e.total) setProgress(Math.round((e.loaded / e.total) * 100));
        }
      });
      setUploading(false);
      setProcessing(data.video);
      setProcessingStatus({ status: 'processing', completedResolutions: [], targetResolutions: [] });
      pollStatus(data.video.uuid);
    } catch (err) {
      setError(err.response?.data?.error || 'Upload failed');
      setUploading(false);
    }
  };

  const buildSteps = () => {
    const steps = [
      { key: 'upload', label: 'Uploading to server' },
      { key: 'queued', label: 'Queued for processing' },
    ];
    const targets = processingStatus?.targetResolutions || [];
    if (targets.length > 0) {
      for (const r of targets) {
        steps.push({ key: r, label: `Encoding ${r}` });
      }
    } else {
      steps.push({ key: 'encoding', label: 'Encoding video...' });
    }
    steps.push({ key: 'thumbnail', label: 'Generating thumbnail' });
    steps.push({ key: 'publish', label: 'Publishing video' });
    return steps;
  };

  const getStepStatus = (step) => {
    if (!processingStatus) return 'pending';
    const completed = processingStatus.completedResolutions || [];
    const targets = processingStatus.targetResolutions || [];
    const isPublished = processingStatus.status === 'published';
    const isTranscoding = processingStatus.status === 'transcoding';

    switch (step.key) {
      case 'upload': return 'done';
      case 'queued': return isTranscoding || completed.length > 0 || isPublished ? 'done' : 'active';
      case 'encoding':
        return isPublished ? 'done' : isTranscoding ? 'active' : 'pending';
      case 'thumbnail':
        return processingStatus.thumbnailUrl ? 'done' :
          (isPublished ? 'done' : (completed.length === targets.length && targets.length > 0 ? 'active' : 'pending'));
      case 'publish': return isPublished ? 'done' : 'pending';
      default: {
        if (completed.includes(step.key)) return 'done';
        if (isTranscoding && !completed.includes(step.key)) {
          const idx = targets.indexOf(step.key);
          if (idx === 0 || (idx > 0 && completed.includes(targets[idx - 1]))) return 'active';
          const allPrevDone = targets.slice(0, idx).every(t => completed.includes(t));
          if (allPrevDone) return 'active';
        }
        return 'pending';
      }
    }
  };

  if (processing) {
    const steps = buildSteps();
    return (
      <div className="max-w-2xl mx-auto">
        <div className="card p-8 text-center">
          <div className="text-5xl mb-4">{processingStatus?.status === 'published' ? '🎉' : '🐱'}</div>
          <h1 className="text-2xl font-bold mb-2">
            {processingStatus?.status === 'published' ? 'Video Published!' : 'Processing Your Video'}
          </h1>
          <p className="text-cat-textSecondary mb-6">
            {processingStatus?.status === 'published'
              ? 'Redirecting you to your video...'
              : 'Your video is being processed in the background. You can leave this page — processing will continue.'}
          </p>

          <div className="text-left space-y-3 max-w-md mx-auto">
            {steps.map((step, i) => {
              const status = getStepStatus(step);
              return (
                <div key={step.key} className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                    status === 'done' ? 'bg-green-500 text-white' :
                    status === 'active' ? 'bg-cat-accent text-white' :
                    'bg-cat-card text-cat-textSecondary'
                  }`}>
                    {status === 'done' ? <FiCheck size={14} /> :
                     status === 'active' ? <FiLoader className="animate-spin" size={14} /> :
                     <span className="text-xs">{i + 1}</span>}
                  </div>
                  <span className={`text-sm ${
                    status === 'done' ? 'text-green-400' :
                    status === 'active' ? 'text-cat-accent font-semibold' :
                    'text-cat-textSecondary'
                  }`}>{step.label}</span>
                </div>
              );
            })}
          </div>

          {processing.title && (
            <div className="mt-6 card p-4 flex items-center gap-4">
              {processingStatus?.thumbnailUrl ? (
                <img src={processingStatus.thumbnailUrl} alt="" className="w-32 h-20 rounded object-cover" />
              ) : (
                <div className="w-32 h-20 rounded bg-cat-card flex items-center justify-center"><FiFilm size={24} className="text-cat-textSecondary" /></div>
              )}
              <div className="text-left flex-1 min-w-0">
                <p className="font-semibold truncate">{processing.title}</p>
                <p className="text-sm text-cat-textSecondary">
                  {processingStatus?.duration ? `${Math.floor(processingStatus.duration / 60)}:${String(Math.floor(processingStatus.duration % 60)).padStart(2, '0')}` : 'Detecting duration...'}
                  {processingStatus?.isShort ? ' · Short' : ''}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Upload Video</h1>

      {!file ? (
        <div
          onClick={() => fileRef.current?.click()}
          className="card border-2 border-dashed border-cat-border hover:border-cat-accent p-16 text-center cursor-pointer transition-colors"
        >
          <FiUploadCloud className="mx-auto mb-4 text-cat-textSecondary" size={64} />
          <p className="text-lg font-semibold mb-2">Drag and drop or click to upload</p>
          <p className="text-sm text-cat-textSecondary">MP4, WebM, MOV, AVI, MKV · Max 5GB</p>
          <input ref={fileRef} type="file" accept="video/*" onChange={handleFile} className="hidden" />
        </div>
      ) : (
        <form onSubmit={handleUpload} className="space-y-4">
          {error && (
            <div className="bg-red-900/30 border border-red-500/50 text-red-400 px-4 py-2 rounded-lg text-sm">{error}</div>
          )}

          <div className="card p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-cat-accent/20 flex items-center justify-center">🎬</div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{file.name}</p>
              <p className="text-sm text-cat-textSecondary">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
            </div>
            <button type="button" onClick={() => setFile(null)} className="p-2 hover:bg-cat-hover rounded-full">
              <FiX size={18} />
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Title *</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required className="w-full" maxLength={200} />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="w-full resize-none" maxLength={5000} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full">
                {categories.map(c => <option key={c} value={c.toLowerCase()}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Visibility</label>
              <select value={visibility} onChange={(e) => setVisibility(e.target.value)} className="w-full">
                <option value="public">Public</option>
                <option value="unlisted">Unlisted</option>
                <option value="private">Private</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Tags (comma-separated)</label>
            <input type="text" value={tags} onChange={(e) => setTags(e.target.value)} className="w-full" placeholder="cat, funny, cute" />
          </div>

          {uploading && (
            <div className="card p-4">
              <div className="flex items-center gap-3 mb-2">
                <FiLoader className="animate-spin text-cat-accent" />
                <span className="text-sm">Uploading... {progress}%</span>
              </div>
              <div className="w-full bg-cat-border rounded-full h-2">
                <div className="bg-cat-accent h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-xs text-cat-textSecondary mt-2">Video will be processed after upload (transcoding may take a few minutes)</p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={uploading} className="btn-primary flex-1 py-2.5 disabled:opacity-50 flex items-center justify-center gap-2">
              {uploading ? <><FiLoader className="animate-spin" /> Uploading...</> : 'Upload Video'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

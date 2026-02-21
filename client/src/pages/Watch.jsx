import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FiThumbsUp, FiThumbsDown, FiShare2, FiFlag, FiMessageSquare, FiCheck, FiChevronDown, FiChevronUp, FiLoader } from 'react-icons/fi';
import api from '../services/api.js';
import VideoPlayer from '../components/VideoPlayer.jsx';
import VideoCard from '../components/VideoCard.jsx';
import useAuthStore from '../store/authStore.js';
import useUIStore from '../store/uiStore.js';
import { formatViews, formatTimeAgo, formatNumber } from '../hooks/useApi.js';
import { joinVideo, leaveVideo, onLiveViewers } from '../services/socket.js';

const BASE_URL = window.location.origin;

function CommentItem({ comment, uuid, isAuthenticated, onUpdate }) {
  const [showReplies, setShowReplies] = useState(false);
  const [replies, setReplies] = useState([]);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [liked, setLiked] = useState(comment.isLiked);
  const [likeCount, setLikeCount] = useState(comment.likeCount || 0);

  const handleLikeComment = async () => {
    if (!isAuthenticated) return;
    try {
      const { data } = await api.post(`/comments/${comment.id}/like`);
      setLiked(data.liked);
      setLikeCount(prev => data.liked ? prev + 1 : Math.max(0, prev - 1));
    } catch {}
  };

  const loadReplies = async () => {
    if (showReplies) { setShowReplies(false); return; }
    setLoadingReplies(true);
    try {
      const { data } = await api.get(`/comments/${comment.id}/replies`);
      setReplies(data.replies || []);
      setShowReplies(true);
    } catch {}
    setLoadingReplies(false);
  };

  const handleReply = async (e) => {
    e.preventDefault();
    if (!replyText.trim()) return;
    try {
      const { data } = await api.post(`/comments/video/${uuid}`, { content: replyText.trim(), parentId: comment.id });
      setReplies(prev => [...prev, data.comment]);
      setReplyText('');
      setShowReplyInput(false);
      setShowReplies(true);
      if (onUpdate) onUpdate();
    } catch {}
  };

  return (
    <div className="flex gap-3">
      <Link to={`/channel/${comment.author?.username}`}>
        <div className="w-10 h-10 rounded-full bg-cat-card flex items-center justify-center text-sm font-bold flex-shrink-0">
          {comment.author?.displayName?.[0]?.toUpperCase() || '?'}
        </div>
      </Link>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Link to={`/channel/${comment.author?.username}`} className="text-sm font-semibold hover:text-cat-accent">
            {comment.author?.displayName}
          </Link>
          <span className="text-xs text-cat-textSecondary">{formatTimeAgo(comment.createdAt)}</span>
          {comment.isPinned && <span className="text-xs text-cat-accent">📌 Pinned</span>}
        </div>
        <p className="text-sm mt-1">{comment.content}</p>
        <div className="flex items-center gap-3 mt-1">
          <button onClick={handleLikeComment} className={`text-xs hover:text-white flex items-center gap-1 ${liked ? 'text-cat-accent' : 'text-cat-textSecondary'}`}>
            <FiThumbsUp size={12} className={liked ? 'fill-current' : ''} /> {likeCount || ''}
          </button>
          {isAuthenticated && (
            <button onClick={() => setShowReplyInput(!showReplyInput)} className="text-xs text-cat-textSecondary hover:text-white">Reply</button>
          )}
        </div>
        {showReplyInput && (
          <form onSubmit={handleReply} className="mt-2 flex gap-2">
            <input type="text" value={replyText} onChange={e => setReplyText(e.target.value)}
              placeholder="Add a reply..." className="flex-1 bg-transparent border-b border-cat-border focus:border-cat-accent text-sm pb-1" autoFocus />
            <button type="button" onClick={() => { setShowReplyInput(false); setReplyText(''); }} className="text-xs text-cat-textSecondary hover:text-white">Cancel</button>
            <button type="submit" className="text-xs text-cat-accent hover:underline" disabled={!replyText.trim()}>Reply</button>
          </form>
        )}
        {comment.replyCount > 0 && (
          <button onClick={loadReplies} className="text-xs text-cat-accent mt-2 flex items-center gap-1">
            {loadingReplies ? <FiLoader className="animate-spin" size={12} /> : showReplies ? <FiChevronUp size={12} /> : <FiChevronDown size={12} />}
            {showReplies ? 'Hide' : comment.replyCount} {!showReplies && 'replies'}
          </button>
        )}
        {showReplies && replies.length > 0 && (
          <div className="mt-3 space-y-3 pl-2 border-l-2 border-cat-border">
            {replies.map(r => (
              <div key={r.id} className="flex gap-2">
                <Link to={`/channel/${r.author?.username}`}>
                  <div className="w-7 h-7 rounded-full bg-cat-card flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {r.author?.displayName?.[0]?.toUpperCase() || '?'}
                  </div>
                </Link>
                <div>
                  <div className="flex items-center gap-2">
                    <Link to={`/channel/${r.author?.username}`} className="text-xs font-semibold hover:text-cat-accent">{r.author?.displayName}</Link>
                    <span className="text-xs text-cat-textSecondary">{formatTimeAgo(r.createdAt)}</span>
                  </div>
                  <p className="text-sm mt-0.5">{r.content}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Watch() {
  const { uuid } = useParams();
  const [video, setVideo] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [showDesc, setShowDesc] = useState(false);
  const [liveViewers, setLiveViewers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [shareToast, setShareToast] = useState(false);
  const { user, isAuthenticated } = useAuthStore();
  const theaterMode = useUIStore(s => s.theaterMode);
  const viewRecorded = useRef(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      viewRecorded.current = false;
      try {
        const [videoRes, recoRes, commRes] = await Promise.all([
          api.get(`/videos/${uuid}`),
          api.get(`/recommendations?videoId=${uuid}&limit=16`),
          api.get(`/comments/video/${uuid}?limit=20`)
        ]);
        setVideo(videoRes.data.video);
        setRecommendations(recoRes.data.videos || []);
        setComments(commRes.data.comments || []);
      } catch {} finally {
        setLoading(false);
      }
    };
    fetchData();
    joinVideo(uuid);
    const unsub = onLiveViewers(({ count }) => setLiveViewers(count));
    return () => { leaveVideo(uuid); unsub(); };
  }, [uuid]);

  const handleTimeUpdate = (currentTime, duration) => {
    if (!viewRecorded.current && duration > 0 && currentTime > Math.min(30, duration * 0.3)) {
      viewRecorded.current = true;
      api.post(`/videos/${uuid}/view`, {
        watchDuration: currentTime,
        watchPercent: (currentTime / duration) * 100,
        fingerprint: localStorage.getItem('fingerprint')
      }).catch(() => {});
    }
  };

  const handleLike = async () => {
    if (!isAuthenticated) return;
    try {
      const { data } = await api.post(`/videos/${uuid}/like`);
      setVideo(v => ({
        ...v,
        isLiked: data.liked,
        isDisliked: false,
        likeCount: data.liked ? v.likeCount + 1 : v.likeCount - 1,
        dislikeCount: v.isDisliked ? v.dislikeCount - 1 : v.dislikeCount
      }));
    } catch {}
  };

  const handleDislike = async () => {
    if (!isAuthenticated) return;
    try {
      const { data } = await api.post(`/videos/${uuid}/dislike`);
      setVideo(v => ({
        ...v,
        isDisliked: data.disliked,
        isLiked: false,
        dislikeCount: data.disliked ? v.dislikeCount + 1 : v.dislikeCount - 1,
        likeCount: v.isLiked ? v.likeCount - 1 : v.likeCount
      }));
    } catch {}
  };

  const handleSubscribe = async () => {
    if (!isAuthenticated || !video?.channel) return;
    try {
      const { data } = await api.post(`/channels/${video.channel.username}/subscribe`);
      setVideo(v => ({
        ...v,
        isSubscribed: data.subscribed,
        channel: {
          ...v.channel,
          subscriberCount: data.subscribed ? v.channel.subscriberCount + 1 : v.channel.subscriberCount - 1
        }
      }));
    } catch {}
  };

  const handleComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    try {
      const { data } = await api.post(`/comments/video/${uuid}`, { content: commentText.trim() });
      setComments([data.comment, ...comments]);
      setCommentText('');
      setVideo(v => ({ ...v, commentCount: (v.commentCount || 0) + 1 }));
    } catch {}
  };

  const handleShare = async () => {
    const url = `${BASE_URL}/watch/${uuid}`;
    try {
      await navigator.clipboard.writeText(url);
      setShareToast(true);
      setTimeout(() => setShareToast(false), 2000);
    } catch {
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setShareToast(true);
      setTimeout(() => setShareToast(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-4xl animate-bounce">🐱</div>
      </div>
    );
  }

  if (!video) {
    return (
      <div className="text-center py-20">
        <div className="text-6xl mb-4">😿</div>
        <p className="text-lg">Video not found</p>
      </div>
    );
  }

  return (
    <div className={`flex gap-6 ${theaterMode ? 'flex-col' : 'flex-col xl:flex-row'}`}>
      {shareToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-cat-card border border-cat-border px-4 py-2 rounded-lg shadow-xl flex items-center gap-2 animate-fade-in">
          <FiCheck className="text-green-400" /> Link copied to clipboard
        </div>
      )}

      <div className={`${theaterMode ? 'w-full' : 'flex-1 min-w-0'}`}>
        {video.status === 'processing' ? (
          <div className="aspect-video bg-cat-card rounded-xl flex items-center justify-center">
            <div className="text-center">
              <FiLoader className="animate-spin text-cat-accent mx-auto mb-3" size={40} />
              <p className="font-semibold">Video is being processed...</p>
              <p className="text-sm text-cat-textSecondary mt-1">This may take a few minutes</p>
            </div>
          </div>
        ) : (
          <VideoPlayer video={video} onTimeUpdate={handleTimeUpdate} />
        )}

        <div className="mt-3">
          <h1 className="text-xl font-bold">{video.title}</h1>

          <div className="flex flex-wrap items-center gap-4 mt-3">
            <div className="flex items-center gap-3">
              <Link to={`/channel/${video.channel?.username}`}>
                <div className="w-10 h-10 rounded-full bg-cat-accent flex items-center justify-center font-bold overflow-hidden">
                  {video.channel?.avatarUrl && video.channel.avatarUrl !== '/default-avatar.png' ? (
                    <img src={video.channel.avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    video.channel?.displayName?.[0]?.toUpperCase()
                  )}
                </div>
              </Link>
              <div>
                <Link to={`/channel/${video.channel?.username}`} className="font-semibold hover:text-cat-accent">
                  {video.channel?.displayName}
                </Link>
                <p className="text-xs text-cat-textSecondary">{formatNumber(video.channel?.subscriberCount)} subscribers</p>
              </div>
              {isAuthenticated && video.channel?.id !== user?.id && (
                <button onClick={handleSubscribe}
                  className={`ml-2 px-4 py-1.5 rounded-full text-sm font-semibold ${
                    video.isSubscribed ? 'bg-cat-card hover:bg-cat-hover text-cat-text' : 'bg-white text-black hover:bg-gray-200'
                  }`}>
                  {video.isSubscribed ? 'Subscribed' : 'Subscribe'}
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <div className="flex items-center bg-cat-card rounded-full">
                <button onClick={handleLike} className={`flex items-center gap-1 px-4 py-1.5 rounded-l-full border-r border-cat-border hover:bg-cat-hover ${video.isLiked ? 'text-cat-accent' : ''}`}>
                  <FiThumbsUp size={18} className={video.isLiked ? 'fill-current' : ''} />
                  <span className="text-sm">{formatNumber(video.likeCount)}</span>
                </button>
                <button onClick={handleDislike} className={`flex items-center gap-1 px-4 py-1.5 rounded-r-full hover:bg-cat-hover ${video.isDisliked ? 'text-cat-accent' : ''}`}>
                  <FiThumbsDown size={18} className={video.isDisliked ? 'fill-current' : ''} />
                </button>
              </div>
              <button onClick={handleShare} className="flex items-center gap-1 bg-cat-card px-4 py-1.5 rounded-full hover:bg-cat-hover text-sm">
                <FiShare2 size={16} /> Share
              </button>
            </div>
          </div>

          <div className="mt-4 card p-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <span>{formatViews(video.viewCount)}</span>
              <span>·</span>
              <span>{formatTimeAgo(video.publishedAt)}</span>
              {liveViewers > 1 && (
                <>
                  <span>·</span>
                  <span className="text-cat-accent">{liveViewers} watching now</span>
                </>
              )}
            </div>
            <div className={`mt-2 text-sm text-cat-textSecondary ${showDesc ? '' : 'line-clamp-2'}`}>
              {video.description || 'No description'}
            </div>
            {video.description && video.description.length > 100 && (
              <button onClick={() => setShowDesc(!showDesc)} className="text-sm font-semibold mt-1 hover:text-cat-accent">
                {showDesc ? 'Show less' : 'Show more'}
              </button>
            )}
            {video.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {video.tags.map(t => (
                  <Link key={t} to={`/search?q=${encodeURIComponent(t)}`} className="text-xs text-cat-accent hover:underline">#{t}</Link>
                ))}
              </div>
            )}
          </div>

          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-4">
              <FiMessageSquare className="inline mr-2" />
              {video.commentCount || 0} Comments
            </h3>
            {isAuthenticated && (
              <form onSubmit={handleComment} className="flex gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-cat-accent flex items-center justify-center text-sm font-bold flex-shrink-0">
                  {user?.displayName?.[0]?.toUpperCase() || '?'}
                </div>
                <div className="flex-1">
                  <input type="text" value={commentText} onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Add a comment..." className="w-full bg-transparent border-b border-cat-border focus:border-cat-accent pb-1" />
                  {commentText && (
                    <div className="flex justify-end gap-2 mt-2">
                      <button type="button" onClick={() => setCommentText('')} className="btn-secondary text-sm px-3 py-1">Cancel</button>
                      <button type="submit" className="btn-primary text-sm px-3 py-1">Comment</button>
                    </div>
                  )}
                </div>
              </form>
            )}
            <div className="space-y-4">
              {comments.map(c => (
                <CommentItem key={c.id} comment={c} uuid={uuid} isAuthenticated={isAuthenticated}
                  onUpdate={() => setVideo(v => ({ ...v, commentCount: (v.commentCount || 0) + 1 }))} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {!theaterMode && (
        <div className="w-full xl:w-96 flex-shrink-0 space-y-3">
          <h3 className="font-semibold text-sm text-cat-textSecondary mb-2">Up next</h3>
          {recommendations.map(v => <VideoCard key={v.uuid} video={v} horizontal />)}
        </div>
      )}
    </div>
  );
}

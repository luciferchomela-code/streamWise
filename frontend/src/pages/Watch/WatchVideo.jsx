import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Navbar } from '../../components/layout/Navbar/Navbar';
import { videoService } from '../../services/videoService';
import { interactionService } from '../../services/interactionService';
import { channelService } from '../../services/channelService';
import { useAuth } from '../../hooks/useAuth';

const formatNumber = (n) => {
  if (!n) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
};

const formatTimeAgo = (dateStr) => {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const CommentItem = ({ comment, onDelete, currentUserId }) => (
  <div className="flex gap-3 group">
    <img
      src={comment.authorId?.image || `https://ui-avatars.com/api/?name=${comment.authorId?.name || 'U'}&background=1A1F2B&color=fff`}
      alt="author"
      className="w-8 h-8 rounded-full object-cover shrink-0"
    />
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-white text-sm font-semibold">{comment.authorId?.name || 'Anonymous'}</span>
        <span className="text-gray-500 text-xs">{formatTimeAgo(comment.createdAt)}</span>
      </div>
      <p className="text-gray-300 text-sm leading-relaxed">{comment.body}</p>
    </div>
    {comment.authorId?._id === currentUserId && (
      <button
        onClick={() => onDelete(comment._id)}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-gray-500 hover:text-red-400"
        aria-label="Delete comment"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    )}
  </div>
);

export default function WatchVideo() {
  const { videoId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [video, setVideo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [relatedVideos, setRelatedVideos] = useState([]);

  // Interaction state
  const [likes, setLikes] = useState(0);
  const [dislikes, setDislikes] = useState(0);
  const [liked, setLiked] = useState(false);
  const [disliked, setDisliked] = useState(false);
  const [views, setViews] = useState(0);
  const [subscribed, setSubscribed] = useState(false);
  const [savedWatchLater, setSavedWatchLater] = useState(false);

  // Comments
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);

  // Channel
  const [channel, setChannel] = useState(null);

  const viewTracked = useRef(false);

  useEffect(() => {
    if (!videoId) return;
    setLoading(true);
    setError('');
    viewTracked.current = false;

    videoService.getVideoById(videoId)
      .then((v) => {
        setVideo(v);
        setLikes(v.likes || 0);
        setDislikes(v.dislikes || 0);
        setViews(v.viewsRaw || 0);

        const chId = typeof v.channelId === 'object' ? v.channelId?._id : v.channelId;

        // Fetch channel info
        if (chId) {
          channelService.getChannel(chId).then(d => {
            if (d?.channel) setChannel(d.channel);
          }).catch(() => {});

          if (user) {
            channelService.getSubscriptionStatus(chId).then(d => {
              setSubscribed(!!d.subscribed);
            }).catch(() => {});
          }
        }

        if (user) {
          interactionService.getWatchLaterStatus(videoId).then(d => {
            setSavedWatchLater(!!d.watchLater);
          }).catch(() => {});
        }

        // Fetch related
        if (chId) {
          videoService.getChannelVideos(chId, { limit: 6 }).then(d => {
            setRelatedVideos((d.videos || []).filter(rv => rv.id !== videoId));
          }).catch(() => {});
        } else {
          videoService.getTrending({ limit: 6 }).then(d => {
            setRelatedVideos((d.videos || []).filter(rv => rv.id !== videoId));
          }).catch(() => {});
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));

    // Comments
    setCommentsLoading(true);
    interactionService.getComments(videoId)
      .then(setComments)
      .catch(() => setComments([]))
      .finally(() => setCommentsLoading(false));
  }, [videoId, user]);

  // Track view after 5s
  useEffect(() => {
    if (!video || viewTracked.current) return;
    const timer = setTimeout(async () => {
      viewTracked.current = true;
      try {
        const result = await interactionService.incrementView(videoId, 30);
        if (result?.views !== undefined) setViews(result.views);
      } catch {}
    }, 5000);
    return () => clearTimeout(timer);
  }, [video, videoId]);

  const handleLike = async () => {
    if (!user) { navigate('/login'); return; }
    try {
      const result = await interactionService.toggleLike(videoId);
      setLikes(result.likes);
      setDislikes(result.dislikes);
      setLiked(result.interaction?.liked ?? !liked);
      setDisliked(false);
    } catch (err) { console.error(err); }
  };

  const handleDislike = async () => {
    if (!user) { navigate('/login'); return; }
    try {
      const result = await interactionService.toggleDislike(videoId);
      setLikes(result.likes);
      setDislikes(result.dislikes);
      setDisliked(result.interaction?.disliked ?? !disliked);
      setLiked(false);
    } catch (err) { console.error(err); }
  };

  const handleToggleSubscribe = async () => {
    if (!user) { navigate('/login'); return; }
    const chId = channel?._id || (typeof video?.channelId === 'object' ? video?.channelId?._id : video?.channelId);
    if (!chId) return;

    try {
      if (subscribed) {
        await channelService.unsubscribe(chId);
        setSubscribed(false);
        setChannel((prev) => prev ? { ...prev, subscribersCount: Math.max(0, (prev.subscribersCount || 1) - 1) } : null);
      } else {
        await channelService.subscribe(chId);
        setSubscribed(true);
        setChannel((prev) => prev ? { ...prev, subscribersCount: (prev.subscribersCount || 0) + 1 } : null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleWatchLater = async () => {
    if (!user) { navigate('/login'); return; }
    try {
      const result = await interactionService.toggleWatchLater(videoId);
      setSavedWatchLater(result.watchLater);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!user) { navigate('/login'); return; }
    if (!commentText.trim()) return;
    setCommentSubmitting(true);
    try {
      const newComment = await interactionService.addComment(videoId, commentText);
      setComments(prev => [newComment, ...prev]);
      setCommentText('');
    } catch (err) { console.error(err); }
    finally { setCommentSubmitting(false); }
  };

  const handleDeleteComment = async (commentId) => {
    try {
      await interactionService.deleteComment(commentId);
      setComments(prev => prev.filter(c => c._id !== commentId));
    } catch (err) { console.error(err); }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0D12] text-white">
        <Navbar />
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-1 xl:grid-cols-3 gap-8">
          <div className="xl:col-span-2 space-y-4 animate-pulse">
            <div className="aspect-video w-full rounded-2xl bg-white/5" />
            <div className="h-8 bg-white/5 rounded w-3/4" />
            <div className="h-4 bg-white/5 rounded w-1/3" />
          </div>
          <div className="space-y-4 animate-pulse">
            {Array(4).fill(0).map((_, i) => <div key={i} className="h-24 rounded-xl bg-white/5" />)}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0B0D12] text-white flex flex-col">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
          <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center mb-6">
            <svg className="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold mb-2">Video unavailable</h1>
          <p className="text-gray-400 mb-6">{error}</p>
          <Link to="/" className="px-6 py-2.5 bg-gradient-to-r from-violet-500 to-cyan-500 text-white rounded-full font-medium">
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0D12] text-white font-sans">
      <Navbar />
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 grid grid-cols-1 xl:grid-cols-3 gap-8">

        {/* ── Left: Video + Info + Comments ── */}
        <div className="xl:col-span-2 flex flex-col gap-6">

          {/* Video Player */}
          <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-black shadow-2xl">
            {video?.videoUrl ? (
              <video
                key={video.videoUrl}
                className="w-full h-full"
                controls
                autoPlay
                src={video.videoUrl}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-[#151923]">
                {video?.thumbnail ? (
                  <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover opacity-40" />
                ) : null}
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                  <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center">
                    <svg className="w-8 h-8 text-gray-400 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                  </div>
                  <p className="text-gray-400 text-sm">Video processing or unavailable</p>
                </div>
              </div>
            )}
          </div>

          {/* Title + Actions */}
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white mb-3 leading-snug">{video?.title}</h1>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              {/* Channel Info & Subscribe */}
              <div className="flex items-center gap-4">
                <Link to={`/channel/${channel?._id || (typeof video?.channelId === 'object' ? video?.channelId?._id : video?.channelId)}`} className="flex items-center gap-3 group">
                  <img
                    src={channel?.image || `https://ui-avatars.com/api/?name=${video?.creator || channel?.name || 'C'}&background=1A1F2B&color=fff`}
                    alt={video?.creator || channel?.name}
                    className="w-10 h-10 rounded-full object-cover border border-white/10 group-hover:border-cyan-400 transition-colors"
                  />
                  <div>
                    <div className="text-white font-semibold text-sm group-hover:text-cyan-300 transition-colors">{video?.creator || channel?.name || 'Channel'}</div>
                    <div className="text-gray-400 text-xs">{formatNumber(channel?.subscribersCount)} subscribers</div>
                  </div>
                </Link>

                <button
                  onClick={handleToggleSubscribe}
                  className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all ${
                    subscribed
                      ? 'bg-white/10 hover:bg-red-500/20 text-gray-300 hover:text-red-400 border border-white/10'
                      : 'bg-gradient-to-r from-violet-500 to-cyan-400 hover:opacity-90 text-white shadow-[0_0_15px_rgba(139,92,246,0.3)]'
                  }`}
                >
                  {subscribed ? 'Subscribed' : 'Subscribe'}
                </button>
              </div>

              {/* Like / Dislike / Watch Later / Views */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center bg-[#151923] rounded-full border border-white/5 overflow-hidden">
                  <button
                    onClick={handleLike}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${liked ? 'text-cyan-400' : 'text-gray-300 hover:text-white'}`}
                  >
                    <svg className="w-4 h-4" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                    </svg>
                    {formatNumber(likes)}
                  </button>
                  <div className="w-px h-5 bg-white/10" />
                  <button
                    onClick={handleDislike}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${disliked ? 'text-red-400' : 'text-gray-300 hover:text-white'}`}
                  >
                    <svg className="w-4 h-4" fill={disliked ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
                    </svg>
                  </button>
                </div>

                <button
                  onClick={handleToggleWatchLater}
                  className={`flex items-center gap-2 px-4 py-2 bg-[#151923] rounded-full border border-white/5 text-sm font-medium transition-colors ${
                    savedWatchLater ? 'text-cyan-400 border-cyan-400/30' : 'text-gray-300 hover:text-white'
                  }`}
                  title={savedWatchLater ? 'Saved in Watch Later' : 'Save to Watch Later'}
                >
                  <svg className="w-4 h-4" fill={savedWatchLater ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                  <span>{savedWatchLater ? 'Saved' : 'Save'}</span>
                </button>

                <div className="flex items-center gap-1.5 px-4 py-2 bg-[#151923] rounded-full border border-white/5 text-sm text-gray-300">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  {formatNumber(views)}
                </div>
              </div>
            </div>

            {/* Description */}
            {video?.description && (
              <div className="mt-4 p-4 bg-[#151923] rounded-xl border border-white/5">
                <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">{video.description}</p>
              </div>
            )}
          </div>

          {/* Comments */}
          <section>
            <h2 className="text-lg font-bold mb-5 text-white">{comments.length} Comments</h2>

            {user ? (
              <form onSubmit={handleAddComment} className="flex gap-3 mb-8">
                <img
                  src={user?.picture || `https://ui-avatars.com/api/?name=${user?.name}&background=1A1F2B&color=fff`}
                  alt="you"
                  className="w-8 h-8 rounded-full object-cover shrink-0"
                />
                <div className="flex-1 flex flex-col gap-2">
                  <input
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Add a comment..."
                    className="w-full bg-transparent border-b border-white/10 focus:border-cyan-400 py-2 text-sm text-white placeholder-gray-500 outline-none transition-colors"
                  />
                  {commentText && (
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => setCommentText('')} className="px-4 py-1.5 text-sm text-gray-300 hover:text-white rounded-full transition-colors">Cancel</button>
                      <button type="submit" disabled={commentSubmitting} className="px-4 py-1.5 text-sm bg-cyan-500 hover:bg-cyan-400 text-white rounded-full font-medium transition-colors disabled:opacity-50">
                        {commentSubmitting ? 'Posting...' : 'Comment'}
                      </button>
                    </div>
                  )}
                </div>
              </form>
            ) : (
              <div className="mb-8 p-4 bg-[#151923] border border-white/5 rounded-xl text-center">
                <Link to="/login" className="text-cyan-400 hover:text-cyan-300 text-sm transition-colors">Sign in to comment</Link>
              </div>
            )}

            <div className="flex flex-col gap-6">
              {commentsLoading
                ? Array(3).fill(0).map((_, i) => (
                    <div key={i} className="flex gap-3 animate-pulse">
                      <div className="w-8 h-8 rounded-full bg-white/5 shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 bg-white/5 rounded w-24" />
                        <div className="h-3 bg-white/5 rounded w-full" />
                        <div className="h-3 bg-white/5 rounded w-3/4" />
                      </div>
                    </div>
                  ))
                : comments.length > 0
                  ? comments.map(c => (
                      <CommentItem key={c._id} comment={c} onDelete={handleDeleteComment} currentUserId={user?._id || user?.id} />
                    ))
                  : <p className="text-gray-500 text-sm">No comments yet. Be the first!</p>
              }
            </div>
          </section>
        </div>

        {/* ── Right: Related Videos ── */}
        <aside className="flex flex-col gap-4">
          <h2 className="text-lg font-bold text-white">Up Next</h2>
          {relatedVideos.length > 0
            ? relatedVideos.map(rv => (
                <Link
                  key={rv.id}
                  to={`/watch/${rv.id}`}
                  className="group flex gap-3 bg-[#151923] rounded-xl p-2 border border-white/5 hover:border-cyan-400/40 transition-colors"
                >
                  <div className="relative w-36 aspect-video rounded-lg overflow-hidden shrink-0">
                    <img
                      src={rv.thumbnail}
                      alt={rv.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=V&background=1A1F2B&color=fff`; }}
                    />
                    {rv.duration && (
                      <span className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] px-1.5 py-0.5 rounded font-medium">
                        {rv.duration}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 py-1">
                    <h3 className="text-sm font-semibold text-white line-clamp-2 group-hover:text-cyan-300 transition-colors leading-snug">{rv.title}</h3>
                    <p className="text-xs text-gray-400 mt-1">{rv.creator}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{rv.views} views · {rv.timeAgo}</p>
                  </div>
                </Link>
              ))
            : <p className="text-gray-500 text-sm">No related videos found.</p>
          }
        </aside>
      </div>
    </div>
  );
}

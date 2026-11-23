import { VideoTile } from '../../cinema/Catalog';
import {StartParty} from "../Features/Community";
import { WatchActions, ReportContent } from './WatchActions';
import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';

import { videoService } from '../../services/videoService';
import { interactionService } from '../../services/interactionService';
import { channelService } from '../../services/channelService';
import { useAuth } from '../../hooks/useAuth';
import { VideoPlayer } from '../../components/common/VideoPlayer/VideoPlayer';

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

const CommentItem = ({ comment, onDelete, currentUserId, isVideoOwner }) => {
  const [deleting, setDeleting] = useState(false);
  const canDelete = comment.authorId?._id === currentUserId || isVideoOwner;

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDelete(comment._id);
    } finally {
      setDeleting(false);
    }
  };

  return (
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
          {isVideoOwner && comment.authorId?._id !== currentUserId && (
            <span className="text-[10px] px-1.5 py-0.5 bg-[#806632]/20 text-[#d6b36a] rounded-full border border-[#d6b36a]/30">moderated</span>
          )}
        </div>
        <p className="text-gray-300 text-sm leading-relaxed">{comment.body}</p>
          {currentUserId && comment.authorId?._id !== currentUserId && <ReportContent kind="comment" targetId={comment._id} />}
      </div>
      {canDelete && (
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-gray-500 hover:text-red-400 disabled:opacity-50"
          aria-label="Delete comment"
        >
          {deleting ? (
            <div className="w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          )}
        </button>
      )}
    </div>
  );
};

export default function WatchVideo() {
  const { videoId } = useParams();
  const [searchParams] = useSearchParams();
  const feedId = searchParams.get('feedId');
  const feedPosition = searchParams.has('pos') ? Number(searchParams.get('pos')) : null;
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
  const [startPosition, setStartPosition] = useState(0);

  // Comments
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);

  // Channel
  const [channel, setChannel] = useState(null);

  // Delete video state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Comment error
  const [commentError, setCommentError] = useState('');

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
          interactionService.getInteractionStatus(videoId).then(d => {
            setSavedWatchLater(!!d.watchLater);
            setLiked(!!d.liked);
            setDisliked(!!d.disliked);
            if (d.lastWatchedPosition > 0) {
              setStartPosition(d.lastWatchedPosition);
            }
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

  // Determine if current user owns this video's channel
  const isVideoOwner = channel && user && channel.ownerId
    ? channel.ownerId === (user._id || user.id)
    : false;

  const handleDeleteVideo = async () => {
    if (deleting) return; // prevent duplicate requests
    setDeleting(true);
    setDeleteError('');
    try {
      await videoService.deleteVideo(videoId);
      setShowDeleteModal(false);
      navigate('/channel'); // redirect after successful deletion
    } catch (err) {
      setDeleteError(err.message || 'Failed to delete video. Please try again.');
      setDeleting(false);
    }
  };

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
    setCommentError('');
    try {
      const newComment = await interactionService.addComment(videoId, commentText);
      setComments(prev => [newComment, ...prev]);
      setCommentText('');
    } catch (err) {
      setCommentError(err.message || 'Failed to post comment.');
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    try {
      await interactionService.deleteComment(commentId);
      setComments(prev => prev.filter(c => c._id !== commentId));
    } catch (err) { console.error(err); }
  };


  if (loading || error || !video) return <main className="folio" role="status">{error || (loading?'Loading video…':'Video unavailable.')}</main>;
  return <main className="screening">
    <section aria-label="Video player" className="projection"><VideoPlayer key={videoId+':'+(user?._id||'guest')} trackHistory={Boolean(user)} feedId={feedId} feedPosition={feedPosition} videoId={videoId} title={video.title} thumbnailUrl={video.thumbnail} storyboard={video.storyboard} hlsUrl={video.hlsUrl} mp4Url={video.mp4Url} duration={video.duration} startPosition={startPosition}/></section>
    <div className="program"><article><h1>{video.title}</h1><div className="rail"><Link to={'/channel/'+video.channelId}>{channel?.name||video.creator}</Link><span>{views} views</span><button onClick={handleToggleSubscribe}>{subscribed?'Unsubscribe':'Subscribe'}</button></div>
    <div className="rail"><button aria-pressed={liked} onClick={handleLike}>Like · {likes}</button><button aria-pressed={disliked} onClick={handleDislike}>Dislike · {dislikes}</button><button aria-pressed={savedWatchLater} onClick={handleToggleWatchLater}>{savedWatchLater?'Saved':'Watch later'}</button>{user&&<StartParty videoId={videoId}/>}</div>
    <p>{video.description}</p>{user&&<WatchActions videoId={videoId} channelId={video.channelId} isVideoOwner={isVideoOwner}/>}
    {isVideoOwner&&<button onClick={()=>{if(window.confirm('Delete this video?'))handleDeleteVideo()}} disabled={deleting}>Delete video</button>}{deleteError&&<p role="alert">{deleteError}</p>}
    <section><h2>Discussion</h2><form className="rail" onSubmit={handleAddComment}><input className="input-control" aria-label="Comment" placeholder="Write a comment" value={commentText} onChange={e=>setCommentText(e.target.value)} required/><button disabled={commentSubmitting}>Post</button></form>
    {commentError&&<p role="alert">{commentError}</p>}{commentsLoading?'Loading comments…':comments.length?comments.map(c=><CommentItem key={c._id} comment={c} currentUserId={user?._id||user?.id} isVideoOwner={isVideoOwner} onDelete={handleDeleteComment}/>):'No comments yet.'}</section></article>
    <aside><h2>Watch next</h2>{relatedVideos.map(v=><VideoTile key={v.id} video={v}/>)}</aside></div></main>
}

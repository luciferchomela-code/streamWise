import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Navbar } from '../../components/layout/Navbar/Navbar';
import { Sidebar } from '../../components/layout/Sidebar/Sidebar';
import { interactionService } from '../../services/interactionService';
import { useAuth } from '../../hooks/useAuth';

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

const formatNumber = (n) => {
  if (!n) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
};

export default function WatchLater() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    fetchWatchLater();
  }, [user]);

  const fetchWatchLater = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await interactionService.getWatchLater();
      setVideos(res.videos || []);
    } catch (err) {
      setError(err.message || 'Failed to load Watch Later list.');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (e, videoId) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await interactionService.toggleWatchLater(videoId);
      setVideos((prev) => prev.filter((v) => (v._id || v.id) !== videoId));
    } catch (err) {
      console.error('Failed to remove video from Watch Later:', err);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0B0D12] text-white flex flex-col">
        <Navbar />
        <div className="flex-1 flex">
          <Sidebar />
          <main className="flex-1 lg:pl-64 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-20 h-20 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(6,182,212,0.15)]">
              <svg className="w-10 h-10 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold mb-2">Save videos to watch later</h1>
            <p className="text-gray-400 max-w-md mb-6">Sign in to save your favorite videos and view them whenever you want.</p>
            <Link to="/login" className="px-6 py-2.5 bg-gradient-to-r from-violet-500 to-cyan-500 text-white font-medium rounded-full hover:opacity-90 transition-opacity">
              Sign In Now
            </Link>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0D12] text-white flex flex-col font-sans">
      <Navbar />
      <div className="flex-1 flex">
        <Sidebar />

        <main className="flex-1 lg:pl-64 p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto w-full">
          
          {/* Hero Banner */}
          <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-violet-900/40 via-purple-900/20 to-cyan-900/40 border border-white/10 p-6 sm:p-8 mb-8 backdrop-blur-md shadow-2xl">
            <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 -mb-8 -ml-8 w-64 h-64 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-5">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-violet-500 to-cyan-400 flex items-center justify-center shadow-[0_0_25px_rgba(139,92,246,0.4)] shrink-0">
                  <svg className="w-8 h-8 sm:w-10 sm:h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-1">Watch Later</h1>
                  <p className="text-sm text-gray-400">
                    {user?.name ? `${user.name}'s saved collection` : 'Your saved playlist'} • {videos.length} {videos.length === 1 ? 'video' : 'videos'}
                  </p>
                </div>
              </div>

              {videos.length > 0 && (
                <button
                  onClick={() => navigate(`/watch/${videos[0]._id || videos[0].id}`)}
                  className="flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 text-white font-semibold text-sm shadow-[0_0_20px_rgba(139,92,246,0.3)] hover:brightness-110 transition-all active:scale-95 self-start md:self-auto"
                >
                  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  Play All
                </button>
              )}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-3">
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Videos Grid */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {Array(8).fill(0).map((_, i) => (
                <div key={i} className="bg-[#151923] rounded-2xl p-3 border border-white/5 animate-pulse space-y-3">
                  <div className="aspect-video w-full rounded-xl bg-white/5" />
                  <div className="h-4 bg-white/5 rounded w-3/4" />
                  <div className="h-3 bg-white/5 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : videos.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {videos.map((vid) => {
                const vidId = vid._id || vid.id;
                const ch = vid.channelId;
                const channelName = ch?.name || 'Channel';
                const channelImg = ch?.image;

                return (
                  <div
                    key={vidId}
                    className="group relative bg-[#151923] rounded-2xl overflow-hidden border border-white/5 hover:border-cyan-400/40 transition-all duration-300 flex flex-col shadow-lg hover:shadow-cyan-500/5"
                  >
                    {/* Thumbnail */}
                    <Link to={`/watch/${vidId}`} className="relative aspect-video w-full overflow-hidden bg-black/40 block">
                      <img
                        src={vid.thumbnailUrl}
                        alt={vid.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        onError={(e) => { e.target.src = 'https://ui-avatars.com/api/?name=V&background=151923&color=fff'; }}
                      />
                      {vid.duration && (
                        <span className="absolute bottom-2 right-2 bg-black/80 backdrop-blur-sm text-white text-xs px-2 py-0.5 rounded-md font-medium">
                          {Math.floor(vid.duration / 60)}:{String(vid.duration % 60).padStart(2, '0')}
                        </span>
                      )}
                      
                      {/* Play Hover Overlay */}
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="w-12 h-12 rounded-full bg-cyan-400/90 text-black flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
                          <svg className="w-6 h-6 fill-current ml-0.5" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </div>
                      </div>
                    </Link>

                    {/* Content */}
                    <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <Link to={`/watch/${vidId}`} className="font-semibold text-white text-sm line-clamp-2 hover:text-cyan-300 transition-colors leading-snug">
                            {vid.title}
                          </Link>

                          {/* Remove Button */}
                          <button
                            onClick={(e) => handleRemove(e, vidId)}
                            title="Remove from Watch Later"
                            className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-white/5 rounded-lg transition-colors shrink-0"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>

                        {ch && (
                          <Link to={`/channel/${ch._id}`} className="mt-2 flex items-center gap-2 text-xs text-gray-400 hover:text-white transition-colors">
                            <img
                              src={channelImg || `https://ui-avatars.com/api/?name=${channelName}&background=151923&color=fff`}
                              alt={channelName}
                              className="w-5 h-5 rounded-full object-cover border border-white/10"
                            />
                            <span className="truncate">{channelName}</span>
                          </Link>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-white/5">
                        <span>{formatNumber(vid.views)} views</span>
                        <span>{formatTimeAgo(vid.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-20 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-4 text-gray-500">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold mb-2">No videos saved yet</h2>
              <p className="text-gray-400 max-w-sm mb-6 text-sm">Save videos to watch them later by clicking the bookmark or Save button on any video.</p>
              <Link to="/" className="px-6 py-2.5 bg-gradient-to-r from-violet-500 to-cyan-500 text-white font-medium rounded-full text-sm hover:opacity-90 transition-opacity">
                Explore Videos
              </Link>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}

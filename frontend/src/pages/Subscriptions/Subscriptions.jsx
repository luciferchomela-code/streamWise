import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Navbar } from '../../components/layout/Navbar/Navbar';
import { Sidebar } from '../../components/layout/Sidebar/Sidebar';
import { channelService } from '../../services/channelService';
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

export default function Subscriptions() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [channels, setChannels] = useState([]);
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('videos'); // 'videos' | 'channels'

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    fetchSubscriptionsData();
  }, [user]);

  const fetchSubscriptionsData = async () => {
    setLoading(true);
    setError('');
    try {
      const [channelsRes, videosRes] = await Promise.all([
        channelService.getMySubscriptions().catch(() => ({ channels: [] })),
        channelService.getSubscribedVideos().catch(() => ({ videos: [] })),
      ]);

      setChannels(channelsRes.channels || []);
      setVideos(videosRes.videos || []);
    } catch (err) {
      setError(err.message || 'Failed to load subscriptions data.');
    } finally {
      setLoading(false);
    }
  };

  const handleUnsubscribe = async (e, channelId) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await channelService.unsubscribe(channelId);
      setChannels((prev) => prev.filter((c) => (c._id || c.id) !== channelId));
      setVideos((prev) => prev.filter((v) => (v.channelId?._id || v.channelId) !== channelId));
    } catch (err) {
      console.error('Unsubscribe error:', err);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0B0D12] text-white flex flex-col">
        <Navbar />
        <div className="flex-1 flex">
          <Sidebar />
          <main className="flex-1 lg:pl-64 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-20 h-20 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(139,92,246,0.15)]">
              <svg className="w-10 h-10 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold mb-2">Don't miss videos from favorite creators</h1>
            <p className="text-gray-400 max-w-md mb-6">Sign in to subscribe to channels and see the latest updates here.</p>
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

          {/* Header Banner */}
          <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-violet-950/60 via-purple-900/30 to-indigo-950/60 border border-white/10 p-6 sm:p-8 mb-8 backdrop-blur-md shadow-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-1">Subscriptions</h1>
                <p className="text-sm text-gray-400">
                  Stay updated with new content from the {channels.length} {channels.length === 1 ? 'channel' : 'channels'} you follow
                </p>
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-2 bg-[#151923] p-1.5 rounded-full border border-white/10 self-start sm:self-auto">
                <button
                  onClick={() => setActiveTab('videos')}
                  className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all ${
                    activeTab === 'videos'
                      ? 'bg-violet-500 text-white shadow-lg shadow-violet-500/30'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Latest Videos
                </button>
                <button
                  onClick={() => setActiveTab('channels')}
                  className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all ${
                    activeTab === 'channels'
                      ? 'bg-violet-500 text-white shadow-lg shadow-violet-500/30'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Channels ({channels.length})
                </button>
              </div>
            </div>

            {/* Subscribed Channels Bar */}
            {channels.length > 0 && (
              <div className="mt-6 pt-6 border-t border-white/10 flex items-center gap-4 overflow-x-auto no-scrollbar pb-2">
                {channels.map((ch) => {
                  const chId = ch._id || ch.id;
                  return (
                    <Link
                      key={chId}
                      to={`/channel/${chId}`}
                      className="group flex flex-col items-center gap-2 shrink-0 w-20 text-center focus:outline-none"
                    >
                      <div className="relative w-14 h-14 rounded-full overflow-hidden border-2 border-violet-500/50 group-hover:border-cyan-400 transition-colors p-0.5 shadow-md">
                        <img
                          src={ch.image || `https://ui-avatars.com/api/?name=${ch.name}&background=151923&color=fff`}
                          alt={ch.name}
                          className="w-full h-full rounded-full object-cover"
                        />
                      </div>
                      <span className="text-xs text-gray-300 group-hover:text-white font-medium truncate w-full">
                        {ch.name}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-3">
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Main Content */}
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
          ) : activeTab === 'videos' ? (
            /* Videos Feed */
            videos.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {videos.map((vid) => {
                  const vidId = vid._id || vid.id;
                  const ch = vid.channelId;
                  const channelName = typeof ch === 'object' ? ch?.name : 'Channel';
                  const channelImg = typeof ch === 'object' ? ch?.image : null;
                  const channelIdStr = typeof ch === 'object' ? ch?._id : ch;

                  return (
                    <div
                      key={vidId}
                      className="group relative bg-[#151923] rounded-2xl overflow-hidden border border-white/5 hover:border-violet-500/40 transition-all duration-300 flex flex-col shadow-lg hover:shadow-violet-500/5"
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
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <div className="w-12 h-12 rounded-full bg-violet-500/90 text-white flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
                            <svg className="w-6 h-6 fill-current ml-0.5" viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          </div>
                        </div>
                      </Link>

                      {/* Info */}
                      <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                        <div>
                          <Link to={`/watch/${vidId}`} className="font-semibold text-white text-sm line-clamp-2 hover:text-violet-300 transition-colors leading-snug">
                            {vid.title}
                          </Link>

                          {channelIdStr && (
                            <Link to={`/channel/${channelIdStr}`} className="mt-2 flex items-center gap-2 text-xs text-gray-400 hover:text-white transition-colors">
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
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold mb-2">No new videos</h2>
                <p className="text-gray-400 max-w-sm mb-6 text-sm">Channels you subscribe to haven't posted any videos recently or you haven't subscribed to any creators yet.</p>
                <Link to="/" className="px-6 py-2.5 bg-gradient-to-r from-violet-500 to-cyan-500 text-white font-medium rounded-full text-sm hover:opacity-90 transition-opacity">
                  Discover Creators
                </Link>
              </div>
            )
          ) : (
            /* Subscribed Channels List */
            channels.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {channels.map((ch) => {
                  const chId = ch._id || ch.id;
                  return (
                    <div
                      key={chId}
                      className="bg-[#151923] rounded-2xl p-6 border border-white/5 hover:border-violet-500/40 transition-all flex items-center justify-between gap-4 shadow-lg"
                    >
                      <Link to={`/channel/${chId}`} className="flex items-center gap-4 min-w-0 flex-1 group">
                        <img
                          src={ch.image || `https://ui-avatars.com/api/?name=${ch.name}&background=151923&color=fff`}
                          alt={ch.name}
                          className="w-14 h-14 rounded-full object-cover border border-white/10 group-hover:border-cyan-400 transition-colors shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <h3 className="font-bold text-white text-base truncate group-hover:text-cyan-300 transition-colors">
                            {ch.name}
                          </h3>
                          <p className="text-xs text-gray-400 truncate">@{ch.handle || ch.name.toLowerCase().replace(/\s+/g, '')}</p>
                          <p className="text-xs text-gray-500 mt-1">{formatNumber(ch.subscribersCount)} subscribers</p>
                        </div>
                      </Link>

                      <button
                        onClick={(e) => handleUnsubscribe(e, chId)}
                        className="px-4 py-2 bg-white/5 hover:bg-red-500/20 text-gray-300 hover:text-red-400 border border-white/10 hover:border-red-500/30 text-xs font-semibold rounded-full transition-all shrink-0"
                      >
                        Subscribed
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-20 flex flex-col items-center justify-center text-center">
                <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-4 text-gray-500">
                  <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold mb-2">No subscriptions yet</h2>
                <p className="text-gray-400 max-w-sm mb-6 text-sm">Subscribe to channels to see their latest videos and updates right here.</p>
                <Link to="/" className="px-6 py-2.5 bg-gradient-to-r from-violet-500 to-cyan-500 text-white font-medium rounded-full text-sm hover:opacity-90 transition-opacity">
                  Explore Channels
                </Link>
              </div>
            )
          )}

        </main>
      </div>
    </div>
  );
}

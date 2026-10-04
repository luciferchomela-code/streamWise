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
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
};

const formatDuration = (seconds) => {
  if (!seconds) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
};

const formatNumber = (n) => {
  if (!n) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
};

const HistorySkeleton = () => (
  <div className="flex gap-4 animate-pulse">
    <div className="w-40 sm:w-48 aspect-video rounded-xl bg-white/5 shrink-0" />
    <div className="flex-1 flex flex-col gap-2 py-1">
      <div className="h-4 bg-white/5 rounded w-3/4" />
      <div className="h-3 bg-white/5 rounded w-1/2" />
      <div className="h-3 bg-white/5 rounded w-1/3" />
    </div>
  </div>
);

export default function History() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    fetchHistory(1);
  }, [user]);

  const fetchHistory = async (p) => {
    setLoading(true);
    setError('');
    try {
      const res = await interactionService.getHistory(p, 20);
      if (p === 1) {
        setHistory(res.history || []);
      } else {
        setHistory((prev) => [...prev, ...(res.history || [])]);
      }
      setPage(p);
      setTotalPages(res.totalPages || 1);
      setTotal(res.total || 0);
    } catch (err) {
      setError(err.message || 'Failed to load watch history.');
    } finally {
      setLoading(false);
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold mb-2">Sign in to see your watch history</h1>
            <p className="text-gray-400 max-w-md mb-6">Videos you watch will appear here so you can easily find them again.</p>
            <Link to="/login" className="px-6 py-2.5 bg-gradient-to-r from-violet-500 to-cyan-500 text-white font-medium rounded-full hover:opacity-90 transition-opacity">
              Sign In
            </Link>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0D12] text-white font-sans flex flex-col">
      <Navbar />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 lg:pl-64 p-4 sm:p-6 lg:p-8 max-w-[1200px] mx-auto w-full">

          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-500/20 flex items-center justify-center shadow-[0_0_20px_rgba(139,92,246,0.2)]">
                <svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Watch History</h1>
            </div>
            {total > 0 && <p className="text-gray-400 ml-[52px]">{total} video{total !== 1 ? 's' : ''} watched</p>}
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
          )}

          {/* History List */}
          <div className="flex flex-col gap-3">
            {loading && history.length === 0
              ? Array(6).fill(0).map((_, i) => <HistorySkeleton key={i} />)
              : history.length === 0
                ? (
                  <div className="flex flex-col items-center justify-center py-24 text-center">
                    <div className="w-20 h-20 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
                      <svg className="w-10 h-10 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <p className="text-gray-400 text-lg font-medium">No watch history yet</p>
                    <p className="text-gray-600 text-sm mt-1">Videos you watch will appear here</p>
                    <Link to="/" className="mt-6 px-5 py-2 bg-gradient-to-r from-violet-500 to-cyan-500 text-white font-medium rounded-full text-sm hover:opacity-90 transition-opacity">
                      Browse Videos
                    </Link>
                  </div>
                )
                : history.map((video) => {
                  const id = video._id || video.id;
                  const chName = typeof video.channelId === 'object' ? video.channelId?.name : null;
                  const pct = video.watchPercentage || 0;
                  return (
                    <Link
                      to={`/watch/${id}`}
                      key={id}
                      className="group flex flex-col sm:flex-row gap-4 p-3 rounded-2xl bg-[#151923] border border-white/5 hover:border-white/10 hover:bg-[#1a2030] transition-all duration-300"
                    >
                      {/* Thumbnail */}
                      <div className="relative w-full sm:w-48 md:w-56 aspect-video rounded-xl overflow-hidden shrink-0">
                        <img
                          src={video.thumbnailUrl || `https://ui-avatars.com/api/?name=V&background=1A1F2B&color=fff`}
                          alt={video.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=V&background=1A1F2B&color=fff`; }}
                        />
                        {video.duration && (
                          <span className="absolute bottom-1.5 right-1.5 bg-black/80 text-white text-[10px] px-1.5 py-0.5 rounded font-medium">
                            {formatDuration(video.duration)}
                          </span>
                        )}
                        {/* Thumbnail Progress Bar */}
                        {pct > 0 && (
                          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                            <div className="h-full bg-gradient-to-r from-violet-500 to-cyan-400" style={{ width: `${Math.min(pct, 100)}%` }} />
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0 py-1 flex flex-col justify-between">
                        <div>
                          <h3 className="font-semibold text-white text-sm sm:text-base line-clamp-2 group-hover:text-cyan-300 transition-colors leading-snug">
                            {video.title}
                          </h3>
                          <p className="text-gray-400 text-xs mt-1">{video.creator || chName || 'Channel'}</p>
                          <p className="text-gray-500 text-xs mt-0.5">
                            {formatNumber(video.views)} views · {formatTimeAgo(video.lastViewedAt)}
                          </p>
                        </div>
                        {pct > 0 && (
                          <div className="mt-3 flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                              <div className="h-full bg-gradient-to-r from-violet-500 to-cyan-400 rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
                            </div>
                            <span className="text-xs text-gray-500 whitespace-nowrap">{Math.round(pct)}% watched</span>
                          </div>
                        )}
                      </div>
                    </Link>
                  );
                })
            }
          </div>

          {/* Load More */}
          {!loading && page < totalPages && (
            <div className="flex justify-center mt-8">
              <button
                onClick={() => fetchHistory(page + 1)}
                className="px-6 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm font-medium rounded-full transition-all"
              >
                Load More
              </button>
            </div>
          )}

          {loading && history.length > 0 && (
            <div className="flex justify-center mt-6">
              <div className="w-6 h-6 border-2 border-violet-500/40 border-t-violet-500 rounded-full animate-spin" />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

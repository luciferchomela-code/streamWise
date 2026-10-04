import React from 'react';

import { Link } from 'react-router-dom';

export const HeroCard = ({ video, isContinueWatching }) => {
  if (!video) return null;
  
  const id = video._id || video.id;
  const pct = video.watchPercentage || 0;
  
  const formatDuration = (seconds) => {
    if (!seconds) return '';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="relative w-full rounded-2xl overflow-hidden group focus-within:ring-2 focus-within:ring-cyan-400/50 mt-6 md:mt-8">
      {/* Background Image & Overlay */}
      <div className="absolute inset-0 z-0">
        <img 
          src={video.thumbnailUrl || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop"} 
          alt={video.title} 
          className="w-full h-full object-cover opacity-60 scale-105 group-hover:scale-100 transition-transform duration-700 ease-out"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B0D12] via-[#0B0D12]/80 to-transparent mix-blend-multiply" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0B0D12] via-[#0B0D12]/60 to-transparent" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col justify-end min-h-[300px] md:min-h-[400px] p-6 sm:p-8 lg:p-12 h-full">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 mb-3">
            {isContinueWatching ? (
                <span className="px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-cyan-400 bg-cyan-400/10 rounded-md border border-cyan-400/20">
                  Continue Watching
                </span>
            ) : (
                <span className="px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-red-400 bg-red-400/10 rounded-md border border-red-400/20">
                  Trending
                </span>
            )}
            {video.duration && (
                <span className="text-gray-400 text-sm font-medium">
                  {formatDuration(video.duration)}
                </span>
            )}
          </div>
          
          <h2 className="text-2xl sm:text-4xl md:text-5xl font-bold text-white mb-3 sm:mb-4 leading-tight group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-gray-400 transition-all line-clamp-2">
            {video.title}
          </h2>
          
          <p className="text-gray-300 text-sm md:text-base mb-6 md:mb-8 max-w-2xl line-clamp-2">
            {video.description || "No description available."}
          </p>

          {/* Progress Bar */}
          {isContinueWatching && pct > 0 && (
              <div className="w-full max-w-md h-1.5 bg-white/10 rounded-full mb-6 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-violet-500 to-cyan-400 rounded-full shadow-[0_0_10px_rgba(34,211,238,0.5)]" style={{ width: `${Math.min(pct, 100)}%` }} />
              </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <Link to={`/watch/${id}`} className="flex items-center gap-2 px-6 py-3 bg-white text-[#0B0D12] rounded-xl font-semibold hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-400/70">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              {isContinueWatching ? 'Resume' : 'Watch Now'}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

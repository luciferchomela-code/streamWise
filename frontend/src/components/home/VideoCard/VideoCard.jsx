import React from 'react';
import { Link } from 'react-router-dom';

export const VideoCard = ({ 
  id,
  thumbnail, 
  title, 
  creator, 
  duration, 
  views, 
  timeAgo, 
  reason,
  rank,
  orientation = 'vertical' // 'vertical' | 'horizontal'
}) => {
  const isHorizontal = orientation === 'horizontal';

  return (
    <Link
      to={id ? `/watch/${id}` : '#'}
      className={`group flex ${isHorizontal ? 'flex-col sm:flex-row gap-4' : 'flex-col gap-3'} rounded-2xl cursor-pointer focus-within:ring-2 focus-within:ring-cyan-400/50 outline-none no-underline`}
    >
      {/* Thumbnail Area */}
      <div className={`relative overflow-hidden rounded-2xl bg-[#151923] shrink-0 ${isHorizontal ? 'w-full sm:w-64 md:w-72 lg:w-80 aspect-video' : 'w-full aspect-video'}`}>
        <img 
          src={thumbnail || "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=2070&auto=format&fit=crop"} 
          alt={title} 
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=2070&auto=format&fit=crop'; }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B0D12]/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        
        {duration && (
          <div className="absolute bottom-2 right-2 bg-black/80 backdrop-blur-md px-1.5 py-0.5 rounded text-xs font-medium text-white border border-white/10">
            {duration}
          </div>
        )}

        {/* Play Indicator */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="w-8 h-8 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center border border-white/10">
            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>

        {rank && (
          <div className="absolute top-0 left-0 w-10 h-10 bg-gradient-to-br from-violet-600 to-cyan-500 rounded-br-2xl flex items-center justify-center font-bold text-lg text-white shadow-lg shadow-black/50 border-r border-b border-white/10">
            #{rank}
          </div>
        )}
      </div>

      {/* Info Area */}
      <div className={`flex flex-col ${isHorizontal ? 'justify-center py-2' : ''}`}>
        {reason && (
          <div className="text-xs font-semibold text-cyan-400 mb-1.5 uppercase tracking-wide">
            {reason}
          </div>
        )}
        
        <h3 className="text-white font-semibold text-base md:text-lg leading-snug line-clamp-2 group-hover:text-cyan-300 transition-colors">
          {title}
        </h3>
        
        <div className="mt-2 text-sm text-gray-400 font-medium">
          <div className="hover:text-gray-200 transition-colors">{creator}</div>
          <div className="flex items-center gap-1.5 mt-0.5 text-xs sm:text-sm">
            <span>{views} views</span>
            {timeAgo && (
              <>
                <span className="w-1 h-1 rounded-full bg-gray-600" />
                <span>{timeAgo}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
};

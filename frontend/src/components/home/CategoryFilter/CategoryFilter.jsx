import React, { useState } from 'react';

const categories = [
  'For You',
  'Learn',
  'Technology',
  'Design',
  'Stories',
  'Music',
  'Gaming',
  'Trending'
];

export const CategoryFilter = () => {
  const [active, setActive] = useState('For You');

  return (
    <div className="w-full py-4 px-4 sm:px-6 lg:px-8 border-b border-white/5 bg-[#0B0D12] sticky top-16 z-40">
      <div className="max-w-[1600px] mx-auto flex items-center gap-3 overflow-x-auto no-scrollbar pb-1 -mb-1">
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => setActive(category)}
            className={`whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 ${
              active === category
                ? 'bg-white text-[#0B0D12] shadow-[0_0_10px_rgba(255,255,255,0.3)]'
                : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/5'
            }`}
          >
            {category}
          </button>
        ))}
      </div>
    </div>
  );
};

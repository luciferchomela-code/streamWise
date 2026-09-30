import React from 'react';

const creators = [
  { id: 1, name: 'Fireship', topic: 'Technology', avatar: 'https://ui-avatars.com/api/?name=Fireship&background=22D3EE&color=fff' },
  { id: 2, name: 'Marques Brownlee', topic: 'Tech Reviews', avatar: 'https://ui-avatars.com/api/?name=MB&background=8B5CF6&color=fff' },
  { id: 3, name: 'DesignCourse', topic: 'Design', avatar: 'https://ui-avatars.com/api/?name=DC&background=EC4899&color=fff' },
  { id: 4, name: 'Kevin Powell', topic: 'Web Dev', avatar: 'https://ui-avatars.com/api/?name=KP&background=10B981&color=fff' },
  { id: 5, name: 'Theo', topic: 'Engineering', avatar: 'https://ui-avatars.com/api/?name=T&background=F59E0B&color=fff' },
  { id: 6, name: 'Hyperplexed', topic: 'Creative Coding', avatar: 'https://ui-avatars.com/api/?name=H&background=6366F1&color=fff' }
];

export const CreatorsRow = () => {
  return (
    <section className="my-12">
      <h2 className="text-xl md:text-2xl font-bold text-white mb-6">Rising Creators</h2>
      <div className="flex gap-4 sm:gap-6 overflow-x-auto no-scrollbar pb-4 -mx-4 px-4 sm:mx-0 sm:px-0">
        {creators.map((creator) => (
          <div key={creator.id} className="flex flex-col items-center min-w-[120px] md:min-w-[140px] group focus-within:ring-2 focus-within:ring-cyan-400/50 rounded-xl outline-none p-2">
            <div className="relative w-20 h-20 md:w-24 md:h-24 rounded-full overflow-hidden mb-3 border-2 border-transparent group-hover:border-cyan-400 transition-colors p-1">
              <div className="w-full h-full rounded-full overflow-hidden">
                <img src={creator.avatar} alt={creator.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
              </div>
            </div>
            <h4 className="text-white text-sm font-semibold text-center line-clamp-1">{creator.name}</h4>
            <p className="text-gray-400 text-xs text-center mb-3 line-clamp-1">{creator.topic}</p>
            <button className="px-4 py-1.5 rounded-full bg-white/10 text-white text-xs font-semibold hover:bg-white hover:text-[#0B0D12] transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-400/70 border border-white/5">
              Follow
            </button>
          </div>
        ))}
      </div>
    </section>
  );
};

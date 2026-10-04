import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Navbar } from '../../components/layout/Navbar/Navbar';
import { CategoryFilter } from '../../components/home/CategoryFilter/CategoryFilter';
import { HeroCard } from '../../components/home/HeroCard/HeroCard';
import { VideoCard } from '../../components/home/VideoCard/VideoCard';
import { CreatorsRow } from '../../components/home/CreatorsRow/CreatorsRow';
import { videoService } from '../../services/videoService';
import { interactionService } from '../../services/interactionService';
import { useAuth } from '../../hooks/useAuth';

const VideoSkeleton = () => (
  <div className="flex flex-col gap-3 animate-pulse">
    <div className="aspect-video rounded-xl bg-white/5"></div>
    <div className="h-4 bg-white/5 rounded w-3/4"></div>
    <div className="h-3 bg-white/5 rounded w-1/2"></div>
  </div>
);

const EmptyState = ({ message }) => (
  <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
    <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
      <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    </div>
    <p className="text-gray-400">{message}</p>
  </div>
);

const formatDuration = (seconds) => {
  if (!seconds) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
};

export const Home = () => {
  const { user } = useAuth();
  const [trendingVideos, setTrendingVideos] = useState([]);
  const [popularVideos, setPopularVideos] = useState([]);
  const [trendingLoading, setTrendingLoading] = useState(true);
  const [popularLoading, setPopularLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [isSearchMode, setIsSearchMode] = useState(false);

  // Continue Watching
  const [continueWatching, setContinueWatching] = useState([]);

  useEffect(() => {
    const fetchTrending = async () => {
      try {
        const data = await videoService.getTrending({ limit: 8 });
        setTrendingVideos(data.videos || []);
      } catch (err) {
        console.error('Failed to fetch trending:', err);
      } finally {
        setTrendingLoading(false);
      }
    };

    const fetchPopular = async () => {
      try {
        const data = await videoService.getPopular({ limit: 6 });
        setPopularVideos(data.videos || []);
      } catch (err) {
        console.error('Failed to fetch popular:', err);
      } finally {
        setPopularLoading(false);
      }
    };

    fetchTrending();
    fetchPopular();
  }, []);

  useEffect(() => {
    if (!user) return;
    interactionService.getContinueWatching().then((res) => {
      setContinueWatching(res.continueWatching || []);
    }).catch(() => {});
  }, [user]);

  const handleSearch = async (q) => {
    setSearchQuery(q);
    if (!q.trim()) {
      setIsSearchMode(false);
      setSearchResults([]);
      return;
    }
    setIsSearchMode(true);
    setSearchLoading(true);
    try {
      const data = await videoService.search(q, { limit: 12 });
      setSearchResults(data.videos || []);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setSearchLoading(false);
    }
  };

  const featuredVideo = trendingVideos[0] || null;
  const remainingTrending = trendingVideos.slice(1, 5);
  const mostViewed = popularVideos.slice(0, 4);

  return (
    <div className="w-full min-h-screen bg-[#0B0D12] text-white selection:bg-cyan-400/30 font-sans">
      <Navbar onSearch={handleSearch} />

      <main className="pb-24">
        {!isSearchMode && <CategoryFilter />}

        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">

          {/* ── Search Results ── */}
          {isSearchMode ? (
            <section className="my-8">
              <h2 className="text-xl md:text-2xl font-bold text-white mb-6">
                {searchLoading ? 'Searching...' : `Results for "${searchQuery}"`}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {searchLoading
                  ? Array(8).fill(0).map((_, i) => <VideoSkeleton key={i} />)
                  : searchResults.length > 0
                    ? searchResults.map(video => <VideoCard key={video.id} {...video} />)
                    : <EmptyState message={`No results found for "${searchQuery}"`} />
                }
              </div>
            </section>
          ) : (
            <>
              {/* ── Hero Card ── */}
              {trendingLoading
                ? <div className="w-full aspect-[21/9] max-h-[420px] rounded-2xl bg-white/5 animate-pulse mt-6" />
                : <HeroCard 
                    video={continueWatching.length > 0 ? continueWatching[0] : featuredVideo} 
                    isContinueWatching={continueWatching.length > 0} 
                  />
              }



              {/* ── Trending Now ── */}
              <section className="my-12 md:my-16">
                <h2 className="text-xl md:text-2xl font-bold text-white mb-6 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]"></span>
                  Trending Now
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {trendingLoading
                    ? Array(4).fill(0).map((_, i) => <VideoSkeleton key={i} />)
                    : remainingTrending.length > 0
                      ? remainingTrending.map((video, i) => (
                          <VideoCard key={video.id} {...video} rank={i + 1} />
                        ))
                      : <EmptyState message="No trending videos right now. Check back later!" />
                  }
                </div>
              </section>

              {/* ── Most Viewed & Creators ── */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 xl:gap-12 my-12 md:my-16">
                <section className="xl:col-span-2">
                  <h2 className="text-xl md:text-2xl font-bold text-white mb-6">Most Viewed</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {popularLoading
                      ? Array(4).fill(0).map((_, i) => <VideoSkeleton key={i} />)
                      : popularVideos.slice(0, 4).length > 0
                        ? popularVideos.slice(0, 4).map(video => (
                            <VideoCard key={video.id} {...video} />
                          ))
                        : <EmptyState message="No popular videos yet." />
                    }
                  </div>
                </section>

                <section className="xl:col-span-1">
                  <h2 className="text-xl md:text-2xl font-bold text-white mb-6">Top This Week</h2>
                  <div className="flex flex-col gap-3">
                    {popularLoading
                      ? Array(4).fill(0).map((_, i) => (
                          <div key={i} className="h-20 rounded-xl bg-white/5 animate-pulse" />
                        ))
                      : mostViewed.length > 0
                        ? mostViewed.map(video => (
                            <div
                              key={video.id}
                              className="group flex items-center gap-4 bg-[#151923] rounded-2xl p-3 border border-white/5 hover:border-cyan-400/50 transition-colors cursor-pointer"
                            >
                              <div className="relative w-28 aspect-video rounded-xl overflow-hidden shrink-0">
                                <img
                                  src={video.thumbnail}
                                  alt={video.title}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                  onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=Video&background=1A1F2B&color=fff`; }}
                                />
                              </div>
                              <div className="flex flex-col py-1 min-w-0">
                                <h3 className="text-white font-semibold text-sm leading-snug line-clamp-2 group-hover:text-cyan-300 transition-colors">
                                  {video.title}
                                </h3>
                                <div className="mt-1 text-xs text-gray-400">
                                  <div>{video.creator}</div>
                                  <div className="text-cyan-400 mt-0.5">{video.views} views</div>
                                </div>
                              </div>
                            </div>
                          ))
                        : <EmptyState message="No videos yet." />
                    }
                  </div>
                </section>
              </div>

              <CreatorsRow />
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default Home;


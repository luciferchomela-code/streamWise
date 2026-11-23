import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Navbar } from '../../components/layout/Navbar/Navbar';
import './home-editorial.css';
import { VideoCard } from '../../components/home/VideoCard/VideoCard';

import { normalizeVideo, videoService } from '../../services/videoService';
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

export const Home = () => {
  const { user } = useAuth();
  const [trendingVideos, setTrendingVideos] = useState([]);
  const [popularVideos, setPopularVideos] = useState([]);
  const [trendingLoading, setTrendingLoading] = useState(true);
  const [popularLoading, setPopularLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchVersion = useRef(0);
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
    const version = ++searchVersion.current;
    setSearchQuery(q);
    if (!q.trim()) {
      setIsSearchMode(false);
      setSearchResults([]);
      return;
    }
    setIsSearchMode(true);
    setSearchLoading(true);
    setSearchResults([]);
    try {
      const data = await videoService.search(q, { limit: 12 });
      if (version === searchVersion.current) setSearchResults(data.videos || []);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      if (version === searchVersion.current) setSearchLoading(false);
    }
  };

  const featured = continueWatching[0] ? normalizeVideo(continueWatching[0])
    : trendingVideos[0] || popularVideos[0];
  const trending = trendingVideos.filter(video => video.id !== featured?.id).slice(0, 4);
  const popular = popularVideos.slice(0, 4);
  const shelf = (id, title, videos, loading, empty) => (
    <section id={id} className="sw-shelf" aria-labelledby={id + '-title'}>
      <h2 id={id + '-title'}>{title}</h2>
      <div className="sw-grid">
        {loading ? Array.from({ length: 4 }, (_, i) => <VideoSkeleton key={i} />)
          : videos.length ? videos.map(video => <VideoCard key={video.id} {...video} />)
          : <EmptyState message={empty} />}
      </div>
    </section>
  );

  return (
    <div className="sw-home">
      <Navbar onSearch={handleSearch} />
      <main className="sw-wrap">
        {isSearchMode ? shelf('results', `Results for “${searchQuery}”`, searchResults, searchLoading, 'No matching videos.')
          : <>
            <nav aria-label="Browse videos" className="sw-sections">
              <a href="#discover" aria-current="location">Discover</a>
              <a href="#trending">Trending</a>
              <a href="#popular">Most viewed</a>
              {user && <Link to="/subscriptions">Subscriptions</Link>}
            </nav>
            <section id="discover" className="sw-feature" aria-labelledby="sw-feature-title">
              <div className="sw-feature-copy">
                <p className="sw-eyebrow">{continueWatching.length ? 'Continue watching' : featured ? 'Featured video' : 'Streamwise'}</p>
                <h1 id="sw-feature-title">{featured?.title || 'Find your next watch.'}</h1>
                <p>{featured ? [featured.creator, featured.duration].filter(Boolean).join(' · ') : 'Explore videos from independent creators.'}</p>
                {featured ? <Link className="sw-cta" to={`/watch/${featured.id}`}>{continueWatching.length ? 'Resume video' : 'Watch video'}</Link>
                  : <a className="sw-cta" href="#trending">Browse videos</a>}
              </div>
              <div className="sw-art" aria-hidden="true">
                {featured?.thumbnail ? <img src={featured.thumbnail} alt="" onError={event => { event.currentTarget.hidden = true; }} />
                  : <div className="sw-reel"><i/><i/><i/><i/><span/></div>}
              </div>
            </section>
            {shelf('trending', 'Trending now', trending, trendingLoading, featured ? 'More videos will appear here as they trend.' : 'No trending videos yet.')}
            {shelf('popular', 'Most viewed', popular, popularLoading, 'No popular videos yet.')}
          </>}
      </main>
    </div>
  );
};

export default Home;

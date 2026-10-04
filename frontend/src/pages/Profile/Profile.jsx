import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Sidebar } from '../../components/layout/Sidebar/Sidebar';
import { BottomNav } from '../../components/layout/BottomNav/BottomNav';
import { useAuth } from '../../hooks/useAuth';
import { VideoCard } from '../../components/home/VideoCard/VideoCard';
import { interactionService } from '../../services/interactionService';


export const Profile = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  const [topics, setTopics] = useState(['Technology', 'Design', 'Cinematography']);
  const [recommendationsEnabled, setRecommendationsEnabled] = useState(true);
  const [autoplayEnabled, setAutoplayEnabled] = useState(false);

  // Real data
  const [continueWatching, setContinueWatching] = useState([]);
  const [watchLaterVideos, setWatchLaterVideos] = useState([]);
  const [watchHistory, setWatchHistory] = useState([]);

  useEffect(() => {
    if (!user) return;
    interactionService.getContinueWatching()
      .then(res => setContinueWatching(res.continueWatching || []))
      .catch(() => {});
    interactionService.getWatchLater(1, 6)
      .then(res => setWatchLaterVideos(res.videos || []))
      .catch(() => {});
    interactionService.getHistory(1, 6)
      .then(res => setWatchHistory(res.history || []))
      .catch(() => {});
  }, [user]);

  // Fallback for demo purposes if not logged in
  const displayUser = user || {
    name: 'Streamwise User',
    email: 'user@streamwise.com',
    picture: 'https://ui-avatars.com/api/?name=SU&background=151923&color=fff',
    createdAt: new Date().toISOString()
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const removeTopic = (topicToRemove) => {
    setTopics(topics.filter(t => t !== topicToRemove));
  };

  return (
    <div className="min-h-screen bg-[#0B0D12] text-white font-sans flex">
      <Sidebar />
      
      <main className="flex-1 lg:ml-64 pb-20 lg:pb-8">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
          
          {/* Header */}
          <div className="mb-8 md:mb-12">
            <h1 className="text-3xl md:text-4xl font-bold mb-2">Your Profile</h1>
            <p className="text-gray-400 text-base md:text-lg">Manage your account and personalize your experience.</p>
          </div>

          <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
            
            {/* Left Main Content Column */}
            <div className="flex-1 flex flex-col gap-8 lg:gap-12">
              
              {/* Top Profile Card */}
              <div className="bg-[#151923] border border-white/5 rounded-2xl p-6 sm:p-8 shadow-lg shadow-black/20 flex flex-col sm:flex-row items-center sm:items-start justify-between gap-6">
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left">
                  <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden border-2 border-white/10 shrink-0 shadow-[0_0_20px_rgba(139,92,246,0.15)]">
                    <img src={displayUser.picture || `https://ui-avatars.com/api/?name=${displayUser.name}&background=151923&color=fff`} alt={displayUser.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex flex-col justify-center h-full pt-1">
                    <h2 className="text-2xl sm:text-3xl font-bold">{displayUser.name}</h2>
                    <p className="text-gray-400 text-sm sm:text-base mt-1">{displayUser.email}</p>
                    <p className="text-gray-500 text-xs sm:text-sm mt-3">
                      Joined {new Date(displayUser.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                </div>
                <button className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium transition-colors border border-white/5 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 shrink-0 w-full sm:w-auto">
                  Edit Profile
                </button>
              </div>

              {/* Continue Watching Row */}
              <section>
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                  <svg className="w-5 h-5 text-cyan-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  Continue Watching
                </h3>
                {continueWatching.length > 0 ? (
                  <div className="flex overflow-x-auto no-scrollbar gap-4 sm:gap-6 pb-4 -mx-4 px-4 sm:mx-0 sm:px-0">
                    {continueWatching.map(video => {
                      const id = video._id || video.id;
                      const pct = video.watchPercentage || 0;
                      const chName = typeof video.channelId === 'object' ? video.channelId?.name : null;
                      return (
                        <Link key={id} to={`/watch/${id}`} className="min-w-[80vw] sm:min-w-[300px] md:min-w-[320px] flex flex-col gap-3 group cursor-pointer rounded-xl outline-none">
                          <div className="relative aspect-video rounded-xl overflow-hidden bg-[#151923]">
                            <img src={video.thumbnailUrl || `https://ui-avatars.com/api/?name=V&background=1A1F2B&color=fff`} alt={video.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=V&background=1A1F2B&color=fff`; }}
                            />
                            <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-white/20">
                              <div className="h-full bg-gradient-to-r from-violet-500 to-cyan-400" style={{ width: `${Math.min(pct, 100)}%` }} />
                            </div>
                          </div>
                          <div>
                            <h4 className="text-white font-semibold line-clamp-1 group-hover:text-cyan-300 transition-colors">{video.title}</h4>
                            <p className="text-gray-400 text-sm">{video.creator || chName || 'Channel'}</p>
                            <p className="text-violet-400 text-xs mt-0.5 font-medium">{Math.round(pct)}% watched</p>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                ) : (
                  <div className="bg-[#151923] border border-white/5 rounded-2xl p-8 text-center flex flex-col items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3">
                      <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <p className="text-gray-400">No unfinished videos. Keep watching!</p>
                  </div>
                )}
              </section>

              {/* Watch Later Row */}
              <section>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                    </svg>
                    Watch Later
                  </h3>
                  <Link to="/watch-later" className="text-cyan-400 hover:text-cyan-300 text-sm font-medium transition-colors">View all</Link>
                </div>
                {watchLaterVideos.length > 0 ? (
                  <div className="flex overflow-x-auto no-scrollbar gap-4 sm:gap-6 pb-4 -mx-4 px-4 sm:mx-0 sm:px-0">
                    {watchLaterVideos.map(video => {
                      const id = video._id || video.id;
                      const chName = typeof video.channelId === 'object' ? video.channelId?.name : null;
                      return (
                        <Link key={id} to={`/watch/${id}`} className="min-w-[80vw] sm:min-w-[260px] md:min-w-[280px] flex flex-col gap-3 group cursor-pointer rounded-xl outline-none">
                          <div className="relative aspect-video rounded-xl overflow-hidden bg-[#151923]">
                            <img src={video.thumbnailUrl || `https://ui-avatars.com/api/?name=V&background=1A1F2B&color=fff`} alt={video.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=V&background=1A1F2B&color=fff`; }}
                            />
                          </div>
                          <div>
                            <h4 className="text-white font-semibold line-clamp-2 group-hover:text-cyan-300 transition-colors text-sm leading-snug">{video.title}</h4>
                            <p className="text-gray-400 text-xs mt-0.5">{video.creator || chName || 'Channel'}</p>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                ) : (
                  <div className="bg-[#151923] border border-white/5 rounded-2xl p-10 text-center flex flex-col items-center justify-center shadow-inner">
                    <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4 border border-white/5">
                      <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                      </svg>
                    </div>
                    <h4 className="text-white font-semibold mb-1">Your Watch Later is empty</h4>
                    <p className="text-gray-400 text-sm max-w-sm">Save videos to watch them later or build your personalized collection.</p>
                    <Link to="/" className="mt-4 px-5 py-2 bg-gradient-to-r from-violet-500 to-cyan-500 text-white text-sm font-medium rounded-full hover:opacity-90 transition-opacity">Browse Videos</Link>
                  </div>
                )}
              </section>

              {/* Watch History Row */}
              <section>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Watch History
                  </h3>
                  <Link to="/history" className="text-cyan-400 hover:text-cyan-300 text-sm font-medium transition-colors">View all</Link>
                </div>
                {watchHistory.length > 0 ? (
                  <div className="flex overflow-x-auto no-scrollbar gap-4 sm:gap-6 pb-4 -mx-4 px-4 sm:mx-0 sm:px-0">
                    {watchHistory.map(video => {
                      const id = video._id || video.id;
                      const chName = typeof video.channelId === 'object' ? video.channelId?.name : null;
                      return (
                        <Link key={id} to={`/watch/${id}`} className="min-w-[80vw] sm:min-w-[260px] md:min-w-[280px] flex flex-col gap-3 group cursor-pointer rounded-xl outline-none">
                          <div className="relative aspect-video rounded-xl overflow-hidden bg-[#151923]">
                            <img src={video.thumbnailUrl || `https://ui-avatars.com/api/?name=V&background=1A1F2B&color=fff`} alt={video.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=V&background=1A1F2B&color=fff`; }}
                            />
                            {video.watchPercentage > 0 && (
                               <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-white/20">
                                 <div className="h-full bg-red-500" style={{ width: `${Math.min(video.watchPercentage, 100)}%` }} />
                               </div>
                            )}
                          </div>
                          <div>
                            <h4 className="text-white font-semibold line-clamp-2 group-hover:text-cyan-300 transition-colors text-sm leading-snug">{video.title}</h4>
                            <p className="text-gray-400 text-xs mt-0.5">{video.creator || chName || 'Channel'}</p>
                            {video.lastViewedAt && (
                                <p className="text-gray-500 text-[10px] mt-1">
                                  {new Date(video.lastViewedAt).toLocaleDateString()}
                                </p>
                            )}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                ) : (
                  <div className="bg-[#151923] border border-white/5 rounded-2xl p-10 text-center flex flex-col items-center justify-center shadow-inner">
                    <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4 border border-white/5">
                      <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <h4 className="text-white font-semibold mb-1">Your watch history is empty</h4>
                    <p className="text-gray-400 text-sm max-w-sm">Videos you watch will show up here.</p>
                    <Link to="/" className="mt-4 px-5 py-2 bg-gradient-to-r from-violet-500 to-cyan-500 text-white text-sm font-medium rounded-full hover:opacity-90 transition-opacity">Browse Videos</Link>
                  </div>
                )}
              </section>

            </div>

            {/* Right Side Account Panel */}
            <div className="w-full lg:w-80 xl:w-96 shrink-0 flex flex-col gap-6">
              
              {/* Account Overview */}
              <div className="bg-[#151923] border border-white/5 rounded-2xl p-6 shadow-lg shadow-black/20">
                <h3 className="font-semibold text-lg mb-4 text-white">Overview</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-[#0B0D12] p-4 rounded-xl border border-white/5">
                    <div className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-1">Watched</div>
                    <div className="text-2xl font-bold text-white">24</div>
                    <div className="text-xs text-gray-500 mt-1">This week</div>
                  </div>
                  <div className="bg-[#0B0D12] p-4 rounded-xl border border-white/5">
                    <div className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-1">Saved</div>
                    <div className="text-2xl font-bold text-white">12</div>
                    <div className="text-xs text-gray-500 mt-1">Videos</div>
                  </div>
                  <div className="bg-[#0B0D12] p-4 rounded-xl border border-white/5">
                    <div className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-1">Following</div>
                    <div className="text-2xl font-bold text-white">8</div>
                    <div className="text-xs text-gray-500 mt-1">Creators</div>
                  </div>
                  <div className="bg-gradient-to-br from-violet-500/10 to-cyan-500/10 p-4 rounded-xl border border-cyan-500/20">
                    <div className="text-cyan-400 text-xs font-medium uppercase tracking-wider mb-1">Streak</div>
                    <div className="text-2xl font-bold text-white">5<span className="text-sm font-normal text-gray-400 ml-1">days</span></div>
                  </div>
                </div>
              </div>

              {/* Personalization */}
              <div className="bg-[#151923] border border-white/5 rounded-2xl p-6 shadow-lg shadow-black/20">
                <h3 className="font-semibold text-lg mb-4 text-white">Personalization</h3>
                
                <div className="mb-6">
                  <label className="text-sm text-gray-400 font-medium mb-3 block">Favorite Topics</label>
                  <div className="flex flex-wrap gap-2">
                    {topics.length > 0 ? topics.map(topic => (
                      <span key={topic} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 rounded-full text-sm text-gray-200">
                        {topic}
                        <button onClick={() => removeTopic(topic)} className="text-gray-500 hover:text-white focus:outline-none" aria-label={`Remove ${topic}`}>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </span>
                    )) : (
                      <span className="text-sm text-gray-500 italic">No topics selected</span>
                    )}
                    <button className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/5 border border-dashed border-white/20 text-gray-400 hover:text-white hover:border-cyan-400 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-400/50">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                    </button>
                  </div>
                </div>

                <div className="space-y-4 mb-6">
                  <label className="flex items-center justify-between cursor-pointer group">
                    <span className="text-sm text-gray-300 group-hover:text-white transition-colors">Personalized Recommendations</span>
                    <div className="relative">
                      <input type="checkbox" className="sr-only" checked={recommendationsEnabled} onChange={() => setRecommendationsEnabled(!recommendationsEnabled)} />
                      <div className={`block w-10 h-6 rounded-full transition-colors ${recommendationsEnabled ? 'bg-cyan-500' : 'bg-gray-700'}`}></div>
                      <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${recommendationsEnabled ? 'transform translate-x-4' : ''}`}></div>
                    </div>
                  </label>
                  <label className="flex items-center justify-between cursor-pointer group">
                    <span className="text-sm text-gray-300 group-hover:text-white transition-colors">Autoplay Previews</span>
                    <div className="relative">
                      <input type="checkbox" className="sr-only" checked={autoplayEnabled} onChange={() => setAutoplayEnabled(!autoplayEnabled)} />
                      <div className={`block w-10 h-6 rounded-full transition-colors ${autoplayEnabled ? 'bg-cyan-500' : 'bg-gray-700'}`}></div>
                      <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${autoplayEnabled ? 'transform translate-x-4' : ''}`}></div>
                    </div>
                  </label>
                </div>

                <div className="pt-4 border-t border-white/5">
                  <button className="text-red-400 hover:text-red-300 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-red-400/50 rounded px-1 -mx-1">
                    Clear watch history
                  </button>
                </div>
              </div>

              {/* Account and Security */}
              <div className="bg-[#151923] border border-white/5 rounded-2xl p-6 shadow-lg shadow-black/20">
                <h3 className="font-semibold text-lg mb-4 text-white">Account & Security</h3>
                <div className="space-y-4 mb-6">
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Email Address</div>
                    <div className="text-sm text-gray-300 flex items-center justify-between">
                      {displayUser.email}
                      <span className="px-2 py-0.5 bg-green-500/10 text-green-400 text-[10px] uppercase font-bold rounded border border-green-500/20">Verified</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Sign-in Provider</div>
                    <div className="text-sm text-gray-300 flex items-center gap-2">
                      <svg className="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                      Google
                    </div>
                  </div>
                </div>
                
                <button 
                  onClick={handleLogout}
                  className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl font-medium transition-colors border border-white/5 focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
                >
                  Sign Out
                </button>
              </div>

            </div>

          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  );
};

export default Profile;

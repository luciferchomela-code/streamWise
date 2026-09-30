import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { channelService } from '../../services/channelService';
import { videoService } from '../../services/videoService';
import { useAuth } from '../../hooks/useAuth';
import { Navbar } from '../../components/layout/Navbar/Navbar';
import { VideoCard } from '../../components/home/VideoCard/VideoCard';

const CATEGORIES = ['General', 'Technology', 'Gaming', 'Education', 'Music', 'Sports', 'Art', 'Lifestyle', 'Science'];

export default function MyChannel() {
  const [channel, setChannel] = useState(null);
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [videosLoading, setVideosLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    handle: '',
    description: '',
    category: 'General',
  });
  const [error, setError] = useState('');
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    fetchMyChannel();
  }, [user, navigate]);

  const fetchMyChannel = async () => {
    try {
      const data = await channelService.getMyChannel();
      if (data && data.channel) {
        setChannel(data.channel);
        fetchChannelVideos(data.channel._id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchChannelVideos = async (channelId) => {
    setVideosLoading(true);
    try {
      const data = await videoService.getChannelVideos(channelId, { limit: 12 });
      setVideos(data.videos || []);
    } catch (err) {
      console.error(err);
    } finally {
      setVideosLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setIsCreating(true);
    setError('');
    try {
      const data = await channelService.createChannel(formData);
      setChannel(data.channel);
      fetchChannelVideos(data.channel._id);
    } catch (err) {
      setError(err.message || 'Failed to create channel');
    } finally {
      setIsCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0D12] text-white flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400"></div>
            <p className="text-gray-400 text-sm">Loading your channel...</p>
          </div>
        </div>
      </div>
    );
  }

  if (channel) {
    return (
      <div className="min-h-screen bg-[#0B0D12] text-white flex flex-col">
        <Navbar />
        <main className="flex-1 pb-16">
          <div className="max-w-[1400px] mx-auto">
            {/* Channel Header */}
            <div className="bg-[#151923] border-b border-white/5 overflow-hidden">
              {/* Cover */}
              <div className="h-40 md:h-56 bg-gradient-to-r from-violet-600/30 via-cyan-600/20 to-violet-600/30 relative">
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDM0djZoNnYtNmgtNnptNiA2djZoNnYtNmgtNnptLTYgMHY2aDZ2LTZoLTZ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-50"></div>
              </div>

              {/* Profile Row */}
              <div className="px-6 md:px-12 pb-6 relative -mt-16 flex flex-col md:flex-row gap-6 md:gap-8 items-start md:items-end">
                <div className="w-28 h-28 md:w-36 md:h-36 rounded-full border-4 border-[#0B0D12] bg-[#1A1F2B] overflow-hidden shrink-0 shadow-xl">
                  <img 
                    src={channel.image || `https://ui-avatars.com/api/?name=${channel.name}&background=1A1F2B&color=fff&size=200`} 
                    alt={channel.name} 
                    className="w-full h-full object-cover"
                  />
                </div>
                
                <div className="flex-1 w-full flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2">
                  <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-white">{channel.name}</h1>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-gray-400 text-sm mt-1">
                      <span className="text-cyan-400 font-medium">@{channel.handle}</span>
                      <span>·</span>
                      <span>{channel.subscribersCount || 0} subscribers</span>
                      <span>·</span>
                      <span>{videos.length} videos</span>
                      {channel.category && channel.category !== 'General' && (
                        <>
                          <span>·</span>
                          <span className="px-2 py-0.5 bg-violet-500/10 text-violet-400 rounded-full text-xs font-medium border border-violet-500/20">{channel.category}</span>
                        </>
                      )}
                    </div>
                    {channel.description && (
                      <p className="text-gray-300 text-sm mt-2 max-w-xl line-clamp-2">{channel.description}</p>
                    )}
                  </div>
                  <button className="px-5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-full font-medium transition-colors border border-white/10 text-sm shrink-0">
                    Customize Channel
                  </button>
                </div>
              </div>
            </div>

            {/* Videos Grid */}
            <div className="px-4 sm:px-6 lg:px-12 py-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">Your Videos</h2>
                <span className="text-gray-400 text-sm">{videos.length} total</span>
              </div>

              {videosLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {Array(4).fill(0).map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="aspect-video rounded-xl bg-white/5 mb-3"></div>
                      <div className="h-4 bg-white/5 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-white/5 rounded w-1/2"></div>
                    </div>
                  ))}
                </div>
              ) : videos.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {videos.map(video => (
                    <VideoCard key={video.id} {...video} />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="w-20 h-20 rounded-2xl bg-white/5 flex items-center justify-center mb-5 border border-white/5">
                    <svg className="w-10 h-10 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h3 className="text-white font-semibold text-lg mb-2">No videos yet</h3>
                  <p className="text-gray-400 text-sm max-w-xs">Upload your first video to get started on Streamwise.</p>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Create Channel Form
  return (
    <div className="min-h-screen bg-[#0B0D12] text-white flex flex-col">
      <Navbar />
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="bg-[#151923] p-8 rounded-3xl border border-white/5 shadow-2xl w-full max-w-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-violet-500/10 rounded-full blur-3xl -ml-32 -mb-32 pointer-events-none"></div>
          
          <div className="relative z-10">
            <div className="flex justify-center mb-8">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-violet-500 to-cyan-400 flex items-center justify-center shadow-[0_0_20px_rgba(139,92,246,0.3)]">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
            
            <h2 className="text-3xl font-bold text-white text-center mb-2">Create your channel</h2>
            <p className="text-gray-400 text-center mb-8">Establish your presence on Streamwise</p>
            
            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-xl text-red-400 text-sm text-center">
                {error}
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Channel Name <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-[#1A1F2B] border border-white/5 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/50 transition-all"
                  placeholder="e.g. John's Tech Vlogs"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Handle</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-500">@</div>
                  <input
                    type="text"
                    value={formData.handle}
                    onChange={(e) => setFormData({...formData, handle: e.target.value})}
                    className="w-full bg-[#1A1F2B] border border-white/5 rounded-xl pl-9 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/50 transition-all"
                    placeholder="johnstech"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({...formData, category: e.target.value})}
                  className="w-full bg-[#1A1F2B] border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/50 transition-all appearance-none"
                >
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full bg-[#1A1F2B] border border-white/5 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/50 transition-all resize-none h-24"
                  placeholder="Tell viewers what your channel is about..."
                />
              </div>

              <button
                type="submit"
                disabled={isCreating}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-violet-500 to-cyan-500 hover:from-violet-600 hover:to-cyan-600 text-white font-semibold rounded-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(139,92,246,0.3)] mt-2 flex items-center justify-center gap-2"
              >
                {isCreating ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Creating...</span>
                  </>
                ) : (
                  'Create Channel'
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

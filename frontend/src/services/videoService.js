const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const getHeaders = (requiresAuth = false) => {
  const token = localStorage.getItem('accessToken');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
};

const formatViews = (n) => {
  if (!n) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
};

const formatTimeAgo = (dateStr) => {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
};

const formatDuration = (seconds) => {
  if (!seconds) return '';
  const m = Math.floor(seconds / 60);
  const s = String(seconds % 60).padStart(2, '0');
  if (m >= 60) {
    const h = Math.floor(m / 60);
    return `${h}:${String(m % 60).padStart(2, '0')}:${s}`;
  }
  return `${m}:${s}`;
};

/** Normalize a raw DB video into the shape VideoCard expects */
export const normalizeVideo = (v) => ({
  id: v._id,
  title: v.title || 'Untitled',
  creator: v.channelId?.name || 'Unknown Channel',
  channelId: v.channelId?._id || v.channelId,
  channelImage: v.channelId?.image || null,
  duration: formatDuration(v.duration),
  views: formatViews(v.views),
  viewsRaw: v.views || 0,
  timeAgo: formatTimeAgo(v.createdAt),
  thumbnail: v.thumbnailUrl || '',
  videoUrl: v.videoUrl || '',
  likes: v.likes || 0,
  dislikes: v.dislikes || 0,
  description: v.description || '',
  status: v.status,
  visibility: v.visibility,
});

export const videoService = {
  getTrending: async ({ page = 1, limit = 12 } = {}) => {
    const res = await fetch(
      `${API_BASE_URL}/videos/trending?page=${page}&limit=${limit}`,
      { headers: getHeaders() }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Failed to fetch trending videos');
    return { ...data, videos: (data.videos || []).map(normalizeVideo) };
  },

  getPopular: async ({ page = 1, limit = 12 } = {}) => {
    const res = await fetch(
      `${API_BASE_URL}/videos/popular?page=${page}&limit=${limit}`,
      { headers: getHeaders() }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Failed to fetch popular videos');
    return { ...data, videos: (data.videos || []).map(normalizeVideo) };
  },

  search: async (q, { page = 1, limit = 12 } = {}) => {
    const res = await fetch(
      `${API_BASE_URL}/videos/search?q=${encodeURIComponent(q)}&page=${page}&limit=${limit}`,
      { headers: getHeaders() }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Search failed');
    return { ...data, videos: (data.videos || []).map(normalizeVideo) };
  },

  getVideoById: async (videoId) => {
    const res = await fetch(`${API_BASE_URL}/videos/${videoId}`, {
      headers: getHeaders(),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Failed to fetch video');
    return normalizeVideo(data.video);
  },

  getChannelVideos: async (channelId, { page = 1, limit = 12 } = {}) => {
    const res = await fetch(
      `${API_BASE_URL}/videos/channel/${channelId}?page=${page}&limit=${limit}`,
      { headers: getHeaders() }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Failed to fetch channel videos');
    return { ...data, videos: (data.videos || []).map(normalizeVideo) };
  },

  createDraft: async (videoData) => {
    const res = await fetch(`${API_BASE_URL}/videos/draft`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(videoData)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Failed to create draft');
    return data.video;
  },

  finalizeVideo: async (videoId, finalizeData) => {
    const res = await fetch(`${API_BASE_URL}/videos/${videoId}/finalize`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(finalizeData)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Failed to finalize video');
    return data.video;
  },

  deleteVideo: async (videoId) => {
    const res = await fetch(`${API_BASE_URL}/videos/${videoId}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Failed to delete video');
    return data;
  }
};

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const getHeaders = () => {
  const token = localStorage.getItem('accessToken');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
};

export const interactionService = {
  toggleLike: async (videoId) => {
    const res = await fetch(`${API_BASE_URL}/interactions/${videoId}/like`, {
      method: 'POST',
      headers: getHeaders(),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Failed to like video');
    return data;
  },

  toggleDislike: async (videoId) => {
    const res = await fetch(`${API_BASE_URL}/interactions/${videoId}/dislike`, {
      method: 'POST',
      headers: getHeaders(),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Failed to dislike video');
    return data;
  },

  incrementView: async (videoId, watchPercentage = 30) => {
    const res = await fetch(`${API_BASE_URL}/interactions/${videoId}/view`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ watchPercentage }),
    });
    const data = await res.json().catch(() => ({}));
    return data;
  },

  getComments: async (videoId) => {
    const res = await fetch(`${API_BASE_URL}/interactions/${videoId}/comments`, {
      headers: getHeaders(),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Failed to fetch comments');
    return data.comments || [];
  },

  addComment: async (videoId, commentText, parentCommentId = null) => {
    const res = await fetch(`${API_BASE_URL}/interactions/${videoId}/comment`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ commentText, parentCommentId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Failed to add comment');
    return data.comment;
  },

  deleteComment: async (commentId) => {
    const res = await fetch(`${API_BASE_URL}/interactions/comment/${commentId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Failed to delete comment');
    return data;
  },

  toggleWatchLater: async (videoId) => {
    const res = await fetch(`${API_BASE_URL}/interactions/${videoId}/watch-later`, {
      method: 'POST',
      headers: getHeaders(),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Failed to update Watch Later');
    return data;
  },

  getWatchLater: async (page = 1, limit = 20) => {
    const res = await fetch(`${API_BASE_URL}/interactions/watch-later?page=${page}&limit=${limit}`, {
      headers: getHeaders(),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Failed to fetch Watch Later videos');
    return data;
  },

  getWatchLaterStatus: async (videoId) => {
    const res = await fetch(`${API_BASE_URL}/interactions/${videoId}/watch-later/status`, {
      headers: getHeaders(),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { watchLater: false };
    return data;
  },
};

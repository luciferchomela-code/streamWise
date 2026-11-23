import { apiFetch, API_BASE_URL } from './apiFetch';

export const interactionService = {
  toggleLike: async (videoId) => {
    const res = await apiFetch(`${API_BASE_URL}/interactions/${videoId}/like`, {
      method: 'POST',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Failed to like video');
    return data;
  },

  toggleDislike: async (videoId) => {
    const res = await apiFetch(`${API_BASE_URL}/interactions/${videoId}/dislike`, {
      method: 'POST',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Failed to dislike video');
    return data;
  },

  incrementView: async (videoId, watchPercentage = 30, lastWatchedPosition = 0) => {
    const res = await apiFetch(`${API_BASE_URL}/interactions/${videoId}/view`, {
      method: 'POST',
      body: JSON.stringify({ watchPercentage, lastWatchedPosition }),
    });
    const data = await res.json().catch(() => ({}));
    return data;
  },

  savePlayback: async (videoId, body) => {
    const res = await apiFetch(`${API_BASE_URL}/interactions/${videoId}/playback`, {
      method: 'POST', body: JSON.stringify(body), keepalive: true,
    });
    if (!res.ok) throw new Error('Playback update failed');
  },

  saveTelemetry: (videoId, telemetry) => {
    const url = `${API_BASE_URL}/interactions/${videoId}/telemetry`;
    const payload = JSON.stringify(telemetry);
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' });
      navigator.sendBeacon(url, blob);
    } else {
      void apiFetch(url, { method: 'POST', body: payload, keepalive: true }).catch(() => {});
    }
  },

  getComments: async (videoId) => {
    const res = await apiFetch(`${API_BASE_URL}/interactions/${videoId}/comments`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Failed to fetch comments');
    return data.comments || [];
  },

  addComment: async (videoId, commentText, parentCommentId = null) => {
    const res = await apiFetch(`${API_BASE_URL}/interactions/${videoId}/comment`, {
      method: 'POST',
      body: JSON.stringify({ commentText, parentCommentId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Failed to add comment');
    return data.comment;
  },

  deleteComment: async (commentId) => {
    const res = await apiFetch(`${API_BASE_URL}/interactions/comment/${commentId}`, {
      method: 'DELETE',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Failed to delete comment');
    return data;
  },

  toggleWatchLater: async (videoId) => {
    const res = await apiFetch(`${API_BASE_URL}/interactions/${videoId}/watch-later`, {
      method: 'POST',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Failed to update Watch Later');
    return data;
  },

  getWatchLater: async (page = 1, limit = 20) => {
    const res = await apiFetch(`${API_BASE_URL}/interactions/watch-later?page=${page}&limit=${limit}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Failed to fetch Watch Later videos');
    return data;
  },

  getInteractionStatus: async (videoId) => {
    const res = await apiFetch(`${API_BASE_URL}/interactions/${videoId}/status`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { watchLater: false, liked: false, disliked: false, lastWatchedPosition: 0 };
    return data;
  },

  getHistory: async (page = 1, limit = 20) => {
    const res = await apiFetch(`${API_BASE_URL}/interactions/history?page=${page}&limit=${limit}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Failed to fetch watch history');
    return data;
  },

  getContinueWatching: async () => {
    const res = await apiFetch(`${API_BASE_URL}/interactions/continue-watching`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Failed to fetch continue watching list');
    return data;
  },
};


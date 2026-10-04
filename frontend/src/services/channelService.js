import { apiFetch, API_BASE_URL } from './apiFetch';

export const channelService = {
  createChannel: async (channelData) => {
    const response = await apiFetch(`${API_BASE_URL}/channels`, {
      method: 'POST',
      
      body: JSON.stringify(channelData),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.message || 'Failed to create channel');
    }
    return data;
  },
  
  getMyChannel: async () => {
    const response = await apiFetch(`${API_BASE_URL}/channels/me`, {
      method: 'GET',
      
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 404) return null; // No channel yet
      throw new Error(data.message || 'Failed to fetch channel');
    }
    return data;
  },

  updateChannel: async (channelData) => {
    const response = await apiFetch(`${API_BASE_URL}/channels`, {
      method: 'PUT',
      
      body: JSON.stringify(channelData),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.message || 'Failed to update channel');
    }
    return data;
  },

  getChannel: async (channelId) => {
    const response = await apiFetch(`${API_BASE_URL}/channels/${channelId}`, {
      method: 'GET',
      
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch channel');
    }
    return data;
  },

  subscribe: async (channelId) => {
    const response = await apiFetch(`${API_BASE_URL}/channels/${channelId}/subscribe`, {
      method: 'POST',
      
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.message || 'Failed to subscribe to channel');
    }
    return data;
  },

  unsubscribe: async (channelId) => {
    const response = await apiFetch(`${API_BASE_URL}/channels/${channelId}/unsubscribe`, {
      method: 'DELETE',
      
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.message || 'Failed to unsubscribe from channel');
    }
    return data;
  },

  getMySubscriptions: async () => {
    const response = await apiFetch(`${API_BASE_URL}/channels/subscriptions`, {
      method: 'GET',
      
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch subscriptions');
    }
    return data;
  },

  getSubscribedVideos: async (page = 1, limit = 12) => {
    const response = await apiFetch(`${API_BASE_URL}/channels/subscriptions/videos?page=${page}&limit=${limit}`, {
      method: 'GET',
      
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch subscribed videos');
    }
    return data;
  },

  getSubscriptionStatus: async (channelId) => {
    const response = await apiFetch(`${API_BASE_URL}/channels/${channelId}/subscription-status`, {
      method: 'GET',
      
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return { subscribed: false };
    return data;
  },
};

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const getHeaders = () => {
  const token = localStorage.getItem('accessToken');
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` })
  };
};

export const channelService = {
  createChannel: async (channelData) => {
    const response = await fetch(`${API_BASE_URL}/channels`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(channelData),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.message || 'Failed to create channel');
    }
    return data;
  },
  
  getMyChannel: async () => {
    const response = await fetch(`${API_BASE_URL}/channels/me`, {
      method: 'GET',
      headers: getHeaders(),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 404) return null; // No channel yet
      throw new Error(data.message || 'Failed to fetch channel');
    }
    return data;
  },

  updateChannel: async (channelData) => {
    const response = await fetch(`${API_BASE_URL}/channels`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(channelData),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.message || 'Failed to update channel');
    }
    return data;
  },

  getChannel: async (channelId) => {
    const response = await fetch(`${API_BASE_URL}/channels/${channelId}`, {
      method: 'GET',
      headers: getHeaders(),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch channel');
    }
    return data;
  },

  subscribe: async (channelId) => {
    const response = await fetch(`${API_BASE_URL}/channels/${channelId}/subscribe`, {
      method: 'POST',
      headers: getHeaders(),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.message || 'Failed to subscribe to channel');
    }
    return data;
  },

  unsubscribe: async (channelId) => {
    const response = await fetch(`${API_BASE_URL}/channels/${channelId}/unsubscribe`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.message || 'Failed to unsubscribe from channel');
    }
    return data;
  },

  getMySubscriptions: async () => {
    const response = await fetch(`${API_BASE_URL}/channels/subscriptions`, {
      method: 'GET',
      headers: getHeaders(),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch subscriptions');
    }
    return data;
  },

  getSubscribedVideos: async (page = 1, limit = 12) => {
    const response = await fetch(`${API_BASE_URL}/channels/subscriptions/videos?page=${page}&limit=${limit}`, {
      method: 'GET',
      headers: getHeaders(),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch subscribed videos');
    }
    return data;
  },

  getSubscriptionStatus: async (channelId) => {
    const response = await fetch(`${API_BASE_URL}/channels/${channelId}/subscription-status`, {
      method: 'GET',
      headers: getHeaders(),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return { subscribed: false };
    return data;
  },
};

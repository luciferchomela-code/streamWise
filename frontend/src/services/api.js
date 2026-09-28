const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const request = async (path, options = {}) => {
  const token = localStorage.getItem("accessToken");

  const isFormData = options.body instanceof FormData;

  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  if (!isFormData) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = new Error(data.message || "Request failed");
    err.status = res.status;
    throw err;
  }

  return data;
};

export const authApi = {
  /** Exchange Google OAuth code for JWT tokens */
  login: (code) =>
    request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ code }),
    }),

  /** Get the currently authenticated user's profile */
  me: () => request("/api/auth/me"),

  /** Logout and invalidate refresh token */
  logout: (refreshToken) =>
    request("/api/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    }),

  /** Rotate tokens using the refresh token */
  refresh: (refreshToken) =>
    request("/api/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    }),
};

export const uploadApi = {
  /** Upload an image file via FormData (multipart/form-data) */
  uploadImage: (file, type = "thumbnail") => {
    const formData = new FormData();
    formData.append("image", file);
    return request(`/api/upload/image?type=${encodeURIComponent(type)}`, {
      method: "POST",
      body: formData,
    });
  },
};

export const channelApi = {
  /** Create a new channel */
  createChannel: ({ name, imageUrl, description, handle, category }) =>
    request("/api/channels", {
      method: "POST",
      body: JSON.stringify({ name, imageUrl, description, handle, category }),
    }),

  /** Update user's channel */
  updateChannel: ({ name, imageUrl, description, handle, category }) =>
    request("/api/channels", {
      method: "PUT",
      body: JSON.stringify({ name, imageUrl, description, handle, category }),
    }),

  /** Get my channel */
  getMyChannel: () => request("/api/channels/me"),

  /** Get channel details by ID */
  getChannel: (channelId) => request(`/api/channels/${channelId}`),

  /** Subscribe to a channel */
  subscribe: (channelId) =>
    request(`/api/channels/${channelId}/subscribe`, { method: "POST" }),

  /** Unsubscribe from a channel */
  unsubscribe: (channelId) =>
    request(`/api/channels/${channelId}/unsubscribe`, { method: "DELETE" }),
};

export const videoApi = {
  /** Create a new video entry (with thumbnail URL) */
  createDraft: ({ title, description, visibility, thumbnailUrl }) =>
    request("/api/videos/draft", {
      method: "POST",
      body: JSON.stringify({ title, description, visibility, thumbnailUrl }),
    }),

  /** Delete video by ID */
  deleteVideo: (videoId) =>
    request(`/api/videos/${videoId}`, { method: "DELETE" }),

  /** Fetch trending / popular videos */
  getTrending: (page = 1, limit = 12) =>
    request(`/api/videos/trending?page=${page}&limit=${limit}`),

  /** Fetch latest videos */
  getLatest: (page = 1, limit = 12) =>
    request(`/api/videos/latest?page=${page}&limit=${limit}`),

  /** Fetch videos by channel ID */
  getVideosByChannel: (channelId, page = 1, limit = 12) =>
    request(`/api/videos/channel/${channelId}?page=${page}&limit=${limit}`),

  /** Search videos by title */
  search: (query, page = 1, limit = 12) =>
    request(`/api/videos/search?q=${encodeURIComponent(query)}&page=${page}&limit=${limit}`),

  /** Get video by ID */
  getVideoById: (videoId) => request(`/api/videos/${videoId}`),
};

export const interactionApi = {
  /** Toggle like on a video */
  likeVideo: (videoId) =>
    request(`/api/interactions/${videoId}/like`, { method: "POST" }),

  /** Toggle dislike on a video */
  dislikeVideo: (videoId) =>
    request(`/api/interactions/${videoId}/dislike`, { method: "POST" }),

  /** Record view count */
  recordView: (videoId, watchPercentage = 30) =>
    request(`/api/interactions/${videoId}/view`, {
      method: "POST",
      body: JSON.stringify({ watchPercentage }),
    }),

  /** Get video comments */
  getComments: (videoId) => request(`/api/interactions/${videoId}/comments`),

  /** Add comment to a video */
  addComment: (videoId, commentText) =>
    request(`/api/interactions/${videoId}/comment`, {
      method: "POST",
      body: JSON.stringify({ commentText }),
    }),

  /** Delete comment */
  deleteComment: (commentId) =>
    request(`/api/interactions/comment/${commentId}`, { method: "DELETE" }),
};

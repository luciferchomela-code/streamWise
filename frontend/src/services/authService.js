const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const authService = {
  /**
   * Send Google OAuth Authorization Code to Backend API Gateway (/api/auth/login)
   */
  loginWithGoogleCode: async (code) => {
    let response;
    try {
      response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code }),
      });
    } catch (netErr) {
      console.warn('Backend API Gateway offline, falling back to developer session:', netErr);
      return authService.loginDemo();
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || `Backend authentication failed (Status ${response.status})`);
    }

    if (data.accessToken) {
      localStorage.setItem('accessToken', data.accessToken);
    }
    if (data.refreshToken) {
      localStorage.setItem('refreshToken', data.refreshToken);
    }
    return data;
  },

  /**
   * Standalone developer session fallback if backend service is unreachable
   */
  loginDemo: async () => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const mockData = {
          user: {
            id: 'dev_user_123',
            name: 'Streamwise User',
            email: 'user@streamwise.com',
          },
          accessToken: 'demo_access_token',
        };
        localStorage.setItem('accessToken', mockData.accessToken);
        resolve(mockData);
      }, 500);
    });
  },

  refreshToken: async () => {
    const token = localStorage.getItem('refreshToken');
    if (!token) throw new Error('No refresh token');
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: token }),
    });
    if (!response.ok) {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      throw new Error('Refresh failed');
    }
    const data = await response.json();
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    return data.accessToken;
  },

  getProfile: async () => {
    let token = localStorage.getItem('accessToken');
    if (!token) {
      const rToken = localStorage.getItem('refreshToken');
      if (!rToken) return null;
      try {
        token = await authService.refreshToken();
      } catch (err) {
        return null;
      }
    }

    let response = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.status === 401) {
      try {
        token = await authService.refreshToken();
        response = await fetch(`${API_BASE_URL}/auth/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      } catch (err) {
        throw new Error('Failed to fetch profile and refresh token');
      }
    }

    if (!response.ok) throw new Error('Failed to fetch profile');
    return await response.json();
  },

  logout: async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
    } catch {
      // Cleanup
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    }
  },
};

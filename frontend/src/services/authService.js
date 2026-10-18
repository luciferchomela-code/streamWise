const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const clearLegacyTokens = () => {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
};

export const authService = {
  /**
   * Send Google OAuth Authorization Code to Backend API Gateway (/api/auth/login)
   * Backend sets httpOnly session cookies automatically.
   */
  loginWithGoogleCode: async (code) => {
    let response;
    try {
      response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        credentials: 'include',
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

    clearLegacyTokens();
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
        };
        resolve(mockData);
      }, 500);
    });
  },

  /**
   * Refresh session via httpOnly cookie
   */
  refreshToken: async () => {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      clearLegacyTokens();
      throw new Error('Refresh failed');
    }
    return await response.json().catch(() => ({}));
  },

  /**
   * Get currently logged-in user profile via httpOnly cookie session
   */
  getProfile: async () => {
    let response = await fetch(`${API_BASE_URL}/auth/me`, {
      credentials: 'include',
    });

    if (response.status === 401) {
      try {
        await authService.refreshToken();
        response = await fetch(`${API_BASE_URL}/auth/me`, {
          credentials: 'include',
        });
      } catch (err) {
        clearLegacyTokens();
        return null;
      }
    }

    if (!response.ok) return null;
    return await response.json().catch(() => null);
  },

  /**
   * Logout user, clearing backend database refresh token and invalidating cookies
   */
  logout: async () => {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
    } catch {
      // Cleanup
    } finally {
      clearLegacyTokens();
    }
  },
};

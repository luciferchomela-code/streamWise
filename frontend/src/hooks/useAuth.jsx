import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/authService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Check if logged in on mount
    const initAuth = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        const refreshToken = localStorage.getItem('refreshToken');
        
        if (token || refreshToken) {
          const profile = await authService.getProfile();
          if (profile && profile.user) {
            setUser(profile.user);
          }
        }
      } catch (err) {
        console.error('Failed to restore session:', err);
      } finally {
        setLoading(false);
      }
    };
    initAuth();
  }, []);

  const loginWithGoogleCode = async (code) => {
    setLoading(true);
    setError(null);
    try {
      const response = await authService.loginWithGoogleCode(code);
      if (response && response.user) {
        setUser(response.user);
      }
      return response;
    } catch (err) {
      setError(err.message || 'Failed to authenticate with Google');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await authService.logout();
    } finally {
      setUser(null);
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, error, loginWithGoogleCode, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

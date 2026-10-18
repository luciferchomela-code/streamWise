import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/authService';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Check if logged in on mount via httpOnly cookie session
    const initAuth = async () => {
      try {
        const profile = await authService.getProfile();
        if (profile && profile.user) {
          setUser(profile.user);
        } else {
          setUser(null);
        }
      } catch (err) {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    initAuth();

    const handleSessionExpired = () => {
      setUser(null);
    };
    window.addEventListener('streamwise:session-expired', handleSessionExpired);

    return () => {
      window.removeEventListener('streamwise:session-expired', handleSessionExpired);
    };
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

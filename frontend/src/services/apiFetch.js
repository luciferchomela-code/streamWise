/**
 * apiFetch — resilient fetch wrapper with:
 *  1. Automatic credentials: 'include' for HttpOnly cookie transport.
 *  2. Cross-tab refresh coordination via Web Locks API (navigator.locks).
 *  3. In-memory single-flight promise de-duplication within single tab.
 *  4. Strict loop prevention (max 1 retry per request).
 *  5. Immediate session termination notification on refresh failure.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const LOCK_NAME = 'streamwise_auth_refresh_lock';
let _refreshPromise = null;
let _lastRefreshTimestamp = 0;

const clearLegacyTokens = () => {
  try {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  } catch (_) {}
};

/**
 * Direct call to refresh endpoint
 */
const callRefreshApi = async () => {
  const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok) {
    clearLegacyTokens();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('streamwise:session-expired'));
    }
    throw new Error('Session expired. Please log in again.');
  }

  _lastRefreshTimestamp = Date.now();
  return await res.json().catch(() => ({}));
};

/**
 * In-memory single-flight coordination
 */
const refreshSessionInMemory = () => {
  if (!_refreshPromise) {
    _refreshPromise = callRefreshApi().finally(() => {
      _refreshPromise = null;
    });
  }
  return _refreshPromise;
};

/**
 * Cross-tab coordinated refresh via Web Locks API with in-memory fallback
 */
const coordinatedRefresh = async () => {
  if (typeof navigator !== 'undefined' && navigator.locks && navigator.locks.request) {
    return await navigator.locks.request(LOCK_NAME, async () => {
      // If another tab refreshed cookies in the last 4 seconds, cookies are already fresh
      if (Date.now() - _lastRefreshTimestamp < 4000) {
        return;
      }
      return await refreshSessionInMemory();
    });
  }

  return await refreshSessionInMemory();
};

/**
 * Header builder
 */
const buildHeaders = (extra = {}) => {
  return { 'Content-Type': 'application/json', ...extra };
};

/**
 * Main export — drop-in replacement for fetch().
 */
export const apiFetch = async (url, options = {}) => {
  const { headers: extraHeaders, _isRetry, ...rest } = options;

  const requestOptions = {
    ...rest,
    credentials: 'include',
    headers: buildHeaders(extraHeaders),
  };

  // Perform request
  let response = await fetch(url, requestOptions);

  // If 401 encountered, ensure not an auth endpoint and not already a retried request
  const isAuthEndpoint =
    url.includes('/auth/refresh') ||
    url.includes('/auth/login') ||
    url.includes('/auth/logout');

  if (response.status === 401 && !isAuthEndpoint && !_isRetry) {
    try {
      await coordinatedRefresh();
    } catch (refreshErr) {
      // Refresh failed — return original 401 response so UI can handle redirection
      return response;
    }

    // Single safe retry with _isRetry flag to strictly prevent infinite loops
    response = await fetch(url, {
      ...requestOptions,
      _isRetry: true,
    });
  }

  return response;
};

export { API_BASE_URL };

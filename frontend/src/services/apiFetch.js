/**
 * apiFetch — drop-in replacement for fetch() that automatically:
 *  1. Attaches the current access token as a Bearer header.
 *  2. On a 401 response, attempts to refresh the access token using the stored refresh token.
 *  3. Retries the original request once with the new access token.
 *  4. If refresh fails (refresh token expired/revoked), clears storage so the
 *     useAuth hook detects the logged-out state and redirects to /login.
 *
 * Usage — replace:
 *   fetch(url, { headers: getHeaders() })
 * with:
 *   apiFetch(url, options)
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Prevent multiple concurrent refresh calls from racing each other
let _refreshPromise = null;

const getAccessToken = () => localStorage.getItem('accessToken');
const getRefreshToken = () => localStorage.getItem('refreshToken');

const setTokens = (accessToken, refreshToken) => {
  if (accessToken) localStorage.setItem('accessToken', accessToken);
  if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
};

const clearTokens = () => {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
};

/**
 * Calls the refresh endpoint and updates localStorage.
 * Returns the new access token or throws if refresh fails.
 */
const doRefresh = async () => {
  const rToken = getRefreshToken();
  if (!rToken) throw new Error('No refresh token available');

  const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: rToken }),
  });

  if (!res.ok) {
    clearTokens();
    throw new Error('Refresh token expired — please log in again');
  }

  const data = await res.json();
  setTokens(data.accessToken, data.refreshToken);
  return data.accessToken;
};

/**
 * Refreshes the access token, de-duplicating concurrent calls.
 */
const refreshAccessToken = () => {
  if (!_refreshPromise) {
    _refreshPromise = doRefresh().finally(() => {
      _refreshPromise = null;
    });
  }
  return _refreshPromise;
};

/**
 * Builds request headers, always injecting the latest access token.
 */
const buildHeaders = (extra = {}) => {
  const token = getAccessToken();
  const headers = { 'Content-Type': 'application/json', ...extra };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
};

/**
 * Main export — use exactly like fetch().
 * Automatically handles token refresh on 401.
 */
export const apiFetch = async (url, options = {}) => {
  const { headers: extraHeaders, ...rest } = options;

  // First attempt
  let response = await fetch(url, {
    ...rest,
    headers: buildHeaders(extraHeaders),
  });

  // If access token expired, refresh and retry once
  if (response.status === 401) {
    try {
      await refreshAccessToken();
    } catch {
      // Refresh failed — return the original 401 so callers handle logout
      return response;
    }

    // Retry with the new token
    response = await fetch(url, {
      ...rest,
      headers: buildHeaders(extraHeaders),
    });
  }

  return response;
};

export { API_BASE_URL };

import { API_BASE_URL, apiFetch } from './apiFetch';

export async function featureRequest(path, { method = 'GET', body, signal, text = false } = {}) {
  const response = await apiFetch(`${API_BASE_URL}${path}`, {
    method, signal, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message || 'The request failed.');
  }
  if (response.status === 204) return null;
  return text ? response.text() : response.json();
}

export const cursorPath = (path, cursor) => cursor ? `${path}?cursor=${encodeURIComponent(cursor)}` : path;

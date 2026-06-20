const DEFAULT_API_BASE_URL = 'http://localhost:8080';

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || DEFAULT_API_BASE_URL;

const toErrorMessage = (payload, status) => {
  if (typeof payload === 'string' && payload.trim()) return payload;

  const candidates = [payload?.message, payload?.error, payload?.detail];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate;
    if (candidate && typeof candidate === 'object') {
      const nested = candidate.message || candidate.error;
      if (typeof nested === 'string' && nested.trim()) return nested;
    }
  }

  return `Request failed with status ${status}`;
};

export async function apiFetch(path, options = {}) {
  const url = `${API_BASE_URL}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const response = await fetch(url, {
    credentials: 'include',
    ...options,
    headers,
  });

  const contentType = response.headers.get('content-type') || '';
  let data = null;

  if (response.status !== 204) {
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }
  }

  if (!response.ok) {
    const message = toErrorMessage(data, response.status);
    const error = new Error(message);
    error.status = response.status;
    error.payload = data;
    error.code = data?.error?.code;
    throw error;
  }

  return data;
}

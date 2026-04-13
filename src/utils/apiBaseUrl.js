/**
 * Resolves the backend base URL for fetch calls.
 * Priority:
 * 1) REACT_APP_API_BASE_URL (for deployed environments like Render)
 * 2) Local/LAN fallback during development
 */
export function getApiBaseUrl() {
  const fromEnv =
    typeof process.env.REACT_APP_API_BASE_URL === 'string'
      ? process.env.REACT_APP_API_BASE_URL.trim()
      : '';
  if (fromEnv && /^https?:\/\//i.test(fromEnv)) {
    return fromEnv.replace(/\/+$/, '');
  }

  if (typeof window !== 'undefined' && window.location?.hostname) {
    const { protocol, hostname } = window.location;

    const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1';
    const isPrivateLanIp = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(hostname);

    if (isLocalHost || isPrivateLanIp) {
      return `${protocol}//${hostname}:5000`.replace(/\/+$/, '');
    }
  }

  return 'http://localhost:5000';
}

/**
 * Resolves the backend base URL for fetch calls.
 * When the app is opened via LAN IP (e.g. http://192.168.x.x:3000), using only
 * REACT_APP_API_BASE_URL=http://localhost:5000 makes the browser call localhost
 * on the client device — requests miss the dev server and APIs return 404.
 * We prefer the current page hostname with port 5000 in that case.
 */
export function getApiBaseUrl() {
  if (typeof window !== 'undefined' && window.location?.hostname) {
    const { protocol, hostname } = window.location;
    if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1') {
      return `${protocol}//${hostname}:5000`.replace(/\/+$/, '');
    }
  }

  const fromEnv = typeof process.env.REACT_APP_API_BASE_URL === 'string' ? process.env.REACT_APP_API_BASE_URL.trim() : '';
  if (fromEnv && /^https?:\/\//i.test(fromEnv)) {
    return fromEnv.replace(/\/+$/, '');
  }

  return 'http://localhost:5000';
}

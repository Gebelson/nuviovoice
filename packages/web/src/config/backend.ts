/**
 * Centralized backend and WebSocket configuration for Nuvio.
 * Ensures consistent connectivity across Desktop (Electron), Web (Vercel / standalone),
 * and local development environments.
 */

export const DEFAULT_OFFICIAL_BACKEND_URL = 'https://167-234-239-100.sslip.io';
export const DEFAULT_OFFICIAL_WS_URL = 'wss://167-234-239-100.sslip.io';

/**
 * Returns the authoritative HTTP backend base URL.
 * 1. Checks if Electron preload injected `window.nuvioConfig.backendUrl`.
 * 2. Checks `import.meta.env.VITE_BACKEND_URL`.
 * 3. On localhost/127.0.0.1, uses relative '' to let Vite proxy to local server.
 * 4. In all other browser environments (Vercel, custom domain, production web),
 *    defaults to the official Nuvio server (`https://167-234-239-100.sslip.io`).
 */
export function getResolvedBackendUrl(): string {
  if (typeof window !== 'undefined' && (window as any).nuvioConfig?.backendUrl) {
    return (window as any).nuvioConfig.backendUrl;
  }
  if (import.meta.env?.VITE_BACKEND_URL) {
    return import.meta.env.VITE_BACKEND_URL;
  }
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return '';
    }
  }
  return DEFAULT_OFFICIAL_BACKEND_URL;
}

/**
 * Returns the resolved API base URL (e.g. `https://167-234-239-100.sslip.io/api` or `/api`).
 */
export function getResolvedApiBase(): string {
  const base = getResolvedBackendUrl();
  return base ? `${base}/api` : '/api';
}

/**
 * Returns the authoritative WebSocket URL.
 * 1. Checks if Electron preload injected `window.nuvioConfig.wsUrl`.
 * 2. Checks `import.meta.env.VITE_WS_URL`.
 * 3. On localhost/127.0.0.1, derives `ws(s)://<host>/ws` for Vite proxy.
 * 4. In all other browser environments (Vercel, production web), connects directly
 *    to the official Nuvio WebSocket (`wss://167-234-239-100.sslip.io/ws`).
 */
export function getResolvedWsUrl(): string {
  if (typeof window !== 'undefined' && (window as any).nuvioConfig?.wsUrl) {
    return (window as any).nuvioConfig.wsUrl;
  }
  if (import.meta.env?.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL;
  }
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${proto}//${window.location.host}`;
    }
  }
  return DEFAULT_OFFICIAL_WS_URL;
}

import { getResolvedBackendUrl } from '../config/backend';

/**
 * Returns the effective base origin for the home instance.
 * Prioritizes the resolved backend URL (Electron nuvioConfig, VITE_BACKEND_URL, or official server in web).
 * Falls back to window.location.origin if localhost dev or standard browser environment.
 */
export function getHomeOrigin(): string {
  const backend = getResolvedBackendUrl();
  if (backend && backend.trim()) {
    return backend.trim();
  }
  if (
    typeof window !== 'undefined' &&
    window.location?.origin &&
    window.location.origin !== 'null' &&
    !window.location.origin.startsWith('file:') &&
    !window.location.origin.startsWith('nuvio-app:')
  ) {
    return window.location.origin;
  }
  return 'http://localhost:3000';
}

/**
 * Resolve the `Location` a tus create returned into the absolute upload URL.
 *
 * The server answers with a path (`/api/files/<id>`), never an absolute URL:
 * behind a reverse proxy it only sees whatever Host the proxy chose to send,
 * and nginx's `$host` drops the port, so an absolute Location pointed at a
 * port the client never used (#44). The client knows which origin it uploaded
 * to, so the resolution happens here. `origin` is the transfer's origin field:
 * empty or undefined means the home instance, which is the resolved backend origin.
 *
 * An absolute Location (older servers, or a remote that still sends one) is
 * returned unchanged.
 */
export function resolveTusUrl(location: string, origin: string | undefined): string {
  const base = origin && origin.trim() ? origin.trim() : getHomeOrigin();
  return new URL(location, base).toString();
}

/**
 * The absolute tus endpoint for a transfer origin (`''` or undefined = home).
 * Absolute on purpose: tus-js-client resolves the relative `Location` against
 * this, so the upload URL it keeps is complete wherever the page is served
 * from, including a shell whose page origin is not the instance.
 */
export function tusEndpoint(origin: string | undefined): string {
  const base = origin && origin.trim() ? origin.trim() : getHomeOrigin();
  return new URL('/api/files/', base).toString();
}


import { app } from 'electron';
import path from 'path';
import fs from 'fs';

export const DEFAULT_NUVIO_URL = 'https://167-234-239-100.sslip.io';
export const DEFAULT_NUVIO_WS = 'wss://167-234-239-100.sslip.io';

export function getInstanceUrlPath(): string {
  return path.join(app.getPath('userData'), 'instance-url.json');
}

/**
 * Checks whether custom instance selection is permitted.
 * In public packaged builds, users connect directly to the official Nuvio infrastructure.
 * Custom instances are restricted to development builds or explicit dev-mode flag.
 */
export function isCustomInstanceAllowed(): boolean {
  if (typeof app === 'undefined' || !app.isPackaged) return true;
  return Boolean(process.env.NUVIO_DEV_MODE || process.env.NUVIO_URL || process.env.BACKSPACE_URL);
}

/**
 * Returns the resolved official backend URL for Nuvio.
 */
export function getEffectiveBackendUrl(): string {
  // 1. Environment variable override (development / testing)
  const envUrl = process.env.NUVIO_URL || process.env.BACKSPACE_URL;
  if (envUrl) {
    return envUrl.trim().replace(/\/+$/, '');
  }

  // 2. In development mode, check if a custom test URL was configured
  if (isCustomInstanceAllowed()) {
    try {
      const data = JSON.parse(fs.readFileSync(getInstanceUrlPath(), 'utf-8'));
      if (typeof data.url === 'string' && data.url.trim()) {
        return data.url.trim().replace(/\/+$/, '');
      }
    } catch {
      // Ignored
    }
  }

  // 3. Official Nuvio Production Backend
  return DEFAULT_NUVIO_URL;
}

/**
 * Backwards-compatible loader. Always resolves to an effective backend URL,
 * eliminating the required instance picker in public builds.
 */
export function loadInstanceUrl(): string {
  return getEffectiveBackendUrl();
}

export function saveInstanceUrl(url: string): void {
  if (!isCustomInstanceAllowed()) {
    console.warn('[instanceUrl] Custom instance modification is disabled in public release builds.');
    return;
  }
  try {
    fs.writeFileSync(getInstanceUrlPath(), JSON.stringify({ url }));
  } catch (err) {
    console.error('[instanceUrl] Failed to save custom instance URL:', err);
  }
}

export function clearInstanceUrl(): void {
  try {
    fs.unlinkSync(getInstanceUrlPath());
  } catch {
    // File may not exist — ignore
  }
}

export function getSplashPath(): string {
  return path.join(__dirname, '..', 'resources', 'splash.html');
}

export function getPickerPath(): string {
  // In Nuvio, the startup and reconnection surface replaces the raw instance picker
  return getSplashPath();
}

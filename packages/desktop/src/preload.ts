import { contextBridge, ipcRenderer } from 'electron';

// Sync fetch of Nuvio backend configuration
let nuvioConfig = {
  backendUrl: 'https://167-234-239-100.sslip.io',
  wsUrl: 'wss://167-234-239-100.sslip.io',
  backendHost: '167-234-239-100.sslip.io',
  isDesktop: true,
  version: '1.11.0',
};

try {
  const syncConfig = ipcRenderer.sendSync('get-backend-config-sync');
  if (syncConfig && typeof syncConfig === 'object') {
    nuvioConfig = { ...nuvioConfig, ...syncConfig };
  }
} catch {
  // Ignored if sync channel unavailable
}

contextBridge.exposeInMainWorld('nuvioConfig', nuvioConfig);

// Splash Screen helper API
contextBridge.exposeInMainWorld('electronAPI', {
  splashReady: () => ipcRenderer.send('splash-ready'),
  retryConnection: () => ipcRenderer.send('splash-retry'),
  quitApp: () => ipcRenderer.send('close-window'),
  onSplashStatus: (callback: (status: { phase: string; message?: string; retryInSeconds?: number }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, status: any) => callback(status);
    ipcRenderer.on('splash-status', handler);
    return () => { ipcRenderer.removeListener('splash-status', handler); };
  },
});

const desktopApi = {
  // Platform info
  platform: process.platform,
  // Window controls
  minimize: () => {
    ipcRenderer.send('minimize-window');
  },
  maximize: () => {
    ipcRenderer.send('maximize-window');
  },
  close: () => {
    ipcRenderer.send('close-window');
  },

  // Picture-in-Picture (Pop-Out Call) Window
  bringMainWindowToFront: () => {
    ipcRenderer.send('pip-bring-main-to-front');
  },
  setPipAlwaysOnTop: (alwaysOnTop: boolean) => {
    ipcRenderer.send('pip-set-always-on-top', alwaysOnTop);
  },
  isPipAlwaysOnTop: (): Promise<boolean> => {
    return ipcRenderer.invoke('pip-is-always-on-top');
  },
  closePipWindow: () => {
    ipcRenderer.send('pip-close');
  },
  onMainWindowMinimized: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('main-window-minimized', handler);
    return () => { ipcRenderer.removeListener('main-window-minimized', handler); };
  },
  onMainWindowRestored: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('main-window-restored', handler);
    return () => { ipcRenderer.removeListener('main-window-restored', handler); };
  },

  // Notifications & badge
  showNotification: (title: string, body: string, options?: { channelId?: string; spaceId?: string; userId?: string }) => {
    ipcRenderer.send('show-notification', { title, body, options });
  },
  onNotificationClick: (callback: (options: { channelId?: string; spaceId?: string; userId?: string }) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, options: { channelId?: string; spaceId?: string; userId?: string }) => callback(options);
    ipcRenderer.on('notification-click', handler);
    return () => { ipcRenderer.removeListener('notification-click', handler); };
  },
  setBadgeCount: (count: number) => {
    ipcRenderer.send('set-badge-count', count);
  },

  // Auto-update, legacy per-event channels.
  onUpdateAvailable: (callback: (info: { version: string }) => void) => {
    ipcRenderer.on('update-available', (_event, info) => callback(info));
  },
  onUpdateDownloaded: (callback: (info: { version: string }) => void) => {
    ipcRenderer.on('update-downloaded', (_event, info) => callback(info));
  },
  onUpdateError: (callback: (error: { message: string; releaseUrl: string }) => void) => {
    ipcRenderer.on('update-error', (_event, error) => callback(error));
  },
  installUpdate: () => {
    ipcRenderer.send('install-update');
  },
  checkForUpdates: () => {
    ipcRenderer.send('check-for-updates');
  },
  getVersion: () => ipcRenderer.invoke('get-app-version'),

  // Auto-update, current surface. One snapshot carrying the capability of this
  // build, the version the user has already waved away, and the current status.
  getUpdateStatus: (): Promise<unknown> => ipcRenderer.invoke('get-update-status'),
  isSandboxed: (): Promise<boolean> => ipcRenderer.invoke('is-sandboxed'),

  onUpdateStatusChanged: (callback: (snapshot: unknown) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, snapshot: unknown) => callback(snapshot);
    ipcRenderer.on('update-status-changed', handler);
    return () => { ipcRenderer.removeListener('update-status-changed', handler); };
  },

  dismissUpdate: (version: string): void => {
    ipcRenderer.send('dismiss-update', { version });
  },

  openReleasePage: (): void => {
    ipcRenderer.send('open-release-page');
  },

  // Window focus
  onWindowFocusChange: (callback: (focused: boolean) => void) => {
    ipcRenderer.on('window-focus-changed', (_event, focused) => callback(focused));
  },

  // Deep linking
  onDeepLink: (callback: (url: string) => void) => {
    ipcRenderer.on('deep-link', (_event, url) => callback(url));
  },

  // Instance-origin-aware URL routing
  setConnectedOrigins: (origins: string[]) => {
    ipcRenderer.send('set-connected-origins', origins);
  },
  onOpenInternalRoute: (callback: (path: string) => void) => {
    const handler = (_evt: Electron.IpcRendererEvent, path: string) => callback(path);
    ipcRenderer.on('open-internal-route', handler);
    return () => { ipcRenderer.removeListener('open-internal-route', handler); };
  },

  // Screen share picker coordination
  onScreenShareSources: (callback: (sources: unknown[]) => void) => {
    ipcRenderer.on('screen-share-sources', (_event, sources) => callback(sources));
  },
  selectScreenSource: (sourceId: string | null, shareAudio?: boolean) => {
    ipcRenderer.send('screen-share-selected', sourceId, shareAudio ?? true);
  },
  getScreenSources: () => ipcRenderer.invoke('get-screen-sources'),
  preselectScreenSource: (sourceId: string, shareAudio?: boolean) =>
    ipcRenderer.invoke('screen-share-preselect', sourceId, shareAudio ?? true),
  getScreenSharePickerMode: () => ipcRenderer.invoke('get-screen-share-picker-mode'),
  getSystemAudioCapability: (usesAppSource?: boolean) =>
    ipcRenderer.invoke('get-system-audio-capability', usesAppSource === true),
  startSystemAudio: () => ipcRenderer.invoke('system-audio-start'),
  stopSystemAudio: () => ipcRenderer.invoke('system-audio-stop'),
  setScreenShareAudioPreference: (shareAudio: boolean) => {
    ipcRenderer.send('screen-share-audio-preference', shareAudio);
  },

  // Instance URL management
  getInstanceUrl: () => ipcRenderer.invoke('get-instance-url'),
  setInstanceUrl: (url: string) => ipcRenderer.invoke('set-instance-url', url),
  clearInstanceUrl: () => ipcRenderer.invoke('clear-instance-url'),

  // Language: the renderer owns the choice; main relabels its tray and menus.
  setLanguage: (language: string) => ipcRenderer.send('set-language', language),

  // Auto-launch settings
  getAutoLaunchSettings: () => ipcRenderer.invoke('get-auto-launch-settings'),
  setAutoLaunchSettings: (settings: { openAtLogin?: boolean; startMinimized?: boolean }) =>
    ipcRenderer.invoke('set-auto-launch-settings', settings),

  // Activity detection (game/app process scanning)
  onActivityDetected: (callback: (activity: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, activity: unknown) => callback(activity);
    ipcRenderer.on('activity-detected', handler);
    return () => { ipcRenderer.removeListener('activity-detected', handler); };
  },
  getCurrentActivity: () => ipcRenderer.invoke('get-current-activity'),

  // Keybind support
  getKeybindPortalStatus: () => ipcRenderer.invoke('keybind-portal-status'),
  retryKeybindPortal: () => ipcRenderer.send('keybind-portal-retry'),
  onKeybindPortalStatus: (callback: (status: import('./portalShortcut').PortalKeybindStatus) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, status: import('./portalShortcut').PortalKeybindStatus) => callback(status);
    ipcRenderer.on('keybind-portal-status', handler);
    return () => { ipcRenderer.removeListener('keybind-portal-status', handler); };
  },
  syncKeybinds: (keybinds: Array<{ actionId: string; keys: number[]; mouseButton?: number }>) => {
    return ipcRenderer.invoke('keybinds-sync', keybinds);
  },
  onKeybindAction: (callback: (action: { actionId: string; pressed: boolean }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, action: { actionId: string; pressed: boolean }) => callback(action);
    ipcRenderer.on('keybind-action', handler);
    return () => { ipcRenderer.removeListener('keybind-action', handler); };
  },
  onAccessibilityStatus: (callback: (status: { trusted: boolean }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, status: { trusted: boolean }) => callback(status);
    ipcRenderer.on('accessibility-status', handler);
    return () => { ipcRenderer.removeListener('accessibility-status', handler); };
  },
  onKeybindHookError: (callback: (error: { message: string }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, error: { message: string }) => callback(error);
    ipcRenderer.on('keybind-hook-error', handler);
    return () => { ipcRenderer.removeListener('keybind-hook-error', handler); };
  },
  checkAccessibility: () => ipcRenderer.invoke('check-accessibility'),

  // Recovery mode bridge
  rendererReady: (): void => {
    ipcRenderer.send('renderer-ready');
  },

  getRecoveryState: (): Promise<unknown> => {
    return ipcRenderer.invoke('get-recovery-state');
  },

  onRecoveryStateChanged: (cb: (state: unknown) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, state: unknown) => cb(state);
    ipcRenderer.on('recovery-state-changed', handler);
    return () => { ipcRenderer.removeListener('recovery-state-changed', handler); };
  },

  recoveryAction: (action: string): void => {
    ipcRenderer.send('recovery-action', action);
  },
};

// Expose both Nuvio and Backspace names for 100% interoperability
contextBridge.exposeInMainWorld('nuvio', desktopApi);
contextBridge.exposeInMainWorld('backspace', desktopApi);

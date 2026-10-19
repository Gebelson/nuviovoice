import {
  app,
  BrowserWindow,
  Tray,
  Menu,
  Notification,
  nativeImage,
  ipcMain,
  shell,
  screen,
  session,
  desktopCapturer,
  protocol,
  net,
} from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { pathToFileURL } from 'url';
import { startActivityDetection, stopActivityDetection, getCurrentActivity } from './activityDetector';
import { KeybindManager } from './keybindManager';
import { deriveStartMinimizedFromArgs, parseExecPathFromDesktopFile, shouldReapplyAppImage } from './autoLaunch';
import {
  loadInstanceUrl,
  saveInstanceUrl,
  clearInstanceUrl,
  getPickerPath,
  getSplashPath,
  getEffectiveBackendUrl,
  DEFAULT_NUVIO_URL,
} from './instanceUrl';
import { getUpdateCapability, isSandboxed } from './updateCapability';
import { ownAudioInSystemAudio } from './systemAudioCapability';
import { createSystemAudioController, withSystemAudioSource, type PatchBayModule } from './systemAudio';
import { loadDismissedVersion, setDismissedVersion } from './updateDismissal';
import { purgeUpdaterCache } from './updaterCache';
import {
  UpdateStatusStore,
  RELEASES_URL,
  shouldPromptForUpdate,
  statusVersion,
  type UpdateSnapshot,
} from './updateStatus';
import {
  recoveryStore,
  attachRecoveryHandlers,
  extractErrorCode,
  setAutoUpdater,
  setMainWindow,
  setOnQuitRequested,
  handleRendererReady,
  handleRecoveryAction,
  isValidRecoveryAction,
  buildTrayMenuTemplate,
  buildAppMenuTemplate,
  type RecoveryState,
} from './recovery';
import { migrateUserData } from './userDataMigration';
import { isNavigationAllowed } from './navigationPolicy';
import { NotificationRetainer } from './notificationRetention';
import {
  screenSharePickerMode,
  isPendingSelectionFresh,
  screenEnumerationDecision,
  type PendingScreenSelection,
  type ScreenSharePickerMode,
} from './screenSharePolicy';
import { getDesktopLanguage, isDesktopLanguage, saveStoredLanguage, translateDesktop } from './l10n';

// Override Electron's package.json-derived app name so userData lives at
// "<appData>/Nuvio" instead of leaking the monorepo's "@concord/desktop"
// package name. Must run before any app.getPath('userData') consumer.
app.setName('Nuvio');

// Register custom scheme 'nuvio-app' as privileged before app is ready
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'nuvio-app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
      allowServiceWorkers: true,
    },
  },
]);

// One-time migration from the historical scoped path. After the move the old
// folder is gone, so subsequent launches hit the old-missing no-op branch.
{
  const appDataDir = app.getPath('appData');
  const oldParent = path.join(appDataDir, '@backspace');
  const result = migrateUserData({
    oldDir: path.join(oldParent, 'desktop'),
    newDir: path.join(appDataDir, 'Nuvio'),
    oldParent,
  });
  if (result.kind === 'migrated') {
    console.log(`[userData] migrated ${result.from} → ${result.to}`);
  } else if (result.kind === 'failed') {
    console.error('[userData] migration failed:', result.error);
  }
}

let mainWindow: BrowserWindow | null = null;
let pipWindow: BrowserWindow | null = null;
const keybindManager = new KeybindManager();
let tray: Tray | null = null;
let isQuitting = false;
let pendingDeepLink: string | null = null;

const knownInstanceOrigins = new Set<string>();
try {
  knownInstanceOrigins.add(new URL(getEffectiveBackendUrl()).origin);
  knownInstanceOrigins.add('nuvio-app://app');
  knownInstanceOrigins.add('https://nuviovoice.vercel.app');
} catch {}

function getWebDistPath(): string {
  const candidateAsar = path.join(__dirname, '..', 'web-dist');
  const candidateUnpackedApp = path.join(process.resourcesPath, 'app', 'web-dist');
  if (
    fs.existsSync(candidateUnpackedApp) &&
    fs.existsSync(path.join(candidateUnpackedApp, 'index.html'))
  ) {
    try {
      const mtimeUnpacked = fs.statSync(path.join(candidateUnpackedApp, 'index.html')).mtimeMs;
      const mtimeAsar = fs.existsSync(path.join(candidateAsar, 'index.html'))
        ? fs.statSync(path.join(candidateAsar, 'index.html')).mtimeMs
        : 0;
      if (mtimeUnpacked >= mtimeAsar) return candidateUnpackedApp;
    } catch {
      return candidateUnpackedApp;
    }
  }
  if (fs.existsSync(candidateAsar)) return candidateAsar;
  const candidate2 = path.join(app.getAppPath(), 'web-dist');
  if (fs.existsSync(candidate2)) return candidate2;
  const candidate3 = path.join(process.resourcesPath, 'web-dist');
  if (fs.existsSync(candidate3)) return candidate3;
  return candidateAsar;
}

let checkConnectivityInProgress = false;

async function checkAndLaunchApp(attempt = 1): Promise<void> {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (checkConnectivityInProgress) return;
  checkConnectivityInProgress = true;

  try {
    mainWindow.webContents.send('splash-status', {
      phase: 'connecting',
      message: 'Conectando aos servidores do Nuvio...',
    });

    const backendUrl = getEffectiveBackendUrl();
    const probeController = new AbortController();
    const probeTimeout = setTimeout(() => probeController.abort(), 6000);
    const res = await net.fetch(`${backendUrl}/api/instance/info`, {
      method: 'GET',
      signal: probeController.signal,
    }).catch(() => null);
    clearTimeout(probeTimeout);

    if (res && (res.ok || res.status === 200 || res.status === 304)) {
      mainWindow.webContents.send('splash-status', {
        phase: 'ready',
        message: 'Conectado! Abrindo Nuvio...',
      });

      setTimeout(() => {
        if (!mainWindow || mainWindow.isDestroyed()) return;
        mainWindow.loadURL('nuvio-app://app/');
      }, 350);
      checkConnectivityInProgress = false;
      return;
    }
  } catch (err) {
    console.error('[main] Connectivity probe error:', err);
  }

  checkConnectivityInProgress = false;
  const retryDelaySec = Math.min(5 + (attempt - 1) * 3, 15);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('splash-status', {
      phase: 'offline',
      retryInSeconds: retryDelaySec,
      message: 'Servidores temporariamente inacessíveis',
    });
  }
}

// ─── AGPL-3.0 § 13 source offer ─────────────────────────────────────────────
// Upstream fallback for the "Source code" menu items and the About panel.
// Used when the connected instance can't be reached or advertises no source URL.
const UPSTREAM_SOURCE_URL = 'https://github.com/Gebelson/nuviovoice';

/**
 * Resolve the Corresponding Source URL for the instance the desktop app is
 * pointed at, honouring an operator's modified fork via GET /api/instance/info.
 * Falls back to the upstream repo when no instance is loaded or the probe fails.
 */
async function resolveSourceUrl(): Promise<string> {
  let base: string | null = process.env.BACKSPACE_URL ?? getEffectiveBackendUrl();
  if (!base && mainWindow && !mainWindow.isDestroyed()) {
    const current = mainWindow.webContents.getURL();
    if (current.startsWith('http://') || current.startsWith('https://')) base = current;
  }
  if (!base) return UPSTREAM_SOURCE_URL;

  try {
    const origin = new URL(base).origin;
    const res = await fetch(`${origin}/api/instance/info`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return UPSTREAM_SOURCE_URL;
    const info = (await res.json()) as { sourceCodeUrl?: unknown };
    if (typeof info.sourceCodeUrl === 'string' && /^https?:\/\//i.test(info.sourceCodeUrl)) {
      return info.sourceCodeUrl;
    }
  } catch {
    // Unreachable / malformed — fall back to upstream.
  }
  return UPSTREAM_SOURCE_URL;
}

/** Open the resolved source URL externally; upstream fallback on any failure. */
function openSourceCode(): void {
  resolveSourceUrl()
    .then((url) => shell.openExternal(url))
    .catch(() => { void shell.openExternal(UPSTREAM_SOURCE_URL); });
}

// ─── Window State Persistence ───────────────────────────────────────────────

interface WindowState {
  width: number;
  height: number;
  x?: number;
  y?: number;
  isMaximized: boolean;
}

const DEFAULT_WINDOW_STATE: WindowState = {
  width: 1280,
  height: 800,
  isMaximized: false,
};

function getWindowStatePath(): string {
  return path.join(app.getPath('userData'), 'window-state.json');
}

function loadWindowState(): WindowState {
  try {
    const raw = fs.readFileSync(getWindowStatePath(), 'utf-8');
    const parsed = JSON.parse(raw) as Partial<WindowState>;
    return {
      width: typeof parsed.width === 'number' ? parsed.width : DEFAULT_WINDOW_STATE.width,
      height: typeof parsed.height === 'number' ? parsed.height : DEFAULT_WINDOW_STATE.height,
      x: typeof parsed.x === 'number' ? parsed.x : undefined,
      y: typeof parsed.y === 'number' ? parsed.y : undefined,
      isMaximized: typeof parsed.isMaximized === 'boolean' ? parsed.isMaximized : false,
    };
  } catch {
    return { ...DEFAULT_WINDOW_STATE };
  }
}

function validateWindowBounds(state: WindowState): WindowState {
  if (state.x === undefined || state.y === undefined) return state;

  const bounds = { x: state.x, y: state.y, width: state.width, height: state.height };
  const display = screen.getDisplayMatching(bounds);
  const { x, y, width, height } = display.workArea;

  // Check if window is at least partially visible on the display
  const visible =
    bounds.x + bounds.width > x &&
    bounds.x < x + width &&
    bounds.y + bounds.height > y &&
    bounds.y < y + height;

  if (!visible) {
    // Strip position — let Electron auto-center
    return { width: state.width, height: state.height, isMaximized: state.isMaximized };
  }

  return state;
}

function saveWindowState(win: BrowserWindow): void {
  try {
    const isMaximized = win.isMaximized();
    // Use the bounds from before maximize, to restore the un-maximized size
    const bounds = isMaximized ? win.getNormalBounds() : win.getBounds();
    const state: WindowState = {
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y,
      isMaximized,
    };
    fs.writeFileSync(getWindowStatePath(), JSON.stringify(state));
  } catch {
    // Non-critical — silently ignore write failures
  }
}

// ─── Auto-Launch Settings ────────────────────────────────────────────────────

interface AutoLaunchSettings {
  openAtLogin: boolean;
  startMinimized: boolean;
}

const DEFAULT_AUTO_LAUNCH: AutoLaunchSettings = {
  openAtLogin: false,
  startMinimized: true,
};

function getAutoLaunchSettingsPath(): string {
  return path.join(app.getPath('userData'), 'auto-launch.json');
}

function loadAutoLaunchSettings(): AutoLaunchSettings {
  try {
    const raw = fs.readFileSync(getAutoLaunchSettingsPath(), 'utf-8');
    const parsed = JSON.parse(raw) as Partial<AutoLaunchSettings>;
    return {
      openAtLogin: typeof parsed.openAtLogin === 'boolean' ? parsed.openAtLogin : DEFAULT_AUTO_LAUNCH.openAtLogin,
      startMinimized: typeof parsed.startMinimized === 'boolean' ? parsed.startMinimized : DEFAULT_AUTO_LAUNCH.startMinimized,
    };
  } catch {
    return { ...DEFAULT_AUTO_LAUNCH };
  }
}

function saveAutoLaunchSettings(settings: AutoLaunchSettings): void {
  fs.writeFileSync(getAutoLaunchSettingsPath(), JSON.stringify(settings));
}

function applyLoginItemSettings(openAtLogin: boolean, startMinimized: boolean): void {
  if (process.platform === 'darwin') {
    // macOS: pass `args` in addition to `openAsHidden` so the renderer/main can
    // detect a hidden launch via `process.argv.includes('--hidden')` on macOS 13+
    // where the new ServiceManagement-backed implementation may not honour
    // `wasOpenedAsHidden`. Both detection paths now work (defence in depth).
    app.setLoginItemSettings({
      openAtLogin,
      openAsHidden: startMinimized,
      args: startMinimized ? ['--hidden'] : [],
    });
  } else if (process.platform === 'win32') {
    // Windows: `enabled` is REQUIRED to undo a Task-Manager-side disable.
    // Without it, re-enabling our toggle leaves the StartupApproved\Run
    // "disabled" marker in place and the user's Run entry still won't fire.
    // We pass `enabled: openAtLogin` so toggling ON re-enables, toggling OFF
    // removes the entry entirely (deletion supersedes the disable marker).
    // `path` and `args` are passed explicitly so subsequent get() calls can
    // match the right launchItems[] entry.
    app.setLoginItemSettings({
      openAtLogin,
      enabled: openAtLogin,
      path: process.execPath,
      args: startMinimized ? ['--hidden'] : [],
      name: 'Nuvio',
    });
  } else {
    // Linux: setLoginItemSettings creates ~/.config/autostart/<name>.desktop.
    // - We pass an explicit `name: 'backspace'` so the filename is deterministic
    //   across deb/AppImage installs and Electron versions.
    // - For AppImage, $APPIMAGE points to the (possibly newly-updated) AppImage
    //   path; pass it as `path` so the autostart entry tracks updates.
    //   Electron's TypeScript types don't list `path`/`args`/`name` on Linux,
    //   but the runtime accepts them.
    const opts: Record<string, unknown> = {
      openAtLogin,
      name: 'backspace',
    };
    if (process.env.APPIMAGE) {
      opts.path = process.env.APPIMAGE;
    }
    if (startMinimized) {
      opts.args = ['--hidden'];
    }
    app.setLoginItemSettings(opts as Electron.Settings);
  }
}

// ─── Tray Icon ──────────────────────────────────────────────────────────────

function generateFallbackTrayIcon(): Electron.NativeImage {
  const size = 16;
  const canvas = Buffer.alloc(size * size * 4);
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 1;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (dist <= r) {
        // NativeImage raw buffer uses BGRA on most platforms
        canvas[idx] = 0xf6;     // B (#7c6cf6)
        canvas[idx + 1] = 0x6c; // G
        canvas[idx + 2] = 0x7c; // R
        canvas[idx + 3] = 0xff; // A
      } else {
        canvas[idx] = 0;
        canvas[idx + 1] = 0;
        canvas[idx + 2] = 0;
        canvas[idx + 3] = 0;
      }
    }
  }
  return nativeImage.createFromBuffer(canvas, { width: size, height: size });
}

function loadTrayIcon(): Electron.NativeImage {
  const resourcesDir = path.join(__dirname, '..', 'resources');
  try {
    if (process.platform === 'darwin') {
      // macOS template image: Electron auto-resolves @2x from the base path.
      // Template images adapt to light/dark menu bar automatically.
      const templatePath = path.join(resourcesDir, 'tray-iconTemplate.png');
      const icon = nativeImage.createFromPath(templatePath);
      if (!icon.isEmpty()) {
        icon.setTemplateImage(true);
        return icon;
      }
    } else if (process.platform === 'win32') {
      // Windows: multi-size .ico — Windows + Electron auto-pick best size for current DPI.
      const icoPath = path.join(resourcesDir, 'tray-icon.ico');
      const icon = nativeImage.createFromPath(icoPath);
      if (!icon.isEmpty()) {
        return icon;
      }
    } else {
      // Linux: single 22x22 PNG (AppIndicator / StatusNotifier convention).
      // No runtime resize — the source is already at correct tray size.
      const iconPath = path.join(resourcesDir, 'tray-icon.png');
      const icon = nativeImage.createFromPath(iconPath);
      if (!icon.isEmpty()) {
        return icon;
      }
    }
  } catch {
    // Fall through to generated icon
  }
  return generateFallbackTrayIcon();
}

// ─── Window & Tray Creation ─────────────────────────────────────────────────

function resolveWindowIcon(): string {
  const fileName = process.platform === 'win32' ? 'icon.ico' : 'icon.png';
  const candidates = [
    path.join(__dirname, '..', 'resources', fileName),
    path.join(__dirname, '..', 'build', fileName),
    path.join(process.resourcesPath, 'app', 'resources', fileName),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return path.join(__dirname, '..', 'resources', 'icon.png');
}

function createWindow(): void {
  const savedState = validateWindowBounds(loadWindowState());
  const windowIconPath = resolveWindowIcon();

  mainWindow = new BrowserWindow({
    width: savedState.width,
    height: savedState.height,
    ...(savedState.x !== undefined && savedState.y !== undefined
      ? { x: savedState.x, y: savedState.y }
      : {}),
    minWidth: 940,
    minHeight: 500,
    title: 'Nuvio',
    icon: windowIconPath,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    ...(process.platform !== 'darwin' ? {
      titleBarOverlay: {
        color: '#0E1015',
        symbolColor: '#8E9297',
        height: 32,
      },
    } : {}),
    backgroundColor: '#0E1015',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  setMainWindow(mainWindow);
  attachRecoveryHandlers(mainWindow);
  keybindManager.setWindow(mainWindow);

  if (savedState.isMaximized) {
    mainWindow.maximize();
  }

  // Load the Nuvio splash screen initially
  mainWindow.loadFile(getSplashPath());

  mainWindow.once('ready-to-show', () => {
    // Hidden-launch detection. We pass `args: ['--hidden']` on all three platforms
    // (see applyLoginItemSettings), so the argv check is the primary signal. On
    // macOS we also honour `wasOpenedAsHidden` as a fallback for the legacy
    // openAsHidden path on macOS < 13.
    const launchedHidden =
      process.argv.includes('--hidden') ||
      (process.platform === 'darwin' && app.getLoginItemSettings().wasOpenedAsHidden);

    if (!launchedHidden) {
      mainWindow?.show();
    }

    // Send any pending deep link that launched the app
    if (pendingDeepLink && mainWindow) {
      mainWindow.webContents.send('deep-link', pendingDeepLink);
      pendingDeepLink = null;
    }

    // Safety fallback: ensure connectivity probe begins if splash-ready is delayed
    setTimeout(() => {
      if (!checkConnectivityInProgress && mainWindow && !mainWindow.isDestroyed()) {
        const curUrl = mainWindow.webContents.getURL();
        if (curUrl.includes('splash.html') || curUrl.includes('file:')) {
          void checkAndLaunchApp(1);
        }
      }
    }, 800);
  });

  // Window state persistence — debounced save on resize/move
  let saveTimeout: ReturnType<typeof setTimeout> | null = null;
  const debouncedSave = () => {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        saveWindowState(mainWindow);
      }
    }, 300);
  };

  mainWindow.on('resize', debouncedSave);
  mainWindow.on('move', debouncedSave);

  mainWindow.on('close', (event) => {
    // Save state before close
    if (mainWindow && !mainWindow.isDestroyed()) {
      saveWindowState(mainWindow);
    }

    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  // The renderer owns the system-audio link and cannot release it when it is reloaded, navigated
  // away or killed, so the main process does. Only once the page is really replaced: a
  // navigation that only starts may still be refused by will-navigate below or turn into a
  // download, and the page that keeps running may be sharing. `did-navigate` fires for a
  // committed cross-document main-frame load; `did-fail-load` for the main frame is the error
  // page that replaced it (-3, ERR_ABORTED, is a cancelled navigation that replaced nothing).
  mainWindow.webContents.on('render-process-gone', () => systemAudio.stop());
  mainWindow.webContents.on('did-navigate', () => systemAudio.stop());
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, _description, _url, isMainFrame) => {
    if (isMainFrame && errorCode !== -3) systemAudio.stop();
  });

  mainWindow.on('closed', () => {
    systemAudio.stop();
    setMainWindow(null);
    mainWindow = null;
    // Clear recovery state so macOS dock-activate (which calls createWindow again)
    // gets a clean slate. Without this, the new window inherits inRecoveryMode=true
    // and the recovery surface is silently lost.
    recoveryStore.markRecoveryExited();
    recoveryStore.update({ mode: 'normal', reason: null });
  });

  // Window focus IPC for notification suppression
  mainWindow.on('focus', () => {
    mainWindow?.webContents.send('window-focus-changed', true);
  });
  mainWindow.on('blur', () => {
    mainWindow?.webContents.send('window-focus-changed', false);
  });
  mainWindow.on('minimize', () => {
    mainWindow?.webContents.send('main-window-minimized');
  });
  mainWindow.on('restore', () => {
    mainWindow?.webContents.send('main-window-restored');
  });

  // Intercept window opens: allow Document Picture-in-Picture / about:blank popouts
  mainWindow.webContents.setWindowOpenHandler((details) => {
    const { url, disposition, features } = details;
    // Allow Document Picture-in-Picture and blank pop-out windows
    if (url === 'about:blank' || url === '' || features?.includes('document-pip') || disposition === 'new-window') {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          title: 'Nuvio — Chamada',
          icon: windowIconPath,
          backgroundColor: '#0E1015',
          minWidth: 320,
          minHeight: 180,
          alwaysOnTop: true,
          autoHideMenuBar: true,
          frame: true,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
          },
        },
      };
    }

    try {
      const u = new URL(url);
      if (
        (u.protocol === 'http:' || u.protocol === 'https:') &&
        knownInstanceOrigins.has(u.origin) &&
        (u.pathname.startsWith('/join/') || u.pathname.startsWith('/invite/') || u.pathname.startsWith('/voice/invite/'))
      ) {
        mainWindow?.webContents.send('open-internal-route', u.pathname + u.search);
        return { action: 'deny' };
      }
    } catch { /* malformed URL — fall through to external */ }
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('did-create-window', (childWindow) => {
    pipWindow = childWindow;
    childWindow.setMenu(null);
    childWindow.setTitle('Nuvio — Chamada');
    childWindow.setAlwaysOnTop(true, 'screen-saver');
    try {
      // Exclude from screen share / screen capture to prevent infinite mirror feedback loop
      childWindow.setContentProtection(true);
    } catch {}

    childWindow.on('closed', () => {
      pipWindow = null;
    });
  });

  // Deny foreign top-level navigations. See navigationPolicy.ts for the
  // mechanism note on why this is safe for the initial instance load, the
  // file:// picker, and cross-instance switching (none of them are
  // `will-navigate` events). setWindowOpenHandler above is unaffected — this
  // only covers same-window top-level navigation, not new-window/tab opens.
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const allowed = isNavigationAllowed({
      targetUrl: url,
      currentUrl: mainWindow?.webContents.getURL() ?? null,
      pickerFileUrl: pathToFileURL(getPickerPath()).href,
      knownInstanceOrigins,
    });
    if (!allowed) {
      console.warn(`[main] Blocked will-navigate to disallowed target: ${url}`);
      event.preventDefault();
    }
  });
}

function createTray(): void {
  const icon = loadTrayIcon();
  tray = new Tray(icon);

  tray.setToolTip('Nuvio');
  // Context menu is set by the recoveryStore subscriber in app.whenReady,
  // which keeps the menu in sync with update/recovery state.

  tray.on('click', () => {
    if (mainWindow?.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow?.show();
      mainWindow?.focus();
    }
  });
}

// ─── Notifications ──────────────────────────────────────────────────────────

/**
 * Every shown notification stays referenced until it is clicked, closed or
 * fails. Without it the object can be garbage-collected while the toast is
 * still up, and on Windows the click is then dropped (#394).
 */
const shownNotifications = new NotificationRetainer<Notification>();

function showNotification(title: string, body: string, onClick?: () => void): void {
  if (!Notification.isSupported()) return;
  const notification = new Notification({ title, body, silent: false });
  notification.on('click', onClick ?? (() => {
    mainWindow?.show();
    mainWindow?.focus();
  }));
  notification.on('failed', (_event, error) => {
    console.warn('[notifications] a notification could not be shown:', error);
  });
  shownNotifications.retain(notification);
  notification.show();
}

// ─── IPC Handlers ───────────────────────────────────────────────────────────

// ---------------------------------------------------------------------------
// Screen share sources
// ---------------------------------------------------------------------------

interface SerializedScreenSource {
  id: string;
  name: string;
  thumbnailDataUrl: string;
  appIconDataUrl: string | null;
  isScreen: boolean;
}

let pendingScreenSelection: PendingScreenSelection | null = null;
/** Loopback preference for system-picker captures (no preselection carries it there). */
let lastSystemPickerShareAudio: boolean | null = null;

// Linux: a system-audio capture built from PipeWire without Backspace's own
// streams (systemAudio.ts). The module is optional and Linux-only, so it is
// loaded on first use; where it is unavailable the Chromium loopback stays.
const systemAudio = createSystemAudioController({
  platform: process.platform,
  // Optional, Linux-only native module: a static import would fail to load elsewhere.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  loadModule: () => require('@vencord/venmic') as PatchBayModule,
  getPids: () => app.getAppMetrics().map((metric) => metric.pid),
  executablePath: process.execPath,
  isSandboxed,
  log: (message, ...args) => console.warn('[Main:SystemAudio]', message, ...args),
});
/** Last enumeration, so a preselected id resolves to its DesktopCapturerSource without a second scan. */
let lastScreenSources: Electron.DesktopCapturerSource[] = [];
/** Last list handed to the renderer, and when: what a throttled or unfocused caller gets back. */
let lastServedScreenSources: SerializedScreenSource[] = [];
let lastScreenEnumerationAt: number | null = null;

async function enumerateScreenSources(): Promise<Electron.DesktopCapturerSource[]> {
  const sources = await desktopCapturer.getSources({
    types: ['screen', 'window'],
    thumbnailSize: { width: 320, height: 180 },
    fetchWindowIcons: true,
  });
  lastScreenSources = sources;
  return sources;
}

function serializeScreenSources(sources: Electron.DesktopCapturerSource[]): SerializedScreenSource[] {
  return sources.map((source) => ({
    id: source.id,
    name: source.name,
    thumbnailDataUrl: source.thumbnail.toDataURL(),
    appIconDataUrl: source.appIcon && !source.appIcon.isEmpty() ? source.appIcon.toDataURL() : null,
    isScreen: source.id.startsWith('screen:'),
  }));
}

function currentPickerMode(): ScreenSharePickerMode {
  return screenSharePickerMode(process.platform, process.env);
}

/** One-shot: returns and clears the pending preselection, or null when absent or stale. */
function takePendingScreenSelection(): PendingScreenSelection | null {
  const pending = pendingScreenSelection;
  pendingScreenSelection = null;
  return isPendingSelectionFresh(pending, Date.now()) ? pending : null;
}

function registerIpcHandlers(): void {
  ipcMain.on('show-notification', (event, data: { title: string; body: string; options?: { channelId?: string; spaceId?: string; userId?: string } }) => {
    if (event.sender !== mainWindow?.webContents) return;
    const sender = event.sender;
    const origin = new URL(sender.getURL()).origin;
    showNotification(data.title, data.body, () => {
      if (!mainWindow || mainWindow.isDestroyed() || sender.isDestroyed()) return;
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
      // A toast from a previous home instance must not open IDs on the new one.
      if (sender === mainWindow.webContents && new URL(sender.getURL()).origin === origin && data.options) {
        sender.send('notification-click', data.options);
      }
    });
  });

  ipcMain.on('set-badge-count', (_event, count: number) => {
    if (app.setBadgeCount) {
      app.setBadgeCount(count);
    }
  });

  ipcMain.on('minimize-window', () => {
    mainWindow?.minimize();
  });

  ipcMain.on('maximize-window', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });

  ipcMain.on('close-window', () => {
    mainWindow?.close();
  });

  // ─── Picture-in-Picture (Pop-Out Call) Window IPC ───────────────────────────
  ipcMain.on('pip-bring-main-to-front', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.show();
      mainWindow.focus();
    }
  });

  ipcMain.on('pip-set-always-on-top', (_event, flag: boolean) => {
    if (pipWindow && !pipWindow.isDestroyed()) {
      pipWindow.setAlwaysOnTop(flag, 'screen-saver');
    }
  });

  ipcMain.handle('pip-is-always-on-top', () => {
    return pipWindow && !pipWindow.isDestroyed() ? pipWindow.isAlwaysOnTop() : true;
  });

  ipcMain.on('pip-close', () => {
    if (pipWindow && !pipWindow.isDestroyed()) {
      pipWindow.close();
    }
  });

  // Connected-origins sync — renderer pushes the current set of instance origins
  // so setWindowOpenHandler can route /join/* URLs in-app synchronously.
  ipcMain.on('set-connected-origins', (_evt, origins: unknown) => {
    if (!Array.isArray(origins)) return;
    knownInstanceOrigins.clear();
    for (const o of origins) {
      if (typeof o === 'string' && o.length > 0) knownInstanceOrigins.add(o);
    }
  });

  // Nuvio official backend configuration sync
  ipcMain.on('get-backend-config-sync', (event) => {
    const backendUrl = getEffectiveBackendUrl();
    let host = '167-234-239-100.sslip.io';
    let wsProto = 'wss:';
    try {
      const parsed = new URL(backendUrl);
      host = parsed.host;
      wsProto = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
    } catch {}
    event.returnValue = {
      backendUrl,
      wsUrl: `${wsProto}//${host}`,
      backendHost: host,
      isDesktop: true,
      version: app.getVersion(),
      buildId: `nuvio-${app.getVersion()}-${process.platform}-${process.arch}`,
      updateChannel: 'stable',
    };
  });

  // Splash screen lifecycle IPC
  ipcMain.on('splash-ready', () => {
    void checkAndLaunchApp(1);
  });

  ipcMain.on('splash-retry', () => {
    void checkAndLaunchApp(1);
  });

  // Instance URL management
  ipcMain.handle('get-instance-url', () => loadInstanceUrl());

  ipcMain.handle('set-instance-url', (_event, url: string) => {
    saveInstanceUrl(url);
    if (mainWindow) {
      mainWindow.loadURL(url);
      // Force Electron to re-evaluate drag regions after navigation
      mainWindow.webContents.once('did-finish-load', () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          const bounds = mainWindow.getBounds();
          mainWindow.setSize(bounds.width + 1, bounds.height);
          mainWindow.setSize(bounds.width, bounds.height);
        }
      });
    }
  });

  ipcMain.handle('clear-instance-url', () => {
    clearInstanceUrl();
    if (mainWindow) {
      mainWindow.loadFile(getPickerPath(), { query: { lang: getDesktopLanguage() } });
      // Force Electron to re-evaluate drag regions after navigation
      mainWindow.webContents.once('did-finish-load', () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          const bounds = mainWindow.getBounds();
          mainWindow.setSize(bounds.width + 1, bounds.height);
          mainWindow.setSize(bounds.width, bounds.height);
        }
      });
    }
  });

  // Auto-update IPC
  ipcMain.on('install-update', () => {
    const store = getUpdateStore();
    const snapshot = store.get();

    // A build that cannot install in place has no in-place install to run. Send
    // the user to the download instead of calling a method that returns without
    // doing anything, which is the defect this whole path exists to remove.
    if (snapshot.capability === 'external') return;
    if (snapshot.capability === 'manual') {
      void shell.openExternal(RELEASES_URL);
      return;
    }

    try {
      const { autoUpdater } = require('electron-updater');
      autoUpdater.quitAndInstall();
    } catch {
      store.setStatus({
        phase: 'failed',
        version: statusVersion(snapshot.status),
        message: 'The updater is not available in this build.',
      });
      return;
    }

    // If the install started, the app is gone before this fires. If it did not,
    // the user is still looking at a Restart button that appears to have done
    // nothing, and now the app says so instead of leaving them guessing.
    setTimeout(() => {
      const current = getUpdateStore().get();
      if (current.status.phase !== 'ready') return;
      getUpdateStore().setStatus({
        phase: 'failed',
        version: statusVersion(current.status),
        message: 'Restarting to install the update did not start.',
      });
    }, INSTALL_WATCHDOG_MS);
  });

  ipcMain.on('check-for-updates', () => {
    void triggerUpdateCheck();
  });

  ipcMain.handle('get-update-status', () => getUpdateStore().get());

  // Sandbox restrictions are independent of update capability. A package may
  // delegate updates while still supporting host login-item registration.
  ipcMain.handle('is-sandboxed', () => isSandboxed());

  ipcMain.on('dismiss-update', (_event, payload: { version?: unknown }) => {
    const version = typeof payload?.version === 'string' ? payload.version.trim() : '';
    if (version === '') return;
    setDismissedVersion(version);
    // Read back rather than assume. If the write failed, the store keeps the old
    // value and the prompt honestly reappears next launch instead of silently
    // vanishing from a user who would then never see the update again.
    getUpdateStore().setDismissedVersion(loadDismissedVersion());
  });

  ipcMain.on('open-release-page', () => {
    void shell.openExternal(RELEASES_URL);
  });

  ipcMain.handle('get-app-version', () => app.getVersion());

  // Screen share picker coordination (used by setDisplayMediaRequestHandler)
  ipcMain.on('screen-share-selected', (_event, _sourceId: string | null, _shareAudio?: boolean) => {
    // Handled via ipcMain.once in the display media handler — this is just
    // a safety net to prevent unhandled-message warnings
  });
  // Setup-screen flow: the renderer lists sources up front, and preselects one
  // right before it calls getDisplayMedia(); the handler answers from that.
  // Thumbnails of every open window are pixel data, and the renderer runs the
  // instance's web client — remote code. `screenEnumerationDecision` states the
  // policy: the app's own window only, focused only, and no faster than the
  // cache window, so a page polling on a timer cannot quietly photograph
  // whatever the user switched to.
  ipcMain.handle('get-screen-sources', async (event): Promise<SerializedScreenSource[]> => {
    const decision = screenEnumerationDecision({
      fromMainWindow: event.sender === mainWindow?.webContents,
      windowFocused: mainWindow?.isFocused() ?? false,
      lastEnumeratedAt: lastScreenEnumerationAt,
      now: Date.now(),
    });
    if (decision === 'deny') return [];
    if (decision === 'serve-cache') return lastServedScreenSources;
    lastServedScreenSources = serializeScreenSources(await enumerateScreenSources());
    lastScreenEnumerationAt = Date.now();
    return lastServedScreenSources;
  });
  ipcMain.handle('get-screen-share-picker-mode', (event) => {
    if (event.sender !== mainWindow?.webContents) return 'app';
    return currentPickerMode();
  });
  // Whether System Audio on this OS build carries Backspace's own playback
  // (the call) to viewers; the stream settings say so before it is turned on.
  ipcMain.handle('get-system-audio-capability', (event, clientUsesSource: unknown) => {
    if (event.sender !== mainWindow?.webContents) return 'unknown';
    return withSystemAudioSource(
      ownAudioInSystemAudio(process.platform, process.getSystemVersion()),
      clientUsesSource,
      () => systemAudio.isAvailable(),
    );
  });
  // The virtual source that carries every other app's playback (Linux). The
  // renderer opens it like a microphone and calls stop when the share, or its
  // audio, ends.
  ipcMain.handle('system-audio-start', (event) => {
    if (event.sender !== mainWindow?.webContents) return { ok: false, reason: 'unsupported-platform' };
    return systemAudio.start();
  });
  ipcMain.handle('system-audio-stop', (event) => {
    if (event.sender !== mainWindow?.webContents) return;
    systemAudio.stop();
  });
  // handle, not on: the renderer awaits this before calling getDisplayMedia(),
  // so the selection is guaranteed to be armed when the display-media handler
  // runs. Fire-and-forget left the two unordered — the handler could win, fall
  // back to the prompted flow, and leave this armed to hijack the next share.
  ipcMain.handle('screen-share-preselect', (event, sourceId: string, shareAudio?: boolean) => {
    if (event.sender !== mainWindow?.webContents) return;
    if (typeof sourceId !== 'string' || !sourceId) return;
    pendingScreenSelection = { sourceId, shareAudio: shareAudio === true, at: Date.now() };
  });
  // System-picker sessions have no tile to preselect; the renderer only tells
  // us whether loopback audio should ride along with whatever the portal returns.
  ipcMain.on('screen-share-audio-preference', (event, shareAudio?: boolean) => {
    if (event.sender !== mainWindow?.webContents) return;
    lastSystemPickerShareAudio = shareAudio === true;
  });

  // Auto-launch settings
  ipcMain.handle('get-auto-launch-settings', (): { openAtLogin: boolean; startMinimized: boolean } => {
    if (isSandboxed()) {
      return { openAtLogin: false, startMinimized: false };
    }

    if (process.platform === 'win32') {
      // Pass path/args so getLoginItemSettings can find the matching launchItems[] entry.
      // We can't know in advance whether the user's saved choice was minimized or not,
      // so we query without args and inspect launchItems[] directly. Use
      // executableWillLaunchAtLogin to honour Task Manager's StartupApproved state.
      const osState = app.getLoginItemSettings({ path: process.execPath });
      const ownEntry = osState.launchItems?.find(
        (item) => item.name === 'Backspace' || item.path?.toLowerCase() === process.execPath.toLowerCase(),
      );
      // When the Run entry exists, its args are the source of truth for startMinimized.
      // When the entry is absent (autostart is off), there is no OS state to read, so we
      // fall back to the disk cache — this preserves the user's preference across an
      // off/on cycle so re-enabling restores their previous startMinimized choice.
      const startMinimized = ownEntry
        ? deriveStartMinimizedFromArgs(ownEntry.args)
        : loadAutoLaunchSettings().startMinimized;
      return {
        openAtLogin: osState.executableWillLaunchAtLogin ?? false,
        startMinimized,
      };
    }
    // macOS and Linux: getLoginItemSettings doesn't expose args, so startMinimized
    // is disk-cached. Rationale: parsing freedesktop Exec= lines on Linux is fragile
    // (quoting, escaping, third-party flags) and the out-of-band edit case is rare;
    // macOS has no introspection. openAtLogin is OS-authoritative on both platforms.
    const saved = loadAutoLaunchSettings();
    const osState = app.getLoginItemSettings();
    return {
      openAtLogin: osState.openAtLogin,
      startMinimized: saved.startMinimized,
    };
  });

  ipcMain.handle('set-auto-launch-settings', (_event, settings: { openAtLogin?: boolean; startMinimized?: boolean }) => {
    if (isSandboxed()) {
      return { openAtLogin: false, startMinimized: false };
    }

    // Read current truth from the OS (not from disk) so a partial update preserves
    // whatever the user (or Task Manager / System Settings) most recently set.
    let currentOpenAtLogin: boolean;
    let currentStartMinimized: boolean;

    if (process.platform === 'win32') {
      const osState = app.getLoginItemSettings({ path: process.execPath });
      const ownEntry = osState.launchItems?.find(
        (item) => item.name === 'Backspace' || item.path?.toLowerCase() === process.execPath.toLowerCase(),
      );
      currentOpenAtLogin = osState.executableWillLaunchAtLogin ?? false;
      // See `get-auto-launch-settings`: when the entry is absent, fall back to disk
      // cache so a partial update that re-enables openAtLogin restores the user's
      // previously-saved startMinimized choice rather than resetting to false.
      currentStartMinimized = ownEntry
        ? deriveStartMinimizedFromArgs(ownEntry.args)
        : loadAutoLaunchSettings().startMinimized;
    } else {
      const osState = app.getLoginItemSettings();
      const saved = loadAutoLaunchSettings();
      currentOpenAtLogin = osState.openAtLogin;
      currentStartMinimized = saved.startMinimized;
    }

    const newOpenAtLogin = settings.openAtLogin ?? currentOpenAtLogin;
    const newStartMinimized = settings.startMinimized ?? currentStartMinimized;

    applyLoginItemSettings(newOpenAtLogin, newStartMinimized);

    // Persist startMinimized as a disk cache for the macOS / Linux read path.
    // We also save openAtLogin for forward compatibility / debugging, but it is
    // never the source of truth on read.
    saveAutoLaunchSettings({
      openAtLogin: newOpenAtLogin,
      startMinimized: newStartMinimized,
    });

    return { openAtLogin: newOpenAtLogin, startMinimized: newStartMinimized };
  });

  // Keybinds
  ipcMain.handle('keybinds-sync', (_event, keybinds) => {
    keybindManager.updateKeybinds(keybinds);
    return keybindManager.isHookRunning();
  });
  ipcMain.handle('keybind-portal-status', () => {
    keybindManager.refreshPortal();
    return keybindManager.getPortalStatus();
  });
  ipcMain.on('keybind-portal-retry', () => keybindManager.retryPortal());

  ipcMain.handle('check-accessibility', () => {
    return keybindManager.checkAccessibility();
  });

  // Recovery / boot-stall protocol
  ipcMain.on('renderer-ready', () => {
    handleRendererReady();
  });

  ipcMain.on('recovery-action', (_e, action: unknown) => {
    if (!isValidRecoveryAction(action)) {
      console.warn('[recovery] ignored unknown action:', action);
      return;
    }
    handleRecoveryAction(action);
  });

  ipcMain.handle('get-recovery-state', () => recoveryStore.get());
}

// ─── Auto-Update ────────────────────────────────────────────────────────────

/**
 * How long to wait for `quitAndInstall()` to actually take the app down before
 * concluding it silently did nothing.
 *
 * electron-updater's `quitAndInstall()` can return normally without starting an
 * install. On macOS this is the documented shape of MacUpdater.quitAndInstall():
 * when Squirrel never staged the update it registers a listener for an event
 * that will never fire and returns. No error, no exception, no restart. That is
 * exactly the dead button this watchdog exists to catch on any platform where
 * the same thing can happen.
 */
const INSTALL_WATCHDOG_MS = 4_000;

let updateStore: UpdateStatusStore | null = null;

/**
 * The update status store, built on first use.
 *
 * Construction needs `app.getPath('userData')` and the signature probe, so it
 * cannot run at module load. Every caller is post-`whenReady`, and the lazy
 * getter means the IPC handlers (registered before the updater starts) and the
 * updater itself share one instance without ordering constraints.
 */
function getUpdateStore(): UpdateStatusStore {
  if (updateStore === null) {
    updateStore = new UpdateStatusStore(getUpdateCapability(), loadDismissedVersion());
    updateStore.subscribe((snapshot) => {
      mainWindow?.webContents.send('update-status-changed', snapshot);
    });
  }
  return updateStore;
}

/**
 * Fires the native update notification, if this snapshot warrants one.
 *
 * Asks `shouldPromptForUpdate` rather than deciding for itself, so the toast and
 * the notification cannot disagree about whether the user already said "later".
 *
 * The body branches on capability. Telling a macOS user to "click to restart and
 * install" when the build physically cannot install is the same lie as the dead
 * Restart button, just delivered by the OS instead of the app.
 */
function notifyAboutUpdate(
  snapshot: UpdateSnapshot,
  updater: { quitAndInstall: () => void },
): void {
  if (!shouldPromptForUpdate(snapshot)) return;
  // A focused user can see the in-app toast. Notifying as well is noise.
  if (mainWindow?.isFocused()) return;

  const version = statusVersion(snapshot.status);
  if (version === null) return;

  if (snapshot.status.phase === 'ready' && snapshot.capability === 'auto') {
    showNotification(
      'Nuvio update ready',
      `Click to restart and install version ${version}.`,
      () => updater.quitAndInstall(),
    );
    return;
  }

  showNotification(
    `Nuvio ${version} is available`,
    'Click to open the download page.',
    () => { void shell.openExternal(RELEASES_URL); },
  );
}

function compareSemver(a: string, b: string): number {
  const pa = a.replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function markUpToDate(store: UpdateStatusStore): void {
  recoveryStore.update({ updateState: 'idle', lastCheckResult: 'up-to-date' });
  store.setStatus({ phase: 'up-to-date', checkedAt: Date.now() });
  setTimeout(() => {
    if (recoveryStore.get().lastCheckResult === 'up-to-date') {
      recoveryStore.update({ lastCheckResult: null });
    }
    if (store.get().status.phase === 'up-to-date') {
      store.setStatus({ phase: 'idle' });
    }
  }, 15_000);
}

async function verifyAgainstGitHubReleases(store: UpdateStatusStore): Promise<boolean> {
  try {
    const res = await net.fetch('https://api.github.com/repos/Gebelson/nuviovoice/releases/latest', {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': `Nuvio-Desktop/${app.getVersion()}` },
    });
    if (res.status === 404) {
      // No releases published yet -> current build is the latest version
      markUpToDate(store);
      return true;
    }
    if (!res.ok) return false;
    const data = (await res.json()) as { tag_name?: unknown };
    const latestTag = typeof data.tag_name === 'string' ? data.tag_name.replace(/^v/i, '').trim() : '';
    if (!latestTag || compareSemver(latestTag, app.getVersion()) <= 0) {
      markUpToDate(store);
      return true;
    }
    // A newer release exists on GitHub
    const capability = getUpdateCapability();
    if (capability === 'manual' || !app.isPackaged) {
      recoveryStore.update({ updateState: 'available-manual', updateVersion: latestTag });
      store.setStatus({ phase: 'available', version: latestTag });
      mainWindow?.webContents.send('update-available', { version: latestTag });
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

async function triggerUpdateCheck(): Promise<void> {
  const capability = getUpdateCapability();
  if (capability === 'external') return;
  const store = getUpdateStore();
  recoveryStore.update({ updateState: 'checking', lastCheckResult: null });
  store.setStatus({ phase: 'checking' });

  if (!app.isPackaged) {
    const resolved = await verifyAgainstGitHubReleases(store);
    if (!resolved) markUpToDate(store);
    return;
  }

  try {
    const { autoUpdater } = require('electron-updater');
    await autoUpdater.checkForUpdates();
  } catch {
    const resolved = await verifyAgainstGitHubReleases(store);
    if (!resolved) {
      store.setStatus({ phase: 'failed', version: null, message: 'Update check failed' });
    }
  }
}

function initAutoUpdater(): void {
  const capability = getUpdateCapability();
  const store = getUpdateStore();

  if (capability === 'external') {
    recoveryStore.update({ updateState: 'external' });
    console.log('[update] capability=external (updates are managed by Flatpak)');
    return;
  }

  try {
    const { autoUpdater } = require('electron-updater');

    autoUpdater.autoDownload = capability === 'auto';
    autoUpdater.autoInstallOnAppQuit = capability === 'auto';

    if (capability === 'manual') {
      purgeUpdaterCache(process.resourcesPath);
    }

    setAutoUpdater(autoUpdater);

    let updateConfirmed = false;
    let pendingVersion: string | null = null;
    let lastPercent = -1;

    autoUpdater.on('checking-for-update', () => {
      recoveryStore.update({ updateState: 'checking', lastCheckResult: null });
      store.setStatus({ phase: 'checking' });
      updateConfirmed = false;
      lastPercent = -1;
    });

    autoUpdater.on('update-available', (info: { version: string }) => {
      const version = info.version.slice(0, 32);
      pendingVersion = version;
      updateConfirmed = capability === 'auto';

      if (capability === 'auto') {
        recoveryStore.update({ updateState: 'downloading', updateVersion: version });
        store.setStatus({ phase: 'downloading', version, percent: 0, bytesPerSecond: 0 });
      } else {
        recoveryStore.update({ updateState: 'available-manual', updateVersion: version });
        store.setStatus({ phase: 'available', version });
      }

      mainWindow?.webContents.send('update-available', { version });

      if (capability === 'manual') {
        notifyAboutUpdate(store.get(), autoUpdater);
      }
    });

    autoUpdater.on('update-not-available', () => {
      updateConfirmed = false;
      pendingVersion = null;
      markUpToDate(store);
    });

    autoUpdater.on('download-progress', (progress: { percent?: number; bytesPerSecond?: number }) => {
      if (pendingVersion === null) return;
      const percent = Math.max(0, Math.min(100, Math.round(progress.percent ?? 0)));
      if (percent === lastPercent) return;
      lastPercent = percent;
      store.setStatus({
        phase: 'downloading',
        version: pendingVersion,
        percent,
        bytesPerSecond: Math.max(0, Math.round(progress.bytesPerSecond ?? 0)),
      });
    });

    autoUpdater.on('update-downloaded', (info: { version: string }) => {
      const version = info.version.slice(0, 32);
      pendingVersion = version;
      recoveryStore.update({ updateState: 'downloaded', updateVersion: version });
      store.setStatus({ phase: 'ready', version });
      mainWindow?.webContents.send('update-downloaded', { version });
      notifyAboutUpdate(store.get(), autoUpdater);
    });

    autoUpdater.on('error', (err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      const code = extractErrorCode(err);

      if (updateConfirmed) {
        recoveryStore.update({
          updateState: 'error',
          lastUpdateError: { message, code, at: Date.now() },
          lastCheckResult: 'failed',
        });
        store.setStatus({ phase: 'failed', version: pendingVersion, message });
        mainWindow?.webContents.send('update-error', { message, releaseUrl: RELEASES_URL });
        notifyAboutUpdate(store.get(), autoUpdater);
        return;
      }

      // Check-phase failure (e.g. 404 when no release or latest.yml exists yet):
      // fallback to GitHub Releases API check before declaring failure.
      void verifyAgainstGitHubReleases(store).then((resolved) => {
        if (resolved) return;
        recoveryStore.update({
          updateState: 'error',
          lastUpdateError: { message, code, at: Date.now() },
          lastCheckResult: 'failed',
        });
        setTimeout(() => {
          if (recoveryStore.get().lastCheckResult === 'failed') {
            recoveryStore.update({ lastCheckResult: null });
          }
        }, 5_000);
        store.setStatus({ phase: 'failed', version: null, message });
      });
    });

    // Initial check after startup (non-blocking)
    setTimeout(() => {
      updateConfirmed = false;
      void triggerUpdateCheck();
    }, 6_000);

    // Periodic check every 4 hours
    setInterval(() => {
      updateConfirmed = false;
      void triggerUpdateCheck();
    }, 4 * 60 * 60 * 1000);
  } catch {
    // Auto-updater unavailable
  }
}

// ─── Deep Linking ───────────────────────────────────────────────────────────

function handleDeepLink(url: string): void {
  if (!url.startsWith('nuvio://') && !url.startsWith('nuvio-app://') && !url.startsWith('backspace://')) return;

  // Voice invite: nuvio://voice/invite/TOKEN or nuvio-app://app/voice/invite/TOKEN
  const voiceInvite = url.match(/^(?:nuvio|backspace|nuvio-app):\/\/(?:app\/)?voice\/invite\/([A-Za-z0-9_-]{4,64})\/?$/);
  // Space invite: nuvio://invite/CODE or nuvio-app://app/invite/CODE or nuvio-app://invite/CODE
  const invite = url.match(/^(?:nuvio|backspace|nuvio-app):\/\/(?:app\/)?(?:invite|join)\/([A-Za-z0-9_-]{4,64})\/?$/);

  if (mainWindow && !mainWindow.isDestroyed()) {
    if (voiceInvite) {
      void mainWindow.loadURL(`nuvio-app://app/voice/invite/${voiceInvite[1]}`);
    } else if (invite) {
      void mainWindow.loadURL(`nuvio-app://app/invite/${invite[1]}`);
    } else {
      mainWindow.webContents.send('deep-link', url);
    }
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  } else {
    // App not ready yet — store for later
    pendingDeepLink = url;
  }
}


// Electron 36+ defaults to GTK 4 on GNOME, which crashes if GTK 2/3
// libraries are loaded in the same process. Force GTK 3 for compatibility.
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('gtk-version', '3');
  // Chromium ships PulseAudio loopback for screen-share behind a feature flag.
  // Without it, returning `audio: 'loopback'` from setDisplayMediaRequestHandler
  // fails the whole getDisplayMedia request — screen share never starts when the
  // user has "Share system audio" enabled.
  app.commandLine.appendSwitch('enable-features', 'PulseaudioLoopbackForScreenShare');
}

// Windows: AppUserModelId so toast notifications and taskbar grouping match
// the NSIS shortcut appId ('app.nuvio.desktop').
if (process.platform === 'win32') {
  app.setAppUserModelId('app.nuvio.desktop');
}

/**
 * Request a clean app quit. Sets the isQuitting flag so the window 'close'
 * handler doesn't intercept (which would just hide the window) and then
 * triggers app.quit(). Exported so the recovery module can request a quit
 * via setOnQuitRequested without reaching into private state.
 */
export function requestQuit(): void {
  isQuitting = true;
  app.quit();
}

// Set as default protocol handler
app.setAsDefaultProtocolClient('nuvio');
app.setAsDefaultProtocolClient('nuvio-app');
app.setAsDefaultProtocolClient('backspace');

// macOS: open-url event
app.on('open-url', (event, url) => {
  event.preventDefault();
  handleDeepLink(url);
});

// Windows/Linux: single instance lock — deep links come as second-instance args
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, commandLine) => {
    // Find the deep link URL in the command line args
    const deepLinkArg = commandLine.find((arg) => arg.startsWith('nuvio://') || arg.startsWith('nuvio-app://') || arg.startsWith('backspace://'));
    if (deepLinkArg) {
      handleDeepLink(deepLinkArg);
    }

    // Focus the existing window
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  // ─── App Lifecycle ──────────────────────────────────────────────────────────

  app.whenReady().then(async () => {
    // Development runs inside the stock Electron.app bundle, whose Dock icon
    // macOS caches per bundle, so the copied icns in the dev script does not
    // show. Set it at runtime; packaged builds carry the icon in their own
    // bundle and skip this.
    if (process.platform === 'darwin' && !app.isPackaged && app.dock) {
      app.dock.setIcon(path.join(__dirname, '..', 'build', 'icon.png'));
    }

    // Win/Linux: frameless window has no menu bar, but we still need an
    // application menu so keyboard accelerators (Ctrl+C/V/X/Z/A) work.
    // The macOS app menu is owned by the recoveryStore subscriber below
    // (so it can re-render with current update/recovery state). Rebuilt on a
    // language change, hence a function rather than a one-off.
    const applyEditOnlyMenu = (): void => {
      Menu.setApplicationMenu(Menu.buildFromTemplate([
        {
          label: translateDesktop(getDesktopLanguage(), 'menu.edit'),
          submenu: [
            { role: 'undo' },
            { role: 'redo' },
            { type: 'separator' },
            { role: 'cut' },
            { role: 'copy' },
            { role: 'paste' },
            { role: 'selectAll' },
          ],
        },
      ]));
    };
    if (process.platform !== 'darwin') {
      applyEditOnlyMenu();
    }

    // Versioned cache invalidation: purge stale HTTP/ServiceWorker/CacheStorage on version upgrade
    // while strictly preserving localStorage (auth tokens, user settings, audio prefs) and IndexedDB.
    try {
      const versionStampPath = path.join(app.getPath('userData'), 'app-version.json');
      const currentVer = app.getVersion();
      let previousVer: string | null = null;
      try {
        const parsed = JSON.parse(fs.readFileSync(versionStampPath, 'utf-8')) as { version?: string };
        previousVer = parsed.version ?? null;
      } catch {}
      if (previousVer !== currentVer) {
        await session.defaultSession.clearStorageData({
          storages: ['serviceworkers', 'cachestorage', 'shadercache'],
        });
        await session.defaultSession.clearCache();
        fs.writeFileSync(versionStampPath, JSON.stringify({ version: currentVer, updatedAt: Date.now() }));
      } else {
        await session.defaultSession.clearStorageData({ storages: ['serviceworkers'] });
        await session.defaultSession.clearCache();
      }
    } catch {
      await session.defaultSession.clearStorageData({ storages: ['serviceworkers'] });
      await session.defaultSession.clearCache();
    }

    // Register custom protocol handler for nuvio-app://
    protocol.handle('nuvio-app', async (request) => {
      const url = new URL(request.url);

      // 1. Proxy API and Uploads requests directly to the official backend
      if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/')) {
        const backendBase = getEffectiveBackendUrl();
        const targetUrl = `${backendBase}${url.pathname}${url.search}`;
        const fetchOptions: RequestInit = {
          method: request.method,
          headers: request.headers,
        };
        if (request.method !== 'GET' && request.method !== 'HEAD' && request.body) {
          (fetchOptions as any).body = request.body;
          (fetchOptions as any).duplex = 'half';
        }
        return net.fetch(targetUrl, fetchOptions);
      }

      // 2. Serve static files from web-dist
      const webDist = getWebDistPath();
      const rawPath = decodeURIComponent(url.pathname.replace(/^\/+/, ''));

      if (!rawPath || rawPath === 'index.html') {
        return net.fetch(pathToFileURL(path.join(webDist, 'index.html')).toString());
      }

      const filePath = path.join(webDist, rawPath);
      // Ensure the resolved file path stays inside webDist
      if (filePath.startsWith(webDist) && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const unpackedCandidate = filePath.replace(/app\.asar([\\/])/, 'app.asar.unpacked$1');
        const resolvedFilePath =
          unpackedCandidate !== filePath && fs.existsSync(unpackedCandidate)
            ? unpackedCandidate
            : filePath;

        const ext = path.extname(resolvedFilePath).toLowerCase();
        const mediaMimeMap: Record<string, string> = {
          '.webm': 'video/webm',
          '.mp4': 'video/mp4',
          '.mov': 'video/quicktime',
          '.ogg': 'video/ogg',
          '.mp3': 'audio/mpeg',
          '.wav': 'audio/wav',
        };

        if (mediaMimeMap[ext]) {
          const mimeType = mediaMimeMap[ext];
          const buf = fs.readFileSync(resolvedFilePath);
          const total = buf.byteLength;
          const rangeHeader = request.headers.get('range');
          if (rangeHeader) {
            const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
            if (match) {
              const start = match[1] ? parseInt(match[1], 10) : 0;
              const end = match[2] ? Math.min(parseInt(match[2], 10), total - 1) : total - 1;
              if (start >= 0 && start <= end && start < total) {
                const chunk = buf.subarray(start, end + 1);
                return new Response(chunk, {
                  status: 206,
                  headers: {
                    'Content-Type': mimeType,
                    'Content-Length': String(chunk.byteLength),
                    'Content-Range': `bytes ${start}-${end}/${total}`,
                    'Accept-Ranges': 'bytes',
                    'Cache-Control': 'no-cache',
                  },
                }) as any;
              }
            }
          }
          return new Response(buf, {
            status: 200,
            headers: {
              'Content-Type': mimeType,
              'Content-Length': String(total),
              'Accept-Ranges': 'bytes',
              'Cache-Control': 'no-cache',
            },
          }) as any;
        }

        return net.fetch(pathToFileURL(resolvedFilePath).toString());
      }

      // 3. Fallback for SPA client-side routing (e.g. /channels/@me, /login, /register, etc.)
      return net.fetch(pathToFileURL(path.join(webDist, 'index.html')).toString());
    });

    // Auto-grant desktop media and notification permissions for seamless UX
    session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
      const allowed = ['media', 'mediaKeySystem', 'notifications', 'display-capture'];
      callback(allowed.includes(permission));
    });

    session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
      const allowed = ['media', 'mediaKeySystem', 'notifications', 'display-capture'];
      return allowed.includes(permission);
    });

    // Intercept getDisplayMedia(). Two ways to answer it:
    //   1. Preselected (current web client): ScreenShareSetup listed the
    //      sources via get-screen-sources, the user picked a tile, and the
    //      renderer awaited screen-share-preselect before calling
    //      getDisplayMedia(). Answer immediately, no prompt.
    //   2. Prompted (older web clients, or nothing preselected): push the
    //      sources to the renderer and wait for screen-share-selected.
    // Audio loopback controlled by user's shareAudio toggle.
    session.defaultSession.setDisplayMediaRequestHandler(async (_request, callback) => {
      console.log('[Main:ScreenShare] Handler invoked');
      try {
        const pending = takePendingScreenSelection();
        if (pending) {
          let selected = lastScreenSources.find((s) => s.id === pending.sourceId);
          if (!selected) selected = (await enumerateScreenSources()).find((s) => s.id === pending.sourceId);
          if (!selected) {
            console.warn('[Main:ScreenShare] Preselected source vanished:', pending.sourceId);
            // @ts-ignore — deny the request without crashing
            callback();
            return;
          }
          console.log('[Main:ScreenShare] Using preselected source:', pending.sourceId, 'audio:', pending.shareAudio);
          callback({ video: selected, ...(pending.shareAudio ? { audio: 'loopback' } : {}) });
          return;
        }

        const sources = await enumerateScreenSources();
        console.log('[Main:ScreenShare] Got', sources.length, 'sources');

        if (sources.length === 0) {
          console.warn('[Main:ScreenShare] No sources — Screen Recording permission may not be granted, or the system picker was cancelled');
          // @ts-ignore — Electron throws if we pass {} when video was requested; pass nothing to deny
          callback();
          return;
        }

        // System picker (Wayland portal): the user already chose in the
        // portal dialog and this is the only source it returned. Answer
        // directly instead of showing a one-tile grid.
        if (currentPickerMode() === 'system' && sources.length === 1) {
          // Default off: this branch answers without consulting the renderer, so
          // a web client too old to send a preference must not have its audio
          // captured against the setting it thinks is in force.
          const shareAudio = lastSystemPickerShareAudio ?? false;
          console.log('[Main:ScreenShare] System picker returned one source:', sources[0]!.id, 'audio:', shareAudio);
          callback({ video: sources[0]!, ...(shareAudio ? { audio: 'loopback' } : {}) });
          return;
        }

        // Send sources to renderer, wait for user selection
        mainWindow?.webContents.send('screen-share-sources', serializeScreenSources(sources));

        const { sourceId, shareAudio } = await new Promise<{ sourceId: string | null; shareAudio: boolean }>((resolve) => {
          ipcMain.once('screen-share-selected', (_event, id: string | null, wantAudio?: boolean) => {
            resolve({ sourceId: id, shareAudio: wantAudio ?? true });
          });
        });
        console.log('[Main:ScreenShare] User selected:', sourceId, 'audio:', shareAudio);

        if (!sourceId) {
          // @ts-ignore — deny the request without crashing
          callback();
          return;
        }

        const selected = sources.find((s) => s.id === sourceId);
        if (!selected) {
          // @ts-ignore — deny the request without crashing
          callback();
          return;
        }

        // Provide the selected source — Electron creates the MediaStream.
        // System audio loopback support varies:
        //   - Windows: WASAPI loopback. Backspace's own
        //     playback is left out only on Windows 11, where Chromium honours
        //     the renderer's restrictOwnAudio (see systemAudioCapability.ts);
        //     on Windows 10 the whole mix, this call included, is captured.
        //   - macOS 13+: ScreenCaptureKit, or CoreAudio Tap from 14.2, which
        //     also leaves Backspace out; requires NSAudioCaptureUsageDescription
        //     in Info.plist (electron-builder injects it via mac.extendInfo).
        //   - Linux: PulseAudio loopback, gated behind the
        //     `PulseaudioLoopbackForScreenShare` feature flag we enable above.
        //     Fails on PipeWire-only systems without pulse compat — the
        //     renderer catches that and toasts the user.
        callback({ video: selected, ...(shareAudio ? { audio: 'loopback' } : {}) });
      } catch (err) {
        console.error('[Main:ScreenShare] Handler error:', err);
        // @ts-ignore — deny the request without crashing
        callback();
      } finally {
        // The caches exist only to serve one setup flow: the NativeImage list to
        // resolve a preselected id within this request, the serialized one to
        // answer a repeat call without a second scan. Both pin a thumbnail per
        // open window, so drop them as soon as the request is answered.
        lastScreenSources = [];
        lastServedScreenSources = [];
        lastScreenEnumerationAt = null;
      }
    });

    registerIpcHandlers();
    // Wire the recovery module's quit callback to the local requestQuit BEFORE
    // createWindow so a synchronous did-fail-load on first load finds a wired
    // Quit handler. requestQuit is a function declaration and is hoisted.
    setOnQuitRequested(() => requestQuit());
    createWindow();
    createTray();

    // AGPL-3.0 § 13: native About panel advertises the version + source repo.
    app.setAboutPanelOptions({
      applicationName: 'Nuvio',
      applicationVersion: app.getVersion(),
      copyright: `AGPL-3.0-only · Source: ${UPSTREAM_SOURCE_URL}`,
      website: UPSTREAM_SOURCE_URL,
    });

    // Tray + macOS app-menu actions. Defined once so the subscriber and the
    // initial-fire share one implementation (no drift on future menu changes).
    const trayActions = {
      onShow: () => { mainWindow?.show(); mainWindow?.focus(); },
      onHide: () => mainWindow?.hide(),
      // Delegate to handleRecoveryAction so both the tray and the recovery
      // surface share one implementation path (avoids drift and ensures
      // recovery state is always cleared on a Change Instance action).
      onChangeInstance: () => handleRecoveryAction('change-instance'),
      onCheckForUpdates: () => handleRecoveryAction('check-update'),
      onRestartToInstall: () => handleRecoveryAction('install-update'),
      onOpenReleases: () => handleRecoveryAction('open-releases'),
      onOpenSource: () => openSourceCode(),
      onQuit: () => requestQuit(),
    };

    const applyMenusForState = (state: RecoveryState): void => {
      const language = getDesktopLanguage();
      if (tray) {
        tray.setContextMenu(Menu.buildFromTemplate(buildTrayMenuTemplate(state, trayActions, language)));
      }
      if (process.platform === 'darwin') {
        Menu.setApplicationMenu(Menu.buildFromTemplate(buildAppMenuTemplate(app.name, state, trayActions, language)));
      }
      // Mode-gated push to renderer (recovery.html subscribes to this).
      if (state.mode === 'recovery' && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('recovery-state-changed', state);
      }
    };

    recoveryStore.subscribe(applyMenusForState);
    applyMenusForState(recoveryStore.get());  // initial fire — subscribers don't auto-fire on subscribe

    // The renderer owns the language choice (settings → Language). Remember
    // it so the tray is right from the first paint next launch, and relabel
    // everything main draws right now.
    ipcMain.on('set-language', (_event, language: unknown) => {
      if (!isDesktopLanguage(language)) return;
      try {
        saveStoredLanguage(language);
      } catch (err) {
        console.warn('[main] Failed to persist language:', err);
      }
      if (process.platform !== 'darwin') applyEditOnlyMenu();
      applyMenusForState(recoveryStore.get());
    });

    initAutoUpdater();

    // ─── Activity Detection ────────────────────────────────────────────────
    startActivityDetection((activity) => {
      mainWindow?.webContents.send('activity-detected', activity);
    });

    ipcMain.handle('get-current-activity', () => getCurrentActivity());

    // Linux/AppImage path-refresh ONLY. On Windows and macOS the OS is the source
    // of truth for openAtLogin (Task 4) and we must not override user changes made
    // via Task Manager / System Settings by re-applying disk state here.
    //
    // For an AppImage install whose path changed (e.g. the user replaced the file
    // after an update), the autostart .desktop file's Exec= line points at the old
    // path. Re-apply only when $APPIMAGE differs from the recorded Exec= path.
    if (process.platform === 'linux' && process.env.APPIMAGE) {
      try {
        const desktopFilePath = path.join(
          os.homedir(),
          '.config',
          'autostart',
          'backspace.desktop',
        );
        let recordedExecPath: string | null = null;
        try {
          const content = fs.readFileSync(desktopFilePath, 'utf-8');
          recordedExecPath = parseExecPathFromDesktopFile(content);
        } catch {
          // No autostart entry exists. recordedExecPath stays null and shouldReapplyAppImage
          // will return false — a missing file is treated as user-disabled (out-of-band edit),
          // not a stale-path-needs-refresh signal.
        }
        const saved = loadAutoLaunchSettings();
        if (saved.openAtLogin && shouldReapplyAppImage(process.env.APPIMAGE, recordedExecPath)) {
          applyLoginItemSettings(saved.openAtLogin, saved.startMinimized);
        }
      } catch (err) {
        console.error('[autoLaunch] AppImage path-refresh check failed:', err);
      }
    }

    // Check if the app was launched with a deep link (Windows/Linux)
    const launchArg = process.argv.find((arg) => arg.startsWith('nuvio://') || arg.startsWith('nuvio-app://') || arg.startsWith('backspace://'));
    if (launchArg) {
      pendingDeepLink = launchArg;
    }
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('activate', () => {
    if (mainWindow === null) {
      createWindow();
    } else {
      mainWindow.show();
    }
  });

  app.on('before-quit', () => {
    systemAudio.stop();
    isQuitting = true;
    stopActivityDetection();
    keybindManager.stop();
  });
}

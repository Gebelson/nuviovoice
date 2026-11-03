export type PwaPlatform = 'ios' | 'android' | 'desktop' | 'unknown';
export type PwaBrowser =
  | 'safari'
  | 'chrome'
  | 'edge'
  | 'firefox'
  | 'samsung'
  | 'inapp'
  | 'other';

export interface PwaEnvironment {
  platform: PwaPlatform;
  browser: PwaBrowser;
  isStandalone: boolean;
  isMobileDevice: boolean;
  isIpad: boolean;
  isIphone: boolean;
  isInAppBrowser: boolean;
  canPromptNative: boolean;
  label: string;
}

const IN_APP_PATTERNS = [
  /instagram/i,
  /fban|fbav|fb_iab|fb4a|fbios/i,
  /whatsapp/i,
  /twitter/i,
  /line\//i,
  /micromessenger/i,
  /musical_ly|bytelocale|bytefulllocale|tiktok/i,
  /linkedinapp/i,
  /wv\b|webview/i,
];

export function detectPwaPlatform(
  customUa?: string,
  customMaxTouchPoints?: number
): PwaPlatform {
  const ua = customUa ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '');
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  const maxTouchPoints =
    customMaxTouchPoints ?? (nav ? nav.maxTouchPoints || 0 : 0);

  // iPad on iOS 13+ reports 'MacIntel' with touch points > 1
  if (/iPad/i.test(ua) || (/Macintosh/i.test(ua) && maxTouchPoints > 1)) {
    return 'ios';
  }
  if (/iPhone|iPod/i.test(ua)) {
    return 'ios';
  }
  if (/Android/i.test(ua)) {
    return 'android';
  }
  if (/Windows|Macintosh|Linux/i.test(ua) && maxTouchPoints <= 1) {
    return 'desktop';
  }
  return 'unknown';
}

export function detectPwaBrowser(customUa?: string): PwaBrowser {
  const ua = customUa ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '');

  // 1. Check for social in-app webviews (Instagram, Facebook, Twitter, WhatsApp, etc.)
  for (const pattern of IN_APP_PATTERNS) {
    if (pattern.test(ua)) {
      return 'inapp';
    }
  }

  // 2. Samsung Internet
  if (/SamsungBrowser/i.test(ua)) {
    return 'samsung';
  }

  // 3. Microsoft Edge (EdgiOS on iOS, Edg or Edge on Android/Desktop)
  if (/EdgiOS|EdgA|Edge\b|Edg\//i.test(ua)) {
    return 'edge';
  }

  // 4. Firefox (FxiOS on iOS, Firefox on Android)
  if (/FxiOS|Firefox/i.test(ua)) {
    return 'firefox';
  }

  // 5. Chrome (CriOS on iOS, Chrome on Android)
  if (/CriOS|Chrome/i.test(ua)) {
    return 'chrome';
  }

  // 6. Mobile Safari (WebKit without Chrome/Edge/Firefox tokens)
  if (/Safari/i.test(ua) && !/Chrome|CriOS|Edg|FxiOS/i.test(ua)) {
    return 'safari';
  }

  return 'other';
}

export function isPwaStandalone(customStandalone?: boolean): boolean {
  if (typeof customStandalone === 'boolean') {
    return customStandalone;
  }
  if (typeof window === 'undefined') return false;

  // 1. CSS display-mode media queries
  try {
    if (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches ||
      window.matchMedia('(display-mode: minimal-ui)').matches
    ) {
      return true;
    }
  } catch {
    // Ignore media query evaluation failures in non-standard runtimes
  }

  // 2. iOS Safari navigator.standalone legacy property
  if ((window.navigator as unknown as { standalone?: boolean })?.standalone === true) {
    return true;
  }

  // 3. Android TWA / PWA document.referrer check
  if (typeof document !== 'undefined' && document.referrer?.startsWith('android-app://')) {
    return true;
  }

  // 4. LocalStorage persistent flag (set on appinstalled event)
  try {
    if (localStorage.getItem('nuvio_pwa_installed') === 'true') {
      return true;
    }
  } catch {
    // Storage access might be restricted in some sandboxes
  }

  return false;
}

export function getDeviceDisplayLabel(
  platform: PwaPlatform,
  browser: PwaBrowser,
  isIpad: boolean
): string {
  const platformName = isIpad
    ? 'iPad'
    : platform === 'ios'
      ? 'iPhone'
      : platform === 'android'
        ? 'Android'
        : 'Computador';

  const browserName =
    browser === 'safari'
      ? 'Safari'
      : browser === 'chrome'
        ? 'Google Chrome'
        : browser === 'edge'
          ? 'Microsoft Edge'
          : browser === 'firefox'
            ? 'Mozilla Firefox'
            : browser === 'samsung'
              ? 'Samsung Internet'
              : browser === 'inapp'
                ? 'Navegador interno'
                : 'Navegador web';

  return `${platformName} • ${browserName}`;
}

export function detectPwaEnvironment(options?: {
  ua?: string;
  maxTouchPoints?: number;
  standalone?: boolean;
  hasNativePrompt?: boolean;
}): PwaEnvironment {
  const ua = options?.ua ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '');
  const platform = detectPwaPlatform(ua, options?.maxTouchPoints);
  const browser = detectPwaBrowser(ua);
  const isStandalone = isPwaStandalone(options?.standalone);

  const isIpad =
    /iPad/i.test(ua) ||
    (/Macintosh/i.test(ua) &&
      (options?.maxTouchPoints ??
        (typeof navigator !== 'undefined' ? navigator.maxTouchPoints : 0)) > 1);
  const isIphone = /iPhone|iPod/i.test(ua);
  const isMobileDevice = platform === 'ios' || platform === 'android' || isIpad;
  const isInAppBrowser = browser === 'inapp';
  const canPromptNative = Boolean(options?.hasNativePrompt);

  const label = getDeviceDisplayLabel(platform, browser, isIpad);

  return {
    platform,
    browser,
    isStandalone,
    isMobileDevice,
    isIpad,
    isIphone,
    isInAppBrowser,
    canPromptNative,
    label,
  };
}

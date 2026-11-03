import { api } from '../api/client';

/**
 * Checks whether Web Push Notifications and Service Workers are supported in the current environment.
 */
export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * Converts a URL-safe Base64 string to a Uint8Array for PushManager subscribe options.
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Subscribes the current device/browser to Web Push notifications.
 */
export async function registerPushSubscription(): Promise<boolean> {
  if (!isPushSupported()) return false;

  try {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') {
      return false;
    }

    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      // Fetch VAPID public key from server
      const res = await fetch('/api/push/vapid-public-key');
      if (!res.ok) throw new Error('Could not fetch VAPID key');
      const { publicKey } = await res.json();
      if (!publicKey) throw new Error('Missing VAPID key');

      const convertedVapidKey = urlBase64ToUint8Array(publicKey);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey as unknown as BufferSource,
      });
    }

    const subJson = subscription.toJSON();
    if (!subJson.endpoint || !subJson.keys?.p256dh || !subJson.keys?.auth) {
      throw new Error('Incomplete push subscription data');
    }

    // Register with server
    const response = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
      },
      body: JSON.stringify({
        endpoint: subJson.endpoint,
        keys: {
          p256dh: subJson.keys.p256dh,
          auth: subJson.keys.auth,
        },
        userAgent: navigator.userAgent,
      }),
    });

    return response.ok;
  } catch (err) {
    console.warn('[webPush] Registration failed:', err);
    return false;
  }
}

/**
 * Unsubscribes the current device/browser from Web Push notifications.
 */
export async function unregisterPushSubscription(): Promise<boolean> {
  if (!isPushSupported()) return false;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return true;

    await fetch('/api/push/unsubscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
      },
      body: JSON.stringify({
        endpoint: subscription.endpoint,
      }),
    });

    return await subscription.unsubscribe();
  } catch (err) {
    console.warn('[webPush] Unregister failed:', err);
    return false;
  }
}

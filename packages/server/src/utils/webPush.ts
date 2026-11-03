import webpush from 'web-push';
import { eq } from 'drizzle-orm';
import { config } from '../config.js';
import { getDb } from '../db/index.js';
import * as schema from '../db/schema.js';

let isVapidInitialized = false;

export interface VapidKeys {
  publicKey: string;
  privateKey: string;
  subject: string;
}

/**
 * Retrieves the instance VAPID keys.
 * 1. Honors explicit VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY from environment/config.
 * 2. Falls back to instance_settings in SQLite, generating and persisting a keypair on first run.
 */
export function getVapidKeys(): VapidKeys {
  const subject = config.vapid?.subject || 'mailto:admin@nuvio.chat';

  if (config.vapid?.publicKey && config.vapid?.privateKey) {
    return {
      publicKey: config.vapid.publicKey,
      privateKey: config.vapid.privateKey,
      subject,
    };
  }

  const db = getDb();
  const settings = db
    .select({
      vapidPublicKey: schema.instanceSettings.vapidPublicKey,
      vapidPrivateKey: schema.instanceSettings.vapidPrivateKey,
    })
    .from(schema.instanceSettings)
    .where(eq(schema.instanceSettings.id, 1))
    .get();

  if (settings?.vapidPublicKey && settings?.vapidPrivateKey) {
    return {
      publicKey: settings.vapidPublicKey,
      privateKey: settings.vapidPrivateKey,
      subject,
    };
  }

  // Auto-generate and persist on first demand
  const generated = webpush.generateVAPIDKeys();
  db.update(schema.instanceSettings)
    .set({
      vapidPublicKey: generated.publicKey,
      vapidPrivateKey: generated.privateKey,
      updatedAt: Date.now(),
    })
    .where(eq(schema.instanceSettings.id, 1))
    .run();

  return {
    publicKey: generated.publicKey,
    privateKey: generated.privateKey,
    subject,
  };
}

export function ensureVapidConfigured(): void {
  if (isVapidInitialized) return;
  try {
    const keys = getVapidKeys();
    webpush.setVapidDetails(keys.subject, keys.publicKey, keys.privateKey);
    isVapidInitialized = true;
  } catch (err) {
    console.warn('[web-push] Failed to initialize VAPID details:', err);
  }
}

export interface PushNotificationPayload {
  type: string;
  title: string;
  body: string;
  senderName?: string;
  dmChannelId?: string;
  icon?: string;
  badge?: string;
  data?: Record<string, any>;
}

/**
 * Sends a push notification to a specific push subscription.
 * Automatically prunes expired/invalid (404 / 410 Gone) subscriptions.
 */
export async function sendPushToSubscription(
  sub: { id: string; endpoint: string; p256dh: string; auth: string },
  payload: PushNotificationPayload
): Promise<boolean> {
  ensureVapidConfigured();
  const pushSubscription = {
    endpoint: sub.endpoint,
    keys: {
      p256dh: sub.p256dh,
      auth: sub.auth,
    },
  };

  try {
    await webpush.sendNotification(pushSubscription, JSON.stringify(payload));
    return true;
  } catch (err: any) {
    // 404 Not Found or 410 Gone indicates the push service unsubscribed or expired this endpoint
    if (err.statusCode === 404 || err.statusCode === 410) {
      try {
        const db = getDb();
        db.delete(schema.pushSubscriptions)
          .where(eq(schema.pushSubscriptions.id, sub.id))
          .run();
        console.info(`[web-push] Pruned expired push subscription ${sub.id} (${err.statusCode})`);
      } catch (deleteErr) {
        console.warn(`[web-push] Failed to delete expired subscription ${sub.id}:`, deleteErr);
      }
    } else {
      console.warn(`[web-push] Error sending push to ${sub.id}:`, err?.message || err);
    }
    return false;
  }
}

/**
 * Sends a "Você recebeu um Wink!" push notification to all subscribed devices of a user.
 */
export async function sendWinkPushNotification(params: {
  userId: string;
  senderName: string;
  dmChannelId: string;
  messageId: string;
}): Promise<number> {
  const { userId, senderName, dmChannelId, messageId } = params;
  const db = getDb();

  const subscriptions = db
    .select({
      id: schema.pushSubscriptions.id,
      endpoint: schema.pushSubscriptions.endpoint,
      p256dh: schema.pushSubscriptions.p256dh,
      auth: schema.pushSubscriptions.auth,
    })
    .from(schema.pushSubscriptions)
    .where(eq(schema.pushSubscriptions.userId, userId))
    .all();

  if (!subscriptions || subscriptions.length === 0) {
    return 0;
  }

  const payload: PushNotificationPayload = {
    type: 'wink',
    title: senderName || 'Nuvio',
    body: 'Você recebeu um Wink!',
    senderName,
    dmChannelId,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: {
      url: `/channels/@me/${dmChannelId}`,
      dmChannelId,
      messageId,
      type: 'wink',
    },
  };

  let sentCount = 0;
  for (const sub of subscriptions) {
    const ok = await sendPushToSubscription(sub, payload);
    if (ok) sentCount++;
  }

  return sentCount;
}

/*
 * Service Worker script for Web Push Notifications in Nuvio (Winks & messages).
 * Imported via Workbox importScripts in vite.config.ts.
 */
(function registerPushHandler(scope) {
  scope.addEventListener('push', (event) => {
    if (!event.data) return;

    event.waitUntil(
      (async () => {
        let payload;
        try {
          payload = event.data.json();
        } catch {
          payload = {
            title: 'Nuvio',
            body: event.data.text() || 'Você recebeu um Wink!',
          };
        }

        const title = payload.title || payload.senderName || 'Nuvio';
        const body = payload.body || 'Você recebeu um Wink!';
        const icon = payload.icon || '/icons/icon-192.png';
        const badge = payload.badge || '/icons/icon-192.png';
        const dmChannelId = payload.data?.dmChannelId || payload.dmChannelId;
        const messageId = payload.data?.messageId || payload.eventId || Date.now().toString();

        // Check if an existing window is already focused on this conversation
        try {
          const clientList = await scope.clients.matchAll({
            type: 'window',
            includeUncontrolled: true,
          });

          const isChannelActivelyFocused = clientList.some((client) => {
            return client.focused && dmChannelId && client.url.includes(dmChannelId);
          });

          // Suppress redundant system notification if user is actively watching this channel
          if (isChannelActivelyFocused) {
            return;
          }
        } catch (err) {
          console.warn('[sw-push] Could not query clients:', err);
        }

        const tag = `wink-${messageId}`;
        const options = {
          body,
          icon,
          badge,
          tag,
          renotify: true,
          data: payload.data || {
            url: dmChannelId ? `/channels/@me/${dmChannelId}` : '/',
            dmChannelId,
            messageId,
            type: payload.type || 'wink',
          },
          vibrate: [150, 80, 150],
        };

        await scope.registration.showNotification(title, options);
      })()
    );
  });

  scope.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const targetUrl = event.notification.data?.url || '/';

    event.waitUntil(
      (async () => {
        const clientList = await scope.clients.matchAll({
          type: 'window',
          includeUncontrolled: true,
        });

        // Search for an existing window on the same origin to focus and navigate
        for (const client of clientList) {
          if ('focus' in client) {
            try {
              if (client.url.includes(scope.location.origin)) {
                await client.navigate(targetUrl);
                return await client.focus();
              }
            } catch {
              // Navigation or focus error fallback
            }
          }
        }

        // Otherwise open a new window
        if (scope.clients.openWindow) {
          return await scope.clients.openWindow(targetUrl);
        }
      })()
    );
  });
})(self);

// 5pm Service Worker — Web Push receiver
// Scope: / (full app)

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

// ── Push received ──────────────────────────────────
self.addEventListener('push', event => {
  if (!event.data) return;

  let payload;
  try { payload = event.data.json(); }
  catch { payload = { title: '5pm', body: event.data.text() }; }

  const { title, body, tag, requireInteraction } = payload;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag:                 tag || '5pm',
      icon:                '/icon-192.png',
      badge:               '/icon-72.png',
      renotify:            true,
      requireInteraction:  !!requireInteraction,
      data:                { url: '/' },
    })
  );
});

// ── Notification clicked ───────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if ('focus' in c) return c.focus();
      }
      return clients.openWindow(event.notification.data?.url || '/');
    })
  );
});

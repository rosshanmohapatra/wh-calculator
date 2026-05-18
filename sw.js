// 5pm Service Worker — enables native notifications when tab is backgrounded
self.addEventListener('install',  () => self.skipWaiting());
self.addEventListener('activate', e  => e.waitUntil(clients.claim()));

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.includes('/index') || c.url.endsWith('/')) return c.focus();
      }
      return clients.openWindow('/');
    })
  );
});

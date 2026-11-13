/* LGS Takip · Service Worker */
const CACHE = 'lgs-takip-v8';
const SHELL = ['./', './index.html', './manifest.webmanifest',
  './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {}));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch (_) { return; }
  // Supabase / CDN (cross-origin) → her zaman ağdan (önbelleğe alma)
  if (url.origin !== location.origin) return;
  // Sayfa gezinmesi → önce ağ, çevrimdışıysa önbellekten kabuk
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req.url, { cache: 'no-store' }).then(r => {
        const copy = r.clone();
        caches.open(CACHE).then(c => c.put('./index.html', copy)).catch(() => {});
        return r;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }
  // Statik dosyalar (ikon/manifest) → önce önbellek
  e.respondWith(caches.match(req).then(c => c || fetch(req)));
});

/* ---- Web push bildirimleri ---- */
self.addEventListener('push', e => {
  let d = { title: 'LGS Takip', body: '' };
  try { d = Object.assign(d, e.data.json()); } catch (_) { if (e.data) d.body = e.data.text(); }
  e.waitUntil(self.registration.showNotification(d.title, {
    body: d.body,
    icon: './icon-192.png',
    badge: './icon-192.png',
    data: { url: d.url || './' },
    tag: 'lgs-takip'
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(ws => {
      for (const w of ws) { if ('focus' in w) return w.focus(); }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});

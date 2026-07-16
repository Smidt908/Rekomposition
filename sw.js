/* ── Service Worker ─────────────────────────────────────
   Macht die App offline nutzbar und erfüllt Chromes
   Bedingung für eine echte Installation auf Android.

   Beim Ausrollen einer neuen Version die Zahl in CACHE
   erhöhen — sonst behalten installierte Geräte die alten
   Dateien.
   ────────────────────────────────────────────────────── */

const CACHE = 'rekomposition-v1';

const SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;

  // Seitenaufrufe: erst Netz (für Updates), bei Funkloch aus dem Cache.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html').then(r => r || caches.match('./')))
    );
    return;
  }

  // Bausteine: sofort aus dem Cache, im Hintergrund auffrischen.
  event.respondWith(
    caches.match(request).then(cached => {
      const network = fetch(request)
        .then(res => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(request, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});

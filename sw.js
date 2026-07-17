/* ── Service Worker ─────────────────────────────────────
   Macht die Mümmelküche offline nutzbar und erfüllt
   Chromes Bedingung für eine echte Installation auf
   Android.

   Beim Ausrollen einer neuen Fassung die Zahl in CACHE
   erhöhen — sonst behalten installierte Geräte die alten
   Dateien.

   Die Texterkennung im Ordner ./ocr steht bewusst nicht im
   SCHRANK: gut 10 MB gleich beim Einrichten wären zu viel.
   Sie wandert beim ersten Benutzen von selbst in den Cache
   (siehe unten) und ist danach auch offline da.

   Fremde Adressen (Rezeptseiten beim Link-Import) fasst der
   Service Worker gar nicht an: die sollen immer frisch und
   unverfälscht durchs Netz gehen.
   ────────────────────────────────────────────────────── */

const CACHE = 'muemmelkueche-v5';

const SCHRANK = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

self.addEventListener('install', ereignis => {
  ereignis.waitUntil(
    caches.open(CACHE)
      .then(schrank => schrank.addAll(SCHRANK))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', ereignis => {
  ereignis.waitUntil(
    caches.keys()
      .then(namen => Promise.all(namen.filter(n => n !== CACHE).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', ereignis => {
  const anfrage = ereignis.request;
  if (anfrage.method !== 'GET') return;
  if (new URL(anfrage.url).origin !== self.location.origin) return;

  // Seitenaufrufe: erst das Netz (damit Neues ankommt), im Funkloch aus dem Schrank.
  // Wichtig: gecacht wird immer unter './index.html', damit ein geteilter Link
  // mit ?url=… nicht als eigene Seite im Schrank landet.
  if (anfrage.mode === 'navigate') {
    ereignis.respondWith(
      fetch(anfrage)
        .then(antwort => {
          const kopie = antwort.clone();
          caches.open(CACHE).then(schrank => schrank.put('./index.html', kopie));
          return antwort;
        })
        .catch(() => caches.match('./index.html').then(a => a || caches.match('./')))
    );
    return;
  }

  // Die Texterkennung (gut 10 MB) ändert sich nie: einmal im Schrank, danach
  // nie wieder nachfragen. Mit dem Auffrischen unten würde sonst jedes Foto
  // die Dateien erneut über die Mobilfunkrechnung ziehen.
  if (new URL(anfrage.url).pathname.includes('/ocr/')) {
    ereignis.respondWith(
      caches.match(anfrage).then(gelagert => gelagert || fetch(anfrage).then(antwort => {
        if (antwort && antwort.ok) {
          const kopie = antwort.clone();
          caches.open(CACHE).then(schrank => schrank.put(anfrage, kopie));
        }
        return antwort;
      }))
    );
    return;
  }

  // Bausteine: sofort aus dem Schrank, im Hintergrund auffrischen.
  ereignis.respondWith(
    caches.match(anfrage).then(gelagert => {
      const ausDemNetz = fetch(anfrage)
        .then(antwort => {
          if (antwort && antwort.ok) {
            const kopie = antwort.clone();
            caches.open(CACHE).then(schrank => schrank.put(anfrage, kopie));
          }
          return antwort;
        })
        .catch(() => gelagert);
      return gelagert || ausDemNetz;
    })
  );
});

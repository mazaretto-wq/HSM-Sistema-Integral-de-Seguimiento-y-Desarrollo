/* Service worker de la app de Haras Santa María.
   Solo cachea lo propio del sitio (HTML, manifest, íconos), para que abra
   sin señal. Todo lo de Firebase/Google (Firestore, Auth, Storage, fonts)
   es de otro origen y pasa siempre directo a la red: nunca se intercepta
   ni se cachea acá, así los datos siempre viajan en vivo cuando hay señal. */
const CACHE_NAME = 'hsm-v1';
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(nombres => Promise.all(nombres.filter(n => n !== CACHE_NAME).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  /* nada de afuera del sitio se toca: Firebase, Google Fonts, etc. siguen
     yendo directo a la red como si no hubiera service worker */
  if (url.origin !== self.location.origin) return;

  /* el HTML: red primero (trae lo último si hay internet), y si falla
     (sin señal) cae al que quedó guardado */
  if (request.mode === 'navigate' || url.pathname === '/index.html'){
    event.respondWith(
      fetch(request)
        .then(resp => {
          const copia = resp.clone();
          caches.open(CACHE_NAME).then(cache => cache.put('/index.html', copia));
          return resp;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  /* el resto de lo propio (manifest, íconos): lo que ya esté guardado
     responde al toque, y de paso se actualiza en segundo plano */
  event.respondWith(
    caches.match(request).then(cacheada => {
      const redPromesa = fetch(request).then(resp => {
        const copia = resp.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, copia));
        return resp;
      }).catch(() => cacheada);
      return cacheada || redPromesa;
    })
  );
});

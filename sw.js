// Service worker: network-first for HTML, cache-first for assets.
// Self-cleans on each install so a deploy that ships sw.js?v=NEW_SHA wipes old caches.
const CACHE = 'thesis-v1';

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  const isHTML = req.mode === 'navigate' ||
                 (req.headers.get('accept') || '').includes('text/html') ||
                 url.pathname.endsWith('/') ||
                 url.pathname.endsWith('.html');
  const isVersion = url.pathname.endsWith('/version.txt');

  if (isHTML || isVersion) {
    // Network-first, no cache — always get the freshest HTML/version
    e.respondWith(
      fetch(req, {cache: 'no-store'}).catch(() => caches.match(req))
    );
    return;
  }
  // Static assets: cache-first with background revalidation
  e.respondWith(
    caches.match(req).then(cached => {
      const fetchPromise = fetch(req).then(resp => {
        if (resp && resp.status === 200) {
          const copy = resp.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return resp;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});

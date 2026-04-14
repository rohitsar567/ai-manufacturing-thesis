// Service worker: network-first for HTML, cache-first for assets.
// BUILD_SHA_PLACEHOLDER is stamped per deploy so the SW byte-differs each time, forcing browser to install new.
const BUILD_SHA = 'a7f82841368a871189ee8137f5afe1a4ea505fcf';
const CACHE = 'thesis-' + BUILD_SHA;

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

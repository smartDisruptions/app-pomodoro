// Patch's Pomodoro service worker: the app works offline after the first visit.
// build.mjs replaces __BUILD__ with the build hash, so every deploy gets a fresh cache and old ones are dropped.
// Pages: network first (3 s), then the cached copy. Everything else same-origin: cache first, then network.
const CACHE = 'pomo-__BUILD__';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {})).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('pomo-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
const timeout = (ms) => new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms));
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (req.headers.has('range')) return;            // media range requests go straight to the network
  if (req.mode === 'navigate' || url.pathname.endsWith('/index.html') || url.pathname.endsWith('/')) {
    e.respondWith(Promise.race([fetch(req), timeout(3000)]).then((rsp) => {
      const copy = rsp.clone(); caches.open(CACHE).then((c) => c.put('index.html', copy)).catch(() => {});
      return rsp;
    }).catch(() => caches.match('index.html').then((r) => r || caches.match('./'))));
    return;
  }
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((rsp) => {
    if (rsp.ok && rsp.status === 200) { const copy = rsp.clone(); caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {}); }
    return rsp;
  })));
});

// Network-first s offline zálohou: online vždy dostane čerstvý kód, offline beží z cache.
// ponytail: žiadne verzovanie cache, netreba ručne zvyšovať číslo po zmene kódu.
const C = 'obed';
self.addEventListener('install', e => e.waitUntil(
  caches.open(C).then(c => c.addAll(['./', 'index.html', 'calc.js', 'manifest.json', 'icon-192.png', 'icon-512.png'])).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then(r => { const k = r.clone(); caches.open(C).then(c => c.put(e.request, k)); return r; })
    .catch(() => caches.match(e.request)));
});

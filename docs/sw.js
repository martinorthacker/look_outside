// Service Worker (ROADMAP #6): network-first für alles.
// Online kommt immer der frische Stand vom Netz (auch neue App-Versionen,
// ohne Cache-Versionierung pflegen zu müssen). Nur wenn das Netz fehlt, wird
// die zuletzt geladene Version aus dem Cache geliefert, markiert mit
// "x-offline-cache: 1", damit die Seite „offline" anzeigen kann.

const CACHE = 'look-outside-v1';
const SHELL = ['./', 'index.html', 'style.css', 'app.js', 'manifest.json', 'icon.svg', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(networkFirst(event));
});

async function networkFirst(event) {
  const req = event.request;
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res.ok) event.waitUntil(cache.put(req, res.clone()));
    return res;
  } catch (err) {
    const hit = (await cache.match(req, { ignoreSearch: true }))
      ?? (req.mode === 'navigate' ? await cache.match('./') : undefined);
    if (!hit) throw err;
    const headers = new Headers(hit.headers);
    headers.set('x-offline-cache', '1');
    return new Response(hit.body, { status: hit.status, statusText: hit.statusText, headers });
  }
}

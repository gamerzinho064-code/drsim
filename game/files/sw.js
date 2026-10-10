// Repeat visits without the wait: versioned assets (atlas sheets and chapter pack pages, ?v=<hash>)
// come from this cache with no request at all, and sounds come from it at once while a fresh copy is
// fetched behind them. Everything else (pages, js, the sprite tables, /api) goes to the network as it
// did without a worker, so a deploy never mixes an old table with new sheets.
const CACHE = 'drsim-assets-1';
const AUDIO = /\.(ogg|mp3|wav|m4a)$/i;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || req.headers.has('range')) return;
  const url = new URL(req.url);
  if (url.origin !== location.origin || !url.pathname.startsWith('/assets/')) return;
  if (url.searchParams.has('v') && !url.searchParams.has('retry')) e.respondWith(versioned(req, url));
  else if (AUDIO.test(url.pathname)) e.respondWith(audio(req, e));
});

async function versioned(req, url) {
  const c = await caches.open(CACHE);
  const hit = await c.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok && res.status === 200) {
    await c.put(req, res.clone());
    // the same file under an older version is dead weight now
    for (const k of await c.keys()) { const u = new URL(k.url); if (u.pathname === url.pathname && u.search !== url.search) c.delete(k); }
  }
  return res;
}

async function audio(req, e) {
  const c = await caches.open(CACHE);
  const hit = await c.match(req, { ignoreSearch: true });
  const fresh = fetch(req).then((res) => { if (res.ok && res.status === 200) return c.put(req, res.clone()).then(() => res); return res; });
  if (hit) { e.waitUntil(fresh.catch(() => { })); return hit; }
  return fresh;
}

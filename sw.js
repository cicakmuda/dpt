/* Dompetku — Service Worker (sw.js)
   Membuat aplikasi bisa dibuka offline & terasa seperti aplikasi asli.
   Naikkan VERSION setiap kali kamu mengunggah perubahan file. */
const VERSION = 'dompetku-v1.0.0';
const SHELL = ['./', './index.html', './style.css', './app.js', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png', './icons/favicon.svg'];
const CDN = ['https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js'];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSION);
    await c.addAll(SHELL);
    await Promise.all(CDN.map(u => c.add(u).catch(() => { })));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;                         // API (POST) selalu langsung ke server
  const url = new URL(req.url);
  if (/script\.google(usercontent)?\.com$/.test(url.hostname)) return;

  if (url.origin === location.origin) {
    // File aplikasi: utamakan versi terbaru dari internet, pakai cache saat offline
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res.ok) (await caches.open(VERSION)).put(req, res.clone());
        return res;
      } catch (err) {
        return (await caches.match(req, { ignoreSearch: true })) ||
          (req.mode === 'navigate' ? caches.match('./index.html') : Response.error());
      }
    })());
    return;
  }
  // Font & library dari CDN: pakai cache dulu
  e.respondWith((async () => {
    const hit = await caches.match(req);
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res.ok || res.type === 'opaque') (await caches.open(VERSION)).put(req, res.clone());
      return res;
    } catch (err) { return Response.error(); }
  })());
});

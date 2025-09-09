// public/sw.js
// PWA-cache: index.html alltid färsk via headers (Netlify), assets cacheas länge.
// SW uppdaterar sig själv (skipWaiting + clients.claim) och stör inte API/Firebase.

const STATIC_CACHE_NAME = 'traningslogg-static-v12';
const DYNAMIC_CACHE_NAME = 'traningslogg-dynamic-v7';
const MAX_DYNAMIC_ENTRIES = 80;

const URLS_TO_CACHE = [
  '/index.html',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/icon-180x180.png',
  '/favicon-32x32.png',
];

// Externa värdar vi inte cachar (Firebase/Google m.fl.)
const BYPASS_HOSTS = [
  'googleapis.com','gstatic.com','firebaseapp.com',
  'firebasestorage.googleapis.com','storage.googleapis.com','appspot.com',
  'identitytoolkit.googleapis.com','securetoken.googleapis.com',
  'firebasedatabase.app','apis.google.com',
];

// Egna paths att hoppa över (Netlify Functions, egna API:er)
const SAME_ORIGIN_BYPASS_PATH_PREFIXES = ['/.netlify/','/api/'];

// Endast tydligt statiska filer cachas
const STATIC_ASSET_REGEX = /\.(?:js|mjs|css|ico|png|jpg|jpeg|gif|webp|svg|woff2?)$/i;

// Ta emot meddelande från appen för att direkt aktivera ny SW
self.addEventListener('message', (e) => {
  if (e?.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then((cache) =>
      Promise.all(URLS_TO_CACHE.map((u) => cache.add(new Request(u, { cache: 'reload' }))))
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(
      names.map((n) => [STATIC_CACHE_NAME, DYNAMIC_CACHE_NAME].includes(n) ? undefined : caches.delete(n))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const accept = req.headers.get('accept') || '';

  // Bypass externa värdar
  if (BYPASS_HOSTS.some((h) => url.hostname.includes(h))) return;

  // HTML/navigering: network-first, offline-fallback till index
  const isHTML = req.mode === 'navigate' || accept.includes('text/html');
  if (isHTML) {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        const cache = await caches.open(STATIC_CACHE_NAME);
        try { await cache.put('/index.html', res.clone()); } catch {}
        return res;
      } catch {
        return (await caches.match('/index.html')) || Response.error();
      }
    })());
    return;
  }

  // Samma origin: cacha bara statiska assets, aldrig API/functions
  if (url.origin === self.location.origin) {
    if (SAME_ORIGIN_BYPASS_PATH_PREFIXES.some((p) => url.pathname.startsWith(p))) return;

    const isStaticAsset = STATIC_ASSET_REGEX.test(url.pathname) || url.pathname.startsWith('/assets/');
    if (isStaticAsset) {
      event.respondWith(cacheFirst(req));
      return;
    }
    // Övrigt: låt gå direkt till nätet (ingen SW-cache)
    return;
  }

  // Cross-origin: nätet först, fallback cache (lagra inte nya opaque)
  event.respondWith(fetch(req).catch(() => caches.match(req)));
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const res = await fetch(request);
  if (res && res.ok && res.type !== 'opaque') {
    const cache = await caches.open(DYNAMIC_CACHE_NAME);
    await cache.put(request, res.clone());
    await trimCache(DYNAMIC_CACHE_NAME, MAX_DYNAMIC_ENTRIES);
  }
  return res;
}

async function trimCache(cacheName, maxItems = 80) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxItems) {
    await Promise.all(keys.slice(0, keys.length - maxItems).map((k) => cache.delete(k)));
  }
}

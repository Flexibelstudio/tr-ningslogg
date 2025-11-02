// public/sw.js
// PWA-cache: index.html alltid färsk via no-store, assets cacheas länge.
// SW uppdaterar sig själv (skipWaiting + clients.claim), rensar gamla caches,
// stör inte API/Firebase och tål saknade precache-filer.

const VERSION = '2025-11-02-2'; // bumpa när du vill tvinga alla att uppdatera

// BUMPA dessa när du vill forcera ut ny version
const STATIC_CACHE_NAME  = 'traningslogg-static-v21';
const DYNAMIC_CACHE_NAME = 'traningslogg-dynamic-v16';
const MAX_DYNAMIC_ENTRIES = 80;

const URLS_TO_CACHE = [
  '/',               // SPA-fallback
  '/index.html',
  '/manifest.json',
  '/index.css',

  // Dina ikonvägar (behöll dina filnamn i rot)
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
  // lägg gärna till fler CDN om ni använder dem:
  'esm.sh','cdn.tailwindcss.com'
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
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE_NAME);
    // Lägg till en i taget (så inte EN 404 fäller hela installationen)
    for (const u of URLS_TO_CACHE) {
      try {
        await cache.add(new Request(u, { cache: 'reload' }));
      } catch (err) {
        console.warn('[SW] install: hoppar över (saknas/404?):', u);
      }
    }
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Rensa gamla cache-buckets
    const keep = new Set([STATIC_CACHE_NAME, DYNAMIC_CACHE_NAME]);
    const names = await caches.keys();
    await Promise.all(names.map((n) => keep.has(n) ? undefined : caches.delete(n)));

    // (valfritt) navigation preload
    if ('navigationPreload' in self.registration) {
      try { await self.registration.navigationPreload.enable(); } catch {}
    }

    await self.clients.claim();
    console.log('[SW] activated', VERSION);
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const accept = req.headers.get('accept') || '';

  // Bypass externa värdar
  if (BYPASS_HOSTS.some((h) => url.hostname.includes(h))) return;

  // HTML/navigering: network-first med no-store, offline-fallback till index
  const isHTML = req.mode === 'navigate' || accept.includes('text/html');
  if (isHTML) {
    event.respondWith((async () => {
      try {
        // Viktigt: no-store så vi aldrig serverar gammal HTML från browsercache
        const res = await fetch(req, { cache: 'no-store' });
        const cache = await caches.open(STATIC_CACHE_NAME);
        try { await cache.put('/index.html', res.clone()); } catch {}
        try { await cache.put('/',            res.clone()); } catch {}
        return res;
      } catch {
        return (await caches.match('/index.html')) ||
               (await caches.match('/')) ||
               Response.error();
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

self.addEventListener('push', (event) => {
  console.log('[SW] Push Received.');
  let data = {};
  try {
    data = event.data.json();
  } catch (e) {
    console.error('[SW] Push event but no data');
    data = { title: 'Ny notis', body: 'Du har fått en ny notis!' };
  }

  const title = data.title || 'Träningslogg';
  const options = {
    body: data.body || 'Ny händelse.',
    icon: '/icon-192x192.png',
    badge: '/favicon-32x32.png',
    vibrate: [200, 100, 200],
    tag: 'booking-notification', // Groups notifications
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification click Received.');
  event.notification.close();

  event.waitUntil(
    clients.matchAll({
      type: "window",
    }).then((clientList) => {
      for (const client of clientList) {
        // Just focus any open client for this app
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
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

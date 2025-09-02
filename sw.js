const STATIC_CACHE_NAME = 'smartstudio-static-v8';
const DYNAMIC_CACHE_NAME = 'smartstudio-dynamic-v3';
const URLS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/icon-180x180.png',
  '/favicon-32x32.png'
  // NOTE: External URLs are removed to prevent CORS errors during installation.
  // They will be cached dynamically by the fetch handler.
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then(cache => {
        console.log('Opened static cache');
        // Use addAll with a catch to prevent a single failure from stopping the entire install.
        return cache.addAll(URLS_TO_CACHE).catch(err => {
            console.error('Failed to cache all static assets during install:', err);
        });
      })
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [STATIC_CACHE_NAME, DYNAMIC_CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Strategy for Firestore API calls (Network-first for GET, network-only for others)
  if (url.hostname === 'firestore.googleapis.com') {
    if (event.request.method !== 'GET') {
      return; // Network only for mutations
    }
    
    event.respondWith(
      fetch(event.request)
        .then(networkResponse => {
          if (networkResponse.ok) {
            return caches.open(DYNAMIC_CACHE_NAME).then(cache => {
              cache.put(event.request, networkResponse.clone());
              return networkResponse;
            });
          }
          return networkResponse;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Strategy for all other requests (Cache-first for GET, network-only for others)
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request).then(networkResponse => {
        return caches.open(DYNAMIC_CACHE_NAME).then(cache => {
          // *** THE FIX *** Only cache GET requests.
          if (event.request.method === 'GET' && networkResponse && (networkResponse.status === 200 || networkResponse.status === 0)) {
             cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        });
      });
    })
  );
});

const STATIC_CACHE_NAME = 'traningslogg-static-v9';
const DYNAMIC_CACHE_NAME = 'traningslogg-dynamic-v4';
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

  // Strategy for Firestore API calls
  if (url.hostname === 'firestore.googleapis.com') {
    // For non-GET requests (like saving data), go to the network directly.
    // Do not attempt to cache POST, PUT, DELETE.
    if (event.request.method !== 'GET') {
      return; // Let the browser handle the request without interception.
    }
    
    // For GET requests (reading data), use a network-first strategy.
    // This ensures data is fresh, but provides an offline fallback.
    event.respondWith(
      fetch(event.request)
        .then(networkResponse => {
          // If the network request is successful, cache the response for offline use.
          if (networkResponse.ok) {
            return caches.open(DYNAMIC_CACHE_NAME).then(cache => {
              cache.put(event.request, networkResponse.clone());
              return networkResponse;
            });
          }
          // If network response is not ok, just return it without caching.
          return networkResponse;
        })
        .catch(() => {
          // If the network request fails (e.g., offline), try to serve from cache.
          return caches.match(event.request);
        })
    );
    return;
  }

  // Strategy for all other requests (app shell, fonts, scripts, images)
  // Use a cache-first strategy.
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      // If we have it in the cache, return it immediately.
      if (cachedResponse) {
        return cachedResponse;
      }

      // Otherwise, fetch it from the network.
      return fetch(event.request).then(networkResponse => {
        // Cache the new response for future use.
        return caches.open(DYNAMIC_CACHE_NAME).then(cache => {
          // Only cache valid GET responses. Cross-origin (opaque) responses are fine.
          if (event.request.method === 'GET' && networkResponse && (networkResponse.status === 200 || networkResponse.status === 0)) {
             cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        });
      });
    })
  );
});
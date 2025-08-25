const STATIC_CACHE_NAME = 'smartstudio-static-v3';
const DYNAMIC_CACHE_NAME = 'smartstudio-dynamic-v1';
const URLS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png',
  'https://cdn.tailwindcss.com',
  'https://esm.sh/react@^19.1.0',
  'https://esm.sh/react-dom@^19.1.0/',
  'https://esm.sh/@google/genai',
  'https://esm.sh/html2canvas@^1.4.1',
  'https://esm.sh/chart.js@^4.4.3/auto',
  'https://esm.sh/chartjs-adapter-date-fns@^3.0.0',
  'https://esm.sh/jsqr@^1.4.0',
  'https://esm.sh/qrcode@^1.5.3',
  'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js',
  'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js',
  'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then(cache => {
        console.log('Opened static cache');
        return cache.addAll(URLS_TO_CACHE);
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
  // Use a stale-while-revalidate strategy for Firestore API calls.
  if (event.request.url.includes('firestore.googleapis.com')) {
    event.respondWith(
      caches.open(DYNAMIC_CACHE_NAME).then(cache => {
        return cache.match(event.request).then(response => {
          const fetchPromise = fetch(event.request).then(networkResponse => {
            if (networkResponse && networkResponse.ok) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(err => {
            console.error('Firestore fetch failed; serving stale data if available.', err);
            // If network fails, the cached response (if it exists) is still returned.
          });
          // Return cached response immediately if available, otherwise wait for network.
          return response || fetchPromise;
        });
      })
    );
  } else {
    // Use a cache-first strategy for all other (static asset) requests.
    event.respondWith(
      caches.match(event.request).then(response => {
        // Cache hit - return response
        if (response) {
          return response;
        }

        // Not in cache - fetch from network, then cache it for next time.
        return fetch(event.request).then(
          fetchResponse => {
            // Check if we received a valid response
            if (!fetchResponse || (fetchResponse.status !== 200 && fetchResponse.status !== 0) || fetchResponse.type === 'error') {
              return fetchResponse;
            }

            const responseToCache = fetchResponse.clone();

            caches.open(STATIC_CACHE_NAME)
              .then(cache => {
                // Only cache GET requests.
                if (event.request.method === 'GET') {
                  cache.put(event.request, responseToCache);
                }
              });

            return fetchResponse;
          }
        );
      })
    );
  }
});
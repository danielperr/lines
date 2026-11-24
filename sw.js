// Offline support. Network first so updates show up immediately; the cached
// copy is used when offline or when the network is too slow to answer.
// tests/sw.test.js fails if a file the app needs is missing from APP_SHELL.

// Placeholder: npm run build replaces it with a hash of the deployed files.
const CACHE_NAME = 'deadlines-shell-dev';
const NETWORK_TIMEOUT_MS = 3000;

const APP_SHELL = [
  './',
  './styles.css',
  './manifest.webmanifest',
  './icon.svg',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './src/app.js',
  './src/break-rows.js',
  './src/change-guard.js',
  './src/course-wizard-form.js',
  './src/course-wizard.js',
  './src/dates.js',
  './src/dom.js',
  './src/item-form.js',
  './src/offline.js',
  './src/overview-view.js',
  './src/overview.js',
  './src/scroll.js',
  './src/scheduler.js',
  './src/storage.js',
  './src/track-form.js',
  './src/track-view.js',
  './src/tracks.js',
  './src/undo.js',
  './src/view-parts.js',
  './src/view.js',
  './src/wizard-deadline-row.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const withTimeout = (promise, ms) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('network timeout')), ms);
  promise.then(
    (value) => { clearTimeout(timer); resolve(value); },
    (error) => { clearTimeout(timer); reject(error); },
  );
});

// Hosts may redirect /index.html to /, and a saved redirect can't answer a page load, so pages use './'.
const cacheKey = (request) => (request.mode === 'navigate' ? './' : request);

const networkFirst = async (event) => {
  const { request } = event;
  const cache = await caches.open(CACHE_NAME);
  const fromNetwork = fetch(request, { cache: 'no-store' }).then((response) => {
    if (response.ok && !response.redirected) event.waitUntil(cache.put(cacheKey(request), response.clone()));
    return response;
  });
  try {
    return await withTimeout(fromNetwork, NETWORK_TIMEOUT_MS);
  } catch (error) {
    const cached = await cache.match(cacheKey(request), { ignoreSearch: true });
    if (cached) return cached;
    return fromNetwork; // nothing cached: wait for the network after all
  }
};

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(networkFirst(event));
});

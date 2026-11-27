// Offline support. Network first so updates show up immediately; the cached
// copy is used when offline or when the network is too slow to answer.
// tests/sw.test.js fails if a file the app needs is missing from APP_SHELL.

// Placeholder: npm run build replaces it with a hash of the deployed files.
const CACHE_NAME = 'deadlines-shell-dev';
const NETWORK_TIMEOUT_MS = 3000;

const APP_SHELL = [
  './',
  './styles.css',
  './motion.css',
  './manifest.webmanifest',
  './icon.svg',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './src/app.js',
  './src/backup.js',
  './src/celebrate-model.js',
  './src/celebrate.js',
  './src/break-rows.js',
  './src/change-guard.js',
  './src/course-wizard-form.js',
  './src/course-wizard.js',
  './src/course-detail-view.js',
  './src/course-edit-form.js',
  './src/detail-model.js',
  './src/milestone-form.js',
  './src/course/edit.js',
  './src/course/milestone-draft.js',
  './src/course/timeline.js',
  './src/course/color.js',
  './src/course/course.js',
  './src/course/lectures.js',
  './src/course/migrate-v4.js',
  './src/course/milestone.js',
  './src/course/planner.js',
  './src/course/prep.js',
  './src/course/schedule.js',
  './src/course/slack.js',
  './src/course/status.js',
  './src/course/store.js',
  './src/course/snooze.js',
  './src/course/today.js',
  './src/home-model.js',
  './src/home-stats.js',
  './src/home-view.js',
  './src/dates.js',
  './src/dom.js',
  './src/extra-date-rows.js',
  './src/offline.js',
  './src/progress-model.js',
  './src/sheet-backdrop.js',
  './src/sheet-motion.js',
  './src/sheet-swipe.js',
  './src/step-transition.js',
  './src/swatch-picker.js',
  './src/toast.js',
  './src/undo.js',
  './src/view-parts.js',
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

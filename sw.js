// sw.js — offline shell.
//
// With ES modules the worker caches a LIST, not a single file. Every release
// must keep this list correct; a file missing here is a file that silently
// stops updating. Bump CACHE on every deploy (§14.3).

const CACHE = 'bagra-v0.12.0';

const FILES = [
  './',
  './index.html',
  './app.js',
  './db.js',
  './i18n.js',
  './vocab.js',
  './ui.js',
  './fabric-logic.js',
  './manifest.json',
  './modules/dashboard.js',
  './modules/reference.js',
  './modules/plants.js',
  './modules/fabrics.js',
  './modules/materials.js',
  './modules/substances.js',
  './modules/recipes.js',
  './modules/techniques.js',
  './modules/trials.js',
  './modules/tools.js',
  './calc/basic.js',
  './calc/scale.js',
  './seed/substances.json',
  './calc/alum-acetate.js',
  './modules/packs.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network first, cache as fallback: the app must keep working offline, but a
// deployed change should not wait a week to appear.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(e.request).then(hit => hit || caches.match('./index.html')))
  );
});

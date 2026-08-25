// sw.js — offline shell.
//
// With ES modules the worker caches a LIST, not a single file. Every release
// must keep this list correct; a file missing here is a file that silently
// stops updating. Bump CACHE on every deploy (§14.3).

const CACHE = 'bagra-v1.0.0-rc39';   // keep in step with version.js

const FILES = [
  './',
  './index.html',
  './app.js',
  './db.js',
  './refs.js',
  './units.js',
  './migrate-photos.js',
  './migrations.js',
  './i18n.js',
  './vocab.js',
  './ui.js',
  './backup.js',
  './photo.js',
  './seed.js',
  './seed-ui.js',
  './stock-logic.js',
  './fabric-logic.js',
  './migrate-actions.js',
  './dirty.js',
  './manifest.json',
  './version.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-192-maskable.png',
  './icons/icon-512-maskable.png',
  './icons/favicon-64.png',
  './modules/dashboard.js',
  './modules/reference.js',
  './modules/plants.js',
  './modules/season.js',
  './modules/fabrics.js',
  './modules/materials.js',
  './modules/substances.js',
  './modules/recipes.js',
  './modules/chains.js',
  './modules/techniques.js',
  './modules/trials.js',
  './modules/tools.js',
  './calc/basic.js',
  './calc/scale.js',
  './calc/colour.js',
  './seed/substances.json',
  './seed/plants.json',
  './seed/manifest.json',
  './seed/plant-photos.json',
  './seed/techniques.json',
  './seed/combinations.json',
  './seed/sources.json',
  './seed/glossary.json',
  './seed/recipes.json',
  './calc/alum-acetate.js',
  './modules/packs.js',
  './modules/library.js',
  './modules/pigments.js',
  './modules/batch.js',

  // The shipped plant photographs (§13cr). They left the plant record in rc28
  // and are static files now, so the worker has to carry them or an
  // offline library shows 57 broken pictures.
  './seed/images/plants/achillea_millefolium.jpg',
  './seed/images/plants/alkanna_tinctoria.jpg',
  './seed/images/plants/allium_cepa.jpg',
  './seed/images/plants/alnus_glutinosa.jpg',
  './seed/images/plants/anthemis_tinctoria.jpg',
  './seed/images/plants/betula_pendula.jpg',
  './seed/images/plants/calendula_officinalis.jpg',
  './seed/images/plants/carthamus_tinctorius.jpg',
  './seed/images/plants/castanea_sativa.jpg',
  './seed/images/plants/coreopsis_tinctoria.jpg',
  './seed/images/plants/cornus_mas.jpg',
  './seed/images/plants/cornus_sanguinea.jpg',
  './seed/images/plants/corylus_avellana.jpg',
  './seed/images/plants/cosmos_sulphureus.jpg',
  './seed/images/plants/cotinus_coggygria.jpg',
  './seed/images/plants/crataegus_monogyna.jpg',
  './seed/images/plants/dahlia_pinnata.jpg',
  './seed/images/plants/eucalyptus_spp.jpg',
  './seed/images/plants/frangula_alnus.jpg',
  './seed/images/plants/fraxinus_excelsior.jpg',
  './seed/images/plants/genista_tinctoria.jpg',
  './seed/images/plants/geranium_macrorrhizum.jpg',
  './seed/images/plants/hypericum_perforatum.jpg',
  './seed/images/plants/isatis_tinctoria.jpg',
  './seed/images/plants/juglans_regia.jpg',
  './seed/images/plants/lavandula_angustifolia.jpg',
  './seed/images/plants/lawsonia_inermis.jpg',
  './seed/images/plants/malus_domestica.jpg',
  './seed/images/plants/melissa_officinalis.jpg',
  './seed/images/plants/mentha_spp.jpg',
  './seed/images/plants/mespilus_germanica.jpg',
  './seed/images/plants/origanum_vulgare.jpg',
  './seed/images/plants/paubrasilia_echinata.jpg',
  './seed/images/plants/pelargonium_zonale.jpg',
  './seed/images/plants/persea_americana.jpg',
  './seed/images/plants/persicaria_tinctoria.jpg',
  './seed/images/plants/prunus_domestica.jpg',
  './seed/images/plants/punica_granatum.jpg',
  './seed/images/plants/quercus_robur.jpg',
  './seed/images/plants/reseda_luteola.jpg',
  './seed/images/plants/rhamnus_cathartica.jpg',
  './seed/images/plants/rhamnus_tinctoria.jpg',
  './seed/images/plants/rheum_rhabarbarum.jpg',
  './seed/images/plants/rhus_coriaria.jpg',
  './seed/images/plants/rosa_spp.jpg',
  './seed/images/plants/rosmarinus_officinalis.jpg',
  './seed/images/plants/rubia_tinctorum.jpg',
  './seed/images/plants/rubus_fruticosus.jpg',
  './seed/images/plants/salix_alba.jpg',
  './seed/images/plants/salvia_officinalis.jpg',
  './seed/images/plants/sambucus_nigra.jpg',
  './seed/images/plants/senegalia_catechu.jpg',
  './seed/images/plants/tagetes_erecta.jpg',
  './seed/images/plants/tanacetum_vulgare.jpg',
  './seed/images/plants/thymus_vulgaris.jpg',
  './seed/images/plants/tilia_cordata.jpg',
  './seed/images/plants/urtica_dioica.jpg',
];

// The new worker deliberately does NOT take over by itself. It waits until the
// page says so, which lets the app offer a visible "new version — reload"
// rather than swapping code under someone mid-form.
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
});

self.addEventListener('message', (e) => {
  if (e.data === 'skip-waiting') self.skipWaiting();
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

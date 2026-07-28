// app.js — bootstrap, routing, navigation.
//
// One render pattern for all modules, fixed here at the outset: each module
// exports { id, title(), sub(), render(root) } and owns nothing outside the
// element it is handed. With seven modules this consistency is the difference
// between one application and seven.

import { open, all, put, count, getSetting } from './db.js';
import { initLang, setLang, getLang, t } from './i18n.js';
import { VOCABULARY, BANDS } from './vocab.js';

import dashboard  from './modules/dashboard.js';
import reference  from './modules/reference.js';
import plants     from './modules/plants.js';
import fabrics    from './modules/fabrics.js';
import materials  from './modules/materials.js';
import substances from './modules/substances.js';
import recipes    from './modules/recipes.js';
import techniques from './modules/techniques.js';
import trials     from './modules/trials.js';
import tools      from './modules/tools.js';
import packs      from './modules/packs.js';

const MODULES = {
  dashboard, reference, plants, fabrics, substances, materials,
  recipes, techniques, trials, tools, packs,
};

// Sidebar carries everything; the phone bar carries the five that matter in
// the studio and the garden (§11.3). Laptop is the primary form.
const NAV = [
  { id: 'dashboard',  icon: 'i-home' },
  { id: 'reference',  icon: 'i-reference' },
  { id: 'plants',     icon: 'i-plant' },
  { id: 'fabrics',    icon: 'i-fabric' },
  { id: 'substances', icon: 'i-tools' },
  { id: 'materials',  icon: 'i-packs' },
  { id: 'recipes',    icon: 'i-recipe' },
  { id: 'techniques', icon: 'i-technique' },
  { id: 'trials',     icon: 'i-trial' },
  { id: 'tools',      icon: 'i-tools' },
  { id: 'packs',      icon: 'i-packs' },
];

const PHONE_NAV = ['dashboard', 'reference', 'trials', 'plants', 'recipes'];

const $ = (sel) => document.querySelector(sel);
const icon = (id) => `<svg aria-hidden="true"><use href="#${id}"></use></svg>`;

function currentRoute() {
  const id = location.hash.replace(/^#\/?/, '') || 'dashboard';
  return MODULES[id] ? id : 'dashboard';
}

function renderNav() {
  const active = currentRoute();

  $('#sidebar').innerHTML =
    `<div class="brand"><b>${t('app.name')}</b><span>${t('app.tagline')}</span></div>` +
    NAV.map(n => `
      <button class="navitem" data-go="${n.id}"
        ${n.id === active ? 'aria-current="page"' : ''}>
        ${icon(n.icon)}<span>${t('nav.' + n.id)}</span>
      </button>`).join('') +
    `<div class="navgap"></div>
     <div class="langrow">
       <button class="langbtn" data-lang="bg" aria-pressed="${getLang() === 'bg'}">${t('lang.bg')}</button>
       <button class="langbtn" data-lang="en" aria-pressed="${getLang() === 'en'}">${t('lang.en')}</button>
     </div>`;

  $('#bottomnav').innerHTML = PHONE_NAV.map(id => {
    const n = NAV.find(x => x.id === id);
    return `<button data-go="${id}" ${id === active ? 'aria-current="page"' : ''}>
      ${icon(n.icon)}<span>${t('nav.' + id)}</span></button>`;
  }).join('');
}

async function renderView() {
  const id = currentRoute();
  const view = $('#view');
  await MODULES[id].render(view);
  view.focus({ preventScroll: true });
  document.title = `${t('nav.' + id)} · ${t('app.name')}`;
}

async function route() {
  renderNav();
  await renderView();
}

// Vocabularies and bands ship as seed data (§13.10). Seeding only ever adds:
// a term already present is left alone, so the user's edits survive.
async function seedIfEmpty() {
  if (await count('vocabulary') === 0) {
    for (const v of VOCABULARY) await put('vocabulary', { ...v, origin: 'seed' });
  }
  if (await count('bands') === 0) {
    for (const b of BANDS) await put('bands', { ...b, origin: 'seed' });
  }
}

document.addEventListener('click', async (e) => {
  const go = e.target.closest('[data-go]');
  if (go) { location.hash = '#/' + go.dataset.go; return; }

  const lang = e.target.closest('[data-lang]');
  if (lang) { await setLang(lang.dataset.lang); await route(); }
});

window.addEventListener('hashchange', route);

(async function start() {
  await open();
  await initLang();
  await seedIfEmpty();
  await route();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();

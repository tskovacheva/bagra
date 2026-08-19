// modules/techniques.js — a controlled vocabulary of what was physically done
// (§6). Orthogonal to the recipe: the recipe says what was in the pot, the
// technique says what was done to the cloth.

import { all, get, put, remove, newRecord } from '../db.js';
import { markEdited } from '../seed.js';
import * as seedUI from '../seed-ui.js';
import { t, text } from '../i18n.js';
import { markClean } from '../dirty.js';
import { page, panel, field, options, label, esc, empty, pairField, readPairs, searchBox, matches, icon, navigate, fieldGroup, backTo, actionBtn } from '../ui.js';

const CAT_ICONS = {
  resist: 'k-resist', shibori: 'k-shibori', printing: 'k-printing',
  bundling: 'k-bundling', post_treatment: 'k-post_treatment',
};

const CATEGORIES = ['resist', 'shibori', 'printing', 'bundling', 'post_treatment'];
const PROCESSES = ['immersion', 'ecoprint', 'paste'];

let filterCat = null;
let query = '';
let openId = null;
let draft = null;

function blank() {
  return newRecord({
    category: 'resist',
    name: { bg: '', en: '' },
    description: { bg: '', en: '' },
    appliesTo: [],
    distributable: true,
  });
}

// ---------------------------------------------------------------- list view

async function renderList(root) {
  const items = await all('techniques');

  const counts = {};
  for (const x of items) counts[x.category] = (counts[x.category] || 0) + 1;

  const tabs = await Promise.all(CATEGORIES.map(async c => `
    <button class="box${filterCat === c ? ' active' : ''}" data-cat="${c}">
      <span class="boxicon">${icon(CAT_ICONS[c])}</span>
      <span class="boxname">${esc(await label('technique_category', c))}</span>
      <span class="boxcount">${counts[c] || 0}</span>
    </button>`));

  const shown = (filterCat ? items.filter(x => x.category === filterCat) : items)
    .filter(x => matches(query, text(x.name), x.notes))
    .sort((a, b) => text(a.name).localeCompare(text(b.name)));

  // Cards, not rows (§13s·1). A technique *is* its description — how the cloth
  // is folded, what happens to the colour — and a table cell cut it off
  // mid-word: "при ант…", "нароч…", "смачкани, пасирани или като студена …".
  // Truncating the content is not presenting it.
  const cards = await Promise.all(shown.map(async x => {
    const procs = (await Promise.all((x.appliesTo || []).map(p => label('process', p))));
    return `
      <button class="techcard" data-open="${x.id}">
        <div class="techhead">
          <span class="techplate">${icon(CAT_ICONS[x.category] || 'i-technique')}</span>
          <span class="spacer"></span>
          <span class="chip">${esc(await label('technique_category', x.category))}</span>
        </div>
        <div class="techname">${esc(text(x.name) || '—')}</div>
        <div class="hint">${esc(procs.join(', ') || '—')}</div>
        <p class="techdesc">${esc(text(x.description) || '')}</p>
      </button>`;
  }));

  const table = shown.length
    ? `<div class="techcards">${cards.join('')}</div>`
    : empty(filterCat ? t('techniques.emptyCat') : t('techniques.empty'), t('techniques.emptyHint'));

  root.innerHTML = page({
    title: t('techniques.title'),
    sub: t('techniques.sub'),
    actions: `<button class="btn quiet" data-sync>${t('seed.sync')}</button>
              ${actionBtn('add', t('techniques.new'), 'data-new', 'primary')}`,
    body: `
      <div class="boxes">
        <button class="box${filterCat === null ? ' active' : ''}" data-cat="">
          <span class="boxname">${t('common.all')}</span>
          <span class="boxcount">${items.length}</span>
        </button>
        ${tabs.join('')}
      </div>
      <div class="filterrow">${searchBox(query, t('techniques.search'))}</div>
      ${shown.length ? table : panel(table, 'flush')}`,
  });
}

// ---------------------------------------------------------------- form view

async function renderForm(root, r) {
  const isNew = openId === 'new';

  const procChecks = (await Promise.all(PROCESSES.map(async p => `
    <label class="check"><input type="checkbox" data-multi="appliesTo" value="${p}"
      ${(r.appliesTo || []).includes(p) ? 'checked' : ''}>
      ${esc(await label('process', p))}</label>`))).join('');

  root.innerHTML = page({
    title: isNew ? t('techniques.new') : (text(r.name) || t('techniques.one')),
    sub: isNew ? t('techniques.emptyHint') : '',
    actions: `${backTo('#/techniques', t('nav.techniques'))}
              <button class="btn primary" data-save>${t('common.save')}</button>`,
    body: `
      <div class="cols">
        <div class="col">
          ${panel(`
            <h2>${t('techniques.about')}</h2>
            ${pairField(t('techniques.name'), 'name', r.name)}
            ${field(t('techniques.category'), `<select data-f="category">${await options('technique_category', r.category, '')}</select>`)}
            ${fieldGroup(t('techniques.appliesTo'), `<div class="checks">${procChecks}</div>`)}
          `)}
        </div>

        <div class="col">
          ${panel(`
            <h2>${t('techniques.description')}</h2>
            ${pairField('', 'description', r.description, { multiline: true, placeholder: t('techniques.descriptionPlaceholder') })}
            ${!isNew ? `${actionBtn('delete', t('techniques.delete'), 'data-delete', 'destructive')}` : ''}
          `)}
        </div>
      </div>`,
  });
}

function readForm(root) {
  for (const el of root.querySelectorAll('[data-f]')) draft[el.dataset.f] = el.value;
  draft.appliesTo = [];
  for (const el of root.querySelectorAll('[data-multi="appliesTo"]')) {
    if (el.checked) draft.appliesTo.push(el.value);
  }
  readPairs(root, draft);
}

export default {
  id: 'techniques',
  title: () => t('techniques.title'),
  sub: () => t('techniques.sub'),

  // The address decides what is on screen (§13q). Called on every route
  // change, with nothing when the address names no record, which is how the
  // list comes back.
  //
  //   #/techniques          the list
  //   #/techniques/new      a new record
  //   #/techniques/<id>     the record
  open(first) {
    draft = null;
    openId = first || null;
  },

  reset() {
    openId = null;
    draft = null;
    filterCat = null;
    query = '';
    seedUI.close();
  },

  async render(root) {
    if (seedUI.isOpen()) return seedUI.render(root, () => this.render(root));

    if (openId) {
      if (!draft || (openId !== 'new' && draft.id !== openId)) {
        draft = openId === 'new' ? blank() : structuredClone(await get('techniques', openId));
      }
      // An address naming a record that is gone — a bookmark to something
      // deleted, or the back button after deleting it. Drawing it throws, and a
      // thrown render leaves the previous screen in place, which reads as the
      // address being ignored (§11b). The list is the honest answer.
      if (!draft) return navigate('#/techniques');
      await renderForm(root, draft);
    } else {
      draft = null;
      await renderList(root);
    }

    root.oninput = (e) => {
      if (e.target.dataset.search === undefined) return;
      query = e.target.value;
      const at = e.target.selectionStart;
      this.render(root).then(() => {
        const box = root.querySelector('[data-search]');
        if (box) { box.focus(); box.setSelectionRange(at, at); }
      });
    };

    root.onclick = async (e) => {
      if (e.target.closest('[data-searchclear]')) { query = ''; return this.render(root); }
      const cat = e.target.closest('[data-cat]');
      if (cat) { filterCat = cat.dataset.cat || null; return this.render(root); }

      if (e.target.closest('[data-sync]')) {
        try {
          await seedUI.open('techniques');
          return seedUI.render(root, () => this.render(root));
        } catch (err) { alert(err.message); }
        return;
      }

      if (e.target.closest('[data-new]')) return navigate('#/techniques/new');
      const row = e.target.closest('[data-open]');
      if (row) return navigate(`#/techniques/${row.dataset.open}`);
      if (e.target.closest('[data-back]')) return navigate('#/techniques');

      if (e.target.closest('[data-save]')) {
        readForm(root);
        await put('techniques', markEdited(draft));
        // The put succeeded, so the work is saved and the address change that
        // follows is not a departure. `dirty.js` cannot tell the two apart from
        // outside — it infers a successful save by watching the form leave the
        // screen — but in here the answer is known (§13ad).
        markClean();
        return navigate('#/techniques');
      }
      if (e.target.closest('[data-delete]')) {
        if (!confirm(t('techniques.confirmDelete'))) return;
        await remove('techniques', draft.id);
        return navigate('#/techniques');
      }
    };
  },
};

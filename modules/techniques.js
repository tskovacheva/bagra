// modules/techniques.js — a controlled vocabulary of what was physically done
// (§6). Orthogonal to the recipe: the recipe says what was in the pot, the
// technique says what was done to the cloth.

import { all, get, put, remove, newRecord } from '../db.js';
import { markEdited } from '../seed.js';
import * as seedUI from '../seed-ui.js';
import { t, text } from '../i18n.js';
import { page, panel, field, options, label, esc, empty, pairField, readPairs } from '../ui.js';

const CATEGORIES = ['resist', 'shibori', 'printing', 'bundling', 'post_treatment'];
const PROCESSES = ['immersion', 'ecoprint', 'paste'];

let filterCat = null;
let openId = null;
let draft = null;

function blank() {
  return newRecord({
    category: 'resist',
    name: { bg: '', en: '' },
    description: { bg: '', en: '' },
    appliesTo: [],
    learnedFrom: '',
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
      <span class="boxname">${esc(await label('technique_category', c))}</span>
      <span class="boxcount">${counts[c] || 0}</span>
    </button>`));

  const shown = (filterCat ? items.filter(x => x.category === filterCat) : items)
    .sort((a, b) => text(a.name).localeCompare(text(b.name)));

  const rows = await Promise.all(shown.map(async x => {
    const procs = (await Promise.all((x.appliesTo || []).map(p => label('process', p)))).join(', ');
    const desc = text(x.description) || '';
    return `<tr data-open="${x.id}">
      <td>${esc(text(x.name) || '—')}</td>
      <td>${esc(await label('technique_category', x.category))}</td>
      <td>${esc(procs || '—')}</td>
      <td class="clip">${esc(desc.length > 120 ? desc.slice(0, 120) + '…' : desc)}</td>
    </tr>`;
  }));

  const table = shown.length ? `
    <table class="grid">
      <thead><tr>
        <th>${t('techniques.col.name')}</th>
        <th>${t('techniques.col.category')}</th>
        <th>${t('techniques.col.appliesTo')}</th>
        <th>${t('techniques.col.description')}</th>
      </tr></thead>
      <tbody>${rows.join('')}</tbody>
    </table>`
    : empty(filterCat ? t('techniques.emptyCat') : t('techniques.empty'), t('techniques.emptyHint'));

  root.innerHTML = page({
    title: t('techniques.title'),
    sub: t('techniques.sub'),
    actions: `<button class="btn quiet" data-sync>${t('seed.sync')}</button>
              <button class="btn primary" data-new>${t('techniques.new')}</button>`,
    body: `
      <div class="boxes">
        <button class="box${filterCat === null ? ' active' : ''}" data-cat="">
          <span class="boxname">${t('common.all')}</span>
          <span class="boxcount">${items.length}</span>
        </button>
        ${tabs.join('')}
      </div>
      ${panel(table, 'flush')}`,
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
    actions: `<button class="btn quiet" data-back>${t('common.back')}</button>
              <button class="btn primary" data-save>${t('common.save')}</button>`,
    body: `
      <div class="cols">
        <div class="col">
          ${panel(`
            <h2>${t('techniques.about')}</h2>
            ${pairField(t('techniques.name'), 'name', r.name)}
            ${field(t('techniques.category'), `<select data-f="category">${await options('technique_category', r.category, '')}</select>`)}
            ${field(t('techniques.appliesTo'), `<div class="checks">${procChecks}</div>`)}
          `)}
        </div>

        <div class="col">
          ${panel(`
            <h2>${t('techniques.description')}</h2>
            ${pairField('', 'description', r.description, { multiline: true, placeholder: t('techniques.descriptionPlaceholder') })}
            ${field(t('techniques.learnedFrom'), `<input type="text" data-f="learnedFrom" value="${esc(r.learnedFrom || '')}">`, t('recipes.learnedFromHint'))}
            ${!isNew ? `<button class="btn danger quiet" data-delete>${t('techniques.delete')}</button>` : ''}
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

  reset() {
    openId = null;
    draft = null;
    filterCat = null;
    seedUI.close();
  },

  async render(root) {
    if (seedUI.isOpen()) return seedUI.render(root, () => this.render(root));

    if (openId) {
      if (!draft || (openId !== 'new' && draft.id !== openId)) {
        draft = openId === 'new' ? blank() : structuredClone(await get('techniques', openId));
      }
      await renderForm(root, draft);
    } else {
      draft = null;
      await renderList(root);
    }

    root.onclick = async (e) => {
      const cat = e.target.closest('[data-cat]');
      if (cat) { filterCat = cat.dataset.cat || null; return this.render(root); }

      if (e.target.closest('[data-sync]')) {
        try {
          await seedUI.open('techniques');
          return seedUI.render(root, () => this.render(root));
        } catch (err) { alert(err.message); }
        return;
      }

      if (e.target.closest('[data-new]')) { draft = null; openId = 'new'; return this.render(root); }
      const row = e.target.closest('[data-open]');
      if (row) { draft = null; openId = row.dataset.open; return this.render(root); }
      if (e.target.closest('[data-back]')) { openId = null; draft = null; return this.render(root); }

      if (e.target.closest('[data-save]')) {
        readForm(root);
        await put('techniques', markEdited(draft));
        openId = null; draft = null;
        return this.render(root);
      }
      if (e.target.closest('[data-delete]')) {
        if (!confirm(t('techniques.confirmDelete'))) return;
        await remove('techniques', draft.id);
        openId = null; draft = null;
        return this.render(root);
      }
    };
  },
};

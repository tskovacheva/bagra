// modules/materials.js — everything on the shelf except fabric (§3, A.2–A.5).
//
// One entity, five categories. Fabric is deliberately NOT here: it is an
// object with a biography, not a consumable, and lives in its own store.

import { all, get, put, remove, newRecord } from '../db.js';
import { t, text } from '../i18n.js';
import {
  page, panel, field, options, label, esc, empty, note,
  pairField, readPairs,
} from '../ui.js';

const CATEGORIES = ['dyestuff', 'tannin', 'mordant', 'modifier', 'auxiliary'];

let filterCat = null;
let openId = null;
let draft = null;

function blank() {
  return newRecord({
    category: 'mordant',
    name: { bg: '', en: '' },
    supplier: '',
    acquiredDate: '',
    stock: { value: null, unit: 'g' },
    notes: { bg: '', en: '' },

    // chemical identity — the calculators read these (§5.1)
    formula: '',
    hydrationState: '',
    molarMass: null,
    concentrationPercent: null,

    // per-category
    plantId: '', form: 'dried', partCode: '', harvestDate: '',
    manufacturer: '', dyeClass: '',
    tanninTypeCode: '', colourCast: '',
    mordantTypeCode: '', standardPercentWof: null, suitableFibreClasses: [],
    colourEffect: '', maxTempC: null, handling: [],
    disposalNote: { bg: '', en: '' }, safetyNote: { bg: '', en: '' },
    phDirection: '', typicalUse: { bg: '', en: '' }, effectNotes: { bg: '', en: '' },
  });
}

// ---------------------------------------------------------------- list view

async function detailOf(m) {
  switch (m.category) {
    case 'dyestuff': return await label('plant_part', m.partCode) || t('materials.form.' + m.form);
    case 'tannin':   return await label('tannin_type', m.tanninTypeCode);
    case 'mordant':  return await label('mordant_type', m.mordantTypeCode);
    case 'modifier': return m.phDirection ? t('materials.ph.' + m.phDirection) : '';
    default:         return '';
  }
}

async function renderList(root) {
  const materials = await all('materials');

  const counts = {};
  for (const m of materials) counts[m.category] = (counts[m.category] || 0) + 1;

  const tabs = await Promise.all(CATEGORIES.map(async c => `
    <button class="box${filterCat === c ? ' active' : ''}" data-cat="${c}">
      <span class="boxname">${esc(await label('material_category', c))}</span>
      <span class="boxcount">${counts[c] || 0}</span>
    </button>`));

  const shown = (filterCat ? materials.filter(m => m.category === filterCat) : materials)
    .sort((a, b) => text(a.name).localeCompare(text(b.name)));

  const rows = await Promise.all(shown.map(async m => `
    <tr data-open="${m.id}">
      <td>${esc(text(m.name) || '—')}</td>
      <td>${esc(await label('material_category', m.category))}</td>
      <td>${esc(await detailOf(m))}</td>
      <td class="num">${m.stock?.value != null ? esc(m.stock.value + ' ' + (m.stock.unit || '')) : '—'}</td>
      <td>${esc(m.supplier || '—')}</td>
    </tr>`));

  const table = shown.length ? `
    <table class="grid">
      <thead><tr>
        <th>${t('materials.col.name')}</th>
        <th>${t('materials.col.category')}</th>
        <th>${t('materials.col.detail')}</th>
        <th class="num">${t('materials.col.stock')}</th>
        <th>${t('materials.col.supplier')}</th>
      </tr></thead>
      <tbody>${rows.join('')}</tbody>
    </table>`
    : empty(filterCat ? t('materials.emptyCat') : t('materials.empty'), t('materials.emptyHint'));

  root.innerHTML = page({
    title: t('materials.title'),
    sub: t('materials.sub'),
    actions: `<button class="btn primary" data-new>${t('materials.new')}</button>`,
    body: `
      <div class="boxes">
        <button class="box${filterCat === null ? ' active' : ''}" data-cat="">
          <span class="boxname">${t('common.all')}</span>
          <span class="boxcount">${materials.length}</span>
        </button>
        ${tabs.join('')}
      </div>
      ${panel(table, 'flush')}`,
  });
}

// ---------------------------------------------------------------- form view

async function categoryBlock(r) {
  const plants = await all('plants');
  const plantOptions = plants.length
    ? `<option value="">—</option>` + plants.map(p =>
        `<option value="${p.id}"${p.id === r.plantId ? ' selected' : ''}>${esc(text(p.nameCommon))}</option>`).join('')
    : `<option value="">${esc(t('materials.plantEmpty'))}</option>`;

  if (r.category === 'dyestuff') {
    return panel(`
      <h2>${t('materials.dyestuff')}</h2>
      ${field(t('materials.plant'), `<select data-f="plantId">${plantOptions}</select>`)}
      ${field(t('materials.form'), `<select data-f="form">
          <option value="extract"${r.form === 'extract' ? ' selected' : ''}>${t('materials.form.extract')}</option>
          <option value="dried"${r.form === 'dried' ? ' selected' : ''}>${t('materials.form.dried')}</option>
          <option value="fresh"${r.form === 'fresh' ? ' selected' : ''}>${t('materials.form.fresh')}</option>
        </select>`)}
      ${field(t('materials.part'), `<select data-f="partCode">${await options('plant_part', r.partCode)}</select>`)}
      ${field(t('materials.dyeClass'), `<select data-f="dyeClass">${await options('dye_class', r.dyeClass)}</select>`)}
      ${field(t('materials.harvestDate'), `<input type="date" data-f="harvestDate" value="${esc(r.harvestDate || '')}">`)}
      ${field(t('materials.manufacturer'), `<input type="text" data-f="manufacturer" value="${esc(r.manufacturer || '')}">`)}
    `);
  }

  if (r.category === 'tannin') {
    return panel(`
      <h2>${t('materials.tannin')}</h2>
      ${field(t('materials.tanninType'), `<select data-f="tanninTypeCode">${await options('tannin_type', r.tanninTypeCode)}</select>`)}
      ${field(t('materials.plant'), `<select data-f="plantId">${plantOptions}</select>`)}
      ${field(t('materials.colourCast'), `<input type="text" data-f="colourCast" value="${esc(r.colourCast || '')}">`)}
    `);
  }

  if (r.category === 'mordant') {
    const fibreClasses = ['cellulose', 'protein'];
    const boxes = (await Promise.all(fibreClasses.map(async c => `
      <label class="check"><input type="checkbox" data-multi="suitableFibreClasses" value="${c}"
        ${(r.suitableFibreClasses || []).includes(c) ? 'checked' : ''}>
        ${esc(await label('fibre_class', c))}</label>`))).join('');

    const handling = ['gloves', 'mask', 'ventilation'].map(h => `
      <label class="check"><input type="checkbox" data-multi="handling" value="${h}"
        ${(r.handling || []).includes(h) ? 'checked' : ''}>
        ${t('materials.handling.' + h)}</label>`).join('');

    return panel(`
      <h2>${t('materials.mordant')}</h2>
      ${field(t('materials.mordantType'), `<select data-f="mordantTypeCode">${await options('mordant_type', r.mordantTypeCode)}</select>`)}
      ${field(t('materials.standardWof'), `<input type="number" step="0.1" min="0" data-f="standardPercentWof" value="${r.standardPercentWof ?? ''}">`)}
      ${field(t('materials.suitableFor'), `<div class="checks">${boxes}</div>`)}
      ${field(t('materials.colourEffect'), `<select data-f="colourEffect">${await options('colour_effect', r.colourEffect)}</select>`)}
      ${field(t('materials.maxTemp'), `<input type="number" step="1" min="0" data-f="maxTempC" value="${r.maxTempC ?? ''}">`, t('materials.maxTempHint'))}
      ${field(t('materials.handling'), `<div class="checks">${handling}</div>`)}
      ${pairField(t('materials.disposal'), 'disposalNote', r.disposalNote, { multiline: true })}
      ${pairField(t('materials.safety'), 'safetyNote', r.safetyNote, { multiline: true })}
    `);
  }

  if (r.category === 'modifier') {
    return panel(`
      <h2>${t('materials.modifier')}</h2>
      ${field(t('materials.phDirection'), `<select data-f="phDirection">
          <option value="">—</option>
          <option value="acid"${r.phDirection === 'acid' ? ' selected' : ''}>${t('materials.ph.acid')}</option>
          <option value="alkaline"${r.phDirection === 'alkaline' ? ' selected' : ''}>${t('materials.ph.alkaline')}</option>
        </select>`)}
      ${pairField(t('materials.typicalUse'), 'typicalUse', r.typicalUse, { multiline: true })}
      ${pairField(t('materials.effect'), 'effectNotes', r.effectNotes, { multiline: true })}
    `);
  }

  return '';
}

async function renderForm(root, r) {
  const isNew = openId === 'new';

  root.innerHTML = page({
    title: isNew ? t('materials.new') : (text(r.name) || t('materials.one')),
    sub: isNew ? t('materials.emptyHint') : '',
    actions: `<button class="btn quiet" data-back>${t('common.back')}</button>
              <button class="btn primary" data-save>${t('common.save')}</button>`,
    body: `
      <div class="cols">
        <div class="col">
          ${panel(`
            <h2>${t('materials.basics')}</h2>
            ${field(t('materials.category'), `<select data-f="category">${await options('material_category', r.category, '')}</select>`)}
            ${pairField(t('materials.name'), 'name', r.name)}
            ${field(t('materials.supplier'), `<input type="text" data-f="supplier" value="${esc(r.supplier || '')}">`)}
            ${field(t('materials.acquired'), `<input type="date" data-f="acquiredDate" value="${esc(r.acquiredDate || '')}">`)}
            ${field(t('materials.stock'), `<input type="number" step="0.1" min="0" data-f="stock.value" value="${r.stock?.value ?? ''}">`)}
            ${field(t('materials.stockUnit'), `<input type="text" data-f="stock.unit" value="${esc(r.stock?.unit || '')}" placeholder="g, ml, l">`)}
          `)}

          ${await categoryBlock(r)}
        </div>

        <div class="col">
          ${panel(`
            <h2>${t('materials.chemistry')}</h2>
            <p class="note">${t('materials.chemistryHint')}</p>
            ${field(t('materials.formula'), `<input type="text" class="mono" data-f="formula" value="${esc(r.formula || '')}" placeholder="KAl(SO₄)₂">`)}
            ${field(t('materials.hydration'), `<input type="text" data-f="hydrationState" value="${esc(r.hydrationState || '')}">`, t('materials.hydrationHint'))}
            ${field(t('materials.molarMass'), `<input type="number" step="0.01" min="0" data-f="molarMass" value="${r.molarMass ?? ''}">`)}
            ${field(t('materials.concentration'), `<input type="number" step="0.1" min="0" max="100" data-f="concentrationPercent" value="${r.concentrationPercent ?? ''}">`, t('materials.concentrationHint'))}
          `)}

          ${panel(`
            <h2>${t('common.notes')}</h2>
            ${pairField('', 'notes', r.notes, { multiline: true })}
            ${field(t('materials.source'), `<input type="text" data-f="sourceRefText" value="${esc(r.sourceRef?.text || '')}">`, t('materials.sourceHint'))}
            <label class="check"><input type="checkbox" data-f-bool="distributable" ${r.distributable ? 'checked' : ''}>
              ${t('materials.distributable')}</label>
            <p class="hint">${t('materials.distributableHint')}</p>
            ${!isNew ? `<button class="btn danger quiet" data-delete>${t('materials.delete')}</button>` : ''}
          `)}
        </div>
      </div>`,
  });
}

// ------------------------------------------------------------------ wiring

function readForm(root) {
  for (const el of root.querySelectorAll('[data-f]')) {
    const path = el.dataset.f.split('.');
    let target = draft;
    for (let i = 0; i < path.length - 1; i++) {
      target[path[i]] = target[path[i]] || {};
      target = target[path[i]];
    }
    const key = path[path.length - 1];
    let value = el.value;
    if (el.type === 'number') value = value === '' ? null : Number(value);
    target[key] = value;
  }
  for (const el of root.querySelectorAll('[data-f-bool]')) {
    draft[el.dataset.fBool] = el.checked;
  }
  const multi = {};
  for (const el of root.querySelectorAll('[data-multi]')) {
    const name = el.dataset.multi;
    multi[name] = multi[name] || [];
    if (el.checked) multi[name].push(el.value);
  }
  Object.assign(draft, multi);

  readPairs(root, draft);

  if (draft.sourceRefText !== undefined) {
    draft.sourceRef = draft.sourceRefText
      ? { text: draft.sourceRefText, author: null, url: null } : null;
    delete draft.sourceRefText;
  }
}

export default {
  id: 'materials',
  title: () => t('materials.title'),
  sub: () => t('materials.sub'),

  async render(root) {
    if (openId) {
      if (!draft || (openId !== 'new' && draft.id !== openId)) {
        draft = openId === 'new' ? blank() : structuredClone(await get('materials', openId));
      }
      await renderForm(root, draft);
    } else {
      draft = null;
      await renderList(root);
    }

    root.onclick = async (e) => {
      const cat = e.target.closest('[data-cat]');
      if (cat) { filterCat = cat.dataset.cat || null; return this.render(root); }

      if (e.target.closest('[data-new]')) { draft = null; openId = 'new'; return this.render(root); }

      const row = e.target.closest('[data-open]');
      if (row) { draft = null; openId = row.dataset.open; return this.render(root); }

      if (e.target.closest('[data-back]')) { openId = null; draft = null; return this.render(root); }

      if (e.target.closest('[data-save]')) {
        readForm(root);
        await put('materials', draft);
        openId = null; draft = null;
        return this.render(root);
      }

      if (e.target.closest('[data-delete]')) {
        if (!confirm(t('materials.confirmDelete'))) return;
        await remove('materials', draft.id);
        openId = null; draft = null;
        return this.render(root);
      }
    };

    root.onchange = async (e) => {
      // switching category swaps the whole category-specific block
      if (e.target.matches('[data-f="category"]')) {
        readForm(root);
        return renderForm(root, draft);
      }
    };
  },
};

// modules/substances.js — what a substance IS (§13.4).
//
// Reference knowledge: true whether or not a jar is on the shelf, identical
// for every practitioner, shipped in seed packs. No supplier, no quantity,
// no purchase date — those belong to Stock.

import { all, get, put, remove, newRecord, byIndex } from '../db.js';
import { t, text } from '../i18n.js';
import { page, panel, field, options, label, esc, empty, pairField, readPairs } from '../ui.js';

const CATEGORIES = ['mordant', 'tannin', 'dyestuff', 'modifier', 'auxiliary'];

let filterCat = null;
let openId = null;
let draft = null;

function blank() {
  return newRecord({
    category: 'mordant',
    name: { bg: '', en: '' },
    formula: '',
    hydrationState: '',
    molarMass: null,
    alPerUnit: null,
    naPerUnit: null,
    needsAcid: false,
    maxPercentWof: null,
    notes: { bg: '', en: '' },

    plantId: '', defaultPartCode: '', dyeClass: '',
    tanninTypeCode: '', colourCast: '',
    mordantTypeCode: '', standardPercentWof: null, suitableFibreClasses: [],
    colourEffect: '', maxTempC: null, handling: [],
    disposalNote: { bg: '', en: '' }, safetyNote: { bg: '', en: '' },
    phDirection: '', typicalUse: { bg: '', en: '' }, effectNotes: { bg: '', en: '' },
  });
}

async function detailOf(x) {
  switch (x.category) {
    case 'mordant':  return await label('mordant_type', x.mordantTypeCode);
    case 'tannin':   return await label('tannin_type', x.tanninTypeCode);
    case 'dyestuff': return await label('dye_class', x.dyeClass);
    case 'modifier': return x.phDirection ? t('materials.ph.' + x.phDirection) : '';
    default:         return '';
  }
}

async function renderList(root) {
  const list = await all('substances');
  const stock = await all('stock');

  const counts = {};
  for (const x of list) counts[x.category] = (counts[x.category] || 0) + 1;

  const tabs = await Promise.all(CATEGORIES.map(async c => `
    <button class="box${filterCat === c ? ' active' : ''}" data-cat="${c}">
      <span class="boxname">${esc(await label('material_category', c))}</span>
      <span class="boxcount">${counts[c] || 0}</span>
    </button>`));

  const shown = (filterCat ? list.filter(x => x.category === filterCat) : list)
    .sort((a, b) => text(a.name).localeCompare(text(b.name)));

  const rows = await Promise.all(shown.map(async x => {
    const n = stock.filter(s => s.substanceId === x.id).length;
    return `<tr data-open="${x.id}">
      <td>${esc(text(x.name) || '—')}</td>
      <td>${esc(await label('material_category', x.category))}</td>
      <td>${esc(await detailOf(x))}</td>
      <td class="mono">${esc(x.formula || '')}</td>
      <td class="num">${x.standardPercentWof != null ? x.standardPercentWof + '%' : '—'}</td>
      <td class="num">${n || '—'}</td>
    </tr>`;
  }));

  const table = shown.length ? `
    <table class="grid">
      <thead><tr>
        <th>${t('materials.col.name')}</th>
        <th>${t('materials.col.category')}</th>
        <th>${t('materials.col.detail')}</th>
        <th>${t('materials.formula')}</th>
        <th class="num">% WOF</th>
        <th class="num">${t('substances.inStock')}</th>
      </tr></thead>
      <tbody>${rows.join('')}</tbody>
    </table>`
    : empty(filterCat ? t('substances.emptyCat') : t('substances.empty'), t('substances.emptyHint'));

  root.innerHTML = page({
    title: t('substances.title'),
    sub: t('substances.sub'),
    actions: `<button class="btn primary" data-new>${t('substances.new')}</button>`,
    body: `
      <div class="boxes">
        <button class="box${filterCat === null ? ' active' : ''}" data-cat="">
          <span class="boxname">${t('common.all')}</span>
          <span class="boxcount">${list.length}</span>
        </button>
        ${tabs.join('')}
      </div>
      ${panel(table, 'flush')}`,
  });
}

async function propertiesBlock(r) {
  const plants = await all('plants');
  const plantOptions = plants.length
    ? `<option value="">—</option>` + plants.map(p =>
        `<option value="${p.id}"${p.id === r.plantId ? ' selected' : ''}>${esc(text(p.nameCommon))}</option>`).join('')
    : `<option value="">${esc(t('materials.plantEmpty'))}</option>`;

  if (r.category === 'mordant') {
    const fibres = (await Promise.all(['cellulose', 'protein'].map(async c => `
      <label class="check"><input type="checkbox" data-multi="suitableFibreClasses" value="${c}"
        ${(r.suitableFibreClasses || []).includes(c) ? 'checked' : ''}>
        ${esc(await label('fibre_class', c))}</label>`))).join('');

    return `
      ${field(t('materials.mordantType'), `<select data-f="mordantTypeCode">${await options('mordant_type', r.mordantTypeCode)}</select>`)}
      ${field(t('materials.standardWof'), `<input type="number" step="0.1" min="0" data-f="standardPercentWof" value="${r.standardPercentWof ?? ''}">`)}
      ${field(t('substances.maxWof'), `<input type="number" step="0.1" min="0" data-f="maxPercentWof" value="${r.maxPercentWof ?? ''}">`, t('substances.maxWofHint'))}
      ${field(t('materials.suitableFor'), `<div class="checks">${fibres}</div>`)}
      ${field(t('materials.colourEffect'), `<select data-f="colourEffect">${await options('colour_effect', r.colourEffect)}</select>`)}`;
  }

  if (r.category === 'tannin') {
    return `
      ${field(t('materials.tanninType'), `<select data-f="tanninTypeCode">${await options('tannin_type', r.tanninTypeCode)}</select>`)}
      ${field(t('materials.plant'), `<select data-f="plantId">${plantOptions}</select>`)}
      ${field(t('materials.colourCast'), `<input type="text" data-f="colourCast" value="${esc(r.colourCast || '')}">`)}`;
  }

  if (r.category === 'dyestuff') {
    return `
      ${field(t('materials.plant'), `<select data-f="plantId">${plantOptions}</select>`)}
      ${field(t('materials.part'), `<select data-f="defaultPartCode">${await options('plant_part', r.defaultPartCode)}</select>`)}
      ${field(t('materials.dyeClass'), `<select data-f="dyeClass">${await options('dye_class', r.dyeClass)}</select>`)}`;
  }

  if (r.category === 'modifier') {
    return `
      ${field(t('materials.phDirection'), `<select data-f="phDirection">
          <option value="">—</option>
          <option value="acid"${r.phDirection === 'acid' ? ' selected' : ''}>${t('materials.ph.acid')}</option>
          <option value="alkaline"${r.phDirection === 'alkaline' ? ' selected' : ''}>${t('materials.ph.alkaline')}</option>
        </select>`)}
      ${pairField(t('materials.typicalUse'), 'typicalUse', r.typicalUse, { multiline: true })}
      ${pairField(t('materials.effect'), 'effectNotes', r.effectNotes, { multiline: true })}`;
  }

  // Auxiliaries have no category-specific properties. An empty panel is a
  // sign the code drew something before checking there was anything to draw.
  return '';
}

// Formula, hydration and molar mass only mean something for a defined
// compound. A tannin extract or a dried root is a mixture, not a molecule.
const HAS_CHEMISTRY = ['mordant', 'modifier', 'auxiliary'];

async function renderForm(root, r) {
  const isNew = openId === 'new';
  const stock = isNew ? [] : await byIndex('stock', 'substanceId', r.id);
  const props = await propertiesBlock(r);

  const handling = ['gloves', 'mask', 'ventilation'].map(h => `
    <label class="check"><input type="checkbox" data-multi="handling" value="${h}"
      ${(r.handling || []).includes(h) ? 'checked' : ''}>
      ${t('materials.handling.' + h)}</label>`).join('');

  const stockRows = stock.length
    ? stock.map(sx => `<li>${esc(sx.supplier || '—')}
        <span class="hint">${sx.remaining?.value ?? sx.quantity?.value ?? '—'} ${esc(sx.quantity?.unit || '')}</span></li>`).join('')
    : `<li class="hint">${t('substances.noStock')}</li>`;

  root.innerHTML = page({
    title: isNew ? t('substances.new') : (text(r.name) || t('substances.one')),
    sub: isNew ? t('substances.emptyHint') : '',
    actions: `<button class="btn quiet" data-back>${t('common.back')}</button>
              <button class="btn primary" data-save>${t('common.save')}</button>`,
    body: `
      <div class="cols">
        <div class="col">
          ${panel(`
            <h2>${t('substances.identity')}</h2>
            ${field(t('materials.category'), `<select data-f="category">${await options('material_category', r.category, '')}</select>`)}
            ${field(t('materials.name'), `<input type="text" data-f="nameText" value="${esc(text(r.name))}">`,
              t('substances.nameHint'))}
          `)}

          ${props ? panel(`
            <h2>${t('substances.properties')}</h2>
            ${props}
          `) : ''}

          ${HAS_CHEMISTRY.includes(r.category) ? panel(`
            <h2>${t('substances.chemistry')}</h2>
            <p class="note">${t('substances.chemistryHint')}</p>
            ${field(t('materials.formula'), `<input type="text" class="mono" data-f="formula" value="${esc(r.formula || '')}" placeholder="Al₂(SO₄)₃">`)}
            ${field(t('materials.hydration'), `<input type="text" data-f="hydrationState" value="${esc(r.hydrationState || '')}">`, t('materials.hydrationHint'))}
            ${field(t('materials.molarMass'), `<input type="number" step="0.01" min="0" data-f="molarMass" value="${r.molarMass ?? ''}">`)}
            ${field(t('substances.alPerUnit'), `<input type="number" step="1" min="0" data-f="alPerUnit" value="${r.alPerUnit ?? ''}">`, t('substances.alPerUnitHint'))}
            ${field(t('substances.naPerUnit'), `<input type="number" step="1" min="0" data-f="naPerUnit" value="${r.naPerUnit ?? ''}">`, t('substances.naPerUnitHint'))}
            <label class="check"><input type="checkbox" data-f-bool="needsAcid" ${r.needsAcid ? 'checked' : ''}>
              ${t('substances.needsAcid')}</label>
          `) : ''}
        </div>

        <div class="col">
          ${panel(`
            <h2>${t('substances.safety')}</h2>
            ${field(t('materials.maxTemp'), `<input type="number" step="1" min="0" data-f="maxTempC" value="${r.maxTempC ?? ''}">`, t('materials.maxTempHint'))}
            ${field(t('materials.handling'), `<div class="checks">${handling}</div>`)}
            ${pairField(t('materials.safety'), 'safetyNote', r.safetyNote, { multiline: true })}
            ${pairField(t('materials.disposal'), 'disposalNote', r.disposalNote, { multiline: true })}
          `)}

          ${panel(`
            <h2>${t('common.notes')}</h2>
            ${pairField('', 'notes', r.notes, { multiline: true })}
          `)}

          ${!isNew ? panel(`
            <h2>${t('substances.inStock')}</h2>
            <ul class="history">${stockRows}</ul>
            <button class="btn danger quiet" data-delete>${t('substances.delete')}</button>
          `) : ''}
        </div>
      </div>`,
  });
}

function readForm(root) {
  for (const el of root.querySelectorAll('[data-f-bool]')) draft[el.dataset.fBool] = el.checked;
  for (const el of root.querySelectorAll('[data-f]')) {
    const key = el.dataset.f;
    let value = el.value;
    if (el.type === 'number') value = value === '' ? null : Number(value);
    draft[key] = value;
  }
  const multi = { suitableFibreClasses: [], handling: [] };
  for (const el of root.querySelectorAll('[data-multi]')) {
    if (el.checked) multi[el.dataset.multi].push(el.value);
  }
  Object.assign(draft, multi);
  readPairs(root, draft);

  // A chemical name is effectively the same in both languages, so it is a
  // plain field rather than a pair — one less thing to fill in twice.
  if (draft.nameText !== undefined) {
    draft.name = { bg: draft.nameText, en: draft.nameText };
    delete draft.nameText;
  }
}

export default {
  id: 'substances',
  title: () => t('substances.title'),
  sub: () => t('substances.sub'),

  async render(root) {
    if (openId) {
      if (!draft || (openId !== 'new' && draft.id !== openId)) {
        draft = openId === 'new' ? blank() : structuredClone(await get('substances', openId));
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
        await put('substances', draft);
        openId = null; draft = null;
        return this.render(root);
      }
      if (e.target.closest('[data-delete]')) {
        if (!confirm(t('substances.confirmDelete'))) return;
        await remove('substances', draft.id);
        openId = null; draft = null;
        return this.render(root);
      }
    };

    root.onchange = async (e) => {
      if (e.target.matches('[data-f="category"]')) {
        readForm(root);
        return renderForm(root, draft);
      }
    };
  },
};

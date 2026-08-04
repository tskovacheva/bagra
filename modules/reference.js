// modules/reference.js — the reference engine (§7).
//
// This is the module the whole app exists for. Everything else stores what
// happened; this answers what to expect. A record holds one expected outcome
// for a defined set of inputs, and the search matches on ANY SUBSET of them —
// because in practice one rarely has all five fixed.

import { all, get, put, remove, newRecord } from '../db.js';
import { markEdited } from '../seed.js';
import * as seedUI from '../seed-ui.js';
import { t, text } from '../i18n.js';
import { page, panel, field, options, label, esc, empty, note, pairField, readPairs } from '../ui.js';

let mode = 'search';
let openId = null;
let draft = null;

// Empty means "not specified", which widens rather than narrows.
let query = { plantId: '', partCode: '', fibreClass: '', mordantCode: '', processCode: '', phCode: '' };

const host = {
  tabs: () => `
    <div class="tabswitch">
      <button class="tab${mode === 'search' ? ' active' : ''}" data-refmode="search">${t('ref.searchTab')}</button>
      <button class="tab${mode === 'records' ? ' active' : ''}" data-refmode="records">${t('ref.recordsTab')}</button>
    </div>`,
};

function blank() {
  return newRecord({
    key: {
      dyeSource: { plantId: '', partCode: '' },
      fibreClass: 'cellulose', fibreCode: null,
      mordantCode: 'alum_potassium', mordantBand: 'medium',
      processCode: 'immersion', blanket: null, medium: null,
    },
    expected: {
      colourText: { bg: '', en: '' }, swatchHex: '#8C7B6B',
      variation: { bg: '', en: '' }, printQuality: null,
      lightfastness: '', washfastness: '',
    },
    influences: [],
    confidence: 'practice',
    learnedFrom: '',
    notes: { bg: '', en: '' },
  });
}

// ------------------------------------------------------------------ matching

/**
 * How well a record answers a query.
 *
 * Only the criteria the user actually filled in are compared, so an unanswered
 * field never counts against a record. A record that agrees on everything asked
 * is exact; one that agrees on most is worth showing with its differences named,
 * because "the same but with iron" is often exactly what one needs to see.
 */
function score(record, q) {
  const k = record.key || {};
  const pairs = [
    ['plantId',     k.dyeSource?.plantId,  q.plantId,     t('ref.plant')],
    ['partCode',    k.dyeSource?.partCode, q.partCode,    t('ref.part')],
    ['fibreClass',  k.fibreClass,          q.fibreClass,  t('ref.fibre')],
    ['mordantCode', k.mordantCode,         q.mordantCode, t('ref.mordant')],
    ['processCode', k.processCode,         q.processCode, t('ref.process')],
    ['phCode',      k.medium?.phCode || 'neutral', q.phCode, t('ref.ph')],
  ];

  let asked = 0, hit = 0;
  const differs = [];
  for (const [, actual, wanted, labelText] of pairs) {
    if (!wanted) continue;
    asked++;
    if (actual === wanted) hit++;
    else differs.push(labelText);
  }
  return { asked, hit, differs, exact: asked > 0 && hit === asked };
}

async function conditionLine(record) {
  const k = record.key || {};
  const bits = [];
  if (k.mordantCode && k.mordantCode !== 'none') {
    const band = k.mordantBand ? ` (${await label('concentration', k.mordantBand)})` : '';
    bits.push((await label('mordant_type', k.mordantCode)) + band);
  } else bits.push(t('ref.none'));
  bits.push(await label('fibre_class', k.fibreClass));
  bits.push(await label('process', k.processCode));
  if (k.medium?.phCode) bits.push(await label('ph', k.medium.phCode));
  return bits.filter(Boolean).join(' · ');
}

async function sourceLine(record, plantsById) {
  const k = record.key || {};
  const plant = plantsById.get(k.dyeSource?.plantId);
  const name = plant ? text(plant.nameCommon) : '—';
  const part = k.dyeSource?.partCode ? await label('plant_part', k.dyeSource.partCode) : '';
  return part ? `${name}, ${part}` : name;
}

async function resultCard(record, plantsById, match) {
  const e = record.expected || {};
  const badge = !match ? ''
    : match.exact
      ? `<span class="chip exact">${t('ref.exact')}</span>`
      : `<span class="chip">${t('ref.partial', { n: match.hit, total: match.asked })}</span>`;

  return `
    <div class="refcard" data-open="${record.id}">
      <div class="refswatch" style="background:${esc(e.swatchHex || '#8C7B6B')}"></div>
      <div class="refbody">
        <div class="refhead">
          <b>${esc(text(e.colourText) || '—')}</b>
          ${badge}
        </div>
        <div class="hint">${esc(await sourceLine(record, plantsById))} — ${esc(await conditionLine(record))}</div>
        ${text(e.variation) ? `<div class="hint">${esc(text(e.variation))}</div>` : ''}
        ${match && !match.exact && match.differs.length
          ? `<div class="hint differs">${t('ref.differsIn', { what: esc(match.differs.join(', ')) })}</div>` : ''}
      </div>
    </div>`;
}

// -------------------------------------------------------------- search view

async function renderSearch(root) {
  const plants = (await all('plants')).sort((a, b) => text(a.nameCommon).localeCompare(text(b.nameCommon)));
  const plantsById = new Map(plants.map(p => [p.id, p]));
  const records = await all('combinations');

  const scored = records
    .map(r => ({ r, m: score(r, query) }))
    .filter(x => x.m.asked === 0 || x.m.hit > 0)
    .sort((a, b) => (b.m.hit - a.m.hit) || (a.m.differs.length - b.m.differs.length));

  const cards = await Promise.all(scored.slice(0, 60).map(x => resultCard(x.r, plantsById, x.m.asked ? x.m : null)));

  const plantOptions = `<option value="">${t('ref.any')}</option>` + plants.map(p =>
    `<option value="${p.id}"${p.id === query.plantId ? ' selected' : ''}>${esc(text(p.nameCommon))}</option>`).join('');

  root.innerHTML = page({
    title: t('reference.title'),
    sub: t('reference.sub'),
    actions: host.tabs(),
    body: `
      <div class="cols">
        <div class="col">
          ${panel(`
            <h2>${t('ref.ask')}</h2>
            <p class="note">${t('ref.askHint')}</p>
            ${field(t('ref.plant'), `<select data-q="plantId">${plantOptions}</select>`)}
            ${field(t('ref.part'), `<select data-q="partCode">${await options('plant_part', query.partCode, t('ref.any'))}</select>`)}
            ${field(t('ref.fibre'), `<select data-q="fibreClass">${await options('fibre_class', query.fibreClass, t('ref.any'))}</select>`)}
            ${field(t('ref.mordant'), `<select data-q="mordantCode">
              <option value="">${t('ref.any')}</option>
              <option value="none"${query.mordantCode === 'none' ? ' selected' : ''}>${t('ref.none')}</option>
              ${(await options('mordant_type', query.mordantCode, '')).replace(/^<option value="">.*?<\/option>/, '')}
            </select>`)}
            ${field(t('ref.process'), `<select data-q="processCode">${await options('process', query.processCode, t('ref.any'))}</select>`)}
            ${field(t('ref.ph'), `<select data-q="phCode">${await options('ph', query.phCode, t('ref.any'))}</select>`)}
            <button class="btn quiet" data-clear>${t('ref.clear')}</button>
          `)}
        </div>

        <div class="col">
          ${panel(`
            <h2>${t('ref.results', { n: scored.length })}</h2>
            ${cards.length ? cards.join('') : empty(t('ref.noResults'), t('ref.noResultsHint'))}
          `)}
        </div>
      </div>`,
  });
}

// ------------------------------------------------------------- records view

async function renderList(root) {
  const plants = await all('plants');
  const plantsById = new Map(plants.map(p => [p.id, p]));
  const records = await all('combinations');

  const rows = await Promise.all(records.map(async r => `
    <tr data-open="${r.id}">
      <td class="withthumb"><span class="thumb" style="background:${esc(r.expected?.swatchHex || '#8C7B6B')}"></span>
        ${esc(text(r.expected?.colourText) || '—')}</td>
      <td>${esc(await sourceLine(r, plantsById))}</td>
      <td>${esc(await conditionLine(r))}</td>
      <td>${esc(await label('claim_confidence', r.confidence) || '')}</td>
    </tr>`));

  const table = records.length ? `
    <table class="grid">
      <thead><tr>
        <th>${t('ref.col.colour')}</th>
        <th>${t('ref.col.source')}</th>
        <th>${t('ref.col.conditions')}</th>
        <th>${t('ref.confidence')}</th>
      </tr></thead>
      <tbody>${rows.join('')}</tbody>
    </table>` : empty(t('ref.empty'), t('ref.emptyHint'));

  root.innerHTML = page({
    title: t('reference.title'),
    sub: t('reference.sub'),
    actions: `${host.tabs()}
      <button class="btn quiet" data-sync>${t('seed.sync')}</button>
      <button class="btn primary" data-new>${t('ref.new')}</button>`,
    body: panel(table, 'flush'),
  });
}

// ---------------------------------------------------------------- form view

async function renderForm(root, r) {
  const isNew = openId === 'new';
  const plants = (await all('plants')).sort((a, b) => text(a.nameCommon).localeCompare(text(b.nameCommon)));
  const k = r.key || {};

  const plantOptions = `<option value="">—</option>` + plants.map(p =>
    `<option value="${p.id}"${p.id === k.dyeSource?.plantId ? ' selected' : ''}>${esc(text(p.nameCommon))}</option>`).join('');

  root.innerHTML = page({
    title: isNew ? t('ref.new') : (text(r.expected?.colourText) || t('ref.one')),
    sub: isNew ? t('ref.emptyHint') : '',
    actions: `<button class="btn quiet" data-back>${t('common.back')}</button>
              <button class="btn primary" data-save>${t('common.save')}</button>`,
    body: `
      <div class="cols">
        <div class="col">
          ${panel(`
            <h2>${t('ref.inputs')}</h2>
            ${field(t('ref.plant'), `<select data-k="dyeSource.plantId">${plantOptions}</select>`)}
            ${field(t('ref.part'), `<select data-k="dyeSource.partCode">${await options('plant_part', k.dyeSource?.partCode)}</select>`)}
            ${field(t('ref.fibre'), `<select data-k="fibreClass">${await options('fibre_class', k.fibreClass, '')}</select>`)}
            ${field(t('ref.mordant'), `<select data-k="mordantCode">
              <option value="none"${k.mordantCode === 'none' ? ' selected' : ''}>${t('ref.none')}</option>
              ${(await options('mordant_type', k.mordantCode, '')).replace(/^<option value="">.*?<\/option>/, '')}
            </select>`)}
            ${field(t('ref.mordantBand'), `<select data-k="mordantBand">${await options('concentration', k.mordantBand, '')}</select>`)}
            ${field(t('ref.process'), `<select data-k="processCode">${await options('process', k.processCode, '')}</select>`)}
            ${field(t('ref.ph'), `<select data-k="medium.phCode">${await options('ph', k.medium?.phCode, t('ref.any'))}</select>`)}
          `)}
        </div>

        <div class="col">
          ${panel(`
            <h2>${t('ref.expected')}</h2>
            ${field(t('ref.swatch'), `<input type="color" data-e="swatchHex" value="${esc(r.expected?.swatchHex || '#8C7B6B')}">`)}
            ${pairField(t('ref.colour'), 'colourText', r.expected?.colourText)}
            ${pairField(t('ref.variation'), 'variation', r.expected?.variation, { multiline: true })}
            ${field(t('ref.printQuality'), `<select data-e="printQuality">${await options('print_quality', r.expected?.printQuality)}</select>`)}
            ${field(t('ref.confidence'), `<select data-f="confidence">${await options('claim_confidence', r.confidence, '')}</select>`)}
            ${field(t('recipes.learnedFrom'), `<input type="text" data-f="learnedFrom" value="${esc(r.learnedFrom || '')}">`)}
          `)}

          ${panel(`
            <h2>${t('common.notes')}</h2>
            ${pairField('', 'notes', r.notes, { multiline: true })}
            ${!isNew ? `<button class="btn danger quiet" data-delete>${t('ref.delete')}</button>` : ''}
          `)}
        </div>
      </div>`,
  });
}

function readForm(root) {
  draft.key = draft.key || {};
  draft.expected = draft.expected || {};

  for (const el of root.querySelectorAll('[data-k]')) {
    const path = el.dataset.k.split('.');
    let target = draft.key;
    for (let i = 0; i < path.length - 1; i++) {
      target[path[i]] = target[path[i]] || {};
      target = target[path[i]];
    }
    target[path[path.length - 1]] = el.value;
  }
  // An unspecified medium is absent rather than neutral, so it does not
  // pretend to be a claim about the bath.
  if (!draft.key.medium?.phCode) draft.key.medium = null;
  else draft.key.medium.whereCode = draft.key.medium.whereCode || 'dye_bath';

  for (const el of root.querySelectorAll('[data-e]')) draft.expected[el.dataset.e] = el.value || null;
  for (const el of root.querySelectorAll('[data-f]')) draft[el.dataset.f] = el.value;

  const pairs = {};
  readPairs(root, pairs);
  if (pairs.colourText) draft.expected.colourText = pairs.colourText;
  if (pairs.variation) draft.expected.variation = pairs.variation;
  if (pairs.notes) draft.notes = pairs.notes;
}

export default {
  id: 'reference',
  title: () => t('reference.title'),
  sub: () => t('reference.sub'),

  reset() {
    seedUI.close();
    openId = null;
    draft = null;
    mode = 'search';
  },

  async render(root) {
    if (seedUI.isOpen()) return seedUI.render(root, () => this.render(root));

    if (!root.__refTabs) {
      root.__refTabs = (e) => {
        const tab = e.target.closest('[data-refmode]');
        if (!tab) return;
        e.stopPropagation();
        mode = tab.dataset.refmode;
        openId = null; draft = null;
        this.render(root);
      };
      root.addEventListener('click', root.__refTabs, true);
    }

    if (openId) {
      if (!draft || (openId !== 'new' && draft.id !== openId)) {
        draft = openId === 'new' ? blank() : structuredClone(await get('combinations', openId));
      }
      await renderForm(root, draft);
    } else if (mode === 'records') {
      draft = null;
      await renderList(root);
    } else {
      draft = null;
      await renderSearch(root);
    }

    root.onclick = async (e) => {
      if (e.target.closest('[data-clear]')) {
        query = { plantId: '', partCode: '', fibreClass: '', mordantCode: '', processCode: '', phCode: '' };
        return this.render(root);
      }
      if (e.target.closest('[data-sync]')) {
        try {
          await seedUI.open('combinations');
          return seedUI.render(root, () => this.render(root));
        } catch (err) { alert(err.message); }
        return;
      }
      if (e.target.closest('[data-new]')) { draft = null; openId = 'new'; return this.render(root); }

      const card = e.target.closest('[data-open]');
      if (card) { draft = null; openId = card.dataset.open; return this.render(root); }

      if (e.target.closest('[data-back]')) { openId = null; draft = null; return this.render(root); }

      if (e.target.closest('[data-save]')) {
        readForm(root);
        await put('combinations', markEdited(draft));
        openId = null; draft = null;
        return this.render(root);
      }
      if (e.target.closest('[data-delete]')) {
        if (!confirm(t('ref.confirmDelete'))) return;
        await remove('combinations', draft.id);
        openId = null; draft = null;
        return this.render(root);
      }
    };

    root.onchange = async (e) => {
      if (e.target.dataset.q) {
        query[e.target.dataset.q] = e.target.value;
        return this.render(root);
      }
    };
  },
};

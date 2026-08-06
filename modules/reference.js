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
import { page, panel, field, options, label, esc, empty, note, pairField, readPairs,
         fact, facts, prose, readBlock, fmtDate } from '../ui.js';

let mode = 'search';
let openId = null;
let draft = null;
let editing = false;

// Empty means "not specified", which widens rather than narrows.
let query = { plantId: '', partCode: '', fibreClass: '', processCode: '',
              mordantCode: '', mordantBand: '', phCode: '' };
let showMore = false;

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
 * Compare a record against the query.
 *
 * Only criteria the user actually filled in are compared: an empty field
 * widens the search rather than narrowing it. A record answers the question
 * when it agrees with EVERYTHING asked — that is what a filter with optional
 * fields means, and it is what the specification describes. An earlier version
 * scored one point per agreement and showed anything with a single hit, which
 * made a eucalyptus record surface under a search for oak merely because both
 * were on cotton. Useful sometimes, but not an answer.
 */
function compare(record, q) {
  const k = record.key || {};

  // An unrecorded medium is unknown, NOT neutral. Treating a blank as a
  // confirmed neutral bath manufactures knowledge the source never had.
  const recordedPh = k.medium?.phCode ?? null;

  const criteria = [
    ['plantId',     k.dyeSource?.plantId ?? null,  q.plantId,     t('ref.plant'),   3],
    ['partCode',    k.dyeSource?.partCode ?? null, q.partCode,    t('ref.part'),    3],
    ['processCode', k.processCode ?? null,         q.processCode, t('ref.process'), 2],
    ['fibreClass',  k.fibreClass ?? null,          q.fibreClass,  t('ref.fibre'),   2],
    ['mordantCode', k.mordantCode ?? null,         q.mordantCode, t('ref.mordant'), 1],
    ['mordantBand', k.mordantBand ?? null,         q.mordantBand, t('ref.band'),    1],
    ['phCode',      recordedPh,                    q.phCode,      t('ref.ph'),      1],
  ];

  const differs = [];
  let asked = 0;
  let plantMatches = false;

  for (const [name, actual, wanted, labelText, weight] of criteria) {
    if (!wanted) continue;
    asked++;
    if (actual === wanted) {
      if (name === 'plantId') plantMatches = true;
    } else {
      differs.push({ name, labelText, weight });
    }
  }

  return {
    asked,
    differs,
    exact: asked > 0 && differs.length === 0,
    // One difference is a neighbour worth seeing; two is a different question.
    near: differs.length === 1,
    plantMatches,
  };
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

let placementCounts = new Map();

async function resultCard(record, plantsById, match) {
  const e = record.expected || {};
  const k = record.key || {};
  const mine = placementCounts.get(record.id) || 0;
  const badge = (match && !match.exact && match.differs.length)
    ? `<span class="chip">${match.plantMatches ? t('ref.samePlant') : t('ref.sameConditions')}</span>`
    : '';

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
          ? `<div class="hint differs">${t('ref.differsIn', { what: esc(match.differs.map(x => x.labelText).join(', ')) })}</div>` : ''}
        ${!k.medium ? `<div class="hint">${t('ref.ph')}: ${t('ref.unspecified')}</div>` : ''}
        ${mine ? `<div class="hint matched">${t('ref.confirmedBy', { n: mine })}</div>` : ''}
      </div>
    </div>`;
}

// -------------------------------------------------------------- search view

async function renderSearch(root) {
  const plants = (await all('plants')).sort((a, b) => text(a.nameCommon).localeCompare(text(b.nameCommon)));
  const plantsById = new Map(plants.map(p => [p.id, p]));
  const records = await all('combinations');

  // Counted once here rather than per card: the answer is the same for every
  // card on the screen and the trials list is read only once.
  placementCounts = new Map();
  for (const tr of await all('trials')) {
    for (const pl of tr.placements || []) {
      if (pl.combinationId) placementCounts.set(pl.combinationId, (placementCounts.get(pl.combinationId) || 0) + 1);
    }
  }

  const asked = Object.values(query).some(Boolean);
  const results = records.map(r => ({ r, m: compare(r, query) }));

  const exact = results.filter(x => x.m.exact);
  const near = results
    .filter(x => x.m.near)
    // A neighbour that keeps the plant answers "what else can this give?";
    // one that keeps the conditions answers "what else behaves like this?".
    // The first is nearly always the more useful, so it leads.
    .sort((a, b) => (b.m.plantMatches - a.m.plantMatches) || (a.m.differs[0].weight - b.m.differs[0].weight));

  const exactCards = await Promise.all(exact.slice(0, 40).map(x => resultCard(x.r, plantsById, x.m)));
  const nearCards = await Promise.all(near.slice(0, 12).map(x => resultCard(x.r, plantsById, x.m)));

  // Which parts to offer depends on the plant: avocado has stones and skins,
  // not roots and bark, and offering the whole vocabulary invites dead queries.
  let partCodes = null;
  if (query.plantId) {
    const plant = plantsById.get(query.plantId);
    const fromPlant = (plant?.parts || []).map(x => x.partCode).filter(Boolean);
    const fromRecords = records
      .filter(r => r.key?.dyeSource?.plantId === query.plantId)
      .map(r => r.key.dyeSource.partCode).filter(Boolean);
    partCodes = [...new Set([...fromPlant, ...fromRecords])];
  }

  const partOptions = partCodes
    ? `<option value="">${t('ref.any')}</option>` + (await Promise.all(partCodes.map(async c =>
        `<option value="${c}"${c === query.partCode ? ' selected' : ''}>${esc(await label('plant_part', c))}</option>`))).join('')
    : await options('plant_part', query.partCode, t('ref.any'));

  const plantOptions = `<option value="">${t('ref.any')}</option>` + plants.map(p =>
    `<option value="${p.id}"${p.id === query.plantId ? ' selected' : ''}>${esc(text(p.nameCommon))}</option>`).join('');

  // Plants that actually have records, as a way in from a blank screen.
  const counts = {};
  for (const r of records) {
    const id = r.key?.dyeSource?.plantId;
    if (id) counts[id] = (counts[id] || 0) + 1;
  }
  const quick = Object.entries(counts)
    .sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([id, n]) => `<button class="box" data-quick="${id}">
      <span class="boxname">${esc(text(plantsById.get(id)?.nameCommon) || '—')}</span>
      <span class="boxcount">${n}</span></button>`).join('');

  const resultsPane = !asked
    ? `<p class="note">${t('ref.startHint')}</p><div class="boxes">${quick}</div>`
    : `
      <h2>${t('ref.exactSection')} — ${t('ref.count', { n: exact.length })}</h2>
      ${exactCards.length ? exactCards.join('') : note(t('ref.noExact'), 'warn')}
      ${nearCards.length ? `
        <h2 class="nearhead">${t('ref.nearSection')}</h2>
        <p class="hint">${t('ref.nearHint')}</p>
        ${nearCards.join('')}` : ''}`;

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
            ${field(t('ref.part'), `<select data-q="partCode"${partCodes && !partCodes.length ? ' disabled' : ''}>${partOptions}</select>`)}
            ${field(t('ref.fibre'), `<select data-q="fibreClass">${await options('fibre_class', query.fibreClass, t('ref.any'))}</select>`)}
            ${field(t('ref.process'), `<select data-q="processCode">${await options('process', query.processCode, t('ref.any'))}</select>`)}

            <details class="pairalt"${showMore ? ' open' : ''}>
              <summary data-more>${t('ref.moreConditions')}</summary>
              ${field(t('ref.mordant'), `<select data-q="mordantCode">
                <option value="">${t('ref.any')}</option>
                <option value="none"${query.mordantCode === 'none' ? ' selected' : ''}>${t('ref.none')}</option>
                ${(await options('mordant_type', query.mordantCode, '')).replace(/^<option value="">.*?<\/option>/, '')}
              </select>`)}
              ${field(t('ref.band'), `<select data-q="mordantBand">${await options('concentration', query.mordantBand, t('ref.any'))}</select>`)}
              ${field(t('ref.ph'), `<select data-q="phCode">${await options('ph', query.phCode, t('ref.any'))}</select>`, t('ref.unspecifiedHint'))}
            </details>

            ${asked ? `<button class="btn quiet" data-clear>${t('ref.clear')}</button>` : ''}
          `)}
        </div>

        <div class="col">
          ${panel(resultsPane)}
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

// ---------------------------------------------------------------- read view
//
// This is where the app's whole premise becomes visible: general knowledge with
// the owner's own results beneath it. A combination that says "grey-brown" and
// then shows four of her placements, two agreeing and two not, is worth more
// than either half alone.

/** Every placement in every trial whose inputs match this combination. */
async function placementsFor(record) {
  const trials = await all('trials');
  const out = [];
  for (const tr of trials) {
    for (const pl of tr.placements || []) {
      if (pl.combinationId === record.id) out.push({ trial: tr, placement: pl });
    }
  }
  return out.sort((a, b) => (b.trial.date || '').localeCompare(a.trial.date || ''));
}

async function renderRead(root, r) {
  const plants = await all('plants');
  const plantsById = new Map(plants.map(p => [p.id, p]));
  const k = r.key || {};
  const e = r.expected || {};

  const mine = await placementsFor(r);

  const cards = (await Promise.all(mine.map(async ({ trial, placement }) => `
    <div class="placement" style="background:var(--surface)">
      ${placement.photo ? `<div class="placephoto"><img src="${placement.photo}" alt=""></div>` : ''}
      <div class="placebody">
        <div class="refhead">
          <b>${esc(placement.resultColour || '—')}</b>
          <span class="hint">${fmtDate(trial.date)}</span>
        </div>
        <div class="hint">${esc(trial.title || t('trials.one'))}</div>
        ${placement.observation ? `<div class="prose"><p>${esc(placement.observation)}</p></div>` : ''}
      </div>
    </div>`))).join('');

  root.innerHTML = page({
    title: text(e.colourText) || t('ref.one'),
    sub: await sourceLine(r, plantsById),
    actions: `<button class="btn quiet" data-back>${t('common.back')}</button>
              <button class="btn primary" data-edit>${t('common.edit')}</button>`,
    body: `
      <div class="headline">
        <div class="refswatch" style="background:${esc(e.swatchHex || '#8C7B6B')};width:96px;height:96px;flex:0 0 96px"></div>
        <div class="headlinebody">
          <h2>${esc(text(e.colourText) || '—')}</h2>
          <div class="latin">${esc(await conditionLine(r))}</div>
          ${text(e.variation) ? `<p class="hint">${esc(text(e.variation))}</p>` : ''}
          ${mine.length ? `<p class="hint matched">${t('ref.confirmedBy', { n: mine.length })}</p>` : ''}
        </div>
      </div>

      <div class="cols">
        <div class="col">
          ${readBlock(t('ref.expected'), facts([
            fact(t('ref.plant'), esc(await sourceLine(r, plantsById))),
            fact(t('ref.fibre'), esc(await label('fibre_class', k.fibreClass))),
            fact(t('ref.mordant'), esc(k.mordantCode === 'none' ? t('ref.none') : await label('mordant_type', k.mordantCode))),
            fact(t('ref.band'), esc(await label('concentration', k.mordantBand))),
            fact(t('ref.process'), esc(await label('process', k.processCode))),
            fact(t('ref.ph'), k.medium?.phCode ? esc(await label('ph', k.medium.phCode)) : t('ref.unspecified')),
            fact(t('ref.confidence'), esc(await label('claim_confidence', r.confidence))),
            fact(t('recipes.learnedFrom'), esc(r.learnedFrom || '')),
          ]) + prose(r.notes))}
        </div>

        <div class="col">
          ${panel(`
            <h2>${t('ref.myPlacements')}</h2>
            <p class="note">${t('ref.myPlacementsHint')}</p>
            ${cards || `<p class="hint">${t('ref.noPlacements')}</p>`}
          `)}
        </div>
      </div>`,
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
    editing = false;
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
      if (editing || openId === 'new') await renderForm(root, draft);
      else await renderRead(root, draft);
    } else if (mode === 'records') {
      draft = null;
      await renderList(root);
    } else {
      draft = null;
      await renderSearch(root);
    }

    root.onclick = async (e) => {
      if (e.target.closest('[data-clear]')) {
        query = { plantId: '', partCode: '', fibreClass: '', processCode: '',
                  mordantCode: '', mordantBand: '', phCode: '' };
        return this.render(root);
      }
      const quick = e.target.closest('[data-quick]');
      if (quick) { query.plantId = quick.dataset.quick; return this.render(root); }

      if (e.target.closest('[data-more]')) { showMore = !showMore; return; }

      if (e.target.closest('[data-sync]')) {
        try {
          await seedUI.open('combinations');
          return seedUI.render(root, () => this.render(root));
        } catch (err) { alert(err.message); }
        return;
      }
      if (e.target.closest('[data-new]')) { draft = null; openId = 'new'; editing = true; return this.render(root); }
      if (e.target.closest('[data-edit]')) { editing = true; return this.render(root); }

      const card = e.target.closest('[data-open]');
      if (card) { draft = null; openId = card.dataset.open; editing = false; return this.render(root); }

      if (e.target.closest('[data-back]')) {
        if (editing && openId !== 'new') { editing = false; return this.render(root); }
        openId = null; draft = null; editing = false;
        return this.render(root);
      }

      if (e.target.closest('[data-save]')) {
        readForm(root);
        await put('combinations', markEdited(draft));
        openId = draft.id;
        editing = false;
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
        if (e.target.dataset.q === 'plantId') query.partCode = '';
        return this.render(root);
      }
    };
  },
};

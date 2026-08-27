// modules/reference.js — the reference engine (§7).
//
// This is the module the whole app exists for. Everything else stores what
// happened; this answers what to expect. A record holds one expected outcome
// for a defined set of inputs, and the search matches on ANY SUBSET of them —
// because in practice one rarely has all five fixed.

import { all, get, put, newRecord, toggleFavorite } from '../db.js';
import { markEdited } from '../seed.js';
import * as seedUI from '../seed-ui.js';
import { rankByColour, colourDifference, colourDistance } from '../calc/colour.js';
import { bandRange } from '../vocab.js';
import { t, text } from '../i18n.js';
import { markClean } from '../dirty.js';
import { page, panel, field, options, label, favStar, esc, empty, note, pairField, readPairs,
         fact, facts, prose, readBlock, fmtDate, navigate, backTo, actionBtn, icon, deleteGuarded } from '../ui.js';

let mode = 'search';
let openId = null;
let draft = null;
let editing = false;

// Empty means "not specified", which widens rather than narrows.
// `colourHex` is the other direction (§13ah): not "what will oak give me" but
// "I want this colour on this cloth, how do I get it". Empty means not asked,
// like every other field — a colour cannot be left blank in a colour input, so
// it is held here rather than read off the control.
let query = { plantId: '', partCode: '', fibreClass: '', processCode: '',
              mordantCode: '', mordantBand: '', phCode: '', colourHex: '' };
let showMore = false;
let favOnly = false;

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
      // No colour, not a brown one. A new record has not been measured yet,
      // and starting it at a default means every record ever created carries a
      // figure nobody chose (§13df).
      colourText: { bg: '', en: '' }, swatchHex: '',
      variation: { bg: '', en: '' }, printQuality: null,
      lightfastness: '', washfastness: '',
    },
    influences: [],
    confidence: 'practice',
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
// The dimensions the ranking works by, named once. `compare` builds its
// criteria from this and the detail panel draws it, so the two cannot come
// apart: a panel showing six of seven conditions means somebody is being ranked
// by a field they were never shown (§13dk).
export const CRITERIA = [
  ['plantId',     'ref.plant'],
  ['partCode',    'ref.part'],
  ['processCode', 'ref.process'],
  ['fibreClass',  'ref.fibre'],
  ['mordantCode', 'ref.mordant'],
  ['mordantBand', 'ref.band'],
  ['phCode',      'ref.ph'],
];

export function compare(record, q) {
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

  // THREE OUTCOMES, NOT TWO (§13ck).
  //
  // A record can agree, it can say something else, or IT CAN NOT SAY. The third
  // was being counted as the second: a record whose `fibreClass` is null, met by
  // a query for cellulose, went into `differs`, and the card told the person the
  // record was for a different fibre. It is not. It does not say.
  //
  // The distinction is the same one the `medium` comment above already makes —
  // an unrecorded pH is unknown, not neutral — and it had simply never been
  // carried into the comparison. It matters more than it looks: the guide
  // records colour and conditions and almost never the fibre or the mordant
  // strength, so nearly every record drawn from it is silent on something, and
  // under the old reading nearly every one of them contradicted the question.
  const differs = [];
  const silent = [];
  let asked = 0;
  let plantMatches = false;

  for (const [name, actual, wanted, labelText, weight] of criteria) {
    if (!wanted) continue;
    asked++;
    if (actual === null || actual === undefined || actual === '') {
      silent.push({ name, labelText, weight });
    } else if (actual === wanted) {
      if (name === 'plantId') plantMatches = true;
    } else {
      differs.push({ name, labelText, weight });
    }
  }

  return {
    asked,
    differs,
    silent,
    // Silence is not agreement either. A record that does not name the fibre is
    // not an exact answer to a question about cotton — it is an answer that
    // leaves the fibre open, and the card says so rather than claiming a match
    // the record cannot support.
    exact: asked > 0 && differs.length === 0 && silent.length === 0,
    open: asked > 0 && differs.length === 0 && silent.length > 0,
    // One difference is a neighbour worth seeing; two is a different question.
    near: differs.length === 1,
    plantMatches,
  };
}

async function conditionLine(record) {
  const k = record.key || {};
  const bits = [];
  if (k.mordantCode && k.mordantCode !== 'none') {
    const band = k.mordantBand ? ` (${await label('mordant_strength', k.mordantBand)})` : '';
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

// Which result the detail panel is showing. Null means „the first one", not
// „none": a panel that starts empty asks to be clicked before it says anything,
// and the first result is the one the ranking already put first (§13df).
let selectedId = null;

// The conditions of a record, as chips rather than one line joined with
// middots — §13s·3. Each is a fact of its own and reads as one.
async function conditionChips(record) {
  const k = record.key || {};
  const out = [];
  out.push(k.mordantCode && k.mordantCode !== 'none'
    ? (await label('mordant_type', k.mordantCode))
      + (k.mordantBand ? ` (${await label('mordant_strength', k.mordantBand)})` : '')
    : t('ref.none'));
  out.push(await label('fibre_class', k.fibreClass));
  out.push(await label('process', k.processCode));
  // An unrecorded medium is a condition too, and saying so once in the row
  // reads better than a separate grey line under every card.
  out.push(k.medium?.phCode
    ? await label('ph', k.medium.phCode)
    : `${t('ref.ph')}: ${t('ref.unspecified')}`);
  return out.filter(Boolean).map(x => `<span class="chip">${esc(x)}</span>`).join('');
}

// COLOUR FAMILIES ARE A SHORTCUT TO A HEX, not a new dimension (§13df).
//
// The search model holds one `colourHex` and `rankByColour` orders records by
// distance from it. A family chip sets that same hex to a representative
// nuance, so nothing about the ranking changes — pressing „Розово" is exactly
// pressing pink in the colour picker, with the picker's difficulty removed.
//
// The hexes are chosen to sit in the middle of what a dyer means by the word,
// not at the centre of the sRGB region: „жълто" from a dye pot is nearer to
// ochre than to a screen's pure yellow, and ranking against the pure one would
// put every real result at a distance.
// Where a colour picker opens when nothing has been chosen. Neutral on purpose:
// it opened on a warm brown, and the workspace must not lean on a colour
// judgement before one has been made (§13n).
const PICKER_NEUTRAL = '#7E7A73';

const FAMILIES = [
  ['yellow', '#D8B33A'],
  ['ochre',  '#B08D2E'],
  ['orange', '#C4703A'],
  ['red',    '#A03D3B'],
  ['pink',   '#C98A93'],
  ['green',  '#6E7A42'],
  ['blue',   '#2C3B57'],
  ['brown',  '#7A5B42'],
  ['grey',   '#7E7A73'],
];

// Which family the current hex belongs to, so a chip can show as pressed after
// a reload. Compared by the same distance the ranking uses, rather than by
// string equality: the exact picker sets a hex no chip carries, and none should
// then look pressed.
function familyOf(hex) {
  if (!hex) return null;
  let best = null, bestD = Infinity;
  for (const [code, h] of FAMILIES) {
    const d = colourDistance(hex, h);
    if (d != null && d < bestD) { bestD = d; best = code; }
  }
  return bestD <= 1 ? best : null;
}

// A swatch, or the absence of one.
//
// Sixty-one records carry no measured colour: their source described the print
// and the colour in WORDS and never gave a figure, and inventing a hex from
// „наситено златисто жълто" would be the application manufacturing a
// measurement (§13ax). Until now every one of them drew a default brown, which
// is worse than nothing — it looks exactly like a colour somebody measured.
//
// An outlined empty square instead. „Nobody has measured this" is a state the
// screen can show, and showing it is the whole difference between a reference
// and a decoration.
const swatch = (hex, cls = 'refswatch', approx = false) => hex
  ? `<span class="${cls}${approx ? ' approx' : ''}" style="background:${esc(hex)}"
       ${approx ? `title="${esc(t('ref.approxSwatch', { from: '' }))}"` : ''}></span>`
  : `<span class="${cls} unmeasured" title="${esc(t('ref.noSwatch'))}"></span>`;

// The detail panel — the same facts the read view carries, beside the results
// rather than a page away.
//
// „Влияния" is NOT here. `influences` is declared on all 163 records and
// populated on none of them (decision 12), and a section standing empty on
// every record reads as a screen that is broken rather than as a field nobody
// has filled. Absent until there is something to put in it.
// The sources a record rests on — the list, the single older value, and the one
// an influence cites of its own. Resolved through the register rather than
// printed as prose, so a name on the screen is a record somebody can open
// (§13dg).
async function sourceList(record) {
  const codes = [...new Set([
    ...(record.sourceCodes || []),
    record.learnedFrom,
    ...(record.influences || []).map(i => i.sourceCode),
  ].filter(Boolean))];
  if (!codes.length) return '';
  const reg = new Map((await all('sources')).map(x => [x.code, x]));
  return codes.map(c => {
    const src = reg.get(c);
    if (!src) return esc(c);            // prose from an older record, shown as it is
    const name = esc(text(src.name) || src.code);
    return src.url ? `<a href="${esc(src.url)}" target="_blank" rel="noopener">${name}</a>` : name;
  }).join(' · ');
}

// WHAT MOVES THE RESULT (§13dg).
//
// Thirty-seven records carry an explanation of what changes them — the fibre,
// the mordant, the medium, the species, the dose, the preparation — each with
// the source that says so. They came back across three rounds of the data
// workbook and had nowhere to go until now.
//
// Grouped by factor, because „mordant" said three times about one record is one
// thing being explained, not three.
async function influenceBlock(record) {
  const list = record.influences || [];
  if (!list.length) return '';
  const reg = new Map((await all('sources')).map(x => [x.code, x]));
  const rows = await Promise.all(list.map(async (i) => {
    const src = reg.get(i.sourceCode);
    return `<div class="influence">
      <b>${esc(await label('influence_factor', i.factor))}</b>
      <span>${esc(text(i.text))}</span>
      ${src ? `<span class="hint">${esc(text(src.name) || src.code)}</span>` : ''}
    </div>`;
  }));
  return `<div class="influences">
    <h2>${t('ref.influences')}</h2>${rows.join('')}</div>`;
}

async function detailPane(record, plantsById) {
  if (!record) return '';
  const k = record.key || {};
  const e = record.expected || {};
  const mine = await placementsFor(record);

  const trials = mine.slice(0, 4).map(({ trial, placement }) => `
    <div class="detailtrial">
      <b>${esc(placement.resultColour || '—')}</b>
      <span class="hint">${esc(fmtDate(trial.date))}</span>
      ${placement.observation ? `<p class="hint">${esc(placement.observation)}</p>` : ''}
    </div>`).join('');

  return `
    <div class="refdetail">
      <div class="detailhead">
        ${swatch(e.swatchHex, 'refswatch', e.swatchApprox)}
        <div class="headlinebody">
          <h2>${esc(text(e.colourText) || '—')}</h2>
          <div class="hint">${esc(await sourceLine(record, plantsById))}</div>
        </div>
      </div>

      ${!e.swatchHex ? `<p class="hint">${t('ref.noSwatchLong')}</p>` : ''}
      ${e.swatchApprox
        ? `<p class="hint">${esc(t('ref.approxSwatchLong', { from: e.swatchFrom || '' }))}</p>` : ''}

      ${/* EVERY CONDITION THE RANKING USES, named, and named even where the
            record is silent (§13dk). `fact()` renders nothing for an empty
            value, so a record that does not state its fibre simply had no fibre
            line — and a reader could not tell cotton from nobody-wrote-it-down,
            which is the §13ck distinction disappearing on the one screen built
            to show it. */ ''}
      ${facts([
        fact(t('ref.plant'), esc(text(plantsById.get(k.dyeSource?.plantId)?.nameCommon)
          || t('ref.unspecified'))),
        fact(t('ref.part'), esc(await label('plant_part', k.dyeSource?.partCode)
          || t('ref.unspecified'))),
        fact(t('ref.fibre'), esc(await label('fibre_class', k.fibreClass) || t('ref.unspecified'))),
        fact(t('ref.mordant'), esc(k.mordantCode === 'none'
          ? t('ref.none')
          : (await label('mordant_type', k.mordantCode) || t('ref.unspecified')))),
        fact(t('ref.band'), esc(await label('mordant_strength', k.mordantBand)
          || t('ref.unspecified'))),
        fact(t('ref.process'), esc(await label('process', k.processCode) || t('ref.unspecified'))),
        fact(t('ref.ph'), k.medium?.phCode
          ? esc(await label('ph', k.medium.phCode)) : t('ref.unspecified')),
        fact(t('ref.confidence'), esc(await label('confidence', record.confidence || 'unverified'))),
      ])}

      ${text(e.variation) ? `<p class="hint">${esc(text(e.variation))}</p>` : ''}
      ${text(record.notes) ? prose(record.notes) : ''}

      ${await influenceBlock(record)}

      ${''}${(await sourceList(record))
        ? `<div class="detailsources"><h2>${t('ref.sources')}</h2>
             <p class="hint">${await sourceList(record)}</p></div>`
        : ''}

      <div class="detailtrials">
        <h2>${t('ref.myPlacements')}</h2>
        ${trials || `<p class="hint">${t('ref.noPlacements')}</p>`}
      </div>

      <a class="btn quiet" href="#/reference/${record.id}">${t('ref.openFull')}</a>
    </div>`;
}

async function resultCard(record, plantsById, match) {
  const e = record.expected || {};
  const k = record.key || {};
  const mine = placementCounts.get(record.id) || 0;
  const badge = (match && !match.exact && match.differs.length)
    ? `<span class="chip near">${match.plantMatches ? t('ref.samePlant') : t('ref.sameConditions')}</span>`
    : (match && match.open ? `<span class="chip near">${t('ref.openBadge')}</span>` : '');

  // The reference is a compilation until her own trials make it hers, and the
  // screen should say which is which without being asked. `confidence` has been
  // on every record from the start and appeared nowhere here. §13t.
  const conf = record.confidence || 'unverified';
  const dot = `<span class="confdot ${esc(conf)}"
    title="${esc(await label('confidence', conf))}"></span>`;

  return `
    <div class="refcard" data-open="${record.id}">
      ${swatch(e.swatchHex)}
      <div class="refbody">
        <div class="refhead">
          <b>${esc(await sourceLine(record, plantsById))}</b>
          ${badge}
          <span class="spacer"></span>
          ${dot}
        </div>
        <div class="refcolour">${esc(text(e.colourText) || '—')}</div>
        <div class="chiprow">${await conditionChips(record)}</div>
        ${text(e.variation) ? `<div class="hint">${esc(text(e.variation))}</div>` : ''}
        ${match && match.differs.length
          ? `<div class="hint differs">${t('ref.differsIn', { what: esc(match.differs.map(x => x.labelText).join(', ')) })}</div>` : ''}
        ${/* Separate line and separate words. „Не уточнява влакното" is not
             „за друго влакно" — the record is not disagreeing, it is quiet. */''}
        ${match && match.silent?.length
          ? `<div class="hint silent">${t('ref.silentOn', { what: esc(match.silent.map(x => x.labelText).join(', ')) })}</div>` : ''}

        ${mine ? `<div class="hint matched">${t('ref.confirmedBy', { n: mine })}</div>` : ''}
      </div>
    </div>`;
}

// -------------------------------------------------------------- search view

// What a strength band means in real percent, for the mordant that has been
// chosen (§13bp).
//
// "Medium" is a multiple of that substance's own standard dose, so the word
// alone says nothing until the mordant is known: medium alum is around 15% and
// medium iron around 1%, and someone reading only the word would be out by a
// factor of fifteen.
//
// Says nothing at all when no mordant is chosen, rather than picking one to
// illustrate with — an example would read as the answer.
async function bandMeans(mordantCode, bandCode) {
  if (!mordantCode || mordantCode === 'none' || !bandCode) return '';
  const sub = (await all('substances'))
    .find(x => x.mordantTypeCode === mordantCode && x.standardPercentWof);
  if (!sub) return '';
  const row = bandRange('mordant_strength', bandCode);
  if (!row) return '';
  const pc = (n) => Math.round(n * sub.standardPercentWof * 10) / 10;
  return row.max == null
    ? t('ref.bandOver', { n: pc(row.min) })
    : t('ref.bandBetween', { a: pc(row.min), b: pc(row.max) });
}

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

  // Records that agree with everything they DO state and are silent on the
  // rest. They belong with the exact answers, not with the neighbours: nothing
  // in them contradicts the question. They are marked so the difference is
  // visible, and they sort after the records that answer in full (§13ck).
  const open = results
    .filter(x => x.m.open)
    .sort((a, b) => a.m.silent.length - b.m.silent.length);

  const near = results
    .filter(x => x.m.near)
    // A neighbour that keeps the plant answers "what else can this give?";
    // one that keeps the conditions answers "what else behaves like this?".
    // The first is nearly always the more useful, so it leads.
    .sort((a, b) => (b.m.plantMatches - a.m.plantMatches) || (a.m.differs[0].weight - b.m.differs[0].weight));

  // Asked by colour, the question is inverted: the conditions are the answer,
  // not the criteria. So the colour never makes a record *exact* — it orders
  // what the other criteria have already allowed, and says how far off each one
  // is. A colour "matches" everything to some degree, and a list of fifty
  // sorted by distance is not an answer to anything.
  let byColour = [];
  if (query.colourHex) {
    const allowed = results.filter(x => x.m.exact || x.m.open || x.m.near).map(x => x.r);
    byColour = rankByColour(allowed.length ? allowed : records, query.colourHex);
  }

  // Kept: `resultCard` still renders the records tab, which is a browse rather
  // than an answer and reads better as cards.
  const exactList = [...exact, ...open].slice(0, 40);
  const nearList = near.slice(0, 12);

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
    ? `<option value="">${t('ref.anyPart')}</option>` + (await Promise.all(partCodes.map(async c =>
        `<option value="${c}"${c === query.partCode ? ' selected' : ''}>${esc(await label('plant_part', c))}</option>`))).join('')
    : await options('plant_part', query.partCode, t('ref.anyPart'));

  const plantOptions = `<option value="">${t('ref.anyPlant')}</option>` + plants.map(p =>
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

  // A table, not cards — rule 1 of §13s, read the way it is written. A card is
  // for prose or an image; these results are the same few values across a dozen
  // records, looked at against each other, which is what a table is for. The
  // first attempt wrapped `resultCard` in a grid and crushed it: twelve cards
  // each three hundred pixels tall, one word per line, and the answer to "what
  // gives me this colour" a page of scrolling.
  //
  // On a phone it becomes stacked rows without anything further, because the
  // rule from §13ae is against `.grid` rather than against any one list.
  // Which record the panel shows. The first result unless one has been picked,
  // and back to the first when the question changes — a panel still showing the
  // answer to a question nobody is asking any more is worse than an empty one.
  // Whatever the question was, these are its answers in order, and the panel
  // shows one of them. Previously only the colour path had a `ranked` list, so
  // only the colour path could have a panel.
  const ranked = query.colourHex
    ? byColour.map(x => x.r)
    : [...exact, ...open, ...near].map(x => x.r);
  const shownId = (selectedId && ranked.some(r => r.id === selectedId))
    ? selectedId
    : (ranked[0]?.id || null);
  const shown = ranked.find(r => r.id === shownId) || null;

  // ONE PRESENTATION FOR BOTH QUESTIONS (§13dj).
  //
  // The colour question drew rows with a panel; the conditions question drew
  // cards with none. So a record with no measured colour — which cannot be
  // ranked by colour at all — carried influences and sources that could never
  // be read, and which half of the screen you got depended on which field you
  // had filled in. The badge changes with the question, because the question
  // changes what „how close is this" means; nothing else does.
  const rowFor = async (r, badge) => {
    const conf = r.confidence || 'unverified';
    return `
      <tr data-pick="${r.id}"${r.id === shownId ? ' class="on"' : ''}>
        <td class="swatchcell">${swatch(r.expected?.swatchHex, 'thumb', r.expected?.swatchApprox)}</td>
        <td>
          <b>${esc(text(r.expected?.colourText) || '—')}</b>
          <div class="hint">${esc(await sourceLine(r, plantsById))}</div>
        </td>
        <td>${esc(await conditionLine(r))}</td>
        <td class="rowbadge">
          ${badge ? `<span class="chip near">${esc(badge)}</span>` : ''}
          <span class="confdot ${esc(conf)}" title="${esc(await label('confidence', conf))}"></span>
        </td>
      </tr>`;
  };

  const colourRows = (await Promise.all(byColour.map(async ({ r }) => {
    const diff = colourDifference(query.colourHex, r.expected?.swatchHex);
    return rowFor(r, diff && diff.code !== 'same' ? t('ref.diff.' + diff.code) : t('ref.diff.same'));
  }))).join('');

  // Results on the left, the chosen one on the right — and one column on a
  // phone, where the panel follows the list rather than fighting it for width.
  const panelHtml = await detailPane(shown, plantsById);

  const split = (bodyHtml) => bodyHtml ? `
    <div class="refsplit">
      <div class="panel flush">
        <table class="grid">
          <thead><tr>
            <th class="swatchcell"></th>
            <th>${t('ref.col.colour')}</th>
            <th>${t('ref.col.conditions')}</th>
            <th></th>
          </tr></thead>
          <tbody>${bodyHtml}</tbody>
        </table>
      </div>
      <aside class="refaside">${panelHtml}</aside>
    </div>` : '';

  const colourTable = split(colourRows);

  // The conditions question, in the same shape. „Exact" and „near" stay apart —
  // that distinction is the whole of §13ck and a badge cannot carry it — but
  // they are rows in one table with one panel beside them, not two galleries
  // of cards with nothing beside them at all.
  const exactRows = (await Promise.all(exactList.map(x => rowFor(x.r,
    x.m.exact ? '' : (x.m.plantMatches ? t('ref.samePlant') : t('ref.openBadge')))))).join('');
  const nearRows = (await Promise.all(nearList.map(x => rowFor(x.r,
    x.m.plantMatches ? t('ref.samePlant') : t('ref.sameConditions'))))).join('');

  const resultsPane = !asked
    ? `${panel(`<p class="note">${t('ref.startHint')}</p><div class="boxes">${quick}</div>`)}`
    : query.colourHex
    ? `
      <h2>${t('ref.colourCount', { n: byColour.length })}</h2>
      <p class="hint">${t('ref.colourHead')}</p>
      ${colourTable || note(t('ref.noColour'), 'warn')}`
    : `
      <h2>${t('ref.matchCount', { n: exact.length })}</h2>
      <div class="conflegend">
        ${(await Promise.all(['practice', 'literature', 'confirmed', 'unverified'].map(async c =>
          `<span><i class="confdot ${c}"></i>${esc(await label('confidence', c))}</span>`))).join('')}
      </div>
      ${exactRows ? split(exactRows) : note(t('ref.noExact'), 'warn')}
      ${nearRows ? `
        <h2 class="nearhead">${t('ref.nearSection')}</h2>
        <p class="hint">${t('ref.nearHint')}</p>
        <div class="panel flush"><table class="grid"><tbody>${nearRows}</tbody></table></div>` : ''}`;

  root.innerHTML = page({
    title: t('reference.title'),
    sub: t('reference.sub'),
    actions: host.tabs(),
    // The question is short and the answer is long. Splitting the screen down
    // the middle gave the four selects half the width and squeezed every result
    // card into the other half; the form is a band across the top instead, and
    // the results run the full width beneath it. §13t.
    body: `
      ${panel(`
        <h2>${t('ref.ask')}</h2>
        <p class="note">${t('ref.askHint')}</p>
        <div class="askgrid">
          ${field(t('ref.plant'), `<select data-q="plantId">${plantOptions}</select>`)}
          ${field(t('ref.part'), `<select data-q="partCode"${partCodes && !partCodes.length ? ' disabled' : ''}>${partOptions}</select>`)}
          ${field(t('ref.fibre'), `<select data-q="fibreClass">${await options('fibre_class', query.fibreClass, t('ref.anyFibre'))}</select>`)}
          ${/* Chips replace the colour picker as the way in; see below. */ ''}
          ${field(t('ref.process'), `<select data-q="processCode">${await options('process', query.processCode, t('ref.anyProcess'))}</select>`)}
        </div>

        ${/* Chips rather than a colour picker as the way in. A picker asks for
              a nuance nobody has in mind yet; a family is the question actually
              being asked, and the picker stays for when the answer IS a nuance
              — a thread to match, a swatch on the bench.

              No „any colour" chip: nothing chosen already means nothing asked,
              and a chip whose job is to be pressed by default teaches people to
              press things that change nothing. What is needed after a choice is
              a way OUT, which is the last item in the row. */ ''}
        <div class="askcolour">
          <span class="asklabel">${t('ref.colour')}</span>
          <div class="chipset">
            ${(await Promise.all(FAMILIES.map(async ([code, hex]) => {
              const on = familyOf(query.colourHex) === code;
              return `<button class="colourchip${on ? ' on' : ''}" data-family="${code}"
                        aria-pressed="${on}">
                        <span class="colourdot" style="background:${hex}"></span>
                        ${esc(t('colour_family.' + code))}
                      </button>`;
            }))).join('')}
            ${/* An ACTION, not a tenth family, so no dot of its own. */ ''}
            <label class="colourchip exactnuance${query.colourHex && !familyOf(query.colourHex) ? ' on' : ''}">
              + ${t('ref.exactNuance')}
              <input type="color" data-q="colourHex" value="${esc(query.colourHex || PICKER_NEUTRAL)}"
                     aria-label="${esc(t('ref.exactNuance'))}">
            </label>
            ${query.colourHex
              ? `<button class="btn quiet" data-nocolour>${t('ref.clearColour')}</button>` : ''}
          </div>
        </div>

        <details class="pairalt"${showMore ? ' open' : ''}>
          <summary data-more>${t('ref.moreConditions')}</summary>
          <div class="askgrid">
            ${field(t('ref.mordant'), `<select data-q="mordantCode">
              <option value="">${t('ref.anyMordant')}</option>
              <option value="none"${query.mordantCode === 'none' ? ' selected' : ''}>${t('ref.none')}</option>
              ${(await options('mordant_type', query.mordantCode, '')).replace(/^<option value="">.*?<\/option>/, '')}
            </select>`)}
            ${field(t('ref.band'),
              `<select data-q="mordantBand">${await options('mordant_strength', query.mordantBand, t('ref.any'))}</select>`,
              await bandMeans(query.mordantCode, query.mordantBand))}
            ${field(t('ref.ph'), `<select data-q="phCode">${await options('ph', query.phCode, t('ref.any'))}</select>`, t('ref.unspecifiedHint'))}
          </div>
        </details>

        ${asked ? `<button class="btn quiet" data-clear>${t('ref.clear')}</button>` : ''}
      `)}

      ${resultsPane}`,
  });
}

// ------------------------------------------------------------- records view

async function renderList(root) {
  const plants = await all('plants');
  const plantsById = new Map(plants.map(p => [p.id, p]));
  const allRecords = await all('combinations');
  const favCount = allRecords.filter(r => r.favorite).length;
  const records = favOnly ? allRecords.filter(r => r.favorite) : allRecords;

  const rows = await Promise.all(records.map(async r => `
    <tr data-open="${r.id}">
      <td class="favcell">${favStar(r)}</td>
      <td class="withthumb">${swatch(r.expected?.swatchHex, 'thumb')}
        ${esc(text(r.expected?.colourText) || '—')}</td>
      <td>${esc(await sourceLine(r, plantsById))}</td>
      <td>${esc(await conditionLine(r))}</td>
      <td>${esc(await label('claim_confidence', r.confidence) || '')}</td>
    </tr>`));

  const table = records.length ? `
    <table class="grid">
      <thead><tr>
        <th class="favcell"></th>
        <th>${t('ref.col.colour')}</th>
        <th>${t('ref.col.source')}</th>
        <th>${t('ref.col.conditions')}</th>
        <th>${t('ref.confidence')}</th>
      </tr></thead>
      <tbody>${rows.join('')}</tbody>
    </table>` : empty(favOnly ? t('ref.emptyFav') : t('ref.empty'),
                    favOnly ? '' : t('ref.emptyHint'));

  // A trusted result is exactly the thing worth pinning, so the chip appears
  // here as it does on plants and recipes — one row, one shape, everywhere.
  const chips = favCount ? `
    <div class="boxes">
      <button class="box${favOnly ? '' : ' active'}" data-favall>
        <span class="boxname">${t('common.all')}</span>
        <span class="boxcount">${allRecords.length}</span>
      </button>
      <button class="box${favOnly ? ' active' : ''}" data-favonly>
        <span class="boxname">${t('common.favorites')}</span>
        <span class="boxcount">${favCount}</span>
      </button>
    </div>` : '';

  root.innerHTML = page({
    title: t('reference.title'),
    sub: t('reference.sub'),
    actions: `${host.tabs()}
      <button class="btn quiet" data-sync>${t('seed.sync')}</button>
      ${actionBtn('add', t('ref.new'), 'data-new', 'primary')}`,
    body: `${chips}${panel(table, 'flush')}`,
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
    actions: `${favStar(r, true)}
              ${backTo('#/reference', t('nav.reference'))}
              ${actionBtn('edit', t('common.edit'), 'data-edit', 'primary')}`,
    body: `
      <div class="headline">
        <span class="refswatch${e.swatchHex ? '' : ' unmeasured'}" style="${e.swatchHex ? `background:${esc(e.swatchHex)};` : ''}width:96px;height:96px;flex:0 0 96px"></span>
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
            fact(t('ref.band'), esc(await label('mordant_strength', k.mordantBand))),
            fact(t('ref.process'), esc(await label('process', k.processCode))),
            fact(t('ref.ph'), k.medium?.phCode ? esc(await label('ph', k.medium.phCode)) : t('ref.unspecified')),
            fact(t('ref.confidence'), esc(await label('claim_confidence', r.confidence))),
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
    actions: `${backTo('#/reference', t('nav.reference'))}
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
            ${field(t('ref.mordantBand'), `<select data-k="mordantBand">${await options('mordant_strength', k.mordantBand, '')}</select>`)}
            ${field(t('ref.process'), `<select data-k="processCode">${await options('process', k.processCode, '')}</select>`)}
            ${field(t('ref.ph'), `<select data-k="medium.phCode">${await options('ph', k.medium?.phCode, t('ref.any'))}</select>`)}
          `)}
        </div>

        <div class="col">
          ${panel(`
            <h2>${t('ref.expected')}</h2>
            ${/* A colour input cannot hold nothing, so opening one of the
                  sixty-one records with no measured colour showed a default
                  brown — and saving without touching it stamped that brown on
                  as a measurement. The checkbox is what „nobody has measured
                  this" looks like in a form (§13df). */ ''}
            ${field(t('ref.swatch'), `
              <span class="askcolour">
                <input type="color" data-e="swatchHex" value="${esc(r.expected?.swatchHex || PICKER_NEUTRAL)}"
                       ${r.expected?.swatchHex ? '' : 'disabled'}>
                <label class="check"><input type="checkbox" data-noswatch
                  ${r.expected?.swatchHex ? '' : 'checked'}>
                  <span>${t('ref.noSwatch')}</span></label>
              </span>`)}
            ${pairField(t('ref.colour'), 'colourText', r.expected?.colourText)}
            ${pairField(t('ref.variation'), 'variation', r.expected?.variation, { multiline: true })}
            ${field(t('ref.printQuality'), `<select data-e="printQuality">${await options('print_quality', r.expected?.printQuality)}</select>`)}
            ${field(t('ref.confidence'), `<select data-f="confidence">${await options('claim_confidence', r.confidence, '')}</select>`)}
          `)}

          ${panel(`
            <h2>${t('common.notes')}</h2>
            ${pairField('', 'notes', r.notes, { multiline: true })}
            ${!isNew ? `${actionBtn('delete', t('ref.delete'), 'data-delete', 'destructive')}` : ''}
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
  // The checkbox wins over the picker: a picker always has a value, and that
  // value is not a claim unless somebody made it one.
  if (root.querySelector('[data-noswatch]')?.checked) draft.expected.swatchHex = '';
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

  // Exposed for the guard. Which record the panel shows is module state rather
  // than an address (§13q applies to the SCREEN, and the panel is a selection
  // within one), so a guard that wanted a particular record could only get
  // there by clicking whichever row a question happened to rank first — which
  // is testing the ranking by accident.
  selectForTest(id) { selectedId = id; },

  // The address decides what is on screen (§13q). Called on every route change,
  // with nothing when the address names no record, which is how the list comes
  // back.
  //
  //   #/reference              the search
  //   #/reference/records      the records tab
  //   #/reference/new          a new combination
  //   #/reference/<id>         the record
  //   #/reference/<id>/edit    editing it
  //
  // The tab sits inside the reference address for the same reason chains sit
  // inside recipes (§13q): `activeNav()` lights an entry by module id, so a
  // separate address would light nothing. It costs one reserved id, and ids are
  // generated. A record keeps whichever tab it was opened from, because the two
  // tabs are two ways in to the same records and going back should return the
  // way one came.
  open(first, second) {
    draft = null;
    seedUI.close();
    if (first === 'records') {
      mode = 'records';
      openId = null;
      editing = false;
      return;
    }
    if (!first) mode = 'search';
    openId = first || null;
    editing = first === 'new' || second === 'edit';
  },

  reset() {
    seedUI.close();
    openId = null;
    draft = null;
    editing = false;
    mode = 'search';
    favOnly = false;
  },

  async render(root) {
    if (seedUI.isOpen()) return seedUI.render(root, () => this.render(root));

    if (!root.__refTabs) {
      root.__refTabs = (e) => {
        const tab = e.target.closest('[data-refmode]');
        if (!tab) return;
        e.stopPropagation();
        navigate(tab.dataset.refmode === 'records' ? '#/reference/records' : '#/reference');
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
      const fav = e.target.closest('[data-fav]');
      if (fav) {
        e.stopPropagation();
        await toggleFavorite('combinations', fav.dataset.fav);
        if (draft && draft.id === fav.dataset.fav) draft.favorite = !draft.favorite;
        return this.render(root);
      }
      if (e.target.closest('[data-favonly]')) { favOnly = true; return this.render(root); }
      if (e.target.closest('[data-favall]'))  { favOnly = false; return this.render(root); }

      if (e.target.closest('[data-clear]')) {
        query = { plantId: '', partCode: '', fibreClass: '', processCode: '',
                  mordantCode: '', mordantBand: '', phCode: '', colourHex: '' };
        selectedId = null;
        return this.render(root);
      }
      const quick = e.target.closest('[data-quick]');
      if (quick) { query.plantId = quick.dataset.quick; return this.render(root); }

      // A colour input cannot be empty, so "any colour" needs a way back out.
      if (e.target.closest('[data-nocolour]')) { query.colourHex = ''; selectedId = null; return this.render(root); }

      // A family chip sets the same `colourHex` the picker sets (§13df).
      // Pressing the one already chosen clears it, so a chip is its own way out
      // as well as its way in.
      const fam = e.target.closest('[data-family]');
      if (fam) {
        const hex = (FAMILIES.find(([c]) => c === fam.dataset.family) || [])[1] || '';
        query.colourHex = (familyOf(query.colourHex) === fam.dataset.family) ? '' : hex;
        selectedId = null;
        return this.render(root);
      }

      if (e.target.closest('[data-more]')) { showMore = !showMore; return; }

      const noswatch = e.target.closest('[data-noswatch]');
      if (noswatch) {
        const picker = root.querySelector('[data-e="swatchHex"]');
        if (picker) picker.disabled = noswatch.checked;
        return;
      }

      // Picking a row fills the panel beside it. Not navigation: the whole
      // point is to compare without leaving the list (§13df).
      const pick = e.target.closest('[data-pick]');
      if (pick) { selectedId = pick.dataset.pick; return this.render(root); }

      if (e.target.closest('[data-sync]')) {
        try {
          await seedUI.open('combinations');
          return seedUI.render(root, () => this.render(root));
        } catch (err) { alert(err.message); }
        return;
      }
      if (e.target.closest('[data-new]')) return navigate('#/reference/new');
      if (e.target.closest('[data-edit]')) return navigate(`#/reference/${openId}/edit`);

      const card = e.target.closest('[data-open]');
      if (card) return navigate(`#/reference/${card.dataset.open}`);

      if (e.target.closest('[data-back]')) {
        if (editing && openId !== 'new') return navigate(`#/reference/${openId}`);
        return navigate(mode === 'records' ? '#/reference/records' : '#/reference');
      }

      if (e.target.closest('[data-save]')) {
        readForm(root);
        await put('combinations', markEdited(draft));
        // The put succeeded, so the work is saved and the address change that
        // follows is not a departure. `dirty.js` cannot tell the two apart from
        // outside — it infers a successful save by watching the form leave the
        // screen — but in here the answer is known (§13ad).
        markClean();
        return navigate(`#/reference/${draft.id}`);
      }
      if (e.target.closest('[data-delete]')) {
        // Guarded (§13cq): a record the history points at is refused, with a
        // count of what points at it. No cascade — see refs.js.
        if (!await deleteGuarded('combinations', draft.id, t('ref.confirmDelete'))) return;
        return navigate(mode === 'records' ? '#/reference/records' : '#/reference');
      }
    };

    root.onchange = async (e) => {
      if (e.target.dataset.q) {
        query[e.target.dataset.q] = e.target.value;
        if (e.target.dataset.q === 'plantId') query.partCode = '';
        // A new question means a new first answer (§13df).
        selectedId = null;
        return this.render(root);
      }
    };
  },
};

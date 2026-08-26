// modules/plants.js — the reference library's backbone (§4, §13.2).
//
// Structured where the reference engine needs to query — chemistry levels,
// dosing, temperature ceilings, compositional role — and free-form where the
// knowledge is prose. Ten fixed textareas per plant would make entry a chore;
// a book-like list of sections lets each plant say what it has to say.

import { all, get, put, newRecord, toggleFavorite, uid } from '../db.js';
import { markEdited } from '../seed.js';
import * as seedUI from '../seed-ui.js';
import { t, text, getLang } from '../i18n.js';
import { tempSpan, tempWith } from '../units.js';
import { markClean } from '../dirty.js';
import { inSeason as seasonOf } from './season.js';
import { page, panel, field, options, vocabList, label, describe, favStar, esc, empty, pairField, readPairs, segmented, levelBar,
         confField, readConfidence, readApprox, fact, facts, prose, readBlock, flash, searchBox, matches, navigate , approxNumber, fieldGroup, backTo, actionBtn, icon, deleteGuarded, photoOf } from '../ui.js';

const MONTHS_BG = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

// Offered when a plant has no sections yet — the shape of a profile, taken
// from how the owner's own guide is organised. Every one is optional.
const SUGGESTED = [
  { bg: 'Багрилни качества', en: 'Dye qualities' },
  { bg: 'Използвани части', en: 'Parts used' },
  { bg: 'Багрилна съставка', en: 'Dye constituent' },
  { bg: 'Беритба и обработка', en: 'Harvest and processing' },
  { bg: 'Източници', en: 'Sources' },
];

let openId = null;
// The month the list is narrowed to, from the address (§13cd). Null is the whole
// library.
let filterMonth = null;
let draft = null;
let filterRole = null;
let query = '';
let favOnly = false;
let editing = false;

// Which block of the profile a named section belongs to (§13i).
//
// The sections are not anonymous free text: the same headings recur across the
// library, because they came from one guide written to one shape. Reading the
// heading at display time lets the six blocks fill themselves from prose the
// structured fields do not carry — `harvestMonths` is empty on all 50 seeded
// plants, but "Беритба и обработка" is written out on six of them.
//
// A lookup, never a migration. An unrecognised heading falls to `more`, which
// is where every section used to go, so nothing a heading is not known for can
// be lost.
const SECTION_BLOCKS = {
  // "За тези числа" recurs on eight plants and says the ranges are a starting
  // point rather than tested practice. A caveat about the figures belongs beside
  // the figures, not at the bottom of the page.
  use: ['багрилни качества', 'дозиране', 'еко принт', 'използвани части', 'части',
        'за тези числа', 'температура', 'работа с него', 'върху кои влакна', 'устойчивост',
        'като източник на танин', 'танин и еко принт', 'плодовете отделно',
        'dye qualities', 'dosing', 'eco print', 'parts used', 'parts',
        'about these figures', 'temperature', 'working with it', 'on which fibres',
        'fastness', 'as a tannin source'],
  why: ['багрилна съставка', 'багрилни съставки', 'dye constituent', 'dye constituents'],
  // Growing left the library — propagation, husbandry, care and pests answer a
  // different question from the one the app is for, and stood on seven plants
  // of forty-eight. What remains under this block is the harvest, which is
  // dyeing knowledge: which stage to pick at, and what to do the same day.
  grow: ['беритба и обработка', 'беритба', 'сезон',
         'harvest and processing', 'harvest', 'season'],
  sources: ['източници', 'източник', 'sources', 'source'],
};

const SECTION_BLOCK = new Map();
for (const [block, titles] of Object.entries(SECTION_BLOCKS))
  for (const title of titles) SECTION_BLOCK.set(title, block);

// "Агротехника (отглеждане)" and "Агротехника" are one heading. Parentheses go,
// then punctuation, then the spaces they leave behind.
function normTitle(s) {
  return String(s || '').toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/[.,;:!?"'„“”«»\-–—/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sectionBlock(sec) {
  for (const lang of ['bg', 'en']) {
    const key = normTitle(sec.title?.[lang]);
    if (key && SECTION_BLOCK.has(key)) return SECTION_BLOCK.get(key);
  }
  return 'more';
}

/** Sections grouped by block, each keeping the order the record gives them. */
export function groupSections(sections = []) {
  const out = { use: [], why: [], grow: [], sources: [], more: [] };
  for (const sec of sections) out[sectionBlock(sec)].push(sec);
  return out;
}

function shrink(file, maxSide) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('bad image')); };
    img.src = url;
  });
}

function blank() {
  return newRecord({
    nameCommon: { bg: '', en: '' },
    nameBotanical: '',
    description: { bg: '', en: '' },
    family: '',
    role: [],
    compositionalRole: [],
    dyeClass: '',
    plantType: '',
    habitat: [],
    parts: [],
    // Temperatures live on the part (§13az). One plant, one number was the
    // fault: elder leaf wants 80–90 and elder fruit 50–70, and the field could
    // hold only one of them.

    confidence: {},
    approx: {},
    dryingRatio: null,
    liquorRatio: null,
    steamNote: '',
    yearsToMaturity: null,
    lightfastness: '',
    washfastness: '',
    invasive: false,
    toxicity: { bg: '', en: '' },
    colours: [],
    sections: [],
    photoData: null,
  });
}

// ---------------------------------------------------------------- list view

async function renderList(root) {
  const plants = await all('plants');
  // Loaded once for the whole table rather than per row: the swatches are
  // derived, and deriving them 48 times from 48 separate reads would be the
  // kind of thing that makes a list feel slow on a phone.
  const combinations = await all('combinations');

  const favCount = plants.filter(p => p.favorite).length;
  const roles = ['dye', 'ecoprint', 'mordant_accumulator'];
  const counts = {};
  for (const p of plants) for (const r of p.role || []) counts[r] = (counts[r] || 0) + 1;

  const tabs = await Promise.all(roles.map(async r => `
    <button class="box${filterRole === r ? ' active' : ''}" data-role="${r}">
      <span class="boxname">${esc(await label('plant_role', r))}</span>
      <span class="boxcount">${counts[r] || 0}</span>
    </button>`));

  // The same query the seasonal panel runs, from the same module. Two lists of
  // what is in season would be two lists that eventually disagree.
  const inSeason = new Set(filterMonth
    ? (await seasonOf(filterMonth, plants)).map(x => x.plant.id)
    : []);

  const shown = plants
    .filter(p => (!filterRole || (p.role || []).includes(filterRole))
              && (!favOnly || p.favorite)
              // Common name, botanical name and family: the three ways a person
              // arrives at a plant. Not the prose — a search that matched body
              // text would return half the library for "кора".
              && matches(query, text(p.nameCommon), p.nameBotanical, p.family)
              && (!filterMonth || inSeason.has(p.id)))
    .sort((a, b) => text(a.nameCommon).localeCompare(text(b.nameCommon)));

  const rows = await Promise.all(shown.map(async p => {
    const parts = (await Promise.all((p.parts || []).map(pt => label('plant_part', pt.partCode)))).join(', ');
    const roleNames = (await Promise.all((p.role || []).map(r => label('plant_role', r)))).join(', ');
    const sw = plantSwatches(p, combinations);
    return `<tr data-open="${p.id}">
      <td class="favcell">${favStar(p)}</td>
      <td>
        <div class="withthumb">
          ${photoOf(p) ? `<img class="thumb" src="${esc(photoOf(p))}" alt="" loading="lazy">` : `<span class="thumb empty"></span>`}
          <span class="namecell">
            <span class="nameline">${esc(text(p.nameCommon) || '—')}</span>
            ${p.nameBotanical ? `<i class="latinline">${esc(p.nameBotanical)}</i>` : ''}
          </span>
        </div>
      </td>
      <td class="swatchcell">${sw.some(x => x.hex)
        ? `<span class="swatchrow">${sw.map(x =>
            // A record with no measured colour reached the list for the first
            // time in rc41, and this drew `background:` with nothing after it —
            // a blank square that reads as a fault rather than as an absence.
            // The row is a glance at what a plant gives, so an unmeasured
            // record contributes its NAME to the tooltip and no square at all:
            // an empty box in a row of colours is noise.
            x.hex
              ? `<span class="miniswatch" style="background:${esc(x.hex)}" title="${esc(x.caption || '')}"></span>`
              : '').join('')}</span>`
        : ''}</td>
      <td>${esc(roleNames)}</td>
      <td>${esc(parts)}</td>
    </tr>`;
  }));

  // Four blocks, not eight columns: plant · what it gives · what for · which
  // part. The question this screen answers is "I have oak, walnut, rose and
  // eucalyptus — which do I use", and chemistry was never part of the answer.
  const table = shown.length ? `
    <table class="grid">
      <thead><tr>
        <th class="favcell"></th>
        <th>${t('plants.col.name')}</th>
        <th class="swatchcell">${t('plants.col.gives')}</th>
        <th>${t('plants.col.role')}</th>
        <th>${t('plants.col.parts')}</th>
      </tr></thead>
      <tbody>${rows.join('')}</tbody>
    </table>`
    : empty(t('plants.empty'), t('plants.emptyHint'));

  root.innerHTML = page({
    title: t('plants.title'),
    sub: t('plants.sub'),
    actions: `<button class="btn quiet" data-sync>${t('seed.sync')}</button>
              ${actionBtn('add', t('plants.new'), 'data-new', 'primary')}`,
    body: `
      <div class="boxes">
        <button class="box${filterRole === null ? ' active' : ''}" data-role="">
          <span class="boxname">${t('common.all')}</span>
          <span class="boxcount">${plants.length}</span>
        </button>
        ${tabs.join('')}
        ${favCount ? `<button class="box${favOnly ? ' active' : ''}" data-favonly>
          <span class="boxname">${t('common.favorites')}</span>
          <span class="boxcount">${favCount}</span>
        </button>` : ''}
      </div>
      ${filterMonth ? `<div class="monthfilter">
        <span class="chip">${esc(t('month.' + filterMonth))}</span>
        <span class="hint">${esc(t('season.region'))} ${esc(t('plants.monthUnrated'))}</span>
        <a class="seasonall" href="#/plants">${t('plants.monthClear')}</a>
      </div>` : ''}
      <div class="filterrow">${searchBox(query, t('plants.search'))}</div>
      ${panel(table, 'flush')}`,
  });
}

// ---------------------------------------------------------------- form view

// Which ways of getting the colour out are possible for this part (§13cc).
//
// Checkboxes and not a select, because it is a constraint and a constraint names
// a SET. Madder root is decoction, fermentation and alkaline — three real ways,
// with three different doses. A select could hold one of the three and would
// make the other two unsayable, which is the fault this replaces.
//
// Nothing ticked means NOT STATED, not „the ordinary way". The distinction is
// the whole point of the migration and is said in the hint under the row, since
// an empty row otherwise reads as an answer.
async function modeChecks(i, picked) {
  const on = new Set(picked || []);
  const modes = await vocabList('extraction_mode');
  return modes.map(m => `
    <label class="check">
      <input type="checkbox" data-partmode="${i}" value="${m.code}"
        ${on.has(m.code) ? 'checked' : ''}>
      <span>${esc(m.label)}</span>
    </label>`).join('');
}

async function partRows(p) {
  return (await Promise.all((p.parts || []).map(async (pt, i) => {
    const chem = (await Promise.all((pt.chemistry || []).map(async (c, j) => `
      <div class="chemrow">
        <select data-chem="${i}.${j}.classCode">${await options('chemistry_class', c.classCode, '—')}</select>
        <select data-chem="${i}.${j}.level">${await options('chemistry_level', c.level, t('plants.level'))}</select>
        <button class="btn quiet" data-chem-del="${i}.${j}" aria-label="×">×</button>
      </div>`))).join('');

    // `await` inside, so Promise.all rather than a plain map — the dose now
    // carries which method it is the dose FOR, and that select needs the
    // vocabulary (§13cc). Stopka gives madder root 500% by decoction and 50%
    // by alkaline extraction; without this column the record can hold one of
    // them and makes the other a thing that cannot be said.
    const dosing = (await Promise.all((pt.dosing || []).map(async (d, j) => `
      <div class="dosingrow">
        <select data-dose="${i}.${j}.condition">
          <option value=""${!d.condition ? ' selected' : ''}>${t('plants.anyCondition')}</option>
          <option value="dried"${d.condition === 'dried' ? ' selected' : ''}>${t('materials.form.dried')}</option>
          <option value="fresh"${d.condition === 'fresh' ? ' selected' : ''}>${t('materials.form.fresh')}</option>
        </select>
        <select data-dose="${i}.${j}.extractionMode">${
          await options('extraction_mode', d.extractionMode, t('plants.anyMode'))}</select>
        <input type="number" step="5" min="0" data-dose="${i}.${j}.min" value="${d.min ?? ''}" placeholder="${t('recipes.qtyMin')}">
        <input type="number" step="5" min="0" data-dose="${i}.${j}.max" value="${d.max ?? ''}" placeholder="${t('recipes.qtyMax')}">
        <span class="pct">%</span>
        <button class="btn quiet" data-dose-del="${i}.${j}" aria-label="×">×</button>
      </div>`))).join('');

    return `
      <div class="ingrow">
        <div class="ingmain">
          <select data-part="${i}.partCode">${await options('plant_part', pt.partCode, t('plants.part'))}</select>
          <select data-part="${i}.facing">${await options('facing', pt.facing, t('plants.facing'))}</select>
          <button class="btn quiet" data-part-del="${i}" aria-label="×">×</button>
        </div>

        <div class="optblock">
          <span class="optlabel">${t('plants.chemistry')}</span>
          ${chem || `<p class="hint">—</p>`}
          ${actionBtn('add', t('plants.addChem'), `data-chem-add="${i}"`, 'contextual')}
        </div>

        <div class="optblock">
          <span class="optlabel">${t('plants.dosing')}</span>
          ${dosing || `<p class="hint">—</p>`}
          <button class="btn quiet" data-dose-add="${i}">+</button>
          <p class="hint">${t('plants.dosingHint')}</p>
        </div>

        <div class="optblock">
          <span class="optlabel">${t('plants.temperatures')}</span>
          <div class="temprow modes">
            <span class="templabel">${t('plants.modes')}</span>
            ${(await modeChecks(i, pt.extractionModes))}
          </div>
          <p class="hint">${t('plants.modesHint')}</p>
          <div class="temprow">
            <span class="templabel">${t('plants.tempExtract')}</span>
            <input type="number" step="5" data-part="${i}.tempExtractC.min" value="${pt.tempExtractC?.min ?? ''}" placeholder="${t('recipes.qtyMin')}">
            <input type="number" step="5" data-part="${i}.tempExtractC.max" value="${pt.tempExtractC?.max ?? ''}" placeholder="${t('recipes.qtyMax')}">
            <label class="check"><input type="checkbox" data-partapprox="${i}.tempExtractC"
              ${pt.approx?.tempExtractC ? 'checked' : ''}>${t('common.approx')}</label>
          </div>
          <div class="temprow">
            <span class="templabel">${t('plants.tempDye')}</span>
            <input type="number" step="5" data-part="${i}.tempDyeC.min" value="${pt.tempDyeC?.min ?? ''}" placeholder="${t('recipes.qtyMin')}">
            <input type="number" step="5" data-part="${i}.tempDyeC.max" value="${pt.tempDyeC?.max ?? ''}" placeholder="${t('recipes.qtyMax')}">
            <label class="check"><input type="checkbox" data-partapprox="${i}.tempDyeC"
              ${pt.approx?.tempDyeC ? 'checked' : ''}>${t('common.approx')}</label>
          </div>
          <div class="temprow">
            <span class="templabel">${t('plants.softMaxTemp')}</span>
            <input type="number" step="5" data-part="${i}.softMaxTempC" value="${pt.softMaxTempC ?? ''}">
            <label class="check"><input type="checkbox" data-partapprox="${i}.softMaxTempC"
              ${pt.approx?.softMaxTempC ? 'checked' : ''}>${t('common.approx')}</label>
          </div>
          <p class="hint">${t('plants.softMaxTempHint')}</p>
        </div>
      </div>`;
  }))).join('') || `<p class="hint">—</p>`;
}

// What colours a plant can give, for the list. The owner said it plainly: for
// someone who dyes, this is the most important thing on the screen — and until
// now it was in the database and not on it, because the list column held
// chemistry classes instead.
//
// Two sources, in this order. A plant's own `colours` are the owner's palette,
// written by hand. Combinations are the reference knowledge — a combination IS
// an expected colour — so they fill in everything not yet written by hand, and
// keep filling in as the library grows. Derived at display time, never stored:
// there are no back-references in the data (§13.1).
//
// The detail asks the same question with more room, so it reads from the same
// function rather than from `p.colours` alone — the fault §13i names. There the
// context is worth keeping, and two combinations that land on the same hex from
// different mordants are two answers, not one; hence `distinctContext`.
export function plantColourSources(plant, combinations = [], { max = 6, distinctContext = false } = {}) {
  const out = [];
  const seen = new Set();

  // `process` and `partCode` ride along on every swatch, from whichever source
  // (§13be). A combination has carried them all along in its key; a plant's own
  // swatch gained them, because the same leaf gives yellow in a bath and almost
  // black under iron in a print, and one row of circles cannot say which is
  // which.
  const add = (hex, caption, from, combo, own) => {
    // A COMBINATION WITH NO MEASURED COLOUR IS STILL AN ANSWER (§13dh).
    //
    // This required a hex, so sixty-one records — every eco print one among
    // them — were dropped from the plant screen entirely. Dyer's chamomile has
    // three combinations and showed none of them; oak has five and showed two.
    // Their sources describe the colour in WORDS and give no figure, and the
    // words are the knowledge: „ярко до слънчево жълто" is what somebody wants
    // to read. The swatch is what is missing, not the answer.
    //
    // A plant's own swatch still needs one: `p.colours` IS a list of measured
    // colours, and an entry there with no hex is an empty row rather than a
    // record described in prose.
    if (!hex && !(combo && caption)) return;
    const process = combo ? combo.key?.processCode : own?.process;
    const partCode = combo ? combo.key?.dyeSource?.partCode : own?.partCode;
    const ctx = combo ? [combo.key?.dyeSource?.partCode, combo.key?.fibreClass,
                         combo.key?.mordantCode, combo.key?.processCode].filter(Boolean).join('/') : '';
    const key = (hex ? hex.toLowerCase() : 'unmeasured:' + (caption || '')) +
                (distinctContext ? '|' + ctx : '');
    if (seen.has(key) || out.length >= max) return;
    seen.add(key);
    out.push({ hex: hex || '', caption, from, combo, process, partCode,
               conditions: own ? text(own.conditions) : '' });
  };

  for (const c of plant.colours || [])
    add(c.hex, text(c.name) || text(c.conditions), 'own', null, c);

  for (const c of combinations) {
    if (c.key?.dyeSource?.plantId !== plant.id) continue;
    add(c.expected?.swatchHex, text(c.expected?.colourText), 'combination', c);
  }
  return out;
}

// Group the swatches by the process that produced them (§13be).
//
// Grouping happens HERE, on the way to the screen, and not in the data. The
// alternative on the table was two stored arrays, one for dyeing and one for
// eco print. That splits on one dimension and breaks at the next: discharge
// printing is already planned and belongs to neither, and a swatch from a
// pigment belongs to neither again. One array with a field is one array however
// many processes arrive, and the combined palette the list shows costs nothing
// because it is simply the array.
//
// Swatches with no process recorded are not a group of their own and are not
// dropped: they are shown first, unlabelled, exactly as they are today. Every
// one of the 48 seeded plants is in that state, and inventing a process for
// them would be stating something nobody wrote down.
export function groupSwatchesByProcess(swatches) {
  const ungrouped = swatches.filter(s => !s.process);
  const byProcess = new Map();
  for (const s of swatches) {
    if (!s.process) continue;
    if (!byProcess.has(s.process)) byProcess.set(s.process, []);
    byProcess.get(s.process).push(s);
  }
  return { ungrouped, byProcess };
}

export function plantSwatches(plant, combinations = [], max = 6) {
  return plantColourSources(plant, combinations, { max });
}

// Attribution, shown with the photograph rather than filed away (§13at).
//
// Several of these are CC BY-SA, which asks for the author to be named
// wherever the image appears — not on a credits page somewhere else. A licence
// that asks for nothing still gets its line, because a reader deciding whether
// they may reuse a picture needs to be told, and "nothing here" does not tell
// them anything.
function photoCredit(p) {
  const c = p.photoCredit;
  if (!c || !(c.author || c.licence)) return '';
  const bits = [c.author, c.licence].filter(Boolean).map(esc);
  const line = bits.join(' \u00B7 ');
  return `<figcaption class="credit">${
    c.source ? `<a href="${esc(c.source)}" target="_blank" rel="noopener">${line}</a>` : line
  }${c.taxon && c.taxon !== p.nameBotanical
      ? ` <span class="hint">${esc(c.taxon)}</span>` : ''}</figcaption>`;
}

// A swatch, in the editor. Process and part are both optional and both empty by
// default: a colour whose process nobody recorded says so by saying nothing,
// and a select that defaults to "dyeing" would put a claim on 48 records that
// no one made (§13be).
async function colourRows(p) {
  const rows = await Promise.all((p.colours || []).map(async (c, i) => `
    <div class="colourrow">
      <input type="color" data-colour="${i}.hex" value="${esc(c.hex || '#A03D3B')}" aria-label="${t('plants.colourName')}">
      <input type="text" data-colour="${i}.name" value="${esc(c.name?.bg || '')}" placeholder="${t('plants.colourName')}">
      <input type="text" data-colour="${i}.conditions" value="${esc(c.conditions?.bg || '')}" placeholder="${t('plants.colourCondPlaceholder')}">
      <select data-colour-code="${i}.process">${await options('process', c.process, t('plants.colourProcess'))}</select>
      <select data-colour-code="${i}.partCode">${await options('plant_part', c.partCode, t('plants.colourPart'))}</select>
      <button class="btn quiet" data-colour-del="${i}" aria-label="×">×</button>
    </div>`));
  return rows.join('') || `<p class="hint">—</p>`;
}

function sectionRows(p) {
  const primary = getLang();
  const other = primary === 'bg' ? 'en' : 'bg';

  return (p.sections || []).map((sec, i) => {
    const missing = !!(sec.body?.[primary] && !sec.body?.[other]);
    return `
    <div class="sectionrow">
      <div class="chainhead">
        <input type="text" class="sectitle" data-section="${i}.title.${primary}"
               value="${esc(sec.title?.[primary] || '')}" placeholder="${t('plants.sectionTitle')}">
        <button class="btn quiet" data-section-up="${i}" ${i === 0 ? 'disabled' : ''}>${t('plants.sectionUp')}</button>
        <button class="btn quiet" data-section-down="${i}">${t('plants.sectionDown')}</button>
        <button class="btn quiet" data-section-del="${i}" aria-label="×">×</button>
      </div>
      <textarea data-section="${i}.body.${primary}" rows="4" placeholder="${t('plants.sectionText')}">${esc(sec.body?.[primary] || '')}</textarea>
      <details class="pairalt"${missing ? '' : ' open'}>
        <summary>${esc(t('i18n.otherLang', { lang: other.toUpperCase() }))}${
          missing ? ` <span class="untranslated">${esc(t('i18n.missingShort'))}</span>` : ''}</summary>
        <input type="text" data-section="${i}.title.${other}" value="${esc(sec.title?.[other] || '')}" placeholder="${t('plants.sectionTitle')}">
        <textarea data-section="${i}.body.${other}" rows="4">${esc(sec.body?.[other] || '')}</textarea>
      </details>
    </div>`;
  }).join('') || `<p class="hint">—</p>`;
}

// What one wants standing in front of the bed or the pot, in the order one
// wants it: which part, how much, how hot, what to expect, what not to do.
async function useNowCard(p) {
  const rows = [];

  for (const part of p.parts || []) {
    const partName = await label('plant_part', part.partCode);
    for (const d of part.dosing || []) {
      const cond = d.condition ? await label('placement_condition', d.condition) : '';
      const amount = d.max && d.max !== d.min ? `${d.min}–${d.max}%` : `${d.min}%`;
      // Which method this dose is the dose FOR (§13cc). Named only when the
      // record says — a dose recorded without a method is not a decoction dose,
      // it is a dose nobody wrote the method down for, and labelling it would
      // invent the missing half.
      const mode = d.extractionMode ? await label('extraction_mode', d.extractionMode) : '';
      rows.push(tile('i-plant', t('plants.partAndCondition'),
        `${esc(partName)}${cond ? ', ' + esc(cond) : ''}`));
      rows.push(tile('i-wof', t('plants.dose'), nb(`${esc(amount)} WOF`), mode));
    }
  }

  // Temperatures, per part (§13az). A number somebody estimated reads as an
  // estimate, here as everywhere (§13ai).
  //
  // Repeated per part only where the parts disagree. Elder leaf and elder fruit
  // want different heat and both must be sayable; a plant whose parts all cook
  // the same says it once, because the same number under four headings reads as
  // four separate findings.
  const span = (v) => v && (v.min != null || v.max != null)
    ? (v.max != null && v.max !== v.min ? `${v.min}–${v.max}` : `${v.min ?? v.max}`) : '';

  // The same span, converted and carrying its unit (§13dc). `span` stays as it
  // is because the „does it say anything at all" test above is asked of the
  // stored value, and asking it of a formatted string would make an empty range
  // and the string '' indistinguishable.
  const spanU = (v) => (v && (v.min != null || v.max != null))
    ? tempSpan(v.min, v.max ?? v.min) : '';

  const temps = (p.parts || []).map(pt => ({
    part: pt.partCode,
    raw: pt,
    // A list now, and it is a CONSTRAINT: which ways are possible at all, not
    // which one was used (§13cc). Joined for comparison so that two parts
    // permitting the same set still count as agreeing.
    mode: (pt.extractionModes || []).join('+'),
    line: [span(pt.tempExtractC) && `${t('plants.tempExtract')} ${approxNumber(spanU(pt.tempExtractC), pt.approx?.tempExtractC)}`,
           span(pt.tempDyeC) && `${t('plants.tempDye')} ${approxNumber(spanU(pt.tempDyeC), pt.approx?.tempDyeC)}`,
           pt.softMaxTempC && `${t('plants.softMaxTemp')} ${approxNumber(tempWith(pt.softMaxTempC), pt.approx?.softMaxTempC)}`,
          ].filter(Boolean).join(' · '),
  })).filter(x => x.line || x.mode);

  const same = temps.length > 1
    && temps.every(x => x.line === temps[0].line && x.mode === temps[0].mode);

  for (const x of same ? temps.slice(0, 1) : temps) {
    const heading = same ? t('plants.temperatures')
      : `${await label('plant_part', x.part)}`;
    // Named only where the part is restricted. An unrestricted part says
    // nothing — writing „гореща отвара" on all 113 would turn „nobody has
    // stated this" into „it has been checked and only boiling works", which is
    // the claim the migration refused to make (§13cc).
    const mode = (await Promise.all((x.raw?.extractionModes || [])
      .map(m => label('extraction_mode', m)))).join(' · ');
    // Extraction and dyeing are two different heats and were on one line —
    // the prototype separates them and it is right: they are two acts, done at
    // different moments, and reading them as one sentence hides that.
    const ex = span(x.raw?.tempExtractC), dy = span(x.raw?.tempDyeC);
    rows.push(tile('i-flask', `${t('plants.tempExtract')}${same ? '' : ' · ' + esc(heading)}`,
      ex ? nb(esc(ex)) : '', mode));
    rows.push(tile('i-temp', `${t('plants.tempDye')}${same ? '' : ' · ' + esc(heading)}`,
      dy ? nb(esc(dy)) : ''));
    rows.push(tile('i-alert', t('plants.softMaxTemp'),
      x.raw?.softMaxTempC ? nb(esc(tempWith(x.raw.softMaxTempC))) : ''));
  }

  rows.push(tile('i-bath', t('plants.liquorRatio'),
    p.liquorRatio ? approxNumber(nb(`1 : ${p.liquorRatio}`), p.approx?.liquorRatio) : ''));
  rows.push(tile('i-drying', t('plants.dryingRatio'),
    p.dryingRatio ? near('dryingRatio', nb(`× ${p.dryingRatio}`)) : ''));
  rows.push(tile('i-time', t('plants.steamNote'), p.steamNote ? esc(p.steamNote) : ''));

  // Fastness used to sit under "in the garden", which was a bucket for whatever
  // was left over — it has nothing to do with the plot of ground. It is how the
  // colour will behave, so it reads here, with the temperatures and the ceiling.
  rows.push(tile('i-alum', t('plants.lightfastness'),
    p.lightfastness ? esc(await label('fastness', p.lightfastness)) : ''));
  rows.push(tile('i-drops', t('plants.washfastness'),
    p.washfastness ? esc(await label('fastness', p.washfastness)) : ''));

  // A strip of tiles rather than a fact grid (§13bs).
  //
  // These are the figures somebody standing over a pot needs, and a two-column
  // list of label-and-value makes them scan as prose. Tiled and marked, they
  // scan as instruments: which part, how much, how hot to draw it out, how hot
  // to dye, and the line not to cross.
  //
  // The order is the order of use, not the order of the record.
  return rows.length ? `<div class="usenow">${rows.join('')}</div>` : '';
}

// A figure and its unit are one thing to read, so they are one thing to wrap.
// The space between them is non-breaking: `80–90 °C` breaking after the range
// leaves a lonely `°C` on a line of its own, which reads as a second fact. The
// tile may take two lines; a number may not be split across them (§13cz).
const nb = (s) => String(s).replace(/ /g, '\u00A0');

// One figure, marked. The mark accompanies the label and never replaces it
// (§13ac): five icons in a row with no words is an instrument panel nobody can
// read the first time.
const tile = (mark, label, value, hint = '') => value ? `
  <div class="usetile">
    <span class="usehead">${mark ? icon(mark) : ''}<span class="uselabel">${esc(label)}</span></span>
    <span class="useval">${value}</span>
    ${hint ? `<span class="hint">${esc(hint)}</span>` : ''}
  </div>` : '';

// A named part of a block. Not a panel of its own: nesting panels was what made
// the two-column layout read as scattered.
const sub = (title, inner) =>
  inner ? `<section class="sub">${title ? `<h3>${esc(title)}</h3>` : ''}${inner}</section>` : '';

// Two columns inside a block, but only where the prose is short. A recipe runs
// forty lines and reads badly at half width, so *how it is used* stays single.
const subs = (list, cols = 1) => {
  const inner = list.filter(Boolean).join('');
  return inner ? `<div class="${cols === 2 ? 'subcols' : 'subone'}">${inner}</div>` : '';
};

// What each swatch was reached by. The list has no room for this; the detail
// does, and without it a row of colours says what but never how.
async function swatchContext(combo) {
  if (!combo) return '';
  const bits = [];
  const k = combo.key || {};
  if (k.dyeSource?.partCode) bits.push(await label('plant_part', k.dyeSource.partCode));
  if (k.fibreCode) bits.push(await label('fibre', k.fibreCode));
  else if (k.fibreClass) bits.push(await label('fibre_class', k.fibreClass));
  if (k.mordantCode && k.mordantCode !== 'none') {
    const band = k.mordantBand ? ` (${await label('mordant_strength', k.mordantBand)})` : '';
    bits.push((await label('mordant_type', k.mordantCode)) + band);
  }
  if (k.processCode) bits.push(await label('process', k.processCode));
  return bits.filter(Boolean).join(' · ');
}

// Safety, as a level and a set of things to do (§13.2a).
//
// The level is a code, so the colour is a rendering of it rather than the data
// itself — a colour alone cannot be read by everyone, searched, or filtered, and
// carries no label in a second language. The precautions are codes for the same
// reason, and because "wear a mask when grinding" is the form of the fact that
// changes what happens at the bench.
async function safetyBlock(p) {
  const tox = p.toxicity;
  // Records written before the level existed carry a sentence here instead.
  if (typeof tox === 'string' || (tox && !('level' in tox) && (tox.bg || tox.en)))
    return prose(tox);
  if (!tox?.level && !(tox?.precautions || []).length && !text(tox?.note)) return '';

  const marks = (await Promise.all((tox.precautions || []).map(async c =>
    `<span class="chip">${esc(await label('precaution', c))}</span>`))).join('');

  return `
    ${tox.level ? `<div class="risk ${esc(tox.level)}">
      <span class="riskdot"></span>
      <span>${esc(await label('toxicity_level', tox.level))}</span>
    </div>` : ''}
    ${marks ? `<div class="riskmarks">${marks}</div>` : ''}
    ${text(tox.note) ? prose(tox.note) : ''}
    <p class="hint">${t('plants.safetyScope')}</p>`;
}

// WHAT MOVES THE RESULT, on the plant screen (§13dh).
//
// The explanations imported at rc40 live on combination records, and a plant's
// combinations are its answers — so they belong here too. Not copied into the
// plant: read from the canonical record at render, which is why the two screens
// cannot disagree.
//
// Grouped by factor across the whole plant rather than repeated per record: „the
// mordant" said by three of oak's combinations is one thing being explained
// about oak, and three identical headings would read as three findings.
async function influencesFor(plantId, combinations) {
  const mine = combinations.filter(c => c.key?.dyeSource?.plantId === plantId);
  const byFactor = new Map();
  for (const c of mine) {
    for (const i of c.influences || []) {
      if (!byFactor.has(i.factor)) byFactor.set(i.factor, []);
      byFactor.get(i.factor).push(i);
    }
  }
  if (!byFactor.size) return '';

  const reg = new Map((await all('sources')).map(x => [x.code, x]));
  const blocks = await Promise.all([...byFactor].map(async ([factor, list]) => {
    const lines = list.map(i => {
      const src = reg.get(i.sourceCode);
      return `<div class="influence">
        <span>${esc(text(i.text))}</span>
        ${src ? `<span class="hint">${esc(text(src.name) || src.code)}</span>` : ''}
      </div>`;
    }).join('');
    return `<div class="influencegroup">
      <b>${esc(await label('influence_factor', factor))}</b>${lines}</div>`;
  }));
  return `<div class="influences">${blocks.join('')}</div>`;
}

// Everything the profile rests on: the sections that name a source, and the
// register codes the plant's combinations cite. Attribution is a condition of
// shipping (§13at), and the combination sources were reaching the Reference and
// not this screen.
async function sourcesFor(plant, combinations, sections) {
  const mine = combinations.filter(c => c.key?.dyeSource?.plantId === plant.id);
  const codes = [...new Set(mine.flatMap(c => [
    ...(c.sourceCodes || []),
    ...(c.influences || []).map(i => i.sourceCode),
  ]).filter(Boolean))];
  const reg = new Map((await all('sources')).map(x => [x.code, x]));
  const names = codes.map(c => {
    const src = reg.get(c);
    if (!src) return '';
    const name = esc(text(src.name) || src.code);
    return src.url ? `<a href="${esc(src.url)}" target="_blank" rel="noopener">${name}</a>` : name;
  }).filter(Boolean);

  const written = sections.map(sec =>
    `<span class="sourcelabel">${esc(text(sec.title))}</span> ${esc(text(sec.body))}`);

  if (!names.length && !written.length) return '';
  // Headed, because an unlabelled row of names at the foot of a page reads as
  // a footer rather than as provenance — and provenance is the condition of
  // giving the library away (§13at).
  return `<div class="sourcenote">
    <h2>${t('ref.sources')}</h2>
    ${written.join('<br>')}
    ${names.length ? `<div class="hint">${names.join(' · ')}</div>` : ''}
  </div>`;
}

async function renderRead(root, p) {
  // The list derives its swatches from the plant and from the combinations
  // both; reading only `p.colours` here is what made every seeded record open
  // with an empty colour section (§13i).
  const combinations = await all('combinations');

  const roles = (await Promise.all((p.role || []).map(x => label('plant_role', x)))).join(', ');
  // A role that carries knowledge in the word says what it means, once, under
  // the fact rather than in a help page nobody opens (§13aw).
  const roleNotes = (await Promise.all((p.role || [])
    .map(x => describe('plant_role', x)))).filter(Boolean);
  const comp = (await Promise.all((p.compositionalRole || []).map(x => label('compositional_role', x)))).join(', ');

  const sources = plantColourSources(p, combinations, { max: 24, distinctContext: true });

  const swatchCard = async (s) => {
    // A combination says fibre and mordant as well, so it keeps its fuller
    // line. A plant's own swatch says the part it came from and the conditions
    // it was written under — elder leaf and elder fruit are not the same
    // answer, and "with iron salts" is what makes a grey legible.
    // A swatch's own temperature, read from the part it came from (§13bs).
    //
    // Derived, never stored: the heat belongs to the part, and copying it onto
    // the swatch would let the two drift. It is shown because a colour without
    // its temperature is not usable — "red, root" leaves you to scroll for the
    // number, and madder above 60 °C is not red at all.
    const partTemp = (() => {
      if (s.combo || !s.partCode) return '';
      const pt = (p.parts || []).find(x => x.partCode === s.partCode);
      const v = pt?.tempDyeC;
      if (!v || (v.min == null && v.max == null)) return '';
      // Converted for display, canonical in storage (§13dc). tempSpan writes
      // the unit once and joins with a non-breaking space, so a range never
      // breaks across a line (§13cz).
      return tempSpan(v.min, v.max ?? v.min);
    })();

    const ctx = s.combo
      ? await swatchContext(s.combo)
      : [s.partCode ? await label('plant_part', s.partCode) : '', s.conditions, partTemp]
          .filter(Boolean).join(' · ');
    return `
    <div class="refcard" style="cursor:default">
      ${s.hex
        ? `<div class="refswatch" style="background:${esc(s.hex)}"></div>`
        : `<div class="refswatch unmeasured" title="${esc(t('ref.noSwatch'))}"></div>`}
      <div class="refbody">
        <b>${esc(s.caption || '—')}</b>
        ${ctx ? `<div class="hint">${esc(ctx)}</div>` : ''}
      </div>
    </div>`;
  };

  const { ungrouped, byProcess } = groupSwatchesByProcess(sources);
  const cardsOf = async (list) =>
    `<div class="colourcards">${(await Promise.all(list.map(swatchCard))).join('')}</div>`;

  // The unlabelled ones first and without a heading, so a plant whose swatches
  // predate the split reads exactly as it did before. Headings appear only when
  // there is more than one thing to tell apart.
  const groupBlocks = [];
  if (ungrouped.length) groupBlocks.push(await cardsOf(ungrouped));
  for (const [code, list] of byProcess)
    groupBlocks.push(sub(await label('process', code), await cardsOf(list)));
  const colours = groupBlocks.join('');

  // How much of a constituent there is, as a quantity rather than as a word
  // (§13bh). "Trace", "moderate", "high" and "dominant" all take the same room
  // and read at the same weight, so a list of them has to be read one line at a
  // time; four segments out of four is read at a glance. The word stays beside
  // the bar — a mark accompanies a label and never replaces it.
  const LEVELS = ['trace', 'moderate', 'high', 'dominant'];
  const chem = (await Promise.all((p.parts || []).map(async part => {
    const items = (await Promise.all((part.chemistry || []).map(async c => {
      const name = esc(await label('chemistry_class', c.classCode));
      // Three states, not two. A blank level used to render as bare text, which
      // read as "there is nothing more to say here" — and it meant two quite
      // different things: nobody has recorded a strength yet, or no honest
      // quantitative estimate exists at all, because the plant is strongly
      // seasonal or cultivar-dependent (§13bu). The second is a finding and
      // should look like one; only it is marked, and only it says so.
      if (c.levelUnknown) {
        return `<span class="chemline">${name}<span class="hint">${
          t('plants.levelUnknown')}</span></span>`;
      }
      if (!c.level) return `<span class="chemline">${name}</span>`;
      const n = LEVELS.indexOf(c.level) + 1;
      return `<span class="chemline">${name}${
        levelBar(n, LEVELS.length, await label('chemistry_level', c.level))}</span>`;
    }))).join('');
    return items ? fact(await label('plant_part', part.partCode), items) : '';
  }))).join('');

  // Gathering months live on the PART (§13ce) and the plant-level field is
  // retired (§13cn). The record shows them per part, because that is the answer:
  // the leaf and the bark of one tree are not gathered in the same weeks, and
  // one line for the whole plant could only ever be one of them.
  const partMonths = (await Promise.all((p.parts || []).map(async pt => {
    const name = await label('plant_part', pt.partCode);
    if (pt.sourcedNotGathered) return fact(esc(name), esc(t('plants.notGathered')));
    const when = (pt.harvestMonths || []).map(i => MONTHS_BG[i - 1]).join(' · ');
    return when ? fact(esc(name), esc(when)) : '';
  }))).filter(Boolean).join('');
  const grouped = groupSections(p.sections || []);
  const asSubs = (list) => list.map(sec => sub(text(sec.title), prose(sec.body)));
  const useNow = await useNowCard(p);

  // Six blocks in one column, because the order is the meaning: what is this,
  // what does it give me, how do I use it, why does it work, when do I gather
  // it, what else is written down. Cautions sit beside the use rather than at
  // the end — a warning read after the pot is on is a warning too late.
  const blocks = [
    // The plant as a plant, before it is a dye (§13ce). First, because it is
    // what a reference book opens with and because everything under it assumes
    // you know what you are looking at.
    //
    // Deliberately NOT headed. A heading over two sentences of orientation
    // makes them look like a section to be skipped, and this is the paragraph
    // that should simply be read. It is also why it is a field rather than a
    // section: what must be present on every plant is a field.
    p.description && text(p.description)
      ? `<div class="plantintro">${prose(p.description)}</div>` : '',

    // Only when there is something to show. Forty-five of the fifty seeded
    // plants have no recorded colour yet (§13h), and a block headed "what it
    // gives" holding nothing but "moderate lightfastness" answers a question
    // nobody asked. When it is empty it is absent, exactly as the list column
    // is blank for the same plants.
    readBlock(t('plants.read.gives'), colours),

    // The figures first, then how it behaves. The text leans on the numbers —
    // "must not pass the ceiling" means nothing until the ceiling is on screen —
    // so it reads under them rather than above.
    readBlock(t('plants.read.howUsed'),
      // `character` retired in rc18 (§13cg): „Как се държи" is a section and the
      // section renders it, so reading the field here would have shown the
      // heading twice on every record that had both.
      [useNow, subs(asSubs(grouped.use))].filter(Boolean).join('')),

    readBlock(t('plants.readCareful'), await safetyBlock(p)),

    readBlock(t('plants.read.why'),
      [chem, subs(asSubs(grouped.why))].filter(Boolean).join('')),

    // Beside „why it works" and not inside it: the chemistry says why the plant
    // gives colour at all, and this says what makes that colour move.
    readBlock(t('ref.influences'), await influencesFor(p.id, combinations)),

    readBlock(t('plants.read.gathering'),
      [facts([
        partMonths,
        fact(t('plants.yearsToMaturity'), p.yearsToMaturity),
        p.invasive ? fact(t('plants.invasive'), '⚠') : '',
      ]), subs(asSubs(grouped.grow), 2)].filter(Boolean).join('')),

    readBlock(t('plants.read.more'), subs(asSubs(grouped.more), 2)),
  ].filter(Boolean);

  // Attribution is not a section among sections: it says where the whole
  // profile came from, and §"Sources and authorship" requires it be visible.
  const sourceNote = await sourcesFor(p, combinations, grouped.sources);

  root.innerHTML = page({
    title: text(p.nameCommon) || t('plants.one'),
    sub: p.nameBotanical,
    actions: `${backTo('#/plants', t('nav.plants'))}
              ${actionBtn('edit', t('common.edit'), 'data-edit', 'primary')}`,
    body: `
      <div class="headline">
        ${photoOf(p) ? `
          <figure class="plantshot">
            <img src="${esc(photoOf(p))}" alt="" loading="lazy">
            ${photoCredit(p)}
          </figure>` : ''}
        <div class="headlinebody">
          <h2>${esc(text(p.nameCommon) || '—')} ${favStar(p, true)}</h2>
          <div class="latin">${esc(p.nameBotanical || '')}${p.family ? ' · ' + esc(p.family) : ''}</div>
          ${facts([
            fact(t('plants.role'), esc(roles),
                 roleNotes.join(' ')),
            fact(t('plants.compositional'), esc(comp)),
            fact(t('plants.plantType'), esc(await label('plant_type', p.plantType))),
            fact(t('plants.habitat'), esc((await Promise.all((p.habitat || [])
              .map(h => label('habitat', h)))).join(' · '))),
            fact(t('plants.dyeClass'), esc(await label('dye_class', p.dyeClass))),
          ])}
        </div>
      </div>

      <div class="readblocks">
        ${blocks.join('') || `<p class="hint">${t('read.noData')}</p>`}
      </div>
      ${sourceNote}`,
  });
}

async function renderForm(root, p) {
  const isNew = openId === 'new';

  const compChecks = (await Promise.all(['shape_printer', 'filler', 'resist'].map(async c => `
    <label class="check"><input type="checkbox" data-multi="compositionalRole" value="${c}"
      ${(p.compositionalRole || []).includes(c) ? 'checked' : ''}>
      ${esc(await label('compositional_role', c))}</label>`))).join('');

  const roleChecks = (await Promise.all(['dye', 'ecoprint', 'mordant_accumulator'].map(async r => `
    <label class="check"><input type="checkbox" data-multi="role" value="${r}"
      ${(p.role || []).includes(r) ? 'checked' : ''}>
      ${esc(await label('plant_role', r))}</label>`))).join('');

  const habitatChecks = (await Promise.all(['wild', 'garden', 'imported'].map(async h => `
    <label class="check"><input type="checkbox" data-multi="habitat" value="${h}"
      ${(p.habitat || []).includes(h) ? 'checked' : ''}>
      ${esc(await label('habitat', h))}</label>`))).join('');

  root.innerHTML = page({
    title: isNew ? t('plants.new') : (text(p.nameCommon) || t('plants.one')),
    sub: isNew ? t('plants.emptyHint') : (p.nameBotanical || ''),
    actions: `${backTo('#/plants', t('nav.plants'))}
              <button class="btn primary" data-save>${t('common.save')}</button>`,
    body: `
      <div class="cols">
        <div class="col">
          ${panel(`
            <h2>${t('plants.identity')}</h2>
            <div class="photobox">
              ${photoOf(p) ? `<img class="plantphoto" src="${esc(photoOf(p))}" alt="">` : ''}
              ${p.photoData
                ? `<button class="btn quiet" data-photo-del>${t('plants.removePhoto')}</button>
                   <p class="hint">${t('plants.photoOwn')}</p>`
                : `<label class="btn quiet" for="plantphoto">${
                     p.photoSrc ? t('plants.replacePhoto') : t('plants.addPhoto')}</label>${
                     p.photoSrc ? `<p class="hint">${t('plants.photoShipped')}</p>` : ''}`}
              <input type="file" id="plantphoto" accept="image/*" hidden>
              <p class="hint">${t('plants.photoHint')}</p>
            </div>
            ${pairField(t('plants.nameCommon'), 'nameCommon', p.nameCommon)}
            ${field(t('plants.nameBotanical'), `<input type="text" data-f="nameBotanical" value="${esc(p.nameBotanical || '')}" placeholder="Rubia tinctorum">`)}
            ${field(t('plants.family'), `<input type="text" data-f="family" value="${esc(p.family || '')}">`)}
            ${fieldGroup(t('plants.role'), `<div class="checks">${roleChecks}</div>`)}
            ${await confField(t('plants.compositional'), `<div class="checks">${compChecks}</div>`, 'compositionalRole', p.confidence?.compositionalRole, t('plants.compositionalHint'))}
            ${field(t('plants.dyeClass'), `<select data-f="dyeClass">${await options('dye_class', p.dyeClass)}</select>`, t('plants.dyeClassHint'))}
            ${field(t('plants.plantType'), `<select data-f="plantType">${await options('plant_type', p.plantType)}</select>`)}
            ${fieldGroup(t('plants.habitat'), `<div class="checks">${habitatChecks}</div>`)}
          `)}

          ${panel(`
            <h2>${t('plants.parts')}</h2>
            <p class="note">${t('plants.partsHint')}</p>
            <div class="partlist">${await partRows(p)}</div>
            ${actionBtn('add', t('plants.addPart'), 'data-part-add', 'contextual')}
          `)}

          ${panel(`
            <h2>${t('plants.colours')}</h2>
            <p class="note">${t('plants.coloursHint')}</p>
            <div class="colourlist">${colourRows(p)}</div>
            ${actionBtn('add', t('plants.addColour'), 'data-colour-add', 'contextual')}
          `)}
        </div>

        <div class="col">
          ${panel(`
            <h2>${t('plants.working')}</h2>
            <p class="hint">${t('plants.confidenceHint')}</p>
            <div class="rangerow">
              ${await confField(t('plants.liquorRatio'), `<input type="number" step="1" min="0" data-f="liquorRatio" value="${p.liquorRatio ?? ''}">`,
              'liquorRatio', p.confidence?.liquorRatio, t('plants.liquorRatioHint'), !!p.approx?.liquorRatio)}
            ${await confField(t('plants.dryingRatio'), `<input type="number" step="0.5" min="0" data-f="dryingRatio" value="${p.dryingRatio ?? ''}">`,
              'dryingRatio', p.confidence?.dryingRatio, t('plants.dryingRatioHint'), !!p.approx?.dryingRatio)}
            ${field(t('plants.steamNote'), `<input type="text" data-f="steamNote" value="${esc(p.steamNote || '')}">`)}
            ${field(t('plants.yearsToMaturity'), `<input type="number" step="1" min="0" data-f="yearsToMaturity" value="${p.yearsToMaturity ?? ''}">`, t('plants.yearsHint'))}
            ${await confField(t('plants.lightfastness'), await segmented('fastness', 'lightfastness', p.lightfastness, { allowEmpty: false }), 'lightfastness', p.confidence?.lightfastness)}
            ${await confField(t('plants.washfastness'), await segmented('fastness', 'washfastness', p.washfastness, { allowEmpty: false }), 'washfastness', p.confidence?.washfastness)}
            <label class="check"><input type="checkbox" data-f-bool="invasive" ${p.invasive ? 'checked' : ''}>
              ${t('plants.invasive')}</label>
            ${pairField(t('plants.toxicity'), 'toxicity', p.toxicity, { multiline: true })}
          `)}

          ${panel(`
            <h2>${t('plants.description')}</h2>
            <p class="note">${t('plants.descriptionHint')}</p>
            ${pairField('', 'description', p.description, { multiline: true })}
          `)}

          ${panel(`
            <h2>${t('plants.sections')}</h2>
            <p class="note">${t('plants.sectionsHint')}</p>
            <div class="sectionlist">${sectionRows(p)}</div>
            <div class="btnrow">
              ${actionBtn('add', t('plants.addSection'), 'data-section-add', 'contextual')}
              ${!(p.sections || []).length ? `<select data-section-suggest>
                <option value="">${t('plants.sectionTitle')}…</option>
                ${SUGGESTED.map((sug, i) => `<option value="${i}">${esc(sug[getLang()])}</option>`).join('')}
              </select>` : ''}
            </div>
          `)}

          ${!isNew ? panel(`${actionBtn('delete', t('plants.delete'), 'data-delete', 'destructive')}`) : ''}
        </div>
      </div>`,
  });
}

// ------------------------------------------------------------------ wiring

function readForm(root) {
  for (const el of root.querySelectorAll('[data-f]')) {
    // A radio group renders one element per option, all carrying the same
    // `data-f`. Reading them all meant the LAST option always won, whichever
    // was actually chosen — segmented controls have been silently wrong.
    if (el.type === 'radio' && !el.checked) continue;
    const path = el.dataset.f.split('.');
    let target = draft;
    for (let i = 0; i < path.length - 1; i++) {
      target[path[i]] = target[path[i]] || {};
      target = target[path[i]];
    }
    let value = el.value;
    if (el.type === 'number') value = value === '' ? null : Number(value);
    target[path[path.length - 1]] = value;
  }
  for (const el of root.querySelectorAll('[data-f-bool]')) draft[el.dataset.fBool] = el.checked;

  draft.role = [];
  for (const el of root.querySelectorAll('[data-multi="role"]')) if (el.checked) draft.role.push(el.value);
  draft.habitat = [];
  for (const el of root.querySelectorAll('[data-multi="habitat"]')) if (el.checked) draft.habitat.push(el.value);
  draft.compositionalRole = [];
  for (const el of root.querySelectorAll('[data-multi="compositionalRole"]')) {
    if (el.checked) draft.compositionalRole.push(el.value);
  }


  // parts, with their chemistry and dosing nested inside
  const parts = draft.parts || [];
  for (const el of root.querySelectorAll('[data-part]')) {
    const [i, key, sub] = el.dataset.part.split('.');
    const part = parts[Number(i)] = parts[Number(i)] || { id: uid(), chemistry: [], dosing: [] };
    // `tempExtractC.min` — a range is two inputs on one field (§13az). A number
    // left blank is null and not zero: nobody dyes at nought degrees, and an
    // empty box means nothing has been said.
    const value = el.type === 'number' ? (el.value === '' ? null : Number(el.value)) : el.value;
    if (sub) {
      part[key] = { ...(part[key] || {}), [sub]: value };
    } else {
      part[key] = value;
    }
  }
  // The estimate marks belong to the part whose numbers they describe.
  for (const el of root.querySelectorAll('[data-partapprox]')) {
    const [i, key] = el.dataset.partapprox.split('.');
    const part = parts[Number(i)];
    if (!part) continue;
    part.approx = { ...(part.approx || {}), [key]: el.checked };
  }

  // The permitted extraction methods (§13cc). Collected per part rather than
  // pushed as each box is read, so that a part with nothing ticked ends as
  // `null` — NOT STATED — instead of `[]`, which would claim that no method is
  // possible. The two are different statements and only one of them is ever
  // true, so `[]` is never written.
  //
  // Every part that HAS a checkbox row is visited, including the ones where
  // nothing is ticked. Reading only the ticked boxes would leave a part that
  // had its last method unticked still carrying the old list, and the removal
  // would silently not happen.
  {
    const picked = new Map();
    for (const el of root.querySelectorAll('[data-partmode]')) {
      const i = Number(el.dataset.partmode);
      if (!picked.has(i)) picked.set(i, []);
      if (el.checked) picked.get(i).push(el.value);
    }
    for (const [i, list] of picked) {
      const part = parts[i];
      if (!part) continue;
      part.extractionModes = list.length ? list : null;
    }
  }
  for (const el of root.querySelectorAll('[data-chem]')) {
    const [i, j, key] = el.dataset.chem.split('.');
    const part = parts[Number(i)];
    if (!part) continue;
    part.chemistry[Number(j)] = part.chemistry[Number(j)] || { id: uid() };
    part.chemistry[Number(j)][key] = el.value;
  }
  for (const el of root.querySelectorAll('[data-dose]')) {
    const [i, j, key] = el.dataset.dose.split('.');
    const part = parts[Number(i)];
    if (!part) continue;
    part.dosing[Number(j)] = part.dosing[Number(j)] || { id: uid() };
    part.dosing[Number(j)][key] = el.type === 'number'
      ? (el.value === '' ? null : Number(el.value)) : el.value;
  }
  draft.parts = parts.filter(Boolean);

  const colours = [];
  // Fields the editor does not show are carried rather than re-read, so a save
  // does not quietly drop the source and the confidence the seed wrote (§13e).
  const swatch = (idx) => (colours[idx] = colours[idx] || {
    id: draft.colours?.[idx]?.id || uid(),
    source: draft.colours?.[idx]?.source,
    confidence: draft.colours?.[idx]?.confidence,
  });
  for (const el of root.querySelectorAll('[data-colour]')) {
    const [i, key] = el.dataset.colour.split('.');
    const c = swatch(Number(i));
    if (key === 'hex') c.hex = el.value;
    else c[key] = { bg: el.value, en: draft.colours?.[Number(i)]?.[key]?.en || '' };
  }
  // Codes, not prose. Empty stays empty: a select defaulting to "dyeing" would
  // put a claim on 48 records that nobody made (§13be).
  for (const el of root.querySelectorAll('[data-colour-code]')) {
    const [i, key] = el.dataset.colourCode.split('.');
    const c = swatch(Number(i));
    if (el.value) c[key] = el.value; else delete c[key];
  }
  draft.colours = colours.filter(Boolean);

  const sections = [];
  for (const el of root.querySelectorAll('[data-section]')) {
    const [i, group, langCode] = el.dataset.section.split('.');
    const idx = Number(i);
    sections[idx] = sections[idx] || {
      id: draft.sections?.[idx]?.id || uid(), order: idx, title: {}, body: {},
    };
    sections[idx][group][langCode] = el.value;
  }
  draft.sections = sections.filter(Boolean);

  readPairs(root, draft);
  draft.confidence = readConfidence(root);
  draft.approx = readApprox(root);
}

export default {
  id: 'plants',
  title: () => t('plants.title'),
  sub: () => t('plants.sub'),

  // The address decides what is on screen (§13q). Called on every route change,
  // with nothing when the address names no record, which is how the list comes
  // back.
  //
  //   #/plants               the list
  //   #/plants/new           a new plant
  //   #/plants/<id>          the record
  //   #/plants/<id>/edit     editing it
  //
  // Editing is in the address rather than in a variable because it is a
  // different screen: leaving the editor with the back button should reach the
  // record, and a reload in the middle of an edit should not silently drop into
  // the read view.
  // The month filter travels in the address rather than in a variable, so
  // „Виж всички“ from the seasonal panel is bookmarkable, survives a reload and
  // comes back correctly with the browser's back button. A hidden hand-off
  // would break all three (§13q).
  takesQuery: true,

  // NOT read by position. The router calls `open(...args, query)` and `args` is
  // whatever the address happened to carry — none for `#/plants`, one for
  // `#/plants/<id>`, two for `.../edit`. Declaring `open(first, second, q)` puts
  // the query into `first` on the bare address, so `openId` became a
  // URLSearchParams and the database was handed an object for a key. It failed
  // loudly, which was luck: had `openId` been merely wrong rather than
  // unusable, the list would have shown an empty record with no error at all.
  open(...rest) {
    const q = rest[rest.length - 1] instanceof URLSearchParams
      ? rest.pop() : null;
    const [first, second] = rest;

    draft = null;
    seedUI.close();
    openId = first || null;
    editing = first === 'new' || second === 'edit';

    const m = Number(q?.get('month'));
    filterMonth = Number.isInteger(m) && m >= 1 && m <= 12 ? m : null;
  },

  // Choosing a module in the navigation means "take me to this module", not
  // "show me whatever I last had open in it". Called by the router on entry.
  reset() {
    seedUI.close();
    editing = false;
    openId = null;
    draft = null;
    filterRole = null;
    filterMonth = null;
    // Leaving the module and coming back must not leave a filter silently on:
    // the list would look short for no visible reason. The same rule holds for
    // the search text, which is why it is cleared here too (§13g).
    query = '';
    favOnly = false;
  },

  async render(root) {
    if (openId) {
      if (!draft || (openId !== 'new' && draft.id !== openId)) {
        draft = openId === 'new' ? blank() : structuredClone(await get('plants', openId));
      }
      // An address naming a record that is gone — a bookmark to something
      // deleted, or the back button after deleting it. Drawing it throws, and a
      // thrown render leaves the previous screen in place, which reads as the
      // address being ignored (§11b). The list is the honest answer.
      if (!draft) return navigate('#/plants');
      if (editing || openId === 'new') await renderForm(root, draft);
      else await renderRead(root, draft);
    } else {
      draft = null;
      await renderList(root);
    }

    const redraw = () => renderForm(root, draft);

    // Stored inline on the record, resized first: a reference photo needs to be
    // recognisable, not archival, and full-size images would bloat the backup.
    const fileInput = root.querySelector('#plantphoto');
    if (fileInput) fileInput.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      readForm(root);
      draft.photoData = await shrink(file, 480);
      redraw();
    };

    root.onclick = async (e) => {
      // Checked before [data-open], because the star sits inside the row that
      // opens the record — otherwise every star press would also navigate.
      const fav = e.target.closest('[data-fav]');
      if (fav) {
        e.stopPropagation();
        await toggleFavorite('plants', fav.dataset.fav);
        if (draft && draft.id === fav.dataset.fav) draft.favorite = !draft.favorite;
        return this.render(root);
      }

      if (e.target.closest('[data-favonly]')) { favOnly = !favOnly; return this.render(root); }

      if (e.target.closest('[data-sync]')) {
        try {
          await seedUI.open('plants');
          return seedUI.render(root, () => this.render(root));
        } catch (err) { alert(err.message); }
        return;
      }

      const role = e.target.closest('[data-role]');
      if (role) { filterRole = role.dataset.role || null; return this.render(root); }
      if (e.target.closest('[data-searchclear]')) { query = ''; return this.render(root); }
      if (e.target.closest('[data-new]')) return navigate('#/plants/new');
      if (e.target.closest('[data-edit]')) return navigate(`#/plants/${openId}/edit`);
      const row = e.target.closest('[data-open]');
      if (row) return navigate(`#/plants/${row.dataset.open}`);
      if (e.target.closest('[data-back]')) {
        // Back from the editor returns to reading the same record, not to the
        // list: one usually edits a field, checks how it reads, edits again.
        if (editing && openId !== 'new') return navigate(`#/plants/${openId}`);
        return navigate('#/plants');
      }

      if (e.target.closest('[data-part-add]')) {
        readForm(root);
        draft.parts.push({ id: uid(), partCode: '', facing: '', chemistry: [], dosing: [],
                           extractionModes: null, tempExtractC: { min: null, max: null },
                           tempDyeC: { min: null, max: null }, softMaxTempC: null,
                           approx: {}, confidence: {} });
        return redraw();
      }
      const pdel = e.target.closest('[data-part-del]');
      if (pdel) { readForm(root); draft.parts.splice(Number(pdel.dataset.partDel), 1); return redraw(); }

      const cadd = e.target.closest('[data-chem-add]');
      if (cadd) {
        readForm(root);
        draft.parts[Number(cadd.dataset.chemAdd)].chemistry.push({ id: uid(), classCode: '', level: '' });
        return redraw();
      }
      const cdel = e.target.closest('[data-chem-del]');
      if (cdel) {
        readForm(root);
        const [i, j] = cdel.dataset.chemDel.split('.').map(Number);
        draft.parts[i].chemistry.splice(j, 1);
        return redraw();
      }

      const dadd = e.target.closest('[data-dose-add]');
      if (dadd) {
        readForm(root);
        draft.parts[Number(dadd.dataset.doseAdd)].dosing.push({ id: uid(), condition: 'dried', extractionMode: null, min: null, max: null });
        return redraw();
      }
      const ddel = e.target.closest('[data-dose-del]');
      if (ddel) {
        readForm(root);
        const [i, j] = ddel.dataset.doseDel.split('.').map(Number);
        draft.parts[i].dosing.splice(j, 1);
        return redraw();
      }

      if (e.target.closest('[data-colour-add]')) {
        readForm(root);
        draft.colours.push({ id: uid(), hex: '#A03D3B', name: { bg: '', en: '' }, conditions: { bg: '', en: '' } });
        return redraw();
      }
      const coldel = e.target.closest('[data-colour-del]');
      if (coldel) { readForm(root); draft.colours.splice(Number(coldel.dataset.colourDel), 1); return redraw(); }

      if (e.target.closest('[data-section-add]')) {
        readForm(root);
        draft.sections.push({ id: uid(), order: draft.sections.length, title: { bg: '', en: '' }, body: { bg: '', en: '' } });
        return redraw();
      }
      const sdel = e.target.closest('[data-section-del]');
      if (sdel) { readForm(root); draft.sections.splice(Number(sdel.dataset.sectionDel), 1); return redraw(); }
      const sup = e.target.closest('[data-section-up]');
      if (sup) {
        readForm(root);
        const i = Number(sup.dataset.sectionUp);
        if (i > 0) [draft.sections[i - 1], draft.sections[i]] = [draft.sections[i], draft.sections[i - 1]];
        return redraw();
      }
      const sdown = e.target.closest('[data-section-down]');
      if (sdown) {
        readForm(root);
        const i = Number(sdown.dataset.sectionDown);
        if (i < draft.sections.length - 1) [draft.sections[i + 1], draft.sections[i]] = [draft.sections[i], draft.sections[i + 1]];
        return redraw();
      }

      if (e.target.closest('[data-photo-del]')) {
        readForm(root);
        draft.photoData = null;
        return redraw();
      }

      if (e.target.closest('[data-save]')) {
        readForm(root);
        await put('plants', markEdited(draft));
        // The put succeeded, so the work is saved and the address change that
        // follows is not a departure. `dirty.js` cannot tell the two apart from
        // outside — it infers a successful save by watching the form leave the
        // screen — but in here the answer is known (§13ad).
        markClean();
        // Saving lands on the record just written, not back in the list: the
        // reason to save is usually to see how it reads.
        return navigate(`#/plants/${draft.id}`);
      }
      if (e.target.closest('[data-delete]')) {
        // Guarded (§13cq): a record the history points at is refused, with a
        // count of what points at it. No cascade — see refs.js.
        if (!await deleteGuarded('plants', draft.id, t('plants.confirmDelete'))) return;
        return navigate('#/plants');
      }
    };

    // Typing redraws as you go. `input` rather than `change`, or the list would
    // only catch up when the box lost focus.
    root.oninput = (e) => {
      if (e.target.dataset.search === undefined) return;
      query = e.target.value;
      const at = e.target.selectionStart;
      this.render(root).then(() => {
        const box = root.querySelector('[data-search]');
        if (box) { box.focus(); box.setSelectionRange(at, at); }
      });
    };

    root.onchange = async (e) => {
      if (e.target.dataset.conf) {
        readForm(root);
        return redraw();
      }

      // Offering the shape of a profile is a nudge, not a schema: every
      // heading is editable and none is required.
      if (e.target.matches('[data-section-suggest]') && e.target.value !== '') {
        readForm(root);
        const sug = SUGGESTED[Number(e.target.value)];
        draft.sections.push({ id: uid(), order: draft.sections.length, title: { ...sug }, body: { bg: '', en: '' } });
        return redraw();
      }
    };
  },
};

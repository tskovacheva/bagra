// modules/plants.js — the reference library's backbone (§4, §13.2).
//
// Structured where the reference engine needs to query — chemistry levels,
// dosing, temperature ceilings, compositional role — and free-form where the
// knowledge is prose. Ten fixed textareas per plant would make entry a chore;
// a book-like list of sections lets each plant say what it has to say.

import { all, get, put, remove, newRecord, toggleFavorite, uid } from '../db.js';
import { markEdited } from '../seed.js';
import * as seedUI from '../seed-ui.js';
import { t, text, getLang } from '../i18n.js';
import { page, panel, field, options, label, favStar, esc, empty, pairField, readPairs, segmented,
         confField, readConfidence, fact, facts, prose, readBlock } from '../ui.js';

const MONTHS_BG = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

// Offered when a plant has no sections yet — the shape of a profile, taken
// from how the owner's own guide is organised. Every one is optional.
const SUGGESTED = [
  { bg: 'Идентификация', en: 'Identification' },
  { bg: 'Разпространение и традиция', en: 'Distribution and tradition' },
  { bg: 'Отглеждане', en: 'Cultivation' },
  { bg: 'Размножаване', en: 'Propagation' },
  { bg: 'Грижи и поддръжка', en: 'Care' },
  { bg: 'Вредители и болести', en: 'Pests and diseases' },
  { bg: 'Беритба и обработка', en: 'Harvest and processing' },
  { bg: 'Багрилни качества', en: 'Dye qualities' },
];

let openId = null;
let draft = null;
let filterRole = null;
let filterAvail = null;
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
  use: ['багрилни качества', 'рецепта', 'дозиране', 'еко принт', 'използвани части', 'части',
        'за тези числа', 'температура', 'работа с него', 'върху кои влакна', 'устойчивост',
        'като източник на танин', 'танин и еко принт', 'плодовете отделно',
        'dye qualities', 'recipe', 'dosing', 'eco print', 'parts used', 'parts',
        'about these figures', 'temperature', 'working with it', 'on which fibres',
        'fastness', 'as a tannin source'],
  why: ['багрилна съставка', 'багрилни съставки', 'dye constituent', 'dye constituents'],
  grow: ['агротехника', 'отглеждане', 'размножаване', 'грижи и поддръжка', 'грижи',
         'вредители и болести', 'беритба и обработка', 'беритба', 'сезон',
         'cultivation', 'growing', 'propagation', 'care', 'pests and diseases',
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
    family: '',
    role: [],
    compositionalRole: [],
    dyeClass: '',
    availability: '',
    parts: [],
    tempExtractC: { min: null, max: null },
    tempDyeC: { min: null, max: null },
    softMaxTempC: null,
    confidence: {},
    dryingRatio: null,
    liquorRatio: null,
    steamNote: '',
    harvestMonths: [],
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

  // Availability was a standing column; it answers a sourcing question, not a
  // choosing one (§13i). As a filter it earns its place — "what can I go and
  // pick today" is a real question and the column could not answer it.
  const availCounts = {};
  for (const p of plants) if (p.availability) availCounts[p.availability] = (availCounts[p.availability] || 0) + 1;
  const availCodes = Object.keys(availCounts).sort();
  const availTabs = await Promise.all(availCodes.map(async a => `
    <button class="box${filterAvail === a ? ' active' : ''}" data-avail="${esc(a)}">
      <span class="boxname">${esc(await label('availability', a))}</span>
      <span class="boxcount">${availCounts[a]}</span>
    </button>`));

  const shown = plants
    .filter(p => (!filterRole || (p.role || []).includes(filterRole))
              && (!filterAvail || p.availability === filterAvail)
              && (!favOnly || p.favorite))
    .sort((a, b) => text(a.nameCommon).localeCompare(text(b.nameCommon)));

  const rows = await Promise.all(shown.map(async p => {
    const parts = (await Promise.all((p.parts || []).map(pt => label('plant_part', pt.partCode)))).join(', ');
    const roleNames = (await Promise.all((p.role || []).map(r => label('plant_role', r)))).join(', ');
    const sw = plantSwatches(p, combinations);
    return `<tr data-open="${p.id}">
      <td class="favcell">${favStar(p)}</td>
      <td>
        <div class="withthumb">
          ${p.photoData ? `<img class="thumb" src="${p.photoData}" alt="">` : `<span class="thumb empty"></span>`}
          <span class="namecell">
            <span class="nameline">${esc(text(p.nameCommon) || '—')}</span>
            ${p.nameBotanical ? `<i class="latinline">${esc(p.nameBotanical)}</i>` : ''}
          </span>
        </div>
      </td>
      <td class="swatchcell">${sw.length
        ? `<span class="swatchrow">${sw.map(x =>
            `<span class="miniswatch" style="background:${esc(x.hex)}" title="${esc(x.caption || '')}"></span>`).join('')}</span>`
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
              <button class="btn primary" data-new>${t('plants.new')}</button>`,
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
      ${availTabs.length ? `<div class="chiprow">
        <span class="chiplabel">${t('plants.col.availability')}</span>
        <button class="box small${filterAvail === null ? ' active' : ''}" data-avail="">
          <span class="boxname">${t('common.all')}</span>
        </button>
        ${availTabs.map(x => x.replace('class="box', 'class="box small')).join('')}
      </div>` : ''}
      ${panel(table, 'flush')}`,
  });
}

// ---------------------------------------------------------------- form view

async function partRows(p) {
  return (await Promise.all((p.parts || []).map(async (pt, i) => {
    const chem = (await Promise.all((pt.chemistry || []).map(async (c, j) => `
      <div class="chemrow">
        <select data-chem="${i}.${j}.classCode">${await options('chemistry_class', c.classCode, '—')}</select>
        <select data-chem="${i}.${j}.level">${await options('chemistry_level', c.level, t('plants.level'))}</select>
        <button class="btn quiet" data-chem-del="${i}.${j}" aria-label="×">×</button>
      </div>`))).join('');

    const dosing = (pt.dosing || []).map((d, j) => `
      <div class="dosingrow">
        <select data-dose="${i}.${j}.condition">
          <option value=""${!d.condition ? ' selected' : ''}>${t('plants.anyCondition')}</option>
          <option value="dried"${d.condition === 'dried' ? ' selected' : ''}>${t('materials.form.dried')}</option>
          <option value="fresh"${d.condition === 'fresh' ? ' selected' : ''}>${t('materials.form.fresh')}</option>
        </select>
        <input type="number" step="5" min="0" data-dose="${i}.${j}.min" value="${d.min ?? ''}" placeholder="${t('recipes.qtyMin')}">
        <input type="number" step="5" min="0" data-dose="${i}.${j}.max" value="${d.max ?? ''}" placeholder="${t('recipes.qtyMax')}">
        <span class="pct">%</span>
        <button class="btn quiet" data-dose-del="${i}.${j}" aria-label="×">×</button>
      </div>`).join('');

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
          <button class="btn quiet" data-chem-add="${i}">${t('plants.addChem')}</button>
        </div>

        <div class="optblock">
          <span class="optlabel">${t('plants.dosing')}</span>
          ${dosing || `<p class="hint">—</p>`}
          <button class="btn quiet" data-dose-add="${i}">+</button>
          <p class="hint">${t('plants.dosingHint')}</p>
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

  const add = (hex, caption, from, combo) => {
    if (!hex) return;
    const ctx = combo ? [combo.key?.dyeSource?.partCode, combo.key?.fibreClass,
                         combo.key?.mordantCode, combo.key?.processCode].filter(Boolean).join('/') : '';
    const key = hex.toLowerCase() + (distinctContext ? '|' + ctx : '');
    if (seen.has(key) || out.length >= max) return;
    seen.add(key);
    out.push({ hex, caption, from, combo });
  };

  for (const c of plant.colours || []) add(c.hex, text(c.name) || text(c.conditions), 'own', null);

  for (const c of combinations) {
    if (c.key?.dyeSource?.plantId !== plant.id) continue;
    add(c.expected?.swatchHex, text(c.expected?.colourText), 'combination', c);
  }
  return out;
}

export function plantSwatches(plant, combinations = [], max = 6) {
  return plantColourSources(plant, combinations, { max });
}

function colourRows(p) {
  return (p.colours || []).map((c, i) => `
    <div class="colourrow">
      <input type="color" data-colour="${i}.hex" value="${esc(c.hex || '#A03D3B')}" aria-label="${t('plants.colourName')}">
      <input type="text" data-colour="${i}.name" value="${esc(c.name?.bg || '')}" placeholder="${t('plants.colourName')}">
      <input type="text" data-colour="${i}.conditions" value="${esc(c.conditions?.bg || '')}" placeholder="${t('plants.colourCondPlaceholder')}">
      <button class="btn quiet" data-colour-del="${i}" aria-label="×">×</button>
    </div>`).join('') || `<p class="hint">—</p>`;
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
      rows.push(fact(`${partName}${cond ? ', ' + cond : ''}`, `<b>${amount}</b> WOF`));
    }
  }

  const t1 = p.tempExtractC, t2 = p.tempDyeC;
  if (t1) rows.push(fact(t('plants.tempExtract'), `<b>${t1.min}–${t1.max} °C</b>`));
  if (t2) rows.push(fact(t('plants.tempDye'), `<b>${t2.min}–${t2.max} °C</b>`));
  if (p.softMaxTempC) rows.push(fact(t('plants.softMaxTemp'), `<b>${p.softMaxTempC} °C</b>`));
  if (p.liquorRatio) rows.push(fact(t('plants.liquorRatio'), `1 : ${p.liquorRatio}`));
  if (p.dryingRatio) rows.push(fact(t('plants.dryingRatio'), `× ${p.dryingRatio}`));
  if (p.steamNote) rows.push(fact(t('plants.steamNote'), esc(p.steamNote)));

  // Fastness used to sit under "in the garden", which was a bucket for whatever
  // was left over — it has nothing to do with the plot of ground. It is how the
  // colour will behave, so it reads here, with the temperatures and the ceiling.
  if (p.lightfastness) rows.push(fact(t('plants.lightfastness'), esc(await label('fastness', p.lightfastness))));
  if (p.washfastness) rows.push(fact(t('plants.washfastness'), esc(await label('fastness', p.washfastness))));

  return facts(rows);
}

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
    const band = k.mordantBand ? ` (${await label('concentration', k.mordantBand)})` : '';
    bits.push((await label('mordant_type', k.mordantCode)) + band);
  }
  if (k.processCode) bits.push(await label('process', k.processCode));
  return bits.filter(Boolean).join(' · ');
}

async function renderRead(root, p) {
  // The list derives its swatches from the plant and from the combinations
  // both; reading only `p.colours` here is what made every seeded record open
  // with an empty colour section (§13i).
  const combinations = await all('combinations');

  const roles = (await Promise.all((p.role || []).map(x => label('plant_role', x)))).join(', ');
  const comp = (await Promise.all((p.compositionalRole || []).map(x => label('compositional_role', x)))).join(', ');

  const sources = plantColourSources(p, combinations, { max: 24, distinctContext: true });
  const colours = (await Promise.all(sources.map(async s => {
    const ctx = await swatchContext(s.combo);
    return `
    <div class="refcard" style="cursor:default">
      <div class="refswatch" style="background:${esc(s.hex || '#8C7B6B')}"></div>
      <div class="refbody">
        <b>${esc(s.caption || '—')}</b>
        ${ctx ? `<div class="hint">${esc(ctx)}</div>` : ''}
      </div>
    </div>`;
  }))).join('');

  const chem = (await Promise.all((p.parts || []).map(async part => {
    const items = (await Promise.all((part.chemistry || []).map(async c =>
      `${await label('chemistry_class', c.classCode)}${c.level ? ` (${await label('chemistry_level', c.level)})` : ''}`))).join(', ');
    return items ? fact(await label('plant_part', part.partCode), esc(items)) : '';
  }))).join('');

  const months = (p.harvestMonths || []).map(i => MONTHS_BG[i - 1]).join(' · ');
  const grouped = groupSections(p.sections || []);
  const asSubs = (list) => list.map(sec => sub(text(sec.title), prose(sec.body)));
  const useNow = await useNowCard(p);

  // Six blocks in one column, because the order is the meaning: what is this,
  // what does it give me, how do I use it, why does it work, when do I gather
  // it, what else is written down. Cautions sit beside the use rather than at
  // the end — a warning read after the pot is on is a warning too late.
  const blocks = [
    // Only when there is something to show. Forty-five of the fifty seeded
    // plants have no recorded colour yet (§13h), and a block headed "what it
    // gives" holding nothing but "moderate lightfastness" answers a question
    // nobody asked. When it is empty it is absent, exactly as the list column
    // is blank for the same plants.
    readBlock(t('plants.read.gives'),
      colours ? `<div class="colourcards">${colours}</div>` : ''),

    readBlock(t('plants.read.howUsed'),
      [useNow, subs(asSubs(grouped.use))].filter(Boolean).join('')),

    readBlock(t('plants.readCareful'), prose(p.toxicity)),

    readBlock(t('plants.read.why'),
      [chem, subs(asSubs(grouped.why))].filter(Boolean).join('')),

    readBlock(t('plants.read.gathering'),
      [facts([
        fact(t('plants.harvestMonths'), esc(months)),
        fact(t('plants.yearsToMaturity'), p.yearsToMaturity),
        p.invasive ? fact(t('plants.invasive'), '⚠') : '',
      ]), subs(asSubs(grouped.grow), 2)].filter(Boolean).join('')),

    readBlock(t('plants.read.more'), subs(asSubs(grouped.more), 2)),
  ].filter(Boolean);

  // Attribution is not a section among sections: it says where the whole
  // profile came from, and §"Sources and authorship" requires it be visible.
  const sourceNote = grouped.sources.length
    ? `<div class="sourcenote">${grouped.sources.map(sec =>
        `<span class="sourcelabel">${esc(text(sec.title))}</span> ${esc(text(sec.body))}`).join('<br>')}</div>`
    : '';

  root.innerHTML = page({
    title: text(p.nameCommon) || t('plants.one'),
    sub: p.nameBotanical,
    actions: `<button class="btn quiet" data-back>${t('common.back')}</button>
              <button class="btn primary" data-edit>${t('common.edit')}</button>`,
    body: `
      <div class="headline">
        ${p.photoData ? `<img src="${p.photoData}" alt="">` : ''}
        <div class="headlinebody">
          <h2>${esc(text(p.nameCommon) || '—')} ${favStar(p, true)}</h2>
          <div class="latin">${esc(p.nameBotanical || '')}${p.family ? ' · ' + esc(p.family) : ''}</div>
          ${facts([
            fact(t('plants.role'), esc(roles)),
            fact(t('plants.compositional'), esc(comp)),
            fact(t('plants.availability'), esc(await label('availability', p.availability))),
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

  const monthChecks = MONTHS_BG.map((m, i) => `
    <label class="month"><input type="checkbox" data-month value="${i + 1}"
      ${(p.harvestMonths || []).includes(i + 1) ? 'checked' : ''}><span>${m}</span></label>`).join('');

  root.innerHTML = page({
    title: isNew ? t('plants.new') : (text(p.nameCommon) || t('plants.one')),
    sub: isNew ? t('plants.emptyHint') : (p.nameBotanical || ''),
    actions: `<button class="btn quiet" data-back>${t('common.back')}</button>
              <button class="btn primary" data-save>${t('common.save')}</button>`,
    body: `
      <div class="cols">
        <div class="col">
          ${panel(`
            <h2>${t('plants.identity')}</h2>
            <div class="photobox">
              ${p.photoData
                ? `<img class="plantphoto" src="${p.photoData}" alt="">
                   <button class="btn quiet" data-photo-del>${t('plants.removePhoto')}</button>`
                : `<label class="btn quiet" for="plantphoto">${t('plants.addPhoto')}</label>`}
              <input type="file" id="plantphoto" accept="image/*" hidden>
              <p class="hint">${t('plants.photoHint')}</p>
            </div>
            ${pairField(t('plants.nameCommon'), 'nameCommon', p.nameCommon)}
            ${field(t('plants.nameBotanical'), `<input type="text" data-f="nameBotanical" value="${esc(p.nameBotanical || '')}" placeholder="Rubia tinctorum">`)}
            ${field(t('plants.family'), `<input type="text" data-f="family" value="${esc(p.family || '')}">`)}
            ${field(t('plants.role'), `<div class="checks">${roleChecks}</div>`)}
            ${await confField(t('plants.compositional'), `<div class="checks">${compChecks}</div>`, 'compositionalRole', p.confidence?.compositionalRole, t('plants.compositionalHint'))}
            ${field(t('plants.dyeClass'), `<select data-f="dyeClass">${await options('dye_class', p.dyeClass)}</select>`, t('plants.dyeClassHint'))}
            ${field(t('plants.availability'), `<select data-f="availability">${await options('availability', p.availability)}</select>`)}
          `)}

          ${panel(`
            <h2>${t('plants.parts')}</h2>
            <p class="note">${t('plants.partsHint')}</p>
            <div class="partlist">${await partRows(p)}</div>
            <button class="btn quiet" data-part-add>${t('plants.addPart')}</button>
          `)}

          ${panel(`
            <h2>${t('plants.colours')}</h2>
            <p class="note">${t('plants.coloursHint')}</p>
            <div class="colourlist">${colourRows(p)}</div>
            <button class="btn quiet" data-colour-add>${t('plants.addColour')}</button>
          `)}
        </div>

        <div class="col">
          ${panel(`
            <h2>${t('plants.working')}</h2>
            <p class="hint">${t('plants.confidenceHint')}</p>
            <div class="rangerow">
              ${await confField(t('plants.tempExtract'), `<div class="two">
                <input type="number" step="5" data-f="tempExtractC.min" value="${p.tempExtractC?.min ?? ''}" placeholder="${t('recipes.qtyMin')}">
                <input type="number" step="5" data-f="tempExtractC.max" value="${p.tempExtractC?.max ?? ''}" placeholder="${t('recipes.qtyMax')}">
              </div>`, 'tempExtractC', p.confidence?.tempExtractC)}
              ${await confField(t('plants.tempDye'), `<div class="two">
                <input type="number" step="5" data-f="tempDyeC.min" value="${p.tempDyeC?.min ?? ''}" placeholder="${t('recipes.qtyMin')}">
                <input type="number" step="5" data-f="tempDyeC.max" value="${p.tempDyeC?.max ?? ''}" placeholder="${t('recipes.qtyMax')}">
              </div>`, 'tempDyeC', p.confidence?.tempDyeC)}
            </div>
            ${await confField(t('plants.softMaxTemp'), `<input type="number" step="5" data-f="softMaxTempC" value="${p.softMaxTempC ?? ''}">`,
              'softMaxTempC', p.confidence?.softMaxTempC, t('plants.softMaxTempHint'))}
            ${await confField(t('plants.liquorRatio'), `<input type="number" step="1" min="0" data-f="liquorRatio" value="${p.liquorRatio ?? ''}">`,
              'liquorRatio', p.confidence?.liquorRatio, t('plants.liquorRatioHint'))}
            ${await confField(t('plants.dryingRatio'), `<input type="number" step="0.5" min="0" data-f="dryingRatio" value="${p.dryingRatio ?? ''}">`,
              'dryingRatio', p.confidence?.dryingRatio, t('plants.dryingRatioHint'))}
            ${field(t('plants.steamNote'), `<input type="text" data-f="steamNote" value="${esc(p.steamNote || '')}">`)}
            ${field(t('plants.harvestMonths'), `<div class="months">${monthChecks}</div>`)}
            ${field(t('plants.yearsToMaturity'), `<input type="number" step="1" min="0" data-f="yearsToMaturity" value="${p.yearsToMaturity ?? ''}">`, t('plants.yearsHint'))}
            ${await confField(t('plants.lightfastness'), await segmented('fastness', 'lightfastness', p.lightfastness, { allowEmpty: false }), 'lightfastness', p.confidence?.lightfastness)}
            ${await confField(t('plants.washfastness'), await segmented('fastness', 'washfastness', p.washfastness, { allowEmpty: false }), 'washfastness', p.confidence?.washfastness)}
            <label class="check"><input type="checkbox" data-f-bool="invasive" ${p.invasive ? 'checked' : ''}>
              ${t('plants.invasive')}</label>
            ${pairField(t('plants.toxicity'), 'toxicity', p.toxicity, { multiline: true })}
          `)}

          ${panel(`
            <h2>${t('plants.sections')}</h2>
            <p class="note">${t('plants.sectionsHint')}</p>
            <div class="sectionlist">${sectionRows(p)}</div>
            <div class="btnrow">
              <button class="btn quiet" data-section-add>${t('plants.addSection')}</button>
              ${!(p.sections || []).length ? `<select data-section-suggest>
                <option value="">${t('plants.sectionTitle')}…</option>
                ${SUGGESTED.map((sug, i) => `<option value="${i}">${esc(sug[getLang()])}</option>`).join('')}
              </select>` : ''}
            </div>
          `)}

          ${!isNew ? panel(`<button class="btn danger quiet" data-delete>${t('plants.delete')}</button>`) : ''}
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
  draft.compositionalRole = [];
  for (const el of root.querySelectorAll('[data-multi="compositionalRole"]')) {
    if (el.checked) draft.compositionalRole.push(el.value);
  }

  draft.harvestMonths = [];
  for (const el of root.querySelectorAll('[data-month]')) if (el.checked) draft.harvestMonths.push(Number(el.value));

  // parts, with their chemistry and dosing nested inside
  const parts = draft.parts || [];
  for (const el of root.querySelectorAll('[data-part]')) {
    const [i, key] = el.dataset.part.split('.');
    parts[Number(i)] = parts[Number(i)] || { id: uid(), chemistry: [], dosing: [] };
    parts[Number(i)][key] = el.value;
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
  for (const el of root.querySelectorAll('[data-colour]')) {
    const [i, key] = el.dataset.colour.split('.');
    const idx = Number(i);
    colours[idx] = colours[idx] || { id: draft.colours?.[idx]?.id || uid() };
    if (key === 'hex') colours[idx].hex = el.value;
    else colours[idx][key] = { bg: el.value, en: draft.colours?.[idx]?.[key]?.en || '' };
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
}

export default {
  id: 'plants',
  title: () => t('plants.title'),
  sub: () => t('plants.sub'),

  // Choosing a module in the navigation means "take me to this module", not
  // "show me whatever I last had open in it". Called by the router on entry.
  reset() {
    seedUI.close();
    editing = false;
    openId = null;
    draft = null;
    filterRole = null;
    // Leaving the module and coming back must not leave the favourites filter
    // silently on: the list would look short for no visible reason. The same
    // rule holds for availability, which is why it is cleared here too (§13g).
    filterAvail = null;
    favOnly = false;
  },

  async render(root) {
    if (openId) {
      if (!draft || (openId !== 'new' && draft.id !== openId)) {
        draft = openId === 'new' ? blank() : structuredClone(await get('plants', openId));
      }
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
      const avail = e.target.closest('[data-avail]');
      if (avail) { filterAvail = avail.dataset.avail || null; return this.render(root); }
      if (e.target.closest('[data-new]')) { draft = null; openId = 'new'; editing = true; return this.render(root); }
      if (e.target.closest('[data-edit]')) { editing = true; return this.render(root); }
      const row = e.target.closest('[data-open]');
      if (row) { draft = null; openId = row.dataset.open; editing = false; return this.render(root); }
      if (e.target.closest('[data-back]')) {
        // Back from the editor returns to reading the same record, not to the
        // list: one usually edits a field, checks how it reads, edits again.
        if (editing && openId !== 'new') { editing = false; return this.render(root); }
        openId = null; draft = null; editing = false;
        return this.render(root);
      }

      if (e.target.closest('[data-part-add]')) {
        readForm(root);
        draft.parts.push({ id: uid(), partCode: '', facing: '', chemistry: [], dosing: [] });
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
        draft.parts[Number(dadd.dataset.doseAdd)].dosing.push({ id: uid(), condition: 'dried', min: null, max: null });
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
        openId = draft.id;
        editing = false;
        return this.render(root);
      }
      if (e.target.closest('[data-delete]')) {
        if (!confirm(t('plants.confirmDelete'))) return;
        await remove('plants', draft.id);
        openId = null; draft = null;
        return this.render(root);
      }
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

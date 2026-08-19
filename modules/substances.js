// modules/substances.js — Materials: what a material IS (§13.4, §11b).
//
// Reference knowledge: true whether or not a jar is on the shelf, identical
// for every practitioner, shipped in seed packs. No supplier, no quantity,
// no purchase date — those live in `stock` and are read here (§11b).
//
// Called Materials rather than Substances because the shelf holds cochineal and
// bought indigo extract, which are neither plants nor chemicals: "substance"
// pushed them out of the word. The stores keep their names — migrations only
// ever add.

import { all, get, put, remove, newRecord, byIndex } from '../db.js';
import { jarState, jarLeft, jarsFor, stateOfSubstance, STOCK_STATES } from '../stock-logic.js';
import { markEdited } from '../seed.js';
import * as seedUI from '../seed-ui.js';
import { t, text } from '../i18n.js';
import { markClean } from '../dirty.js';
import { page, panel, field, options, label, esc, empty, pairField, readPairs, icon, navigate, fieldGroup,
         readBlock, facts, fact, prose, fmtDate, flash, backTo, actionBtn } from '../ui.js';

const CAT_ICONS = {
  mordant: 'c-mordant',
  tannin: 'c-tannin',
  dyestuff: 'c-dyestuff',
  modifier: 'c-modifier',
  auxiliary: 'c-auxiliary',
};

const CATEGORIES = ['mordant', 'tannin', 'dyestuff', 'modifier', 'auxiliary'];

let filterCat = null;
let filterState = null;
let openId = null;
let jarId = null;
let editing = false;
let draft = null;
let jar = null;

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
      <span class="boxicon">${icon(CAT_ICONS[c])}</span>
      <span class="boxname">${esc(await label('material_category', c))}</span>
      <span class="boxcount">${counts[c] || 0}</span>
    </button>`));

  // Stock has no module of its own any more (§11b): "what is running low" is a
  // filter over the materials, the way Глина asks it, rather than a second
  // screen listing the same jars in a different order.
  const stateOf = new Map(list.map(x => [x.id, stateOfSubstance(jarsFor(stock, x.id))]));

  const shown = list
    .filter(x => !filterCat || x.category === filterCat)
    .filter(x => !filterState || stateOf.get(x.id) === filterState)
    .sort((a, b) => text(a.name).localeCompare(text(b.name)));

  const rows = await Promise.all(shown.map(async x => {
    const state = stateOfSubstance(jarsFor(stock, x.id));
    return `<tr data-open="${x.id}">
      <td>${esc(text(x.name) || '—')}</td>
      <td>${esc(await label('material_category', x.category))}</td>
      <td>${esc(await detailOf(x))}</td>
      <td class="mono">${esc(x.formula || '')}</td>
      <td class="num">${x.standardPercentWof != null ? x.standardPercentWof + '%' : '—'}</td>
      <td>${stateChip(state)}</td>
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
        <th>${t('substances.inStock')}</th>
      </tr></thead>
      <tbody>${rows.join('')}</tbody>
    </table>`
    : empty(filterCat ? t('substances.emptyCat') : t('substances.empty'), t('substances.emptyHint'));

  root.innerHTML = page({
    title: t('substances.title'),
    sub: t('substances.sub'),
    actions: `<button class="btn quiet" data-sync>${t('seed.sync')}</button>
              ${actionBtn('add', t('substances.new'), 'data-new', 'primary')}`,
    body: `
      <div class="boxes">
        <button class="box${filterCat === null ? ' active' : ''}" data-cat="">
          <span class="boxname">${t('common.all')}</span>
          <span class="boxcount">${list.length}</span>
        </button>
        ${tabs.join('')}
      </div>
      <div class="statefilter">
        <button class="chipbtn${filterState === null ? ' active' : ''}" data-state="">${t('common.all')}</button>
        ${(await Promise.all(STOCK_STATES.map(async code => {
          const n = [...stateOf.values()].filter(v => v === code).length;
          return `<button class="chipbtn${filterState === code ? ' active' : ''}" data-state="${code}">
            ${esc(t('stock.state.' + code))}<span class="chipcount">${n}</span></button>`;
        }))).join('')}
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
      ${fieldGroup(t('materials.suitableFor'), `<div class="checks">${fibres}</div>`)}
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
      ${pairField(t('materials.effect'), 'effectNotes', r.effectNotes, { multiline: true })}`;
  }

  // Auxiliaries have no category-specific properties. An empty panel is a
  // sign the code drew something before checking there was anything to draw.
  return '';
}

// Formula, hydration and molar mass only mean something for a defined
// compound. A tannin extract or a dried root is a mixture, not a molecule.
const HAS_CHEMISTRY = ['mordant', 'modifier', 'auxiliary'];

// The jars of one material, as a block that can be read rather than a list
// buried in the edit form (§11b). Stock was a ledger that was only ever
// written to: a material opened straight into a form, so the one question the
// shelf answers — do I have this, and how much is left — could only be reached
// by pressing Edit.
async function jarBlock(r, jars) {
  if (openId === 'new') return '';

  const rows = (await Promise.all(jars.map(async j => {
    const st = jarState(j);
    const left = jarLeft(j);
    const line = [
      j.supplier || t('stock.noSupplier'),
      t('stock.form.' + j.form),
      j.concentrationPercent != null ? j.concentrationPercent + '%' : '',
      j.batchNote || '',
    ].filter(Boolean).join(' · ');

    return `
      <button class="jar" data-jar="${esc(j.id)}">
        <span class="jarwho">
          <b>${esc(line)}</b>
          ${j.acquiredDate ? `<span class="hint">${t('stock.acquiredShort')} ${fmtDate(j.acquiredDate)}</span>` : ''}
          ${j.harvestDate ? `<span class="hint">${t('stock.harvestShort')} ${fmtDate(j.harvestDate)}</span>` : ''}
        </span>
        <span class="jarleft">
          ${st === 'wanted' ? '' : left
            ? `<b>${esc(String(left.value))}</b> <span class="hint">${esc(left.unit)}${
                j.quantity?.value != null && j.remaining?.value != null
                  ? ` ${t('stock.outOf')} ${j.quantity.value}` : ''}</span>`
            : `<span class="hint">—</span>`}
          ${stateChip(st)}
        </span>
      </button>`;
  }))).join('');

  const total = await stateLine(r, jars);
  const wanted = jars.some(j => j.status === 'wanted');

  return panel(`
    <h2>${t('substances.inStock')}</h2>
    <p class="stockline">${total}</p>
    ${rows ? `<div class="jars">${rows}</div>` : ''}
    <div class="btnrow">
      <button class="btn quiet" data-jar-new>${t('stock.newJar')}</button>
      ${wanted
        ? `<button class="btn quiet" data-unwant>${t('stock.unwant')}</button>`
        : `<button class="btn quiet" data-want>${t('stock.want')}</button>`}
    </div>`);
}

// A chip, not a colour on the row: the workspace stays neutral so it does not
// bias a colour judgement (§7). Running low and empty are the only ones that
// raise their voice, and they do it in madder.
function stateChip(state) {
  if (!state) return '';
  return `<span class="statechip ${esc(state)}">${esc(t('stock.state.' + state))}</span>`;
}

async function stateLine(r, jars) {
  const state = stateOfSubstance(jars);
  if (!state) return t('stock.nothingSaid');
  const real = jars.filter(j => j.status !== 'wanted');
  if (state === 'wanted') return t('stock.state.wanted');

  const unit = real.map(j => jarLeft(j)).find(Boolean)?.unit || '';
  const sameUnit = real.every(j => {
    const l = jarLeft(j);
    return !l || l.unit === unit;
  });
  const sum = real.reduce((n, j) => n + (jarLeft(j)?.value || 0), 0);

  return `${t('stock.nJars', { n: real.length })}${
    sameUnit && sum ? ` · ${t('stock.leftTotal')} ${Math.round(sum * 100) / 100} ${unit}` : ''}`;
}

// Reading a material: what it is and whether it is on the shelf, without
// entering a form. §13c gave read mode to five modules and this was not one of
// them, which is how the jars came to be visible only while editing (§11b).
// One jar, at its own address: `#/substances/<id>/jar/<jarId>`.
//
// Not a panel that opens inside the material, because a screen without an
// address cannot be returned to, reloaded or bookmarked (§13q) — the same rule
// that removed the sessionStorage handoffs.
const JAR_FORMS = ['powder', 'crystal', 'liquid', 'extract', 'dried', 'fresh'];

function blankJar(substanceId) {
  return newRecord({
    substanceId,
    status: 'have',
    form: 'powder',
    supplier: '',
    acquiredDate: '',
    harvestDate: '',
    quantity: { value: null, unit: 'g' },
    remaining: { value: null, unit: 'g' },
    // The amount to warn under, in this jar's own unit. Empty means the
    // fallback fraction applies — five litres of vinegar and five hundred
    // grams of powder do not run low at the same fraction (§11b).
    lowBelow: null,
    concentrationPercent: null,
    batchNote: '',
    notes: '',
  });
}

async function renderJar(root, r, j) {
  const isNew = jarId === 'new';

  root.innerHTML = page({
    title: text(r.name) || t('substances.one'),
    sub: isNew ? t('stock.newJar') : t('stock.one'),
    actions: `<button class="btn quiet" data-jar-back>${t('common.back')}</button>
              <button class="btn primary" data-jar-save>${t('common.save')}</button>`,
    body: `
      <div class="cols">
        <div class="col">
          ${panel(`
            <h2>${t('stock.one')}</h2>
            ${field(t('stock.form'), `<select data-j="form">${
              JAR_FORMS.map(f => `<option value="${f}"${j.form === f ? ' selected' : ''}>${t('stock.form.' + f)}</option>`).join('')
            }</select>`)}
            ${field(t('stock.supplier'), `<input type="text" data-j="supplier" value="${esc(j.supplier || '')}">`)}
            ${field(t('stock.acquired'), `<input type="date" data-j="acquiredDate" value="${esc(j.acquiredDate || '')}">`)}
            ${['dried', 'fresh'].includes(j.form)
              ? field(t('stock.harvestDate'), `<input type="date" data-j="harvestDate" value="${esc(j.harvestDate || '')}">`)
              : ''}
            ${field(t('stock.batch'), `<input type="text" data-j="batchNote" value="${esc(j.batchNote || '')}">`)}
          `)}
        </div>

        <div class="col">
          ${panel(`
            <h2>${t('stock.quantity')}</h2>
            ${field(t('stock.quantity'), `<input type="number" step="0.1" min="0" data-j="quantity.value" value="${j.quantity?.value ?? ''}">`)}
            ${field(t('stock.remaining'), `<input type="number" step="0.1" min="0" data-j="remaining.value" value="${j.remaining?.value ?? ''}">`)}
            ${field(t('stock.unit'), `<input type="text" data-j="quantity.unit" value="${esc(j.quantity?.unit || '')}" placeholder="g, ml, l">`)}
            ${field(t('stock.lowBelow'), `<input type="number" step="0.1" min="0" data-j="lowBelow" value="${j.lowBelow ?? ''}">`, t('stock.lowBelowHint'))}
            ${field(t('stock.concentration'), `<input type="number" step="0.1" min="0" max="100" data-j="concentrationPercent" value="${j.concentrationPercent ?? ''}">`, t('stock.concentrationHint'))}
          `)}

          ${panel(`
            <h2>${t('common.notes')}</h2>
            ${field('', `<textarea data-j="notes" rows="3">${esc(j.notes || '')}</textarea>`)}
            ${!isNew ? `${actionBtn('delete', t('stock.delete'), 'data-jar-delete', 'destructive')}` : ''}
          `)}
        </div>
      </div>`,
  });
}

function readJar(root) {
  for (const el of root.querySelectorAll('[data-j]')) {
    const path = el.dataset.j.split('.');
    let target = jar;
    for (let i = 0; i < path.length - 1; i++) {
      target[path[i]] = target[path[i]] || {};
      target = target[path[i]];
    }
    let value = el.value;
    if (el.type === 'number') value = value === '' ? null : Number(value);
    target[path[path.length - 1]] = value;
  }
  // One unit for the jar: the amount left is measured in whatever the jar was
  // bought in, and two units on one record is two ways to be wrong.
  if (jar.quantity?.unit) jar.remaining = { ...(jar.remaining || {}), unit: jar.quantity.unit };
  // A jar with something written in it is a jar, whatever it was created as.
  if (jar.status === 'wanted') jar.status = 'have';
}

async function renderRead(root, r) {
  const jars = jarsFor(await all('stock'), r.id);
  const detail = await detailOf(r);

  const identity = facts([
    fact(t('materials.category'), esc(await label('material_category', r.category))),
    detail ? fact(t('materials.col.detail'), esc(detail)) : '',
    fact(t('materials.formula'), r.formula ? `<span class="mono">${esc(r.formula)}</span>` : ''),
    fact(t('materials.standardWof'), r.standardPercentWof != null ? r.standardPercentWof + '%' : ''),
    fact(t('substances.maxWof'), r.maxPercentWof != null ? r.maxPercentWof + '%' : ''),
    fact(t('materials.maxTemp'), r.maxTempC != null ? r.maxTempC + ' °C' : ''),
  ]);

  const handling = (r.handling || []).map(h => t('materials.handling.' + h)).join(' · ');
  const safety = [
    handling ? fact(t('materials.handling'), esc(handling)) : '',
  ].filter(Boolean).join('');

  const blocks = [
    // The shelf first. It is the question the record is opened with — every
    // other fact here is true whether or not she owns any.
    await jarBlock(r, jars),
    readBlock(t('substances.purpose'), prose(r.typicalUse)),
    readBlock(t('substances.identity'), identity),
    readBlock(t('substances.safety'),
      safety + prose(r.safetyNote) + (text(r.disposalNote)
        ? `<h3>${esc(t('materials.disposal'))}</h3>${prose(r.disposalNote)}` : '')),
    readBlock(t('common.notes'), prose(r.notes)),
  ].filter(Boolean).join('');

  root.innerHTML = page({
    title: text(r.name) || t('substances.one'),
    sub: [await label('material_category', r.category), detail].filter(Boolean).join(' · '),
    actions: `${backTo('#/substances', t('nav.substances'))}
              ${actionBtn('edit', t('common.edit'), 'data-edit', 'primary')}`,
    body: `<div class="readcol">${blocks}</div>`,
  });
}

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
    actions: `${backTo('#/substances', t('nav.substances'))}
              <button class="btn primary" data-save>${t('common.save')}</button>`,
    body: `
      <div class="cols">
        <div class="col">
          ${panel(`
            <h2>${t('substances.identity')}</h2>
            ${field(t('materials.category'), `<select data-f="category">${await options('material_category', r.category, '')}</select>`)}
            ${pairField(t('materials.name'), 'name', r.name)}
            ${pairField(t('substances.purpose'), 'typicalUse', r.typicalUse, { multiline: true, placeholder: t('substances.purposePlaceholder') })}
          `)}

          ${props ? panel(`
            <h2>${t('substances.properties')}</h2>
            ${props}
          `) : ''}

          ${HAS_CHEMISTRY.includes(r.category) ? panel(`
            <h2>${t('substances.chemistry')}</h2>
            <p class="note">${t('substances.chemistryHint')}</p>
            ${field(t('materials.formula'), `<input type="text" class="mono" data-f="formula" value="${esc(r.formula || '')}" placeholder="">`)}
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
            ${fieldGroup(t('materials.handling'), `<div class="checks">${handling}</div>`)}
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
            ${actionBtn('delete', t('substances.delete'), 'data-delete', 'destructive')}
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
}

export default {
  id: 'substances',
  title: () => t('substances.title'),
  sub: () => t('substances.sub'),

  // The address decides what is on screen (§13q). Called on every route
  // change, with nothing when the address names no record, which is how the
  // list comes back.
  //
  //   #/substances                     the list
  //   #/substances/new                 a new material
  //   #/substances/<id>                the material, read
  //   #/substances/<id>/edit           the material, editable
  //   #/substances/<id>/jar/new        a new jar of it
  //   #/substances/<id>/jar/<jarId>    one jar
  open(first, second, third) {
    draft = null;
    jar = null;
    openId = first || null;
    editing = first === 'new' || second === 'edit';
    jarId = second === 'jar' ? (third || null) : null;
  },

  // Choosing a module in the navigation means "take me to this module", not
  // "show me whatever I last had open in it". Called by the router on entry.
  reset() {
    seedUI.close();
    openId = null;
    jarId = null;
    editing = false;
    draft = null;
    jar = null;
    filterState = null;
  },

  async render(root) {
    if (openId) {
      if (!draft || (openId !== 'new' && draft.id !== openId)) {
        draft = openId === 'new' ? blank() : structuredClone(await get('substances', openId));
      }
      // An address naming a record that is gone — a bookmark to something
      // deleted, or a back button after deleting it. Drawing it threw, and a
      // thrown render leaves whatever was on screen before, which reads as the
      // application ignoring the address. The list is the honest answer.
      if (!draft) return navigate('#/substances');
      if (jarId) {
        if (!jar || (jarId !== 'new' && jar.id !== jarId)) {
          jar = jarId === 'new' ? blankJar(openId) : structuredClone(await get('stock', jarId));
        }
        if (!jar) return navigate(`#/substances/${openId}`);
        await renderJar(root, draft, jar);
      } else if (editing) {
        await renderForm(root, draft);
      } else {
        await renderRead(root, draft);
      }
    } else {
      draft = null;
      await renderList(root);
    }

    root.onclick = async (e) => {
      if (e.target.closest('[data-sync]')) {
        try {
          await seedUI.open('substances');
          return seedUI.render(root, () => this.render(root));
        } catch (err) { alert(err.message); }
        return;
      }

      const cat = e.target.closest('[data-cat]');
      if (cat) { filterCat = cat.dataset.cat || null; return this.render(root); }
      const st = e.target.closest('[data-state]');
      if (st) { filterState = st.dataset.state || null; return this.render(root); }
      if (e.target.closest('[data-new]')) return navigate('#/substances/new');
      const row = e.target.closest('[data-open]');
      if (row) return navigate(`#/substances/${row.dataset.open}`);

      // ---- the shelf
      if (e.target.closest('[data-jar-new]')) return navigate(`#/substances/${openId}/jar/new`);
      const openJar = e.target.closest('[data-jar]');
      if (openJar) return navigate(`#/substances/${openId}/jar/${openJar.dataset.jar}`);
      if (e.target.closest('[data-jar-back]')) return navigate(`#/substances/${openId}`);

      if (e.target.closest('[data-jar-save]')) {
        readJar(root);
        await put('stock', jar);
        markClean();
        flash(t('stock.saved'));
        return navigate(`#/substances/${openId}`);
      }
      if (e.target.closest('[data-jar-delete]')) {
        if (!confirm(t('stock.confirmDelete'))) return;
        await remove('stock', jar.id);
        return navigate(`#/substances/${openId}`);
      }

      // Wanting something is a jar-shaped record with no jar in it (§11b): the
      // absence of a jar does not describe itself, so it is written down.
      if (e.target.closest('[data-want]')) {
        await put('stock', { ...blankJar(openId), status: 'wanted',
                             quantity: { value: null, unit: '' },
                             remaining: { value: null, unit: '' } });
        return this.render(root);
      }
      if (e.target.closest('[data-unwant]')) {
        for (const j of jarsFor(await all('stock'), openId)) {
          if (j.status === 'wanted') await remove('stock', j.id);
        }
        return this.render(root);
      }

      if (e.target.closest('[data-edit]')) return navigate(`#/substances/${openId}/edit`);
      if (e.target.closest('[data-back]')) {
        return navigate(editing && openId !== 'new' ? `#/substances/${openId}` : '#/substances');
      }
      if (e.target.closest('[data-save]')) {
        readForm(root);
        await put('substances', markEdited(draft));
        // The put succeeded, so the work is saved and the address change that
        // follows is not a departure. `dirty.js` cannot tell the two apart from
        // outside — it infers a successful save by watching the form leave the
        // screen — but in here the answer is known (§13ad).
        markClean();
        // A record with a read view is shown after saving, and something says
        // so — a saved record used to look exactly like an unsaved one.
        if (openId === 'new') return navigate(`#/substances/${draft.id}`);
        flash(t('common.saved'));
        return navigate(`#/substances/${openId}`);
      }
      if (e.target.closest('[data-delete]')) {
        if (!confirm(t('substances.confirmDelete'))) return;
        await remove('substances', draft.id);
        return navigate('#/substances');
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

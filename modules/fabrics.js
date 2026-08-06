// modules/fabrics.js — one record is one physical piece (§3, A.1).

import { all, get, put, remove, newRecord, getSetting, setSetting, uid } from '../db.js';
import { t } from '../i18n.js';
import { shrinkThumb } from '../photo.js';
import { shrinkThumb } from '../photo.js';
import { page, panel, field, options, label, esc, empty, note, today, fmtDate,
         fact, facts, readBlock } from '../ui.js';
import {
  compositionTotal, dyeReceptiveFraction, fibreClass, compositionWarnings,
  currentState, stateHistory, daysSinceMordanted, STATE_ORDER,
} from '../fabric-logic.js';

let filterState = null;   // null = all boxes
let openId = null;        // null = list, 'new' = blank form, id = that record
let draft = null;
// Reading is the default; the form opens only when asked for.
let editing = false;
let selected = new Set();
let bulkState = '';

// The code written on the pinned paper tag. Short enough to write by hand;
// everything else lives in the app.
async function nextLabel() {
  const n = (await getSetting('fabricLabelCounter', 0)) + 1;
  await setSetting('fabricLabelCounter', n);
  // The prefix is written by hand on a paper tag, so it stays a setting
  // rather than a translated string — the tag does not change language.
  const prefix = await getSetting('fabricLabelPrefix', 'П');
  return prefix + '-' + String(n).padStart(3, '0');
}

function blank() {
  return newRecord({
    label: '',
    name: '',
    origin: 'new',
    originDetail: {},
    form: 'cut_piece',
    composition: [{ fibreCode: 'cotton', percent: 100 }],
    structure: 'plain',
    weightGsm: null,
    dimensions: '',
    weightG: null,
    quantity: { value: 1, unit: 'pcs' },
    baseColour: 'natural',
    state: 'unwashed',
    stateEvents: [],
    notes: '',
    photoData: null,
    count: 1,
  });
}

// ---------------------------------------------------------------- list view

async function renderList(root) {
  const fabrics = await all('fabrics');

  // The box inventory: "what is in the mordanted box" is a query, not a
  // memory exercise (§3, A.1).
  const counts = {};
  for (const f of fabrics) {
    const s = currentState(f);
    counts[s] = (counts[s] || 0) + 1;
  }

  const boxes = await Promise.all(STATE_ORDER.map(async code => `
    <button class="box${filterState === code ? ' active' : ''}" data-box="${code}">
      <span class="boxname">${esc(await label('fabric_state', code))}</span>
      <span class="boxcount">${counts[code] || 0}</span>
    </button>`));

  const shown = (filterState
    ? fabrics.filter(f => currentState(f) === filterState)
    : fabrics
  ).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));

  const rows = await Promise.all(shown.map(async f => {
    const compNames = await Promise.all((f.composition || []).map(async c =>
      `${c.percent}% ${await label('fibre', c.fibreCode)}`));
    const cured = daysSinceMordanted(f);
    return `<tr data-open="${f.id}">
      <td class="pick"><input type="checkbox" data-pick="${f.id}"${selected.has(f.id) ? ' checked' : ''}></td>
      <td class="withthumb">${f.photoData ? `<img class="thumb" src="${f.photoData}" alt="">` : ''}
        <span class="mono">${esc(f.label || '')}</span></td>
      <td>${esc(f.name || '—')}</td>
      <td>${esc(compNames.join(' + '))}</td>
      <td>${esc(await label('fibre_class', fibreClass(f.composition)))}</td>
      <td>${esc(await label('fabric_structure', f.structure))}</td>
      <td class="num">${f.weightG ? f.weightG + ' ' + t('fabrics.grams') : '—'}</td>
      <td><span class="chip">${esc(await label('fabric_state', currentState(f)))}</span>${
        cured != null ? `<span class="hint"> · ${t('common.days', { n: cured })}</span>` : ''}</td>
    </tr>`;
  }));

  const table = shown.length ? `
    <table class="grid">
      <thead><tr>
        <th class="pick"></th><th>${t('fabrics.col.label')}</th><th>${t('fabrics.col.name')}</th><th>${t('fabrics.col.composition')}</th><th>${t('fabrics.col.class')}</th>
        <th>${t('fabrics.col.structure')}</th><th class="num">${t('fabrics.col.weight')}</th><th>${t('fabrics.col.box')}</th>
      </tr></thead>
      <tbody>${rows.join('')}</tbody>
    </table>`
    : empty(
        filterState ? t('fabrics.emptyBox') : t('fabrics.empty'),
        t('fabrics.emptyHint'));

  root.innerHTML = page({
    title: t('fabrics.title'),
    sub: t('fabrics.sub'),
    actions: `<button class="btn primary" data-new>${t('fabrics.new')}</button>`,
    body: `
      <div class="boxes">
        <button class="box${filterState === null ? ' active' : ''}" data-box="">
          <span class="boxname">${t('common.all')}</span>
          <span class="boxcount">${fabrics.length}</span>
        </button>
        ${boxes.join('')}
      </div>
      ${selected.size ? `
        <div class="bulkbar">
          <span>${t('fabrics.selected', { n: selected.size })}</span>
          <select data-bulkstate>${await options('fabric_state', bulkState, t('fabrics.bulkState'))}</select>
          <button class="btn primary" data-bulk-apply ${bulkState ? '' : 'disabled'}>${t('fabrics.bulkApply')}</button>
          <button class="btn quiet" data-bulk-clear>${t('fabrics.clearSelection')}</button>
        </div>` : ''}
      ${panel(table, 'flush')}`,
  });
}

// ---------------------------------------------------------------- read view
//
// A fabric record is consulted far more than it is written: which box is it in,
// what is it made of, how long since it was mordanted, what has already been
// done to it. Its history is the point, so it reads as a biography rather than
// as a list of fields.

async function renderRead(root, r) {
  const qty = Number(r.quantity?.value) || 1;
  const children = (await all('fabrics')).filter(x => x.fromBatchId === r.id);
  const parent = r.fromBatchId ? await get('fabrics', r.fromBatchId) : null;
  const compNames = (await Promise.all((r.composition || []).map(async c =>
    `${c.percent}% ${await label('fibre', c.fibreCode)}`))).join(' + ');
  const cls = fibreClass(r.composition);
  const cured = daysSinceMordanted(r);

  const history = stateHistory(r);
  const timeline = history.length
    ? (await Promise.all(history.map(async e => `
        <li class="tl">
          <span class="tldot"></span>
          <div>
            <b>${esc(await label('fabric_state', e.stateCode))}</b>
            <span class="hint"> ${fmtDate(e.date)}</span>
            ${e.note ? `<div class="hint">${esc(e.note)}</div>` : ''}
          </div>
        </li>`))).join('')
    : '';

  const trials = (await all('trials')).filter(x => (x.fabricIds || []).includes(r.id));
  const trialList = trials.length
    ? `<ul class="history">${trials.map(x =>
        `<li><b>${esc(x.title || t('trials.one'))}</b> <span class="hint">${fmtDate(x.date)}</span></li>`).join('')}</ul>`
    : `<p class="hint">${t('fabrics.notUsed')}</p>`;

  root.innerHTML = page({
    title: r.name || r.label || t('fabrics.one'),
    sub: r.label,
    actions: `<button class="btn quiet" data-back>${t('common.back')}</button>
              <button class="btn primary" data-edit>${t('common.edit')}</button>`,
    body: `
      <div class="headline">
        ${r.photoData ? `<img src="${r.photoData}" alt="">` : ''}
        <div class="headlinebody">
          <h2>${esc(r.name || '—')} <span class="chip">${esc(await label('fabric_state', currentState(r)))}</span></h2>
          <div class="latin">${esc(r.label || '')}</div>
          ${cured != null ? `<p class="hint">${t('fabrics.curedFor', { n: cured })}</p>` : ''}
          ${qty > 1 ? `<p class="hint">${t('fabrics.pieces', { n: qty })}</p>` : ''}
          ${parent ? `<p class="hint" data-open="${parent.id}" style="cursor:pointer">${t('fabrics.fromBatch', { label: esc(parent.label) })}</p>` : ''}
        </div>
      </div>

      <div class="cols">
        <div class="col">
          ${readBlock(t('fabrics.readIdentity'), facts([
            fact(t('fabrics.readComposition'), `<b>${esc(compNames)}</b>`),
            fact(t('fabrics.col.class'), esc(await label('fibre_class', cls))),
            fact(t('fabrics.structure'), esc(await label('fabric_structure', r.structure))),
            fact(t('fabrics.form'), esc(await label('fabric_form', r.form))),
            fact(t('fabrics.weightG'), r.weightG ? `<b>${r.weightG} г</b>` : ''),
            fact(t('fabrics.dimensions'), esc(r.dimensions || '')),
            fact(t('fabrics.gsm'), r.weightGsm ? `${r.weightGsm} г/м²` : ''),
            fact(t('fabrics.origin'), esc(r.origin === 'reclaimed'
              ? [t('fabrics.origin.reclaimed'), r.originDetail?.wasA, r.originDetail?.condition].filter(Boolean).join(' · ')
              : [t('fabrics.origin.new'), r.originDetail?.supplier].filter(Boolean).join(' · '))),
          ]))}
          ${readBlock(t('common.notes'), r.notes ? `<div class="prose"><p>${esc(r.notes)}</p></div>` : '')}
        </div>

        <div class="col">
          ${readBlock(t('fabrics.biography'), timeline ? `<ul class="timeline">${timeline}</ul>` : '')}
          ${readBlock(t('fabrics.usedIn'), trialList)}

          ${qty > 1 ? panel(`
            <h2>${t('fabrics.batch')} — ${t('fabrics.pieces', { n: qty })}</h2>
            <p class="note">${t('fabrics.splitHint')}</p>
            <div class="mediumrow">
              <input type="number" min="1" max="${qty - 1}" value="1" data-splitcount>
              <button class="btn" data-split>${t('fabrics.splitDo')}</button>
            </div>
          `) : ''}

          ${children.length ? readBlock(t('fabrics.splitOff'), `<ul class="history">${children.map(c =>
            `<li data-open="${c.id}" style="cursor:pointer"><b>${esc(c.label)}</b> <span class="hint">${esc(c.name || '')}</span></li>`).join('')}</ul>`) : ''}
        </div>
      </div>`,
  });
}

// ---------------------------------------------------------------- form view

async function compositionRows(composition) {
  const rows = await Promise.all(composition.map(async (c, i) => `
    <div class="comprow">
      <select data-comp-fibre="${i}">${await options('fibre', c.fibreCode, '—')}</select>
      <input type="number" min="0" max="100" step="0.5" value="${c.percent ?? ''}"
             data-comp-pct="${i}" aria-label="${t('fabrics.percent')}">
      <span class="pct">%</span>
      <button class="btn quiet" data-comp-del="${i}" aria-label="${t('fabrics.removeFibre')}">×</button>
    </div>`));
  return rows.join('');
}

async function derivedBlock(composition) {
  const cls = fibreClass(composition);
  const receptive = dyeReceptiveFraction(composition);
  const lines = [];

  if (cls) {
    lines.push(note(t('fabrics.derived', { cls: esc(await label('fibre_class', cls)), pct: receptive })));
  }
  for (const w of compositionWarnings(composition)) {
    if (w.code === 'total') {
      lines.push(note(t('fabrics.warn.total', { total: w.total }), 'error'));
    }
    if (w.code === 'mixed') {
      lines.push(note(t('fabrics.warn.mixed'), 'warn'));
    }
    if (w.code === 'synthetic_major') {
      lines.push(note(t('fabrics.warn.synthetic', { pct: w.percent }), 'warn'));
    }
  }
  return lines.join('');
}

async function renderForm(root, record) {
  const isNew = openId === 'new';

  const originFields = record.origin === 'reclaimed'
    ? field(t('fabrics.wasA'), `<input type="text" data-f="originDetail.wasA" value="${esc(record.originDetail?.wasA || '')}" placeholder="${t('fabrics.wasAPlaceholder')}">`) +
      field(t('fabrics.condition'), `<input type="text" data-f="originDetail.condition" value="${esc(record.originDetail?.condition || '')}">`)
    : field(t('fabrics.supplier'), `<input type="text" data-f="originDetail.supplier" value="${esc(record.originDetail?.supplier || '')}">`) +
      field(t('fabrics.purchaseDate'), `<input type="date" data-f="originDetail.purchaseDate" value="${esc(record.originDetail?.purchaseDate || '')}">`);

  const history = stateHistory(record);
  const historyRows = history.length
    ? (await Promise.all(history.map(async e => `
        <li><b>${esc(await label('fabric_state', e.stateCode))}</b>
        <span class="hint">${fmtDate(e.date)}</span></li>`))).join('')
    : `<li class="hint">${t('fabrics.noTransitions')}</li>`;

  root.innerHTML = page({
    title: isNew ? t('fabrics.new') : (record.name || record.label || t('fabrics.one')),
    sub: isNew ? t('fabrics.newSub') : record.label,
    actions: `<button class="btn quiet" data-back>${t('common.back')}</button>
              <button class="btn primary" data-save>${t('common.save')}</button>`,
    body: `
      <div class="cols">
        <div class="col">
          ${panel(`
            <h2>${t('fabrics.identity')}</h2>
            <div class="photobox">
              ${record.photoData
                ? `<img class="plantphoto" src="${record.photoData}" alt="">
                   <button class="btn quiet" data-photo-del>${t('fabrics.removePhoto')}</button>`
                : `<label class="btn quiet" for="fabricphoto">${t('fabrics.addPhoto')}</label>`}
              <input type="file" id="fabricphoto" accept="image/*" hidden>
              <p class="hint">${t('fabrics.photoHint')}</p>
            </div>
            <div class="photobox">
              ${record.photoData
                ? `<img class="plantphoto" src="${record.photoData}" alt="">
                   <button class="btn quiet" data-photo-del>${t('fabrics.removePhoto')}</button>`
                : `<label class="btn quiet" for="fabricphoto">${t('fabrics.addPhoto')}</label>`}
              <input type="file" id="fabricphoto" accept="image/*" hidden>
              <p class="hint">${t('fabrics.photoHint')}</p>
            </div>
            ${field(t('fabrics.label'), `<input type="text" data-f="label" class="mono" value="${esc(record.label || '')}">`,
              t('fabrics.labelHint'))}
            ${field(t('fabrics.name'), `<input type="text" data-f="name" value="${esc(record.name || '')}" placeholder="${t('fabrics.namePlaceholder')}">`)}
            ${field(t('fabrics.origin'), `<select data-f="origin">
                <option value="new"${record.origin === 'new' ? ' selected' : ''}>${t('fabrics.origin.new')}</option>
                <option value="reclaimed"${record.origin === 'reclaimed' ? ' selected' : ''}>${t('fabrics.origin.reclaimed')}</option>
              </select>`)}
            ${originFields}
            ${field(t('fabrics.form'), `<select data-f="form">${await options('fabric_form', record.form)}</select>`)}
            ${field(t('fabrics.structure'), `<select data-f="structure">${await options('fabric_structure', record.structure)}</select>`)}
            ${field(t('fabrics.baseColour'), `<select data-f="baseColour">
                <option value="natural"${record.baseColour === 'natural' ? ' selected' : ''}>${t('fabrics.colour.natural')}</option>
                <option value="bleached"${record.baseColour === 'bleached' ? ' selected' : ''}>${t('fabrics.colour.bleached')}</option>
                <option value="predyed"${record.baseColour === 'predyed' ? ' selected' : ''}>${t('fabrics.colour.predyed')}</option>
                <option value="dyed_by_me"${record.baseColour === 'dyed_by_me' ? ' selected' : ''}>${t('fabrics.colour.dyed_by_me')}</option>
              </select>`)}
          `)}

          ${panel(`
            <h2>${t('fabrics.composition')}</h2>
            <div class="complist">${await compositionRows(record.composition || [])}</div>
            <button class="btn quiet" data-comp-add>${t('fabrics.addFibre')}</button>
            <div class="derived">${await derivedBlock(record.composition || [])}</div>
          `)}
        </div>

        <div class="col">
          ${panel(`
            <h2>${t('fabrics.measure')}</h2>
            ${field(t('fabrics.weightG'), `<input type="number" step="1" min="0" data-f="weightG" value="${record.weightG ?? ''}">`,
              t('fabrics.weightHint'))}
            ${field(t('fabrics.dimensions'), `<input type="text" data-f="dimensions" value="${esc(record.dimensions || '')}" placeholder="${t('fabrics.dimensionsPlaceholder')}">`)}
            ${field(t('fabrics.gsm'), `<input type="number" step="1" min="0" data-f="weightGsm" value="${record.weightGsm ?? ''}">`)}
            ${field(t('fabrics.quantity'), `<input type="number" step="0.1" min="0" data-f="quantity.value" value="${record.quantity?.value ?? 1}">`)}
            ${isNew ? field(t('fabrics.count'), `<input type="number" step="1" min="1" max="50" data-f="count" value="${record.count ?? 1}">`, t('fabrics.countHint')) : ''}
          `)}

          ${panel(`
            <h2>${t('fabrics.boxHistory')}</h2>
            ${isNew
              ? field(t('fabrics.initialState'), `<select data-f="state">${await options('fabric_state', record.state, '')}</select>`,
                  t('fabrics.initialStateHint'))
              : `<p class="note">${t('fabrics.nowIn', { state: esc(await label('fabric_state', currentState(record))) })}</p>
                 <ul class="history">${historyRows}</ul>
                 <div class="addstate">
                   ${field(t('fabrics.newTransition'), `<select data-newstate>${await options('fabric_state', '', t('common.choose'))}</select>`)}
                   ${field(t('common.date'), `<input type="date" data-newstate-date value="${today()}">`)}
                   <button class="btn" data-add-state>${t('fabrics.addTransition')}</button>
                 </div>`}
          `)}

          ${panel(`
            <h2>${t('common.notes')}</h2>
            ${field('', `<textarea data-f="notes" rows="4" placeholder="${t('fabrics.notesPlaceholder')}">${esc(record.notes || '')}</textarea>`)}
            ${!isNew ? `<button class="btn danger quiet" data-delete>${t('fabrics.delete')}</button>` : ''}
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
  const comp = [];
  for (const sel of root.querySelectorAll('[data-comp-fibre]')) {
    const i = sel.dataset.compFibre;
    const pct = root.querySelector(`[data-comp-pct="${i}"]`);
    if (sel.value) comp.push({ fibreCode: sel.value, percent: Number(pct.value) || 0 });
  }
  draft.composition = comp;
}

async function refreshDerived(root) {
  readForm(root);
  const box = root.querySelector('.derived');
  if (box) box.innerHTML = await derivedBlock(draft.composition);
}

export default {
  id: 'fabrics',
  title: () => t('fabrics.title'),
  sub: () => t('fabrics.sub'),

  // Choosing a module in the navigation means "take me to this module", not
  // "show me whatever I last had open in it". Called by the router on entry.
  reset() {
    openId = null;
    draft = null;
    editing = false;
    filterState = null;
    selected.clear();
    bulkState = '';
  },

  async render(root) {
    if (openId) {
      if (!draft || (openId !== 'new' && draft.id !== openId)) {
        draft = openId === 'new' ? blank() : structuredClone(await get('fabrics', openId));
        if (openId === 'new' && !draft.label) draft.label = await nextLabel();
      }
      if (editing || openId === 'new') await renderForm(root, draft);
      else await renderRead(root, draft);
    } else {
      draft = null;
      await renderList(root);
    }

    root.onclick = async (e) => {
      const box = e.target.closest('[data-box]');
      if (box) { filterState = box.dataset.box || null; return this.render(root); }

      if (e.target.closest('[data-new]')) { draft = null; openId = 'new'; editing = true; return this.render(root); }
      if (e.target.closest('[data-edit]')) { editing = true; return this.render(root); }

      const row = e.target.closest('[data-open]');
      if (row) { draft = null; openId = row.dataset.open; editing = false; return this.render(root); }

      if (e.target.closest('[data-back]')) {
        if (editing && openId !== 'new') { editing = false; return this.render(root); }
        openId = null; draft = null; editing = false;
        return this.render(root);
      }

      if (e.target.closest('[data-comp-add]')) {
        readForm(root);
        draft.composition.push({ fibreCode: '', percent: 0 });
        return renderForm(root, draft);
      }

      const del = e.target.closest('[data-comp-del]');
      if (del) {
        readForm(root);
        draft.composition.splice(Number(del.dataset.compDel), 1);
        return renderForm(root, draft);
      }

      if (e.target.closest('[data-add-state]')) {
        const code = root.querySelector('[data-newstate]').value;
        const date = root.querySelector('[data-newstate-date]').value;
        if (!code) return;
        readForm(root);
        draft.stateEvents = draft.stateEvents || [];
        draft.stateEvents.push({
          id: uid(), date, stateCode: code,
          recipeId: null, trialId: null, note: '',
          createdAt: new Date().toISOString(),
        });
        await put('fabrics', draft);
        return renderForm(root, draft);
      }

      if (e.target.closest('[data-photo-del]')) {
        readForm(root);
        draft.photoData = null;
        return renderForm(root, draft);
      }

      if (e.target.closest('[data-bulk-clear]')) { selected.clear(); return this.render(root); }

      // Fifteen pieces into one mordant bath is one action, not fifteen. Doing
      // it record by record is where the habit of recording dies.
      if (e.target.closest('[data-bulk-apply]')) {
        if (!bulkState) return;
        const stamp = today();
        for (const id of selected) {
          const f = await get('fabrics', id);
          if (!f) continue;
          f.stateEvents = f.stateEvents || [];
          f.stateEvents.push({
            id: uid(), date: stamp, stateCode: bulkState,
            recipeId: null, trialId: null, note: '',
            createdAt: new Date().toISOString(),
          });
          await put('fabrics', f);
        }
        alert(t('fabrics.bulkDone', { n: selected.size }));
        selected.clear(); bulkState = '';
        return this.render(root);
      }

      if (e.target.closest('[data-photo-del]')) {
        readForm(root);
        draft.photoData = null;
        return renderForm(root, draft);
      }

      // Ten identical scarves stay one record until one of them stops being
      // identical. Splitting a piece off — rather than creating ten records up
      // front — matches when the divergence actually happens.
      if (e.target.closest('[data-split]')) {
        const n = Math.max(1, Math.min(
          (Number(draft.quantity?.value) || 1) - 1,
          Number(root.querySelector('[data-splitcount]')?.value) || 1));

        for (let i = 0; i < n; i++) {
          const piece = structuredClone(draft);
          piece.id = uid();
          piece.label = await nextLabel();
          piece.quantity = { value: 1, unit: draft.quantity?.unit || 'pcs' };
          piece.fromBatchId = draft.id;
          piece.stateEvents = [];
          piece.createdAt = new Date().toISOString();
          await put('fabrics', piece);
        }

        draft.quantity = { ...draft.quantity, value: (Number(draft.quantity?.value) || 1) - n };
        await put('fabrics', draft);
        alert(t('fabrics.splitDone', { n, left: draft.quantity.value }));
        return this.render(root);
      }

      if (e.target.closest('[data-save]')) {
        readForm(root);
        const total = compositionTotal(draft.composition);
        if (draft.composition.length && Math.round(total) !== 100 &&
            !confirm(t('fabrics.confirmTotal', { total }))) return;
        // Ten identical scarves really are ten pieces: each gets washed,
        // mordanted and used on its own schedule. What was missing was not a
        // quantity field but a way to create them in one go.
        const count = Math.max(1, Math.min(50, Number(draft.count) || 1));
        delete draft.count;

        if (openId === 'new' && count > 1) {
          const labels = [draft.label];
          await put('fabrics', draft);
          for (let i = 1; i < count; i++) {
            const copy = structuredClone(draft);
            copy.id = uid();
            copy.label = await nextLabel();
            copy.createdAt = new Date().toISOString();
            labels.push(copy.label);
            await put('fabrics', copy);
          }
          alert(t('fabrics.created', { n: count, from: labels[0], to: labels[labels.length - 1] }));
          openId = null; draft = null; editing = false;
          return this.render(root);
        }

        await put('fabrics', draft);
        // Saving returns to reading the record, not to the form it was just
        // written in — otherwise a new piece leaves one staring at empty fields.
        openId = draft.id;
        editing = false;
        return this.render(root);
      }

      if (e.target.closest('[data-delete]')) {
        if (!confirm(t('fabrics.confirmDelete'))) return;
        await remove('fabrics', draft.id);
        openId = null; draft = null;
        return this.render(root);
      }
    };

    root.onchange = async (e) => {
      const pick = e.target.closest('[data-pick]');
      if (pick) {
        pick.checked ? selected.add(pick.dataset.pick) : selected.delete(pick.dataset.pick);
        return this.render(root);
      }
      if (e.target.matches('[data-bulkstate]')) { bulkState = e.target.value; return this.render(root); }

      if (e.target.id === 'fabricphoto' && e.target.files?.[0]) {
        readForm(root);
        draft.photoData = await shrinkThumb(e.target.files[0]);
        return renderForm(root, draft);
      }

      if (e.target.matches('[data-f="origin"]')) {
        readForm(root);
        return renderForm(root, draft);
      }
      if (e.target.matches('[data-comp-fibre]')) await refreshDerived(root);
    };

    root.oninput = async (e) => {
      if (e.target.matches('[data-comp-pct]')) await refreshDerived(root);
    };

  },
};

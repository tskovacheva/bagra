// modules/fabrics.js — one record is one physical piece (§3, A.1).

import { all, get, put, remove, newRecord, getSetting, setSetting, uid } from '../db.js';
import { t } from '../i18n.js';
import { page, panel, field, options, label, esc, empty, note, today, fmtDate } from '../ui.js';
import {
  compositionTotal, dyeReceptiveFraction, fibreClass, compositionWarnings,
  currentState, stateHistory, daysSinceMordanted, STATE_ORDER,
} from '../fabric-logic.js';

let filterState = null;   // null = all boxes
let openId = null;        // null = list, 'new' = blank form, id = that record
let draft = null;

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
    photos: [],
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
      <td class="mono">${esc(f.label || '')}</td>
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
        <th>${t('fabrics.col.label')}</th><th>${t('fabrics.col.name')}</th><th>${t('fabrics.col.composition')}</th><th>${t('fabrics.col.class')}</th>
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
      ${panel(table, 'flush')}`,
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

  async render(root) {
    if (openId) {
      if (!draft || (openId !== 'new' && draft.id !== openId)) {
        draft = openId === 'new' ? blank() : structuredClone(await get('fabrics', openId));
        if (openId === 'new' && !draft.label) draft.label = await nextLabel();
      }
      await renderForm(root, draft);
    } else {
      draft = null;
      await renderList(root);
    }

    root.onclick = async (e) => {
      const box = e.target.closest('[data-box]');
      if (box) { filterState = box.dataset.box || null; return this.render(root); }

      if (e.target.closest('[data-new]')) { draft = null; openId = 'new'; return this.render(root); }

      const row = e.target.closest('[data-open]');
      if (row) { draft = null; openId = row.dataset.open; return this.render(root); }

      if (e.target.closest('[data-back]')) { openId = null; draft = null; return this.render(root); }

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

      if (e.target.closest('[data-save]')) {
        readForm(root);
        const total = compositionTotal(draft.composition);
        if (draft.composition.length && Math.round(total) !== 100 &&
            !confirm(t('fabrics.confirmTotal', { total }))) return;
        await put('fabrics', draft);
        openId = null; draft = null;
        return this.render(root);
      }

      if (e.target.closest('[data-delete]')) {
        if (!confirm(t('fabrics.confirmDelete'))) return;
        await remove('fabrics', draft.id);
        openId = null; draft = null;
        return this.render(root);
      }
    };

    root.oninput = async (e) => {
      if (e.target.matches('[data-comp-pct]')) await refreshDerived(root);
    };

    root.onchange = async (e) => {
      if (e.target.matches('[data-f="origin"]')) {
        readForm(root);
        return renderForm(root, draft);
      }
      if (e.target.matches('[data-comp-fibre]')) await refreshDerived(root);
    };
  },
};

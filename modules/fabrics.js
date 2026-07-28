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
  return 'П-' + String(n).padStart(3, '0');
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
      <td class="num">${f.weightG ? f.weightG + ' г' : '—'}</td>
      <td><span class="chip">${esc(await label('fabric_state', currentState(f)))}</span>${
        cured != null ? `<span class="hint"> · ${cured} дни</span>` : ''}</td>
    </tr>`;
  }));

  const table = shown.length ? `
    <table class="grid">
      <thead><tr>
        <th>Етикет</th><th>Име</th><th>Състав</th><th>Клас</th>
        <th>Структура</th><th class="num">Тегло</th><th>Кутия</th>
      </tr></thead>
      <tbody>${rows.join('')}</tbody>
    </table>`
    : empty(
        filterState ? 'В тази кутия няма нищо.' : 'Още няма записани тъкани.',
        'Всеки запис е едно физическо парче — една дреха, един шал, едно руло.');

  root.innerHTML = page({
    title: t('fabrics.title'),
    sub: t('fabrics.sub'),
    actions: `<button class="btn primary" data-new>Нова тъкан</button>`,
    body: `
      <div class="boxes">
        <button class="box${filterState === null ? ' active' : ''}" data-box="">
          <span class="boxname">Всички</span>
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
             data-comp-pct="${i}" aria-label="процент">
      <span class="pct">%</span>
      <button class="btn quiet" data-comp-del="${i}" aria-label="премахни">×</button>
    </div>`));
  return rows.join('');
}

async function derivedBlock(composition) {
  const cls = fibreClass(composition);
  const receptive = dyeReceptiveFraction(composition);
  const lines = [];

  if (cls) {
    lines.push(note(`Клас влакно: <b>${esc(await label('fibre_class', cls))}</b> · багрилоприемаща част: <b>${receptive}%</b>`));
  }
  for (const w of compositionWarnings(composition)) {
    if (w.code === 'total') {
      lines.push(note(`Съставът дава <b>${w.total}%</b> вместо 100%.`, 'error'));
    }
    if (w.code === 'mixed') {
      lines.push(note('Смесена целулоза и протеин — двете части приемат мордант и цвят различно. Един мордантен маршрут няма да свърши работа за целия плат.', 'warn'));
    }
    if (w.code === 'synthetic_major') {
      lines.push(note(`${w.percent}% синтетика — по-голямата част от плата няма да приеме багрило.`, 'warn'));
    }
  }
  return lines.join('');
}

async function renderForm(root, record) {
  const isNew = openId === 'new';

  const originFields = record.origin === 'reclaimed'
    ? field('Какво е било', `<input type="text" data-f="originDetail.wasA" value="${esc(record.originDetail?.wasA || '')}" placeholder="стар чаршаф, тениска…">`) +
      field('Състояние', `<input type="text" data-f="originDetail.condition" value="${esc(record.originDetail?.condition || '')}">`)
    : field('Доставчик', `<input type="text" data-f="originDetail.supplier" value="${esc(record.originDetail?.supplier || '')}">`) +
      field('Дата на покупка', `<input type="date" data-f="originDetail.purchaseDate" value="${esc(record.originDetail?.purchaseDate || '')}">`);

  const history = stateHistory(record);
  const historyRows = history.length
    ? (await Promise.all(history.map(async e => `
        <li><b>${esc(await label('fabric_state', e.stateCode))}</b>
        <span class="hint">${fmtDate(e.date)}</span></li>`))).join('')
    : `<li class="hint">Още няма записани преходи.</li>`;

  root.innerHTML = page({
    title: isNew ? 'Нова тъкан' : (record.name || record.label || 'Тъкан'),
    sub: isNew ? 'Едно парче — една дреха, един шал, едно руло.' : record.label,
    actions: `<button class="btn quiet" data-back>Назад</button>
              <button class="btn primary" data-save>Запази</button>`,
    body: `
      <div class="cols">
        <div class="col">
          ${panel(`
            <h2>Идентичност</h2>
            ${field('Етикет', `<input type="text" data-f="label" class="mono" value="${esc(record.label || '')}">`,
              'Кодът, който пишеш на етикета с безопасната игла.')}
            ${field('Име', `<input type="text" data-f="name" value="${esc(record.name || '')}" placeholder="стар чаршаф, копринен шал…">`)}
            ${field('Произход', `<select data-f="origin">
                <option value="new"${record.origin === 'new' ? ' selected' : ''}>нов плат</option>
                <option value="reclaimed"${record.origin === 'reclaimed' ? ' selected' : ''}>стара дреха / втора употреба</option>
              </select>`)}
            ${originFields}
            ${field('Форма', `<select data-f="form">${await options('fabric_form', record.form)}</select>`)}
            ${field('Структура', `<select data-f="structure">${await options('fabric_structure', record.structure)}</select>`)}
            ${field('Основен цвят', `<select data-f="baseColour">
                <option value="natural"${record.baseColour === 'natural' ? ' selected' : ''}>суров</option>
                <option value="bleached"${record.baseColour === 'bleached' ? ' selected' : ''}>избелен</option>
                <option value="predyed"${record.baseColour === 'predyed' ? ' selected' : ''}>вече боядисан</option>
                <option value="dyed_by_me"${record.baseColour === 'dyed_by_me' ? ' selected' : ''}>боядисан от мен</option>
              </select>`)}
          `)}

          ${panel(`
            <h2>Състав</h2>
            <div class="complist">${await compositionRows(record.composition || [])}</div>
            <button class="btn quiet" data-comp-add>+ влакно</button>
            <div class="derived">${await derivedBlock(record.composition || [])}</div>
          `)}
        </div>

        <div class="col">
          ${panel(`
            <h2>Мярка</h2>
            ${field('Тегло (г)', `<input type="number" step="1" min="0" data-f="weightG" value="${record.weightG ?? ''}">`,
              'Нужно е за всяко изчисление в % WOF.')}
            ${field('Размери', `<input type="text" data-f="dimensions" value="${esc(record.dimensions || '')}" placeholder="40×180 см, размер M">`)}
            ${field('Плътност (г/м²)', `<input type="number" step="1" min="0" data-f="weightGsm" value="${record.weightGsm ?? ''}">`)}
            ${field('Количество', `<input type="number" step="0.1" min="0" data-f="quantity.value" value="${record.quantity?.value ?? 1}">`)}
          `)}

          ${panel(`
            <h2>Кутия и история</h2>
            ${isNew
              ? field('Начално състояние', `<select data-f="state">${await options('fabric_state', record.state, '')}</select>`,
                  'В коя кутия влиза сега.')
              : `<p class="note">Сега е в кутия <b>${esc(await label('fabric_state', currentState(record)))}</b>.</p>
                 <ul class="history">${historyRows}</ul>
                 <div class="addstate">
                   ${field('Нов преход', `<select data-newstate>${await options('fabric_state', '', 'избери…')}</select>`)}
                   ${field('Дата', `<input type="date" data-newstate-date value="${today()}">`)}
                   <button class="btn" data-add-state>Запиши прехода</button>
                 </div>`}
          `)}

          ${panel(`
            <h2>Бележки</h2>
            ${field('', `<textarea data-f="notes" rows="4" placeholder="как се свива, как приема цвят…">${esc(record.notes || '')}</textarea>`)}
            ${!isNew ? `<button class="btn danger quiet" data-delete>Изтрий тъканта</button>` : ''}
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
            !confirm(`Съставът дава ${total}% вместо 100%. Да запазя ли така?`)) return;
        await put('fabrics', draft);
        openId = null; draft = null;
        return this.render(root);
      }

      if (e.target.closest('[data-delete]')) {
        if (!confirm('Да изтрия ли тази тъкан?')) return;
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

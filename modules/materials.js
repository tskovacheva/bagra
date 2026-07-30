// modules/materials.js — Stock: what is actually on the shelf (§13.4).
//
// Personal, never distributed. Points at a Substance rather than repeating it,
// so a recipe never breaks when a jar runs out.

import { all, get, put, remove, newRecord } from '../db.js';
import { t, text } from '../i18n.js';
import { page, panel, field, esc, empty, fmtDate } from '../ui.js';

const FORMS = ['powder', 'crystal', 'liquid', 'extract', 'dried', 'fresh'];

let openId = null;
let draft = null;

function blank() {
  return newRecord({
    substanceId: '',
    form: 'powder',
    supplier: '',
    acquiredDate: '',
    harvestDate: '',
    quantity: { value: null, unit: 'g' },
    remaining: { value: null, unit: 'g' },
    concentrationPercent: null,
    batchNote: '',
    notes: '',
  });
}

async function substanceOptions(selected) {
  const subs = (await all('substances'))
    .sort((a, b) => text(a.name).localeCompare(text(b.name)));
  if (!subs.length) return `<option value="">${esc(t('stock.pickSubstance'))}</option>`;
  return `<option value="">—</option>` + subs.map(sx =>
    `<option value="${sx.id}"${sx.id === selected ? ' selected' : ''}>${esc(text(sx.name))}</option>`).join('');
}

async function renderList(root) {
  const rowsData = await all('stock');
  const subs = await all('substances');
  const byId = Object.fromEntries(subs.map(sx => [sx.id, sx]));

  const shown = rowsData.sort((a, b) => (b.acquiredDate || '').localeCompare(a.acquiredDate || ''));

  const rows = shown.map(sx => {
    const sub = byId[sx.substanceId];
    const left = sx.remaining?.value ?? sx.quantity?.value;
    return `<tr data-open="${sx.id}">
      <td>${esc(sub ? text(sub.name) : '—')}</td>
      <td>${esc(t('stock.form.' + sx.form))}</td>
      <td>${esc(sx.supplier || '—')}</td>
      <td>${fmtDate(sx.acquiredDate)}</td>
      <td class="num">${left != null ? esc(left + ' ' + (sx.quantity?.unit || '')) : '—'}</td>
      <td class="num">${sx.concentrationPercent != null ? sx.concentrationPercent + '%' : '—'}</td>
    </tr>`;
  }).join('');

  const table = shown.length ? `
    <table class="grid">
      <thead><tr>
        <th>${t('stock.substance')}</th>
        <th>${t('stock.form')}</th>
        <th>${t('stock.supplier')}</th>
        <th>${t('stock.acquired')}</th>
        <th class="num">${t('stock.remaining')}</th>
        <th class="num">${t('stock.concentration')}</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`
    : empty(t('stock.empty'), t('stock.emptyHint'));

  root.innerHTML = page({
    title: t('stock.title'),
    sub: t('stock.sub'),
    actions: `<button class="btn primary" data-new>${t('stock.new')}</button>`,
    body: panel(table, 'flush'),
  });
}

async function renderForm(root, r) {
  const isNew = openId === 'new';
  const sub = r.substanceId ? await get('substances', r.substanceId) : null;

  root.innerHTML = page({
    title: isNew ? t('stock.new') : (sub ? text(sub.name) : t('stock.one')),
    sub: isNew ? t('stock.emptyHint') : '',
    actions: `<button class="btn quiet" data-back>${t('common.back')}</button>
              <button class="btn primary" data-save>${t('common.save')}</button>`,
    body: `
      <div class="cols">
        <div class="col">
          ${panel(`
            <h2>${t('stock.one')}</h2>
            ${field(t('stock.substance'), `<select data-f="substanceId">${await substanceOptions(r.substanceId)}</select>`)}
            ${field(t('stock.form'), `<select data-f="form">${
              FORMS.map(f => `<option value="${f}"${r.form === f ? ' selected' : ''}>${t('stock.form.' + f)}</option>`).join('')
            }</select>`)}
            ${field(t('stock.supplier'), `<input type="text" data-f="supplier" value="${esc(r.supplier || '')}">`)}
            ${field(t('stock.acquired'), `<input type="date" data-f="acquiredDate" value="${esc(r.acquiredDate || '')}">`)}
            ${['dried', 'fresh'].includes(r.form)
              ? field(t('stock.harvestDate'), `<input type="date" data-f="harvestDate" value="${esc(r.harvestDate || '')}">`)
              : ''}
          `)}
        </div>

        <div class="col">
          ${panel(`
            <h2>${t('stock.quantity')}</h2>
            ${field(t('stock.quantity'), `<input type="number" step="0.1" min="0" data-f="quantity.value" value="${r.quantity?.value ?? ''}">`)}
            ${field(t('stock.remaining'), `<input type="number" step="0.1" min="0" data-f="remaining.value" value="${r.remaining?.value ?? ''}">`)}
            ${field(t('stock.unit'), `<input type="text" data-f="quantity.unit" value="${esc(r.quantity?.unit || '')}" placeholder="g, ml, l">`)}
            ${field(t('stock.concentration'), `<input type="number" step="0.1" min="0" max="100" data-f="concentrationPercent" value="${r.concentrationPercent ?? ''}">`, t('stock.concentrationHint'))}
            ${field(t('stock.batch'), `<input type="text" data-f="batchNote" value="${esc(r.batchNote || '')}">`)}
          `)}

          ${panel(`
            <h2>${t('common.notes')}</h2>
            ${field('', `<textarea data-f="notes" rows="3">${esc(r.notes || '')}</textarea>`)}
            ${!isNew ? `<button class="btn danger quiet" data-delete>${t('stock.delete')}</button>` : ''}
          `)}
        </div>
      </div>`,
  });
}

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
  if (draft.quantity?.unit) draft.remaining.unit = draft.quantity.unit;
}

export default {
  id: 'materials',
  title: () => t('stock.title'),
  sub: () => t('stock.sub'),

  // Choosing a module in the navigation means "take me to this module", not
  // "show me whatever I last had open in it". Called by the router on entry.
  reset() {
    openId = null;
    draft = null;
  },

  async render(root) {
    if (openId) {
      if (!draft || (openId !== 'new' && draft.id !== openId)) {
        draft = openId === 'new' ? blank() : structuredClone(await get('stock', openId));
      }
      await renderForm(root, draft);
    } else {
      draft = null;
      await renderList(root);
    }

    root.onclick = async (e) => {
      if (e.target.closest('[data-new]')) { draft = null; openId = 'new'; return this.render(root); }
      const row = e.target.closest('[data-open]');
      if (row) { draft = null; openId = row.dataset.open; return this.render(root); }
      if (e.target.closest('[data-back]')) { openId = null; draft = null; return this.render(root); }
      if (e.target.closest('[data-save]')) {
        readForm(root);
        await put('stock', draft);
        openId = null; draft = null;
        return this.render(root);
      }
      if (e.target.closest('[data-delete]')) {
        if (!confirm(t('stock.confirmDelete'))) return;
        await remove('stock', draft.id);
        openId = null; draft = null;
        return this.render(root);
      }
    };

    root.onchange = async (e) => {
      if (e.target.matches('[data-f="form"]')) {
        readForm(root);
        return renderForm(root, draft);
      }
    };
  },
};

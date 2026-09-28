// modules/plans.js — Plans (§13fj).
//
// What she means to try, why, and which variants — before any of it is a
// trial. The rest of the diary records what was done; a plan records intent.
// Deliberately small: a title, a status, notes, and a checklist of plain lines.
// A line is text and a tick, never a structured experiment — „N5 — Nikolleta
// with 5 g Fe" is written the way she would write it on paper.
//
// No links to plants, recipes, fabrics or trials in v1. The intended next step
// is „this line → a trial", which can be added later as an optional reference
// on an item without changing anything here.

import { all, get, put, uid } from '../db.js';
import { t } from '../i18n.js';
import { markClean, markDirty } from '../dirty.js';
import { page, panel, field, esc, empty, navigate, backTo, actionBtn, fmtDate,
         deleteGuarded, flash } from '../ui.js';

// The four states, in the order a plan moves through them. Interface labels
// only (i18n.js, `plans.status.*`) — not vocabulary: nothing else in the model
// reads them, and they are not reference data.
export const PLAN_STATUSES = ['idea', 'planned', 'active', 'done'];

// Drawn with the trial's status chip rather than a new one. `idea` takes the
// plain chip: it has not been committed to yet, which is what an unaccented
// chip says.
const CHIP = { idea: '', planned: 'planned', active: 'in_progress', done: 'complete' };

let openId = null;
let draft = null;

// The whole record. Nothing else is added to it — no provenance fields: a plan
// is never seeded, never packed, never distributed.
export function blankPlan() {
  const now = new Date().toISOString();
  return { id: uid(), title: '', createdAt: now, updatedAt: now,
           status: 'idea', notes: '', items: [] };
}

export const progressOf = (p) => {
  const items = Array.isArray(p?.items) ? p.items : [];
  return { done: items.filter(i => i.checked).length, of: items.length };
};

const statusOf = (p) => PLAN_STATUSES.includes(p?.status) ? p.status : 'idea';
const chip = (p) =>
  `<span class="statuschip ${CHIP[statusOf(p)]}">${esc(t('plans.status.' + statusOf(p)))}</span>`;

// ---- list -----------------------------------------------------------------

async function renderList(root) {
  const plans = await all('plans');
  // Open plans first, newest touched first; finished ones after them. The list
  // is a working surface, and a done plan is reference rather than work.
  const rank = (p) => statusOf(p) === 'done' ? 1 : 0;
  plans.sort((a, b) => rank(a) - rank(b)
    || String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));

  const rows = plans.map(p => {
    const { done, of } = progressOf(p);
    return `
      <tr data-open="${esc(p.id)}">
        <td class="leadcell">${esc(p.title || t('plans.untitled'))}</td>
        <td>${chip(p)}</td>
        <td class="num">${of ? `${done} / ${of}` : '—'}</td>
        <td>${esc(fmtDate(p.updatedAt || p.createdAt))}</td>
      </tr>`;
  }).join('');

  root.innerHTML = page({
    title: t('plans.title'),
    sub: t('plans.sub'),
    actions: actionBtn('add', t('plans.new'), 'data-new', 'primary'),
    body: plans.length
      ? panel(`
          <table class="grid">
            <thead><tr>
              <th>${t('plans.titleLabel')}</th>
              <th>${t('plans.statusLabel')}</th>
              <th class="num">${t('plans.progress')}</th>
              <th>${t('plans.updated')}</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>`, 'flush')
      : empty(t('plans.empty'), t('plans.emptyHint')),
  });
}

// ---- one plan ---------------------------------------------------------------

function renderPlan(root, p) {
  const isNew = openId === 'new';
  const { done, of } = progressOf(p);

  const items = p.items.map((it, i) => `
    <div class="checkitem${it.checked ? ' ticked' : ''}">
      <label class="check"><input type="checkbox" data-i="${i}.checked" data-saves-itself${it.checked ? ' checked' : ''}
        aria-label="${esc(t('plans.itemDone'))}"></label>
      <input type="text" data-i="${i}.text" value="${esc(it.text)}"
        aria-label="${esc(t('plans.itemText'))}" placeholder="${esc(t('plans.itemPlaceholder'))}">
      <button class="btn quiet" data-item-del="${i}" aria-label="${esc(t('plans.itemDelete'))}">×</button>
    </div>`).join('');

  root.innerHTML = page({
    title: isNew ? t('plans.new') : (p.title || t('plans.untitled')),
    sub: isNew ? t('plans.sub') : '',
    actions: `${backTo('#/plans', t('plans.title'))}
              <button class="btn primary" data-save>${t('common.save')}</button>`,
    body: `
      <div class="cols">
        <div class="col">
          ${panel(`
            ${field(t('plans.titleLabel'), `<input type="text" data-f="title" value="${esc(p.title)}"
              placeholder="${esc(t('plans.titlePlaceholder'))}">`)}
            ${field(t('plans.statusLabel'), `<select data-f="status">${PLAN_STATUSES.map(s =>
              `<option value="${s}"${statusOf(p) === s ? ' selected' : ''}>${esc(t('plans.status.' + s))}</option>`).join('')}</select>`)}
            ${field(t('plans.notes'), `<textarea data-f="notes" rows="6"
              placeholder="${esc(t('plans.notesPlaceholder'))}">${esc(p.notes)}</textarea>`)}
          `)}
          ${!isNew ? `<div style="height:16px"></div>${panel(
            actionBtn('delete', t('plans.delete'), 'data-delete', 'destructive'))}` : ''}
        </div>
        <div class="col">
          ${panel(`
            <h2>${t('plans.checklist')}${of ? ` <span class="hint">${done} / ${of}</span>` : ''}</h2>
            ${of ? `<div class="checklist">${items}</div>` : `<p class="hint">${t('plans.checklistEmpty')}</p>`}
            <div style="height:10px"></div>
            ${actionBtn('add', t('plans.addItem'), 'data-item-add')}
          `)}
        </div>
      </div>`,
  });
}

let tickQueue = Promise.resolve();

// Writes one line's tick into the stored plan. Returns true when written.
export async function persistTick(planId, itemId, checked) {
  try {
    const stored = await get('plans', planId);
    const line = stored?.items?.find(i => i.id === itemId);
    if (!line) { markDirty(); return false; }   // nothing stored yet: it goes with Save
    line.checked = checked;
    const written = await put('plans', stored);   // stamps updatedAt
    if (draft?.id === planId) draft.updatedAt = written?.updatedAt ?? stored.updatedAt;
    return true;
  } catch (err) {
    // The tick is still in the draft, so Save will carry it; say so rather
    // than let a tick look saved that is not.
    markDirty();
    flash(t('plans.tickFailed'));
    return false;
  }
}

function readForm(root) {
  for (const el of root.querySelectorAll('[data-f]')) draft[el.dataset.f] = el.value;
  if (!PLAN_STATUSES.includes(draft.status)) draft.status = 'idea';
  for (const el of root.querySelectorAll('[data-i]')) {
    const [i, key] = el.dataset.i.split('.');
    const it = draft.items[Number(i)];
    if (!it) continue;
    if (key === 'checked') it.checked = el.checked;
    else it.text = el.value;
  }
}

export default {
  id: 'plans',
  title: () => t('plans.title'),
  sub: () => t('plans.sub'),

  open(first) { draft = null; openId = first || null; },
  reset() { openId = null; draft = null; },

  async render(root) {
    if (openId) {
      if (!draft || (openId !== 'new' && draft.id !== openId)) {
        draft = openId === 'new' ? blankPlan() : structuredClone(await get('plans', openId));
      }
      // An address naming a plan that is gone: back to the list rather than a
      // throw that leaves the previous screen up (§11b).
      if (!draft) return navigate('#/plans');
      draft.items = Array.isArray(draft.items) ? draft.items : [];
      renderPlan(root, draft);
    } else {
      draft = null;
      await renderList(root);
    }

    root.onclick = async (e) => {
      if (e.target.closest('a')) return;
      if (e.target.closest('[data-new]')) return navigate('#/plans/new');
      const row = e.target.closest('[data-open]');
      if (row) return navigate(`#/plans/${row.dataset.open}`);
      if (!draft) return;
      if (e.target.closest('[data-save]')) {
        readForm(root);
        draft.title = draft.title.trim();
        // A line with no words is a line nobody wrote; it is not kept.
        draft.items = draft.items.filter(it => String(it.text || '').trim());
        await put('plans', draft);
        markClean();   // the put succeeded; leaving is not a departure from unsaved work (§13ad)
        return navigate('#/plans');
      }
      if (e.target.closest('[data-item-add]')) {
        readForm(root);
        draft.items.push({ id: uid(), text: '', checked: false });
        this.render(root);
        const inputs = root.querySelectorAll('.checkitem input[type=text]');
        inputs[inputs.length - 1]?.focus();
        return;
      }
      const del = e.target.closest('[data-item-del]');
      if (del) {
        readForm(root);
        draft.items.splice(Number(del.dataset.itemDel), 1);
        return this.render(root);
      }
      if (e.target.closest('[data-delete]')) {
        if (!await deleteGuarded('plans', draft.id, t('plans.confirmDelete'))) return;
        markClean();
        return navigate('#/plans');
      }
    };

    // A tick is a finished act and is written at once (§13fk). Only the tick:
    // the title, notes, status and the words of a line wait for Save.
    //
    // WHAT IS WRITTEN is the STORED plan with one line's `checked` changed —
    // never the draft. The draft may hold notes typed a minute ago and not
    // saved; writing it would save them behind her back, and writing a stale
    // copy over the stored one could undo a save. The draft is updated too, so
    // a Save later carries the same tick and cannot revert it.
    //
    // The line is found by its id, not its position: a line removed in the
    // form and not yet saved moves every index after it, and the stored plan
    // still has it.
    //
    // A new plan not yet saved, or a line added and not yet saved, has nothing
    // stored to patch; the tick stays in the draft and goes with Save, and the
    // form is marked as holding unsaved work. Ticks are written one after
    // another, never interleaved, so two quick ones cannot each read the plan
    // before the other has written it.
    root.onchange = (e) => {
      if (!draft || e.target.type !== 'checkbox' || !e.target.dataset.i) return;
      e.target.closest('.checkitem')?.classList.toggle('ticked', e.target.checked);
      const it = draft.items[Number(e.target.dataset.i.split('.')[0])];
      if (!it) return;
      it.checked = e.target.checked;
      const planId = draft.id, itemId = it.id, checked = it.checked;
      tickQueue = tickQueue.then(() => persistTick(planId, itemId, checked)).catch(() => {});
    };
  },
};

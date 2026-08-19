// modules/batch.js — one bath, several pieces (§13bd).
//
// A bulk action is not a property of the bath. Five pieces scoured and
// mordanted together share a real event; recording it as five identical rows
// loses the fact that the bath was shared, and invents a per-piece share of the
// mordant that nobody ever weighed out.
//
// So the batch is a record of its own. It holds what is shared — the weight,
// the recipe, the deviation — and the pieces hold only what is theirs and point
// at it. Nothing is copied, so nothing can fall out of step.
//
// The screen lives in its own module rather than inside fabrics.js because it
// is a third mode: neither reading a piece nor editing one, but recording
// something that happened to several at once.

import { all, get, put, remove, uid, newRecord, getSetting, setSetting } from '../db.js';
import { t } from '../i18n.js';
import { page, panel, field, label, esc, empty, note, today, fmtDate,
         navigate, icon, flash, searchBox, matches, backTo, actionBtn } from '../ui.js';
import { markClean } from '../dirty.js';
import { currentState, treatmentsOf, fibreClass, STATE_ORDER } from '../fabric-logic.js';
import { MANUAL_ACTIONS, movesBox, boxAfter } from '../migrate-actions.js';
import { scaleRecipe, recipeWarnings, expandChain } from '../calc/scale.js';

// Which recipe types suit which action, so choosing "mordanting" offers mordant
// recipes rather than all nine. A missing entry means "offer everything",
// which is the honest answer for `other`.
const RECIPE_TYPES_FOR = {
  wash: ['scour'],
  tannin: ['tannin'],
  mordant: ['mordant', 'alum_acetate'],
  neutralise: ['modifier'],
  iron: ['modifier', 'blanket'],
  soy: ['binder'],
  bleach: ['modifier'],
};

// Where an action has a usual precondition that is not met, the application
// says so and proceeds (§13bd). Not a dialogue, not a disabled checkbox — a
// line of text that can be read and ignored. A studio has good reasons for
// exceptions, and an app that argues with them stops being used.
const PRECONDITIONS = [
  {
    action: 'mordant',
    when: (f) => currentState(f) === 'unwashed',
    key: 'batch.warnUnwashed',
  },
];

// The same shape, for a piece that has had this very action recently.
//
// It exists because of a real double entry: a scarf mordanted on the 11th and
// mordanted again on the 18th, one of the two a mistake, and nothing anywhere
// that would have made the first visible while the second was being written.
// A note, not a block — mordanting twice is a real thing to do, and an
// application that refuses it is wrong more often than the person is.
const RECENT_DAYS = 30;

function recentlyDone(fabric, actionCode) {
  const same = (fabric.actions || [])
    .filter(a => a.actionCode === actionCode && a.date)
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  if (!same.length) return null;
  const days = Math.floor((Date.now() - new Date(same[same.length - 1].date).getTime()) / 86400000);
  return days >= 0 && days <= RECENT_DAYS ? days : null;
}

let actionCode = 'mordant';
let picked = new Set();
let recipeId = '';
let chainId = '';
let date = today();
let deviation = '';
let noteText = '';
let otherText = '';
let query = '';
let boxFilter = null;
let openBatch = null;   // an id when reading an existing batch
// Where to go back to, when the screen was reached from inside a piece of work
// (§13aq). The trial writes it before leaving; this module offers the way back
// and clears it once taken.
let returnTo = null;

const returnBar = () => returnTo
  ? `<button class="btn quiet upto" data-returnto>← ${esc(returnTo.label)}</button>` : '';

async function goBack() {
  const target = returnTo;
  await setSetting('returnTo', null);
  returnTo = null;
  location.hash = target?.id
    ? `#/${target.module}/${target.id}${target.screen ? '/' + target.screen : ''}`
    : '#/fabrics';
}

function reset() {
  actionCode = 'mordant';
  picked = new Set();
  recipeId = ''; chainId = ''; date = today();
  deviation = ''; noteText = ''; otherText = '';
  query = ''; boxFilter = null; openBatch = null;
}

const totalWeight = (fabrics) => [...picked]
  .map(id => fabrics.find(f => f.id === id))
  .reduce((sum, f) => sum + (Number(f?.weightG) || 0), 0);

// ------------------------------------------------------------------ pieces

async function pieceRow(f) {
  const box = currentState(f);
  const carried = treatmentsOf(f);
  const comp = (await Promise.all((f.composition || []).map(async c =>
    `${c.percent}% ${await label('fibre', c.fibreCode)}`))).join(' · ');

  const labels = (await Promise.all(carried.map(async code =>
    `<span class="tag">${esc(await label('fabric_action', code))}</span>`))).join('');

  return `
    <li class="batchrow${picked.has(f.id) ? ' on' : ''}">
      <label class="pickbox">
        <input type="checkbox" data-pick="${f.id}"${picked.has(f.id) ? ' checked' : ''}>
      </label>
      <span class="mono">${esc(f.label || '')}</span>
      <span class="batchname">
        <b>${esc(f.name || '—')}</b>
        <span class="hint">${esc(comp)}</span>
      </span>
      <span class="num">${f.weightG ? f.weightG + ' ' + t('fabrics.grams') : '—'}</span>
      <span class="batchstate">
        <span class="chip">${esc(await label('fabric_state', box))}</span>${labels}
      </span>
    </li>`;
}

// ------------------------------------------------------------------ recipe

async function recipeBlock(weightG) {
  if (!recipeId && !chainId) return `<p class="hint">${t('batch.noRecipe')}</p>`;
  if (!weightG) return note(t('batch.needWeight'), 'warn');

  const recipes = await all('recipes');
  const byId = new Map(recipes.map(r => [r.id, r]));
  const substances = new Map((await all('substances')).map(s => [s.id, s]));

  // A chain is not a recipe, and it is not one action either. Choosing
  // "cellulose preparation" here does not make one execution carrying three
  // recipes — it makes three, each with its own date and its own deviation.
  // The same answer as §8.0e reached from the other end.
  if (chainId) {
    const chain = await get('chains', chainId);
    if (!chain) return '';
    const steps = expandChain(chain, byId, { weightG });
    const rows = steps.map((s, i) => `
      <li>
        <b>${i + 1}. ${esc(s.recipe?.name?.bg || s.recipe?.name || '—')}</b>
        ${s.required ? `<span class="hint"> · ${t('chains.requiredStep')}</span>` : ''}
        <ul class="qty">${(s.scaled?.ingredients || []).map(ing => `
          <li>${esc(ing.substanceName || ing.roleCode || '')}
            <b class="num">${fmtQty(ing)}</b></li>`).join('')}</ul>
      </li>`).join('');
    return `
      ${note(t('batch.chainSplits', { n: steps.length }), 'info')}
      <ol class="chainsteps">${rows}</ol>`;
  }

  const recipe = byId.get(recipeId);
  if (!recipe) return '';
  const scaled = scaleRecipe(recipe, { weightG });
  const warns = recipeWarnings(recipe, scaled, substances);

  const rows = (scaled.ingredients || []).map(ing =>
    `<li>${esc(ing.substanceName || ing.roleCode || '')}
       <b class="num">${fmtQty(ing)}</b></li>`).join('');

  // The ceiling warnings exist elsewhere in the application and must exist
  // here: this is the one screen where real powder is weighed out against the
  // number on it. A warning present in the calculator and absent here is worse
  // than no warning at all, because its absence reads as approval.
  const warnRows = warns.map(w => {
    const name = w.ingredient?.substanceName || w.ingredient?.roleCode || '';
    if (w.code === 'over_max_wof')
      return note(t('recipes.warn.maxWof', { name: esc(name), value: w.value, limit: w.limit }), 'error');
    if (w.code === 'over_max_temp')
      return note(t('recipes.warn.maxTemp', { name: esc(name), value: w.value, limit: w.limit }), 'error');
    if (w.code === 'fibre_mismatch')
      return note(t('recipes.warn.fibre', { name: esc(name) }), 'warn');
    return '';
  }).join('');

  return `
    <div class="scaledbox">
      <p class="hint">${t('batch.scaledAgainst', { g: weightG })}</p>
      <ul class="qty">${rows}</ul>
      ${warnRows}
    </div>`;
}

// Ranges stay ranges. Sources give 8–10% tannin and 12–15% alum on wool, and
// collapsing that to one number states a precision the source did not have.
function fmtQty(ing) {
  const lo = ing.amountMin, hi = ing.amountMax;
  const r = (n) => (n == null ? '—' : (Math.round(n * 10) / 10));
  if (lo != null && hi != null && Math.abs(hi - lo) > 0.05)
    return `${r(lo)}–${r(hi)} г`;
  return `${r(lo ?? hi)} г`;
}

// ------------------------------------------------------------------- write

async function save(fabrics) {
  const chosen = fabrics.filter(f => picked.has(f.id));
  if (!chosen.length) return flash(t('batch.pickSomething'));

  const weightG = totalWeight(fabrics) || null;
  const recipes = new Map((await all('recipes')).map(r => [r.id, r]));

  // A chain writes one batch per step. Same pieces, same weight, separate
  // dates and separate deviations, because that is how they will be worked and
  // corrected — and because a single execution carrying three recipes is
  // exactly the shape this section exists to prevent.
  let plan = [{ actionCode, recipeId: recipeId || null, chainId: null }];
  if (chainId) {
    const chain = await get('chains', chainId);
    plan = expandChain(chain, recipes, { weightG })
      .filter(s => s.recipe)
      .map(s => ({
        actionCode: actionForRecipe(s.recipe),
        recipeId: s.recipe.id,
        chainId,
      }));
  }

  for (const step of plan) {
    const batch = newRecord({
      actionCode: step.actionCode,
      actionOther: step.actionCode === 'other' ? otherText : '',
      date,
      recipeId: step.recipeId,
      chainId: step.chainId,
      fabricIds: chosen.map(f => f.id),
      totalWeightG: weightG,
      deviation,
      note: noteText,
    });
    await put('batchActions', batch);

    for (const f of chosen) {
      const fresh = await get('fabrics', f.id);
      fresh.actions = fresh.actions || [];
      fresh.actions.push({
        id: uid(),
        fabricId: fresh.id,
        actionCode: step.actionCode,
        fromStateCode: null,
        date,
        recipeId: step.recipeId,
        chainId: step.chainId,
        trialId: null,
        batchId: batch.id,
        note: '',
        deviation: '',
        observation: '',
        createdAt: new Date().toISOString(),
      });
      await put('fabrics', fresh);
    }
  }

  markClean();
  flash(t('batch.saved', { n: chosen.length, k: plan.length }));
  const back = returnTo;
  reset();
  if (back) { await setSetting('returnTo', null); returnTo = null;
    location.hash = `#/${back.module}/${back.id}${back.screen ? '/' + back.screen : ''}`; }
  else navigate('#/fabrics');
}

// Which action a chain step is. A chain is a sequence of recipes and says
// nothing about boxes; the recipe's type is the only honest signal, and an
// unrecognised type becomes `other` rather than a guess.
const ACTION_FOR_RECIPE_TYPE = {
  scour: 'wash', tannin: 'tannin', mordant: 'mordant',
  alum_acetate: 'mordant', modifier: 'neutralise', binder: 'soy',
};
const actionForRecipe = (r) => ACTION_FOR_RECIPE_TYPE[r?.type] || 'other';

// -------------------------------------------------------------------- read

async function renderBatch(root, batch) {
  const fabrics = await all('fabrics');
  const mine = fabrics.filter(f => (batch.fabricIds || []).includes(f.id));
  const recipe = batch.recipeId ? await get('recipes', batch.recipeId) : null;

  root.innerHTML = page({
    title: await label('fabric_action', batch.actionCode),
    sub: fmtDate(batch.date),
    actions: `${returnBar()}${backTo('#/fabrics', t('nav.fabrics'))}`,
    body: `
      ${panel(`
        <ul class="history">${mine.map(f =>
          `<li data-open="${f.id}" style="cursor:pointer">
             <span class="mono">${esc(f.label || '')}</span> ${esc(f.name || '')}
             <span class="hint">${f.weightG ? f.weightG + ' г' : ''}</span>
           </li>`).join('')}</ul>
        <p>${t('batch.totalWas', { g: batch.totalWeightG ?? '—' })}</p>
        ${recipe ? `<p>${esc(recipe.name?.bg || recipe.name || '')}</p>` : ''}
        ${batch.deviation ? note(esc(batch.deviation), 'warn') : ''}
        ${batch.note ? `<p class="hint">${esc(batch.note)}</p>` : ''}
      `)}

      ${panel(`
        <h2>${t('batch.correct')}</h2>
        ${field(t('common.date'), `<input type="date" data-edit="date" value="${esc(batch.date || '')}">`)}
        ${field(t('batch.deviation'), `<input type="text" data-edit="deviation" value="${esc(batch.deviation || '')}">`)}
        ${field(t('common.notes'), `<textarea data-edit="note" rows="2">${esc(batch.note || '')}</textarea>`)}
        <div class="formactions">
          <button class="btn primary" data-edit-save>${t('common.save')}</button>
          <button class="btn danger quiet" data-batch-del>${t('batch.delete')}</button>
        </div>
        <p class="hint">${t('batch.deleteHint', { n: mine.length })}</p>
      `)}`,
  });
}

// Unwriting a bath.
//
// A record that can be made and not unmade is a trap, and this one was: the
// group action wrote onto every piece in it and there was no way to correct a
// date, let alone remove a bath entered twice. Reported from real use — one
// scarf with two mordantings a week apart, one of them a mistake, and nothing
// on any screen that could take it back.
//
// Deleting the batch deletes the action it wrote on each piece, because they
// are one fact. Leaving the actions behind would give exactly the orphans the
// invariant forbids: an action belonging to nothing.
async function deleteBatch(batch) {
  for (const id of batch.fabricIds || []) {
    const f = await get('fabrics', id);
    if (!f) continue;
    f.actions = (f.actions || []).filter(a => a.batchId !== batch.id);
    await put('fabrics', f);
  }
  await remove('batchActions', batch.id);
}

// ------------------------------------------------------------------- form

async function renderForm(root) {
  const fabrics = (await all('fabrics'))
    .sort((a, b) => STATE_ORDER.indexOf(currentState(b)) - STATE_ORDER.indexOf(currentState(a)));

  const chips = (await Promise.all(MANUAL_ACTIONS.map(async code => `
    <button class="box flat${actionCode === code ? ' active' : ''}" data-action="${code}">
      <span class="boxname">${esc(await label('fabric_action', code))}</span>
    </button>`))).join('');

  const moves = boxAfter(actionCode);
  const movesLine = moves
    ? t('batch.willMove', { box: await label('fabric_state', moves) })
    : t('batch.willNotMove');

  const shown = fabrics.filter(f =>
    (!boxFilter || currentState(f) === boxFilter) &&
    matches(query, f.label, f.name));

  const rows = (await Promise.all(shown.map(pieceRow))).join('');

  const boxChips = (await Promise.all([null, ...STATE_ORDER].map(async code => `
    <button class="box flat${boxFilter === code ? ' active' : ''}" data-box="${code || ''}">
      <span class="boxname">${code ? esc(await label('fabric_state', code)) : t('common.all')}</span>
    </button>`))).join('');

  const weightG = totalWeight(fabrics);

  // The preconditions, named rather than enforced.
  const flagged = [];
  for (const rule of PRECONDITIONS) {
    if (rule.action !== actionCode) continue;
    const hits = fabrics.filter(f => picked.has(f.id) && rule.when(f));
    if (hits.length) flagged.push(t(rule.key, {
      n: hits.length, list: hits.map(f => f.label).join(', '),
    }));
  }

  // Said per piece rather than as a count, because the point of it is to send
  // her to look at one particular record.
  for (const f of fabrics) {
    if (!picked.has(f.id)) continue;
    const days = recentlyDone(f, actionCode);
    if (days == null) continue;
    flagged.push(t('batch.warnAlready', {
      what: await label('fabric_action', actionCode),
      n: days, label: f.label || '',
    }));
  }

  const recipes = (await all('recipes')).filter(r => {
    const allowed = RECIPE_TYPES_FOR[actionCode];
    return !allowed || allowed.includes(r.type);
  });
  const chains = await all('chains');

  const summary = picked.size ? t('batch.summary', {
    n: picked.size, g: weightG,
    what: chainId
      ? (chains.find(c => c.id === chainId)?.name?.bg || '')
      : (recipes.find(r => r.id === recipeId)?.name?.bg || await label('fabric_action', actionCode)),
    date: fmtDate(date),
  }) : '';

  root.innerHTML = page({
    title: t('batch.title'),
    sub: t('batch.sub'),
    actions: `${returnBar()}${backTo('#/fabrics', t('nav.fabrics'))}`,
    body: `
      ${panel(`
        <h2><span class="stepnum">1</span> ${t('batch.whichAction')}</h2>
        <div class="boxes flat">${chips}</div>
        ${actionCode === 'other'
          ? field('', `<input type="text" data-other value="${esc(otherText)}" placeholder="${t('batch.otherPlaceholder')}">`)
          : ''}
        <p class="hint">${esc(movesLine)}</p>
      `)}

      ${panel(`
        <h2><span class="stepnum">2</span> ${t('batch.whichPieces')}</h2>
        <div class="filterrow">
          ${searchBox(query, t('batch.searchPieces'))}
          <div class="boxes flat">${boxChips}</div>
        </div>
        ${shown.length ? `<ul class="batchlist">${rows}</ul>`
                       : empty(t('batch.noPieces'), '')}
        <div class="runningtotal${picked.size ? ' on' : ''}">
          <span>${t('batch.chosen', { n: picked.size })}</span>
          <b class="num">${weightG} ${t('fabrics.grams')}</b>
        </div>
        ${flagged.map(m => note(m, 'warn')).join('')}
      `)}

      ${panel(`
        <h2><span class="stepnum">3</span> ${t('batch.theAction')}</h2>
        <div class="cols2">
          ${field(t('batch.recipe'), `
            <select data-recipe>
              <option value="">${t('common.choose')}</option>
              ${recipes.map(r => `<option value="${r.id}"${recipeId === r.id ? ' selected' : ''}>${esc(r.name?.bg || r.name || '')}</option>`).join('')}
              ${chains.length ? `<optgroup label="${t('batch.chains')}">${chains.map(c =>
                `<option value="chain:${c.id}"${chainId === c.id ? ' selected' : ''}>${esc(c.name?.bg || c.name || '')}</option>`).join('')}</optgroup>` : ''}
            </select>`)}
          ${field(t('common.date'), `<input type="date" data-date value="${esc(date)}">`)}
        </div>
        ${await recipeBlock(weightG)}
        ${field(t('batch.deviation'), `<input type="text" data-deviation value="${esc(deviation)}" placeholder="${t('batch.deviationPlaceholder')}">`,
                t('batch.deviationHint'))}
        ${field(t('common.notes'), `<textarea data-note rows="3">${esc(noteText)}</textarea>`)}
      `)}

      ${summary ? `<p class="summaryline">${esc(summary)}</p>` : ''}
      <div class="formactions">
        <button class="btn primary" data-save ${picked.size ? '' : 'disabled'}>${t('batch.save')}</button>
      </div>`,
  });
}

// ------------------------------------------------------------------ module

export default {
  id: 'batch',
  title: () => t('batch.title'),
  sub: () => t('batch.sub'),

  //   #/batch                     a new group action
  //   #/batch?pieces=a,b,c        the same, with those pieces already ticked
  //   #/batch/<id>                one that already happened
  //
  // The ticks travel in the address, not in a variable shared with the fabrics
  // module. §13q: a screen whose state lives in a variable cannot be reloaded,
  // bookmarked or sent, and the back button and the screen disagree.
  // Declared, so the router hands the query over. Without the flag it does not,
  // because every other module reads its arguments by position and would take
  // the query for a record id.
  takesQuery: true,

  open(first, query) {
    const q = first instanceof URLSearchParams ? first : query;
    openBatch = typeof first === 'string' && first !== 'new' ? first : null;
    const pieces = q?.get('pieces');
    if (pieces) picked = new Set(pieces.split(',').filter(Boolean));
  },

  reset,

  async render(root) {
    returnTo = await getSetting('returnTo', null);
    if (returnTo && returnTo.module !== 'trials') returnTo = null;

    if (openBatch) {
      const b = await get('batchActions', openBatch);
      if (!b) { openBatch = null; return this.render(root); }
      await renderBatch(root, b);
    } else {
      await renderForm(root);
    }

    // Wired on EVERY render, and not once behind a flag.
    //
    // The flag was wrong twice over. It sat after the read view's own `return`,
    // so opening a recorded bath straight from a preparation line wired nothing
    // at all and every button on that screen was dead — which is how a bath
    // came to be unmakeable even after the buttons existed. And `root` is shared
    // between modules, each of which assigns its own `onclick` on the way past,
    // so a flag set here stays true while the handler belongs to somebody else.
    //
    // Assignment replaces rather than adds, so re-wiring cannot double a
    // handler. Every other module in the application does it this way.
    root.onclick = async (e) => {
      const act = e.target.closest('[data-action]');
      if (act) { actionCode = act.dataset.action; recipeId = ''; chainId = ''; return this.render(root); }

      const box = e.target.closest('[data-box]');
      if (box) { boxFilter = box.dataset.box || null; return this.render(root); }

      const open = e.target.closest('[data-open]');
      if (open) return navigate(`#/fabrics/${open.dataset.open}`);

      // Correcting or unmaking a bath that has already been recorded.
      if (e.target.closest('[data-edit-save]')) {
        const b = await get('batchActions', openBatch);
        if (!b) return;
        const v = (k) => root.querySelector(`[data-edit="${k}"]`)?.value ?? '';
        const wasDate = b.date;
        b.date = v('date'); b.deviation = v('deviation'); b.note = v('note');
        await put('batchActions', b);
        // The date lives in two places by design — on the bath, and on each
        // piece's own action, so a piece's biography can be read without
        // fetching every bath it was ever in. Two places means they can differ,
        // so correcting one corrects the other in the same breath.
        if (b.date !== wasDate) {
          for (const id of b.fabricIds || []) {
            const f = await get('fabrics', id);
            if (!f) continue;
            f.actions = (f.actions || []).map(a =>
              a.batchId === b.id ? { ...a, date: b.date } : a);
            await put('fabrics', f);
          }
        }
        flash(t('common.saved'));
        return this.render(root);
      }

      if (e.target.closest('[data-batch-del]')) {
        const b = await get('batchActions', openBatch);
        if (!b) return;
        if (!confirm(t('batch.confirmDelete', { n: (b.fabricIds || []).length }))) return;
        await deleteBatch(b);
        flash(t('batch.deleted'));
        openBatch = null;
        return returnTo ? goBack() : navigate('#/fabrics');
      }

      if (e.target.closest('[data-returnto]')) return goBack();
      if (e.target.closest('[data-back]')) return returnTo ? goBack() : navigate('#/fabrics');

      if (e.target.closest('[data-save]')) {
        readForm(root);
        return save(await all('fabrics'));
      }
    };

    root.onchange = async (e) => {
      const pick = e.target.closest('[data-pick]');
      if (pick) {
        readForm(root);
        pick.checked ? picked.add(pick.dataset.pick) : picked.delete(pick.dataset.pick);
        return this.render(root);
      }
      if (e.target.closest('[data-recipe]')) {
        readForm(root);
        const v = e.target.value;
        if (v.startsWith('chain:')) { chainId = v.slice(6); recipeId = ''; }
        else { recipeId = v; chainId = ''; }
        return this.render(root);
      }
      if (e.target.closest('[data-date]')) { date = e.target.value; return; }
    };

    root.oninput = (e) => {
      const s = e.target.closest('[data-search]');
      if (s) { readForm(root); query = s.value; return this.render(root); }
    };
  },
};

// Read every field back from the screen before redrawing it. The arrays are
// NOT rebuilt from what is visible: `picked` holds ids and survives filtering,
// because rebuilding a selection from the rows on screen would silently drop
// every piece the search had hidden — the same fault as §13e's form reader that
// would have deleted collapsed steps on save.
function readForm(root) {
  const val = (sel) => root.querySelector(sel)?.value ?? null;
  const d = val('[data-date]'); if (d != null) date = d;
  const dev = val('[data-deviation]'); if (dev != null) deviation = dev;
  const n = val('[data-note]'); if (n != null) noteText = n;
  const o = val('[data-other]'); if (o != null) otherText = o;
}

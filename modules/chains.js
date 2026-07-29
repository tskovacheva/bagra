// modules/chains.js — an ordered preparation, scaled at once (§5.3).
//
// Cellulose needs scour → tannin → mordant before it can be dyed. Each is its
// own recipe, but they are always run against ONE weight of goods, and doing
// the arithmetic three times by hand is where errors enter.
//
// Modelled as data rather than as a hard-coded wizard: a chain for wool, one
// for silk, one for a stained reclaimed garment with an extra scour, all added
// without touching code, and all shippable in a reference pack.

import { all, get, put, remove, newRecord, uid } from '../db.js';
import { t, text } from '../i18n.js';
import { page, panel, field, options, label, esc, empty, note, pairField, readPairs } from '../ui.js';
import { scaleChain, chainFollowOns } from '../calc/scale.js';

const FIBRE_CLASSES = ['cellulose', 'protein'];

let openId = null;
let draft = null;
let ctx = { weightG: 250, fibreClass: 'cellulose' };

function blank() {
  return newRecord({
    name: { bg: '', en: '' },
    appliesTo: ['cellulose'],
    steps: [],
    notes: { bg: '', en: '' },
    sourceRef: null,
    distributable: false,
  });
}

// ---------------------------------------------------------------- list view

export async function renderList(root, host) {
  const chains = await all('chains');
  const recipes = await all('recipes');
  const byId = new Map(recipes.map(r => [r.id, r]));

  const rows = await Promise.all(chains
    .sort((a, b) => text(a.name).localeCompare(text(b.name)))
    .map(async c => {
      const fibres = await Promise.all((c.appliesTo || []).map(x => label('fibre_class', x)));
      const names = (c.steps || [])
        .slice().sort((a, b) => a.order - b.order)
        .map(st => text(byId.get(st.recipeId)?.name) || '—')
        .join(' → ');
      return `<tr data-open-chain="${c.id}">
        <td>${esc(text(c.name) || '—')}</td>
        <td>${esc(fibres.join(', '))}</td>
        <td>${esc(names)}</td>
        <td class="num">${(c.steps || []).length}</td>
      </tr>`;
    }));

  const table = chains.length ? `
    <table class="grid">
      <thead><tr>
        <th>${t('chains.name')}</th>
        <th>${t('recipes.col.appliesTo')}</th>
        <th>${t('chains.steps')}</th>
        <th class="num">${t('chains.col.steps')}</th>
      </tr></thead>
      <tbody>${rows.join('')}</tbody>
    </table>`
    : empty(t('chains.empty'), t('chains.emptyHint'));

  root.innerHTML = page({
    title: t('chains.title'),
    sub: t('chains.sub'),
    actions: `${host.tabs()}
      <button class="btn primary" data-new-chain ${recipes.length < 2 ? 'disabled' : ''}>${t('chains.new')}</button>`,
    body: `${recipes.length < 2 ? note(t('chains.noRecipes'), 'warn') : ''}${panel(table, 'flush')}`,
  });
}

// ---------------------------------------------------------------- form view

async function stepRows(c, recipes, substances) {
  const byId = new Map(recipes.map(r => [r.id, r]));
  const subById = new Map(substances.map(s => [s.id, s]));

  const steps = (c.steps || []).slice().sort((a, b) => a.order - b.order);

  return (await Promise.all(steps.map(async (st, i) => {
    const recipe = byId.get(st.recipeId);

    // Only ingredients with more than one option need a choice; the rest are
    // fixed and would only add noise.
    const pickers = (recipe?.ingredients || [])
      .filter(ing => (ing.options || []).length > 1)
      .map(ing => `
        <label class="chainpick">
          <span class="pickhint">${t('recipes.choose')}</span>
          <select data-chainchoice="${i}.${ing.id}">
            ${ing.options.map(o => {
              const sub = subById.get(o.substanceId);
              return `<option value="${o.id}"${(st.choices || {})[ing.id] === o.id ? ' selected' : ''}>${
                esc(sub ? text(sub.name) : '—')}${o.note?.bg ? ' · ' + esc(o.note.bg) : ''}</option>`;
            }).join('')}
          </select>
        </label>`).join('');

    return `
      <div class="chainstep">
        <div class="chainhead">
          <span class="stepnum">${i + 1}</span>
          <b>${esc(recipe ? text(recipe.name) : '—')}</b>
          <span class="hint">${esc(recipe ? await label('recipe_type', recipe.type) : '')}</span>
          <span class="spacer"></span>
          <button class="btn quiet" data-chain-up="${i}" ${i === 0 ? 'disabled' : ''}>${t('chains.up')}</button>
          <button class="btn quiet" data-chain-down="${i}" ${i === steps.length - 1 ? 'disabled' : ''}>${t('chains.down')}</button>
          <button class="btn quiet" data-chain-del="${i}" aria-label="×">×</button>
        </div>
        ${pickers ? `<div class="chainpicks">${pickers}</div>` : ''}
        <input type="text" data-chainnote="${i}" value="${esc(st.note || '')}" placeholder="${t('chains.stepNote')}">
      </div>`;
  }))).join('') || `<p class="hint">—</p>`;
}

async function planBlock(c, recipes, substances) {
  const byId = new Map(recipes.map(r => [r.id, r]));
  const subById = new Map(substances.map(s => [s.id, s]));
  const steps = scaleChain(c, byId, ctx);
  const follows = chainFollowOns(steps, byId);

  const blocks = await Promise.all(steps.map(async (st, i) => {
    if (!st.recipe) return '';
    const lines = await Promise.all((st.scaled?.ingredients || []).map(async ing => {
      const sub = subById.get(ing.option?.substanceId);
      const nameStr = sub ? text(sub.name) : (await label('ingredient_role', ing.roleCode)) || '—';
      const amount = ing.scaledAmount != null
        ? ing.scaledAmount
        : `${ing.scaledMin ?? '—'}–${ing.scaledMax ?? '—'}`;
      return `<div class="calcout">
        <span class="calclabel">${esc(nameStr)}</span>
        <span class="calcvalue">${amount} <small>${esc(ing.scaledUnit || '')}</small></span>
      </div>`;
    }));

    const conditions = [
      st.recipe.tempC != null ? `${st.recipe.tempC} °C` : '',
      st.recipe.heldMinutes ? `${st.recipe.heldMinutes} ${t('tools.min') || 'мин'}` : '',
      st.recipe.restMinutes ? `+ ${st.recipe.restMinutes}` : '',
      st.scaled?.bathLitres != null ? `${st.scaled.bathLitres} ${t('tools.litres')}` : '',
    ].filter(Boolean).join(' · ');

    return `
      <div class="planstep">
        <div class="chainhead">
          <span class="stepnum">${i + 1}</span>
          <b>${esc(text(st.recipe.name))}</b>
          <span class="spacer"></span>
          <span class="hint">${esc(conditions)}</span>
        </div>
        ${lines.join('') || `<p class="hint">—</p>`}
        ${st.note ? `<p class="hint">${esc(st.note)}</p>` : ''}
      </div>`;
  }));

  return `
    ${field(t('recipes.forWeight'), `<input type="number" step="1" min="0" data-chainscale="weightG" value="${ctx.weightG ?? ''}">`)}
    ${field(t('recipes.forFibre'), `<select data-chainscale="fibreClass">${await options('fibre_class', ctx.fibreClass, '')}</select>`)}
    <p class="hint">${t('chains.planHint')}</p>
    <div class="plan">${blocks.join('')}</div>
    ${follows.length ? note(t('chains.thenAll', { what: esc(follows.map(r => text(r.name)).join(', ')) }), 'warn') : ''}`;
}

async function renderForm(root, c, host) {
  const isNew = openId === 'new';
  const recipes = await all('recipes');
  const substances = await all('substances');

  const fibreChecks = (await Promise.all(FIBRE_CLASSES.map(async x => `
    <label class="check"><input type="checkbox" data-chainmulti="appliesTo" value="${x}"
      ${(c.appliesTo || []).includes(x) ? 'checked' : ''}>
      ${esc(await label('fibre_class', x))}</label>`))).join('');

  root.innerHTML = page({
    title: isNew ? t('chains.new') : (text(c.name) || t('chains.one')),
    sub: isNew ? t('chains.emptyHint') : '',
    actions: `<button class="btn quiet" data-back-chain>${t('common.back')}</button>
              <button class="btn primary" data-save-chain>${t('common.save')}</button>`,
    body: `
      <div class="cols">
        <div class="col">
          ${panel(`
            <h2>${t('chains.about')}</h2>
            ${pairField(t('chains.name'), 'name', c.name)}
            ${field(t('recipes.appliesTo'), `<div class="checks">${fibreChecks}</div>`)}
          `)}

          ${panel(`
            <h2>${t('chains.steps')}</h2>
            <p class="note">${t('chains.stepsHint')}</p>
            <div class="chainlist">${await stepRows(c, recipes, substances)}</div>
            <select data-chain-add>
              <option value="">${t('chains.addStep')}</option>
              ${recipes.map(r => `<option value="${r.id}">${esc(text(r.name))}</option>`).join('')}
            </select>
          `)}

          ${panel(`
            <h2>${t('common.notes')}</h2>
            ${pairField('', 'notes', c.notes, { multiline: true })}
            ${!isNew ? `<button class="btn danger quiet" data-delete-chain>${t('chains.delete')}</button>` : ''}
          `)}
        </div>

        <div class="col">
          ${panel(`
            <h2>${t('chains.plan')}</h2>
            <div class="planblock">${await planBlock(c, recipes, substances)}</div>
          `)}

          ${!isNew ? panel(`
            <button class="btn" disabled>${t('chains.makeTrial')}</button>
            <p class="hint">${t('chains.makeTrialSoon')}</p>
          `) : ''}
        </div>
      </div>`,
  });
}

function readForm(root) {
  draft.appliesTo = [];
  for (const el of root.querySelectorAll('[data-chainmulti="appliesTo"]')) {
    if (el.checked) draft.appliesTo.push(el.value);
  }
  for (const el of root.querySelectorAll('[data-chainnote]')) {
    const i = Number(el.dataset.chainnote);
    if (draft.steps[i]) draft.steps[i].note = el.value;
  }
  for (const el of root.querySelectorAll('[data-chainchoice]')) {
    const [i, ingId] = el.dataset.chainchoice.split('.');
    const step = draft.steps[Number(i)];
    if (!step) continue;
    step.choices = step.choices || {};
    step.choices[ingId] = el.value;
  }
  readPairs(root, draft);
}

function reorder() {
  draft.steps.sort((a, b) => a.order - b.order);
  draft.steps.forEach((st, i) => { st.order = i; });
}

export default {
  async render(root, host) {
    if (openId) {
      if (!draft || (openId !== 'new' && draft.id !== openId)) {
        draft = openId === 'new' ? blank() : structuredClone(await get('chains', openId));
      }
      await renderForm(root, draft, host);
    } else {
      draft = null;
      await renderList(root, host);
    }

    const refreshPlan = async () => {
      readForm(root);
      const box = root.querySelector('.planblock');
      if (box) box.innerHTML = await planBlock(draft, await all('recipes'), await all('substances'));
    };

    root.onclick = async (e) => {
      if (e.target.closest('[data-new-chain]')) { draft = null; openId = 'new'; return this.render(root, host); }
      const row = e.target.closest('[data-open-chain]');
      if (row) { draft = null; openId = row.dataset.openChain; return this.render(root, host); }
      if (e.target.closest('[data-back-chain]')) { openId = null; draft = null; return this.render(root, host); }

      const up = e.target.closest('[data-chain-up]');
      if (up) {
        readForm(root);
        const i = Number(up.dataset.chainUp);
        draft.steps[i].order -= 1.5; reorder();
        return renderForm(root, draft, host);
      }
      const down = e.target.closest('[data-chain-down]');
      if (down) {
        readForm(root);
        const i = Number(down.dataset.chainDown);
        draft.steps[i].order += 1.5; reorder();
        return renderForm(root, draft, host);
      }
      const del = e.target.closest('[data-chain-del]');
      if (del) {
        readForm(root);
        draft.steps.splice(Number(del.dataset.chainDel), 1); reorder();
        return renderForm(root, draft, host);
      }

      if (e.target.closest('[data-save-chain]')) {
        readForm(root);
        await put('chains', draft);
        openId = null; draft = null;
        return this.render(root, host);
      }
      if (e.target.closest('[data-delete-chain]')) {
        if (!confirm(t('chains.confirmDelete'))) return;
        await remove('chains', draft.id);
        openId = null; draft = null;
        return this.render(root, host);
      }
    };

    root.onchange = async (e) => {
      if (e.target.matches('[data-chain-add]') && e.target.value) {
        readForm(root);
        draft.steps.push({
          id: uid(), order: draft.steps.length,
          recipeId: e.target.value, choices: {}, note: '',
        });
        return renderForm(root, draft, host);
      }
      if (e.target.dataset.chainscale) {
        ctx[e.target.dataset.chainscale] = e.target.type === 'number'
          ? Number(e.target.value) : e.target.value;
        return refreshPlan();
      }
      if (e.target.dataset.chainchoice) return refreshPlan();
    };

    root.oninput = async (e) => {
      if (e.target.dataset.chainscale) {
        ctx[e.target.dataset.chainscale] = Number(e.target.value);
        return refreshPlan();
      }
    };
  },
};

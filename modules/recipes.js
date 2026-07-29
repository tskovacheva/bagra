// modules/recipes.js — procedures with proportions (§5).
//
// A recipe specifies ROLES filled by substances, and quantities with an
// explicit basis. One generic scaling engine serves every proportional
// recipe here; only the aluminium acetate stoichiometry earns its own code.

import { all, get, put, remove, newRecord, uid } from '../db.js';
import { t, text } from '../i18n.js';
import {
  page, panel, field, options, label, esc, empty, note,
  pairField, readPairs,
} from '../ui.js';
import { scaleRecipe, recipeWarnings } from '../calc/scale.js';
import chains from './chains.js';

const TYPES = ['scour', 'tannin', 'mordant', 'dye', 'ecoprint', 'blanket', 'pigment', 'paste'];
const FIBRE_CLASSES = ['cellulose', 'protein'];

// Recipes and chains share one nav entry: a chain is a plan made of recipes,
// and an eleventh item in the sidebar would cost more than it explains.
let mode = 'recipes';

const host = {
  tabs: () => `
    <div class="tabswitch">
      <button class="tab${mode === 'recipes' ? ' active' : ''}" data-mode="recipes">${t('chains.recipesTab')}</button>
      <button class="tab${mode === 'chains' ? ' active' : ''}" data-mode="chains">${t('chains.tab')}</button>
    </div>`,
};

let filterType = null;
let openId = null;
let draft = null;
let scaleCtx = { weightG: 250, fibreClass: 'cellulose', bathLitres: null };
let scaleChoices = {};

function blank() {
  return newRecord({
    lineageId: uid(),
    version: 1,
    type: 'mordant',
    name: { bg: '', en: '' },
    appliesTo: ['cellulose'],
    ingredients: [],
    steps: [],
    scaleBy: 'weight',
    defaultLitres: null,
    liquorRatio: null,
    tempC: null,
    heldMinutes: null,
    restMinutes: null,
    phTarget: null,
    blanketKind: '', blanketConcentration: null, blanketFresh: true, blanketUses: 0,
    requiredFollowOn: [],
    notes: { bg: '', en: '' },
    sourceRef: null,
    distributable: false,
  });
}

// ---------------------------------------------------------------- list view

async function renderList(root) {
  const recipes = await all('recipes');

  const counts = {};
  for (const r of recipes) counts[r.type] = (counts[r.type] || 0) + 1;

  const tabs = await Promise.all(TYPES.map(async ty => `
    <button class="box${filterType === ty ? ' active' : ''}" data-type="${ty}">
      <span class="boxname">${esc(await label('recipe_type', ty))}</span>
      <span class="boxcount">${counts[ty] || 0}</span>
    </button>`));

  const shown = (filterType ? recipes.filter(r => r.type === filterType) : recipes)
    .sort((a, b) => text(a.name).localeCompare(text(b.name)));

  const rows = await Promise.all(shown.map(async r => {
    const fibres = await Promise.all((r.appliesTo || []).map(c => label('fibre_class', c)));
    return `<tr data-open="${r.id}">
      <td>${esc(text(r.name) || '—')}</td>
      <td>${esc(await label('recipe_type', r.type))}</td>
      <td>${esc(fibres.join(', '))}</td>
      <td class="num">${(r.ingredients || []).length}</td>
      <td>${esc(r.sourceRef?.author || r.sourceRef?.text || '—')}</td>
      <td class="num">${r.version || 1}</td>
    </tr>`;
  }));

  const table = shown.length ? `
    <table class="grid">
      <thead><tr>
        <th>${t('recipes.col.name')}</th>
        <th>${t('recipes.col.type')}</th>
        <th>${t('recipes.col.appliesTo')}</th>
        <th class="num">${t('recipes.col.ingredients')}</th>
        <th>${t('recipes.col.source')}</th>
        <th class="num">${t('recipes.col.version')}</th>
      </tr></thead>
      <tbody>${rows.join('')}</tbody>
    </table>`
    : empty(filterType ? t('recipes.emptyType') : t('recipes.empty'), t('recipes.emptyHint'));

  root.innerHTML = page({
    title: t('recipes.title'),
    sub: t('recipes.sub'),
    actions: `${host.tabs()}<button class="btn primary" data-new>${t('recipes.new')}</button>`,
    body: `
      <div class="boxes">
        <button class="box${filterType === null ? ' active' : ''}" data-type="">
          <span class="boxname">${t('common.all')}</span>
          <span class="boxcount">${recipes.length}</span>
        </button>
        ${tabs.join('')}
      </div>
      ${panel(table, 'flush')}`,
  });
}

// ---------------------------------------------------------------- form view

async function ingredientRows(r, substances) {
  const subOptions = (selected) =>
    `<option value="">—</option>` + substances.map(sx =>
      `<option value="${sx.id}"${sx.id === selected ? ' selected' : ''}>${esc(text(sx.name))}</option>`).join('');

  // basisRefersTo exists for one specific ambiguity — preparing a compound,
  // where a percentage may mean the finished product or the raw salt. Showing
  // it on a tannin bath only invites a meaningless choice.
  const AMBIGUOUS_ROLES = ['aluminium_source', 'sodium_source'];

  const rows = await Promise.all((r.ingredients || []).map(async (ing, i) => {
    const opts = ing.options?.length ? ing.options : [];
    const optRows = opts.map((o, j) => `
      ${j > 0 ? `<div class="orsep"><span>${t('recipes.or')}</span></div>` : ''}
      <div class="optrow">
        <select data-opt="${i}.${j}.substanceId">${subOptions(o.substanceId)}</select>
        <input type="number" step="0.1" min="0" data-opt="${i}.${j}.qtyMin" value="${o.qtyMin ?? ''}" placeholder="${t('recipes.qtyMin')}" aria-label="${t('recipes.qtyMin')}">
        <input type="number" step="0.1" min="0" data-opt="${i}.${j}.qtyMax" value="${o.qtyMax ?? ''}" placeholder="${t('recipes.qtyMax')}" aria-label="${t('recipes.qtyMax')}">
        <input type="text" data-opt="${i}.${j}.note" value="${esc(o.note?.bg || '')}" placeholder="${t('recipes.optionNotePlaceholder')}" aria-label="${t('recipes.optionNote')}">
        <button class="btn quiet" data-opt-del="${i}.${j}" aria-label="×">×</button>
      </div>`).join('');

    return `
    <div class="ingrow">
      <div class="ingmain">
        <select data-ing="${i}.roleCode" aria-label="${t('recipes.role')}">${await options('ingredient_role', ing.roleCode, t('recipes.role'))}</select>
        <select data-ing="${i}.basis" aria-label="${t('recipes.basis')}">${await options('basis', ing.basis, t('recipes.basis'))}</select>
        <button class="btn quiet" data-ing-del="${i}" aria-label="×">×</button>
      </div>
      <div class="ingdetail">
        ${ing.basis === 'percent_wof' && AMBIGUOUS_ROLES.includes(ing.roleCode)
          ? `<select data-ing="${i}.basisRefersTo" aria-label="${t('recipes.refersTo')}">${await options('basis_refers_to', ing.basisRefersTo, t('recipes.refersTo'))}</select>`
          : ''}
        <select data-ing="${i}.whenFibreClass" aria-label="${t('recipes.whenFibre')}">
          <option value="">${t('recipes.whenFibreAny')}</option>
          ${(await Promise.all(FIBRE_CLASSES.map(async c =>
            `<option value="${c}"${(ing.whenFibreClass || []).includes(c) ? ' selected' : ''}>${esc(await label('fibre_class', c))}</option>`))).join('')}
        </select>
      </div>
      <div class="optblock">
        <span class="optlabel">${opts.length > 1 ? t('recipes.alternatives') : t('recipes.substance')}</span>
        ${optRows || `<p class="hint">—</p>`}
        ${opts.length === 1 ? `<p class="hint">${t('recipes.oneSubstance')}</p>` : ''}
        <button class="btn quiet" data-opt-add="${i}">${t('recipes.addAlternative')}</button>
      </div>
    </div>`;
  }));

  return rows.join('') || `<p class="hint">—</p>`;
}

function stepRows(r) {
  return (r.steps || []).map((st, i) => `
    <div class="steprow">
      <span class="stepnum">${i + 1}</span>
      <textarea data-step="${i}.text" rows="2" placeholder="${t('recipes.stepText')}">${esc(st.text?.bg || st.text || '')}</textarea>
      <button class="btn quiet" data-step-del="${i}" aria-label="×">×</button>
    </div>`).join('') || `<p class="hint">—</p>`;
}

async function scaleBlock(r, substances) {
  const byVolume = r.scaleBy === 'volume';
  const scaled = scaleRecipe(r, {
    ...scaleCtx, choices: scaleChoices,
    bathLitres: byVolume ? (scaleCtx.bathLitres ?? r.defaultLitres) : null,
  });
  const followText = (r.requiredFollowOn || []).length
    ? (await all('recipes'))
        .filter(x => (r.requiredFollowOn || []).includes(x.id))
        .map(x => text(x.name)).join(', ')
    : '';
  const byId = new Map(substances.map(sx => [sx.id, sx]));
  const warnings = recipeWarnings(r, scaled, byId);

  const lines = await Promise.all(scaled.ingredients.map(async ing => {
    const sub = byId.get(ing.option?.substanceId);
    const nameStr = sub ? text(sub.name) : (await label('ingredient_role', ing.roleCode)) || '—';
    const amount = ing.scaledAmount != null
      ? ing.scaledAmount
      : `${ing.scaledMin ?? '—'}–${ing.scaledMax ?? '—'}`;

    // When a role can be filled several ways, the choice belongs here, next to
    // the number it changes — not buried in the recipe definition above.
    const picker = (ing.options?.length > 1)
      ? `<span class="pickhint">${t('recipes.choose')}</span>
         <select data-choice="${ing.id}">${ing.options.map(o => {
          const os = byId.get(o.substanceId);
          return `<option value="${o.id}"${o.id === ing.option?.id ? ' selected' : ''}>${
            esc(os ? text(os.name) : '—')}${o.note?.bg ? ' · ' + esc(o.note.bg) : ''}</option>`;
        }).join('')}</select>`
      : '';

    return `<div class="calcout calcpick">
      <span class="calclabel">${picker || esc(nameStr)}</span>
      <span class="calcvalue">${amount} <small>${esc(ing.scaledUnit || '')}</small></span>
    </div>`;
  }));

  const warnHtml = (await Promise.all(warnings.map(async w => {
    const sub = byId.get(w.ingredient.option?.substanceId || w.ingredient.substanceId);
    const nameStr = sub ? text(sub.name) : '—';
    if (w.code === 'over_max_wof')  return note(t('recipes.warn.maxWof',  { name: esc(nameStr), value: w.value, limit: w.limit }), 'error');
    if (w.code === 'over_max_temp') return note(t('recipes.warn.maxTemp', { name: esc(nameStr), value: w.value, limit: w.limit }), 'error');
    if (w.code === 'fibre_mismatch') return note(t('recipes.warn.fibre',  { name: esc(nameStr) }), 'warn');
    return '';
  }))).join('');

  return `
    ${byVolume
      ? field(t('recipes.forLitres'), `<input type="number" step="0.5" min="0" data-scale="bathLitres" value="${scaleCtx.bathLitres ?? r.defaultLitres ?? ''}">`)
      : field(t('recipes.forWeight'), `<input type="number" step="1" min="0" data-scale="weightG" value="${scaleCtx.weightG ?? ''}">`) +
        field(t('recipes.forFibre'), `<select data-scale="fibreClass">${await options('fibre_class', scaleCtx.fibreClass, '')}</select>`)}
    ${r.type === 'blanket' ? note(t('recipes.blanketBasisWarn'), 'warn') : ''}
    <div class="calcresults">
      ${lines.join('')}
      ${scaled.bathLitres != null ? `<div class="calcout">
        <span class="calclabel">${t('recipes.bathNeeded')}</span>
        <span class="calcvalue">${scaled.bathLitres} <small>${t('tools.litres')}</small></span></div>` : ''}
    </div>
    ${scaled.dropped.length ? `<p class="hint">${t('recipes.dropped', { n: scaled.dropped.length })}</p>` : ''}
    ${followText ? note(t('recipes.thenDo', { what: esc(followText) }), 'warn') : ''}
    ${warnHtml}`;
}

function followOnRows(r, allRecipes) {
  const ids = r.requiredFollowOn || [];
  if (!ids.length) return `<p class="hint">—</p>`;
  return ids.map(id => {
    const rec = allRecipes.find(x => x.id === id);
    return `<div class="followrow">
      <span>${esc(rec ? text(rec.name) : '—')}</span>
      <button class="btn quiet" data-follow-del="${id}" aria-label="×">×</button>
    </div>`;
  }).join('');
}

async function renderForm(root, r) {
  const isNew = openId === 'new';
  const allRecipes = await all('recipes');
  const substances = (await all('substances'))
    .sort((a, b) => text(a.name).localeCompare(text(b.name)));

  const fibreChecks = (await Promise.all(FIBRE_CLASSES.map(async c => `
    <label class="check"><input type="checkbox" data-multi="appliesTo" value="${c}"
      ${(r.appliesTo || []).includes(c) ? 'checked' : ''}>
      ${esc(await label('fibre_class', c))}</label>`))).join('');

  root.innerHTML = page({
    title: isNew ? t('recipes.new') : (text(r.name) || t('recipes.one')),
    sub: isNew ? t('recipes.emptyHint') : t('recipes.version', { n: r.version || 1 }),
    actions: `<button class="btn quiet" data-back>${t('common.back')}</button>
              ${!isNew ? `<button class="btn" data-save-version>${t('recipes.saveNewVersion')}</button>` : ''}
              <button class="btn primary" data-save>${t('common.save')}</button>`,
    body: `
      <div class="cols">
        <div class="col">
          ${panel(`
            <h2>${t('recipes.about')}</h2>
            ${pairField(t('recipes.name'), 'name', r.name)}
            ${field(t('recipes.type'), `<select data-f="type">${await options('recipe_type', r.type, '')}</select>`)}
            ${field(t('recipes.appliesTo'), `<div class="checks">${fibreChecks}</div>`)}
          `)}

          ${panel(`
            <h2>${t('recipes.ingredients')}</h2>
            <p class="note">${t('recipes.ingredientsHint')}</p>
            <div class="inglist">${await ingredientRows(r, substances)}</div>
            <button class="btn quiet" data-ing-add>${t('recipes.addIngredient')}</button>
            <p class="hint">${t('recipes.alternativesHint')} ${t('recipes.qtyRangeHint')}</p>
          `)}

          ${panel(`
            <h2>${t('recipes.conditions')}</h2>
            ${field(t('recipes.tempC'), `<input type="number" step="1" data-f="tempC" value="${r.tempC ?? ''}">`)}
            ${field(t('recipes.heldMinutes'), `<input type="number" step="5" min="0" data-f="heldMinutes" value="${r.heldMinutes ?? ''}">`, t('recipes.heldHint'))}
            ${field(t('recipes.restMinutes'), `<input type="number" step="10" min="0" data-f="restMinutes" value="${r.restMinutes ?? ''}">`, t('recipes.restHint'))}
            ${field(t('recipes.scaleBy'), `<select data-f="scaleBy">
                <option value="weight"${r.scaleBy !== 'volume' ? ' selected' : ''}>${t('recipes.scaleBy.weight')}</option>
                <option value="volume"${r.scaleBy === 'volume' ? ' selected' : ''}>${t('recipes.scaleBy.volume')}</option>
              </select>`, t('recipes.scaleByHint'))}
            ${r.scaleBy === 'volume'
              ? field(t('recipes.defaultLitres'), `<input type="number" step="0.5" min="0" data-f="defaultLitres" value="${r.defaultLitres ?? ''}">`)
              : field(t('recipes.liquorRatio'), `<input type="number" step="1" min="0" data-f="liquorRatio" value="${r.liquorRatio ?? ''}">`)}
            ${field(t('recipes.phTarget'), `<input type="number" step="0.1" min="0" max="14" data-f="phTarget" value="${r.phTarget ?? ''}">`)}
          `)}

          ${panel(`
            <h2>${t('recipes.followOn')}</h2>
            <p class="note">${t('recipes.followOnHint')}</p>
            <div class="followlist">${followOnRows(r, allRecipes)}</div>
            <select data-follow-add>
              <option value="">${t('recipes.addFollowOn')}</option>
              ${allRecipes
                .filter(x => x.id !== r.id && !(r.requiredFollowOn || []).includes(x.id))
                .map(x => `<option value="${x.id}">${esc(text(x.name))}</option>`).join('')}
            </select>
          `)}

          ${r.type === 'blanket' ? panel(`
            <h2>${t('recipes.blanket')}</h2>
            ${note(t('recipes.blanketBasisWarn'), 'warn')}
            ${field(t('recipes.blanketKind'), `<select data-f="blanketKind">
                <option value="">—</option>
                <option value="dye"${r.blanketKind === 'dye' ? ' selected' : ''}>${t('recipes.blanketKind.dye')}</option>
                <option value="mordant"${r.blanketKind === 'mordant' ? ' selected' : ''}>${t('recipes.blanketKind.mordant')}</option>
              </select>`)}
            ${field(t('recipes.blanketConc'), `<input type="number" step="0.1" min="0" data-f="blanketConcentration" value="${r.blanketConcentration ?? ''}">`)}
            ${field(t('recipes.blanketUses'), `<input type="number" step="1" min="0" data-f="blanketUses" value="${r.blanketUses ?? 0}">`)}
          `) : ''}
        </div>

        <div class="col">
          ${panel(`
            <h2>${t('recipes.scale')}</h2>
            <p class="note">${t('recipes.scaleHint')}</p>
            <div class="scaleblock">${await scaleBlock(r, substances)}</div>
          `)}

          ${panel(`
            <h2>${t('recipes.steps')}</h2>
            <div class="steplist">${stepRows(r)}</div>
            <button class="btn quiet" data-step-add>${t('recipes.addStep')}</button>
          `)}

          ${panel(`
            <h2>${t('recipes.origin')}</h2>
            <p class="note">${t('recipes.sourceHint')}</p>
            ${field(t('recipes.sourceAuthor'), `<input type="text" data-f="srcAuthor" value="${esc(r.sourceRef?.author || '')}">`)}
            ${field(t('recipes.sourceText'), `<input type="text" data-f="srcText" value="${esc(r.sourceRef?.text || '')}">`)}
            ${field(t('recipes.sourceUrl'), `<input type="text" data-f="srcUrl" value="${esc(r.sourceRef?.url || '')}">`)}
            <label class="check"><input type="checkbox" data-f-bool="distributable" ${r.distributable ? 'checked' : ''}>
              ${t('recipes.distributable')}</label>
            <p class="hint">${t('recipes.distributableHint')}</p>
          `)}

          ${panel(`
            <h2>${t('common.notes')}</h2>
            ${pairField('', 'notes', r.notes, { multiline: true })}
            ${!isNew ? `<p class="hint">${t('recipes.versionHint')}</p>
              <button class="btn danger quiet" data-delete>${t('recipes.delete')}</button>` : ''}
          `)}
        </div>
      </div>`,
  });
}

// ------------------------------------------------------------------ wiring

function readForm(root) {
  for (const el of root.querySelectorAll('[data-f]')) {
    const key = el.dataset.f;
    let value = el.value;
    if (el.type === 'number') value = value === '' ? null : Number(value);
    draft[key] = value;
  }
  for (const el of root.querySelectorAll('[data-f-bool]')) draft[el.dataset.fBool] = el.checked;

  draft.appliesTo = [];
  for (const el of root.querySelectorAll('[data-multi="appliesTo"]')) {
    if (el.checked) draft.appliesTo.push(el.value);
  }

  const ings = [];
  for (const el of root.querySelectorAll('[data-ing]')) {
    const [i, key] = el.dataset.ing.split('.');
    const idx = Number(i);
    ings[idx] = ings[idx] || {
      id: draft.ingredients?.[idx]?.id || uid(),
      options: draft.ingredients?.[idx]?.options || [],
    };
    let value = el.value;
    if (el.type === 'number') value = value === '' ? null : Number(value);
    if (key === 'whenFibreClass') value = value ? [value] : null;
    ings[idx][key] = value;
  }
  for (const el of root.querySelectorAll('[data-opt]')) {
    const [i, j, key] = el.dataset.opt.split('.');
    const idx = Number(i), jdx = Number(j);
    if (!ings[idx]) continue;
    ings[idx].options[jdx] = ings[idx].options[jdx] || { id: draft.ingredients?.[idx]?.options?.[jdx]?.id || uid() };
    let value = el.value;
    if (el.type === 'number') value = value === '' ? null : Number(value);
    if (key === 'note') value = { bg: value, en: draft.ingredients?.[idx]?.options?.[jdx]?.note?.en || '' };
    ings[idx].options[jdx][key] = value;
  }
  draft.ingredients = ings.filter(Boolean);
  for (const ing of draft.ingredients) ing.options = (ing.options || []).filter(Boolean);

  const steps = [];
  for (const el of root.querySelectorAll('[data-step]')) {
    const [i] = el.dataset.step.split('.');
    const idx = Number(i);
    steps[idx] = { id: draft.steps?.[idx]?.id || uid(), order: idx, text: { bg: el.value, en: draft.steps?.[idx]?.text?.en || '' } };
  }
  draft.steps = steps.filter(Boolean);

  readPairs(root, draft);

  draft.sourceRef = (draft.srcText || draft.srcAuthor || draft.srcUrl)
    ? { text: draft.srcText || '', author: draft.srcAuthor || '', url: draft.srcUrl || '' }
    : null;
  delete draft.srcText; delete draft.srcAuthor; delete draft.srcUrl;
}

export default {
  id: 'recipes',
  title: () => t('recipes.title'),
  sub: () => t('recipes.sub'),

  async render(root) {
    if (mode === 'chains') {
      await chains.render(root, host);
      // The tab switch lives in the shared header, so it must keep working
      // whichever module drew the page.
      const prev = root.onclick;
      root.onclick = async (e) => {
        const tab = e.target.closest('[data-mode]');
        if (tab) { mode = tab.dataset.mode; return this.render(root); }
        return prev?.(e);
      };
      return;
    }

    if (openId) {
      if (!draft || (openId !== 'new' && draft.id !== openId)) {
        draft = openId === 'new' ? blank() : structuredClone(await get('recipes', openId));
      }
      await renderForm(root, draft);
    } else {
      draft = null;
      await renderList(root);
    }

    root.onclick = async (e) => {
      const tab = e.target.closest('[data-mode]');
      if (tab) { mode = tab.dataset.mode; return this.render(root); }

      const ty = e.target.closest('[data-type]');
      if (ty) { filterType = ty.dataset.type || null; return this.render(root); }
      if (e.target.closest('[data-new]')) { draft = null; openId = 'new'; return this.render(root); }
      const row = e.target.closest('[data-open]');
      if (row) { draft = null; openId = row.dataset.open; return this.render(root); }
      if (e.target.closest('[data-back]')) { openId = null; draft = null; return this.render(root); }

      if (e.target.closest('[data-ing-add]')) {
        readForm(root);
        draft.ingredients.push({
          id: uid(), roleCode: '', basis: 'percent_wof', basisRefersTo: null,
          whenFibreClass: null, unit: 'g',
          options: [{ id: uid(), substanceId: '', qtyMin: null, qtyMax: null, note: { bg: '', en: '' } }],
        });
        return renderForm(root, draft);
      }
      const idel = e.target.closest('[data-ing-del]');
      if (idel) {
        readForm(root);
        draft.ingredients.splice(Number(idel.dataset.ingDel), 1);
        return renderForm(root, draft);
      }
      const fdel = e.target.closest('[data-follow-del]');
      if (fdel) {
        readForm(root);
        draft.requiredFollowOn = (draft.requiredFollowOn || []).filter(x => x !== fdel.dataset.followDel);
        return renderForm(root, draft);
      }

      const oadd = e.target.closest('[data-opt-add]');
      if (oadd) {
        readForm(root);
        const idx = Number(oadd.dataset.optAdd);
        draft.ingredients[idx].options = draft.ingredients[idx].options || [];
        draft.ingredients[idx].options.push({ id: uid(), substanceId: '', qtyMin: null, qtyMax: null, note: { bg: '', en: '' } });
        return renderForm(root, draft);
      }
      const odel = e.target.closest('[data-opt-del]');
      if (odel) {
        readForm(root);
        const [i, j] = odel.dataset.optDel.split('.').map(Number);
        draft.ingredients[i].options.splice(j, 1);
        return renderForm(root, draft);
      }

      if (e.target.closest('[data-step-add]')) {
        readForm(root);
        draft.steps.push({ id: uid(), order: draft.steps.length, text: { bg: '', en: '' } });
        return renderForm(root, draft);
      }
      const sdel = e.target.closest('[data-step-del]');
      if (sdel) {
        readForm(root);
        draft.steps.splice(Number(sdel.dataset.stepDel), 1);
        return renderForm(root, draft);
      }

      if (e.target.closest('[data-save]')) {
        readForm(root);
        await put('recipes', draft);
        openId = null; draft = null;
        return this.render(root);
      }

      // Versioning: past trials keep pointing at the version actually used,
      // otherwise old results become unexplainable (§5).
      if (e.target.closest('[data-save-version]')) {
        readForm(root);
        const next = { ...structuredClone(draft), id: uid(), version: (draft.version || 1) + 1 };
        next.createdAt = new Date().toISOString();
        await put('recipes', next);
        openId = null; draft = null;
        return this.render(root);
      }

      if (e.target.closest('[data-delete]')) {
        if (!confirm(t('recipes.confirmDelete'))) return;
        await remove('recipes', draft.id);
        openId = null; draft = null;
        return this.render(root);
      }
    };

    root.oninput = async (e) => {
      if (e.target.dataset.scale) {
        scaleCtx[e.target.dataset.scale] = e.target.type === 'number' ? Number(e.target.value) : e.target.value;
        readForm(root);
        const substances = await all('substances');
        const box = root.querySelector('.scaleblock');
        if (box) box.innerHTML = await scaleBlock(draft, substances);
        return;
      }
      if (e.target.dataset.ing || e.target.dataset.opt) {
        readForm(root);
        const substances = await all('substances');
        const box = root.querySelector('.scaleblock');
        if (box) box.innerHTML = await scaleBlock(draft, substances);
      }
    };

    root.onchange = async (e) => {
      if (e.target.matches('[data-follow-add]') && e.target.value) {
        readForm(root);
        draft.requiredFollowOn = [...(draft.requiredFollowOn || []), e.target.value];
        return renderForm(root, draft);
      }
      if (e.target.dataset.choice) {
        const ing = draft.ingredients.find(x => x.id === e.target.dataset.choice);
        if (ing) scaleChoices[ing.id] = e.target.value;
        const substances = await all('substances');
        const box = root.querySelector('.scaleblock');
        if (box) box.innerHTML = await scaleBlock(draft, substances);
        return;
      }
      if (e.target.matches('[data-f="scaleBy"]')) {
        readForm(root);
        return renderForm(root, draft);
      }
      if (e.target.matches('[data-f="type"]') || (e.target.dataset.ing || '').endsWith('.basis') || (e.target.dataset.ing || '').endsWith('.roleCode')) {
        readForm(root);
        return renderForm(root, draft);
      }
      if (e.target.dataset.scale || e.target.dataset.ing || e.target.dataset.opt) {
        readForm(root);
        const substances = await all('substances');
        const box = root.querySelector('.scaleblock');
        if (box) box.innerHTML = await scaleBlock(draft, substances);
      }
    };
  },
};

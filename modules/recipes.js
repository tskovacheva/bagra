// modules/recipes.js — procedures with proportions (§5).
//
// A recipe specifies ROLES filled by substances, and quantities with an
// explicit basis. One generic scaling engine serves every proportional
// recipe here; only the aluminium acetate stoichiometry earns its own code.

import { all, get, put, remove, newRecord, uid, getSetting, setSetting, toggleFavorite } from '../db.js';
import { t, text, getLang } from '../i18n.js';
import {
  page, panel, field, options, label, favStar, esc, empty, note,
  pairField, readPairs, fact, facts, prose, readBlock,
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
let favOnly = false;
let openId = null;
let draft = null;
let scaleCtx = { weightG: 250, fibreClass: 'cellulose', bathLitres: null };
let scaleChoices = {};
let returnTo = null;
let editing = false;

const returnBar = () => returnTo
  ? `<button class="btn" data-returnto>← ${esc(returnTo.label)}</button>` : '';

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
    learnedFrom: '',
    distributable: true,
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

  const favCount = recipes.filter(r => r.favorite).length;

  const shown = recipes
    .filter(r => (!filterType || r.type === filterType) && (!favOnly || r.favorite))
    .sort((a, b) => text(a.name).localeCompare(text(b.name)));

  const rows = await Promise.all(shown.map(async r => {
    const fibres = await Promise.all((r.appliesTo || []).map(c => label('fibre_class', c)));
    return `<tr data-open="${r.id}">
      <td class="favcell">${favStar(r)}</td>
      <td>${esc(text(r.name) || '—')}</td>
      <td>${esc(await label('recipe_type', r.type))}</td>
      <td>${esc(fibres.join(', '))}</td>
      <td class="num">${(r.ingredients || []).length}</td>
      <td>${esc(r.learnedFrom || '—')}</td>
      <td class="num">${r.version || 1}</td>
    </tr>`;
  }));

  const table = shown.length ? `
    <table class="grid">
      <thead><tr>
        <th class="favcell"></th>
        <th>${t('recipes.col.name')}</th>
        <th>${t('recipes.col.type')}</th>
        <th>${t('recipes.col.appliesTo')}</th>
        <th class="num">${t('recipes.col.ingredients')}</th>
        <th>${t('recipes.learnedFrom')}</th>
        <th class="num">${t('recipes.col.version')}</th>
      </tr></thead>
      <tbody>${rows.join('')}</tbody>
    </table>`
    : empty(filterType ? t('recipes.emptyType') : t('recipes.empty'), t('recipes.emptyHint'));

  root.innerHTML = page({
    title: t('recipes.title'),
    sub: t('recipes.sub'),
    actions: `${returnBar()}${host.tabs()}<button class="btn primary" data-new>${t('recipes.new')}</button>`,
    body: `
      <div class="boxes">
        <button class="box${filterType === null ? ' active' : ''}" data-type="">
          <span class="boxname">${t('common.all')}</span>
          <span class="boxcount">${recipes.length}</span>
        </button>
        ${tabs.join('')}
        ${favCount ? `<button class="box${favOnly ? ' active' : ''}" data-favonly>
          <span class="boxname">${t('common.favorites')}</span>
          <span class="boxcount">${favCount}</span>
        </button>` : ''}
      </div>
      ${panel(table, 'flush')}`,
  });
}

// ---------------------------------------------------------------- form view

async function ingredientRows(r, substances, plants) {
  const sourceOptions = (o) => {
    const current = o.plantId ? 'p:' + o.plantId : (o.substanceId ? 's:' + o.substanceId : '');
    return `<option value="">—</option>` +
      `<optgroup label="${esc(t('recipes.fromPlants'))}">` + plants.map(p =>
        `<option value="p:${p.id}"${current === 'p:' + p.id ? ' selected' : ''}>${esc(text(p.nameCommon))}</option>`).join('') +
      `</optgroup>` +
      `<optgroup label="${esc(t('recipes.fromSubstances'))}">` + substances.map(sx =>
        `<option value="s:${sx.id}"${current === 's:' + sx.id ? ' selected' : ''}>${esc(text(sx.name))}</option>`).join('') +
      `</optgroup>`;
  };

  // basisRefersTo exists for one specific ambiguity — preparing a compound,
  // where a percentage may mean the finished product or the raw salt. Showing
  // it on a tannin bath only invites a meaningless choice.
  const AMBIGUOUS_ROLES = ['aluminium_source', 'sodium_source'];

  const rows = await Promise.all((r.ingredients || []).map(async (ing, i) => {
    const opts = ing.options?.length ? ing.options : [];
    const optRows = (await Promise.all(opts.map(async (o, j) => `
      ${j > 0 ? `<div class="orsep"><span>${t('recipes.or')}</span></div>` : ''}
      <div class="optrow">
        <select data-opt="${i}.${j}.source">${sourceOptions(o)}</select>
        ${o.plantId ? `<select data-opt="${i}.${j}.partCode">${await options('plant_part', o.partCode, t('recipes.wholePlant'))}</select>
           <select data-opt="${i}.${j}.condition">
             <option value="dried"${o.condition === 'dried' ? ' selected' : ''}>${t('materials.form.dried')}</option>
             <option value="fresh"${o.condition === 'fresh' ? ' selected' : ''}>${t('materials.form.fresh')}</option>
             <option value="extract"${o.condition === 'extract' ? ' selected' : ''}>${t('materials.form.extract')}</option>
           </select>
           <button class="btn quiet" data-fromlib="${i}.${j}" title="${esc(t('recipes.fromLibrary'))}">${t('recipes.fromLibraryShort')}</button>` : ''}
        <input type="number" step="0.1" min="0" data-opt="${i}.${j}.qtyMin" value="${o.qtyMin ?? ''}" placeholder="${t('recipes.qtyMin')}" aria-label="${t('recipes.qtyMin')}">
        <input type="number" step="0.1" min="0" data-opt="${i}.${j}.qtyMax" value="${o.qtyMax ?? ''}" placeholder="${t('recipes.qtyMax')}" aria-label="${t('recipes.qtyMax')}">
        <input type="text" data-opt="${i}.${j}.note" value="${esc(o.note?.bg || '')}" placeholder="${t('recipes.optionNotePlaceholder')}" aria-label="${t('recipes.optionNote')}">
        <button class="btn quiet" data-opt-del="${i}.${j}" aria-label="×">×</button>
      </div>`))).join('');

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
  const primary = getLang();
  const other = primary === 'bg' ? 'en' : 'bg';

  return (r.steps || []).map((st, i) => {
    const pair = (typeof st.text === 'string') ? { bg: st.text, en: '' } : (st.text || {});
    const missing = !!(pair[primary] && !pair[other]);
    return `
    <div class="steprow">
      <span class="stepnum">${i + 1}</span>
      <div class="stepbody">
        <textarea data-step="${i}.${primary}" rows="2" placeholder="${t('recipes.stepText')}">${esc(pair[primary] || '')}</textarea>
        <details class="pairalt"${missing ? '' : ' open'}>
          <summary>${esc(t('i18n.otherLang', { lang: other.toUpperCase() }))}${
            missing ? ` <span class="untranslated">${esc(t('i18n.missingShort'))}</span>` : ''}</summary>
          <textarea data-step="${i}.${other}" rows="2">${esc(pair[other] || '')}</textarea>
        </details>
      </div>
      <button class="btn quiet" data-step-del="${i}" aria-label="×">×</button>
    </div>`;
  }).join('') || `<p class="hint">—</p>`;
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

  const plantsById = new Map((await all('plants')).map(p => [p.id, p]));
  const nameOfOption = async (o, roleCode) => {
    if (o?.plantId) {
      const p = plantsById.get(o.plantId);
      const part = o.partCode ? ', ' + await label('plant_part', o.partCode) : '';
      const form = o.condition ? ', ' + t('materials.form.' + o.condition) : '';
      return (p ? text(p.nameCommon) : '—') + part + form;
    }
    const sub = byId.get(o?.substanceId);
    return sub ? text(sub.name) : ((await label('ingredient_role', roleCode)) || '—');
  };

  const lines = await Promise.all(scaled.ingredients.map(async ing => {
    const nameStr = await nameOfOption(ing.option, ing.roleCode);
    const amount = ing.scaledAmount != null
      ? ing.scaledAmount
      : `${ing.scaledMin ?? '—'}–${ing.scaledMax ?? '—'}`;

    // When a role can be filled several ways, the choice belongs here, next to
    // the number it changes — not buried in the recipe definition above.
    const picker = (ing.options?.length > 1)
      ? `<span class="pickhint">${t('recipes.choose')}</span>
         <select data-choice="${ing.id}">${(await Promise.all(ing.options.map(async o =>
            `<option value="${o.id}"${o.id === ing.option?.id ? ' selected' : ''}>${
              esc(await nameOfOption(o, ing.roleCode))}${o.note?.bg ? ' · ' + esc(o.note.bg) : ''}</option>`))).join('')}</select>`
      : '';

    return `<div class="calcout calcpick">
      <span class="calclabel">${picker || esc(nameStr)}</span>
      <span class="calcvalue">${amount} <small>${esc(ing.scaledUnit || '')}</small></span>
    </div>`;
  }));

  const warnHtml = (await Promise.all(warnings.map(async w => {
    const nameStr = await nameOfOption(w.ingredient.option, w.ingredient.roleCode);
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

// A recipe is followed standing over a pot, and the question at each moment is
// "what do I put in now, how much, how hot, for how long". Two parallel panels
// — steps on one side, quantities on the other — force that answer to be
// assembled from two places every time.
async function renderRead(root, r) {
  const substances = await all('substances');
  const plantsById = new Map((await all('plants')).map(p => [p.id, p]));
  const byId = new Map(substances.map(x => [x.id, x]));
  const allRecipes = await all('recipes');

  const scaled = scaleRecipe(r, {
    ...scaleCtx, choices: scaleChoices,
    bathLitres: r.scaleBy === 'volume' ? (scaleCtx.bathLitres ?? r.defaultLitres) : null,
  });

  const nameOf = async (o, roleCode) => {
    if (o?.plantId) {
      const p = plantsById.get(o.plantId);
      const part = o.partCode ? ', ' + await label('plant_part', o.partCode) : '';
      const form = o.condition ? ', ' + t('materials.form.' + o.condition) : '';
      return (p ? text(p.nameCommon) : '—') + part + form;
    }
    const sub = byId.get(o?.substanceId);
    return sub ? text(sub.name) : ((await label('ingredient_role', roleCode)) || '—');
  };

  const amounts = (await Promise.all(scaled.ingredients.map(async ing => {
    const amount = ing.scaledAmount != null
      ? ing.scaledAmount
      : (ing.scaledMin != null ? `${ing.scaledMin}–${ing.scaledMax}` : '—');
    return `
      <div class="weighline">
        <span class="weighname">${esc(await nameOf(ing.option, ing.roleCode))}</span>
        <span class="weighamount">${amount} <small>${esc(ing.scaledUnit || '')}</small></span>
      </div>`;
  }))).join('');

  const conditions = [
    r.tempC != null ? `${r.tempC} °C` : '',
    r.heldMinutes ? `${r.heldMinutes} ${t('common.min')}` : '',
    r.restMinutes ? `+ ${r.restMinutes} ${t('common.min')}` : '',
    scaled.bathLitres != null ? `${scaled.bathLitres} ${t('tools.litres')}` : '',
  ].filter(Boolean).join(' · ');

  const steps = (r.steps || []).map((st, i) => `
    <li class="workstep">
      <span class="stepnum">${i + 1}</span>
      <div class="prose"><p>${esc(text(st.text) || '—')}</p></div>
    </li>`).join('');

  const follow = (r.requiredFollowOn || [])
    .map(id => allRecipes.find(x => x.id === id)).filter(Boolean)
    .map(x => esc(text(x.name))).join(', ');

  root.innerHTML = page({
    title: text(r.name) || t('recipes.one'),
    sub: `${await label('recipe_type', r.type)} · ${t('recipes.version', { n: r.version || 1 })}`,
    actions: `${favStar(r, true)}
              <button class="btn quiet" data-back>${t('common.back')}</button>
              <button class="btn primary" data-edit>${t('common.edit')}</button>`,
    body: `
      ${panel(`
        <h2>${t('recipes.workView')}</h2>
        <p class="note">${t('recipes.workHint')}</p>
        <div class="workhead">
          ${r.scaleBy === 'volume'
            ? `<label class="inlinefield"><span>${t('recipes.forLitres')}</span>
                 <input type="number" step="0.5" min="0" data-scale="bathLitres" value="${scaleCtx.bathLitres ?? r.defaultLitres ?? ''}"></label>`
            : `<label class="inlinefield"><span>${t('recipes.forWeight')}</span>
                 <input type="number" step="10" min="0" data-scale="weightG" value="${scaleCtx.weightG ?? ''}"></label>
               <label class="inlinefield"><span>${t('recipes.forFibre')}</span>
                 <select data-scale="fibreClass">${await options('fibre_class', scaleCtx.fibreClass, '')}</select></label>`}
        </div>

        <div class="weighbox">
          <span class="weightitle">${t('recipes.weigh')}</span>
          ${amounts || `<p class="hint">—</p>`}
        </div>

        ${conditions ? `<p class="conditions">${esc(conditions)}</p>` : ''}
        ${steps ? `<ol class="worksteps">${steps}</ol>` : ''}
        ${follow ? note(`${t('recipes.thenFollow')} <b>${follow}</b>`, 'warn') : ''}
      `)}

      <div class="gap"></div>

      ${readBlock('', facts([
        fact(t('recipes.appliesTo'), (await Promise.all((r.appliesTo || []).map(c => label('fibre_class', c)))).join(', ')),
        fact(t('recipes.learnedFrom'), esc(r.learnedFrom || '')),
        r.distributable === false ? fact(t('recipes.notDistributable'), '✓') : '',
      ]) + prose(r.notes))}`,
  });
}

async function renderForm(root, r) {
  const isNew = openId === 'new';
  const allRecipes = await all('recipes');
  const substances = (await all('substances'))
    .sort((a, b) => text(a.name).localeCompare(text(b.name)));
  const plantList = (await all('plants'))
    .sort((a, b) => text(a.nameCommon).localeCompare(text(b.nameCommon)));

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
            <div class="inglist">${await ingredientRows(r, substances, plantList)}</div>
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
            ${field(t('recipes.learnedFrom'), `<input type="text" data-f="learnedFrom" value="${esc(r.learnedFrom || '')}">`, t('recipes.learnedFromHint'))}
            <label class="check"><input type="checkbox" data-f-bool="notDistributable" ${r.distributable === false ? 'checked' : ''}>
              ${t('recipes.notDistributable')}</label>
            <p class="hint">${t('recipes.notDistributableHint')}</p>
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
    if (key === 'source') {
      const opt = ings[idx].options[jdx];
      opt.plantId = value.startsWith('p:') ? value.slice(2) : '';
      opt.substanceId = value.startsWith('s:') ? value.slice(2) : '';
      if (!opt.plantId) opt.partCode = '';
      continue;
    }
    ings[idx].options[jdx][key] = value;
  }
  draft.ingredients = ings.filter(Boolean);
  for (const ing of draft.ingredients) ing.options = (ing.options || []).filter(Boolean);

  const steps = [];
  for (const el of root.querySelectorAll('[data-step]')) {
    const [i, langCode] = el.dataset.step.split('.');
    const idx = Number(i);
    steps[idx] = steps[idx] || {
      id: draft.steps?.[idx]?.id || uid(), order: idx, text: {},
    };
    steps[idx].text[langCode] = el.value;
  }
  draft.steps = steps.filter(Boolean);

  readPairs(root, draft);

  // Redistributable by default; the checkbox is an opt-out (§13.1).
  draft.distributable = !draft.notDistributable;
  delete draft.notDistributable;
}

export default {
  id: 'recipes',
  title: () => t('recipes.title'),
  sub: () => t('recipes.sub'),

  // Choosing a module in the navigation means "take me to this module", not
  // "show me whatever I last had open in it". Called by the router on entry.
  reset() {
    openId = null;
    draft = null;
    editing = false;
    mode = 'recipes';
    filterType = null;
    // Leaving the module and coming back must not leave the favourites filter
    // silently on: the list would look short for no visible reason.
    favOnly = false;
    chains.reset?.();
  },

  async render(root) {
    // The tab switch lives in the shared header and must keep working whichever
    // module last drew the page. Registered as a real listener rather than via
    // root.onclick, which every module overwrites when it renders.
    if (!root.__tabHandler) {
      root.__tabHandler = (e) => {
        const tab = e.target.closest('[data-mode]');
        if (!tab) return;
        e.stopPropagation();
        mode = tab.dataset.mode;
        this.render(root);
      };
      root.addEventListener('click', root.__tabHandler, true);
    }

    if (mode === 'chains') {
      await chains.render(root, host);
      return;
    }

    if (openId) {
      if (!draft || (openId !== 'new' && draft.id !== openId)) {
        draft = openId === 'new' ? blank() : structuredClone(await get('recipes', openId));
      }
      if (editing || openId === 'new') await renderForm(root, draft);
      else await renderRead(root, draft);
    } else {
      draft = null;
      await renderList(root);
    }

    root.onclick = async (e) => {
      if (e.target.closest('[data-returnto]')) {
        const target = returnTo;
        await setSetting('returnTo', null);
        location.hash = '#/' + (target?.module || 'trials');
        return;
      }

      const fav = e.target.closest('[data-fav]');
      if (fav) {
        e.stopPropagation();
        await toggleFavorite('recipes', fav.dataset.fav);
        if (draft && draft.id === fav.dataset.fav) draft.favorite = !draft.favorite;
        return this.render(root);
      }
      if (e.target.closest('[data-favonly]')) { favOnly = !favOnly; return this.render(root); }

      const ty = e.target.closest('[data-type]');
      if (ty) { filterType = ty.dataset.type || null; return this.render(root); }
      if (e.target.closest('[data-new]')) { draft = null; openId = 'new'; editing = true; return this.render(root); }
      if (e.target.closest('[data-edit]')) { editing = true; return this.render(root); }
      const row = e.target.closest('[data-open]');
      if (row) { draft = null; openId = row.dataset.open; editing = false; return this.render(root); }
      if (e.target.closest('[data-back]')) {
        if (editing && openId !== 'new') { editing = false; return this.render(root); }
        openId = null; draft = null; editing = false;
        return this.render(root);
      }

      if (e.target.closest('[data-ing-add]')) {
        readForm(root);
        draft.ingredients.push({
          id: uid(), roleCode: '', basis: 'percent_wof', basisRefersTo: null,
          whenFibreClass: null, unit: 'g',
          options: [{ id: uid(), substanceId: '', plantId: '', partCode: '', condition: 'dried',
                      qtyMin: null, qtyMax: null, note: { bg: '', en: '' } }],
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

      // The plant record already holds a dose for this part and condition, and
      // the extraction and dyeing temperatures. Retyping them by hand is how
      // the recipe and the reference drift apart.
      const fromlib = e.target.closest('[data-fromlib]');
      if (fromlib) {
        readForm(root);
        const [i, j] = fromlib.dataset.fromlib.split('.').map(Number);
        const opt = draft.ingredients[i].options[j];
        const plant = (await all('plants')).find(p => p.id === opt.plantId);
        if (!plant) return;

        const part = (plant.parts || []).find(x => x.partCode === opt.partCode) || plant.parts?.[0];
        const dose = (part?.dosing || []).find(d => d.condition === opt.condition)
                  || (part?.dosing || []).find(d => !d.condition)
                  || (part?.dosing || [])[0];
        if (dose) { opt.qtyMin = dose.min; opt.qtyMax = dose.max; draft.ingredients[i].basis = 'percent_wof'; }

        if (plant.tempDyeC && draft.tempC == null) draft.tempC = plant.tempDyeC.min;
        if (plant.liquorRatio && draft.liquorRatio == null) draft.liquorRatio = plant.liquorRatio;

        if (!dose) alert(t('recipes.noLibraryDose'));
        return renderForm(root, draft);
      }

      const oadd = e.target.closest('[data-opt-add]');
      if (oadd) {
        readForm(root);
        const idx = Number(oadd.dataset.optAdd);
        draft.ingredients[idx].options = draft.ingredients[idx].options || [];
        draft.ingredients[idx].options.push({ id: uid(), substanceId: '', plantId: '', partCode: '',
                                              condition: 'dried', qtyMin: null, qtyMax: null,
                                              note: { bg: '', en: '' } });
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
        openId = draft.id;
        editing = false;
        if (returnTo) {
          openId = null; draft = null;
          const target = returnTo;
          await setSetting('returnTo', null);
          location.hash = '#/' + target.module;
          return;
        }
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
      if ((e.target.dataset.opt || '').endsWith('.source')) {
        readForm(root);
        return renderForm(root, draft);
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

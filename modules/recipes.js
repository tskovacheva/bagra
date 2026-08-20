// modules/recipes.js — procedures with proportions (§5).
//
// A recipe specifies ROLES filled by substances, and quantities with an
// explicit basis. One generic scaling engine serves every proportional
// recipe here; only the aluminium acetate stoichiometry earns its own code.

import { all, get, put, remove, newRecord, uid, getSetting, setSetting, toggleFavorite } from '../db.js';
import { t, text, getLang } from '../i18n.js';
import {
  page, panel, field, options, label, favStar, esc, empty, note,
  pairField, readPairs, fact, facts, prose, readBlock, searchBox, matches, navigate, flash,
  fieldGroup, icon, backTo, actionBtn } from '../ui.js';
import { scaleRecipe, recipeWarnings } from '../calc/scale.js';
import chains from './chains.js';

const TYPES = ['scour', 'tannin', 'mordant', 'dye', 'ecoprint', 'blanket', 'pigment', 'paste'];
const FIBRE_CLASSES = ['cellulose', 'protein'];

// Which types work on CLOTH and which MAKE A SUBSTANCE. The screen was built
// entirely for the first kind, so a pigment recipe carried weight-of-fibre,
// liquor ratio, fibre class and required follow-ons — none of which it has, and
// a watercolour recipe has none of them twice over. Every recipe carrying every
// field is not neutral: an empty field reads as one nobody has filled in yet
// rather than as one that does not apply, and there were more of the former
// than of the latter.
//
// A table rather than conditions scattered through the markup. `blanket`
// already had `r.type === 'blanket' ? panel(...) : ''` and was the only one, so
// the pattern existed and had simply never been applied to the rest — which is
// how a screen ends up shaped for whichever case was built first.
const MAKES_SUBSTANCE = ['pigment', 'paste'];
const worksOnCloth = (type) => !MAKES_SUBSTANCE.includes(type);

// Panel by panel, so the answer to "why is this not on screen" is one lookup.
const SHOWS = {
  // Fibre class: what cloth the recipe suits. A pigment has no cloth.
  appliesTo:  worksOnCloth,
  // The aluminium-acetate calculator works from weight of fibre (§13.9).
  computed:   worksOnCloth,
  // Liquor ratio is bath volume against cloth weight.
  liquorRatio: worksOnCloth,
  // "This recipe requires another after it" is about preparing cloth in order.
  // A pigment chain is ordered too, but by the chain, not by this field.
  followOn:   worksOnCloth,
  // The scaling block computes against a weight of goods.
  scale:      worksOnCloth,
  // Only the blanket recipe has blanket fields.
  blanket:    (type) => type === 'blanket',
  // Temperature, holding and pH matter to both kinds: a lake wants a
  // temperature ceiling and the laking step is a pH event.
  conditions: () => true,
};

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
let query = '';
let favOnly = false;
let openId = null;
let draft = null;
let scaleCtx = { weightG: 250, fibreClass: 'cellulose', bathLitres: null };
let scaleChoices = {};
let returnTo = null;
let editing = false;

const returnBar = () => returnTo
  ? `<button class="btn quiet upto" data-returnto>← ${esc(returnTo.label)}</button>` : '';

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
    // What this recipe produces, and so whether it is worked or only read
    // (§13by). Default 'none': most recipes make no record.
    output: 'none',
    computedBy: '',
    target: { percentWof: null, basisRefersTo: 'finished_product' },
    vinegarPercent: null,
    defaultLitres: null,
    liquorRatio: null,
    tempC: null,
    heldMinutes: null,
    restMinutes: null,
    phTarget: null,
    blanketKind: '', blanketConcentration: null, blanketFresh: true, blanketUses: 0,
    requiredFollowOn: [],
    notes: { bg: '', en: '' },
    distributable: true,
  });
}

// ---------------------------------------------------------------- list view

// `appliesTo` is a single code on a chain and a list of them on a recipe, and
// the studio's own chains carry a list in the field the model calls a code.
// Handed an array, `label()` finds no term and returns what it was given, which
// stringifies to a bare English "cellulose" in the middle of a Bulgarian line.
// Both shapes are read here rather than trusting either.
async function fibreText(appliesTo) {
  const codes = Array.isArray(appliesTo) ? appliesTo : (appliesTo ? [appliesTo] : []);
  return (await Promise.all(codes.map(c => label('fibre_class', c)))).filter(Boolean).join(', ');
}

// What the recipe asks of you, which is what a list is scanned for. The version
// was in this column and is not a question anyone puts to a list.
// A thermometer before a temperature and a timer before a duration (§13bh). The
// icons do not replace the unit — 70 °C still says °C — they let the eye find
// the temperature down a column of twenty recipes without reading any of them.
function conditionsOf(r) {
  return [
    r.tempC != null ? `<span class="cond">${icon('i-temp')}${r.tempC} °C</span>` : '',
    r.heldMinutes ? `<span class="cond">${icon('i-time')}${r.heldMinutes} ${t('common.min')}</span>` : '',
    r.restMinutes ? `<span class="cond">${icon('i-time')}+${r.restMinutes} ${t('common.min')}</span>` : '',
  ].filter(Boolean).join('') || '—';
}

// The mark for a recipe's type. Borrowed from the prototype, which reaches for
// the thing the step does to the cloth rather than for an abstract shape:
// scouring is water, tannin builds in coats, mordanting is the flask, a binding
// bath is the finish.
const TYPE_ICONS = {
  scour: 'i-drops', tannin: 'i-layers', mordant: 'i-flask',
  alum_acetate: 'i-flask', modifier: 'i-beaker', binder: 'i-finish',
  blanket: 'i-fabric', dye: 'i-beaker', finish: 'i-finish',
};
const typeIcon = (type) => icon(TYPE_ICONS[type] || 'i-recipe');

async function renderList(root) {
  const recipes = await all('recipes');
  const chainList = await all('chains');

  const counts = {};
  for (const r of recipes) counts[r.type] = (counts[r.type] || 0) + 1;

  const tabs = await Promise.all(TYPES.map(async ty => `
    <button class="box${filterType === ty ? ' active' : ''}" data-type="${ty}">
      <span class="boxname">${esc(await label('recipe_type', ty))}</span>
      <span class="boxcount">${counts[ty] || 0}</span>
    </button>`));

  const favCount = recipes.filter(r => r.favorite).length;

  const shown = recipes
    .filter(r => (!filterType || r.type === filterType) && (!favOnly || r.favorite)
              && matches(query, text(r.name), r.notes))
    .sort((a, b) => text(a.name).localeCompare(text(b.name)));

  const rows = await Promise.all(shown.map(async r => {
    const fibres = await Promise.all((r.appliesTo || []).map(c => label('fibre_class', c)));
    return `<tr data-open="${r.id}">
      <td class="favcell">${favStar(r)}</td>
      <td>${esc(text(r.name) || '—')}</td>
      <td><span class="typecell">${typeIcon(r.type)}${esc(await label('recipe_type', r.type))}</span></td>
      <td>${esc(fibres.join(', '))}</td>
      <td><span class="conds">${conditionsOf(r)}</span></td>
      <td class="num">${(r.ingredients || []).length}</td>
    </tr>`;
  }));

  const table = shown.length ? `
    <table class="grid">
      <thead><tr>
        <th class="favcell"></th>
        <th>${t('recipes.col.name')}</th>
        <th>${t('recipes.col.type')}</th>
        <th>${t('recipes.col.appliesTo')}</th>
        <th>${t('recipes.col.conditions')}</th>
        <th class="num">${t('recipes.col.ingredients')}</th>
      </tr></thead>
      <tbody>${rows.join('')}</tbody>
    </table>`
    : empty(filterType ? t('recipes.emptyType') : t('recipes.empty'), t('recipes.emptyHint'));

  // Chains sat behind a tab, so a person who never pressed it did not know they
  // existed — and a chain is the more useful unit: nobody mordants without
  // scouring first. They stand at the head of the list, each showing the steps
  // it is made of, and the tab remains for managing them. §13v.
  const byRecipeId = new Map(recipes.map(r => [r.id, r]));
  const chainCards = (await Promise.all(chainList.map(async c => {
    const steps = (c.steps || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
    const chips = (await Promise.all(steps.map(async (st, i) =>
      `<span class="chip"><b>${i + 1}</b> ${esc(text(byRecipeId.get(st.recipeId)?.name) || '—')}</span>`))).join('');
    return `
      <button class="chaincard" data-open-chain="${c.id}">
        <div class="chainname">${esc(text(c.name) || '—')}</div>
        <div class="hint">${esc(await fibreText(c.appliesTo))} ·
          ${t('chains.ofSteps', { n: steps.length })}</div>
        <div class="chiprow">${chips}</div>
      </button>`;
  }))).join('');

  root.innerHTML = page({
    title: t('recipes.title'),
    sub: t('recipes.sub'),
    actions: `${returnBar()}${host.tabs()}${actionBtn('add', t('recipes.new'), 'data-new', 'primary')}`,
    body: `
      ${chainCards ? panel(`<h2>${t('chains.tab')}</h2>
        <div class="chaincards">${chainCards}</div>`) : ''}
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
      <div class="filterrow">${searchBox(query, t('recipes.search'))}</div>
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
        ${actionBtn('add', t('recipes.addAlternative'), `data-opt-add="${i}"`, 'contextual')}
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
    substancesById: new Map(substances.map(sx => [sx.id, sx])),
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
    substancesById: new Map(substances.map(sx => [sx.id, sx])),
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

  const weighLines = async (list) => (await Promise.all(list.map(async ing => {
    const amount = ing.scaledAmount != null
      ? ing.scaledAmount
      : (ing.scaledMin != null ? `${ing.scaledMin}–${ing.scaledMax}` : '—');
    return `
      <div class="weighline">
        <span class="weighname">${esc(await nameOf(ing.option, ing.roleCode))}</span>
        <span class="weighamount">${amount} <small>${esc(ing.scaledUnit || '')}</small></span>
      </div>`;
  }))).join('');

  const amounts = await weighLines(scaled.ingredients);

  const conditions = [
    r.tempC != null ? `<span class="cond">${icon('i-temp')}${r.tempC} °C</span>` : '',
    r.heldMinutes ? `<span class="cond">${icon('i-time')}${r.heldMinutes} ${t('common.min')}</span>` : '',
    r.restMinutes ? `<span class="cond">${icon('i-time')}+ ${r.restMinutes} ${t('common.min')}</span>` : '',
    scaled.bathLitres != null ? `<span class="cond">${icon('i-beaker')}${scaled.bathLitres} ${t('tools.litres')}</span>` : '',
  ].filter(Boolean).join('');

  const steps = (r.steps || []).map((st, i) => `
    <li class="workstep">
      <span class="stepnum">${i + 1}</span>
      <div class="prose"><p>${esc(text(st.text) || '—')}</p></div>
    </li>`).join('');

  // §5.4: a recipe the work is not correct without is a step, not a footnote.
  // This used to be a list of names in a warning strip, and nothing scaled
  // them, so the chalk bath's 40 g of chalk appeared nowhere on the screen.
  // It is derived, never stored, and carries no number of its own — see the
  // note on `expandChain`.
  const followBlocks = (await Promise.all((r.requiredFollowOn || [])
    .map(id => allRecipes.find(x => x.id === id))
    .filter(Boolean)
    .map(async fr => {
      const fs = scaleRecipe(fr, {
        ...scaleCtx,
        choices: null,
        bathLitres: fr.defaultLitres ?? null,
      });
      const cond = [
        fr.tempC != null ? `${fr.tempC} °C` : '',
        fr.heldMinutes ? `${fr.heldMinutes} ${t('common.min')}` : '',
        fs.bathLitres != null ? `${fs.bathLitres} ${t('tools.litres')}` : '',
      ].filter(Boolean).join(' · ');
      return `
        <div class="planstep required">
          <div class="chainhead">
            <span class="stepnum followmark">&#8627;</span>
            <b>${esc(text(fr.name))}</b>
            <span class="spacer"></span>
            <span class="hint">${esc(cond)}</span>
          </div>
          <p class="requirednote">${t('chains.requiredStep')}</p>
          ${await weighLines(fs.ingredients) || `<p class="hint">—</p>`}
        </div>`;
    }))).join('');

  root.innerHTML = page({
    title: text(r.name) || t('recipes.one'),
    sub: `${await label('recipe_type', r.type)} · ${t('recipes.version', { n: r.version || 1 })}`,
    actions: `${favStar(r, true)}
              ${backTo('#/recipes', t('nav.recipes'))}
              ${actionBtn('edit', t('common.edit'), 'data-edit', 'primary')}`,
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

        ${conditions ? `<p class="conditions">${conditions}</p>` : ''}
        ${steps ? `<ol class="worksteps">${steps}</ol>` : ''}
        ${followBlocks}
      `)}

      <div class="gap"></div>

      ${readBlock('', facts([
        fact(t('recipes.appliesTo'), (await Promise.all((r.appliesTo || []).map(c => label('fibre_class', c)))).join(', ')),
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
    actions: `${backTo('#/recipes', t('nav.recipes'))}
              ${!isNew ? `<button class="btn primary" data-save-version>${t('recipes.saveNewVersion')}</button>` : ''}
              <button class="btn primary" data-save>${t('common.save')}</button>`,
    body: `
      <div class="cols">
        <div class="col">
          ${panel(`
            <h2>${t('recipes.about')}</h2>
            ${pairField(t('recipes.name'), 'name', r.name)}
            ${field(t('recipes.type'), `<select data-f="type">${await options('recipe_type', r.type, '')}</select>`)}
            ${SHOWS.appliesTo(r.type) ? fieldGroup(t('recipes.appliesTo'), `<div class="checks">${fibreChecks}</div>`) : ''}
          `)}

          ${panel(`
            <h2>${t('recipes.ingredients')}</h2>
            <p class="note">${t('recipes.ingredientsHint')}</p>
            <div class="inglist">${await ingredientRows(r, substances, plantList)}</div>
            ${actionBtn('add', t('recipes.addIngredient'), 'data-ing-add', 'contextual')}
            <p class="hint">${t('recipes.alternativesHint')} ${t('recipes.qtyRangeHint')}</p>
          `)}

          ${SHOWS.computed(r.type) ? panel(`
            <h2>${t('recipes.computed')}</h2>
            <p class="note">${t('recipes.computedHint')}</p>
            ${field(t('recipes.computedBy'), `<select data-f="computedBy">
                <option value=""${!r.computedBy ? ' selected' : ''}>${t('recipes.computedNone')}</option>
                <option value="aluminium_acetate"${r.computedBy === 'aluminium_acetate' ? ' selected' : ''}>${t('recipes.computedAlum')}</option>
              </select>`)}
            ${r.computedBy ? `
              ${field(t('recipes.targetPercent'), `<input type="number" step="0.5" min="0"
                 data-f="target.percentWof" value="${r.target?.percentWof ?? ''}">`)}
              ${field(t('recipes.targetBasis'), `<select data-f="target.basisRefersTo">
                  ${(await options('basis_refers_to', r.target?.basisRefersTo || 'finished_product', '')).replace(/^<option value="">.*?<\/option>/, '')}
                </select>`, t('recipes.targetBasisHint'))}
              ${field(t('recipes.vinegarPercent'), `<input type="number" step="0.5" min="0"
                 data-f="vinegarPercent" value="${r.vinegarPercent ?? ''}">`)}` : ''}
          `) : ''}

          ${panel(`
            <h2>${t('recipes.conditions')}</h2>
            ${field(t('recipes.tempC'), `<input type="number" step="1" data-f="tempC" value="${r.tempC ?? ''}">`)}
            ${field(t('recipes.heldMinutes'), `<input type="number" step="5" min="0" data-f="heldMinutes" value="${r.heldMinutes ?? ''}">`, t('recipes.heldHint'))}
            ${field(t('recipes.restMinutes'), `<input type="number" step="10" min="0" data-f="restMinutes" value="${r.restMinutes ?? ''}">`, t('recipes.restHint'))}
            ${field(t('recipes.scaleBy'), `<select data-f="scaleBy">
                <option value="weight"${r.scaleBy !== 'volume' ? ' selected' : ''}>${t('recipes.scaleBy.weight')}</option>
                <option value="volume"${r.scaleBy === 'volume' ? ' selected' : ''}>${t('recipes.scaleBy.volume')}</option>
              </select>`, t('recipes.scaleByHint'))}
            ${!SHOWS.liquorRatio(r.type) ? ''
              : r.scaleBy === 'volume'
                ? field(t('recipes.defaultLitres'), `<input type="number" step="0.5" min="0" data-f="defaultLitres" value="${r.defaultLitres ?? ''}">`)
                : field(t('recipes.liquorRatio'), `<input type="number" step="1" min="0" data-f="liquorRatio" value="${r.liquorRatio ?? ''}">`)}
            ${field(t('recipes.phTarget'), `<input type="number" step="0.1" min="0" max="14" data-f="phTarget" value="${r.phTarget ?? ''}">`)}
          `)}

          ${SHOWS.followOn(r.type) ? panel(`
            <h2>${t('recipes.followOn')}</h2>
            <p class="note">${t('recipes.followOnHint')}</p>
            <div class="followlist">${followOnRows(r, allRecipes)}</div>
            <select data-follow-add>
              <option value="">${t('recipes.addFollowOn')}</option>
              ${allRecipes
                .filter(x => x.id !== r.id && !(r.requiredFollowOn || []).includes(x.id))
                .map(x => `<option value="${x.id}">${esc(text(x.name))}</option>`).join('')}
            </select>
          `) : ''}

          ${SHOWS.blanket(r.type) ? panel(`
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
          ${SHOWS.scale(r.type) ? panel(`
            <h2>${t('recipes.scale')}</h2>
            <p class="note">${t('recipes.scaleHint')}</p>
            <div class="scaleblock">${await scaleBlock(r, substances)}</div>
          `) : panel(`
            <h2>${t('recipes.proportions')}</h2>
            <p class="note">${t('recipes.proportionsHint')}</p>
          `)}

          ${panel(`
            <h2>${t('recipes.steps')}</h2>
            <div class="steplist">${stepRows(r)}</div>
            ${actionBtn('add', t('recipes.addStep'), 'data-step-add', 'contextual')}
          `)}

          ${panel(`
            <h2>${t('recipes.origin')}</h2>
            <label class="check"><input type="checkbox" data-f-bool="notDistributable" ${r.distributable === false ? 'checked' : ''}>
              ${t('recipes.notDistributable')}</label>
            <p class="hint">${t('recipes.notDistributableHint')}</p>
          `)}

          ${panel(`
            <h2>${t('common.notes')}</h2>
            ${pairField('', 'notes', r.notes, { multiline: true })}
            ${!isNew ? `<p class="hint">${t('recipes.versionHint')}</p>
              ${actionBtn('delete', t('recipes.delete'), 'data-delete', 'destructive')}` : ''}
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

  // The address decides what is on screen. Called on every route change, with
  // nothing when the address names no record, which is how the list comes back.
  //
  //   #/recipes                 the list
  //   #/recipes/new             a new recipe
  //   #/recipes/<id>            the record
  //   #/recipes/<id>/edit       editing it
  //   #/recipes/chains          the chains tab
  //   #/recipes/chains/<id>     a chain
  //
  // Chains live inside the recipes address rather than as a module of their
  // own, because `activeNav()` lights a navigation entry by module id: at
  // `#/chains` nothing would be lit, while `#/recipes/chains` keeps Recipes lit
  // while its second tab is open. The cost is one reserved id — a recipe cannot
  // be called `chains` — and ids are generated, so nothing can collide.
  open(first, second) {
    draft = null;
    if (first === 'chains') {
      mode = 'chains';
      openId = null;
      editing = false;
      chains.open?.(second);
      return;
    }
    mode = 'recipes';
    chains.open?.();
    openId = first || null;
    editing = first === 'new' || second === 'edit';
  },

  // Arriving from elsewhere starts at the list with no search and no filter.
  // Moving within the module no longer calls this, so the search that led to a
  // record is still there on the way back.
  reset() {
    openId = null;
    draft = null;
    editing = false;
    mode = 'recipes';
    filterType = null;
    query = '';
    // Leaving the module and coming back must not leave the favourites filter
    // silently on: the list would look short for no visible reason.
    favOnly = false;
    chains.reset?.();
  },

  async render(root) {
    // Where to go back to, when a step in the diary sent us here to write the
    // recipe it needs. Read on every render because the setting is written by
    // the other module and this one may be entered by address (§13aq).
    //
    // It was declared and never loaded — the variable held `null` for as long
    // as it has existed, so the memo was written on the way here and read by
    // nobody. The button appeared to work and did half of nothing.
    returnTo = await getSetting('returnTo', null);

    // The tab switch lives in the shared header and must keep working whichever
    // module last drew the page. Registered as a real listener rather than via
    // root.onclick, which every module overwrites when it renders.
    if (!root.__tabHandler) {
      root.__tabHandler = (e) => {
        const tab = e.target.closest('[data-mode]');
        if (!tab) return;
        e.stopPropagation();
        navigate(tab.dataset.mode === 'chains' ? '#/recipes/chains' : '#/recipes');
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
      // An address naming a record that is gone — a bookmark to something
      // deleted, or the back button after deleting it. Drawing it throws, and a
      // thrown render leaves the previous screen in place, which reads as the
      // address being ignored (§11b). The list is the honest answer.
      if (!draft) return navigate('#/recipes');
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
        location.hash = target?.id
          ? `#/${target.module}/${target.id}${target.screen ? '/' + target.screen : ''}`
          : '#/' + (target?.module || 'trials');
        return;
      }

      const fav = e.target.closest('[data-fav]');
      if (fav) {
        e.stopPropagation();
        await toggleFavorite('recipes', fav.dataset.fav);
        if (draft && draft.id === fav.dataset.fav) draft.favorite = !draft.favorite;
        return this.render(root);
      }
      if (e.target.closest('[data-searchclear]')) { query = ''; return this.render(root); }
      if (e.target.closest('[data-favonly]')) { favOnly = !favOnly; return this.render(root); }

      const ty = e.target.closest('[data-type]');
      if (ty) { filterType = ty.dataset.type || null; return this.render(root); }
      // Every one of these moves through the address, so the back button, a
      // reload and a bookmark all land where the person actually was (§8.0d).
      // A chain card on the recipes list belongs to this module's handler; the
      // chains module is not rendered here to catch its own.
      const chainCard = e.target.closest('[data-open-chain]');
      if (chainCard) return navigate(`#/recipes/chains/${chainCard.dataset.openChain}`);
      if (e.target.closest('[data-new]')) return navigate('#/recipes/new');
      if (e.target.closest('[data-edit]')) return navigate(`#/recipes/${openId}/edit`);
      const row = e.target.closest('[data-open]');
      if (row) return navigate(`#/recipes/${row.dataset.open}`);
      if (e.target.closest('[data-back]')) {
        // Leaving the editor goes back to the record; leaving the record goes
        // back to the list. A new recipe has no record to return to.
        if (editing && openId !== 'new') return navigate(`#/recipes/${openId}`);
        return navigate('#/recipes');
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

        // The temperature of THIS part, not of the plant (§13az). Elder leaf
        // wants 80–90 and elder fruit 50–70; taking the plant's one number
        // would have handed the fruit the leaf's boil.
        if (part?.tempDyeC?.min != null && draft.tempC == null) draft.tempC = part.tempDyeC.min;
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
        flash(t('common.saved'));
        if (returnTo) {
          const savedId = draft.id;
          openId = null; draft = null;
          const target = returnTo;
          // The recipe that was just written is attached to the step that sent
          // us here, so the round trip ends where it started and finished
          // (§13aq). Written straight to the record rather than handed back
          // through a screen: the trial is not open, and the alternative is
          // another state channel of the kind §13q banned.
          if (target.module === 'trials' && target.id && target.stepId) {
            const trial = await get('trials', target.id);
            const step = (trial?.steps || []).find(x => x.id === target.stepId);
            if (step) {
              step.recipeId = savedId;
              step.source = 'r:' + savedId;
              await put('trials', trial);
            }
          }
          await setSetting('returnTo', null);
          location.hash = target.id
            ? `#/${target.module}/${target.id}${target.screen ? '/' + target.screen : ''}`
            : '#/' + target.module;
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
      if (e.target.dataset.search !== undefined) {
        query = e.target.value;
        const at = e.target.selectionStart;
        await this.render(root);
        const box = root.querySelector('[data-search]');
        if (box) { box.focus(); box.setSelectionRange(at, at); }
        return;
      }

      if (e.target.dataset.scale) {
        // A blank field is "not set", not zero. `Number('')` is 0, which for the
        // bath volume means every quantity computes to nothing.
        const raw = e.target.value;
        scaleCtx[e.target.dataset.scale] = e.target.type === 'number'
          ? (raw === '' ? null : Number(raw))
          : raw;

        // The same inputs stand on the record and in the editor, but only the
        // editor has a `.scaleblock` to replace. On the record nothing was
        // listening, so the work view — the thing meant to be read while
        // weighing — took a new weight or a new bath volume and went on showing
        // the old figures, or a dash where the volume had never been set.
        const box = root.querySelector('.scaleblock');
        if (box) {
          readForm(root);
          const substances = await all('substances');
          box.innerHTML = await scaleBlock(draft, substances);
          return;
        }

        // Redrawing the record puts the caret back at the start of the field,
        // so it is restored — a number being typed digit by digit is unusable
        // otherwise.
        const which = e.target.dataset.scale;
        const at = e.target.selectionStart;
        await this.render(root);
        const again = root.querySelector(`[data-scale="${which}"]`);
        if (again) {
          again.focus();
          try { again.setSelectionRange(at, at); } catch { /* number inputs may refuse */ }
        }
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

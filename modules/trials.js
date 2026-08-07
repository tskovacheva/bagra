// modules/trials.js — one real piece of work (§8).
//
// The largest screen, built last because it composes records from every other
// module. Its substance lives in two nested lists: steps, which carry what was
// actually done and for how long, and placements, which attribute a result to
// one plant rather than to a whole bundle.

import { all, get, put, remove, newRecord, uid, setSetting } from '../db.js';
import { t, text } from '../i18n.js';
import { page, panel, field, options, label, terms, segmented, esc, empty, note,
         fmtDate, today, fact, facts, readBlock, foldable } from '../ui.js';
import { shrinkResult, shrinkStep, shrinkThumb } from '../photo.js';

const ENHANCEMENTS = ['cloth_mordant', 'botanical_mordant', 'predye_substantive',
                      'blanket_mordant', 'blanket_dye', 'ph_modifier'];

let view = 'gallery';
let openId = null;
let draft = null;
let editing = false;
let filter = { plantId: '', processCode: '', status: '' };

// Which cloth a new trial was started from, taken from the address and used
// once. The trial reads the piece's own name and weight rather than opening by
// asking what the cloth already knows.
let handoff = null;

// Loaded once per render so the nested lists can name what they point at.
let plants = [], plantsById = new Map(), recipes = [], substances = [], combinations = [], chains = [], techniques = [];

function blank() {
  return newRecord({
    // One record from intention to result (§8.0a). A new trial starts as an
    // intention, because that is when it actually starts.
    status: 'planned',
    intent: '',
    planPhotos: [],
    date: today(),
    title: '',
    processCode: 'ecoprint',
    enhancements: [],
    fabricIds: [],
    weightOfGoodsG: null,
    techniqueIds: [],
    water: { sourceCode: '', note: '' },
    steps: [],
    placements: [],
    assessment: '',
    assessmentWhy: '',
    repeat: '',
    nextTime: '',
    resultPhotos: [],
    notes: '',
  });
}

const isEcoPrint = (r) => (r.processCode || '').startsWith('ecoprint');

// Records written before status existed are finished work: they were only ever
// entered after the fact. Read, never written back — a migration that guesses
// would be a migration that lies.
const statusOf = (r) => r.status || 'complete';

// Which stage a step belongs to when it does not say. Read, never written
// back: a record made before stages existed is not wrong, it simply predates
// the question, and a migration that guessed would turn a guess into a fact.
const STAGE_OF_TYPE = {
  prep_chain: 'prep', scour: 'prep', tannin: 'prep', mordant: 'prep',

  shibori_bind: 'decorate', apply_resist: 'decorate', print_paste: 'decorate',

  lay_base: 'colour', arrange: 'colour', lay_blanket: 'colour', bundle: 'colour',
  dye: 'colour', bundle_steam: 'colour', bundle_boil: 'colour',

  remove_resist: 'after', post_iron: 'after', post_modifier: 'after',
  soap: 'after', rinse: 'after', dry: 'after', cure: 'after',
};

const WORK_STAGES = ['prep', 'decorate', 'colour', 'after'];

const stageOf = (st) => st.stageCode || STAGE_OF_TYPE[st.typeCode] || 'colour';

// Steps grouped into consecutive runs of the same stage. Runs, not unique
// stages: dyeing before a print and again after it is two passes through
// colouring, and collapsing them would rewrite the order of the work.
function stageRuns(steps = []) {
  const runs = [];
  steps.forEach((st, i) => {
    const code = stageOf(st);
    const last = runs[runs.length - 1];
    if (last && last.code === code) last.items.push({ st, i });
    else runs.push({ code, items: [{ st, i }] });
  });
  return runs;
}

const statusChip = async (r) =>
  `<span class="statuschip ${statusOf(r)}">${esc(await label('trial_status', statusOf(r)))}</span>`;

// ---------------------------------------------------------------- gallery

async function renderList(root) {
  const trials = (await all('trials'))
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const shown = trials.filter(tr =>
    (!filter.plantId || (tr.placements || []).some(p => p.plantId === filter.plantId)) &&
    (!filter.processCode || tr.processCode === filter.processCode) &&
    // `open` is the one people actually want: what is on the bench right now,
    // whether it was thought of yesterday or started this morning.
    (!filter.status
      || (filter.status === 'open' ? statusOf(tr) !== 'complete' : statusOf(tr) === filter.status)));

  const usedPlants = [...new Set(trials.flatMap(tr => (tr.placements || []).map(p => p.plantId)))]
    .filter(Boolean);

  const plantFilter = `<option value="">${t('trials.all')}</option>` + usedPlants.map(id =>
    `<option value="${id}"${id === filter.plantId ? ' selected' : ''}>${esc(text(plantsById.get(id)?.nameCommon) || '—')}</option>`).join('');

  const cards = await Promise.all(shown.map(async tr => {
    const cover = tr.resultPhotos?.[0] || (tr.placements || []).find(p => p.photo)?.photo;
    const names = (await Promise.all((tr.placements || []).slice(0, 4)
      .map(async p => text(plantsById.get(p.plantId)?.nameCommon) || '—'))).join(', ');
    return `
      <button class="trialcard" data-open="${tr.id}">
        <div class="trialphoto">${cover
          ? `<img src="${cover}" alt="" loading="lazy">`
          : `<span class="trialnophoto">${esc(await label('process', tr.processCode))}</span>`}</div>
        <div class="trialmeta">
          <b>${esc(tr.title || t('trials.one'))}</b>
          <span class="hint">${fmtDate(tr.date)}${names ? ' · ' + esc(names) : ''}</span>
          ${statusOf(tr) !== 'complete' ? await statusChip(tr) : ''}
        </div>
      </button>`;
  }));

  const rows = await Promise.all(shown.map(async tr => `
    <tr data-open="${tr.id}">
      <td>${fmtDate(tr.date)}</td>
      <td>${esc(tr.title || '—')}</td>
      <td>${esc(await label('process', tr.processCode))}</td>
      <td>${esc((await Promise.all((tr.placements || []).map(async p =>
        text(plantsById.get(p.plantId)?.nameCommon) || '—'))).join(', '))}</td>
      <td>${await statusChip(tr)}</td>
      <td>${esc(await label('assessment', tr.assessment))}</td>
    </tr>`));

  const body = !shown.length
    ? empty(t('trials.empty'), t('trials.emptyHint'))
    : view === 'gallery'
      ? `<div class="trialgrid">${cards.join('')}</div>`
      : `<table class="grid">
          <thead><tr>
            <th>${t('trials.col.date')}</th><th>${t('trials.col.title')}</th>
            <th>${t('trials.col.process')}</th><th>${t('trials.col.plants')}</th>
            <th>${t('trials.assessment')}</th>
          </tr></thead>
          <tbody>${rows.join('')}</tbody>
        </table>`;

  root.innerHTML = page({
    title: t('trials.title'),
    sub: t('trials.sub'),
    actions: `
      <div class="tabswitch">
        <button class="tab${view === 'gallery' ? ' active' : ''}" data-view="gallery">${t('trials.gallery')}</button>
        <button class="tab${view === 'list' ? ' active' : ''}" data-view="list">${t('trials.list')}</button>
      </div>
      <button class="btn primary" data-new>${t('trials.new')}</button>`,
    body: `
      ${trials.length ? `<div class="filterrow">
        <label class="inlinefield"><span>${t('trials.filterPlant')}</span>
          <select data-filter="plantId">${plantFilter}</select></label>
        <label class="inlinefield"><span>${t('trials.filterProcess')}</span>
          <select data-filter="processCode">${await options('process', filter.processCode, t('trials.all'))}</select></label>
        <label class="inlinefield"><span>${t('trials.filterStatus')}</span>
          <select data-filter="status">
            <option value="">${t('trials.all')}</option>
            <option value="open"${filter.status === 'open' ? ' selected' : ''}>${t('trials.notFinished')}</option>
            ${(await terms('trial_status')).map(v =>
              `<option value="${v.code}"${filter.status === v.code ? ' selected' : ''}>${esc(text(v.label))}</option>`).join('')}
          </select></label>
      </div>` : ''}
      ${view === 'list' && shown.length ? panel(body, 'flush') : body}`,
  });
}

// ------------------------------------------------------------------- steps

// A strip of photographs with an add button. Offered, never required: at the
// bundle it leads the work, at the scale there is nothing to see (§8.0b).
function photoStrip(list, { addId, addAttr, delAttr, delValue = (j) => j, multiple = true }) {
  const shots = (list || []).map((src, j) => `
    <div class="stepphoto"><img src="${src}" alt="">
      <button class="btn quiet" ${delAttr}="${delValue(j)}" aria-label="×">×</button></div>`).join('');
  return `
    <div class="stepphotos">
      ${shots}
      <label class="addphoto" for="${addId}" title="${esc(t('trials.addPhoto'))}">+</label>
      <input type="file" id="${addId}" ${addAttr} accept="image/*"
             capture="environment"${multiple ? ' multiple' : ''} hidden>
    </div>`;
}

// The steps of one stage, and the progress line above them. The line is
// generated from what is there, never from a template: it shows the work as
// it went, repeats and all (§8.0b).
async function stageGroups(r) {
  const runs = stageRuns(r.steps);

  const line = (await Promise.all([
    { code: 'raw', fixed: true },
    ...runs.map(run => ({ code: run.code })),
    { code: 'done', fixed: true },
  ].map(async (m, n) => `
    <div class="stagemark${m.fixed ? ' fixed' : ''}">
      <span class="stagedot">${m.fixed ? '' : n}</span>
      <span>${esc(await label('trial_stage', m.code))}</span>
    </div>`))).join('<span class="stagearrow">›</span>');

  const groups = (await Promise.all(runs.map(async (run) => `
    <div class="stagegroup">
      <div class="stagehead">
        <b>${esc(await label('trial_stage', run.code))}</b>
        <span class="spacer"></span>
        <button class="btn quiet" data-step-add="${run.code}"
          data-after="${run.items[run.items.length - 1].i}">+ ${t('trials.addStep')}</button>
      </div>
      ${(await Promise.all(run.items.map(({ st, i }) => stepRow(r, st, i)))).join('')}
    </div>`))).join('');

  // Somewhere to begin when there is nothing yet: one button per working
  // stage, so the first step is chosen by what is being done, not by type.
  const starters = (await Promise.all(WORK_STAGES.map(async code =>
    `<button class="btn quiet" data-step-add="${code}">+ ${esc(await label('trial_stage', code))}</button>`
  ))).join('');

  return `
    <div class="stageline">${line}</div>
    ${groups || `<p class="hint">${t('trials.noStepsYet')}</p>`}
    <div class="stagestarters">${starters}</div>`;
}

async function stepRow(r, st, i) {
  // One selector for both, because from the bench they are the same question:
    // "what did I follow here?" A chain is simply a recipe with several parts.
    const current = st.chainId ? 'c:' + st.chainId : (st.recipeId ? 'r:' + st.recipeId : '');
    const recipeOptions = `<option value="">${t('trials.improvised')}</option>` +
      (chains.length ? `<optgroup label="${esc(t('chains.tab'))}">` + chains.map(x =>
        `<option value="c:${x.id}"${current === 'c:' + x.id ? ' selected' : ''}>${esc(text(x.name))}</option>`).join('') + '</optgroup>' : '') +
      `<optgroup label="${esc(t('chains.recipesTab'))}">` + recipes.map(x =>
        `<option value="r:${x.id}"${current === 'r:' + x.id ? ' selected' : ''}>${esc(text(x.name))}</option>`).join('') + '</optgroup>';

    const m = st.mediumMod;
    const substanceOptions = `<option value="">—</option>` + substances.map(x =>
      `<option value="${x.id}"${x.id === m?.materialId ? ' selected' : ''}>${esc(text(x.name))}</option>`).join('');

    return `
      <div class="ingrow">
        <div class="chainhead">
          <span class="stepnum">${i + 1}</span>
          <select data-step="${i}.typeCode">${await options('step_type', st.typeCode, t('trials.stepType'))}</select>
          <select data-step="${i}.stageCode" title="${esc(t('trials.stage'))}">${
            await options('trial_stage', stageOf(st))}</select>
          <select data-step="${i}.source">${recipeOptions}</select>
          <button class="btn quiet" data-newrecipe="${i}" title="${esc(t('trials.newRecipe'))}">+</button>
          <span class="spacer"></span>
          <button class="btn quiet" data-step-del="${i}" aria-label="×">×</button>
        </div>

        ${stageOf(st) === 'decorate' ? `
          <div class="mediumrow">
            <select data-step="${i}.techniqueId">
              <option value="">${t('trials.noTechnique')}</option>
              ${techniques.map(x => `<option value="${x.id}"${
                x.id === st.techniqueId ? ' selected' : ''}>${esc(text(x.name))}</option>`).join('')}
            </select>
          </div>` : ''}

        ${['lay_base', 'lay_blanket', 'arrange', 'bundle'].includes(st.typeCode) ? `
          <div class="mediumrow">
            <select data-step="${i}.roleCode">${await options('bundle_role', st.roleCode, t('trials.layerRole'))}</select>
            <input type="text" data-step="${i}.what" value="${esc(st.what || '')}" placeholder="${t('trials.layerWhat')}">
          </div>` : ''}

        <div class="steptimes">
          <label class="inlinefield"><span>${t('trials.temp')}</span>
            <input type="number" step="5" data-step="${i}.tempC" value="${st.tempC ?? ''}"></label>
          <label class="inlinefield"><span>${t('trials.held')}</span>
            <input type="number" step="5" min="0" data-step="${i}.heldMinutes" value="${st.heldMinutes ?? ''}"></label>
          <label class="inlinefield"><span>${t('trials.rest')}</span>
            <input type="number" step="10" min="0" data-step="${i}.restMinutes" value="${st.restMinutes ?? ''}"></label>
        </div>

        ${m ? `
          <div class="optblock">
            <span class="optlabel">${t('trials.medium')}</span>
            <div class="mediumrow">
              <select data-medium="${i}.whereCode">${await options('medium_where', m.whereCode, t('trials.mediumWhere'))}</select>
              <select data-medium="${i}.materialId">${substanceOptions}</select>
              <input type="text" data-medium="${i}.amount" value="${esc(m.amount || '')}" placeholder="${t('trials.mediumAmount')}">
              <input type="number" step="0.1" min="0" max="14" data-medium="${i}.phMeasured" value="${m.phMeasured ?? ''}" placeholder="pH">
              <button class="btn quiet" data-medium-del="${i}" aria-label="×">×</button>
            </div>
            <input type="text" data-medium="${i}.intent" value="${esc(m.intent || '')}" placeholder="${t('trials.mediumIntent')}">
          </div>`
        : `<button class="btn quiet" data-medium-add="${i}">${t('trials.addMedium')}</button>`}

        <input type="text" data-step="${i}.note" value="${esc(st.note || '')}" placeholder="${t('common.notes')}">

        ${photoStrip(st.photos, {
          addId: `stepphoto${i}`,
          addAttr: `data-step-photo="${i}"`,
          delAttr: 'data-step-photo-del',
          delValue: (j) => `${i}.${j}`,
        })}
      </div>`;
}

// -------------------------------------------------------------- placements

/**
 * Which reference record, if any, describes this placement.
 *
 * Resolved on the way in rather than stored as a back-reference: the link is
 * derived from the inputs, and a stored one would go stale the moment either
 * side was edited.
 */
function matchCombination(placement, trial) {
  const mordantStep = (trial.steps || []).find(s => s.typeCode === 'mordant');
  const phStep = (trial.steps || []).find(s => s.mediumMod?.whereCode);
  return combinations.find(c => {
    const k = c.key || {};
    if (k.dyeSource?.plantId !== placement.plantId) return false;
    if (placement.partCode && k.dyeSource?.partCode !== placement.partCode) return false;
    if (trial.processCode && k.processCode !== trial.processCode) return false;
    return true;
  }) || null;
}

async function placementRows(r) {
  const plantOptions = (selected) => `<option value="">—</option>` + plants.map(p =>
    `<option value="${p.id}"${p.id === selected ? ' selected' : ''}>${esc(text(p.nameCommon))}</option>`).join('');

  return (await Promise.all((r.placements || []).map(async (pl, i) => {
    const match = matchCombination(pl, r);
    return `
      <div class="placement">
        <div class="placephoto">
          ${pl.photo
            ? `<img src="${pl.photo}" alt=""><button class="btn quiet" data-place-photo-del="${i}">×</button>`
            : `<label class="btn quiet" for="placephoto${i}">${t('trials.addPhoto')}</label>
               <input type="file" id="placephoto${i}" data-place-photo="${i}" accept="image/*" capture="environment" hidden>`}
        </div>

        <div class="placebody">
          <div class="placemain">
            <select data-place="${i}.plantId">${plantOptions(pl.plantId)}</select>
            <select data-place="${i}.partCode">${await options('plant_part', pl.partCode, t('trials.part'))}</select>
            <select data-place="${i}.condition">${await options('placement_condition', pl.condition, t('trials.condition'))}</select>
            <button class="btn quiet" data-place-del="${i}" aria-label="×">×</button>
          </div>

          ${isEcoPrint(r) ? `
            <div class="placemain">
              <select data-place="${i}.facing">${await options('facing', pl.facing, t('trials.facing'))}</select>
              <select data-place="${i}.printQuality">${await options('print_quality', pl.printQuality, t('trials.printQuality'))}</select>
              <input type="text" data-place="${i}.localTreatment" value="${esc(pl.localTreatment || '')}" placeholder="${t('trials.localPlaceholder')}">
            </div>` : ''}

          <input type="text" data-place="${i}.resultColour" value="${esc(pl.resultColour || '')}" placeholder="${t('trials.resultColour')}">
          <textarea data-place="${i}.observation" rows="2" placeholder="${t('trials.observationPlaceholder')}">${esc(pl.observation || '')}</textarea>

          ${pl.plantId ? (match
            ? `<p class="hint matched">${t('trials.matched')}: ${esc(text(match.expected?.colourText) || '—')}</p>`
            : `<p class="hint">${t('trials.noMatch')}</p>`) : ''}
        </div>
      </div>`;
  }))).join('') || `<p class="hint">${t('trials.photoFirst')}</p>`;
}

// ------------------------------------------------------------- read view
//
// A finished trial is read far more often than it is written, and what one
// wants from it is a story: these plants, on this cloth, through these steps,
// with this result. The editing form answers a different question.

async function renderRead(root, r) {
  const fabrics = await all('fabrics');
  const fabricNames = (r.fabricIds || [])
    .map(id => fabrics.find(f => f.id === id))
    .filter(Boolean).map(f => `${f.label ? f.label + ' · ' : ''}${f.name || '—'}`);

  const enh = (await Promise.all((r.enhancements || []).map(x => label('enhancement', x)))).join(', ');

  const photos = (r.resultPhotos || []).map(src =>
    `<div class="resultphoto"><img src="${src}" alt=""></div>`).join('');

  const placements = (await Promise.all((r.placements || []).map(async pl => {
    const plant = plantsById.get(pl.plantId);
    const bits = [
      pl.partCode ? await label('plant_part', pl.partCode) : '',
      pl.condition ? await label('placement_condition', pl.condition) : '',
      pl.facing ? await label('facing', pl.facing) : '',
      pl.printQuality ? await label('print_quality', pl.printQuality) : '',
      pl.localTreatment || '',
    ].filter(Boolean).join(' · ');
    const combo = pl.combinationId ? combinations.find(c => c.id === pl.combinationId) : null;
    return `
      <div class="placement" style="background:var(--surface)">
        ${pl.photo ? `<div class="placephoto"><img src="${pl.photo}" alt=""></div>` : ''}
        <div class="placebody">
          <b>${esc(text(plant?.nameCommon) || '—')}</b>
          ${bits ? `<div class="hint">${esc(bits)}</div>` : ''}
          ${pl.resultColour ? `<div class="factvalue">${esc(pl.resultColour)}</div>` : ''}
          ${pl.observation ? `<div class="prose"><p>${esc(pl.observation)}</p></div>` : ''}
          ${combo ? `<div class="hint matched">${t('trials.matched')}: ${esc(text(combo.expected?.colourText))}</div>` : ''}
        </div>
      </div>`;
  }))).join('');

  const stepCard = async (st, i) => {
    const recipe = st.recipeId ? recipes.find(x => x.id === st.recipeId) : null;
    const chain = st.chainId ? chains.find(x => x.id === st.chainId) : null;
    const m = st.mediumMod;
    const times = [
      st.tempC != null ? `${st.tempC} °C` : '',
      st.heldMinutes ? `${st.heldMinutes} ${t('common.min')}` : '',
      st.restMinutes ? `+ ${st.restMinutes} ${t('common.min')}` : '',
    ].filter(Boolean).join(' · ');
    const sub = substances.find(x => x.id === m?.materialId);
    return `
      <div class="planstep">
        <div class="chainhead">
          <span class="stepnum">${i + 1}</span>
          <b>${esc(await label('step_type', st.typeCode) || '—')}</b>
          ${chain || recipe ? `<span class="hint">${esc(text((chain || recipe).name))}</span>` : ''}
          <span class="spacer"></span>
          <span class="hint">${esc(times)}</span>
        </div>
        ${st.what ? `<div class="hint">${esc(st.what)}</div>` : ''}
        ${m ? `<div class="hint">${esc(await label('medium_where', m.whereCode))}: ${
          esc(text(sub?.name) || '—')} ${esc(m.amount || '')}${m.phMeasured ? ` · pH ${m.phMeasured}` : ''}${
          m.intent ? ` — ${esc(m.intent)}` : ''}</div>` : ''}
        ${st.note ? `<div class="hint">${esc(st.note)}</div>` : ''}
        ${(st.photos || []).length ? `<div class="stepphotos">${
          st.photos.map(src => `<div class="stepphoto"><img src="${src}" alt=""></div>`).join('')
        }</div>` : ''}
      </div>`;
  };

  // Read back the same way it was entered: stages in the order they happened,
  // a repeated stage shown as the two visits it was (§8.0b).
  const steps = (await Promise.all(stageRuns(r.steps).map(async (run) => `
    <div class="stagegroup">
      <div class="stagehead">
        <b>${esc(await label('trial_stage', run.code))}</b>
        ${run.items.some(({ st }) => st.techniqueId)
          ? `<span class="hint">${esc(run.items.map(({ st }) =>
              text(techniques.find(x => x.id === st.techniqueId)?.name)).filter(Boolean).join(' · '))}</span>`
          : ''}
      </div>
      ${(await Promise.all(run.items.map(({ st, i }) => stepCard(st, i)))).join('')}
    </div>`))).join('');

  const unfinished = statusOf(r) !== 'complete';

  root.innerHTML = page({
    title: r.title || t('trials.one'),
    sub: fmtDate(r.date),
    actions: `${await statusChip(r)}
              <button class="btn quiet" data-back>${t('common.back')}</button>
              <button class="btn primary" data-edit>${t('common.edit')}</button>`,
    body: `
      <div class="headline">
        ${photos ? `<div class="resultphotos big" style="flex:1;margin:0">${photos}</div>` : ''}
        <div class="headlinebody">
          ${/* A trial leads with the result — but a trial that has no result yet
                should say what it is for instead of showing an empty verdict. */''}
          <h2>${unfinished && !r.assessment
                ? esc(await label('trial_status', statusOf(r)))
                : esc(await label('assessment', r.assessment) || t('trials.headlineResult'))}</h2>
          ${r.intent ? `<div class="prose"><p>${esc(r.intent)}</p></div>` : ''}
          ${(r.planPhotos || []).length ? `<div class="stepphotos">${
            r.planPhotos.map(src => `<div class="stepphoto"><img src="${src}" alt=""></div>`).join('')
          }</div>` : ''}
          ${!r.intent && unfinished && !r.assessmentWhy ? `<p class="hint">${t('trials.plannedEmpty')}</p>` : ''}
          ${r.assessmentWhy ? `<div class="prose"><p>${esc(r.assessmentWhy)}</p></div>` : ''}
          ${facts([
            fact(t('trials.repeat'), esc(await label('repeat', r.repeat))),
            fact(t('trials.nextTime'), esc(r.nextTime || '')),
          ])}
        </div>
      </div>

      ${panel(facts([
        fact(t('trials.process'), esc(await label('process', r.processCode))),
        fact(t('trials.enhancements'), esc(enh)),
        fact(t('trials.fabrics'), esc(fabricNames.join(', '))),
        fact(t('trials.weightOfGoods'), r.weightOfGoodsG ? `${r.weightOfGoodsG} г` : ''),
        fact(t('trials.water'), esc([await label('water_source', r.water?.sourceCode), r.water?.note].filter(Boolean).join(' · '))),
      ]))}

      <div class="gap"></div>

      <div class="cols">
        <div class="col">
          ${readBlock(t('trials.placements'), placements)}
        </div>
        <div class="col">
          ${readBlock(t('trials.steps'), steps)}
          ${readBlock(t('common.notes'), r.notes ? `<div class="prose"><p>${esc(r.notes)}</p></div>` : '')}
        </div>
      </div>`,
  });
}

// ---------------------------------------------------------------- the form

async function renderForm(root, r) {
  const isNew = openId === 'new';
  const fabrics = await all('fabrics');

  const enh = (await Promise.all(ENHANCEMENTS.map(async c => `
    <label class="check"><input type="checkbox" data-multi="enhancements" value="${c}"
      ${(r.enhancements || []).includes(c) ? 'checked' : ''}>
      ${esc(await label('enhancement', c))}</label>`))).join('');

  const fabricChecks = fabrics.map(f => `
    <label class="check"><input type="checkbox" data-multi="fabricIds" value="${f.id}"
      ${(r.fabricIds || []).includes(f.id) ? 'checked' : ''}>
      ${esc(f.label ? f.label + ' · ' : '')}${esc(f.name || '—')}</label>`).join('')
    || `<p class="hint">—</p>`;

  const techChecks = techniques.map(x => `
    <label class="check"><input type="checkbox" data-multi="techniqueIds" value="${x.id}"
      ${(r.techniqueIds || []).includes(x.id) ? 'checked' : ''}>
      ${esc(text(x.name))}</label>`).join('') || `<p class="hint">—</p>`;

  const photos = (r.resultPhotos || []).map((src, i) => `
    <div class="resultphoto"><img src="${src}" alt="">
      <button class="btn quiet" data-photo-del="${i}">×</button></div>`).join('');

  root.innerHTML = page({
    title: isNew ? t('trials.new') : (r.title || t('trials.one')),
    sub: isNew ? t('trials.emptyHint') : fmtDate(r.date),
    actions: `<button class="btn quiet" data-back>${t('common.back')}</button>
              <button class="btn primary" data-save>${t('common.save')}</button>`,
    body: `
      <div class="cols">
        <div class="col">
          ${panel(`
            <h2>${t('trials.about')}</h2>
            ${field(t('trials.title2'), `<input type="text" data-f="title" value="${esc(r.title || '')}" placeholder="${t('trials.titlePlaceholder')}">`)}
            ${field(t('trials.date'), `<input type="date" data-f="date" value="${esc(r.date || '')}">`)}
            ${field(t('trials.status'),
              await segmented('trial_status', 'status', statusOf(r), { allowEmpty: false }),
              t('trials.statusHint'))}
            ${field(t('trials.intent'),
              `<textarea data-f="intent" rows="2" placeholder="${t('trials.intentPlaceholder')}">${esc(r.intent || '')}</textarea>`,
              t('trials.intentHint'))}
            ${field(t('trials.planPhotos'),
              photoStrip(r.planPhotos, {
                addId: 'planphoto',
                addAttr: 'data-plan-photo',
                delAttr: 'data-plan-photo-del',
              }),
              t('trials.planPhotosHint'))}
            ${field(t('trials.process'), `<select data-f="processCode">${await options('process', r.processCode, '')}</select>`)}
            ${r.processCode === 'paste' ? note(t('trials.pasteNotYet'), 'warn') : ''}
          `)}

          ${foldable(t('trials.enhancements'), `<div class="checks">${enh}</div><p class="hint">${t('trials.enhancementsHint')}</p>`,
            { badge: (r.enhancements || []).length ? t('plants.filled', { n: (r.enhancements || []).length }) : '' })}

          ${panel(`
          `)}

          ${foldable(t('trials.fabrics'), `
            <div class="checks column">${fabricChecks}</div>
            ${field(t('trials.weightOfGoods'), `<input type="number" step="1" min="0" data-f="weightOfGoodsG" value="${r.weightOfGoodsG ?? ''}">`, t('trials.weightHint'))}
          `, { open: !!isNew, badge: (r.fabricIds || []).length ? t('plants.filled', { n: (r.fabricIds || []).length }) : '' })}

          ${foldable(t('trials.water'), `
            ${field(t('trials.waterSource'), `<select data-f="water.sourceCode">${await options('water_source', r.water?.sourceCode)}</select>`)}
            ${field(t('trials.waterNote'), `<input type="text" data-f="water.note" value="${esc(r.water?.note || '')}" placeholder="${t('trials.waterPlaceholder')}">`)}
            <p class="hint">${t('trials.waterHint')}</p>
          `, { badge: r.water?.sourceCode ? esc(await label('water_source', r.water.sourceCode)) : '' })}

          ${foldable(t('trials.techniques'), `<div class="checks">${techChecks}</div>`,
            { badge: (r.techniqueIds || []).length ? t('plants.filled', { n: (r.techniqueIds || []).length }) : '' })}
        </div>

        <div class="col">
          ${panel(`
            <h2>${t('trials.placements')}</h2>
            <p class="note">${t('trials.placementsHint')} ${t('trials.photoFirst')}</p>
            <div class="placelist">${await placementRows(r)}</div>
            <button class="btn quiet" data-place-add>${t('trials.addPlacement')}</button>
          `)}

          ${panel(`
            <h2>${t('trials.steps')}</h2>
            <p class="note">${t('trials.stagesHint')}</p>
            <p class="note">${t('trials.stepsHint')} ${t('trials.mediumHint')}</p>
            ${await stageGroups(r)}
          `)}

          ${panel(`
            <h2>${t('trials.pieceResult')}</h2>
            <div class="resultphotos">${photos}</div>
            <div class="btnrow">
              <label class="btn quiet" for="resultphoto">${t('trials.addPhoto')}</label>
              <input type="file" id="resultphoto" accept="image/*" multiple hidden>
            </div>
            ${field(t('trials.assessment'), `<select data-f="assessment">${await options('assessment', r.assessment)}</select>`, t('trials.pieceResultHint'))}
            ${field(t('trials.assessmentWhy'), `<textarea data-f="assessmentWhy" rows="3">${esc(r.assessmentWhy || '')}</textarea>`)}
            ${field(t('trials.repeat'), `<select data-f="repeat">${await options('repeat', r.repeat)}</select>`)}
            ${r.repeat === 'changes' || r.nextTime
              ? field(t('trials.nextTime'), `<textarea data-f="nextTime" rows="2" placeholder="${t('trials.nextTimePlaceholder')}">${esc(r.nextTime || '')}</textarea>`)
              : ''}
            ${field(t('trials.notes'), `<textarea data-f="notes" rows="3">${esc(r.notes || '')}</textarea>`)}
            ${!isNew ? `<button class="btn danger quiet" data-delete>${t('trials.delete')}</button>` : ''}
          `)}
        </div>
      </div>`,
  });
}

// ----------------------------------------------------------------- reading

function readForm(root) {
  for (const el of root.querySelectorAll('[data-f]')) {
    // A radio group renders one element per option, all carrying the same
    // `data-f`. Reading them all meant the LAST option always won, whichever
    // was actually chosen — segmented controls have been silently wrong.
    if (el.type === 'radio' && !el.checked) continue;
    const path = el.dataset.f.split('.');
    let target = draft;
    for (let i = 0; i < path.length - 1; i++) {
      target[path[i]] = target[path[i]] || {};
      target = target[path[i]];
    }
    let value = el.value;
    if (el.type === 'number') value = value === '' ? null : Number(value);
    target[path[path.length - 1]] = value;
  }

  for (const name of ['enhancements', 'fabricIds', 'techniqueIds']) {
    draft[name] = [];
    for (const el of root.querySelectorAll(`[data-multi="${name}"]`)) {
      if (el.checked) draft[name].push(el.value);
    }
  }

  const readList = (attr, existing, extra = {}) => {
    const out = [];
    for (const el of root.querySelectorAll(`[data-${attr}]`)) {
      const [i, key] = el.dataset[attr].split('.');
      const idx = Number(i);
      out[idx] = out[idx] || { id: existing?.[idx]?.id || uid(), ...extra, ...(existing?.[idx] || {}) };
      let value = el.value;
      if (el.type === 'number') value = value === '' ? null : Number(value);
      out[idx][key] = value;
    }
    return out.filter(Boolean);
  };

  draft.placements = readList('place', draft.placements);

  const steps = readList('step', draft.steps);
  for (const st of steps) {
    if (st.source === undefined) continue;
    st.chainId = st.source.startsWith('c:') ? st.source.slice(2) : '';
    st.recipeId = st.source.startsWith('r:') ? st.source.slice(2) : '';
    delete st.source;
  }
  for (const el of root.querySelectorAll('[data-medium]')) {
    const [i, key] = el.dataset.medium.split('.');
    const idx = Number(i);
    if (!steps[idx]) continue;
    steps[idx].mediumMod = steps[idx].mediumMod || {};
    let value = el.value;
    if (el.type === 'number') value = value === '' ? null : Number(value);
    steps[idx].mediumMod[key] = value;
  }
  draft.steps = steps;

  // Resolving the reference link at save time keeps it honest: it reflects
  // what the trial says now, not what it said when the placement was added.
  for (const pl of draft.placements) {
    pl.combinationId = matchCombination(pl, draft)?.id || null;
  }
}

// ------------------------------------------------------------------ module

export default {
  id: 'trials',
  title: () => t('trials.title'),
  sub: () => t('trials.sub'),

  reset() { openId = null; draft = null; editing = false; view = 'gallery';
            filter = { plantId: '', processCode: '', status: '' }; },

  // Opened by the router when the address names a record (§8.0c). Straight
  // into the form, because the cloth said "continue", not "show me".
  open(arg, fromFabricId = null) {
    openId = arg;
    editing = true;
    draft = null;
    handoff = arg === 'new' ? fromFabricId : null;
  },

  async render(root) {
    plants = (await all('plants')).sort((a, b) => text(a.nameCommon).localeCompare(text(b.nameCommon)));
    plantsById = new Map(plants.map(p => [p.id, p]));
    recipes = await all('recipes');
    techniques = await all('techniques');
    chains = await all('chains');
    substances = await all('substances');
    combinations = await all('combinations');

    if (openId) {
      if (!draft || (openId !== 'new' && draft.id !== openId)) {
        const found = openId === 'new' ? blank() : await get('trials', openId);
        // A link to a record that has since been deleted, or a mistyped
        // address. Falling back to the gallery is the whole recovery: a blank
        // screen with nothing on it is the worst outcome this app has.
        if (!found) { openId = null; editing = false; draft = null; return this.render(root); }
        draft = structuredClone(found);
        if (openId === 'new' && handoff) {
          const cloth = await get('fabrics', handoff);
          if (cloth) {
            draft.fabricIds = [cloth.id];
            draft.title = cloth.name || cloth.label || '';
            if (cloth.weightG) draft.weightOfGoodsG = cloth.weightG;
            draft.status = 'in_progress';  // the cloth is in hand; this is not a daydream
          }
          handoff = null;
        }
      }
      if (editing || openId === 'new') await renderForm(root, draft);
      else await renderRead(root, draft);
    } else {
      draft = null;
      await renderList(root);
    }

    const redraw = () => renderForm(root, draft);

    root.onclick = async (e) => {
      if (e.target.closest('label')) return;   // let file pickers open

      const v = e.target.closest('[data-view]');
      if (v) { view = v.dataset.view; return this.render(root); }
      if (e.target.closest('[data-new]')) { draft = null; openId = 'new'; editing = true; return this.render(root); }
      if (e.target.closest('[data-edit]')) { editing = true; return this.render(root); }
      const row = e.target.closest('[data-open]');
      if (row) { draft = null; openId = row.dataset.open; editing = false; return this.render(root); }
      if (e.target.closest('[data-back]')) {
        if (editing && openId !== 'new') { editing = false; return this.render(root); }
        openId = null; draft = null; editing = false;
        return this.render(root);
      }

      if (e.target.closest('[data-place-add]')) {
        readForm(root);
        draft.placements.push({ id: uid(), plantId: '', partCode: '', condition: 'fresh',
                                facing: '', printQuality: null, localTreatment: '',
                                resultColour: '', observation: '', photo: null, combinationId: null });
        return redraw();
      }
      const pdel = e.target.closest('[data-place-del]');
      if (pdel) { readForm(root); draft.placements.splice(Number(pdel.dataset.placeDel), 1); return redraw(); }
      const ppdel = e.target.closest('[data-place-photo-del]');
      if (ppdel) { readForm(root); draft.placements[Number(ppdel.dataset.placePhotoDel)].photo = null; return redraw(); }

      // Leaving to write a recipe must not cost the trial. It is saved first,
      // and where to come back to is remembered, so the detour is a detour and
      // not a decision between recording the work and recording the method.
      const nr = e.target.closest('[data-newrecipe]');
      if (nr) {
        readForm(root);
        await put('trials', draft);
        await setSetting('returnTo', { module: 'trials', id: draft.id, label: draft.title || t('trials.one') });
        openId = null; draft = null;
        location.hash = '#/recipes';
        return;
      }

      const addStep = e.target.closest('[data-step-add]');
      if (addStep) {
        readForm(root);
        const fresh = { id: uid(), typeCode: '', stageCode: addStep.dataset.stepAdd || 'prep',
                        techniqueId: '', recipeId: '', chainId: '', roleCode: '', what: '',
                        tempC: null, heldMinutes: null, restMinutes: null, mediumMod: null,
                        photos: [], note: '' };
        // Inserted at the end of the run it was added from, not at the end of
        // the trial — otherwise adding a second mordanting step would land it
        // after the drying, and the order of the steps IS the order of the work.
        const after = addStep.dataset.after;
        if (after === undefined) draft.steps.push(fresh);
        else draft.steps.splice(Number(after) + 1, 0, fresh);
        draft.steps.forEach((st, n) => { st.order = n; });
        return redraw();
      }
      const sdel = e.target.closest('[data-step-del]');
      if (sdel) {
        readForm(root);
        draft.steps.splice(Number(sdel.dataset.stepDel), 1);
        draft.steps.forEach((st, n) => { st.order = n; });
        return redraw();
      }

      const madd = e.target.closest('[data-medium-add]');
      if (madd) {
        readForm(root);
        draft.steps[Number(madd.dataset.mediumAdd)].mediumMod =
          { whereCode: '', materialId: '', amount: '', phMeasured: null, intent: '' };
        return redraw();
      }
      const mdel = e.target.closest('[data-medium-del]');
      if (mdel) { readForm(root); draft.steps[Number(mdel.dataset.mediumDel)].mediumMod = null; return redraw(); }

      const spdel = e.target.closest('[data-step-photo-del]');
      if (spdel) {
        readForm(root);
        const [i, j] = spdel.dataset.stepPhotoDel.split('.').map(Number);
        draft.steps[i].photos.splice(j, 1);
        return redraw();
      }

      const ppldel = e.target.closest('[data-plan-photo-del]');
      if (ppldel) {
        readForm(root);
        draft.planPhotos.splice(Number(ppldel.dataset.planPhotoDel), 1);
        return redraw();
      }

      const phdel = e.target.closest('[data-photo-del]');
      if (phdel) { readForm(root); draft.resultPhotos.splice(Number(phdel.dataset.photoDel), 1); return redraw(); }

      if (e.target.closest('[data-save]')) {
        readForm(root);
        if (!draft.status) draft.status = 'planned';
        // A verdict on a record still marked as an intention is a contradiction,
        // and almost always means the status was simply not touched. Offered,
        // never applied silently — the app does not decide the work is over.
        if (draft.assessment && draft.status !== 'complete'
            && confirm(t('trials.markComplete'))) draft.status = 'complete';
        await put('trials', draft);
        openId = draft.id;
        editing = false;
        return this.render(root);
      }
      if (e.target.closest('[data-delete]')) {
        if (!confirm(t('trials.confirmDelete'))) return;
        await remove('trials', draft.id);
        openId = null; draft = null;
        return this.render(root);
      }
    };

    root.onchange = async (e) => {
      if (e.target.dataset.filter) {
        filter[e.target.dataset.filter] = e.target.value;
        return this.render(root);
      }

      // Photo-first is the real order of work: open the bundle, photograph it,
      // then say what it was. Delegated so a redraw never orphans the handler.
      if (e.target.dataset.placePhoto !== undefined && e.target.files?.[0]) {
        readForm(root);
        draft.placements[Number(e.target.dataset.placePhoto)].photo = await shrinkThumb(e.target.files[0]);
        return redraw();
      }
      // A photograph on a step, at any stage of the work — not only the
      // placement and the result. The middle of the process is where the
      // fabric's story used to have a hole in it (§8.0a).
      if (e.target.dataset.stepPhoto !== undefined && e.target.files?.length) {
        readForm(root);
        const i = Number(e.target.dataset.stepPhoto);
        draft.steps[i].photos = draft.steps[i].photos || [];
        for (const file of e.target.files) draft.steps[i].photos.push(await shrinkStep(file));
        return redraw();
      }

      if (e.target.dataset.planPhoto !== undefined && e.target.files?.length) {
        readForm(root);
        draft.planPhotos = draft.planPhotos || [];
        // Result size, not step size: a plan is usually a diagram with writing.
        for (const file of e.target.files) draft.planPhotos.push(await shrinkResult(file));
        return redraw();
      }

      if (e.target.id === 'resultphoto' && e.target.files?.length) {
        readForm(root);
        for (const file of e.target.files) draft.resultPhotos.push(await shrinkResult(file));
        return redraw();
      }

      // Switching process changes which fields apply, so the form is redrawn.
      if (e.target.matches('[data-f="processCode"]') || e.target.matches('[data-f="repeat"]')
          || e.target.matches('[data-f="status"]')
          // A stage change regroups the steps; a type change can reveal the
          // layer row. Both need the form drawn again.
          || /\.(stageCode|typeCode)$/.test(e.target.dataset.step || '')) {
        readForm(root); return redraw();
      }
      if ((e.target.dataset.step || '').endsWith('.typeCode')) { readForm(root); return redraw(); }
    };
  },
};

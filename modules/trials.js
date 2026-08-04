// modules/trials.js — one real piece of work (§8).
//
// The largest screen, built last because it composes records from every other
// module. Its substance lives in two nested lists: steps, which carry what was
// actually done and for how long, and placements, which attribute a result to
// one plant rather than to a whole bundle.

import { all, get, put, remove, newRecord, uid } from '../db.js';
import { t, text } from '../i18n.js';
import { page, panel, field, options, label, esc, empty, note, fmtDate, today } from '../ui.js';
import { shrinkResult, shrinkThumb } from '../photo.js';

const ENHANCEMENTS = ['cloth_mordant', 'botanical_mordant', 'predye_substantive',
                      'blanket_substantive', 'predye_adjective', 'blanket_adjective', 'ph_modifier'];
const LAYER_ROLES = ['printing_cloth', 'receiving_cloth', 'carrier_blanket', 'barrier'];

let view = 'gallery';
let openId = null;
let draft = null;
let filter = { plantId: '', processCode: '' };

// Loaded once per render so the nested lists can name what they point at.
let plants = [], plantsById = new Map(), recipes = [], substances = [], combinations = [];

function blank() {
  return newRecord({
    date: today(),
    title: '',
    processCode: 'ecoprint',
    enhancements: [],
    fabricIds: [],
    weightOfGoodsG: null,
    techniqueIds: [],
    water: { sourceCode: '', note: '' },
    layers: [],
    steps: [],
    placements: [],
    assessment: '',
    assessmentWhy: '',
    resultPhotos: [],
    notes: '',
  });
}

const isEcoPrint = (r) => (r.processCode || '').startsWith('ecoprint');

// ---------------------------------------------------------------- gallery

async function renderList(root) {
  const trials = (await all('trials'))
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const shown = trials.filter(tr =>
    (!filter.plantId || (tr.placements || []).some(p => p.plantId === filter.plantId)) &&
    (!filter.processCode || tr.processCode === filter.processCode));

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
      </div>` : ''}
      ${view === 'list' && shown.length ? panel(body, 'flush') : body}`,
  });
}

// ------------------------------------------------------------------- steps

async function stepRows(r) {
  return (await Promise.all((r.steps || []).map(async (st, i) => {
    const recipeOptions = `<option value="">${t('trials.improvised')}</option>` + recipes.map(x =>
      `<option value="${x.id}"${x.id === st.recipeId ? ' selected' : ''}>${esc(text(x.name))}</option>`).join('');

    const m = st.mediumMod;
    const substanceOptions = `<option value="">—</option>` + substances.map(x =>
      `<option value="${x.id}"${x.id === m?.materialId ? ' selected' : ''}>${esc(text(x.name))}</option>`).join('');

    return `
      <div class="ingrow">
        <div class="chainhead">
          <span class="stepnum">${i + 1}</span>
          <select data-step="${i}.typeCode">${await options('step_type', st.typeCode, t('trials.stepType'))}</select>
          <select data-step="${i}.recipeId">${recipeOptions}</select>
          <span class="spacer"></span>
          <button class="btn quiet" data-step-del="${i}" aria-label="×">×</button>
        </div>

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
      </div>`;
  }))).join('') || `<p class="hint">—</p>`;
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

// ---------------------------------------------------------------- the form

async function renderForm(root, r) {
  const isNew = openId === 'new';
  const fabrics = await all('fabrics');
  const techniques = await all('techniques');

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

  const layerRows = (await Promise.all((r.layers || []).map(async (ly, i) => `
    <div class="mediumrow">
      <select data-layer="${i}.roleCode">${await options('bundle_role', ly.roleCode, t('trials.layerRole'))}</select>
      <input type="text" data-layer="${i}.note" value="${esc(ly.note || '')}" placeholder="${t('trials.layerWhat')}">
      <button class="btn quiet" data-layer-del="${i}" aria-label="×">×</button>
    </div>`))).join('') || `<p class="hint">—</p>`;

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
            ${field(t('trials.process'), `<select data-f="processCode">${await options('process', r.processCode, '')}</select>`)}
            ${field(t('trials.enhancements'), `<div class="checks">${enh}</div>`, t('trials.enhancementsHint'))}
          `)}

          ${panel(`
            <h2>${t('trials.fabrics')}</h2>
            <div class="checks column">${fabricChecks}</div>
            ${field(t('trials.weightOfGoods'), `<input type="number" step="1" min="0" data-f="weightOfGoodsG" value="${r.weightOfGoodsG ?? ''}">`, t('trials.weightHint'))}
            ${field(t('trials.waterSource'), `<select data-f="water.sourceCode">${await options('water_source', r.water?.sourceCode)}</select>`)}
            ${field(t('trials.waterNote'), `<input type="text" data-f="water.note" value="${esc(r.water?.note || '')}">`)}
          `)}

          ${isEcoPrint(r) ? panel(`
            <h2>${t('trials.layers')}</h2>
            <p class="note">${t('trials.layersHint')}</p>
            ${layerRows}
            <button class="btn quiet" data-layer-add>${t('trials.addLayer')}</button>
          `) : ''}

          ${panel(`
            <h2>${t('trials.techniques')}</h2>
            <div class="checks">${techChecks}</div>
          `)}
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
            <p class="note">${t('trials.stepsHint')} ${t('trials.mediumHint')}</p>
            ${await stepRows(r)}
            <button class="btn quiet" data-step-add>${t('trials.addStep')}</button>
          `)}

          ${panel(`
            <h2>${t('trials.result')}</h2>
            <div class="resultphotos">${photos}</div>
            <div class="btnrow">
              <label class="btn quiet" for="resultphoto">${t('trials.addPhoto')}</label>
              <input type="file" id="resultphoto" accept="image/*" multiple hidden>
            </div>
            ${field(t('trials.assessment'), `<select data-f="assessment">${await options('assessment', r.assessment)}</select>`)}
            ${field(t('trials.assessmentWhy'), `<textarea data-f="assessmentWhy" rows="3">${esc(r.assessmentWhy || '')}</textarea>`)}
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

  draft.layers = readList('layer', draft.layers);
  draft.placements = readList('place', draft.placements);

  const steps = readList('step', draft.steps);
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

  reset() { openId = null; draft = null; view = 'gallery'; filter = { plantId: '', processCode: '' }; },

  async render(root) {
    plants = (await all('plants')).sort((a, b) => text(a.nameCommon).localeCompare(text(b.nameCommon)));
    plantsById = new Map(plants.map(p => [p.id, p]));
    recipes = await all('recipes');
    substances = await all('substances');
    combinations = await all('combinations');

    if (openId) {
      if (!draft || (openId !== 'new' && draft.id !== openId)) {
        draft = openId === 'new' ? blank() : structuredClone(await get('trials', openId));
      }
      await renderForm(root, draft);
    } else {
      draft = null;
      await renderList(root);
    }

    const redraw = () => renderForm(root, draft);

    root.onclick = async (e) => {
      if (e.target.closest('label')) return;   // let file pickers open

      const v = e.target.closest('[data-view]');
      if (v) { view = v.dataset.view; return this.render(root); }
      if (e.target.closest('[data-new]')) { draft = null; openId = 'new'; return this.render(root); }
      const row = e.target.closest('[data-open]');
      if (row) { draft = null; openId = row.dataset.open; return this.render(root); }
      if (e.target.closest('[data-back]')) { openId = null; draft = null; return this.render(root); }

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

      if (e.target.closest('[data-step-add]')) {
        readForm(root);
        draft.steps.push({ id: uid(), order: draft.steps.length, typeCode: '', recipeId: '',
                           tempC: null, heldMinutes: null, restMinutes: null, mediumMod: null, note: '' });
        return redraw();
      }
      const sdel = e.target.closest('[data-step-del]');
      if (sdel) { readForm(root); draft.steps.splice(Number(sdel.dataset.stepDel), 1); return redraw(); }

      const madd = e.target.closest('[data-medium-add]');
      if (madd) {
        readForm(root);
        draft.steps[Number(madd.dataset.mediumAdd)].mediumMod =
          { whereCode: '', materialId: '', amount: '', phMeasured: null, intent: '' };
        return redraw();
      }
      const mdel = e.target.closest('[data-medium-del]');
      if (mdel) { readForm(root); draft.steps[Number(mdel.dataset.mediumDel)].mediumMod = null; return redraw(); }

      if (e.target.closest('[data-layer-add]')) {
        readForm(root);
        draft.layers.push({ id: uid(), roleCode: '', note: '' });
        return redraw();
      }
      const ldel = e.target.closest('[data-layer-del]');
      if (ldel) { readForm(root); draft.layers.splice(Number(ldel.dataset.layerDel), 1); return redraw(); }

      const phdel = e.target.closest('[data-photo-del]');
      if (phdel) { readForm(root); draft.resultPhotos.splice(Number(phdel.dataset.photoDel), 1); return redraw(); }

      if (e.target.closest('[data-save]')) {
        readForm(root);
        await put('trials', draft);
        openId = null; draft = null;
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
      if (e.target.id === 'resultphoto' && e.target.files?.length) {
        readForm(root);
        for (const file of e.target.files) draft.resultPhotos.push(await shrinkResult(file));
        return redraw();
      }

      // Switching process changes which fields apply, so the form is redrawn.
      if (e.target.matches('[data-f="processCode"]')) { readForm(root); return redraw(); }
    };
  },
};

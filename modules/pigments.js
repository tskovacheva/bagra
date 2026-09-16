// modules/pigments.js — making a pigment, which is work on a SUBSTANCE (§13bx).
//
// A trial is work on CLOTH: it has pieces, each with its own placement and its
// own outcome. A batch has one output — one quantity, one quality, one colour.
// Same skeleton, different subject, and deliberately not forced into one
// another; the owner asked for them kept visually apart, and the making is long
// and infrequent enough that interleaving it with dye trials would bury it.
//
// THE LIST ANSWERS "WHAT HAVE I MADE", NOT "WHAT DO I HAVE". No remainder is
// tracked, by the owner's own call: a hand-kept remainder goes wrong within
// weeks and then lies confidently. The screen says so in words rather than
// leaving it to be discovered — an unlabelled column of grams read a year later
// looks exactly like stock on hand.
//
// Layout follows the v0 prototype; the code does not. That prototype is React
// and Tailwind, this is vanilla ES modules with no build step, so the
// arrangement was read and rebuilt rather than pasted.

import { all, get, put, remove, newRecord, uid } from '../db.js';
import { departureOf, linesFromRecipe } from '../recipe-lines.js';
import { t, text, getLang } from '../i18n.js';
import { markClean } from '../dirty.js';
import { scaleRecipe } from '../calc/scale.js';
import { page, panel, field, esc, empty, pairField, readPairs, navigate,
         backTo, actionBtn, label, today } from '../ui.js';

// The order the work goes in. Six words, and the words stay — the same reason
// the trial stages are not renumbered (§13.8).
const STAGES = ['extraction', 'laking', 'washing', 'filtering', 'drying', 'grinding'];
const STATUSES = ['planned', 'done', 'failed'];
const QUALITIES = ['good', 'acceptable', 'poor'];
// The closed list, and its being closed is argued in vocab.js beside the terms.
const SWATCH_KINDS = ['dye', 'pigment', 'watercolour', 'pastel', 'ink', 'glaze'];

let openId = null;
let draft = null;

function blank() {
  return newRecord({
    status: 'planned',
    date: today(),
    // Null until it has finished. A batch runs over days — three hours of
    // simmering, a night settling, days drying — so one date cannot hold it.
    // The same pair a trial carries (§13au).
    finishedOn: null,
    plantId: '',
    partCode: '',
    rawWeightG: null,
    // A recipe OR a chain, never both. `viaKind` says which, so an empty id
    // never has to be interpreted.
    viaKind: 'recipe',
    viaId: '',
    stages: STAGES.map(code => ({ id: uid(), code, note: { bg: '', en: '' }, date: '', photos: [] })),
    // WHAT WAS ACTUALLY PUT IN (§13dr).
    //
    // A recipe is what to do; this is what was done. Empty until a recipe is
    // taken from, and taken ONCE — never re-taken over the top of work already
    // entered, because an evening at the pot is not something a dropdown gets
    // to overwrite.
    //
    // Every line remembers what the recipe said AT THE TIME, in `was`. The
    // departure is measured against that and not against the recipe as it
    // stands today: a pack update next year must not quietly rewrite what last
    // summer's batch departed from.
    lines: [],
    // Which recipe the lines came from, its name copied rather than only
    // referenced, and when. The name is copied because the departure has to
    // stay readable if the recipe is later renamed or withdrawn.
    linesFrom: null,
    yieldG: null,
    quality: '',
    // WHAT CAME OUT, IN THE PLURAL (§13ds).
    //
    // One batch of madder becomes powder, and watercolour, and pastel, and each
    // is a different colour. A single `swatchHex` could hold one of the three
    // and made the other two things that cannot be said.
    //
    // Each swatch may name a recipe OF ITS OWN: the pigment came from this
    // batch's recipe, but the watercolour made from it came from the
    // watercolour recipe, and the pastel from the pastel one.
    //
    // `hex` is optional on purpose. A colour described in words has no hex
    // (§13dl), and a swatch with a name and no measurement is a finished
    // record, not an unfinished one.
    swatches: [],
    // Kept, not read. The migration copies these into the list and the
    // application writes only `swatches` from here on; the old pair stays the
    // way back if the mapping proves wrong, and comes out in a later version
    // on purpose rather than by drift — as `stateEvents` did at §13bd.
    swatchHex: '',
    swatchName: { bg: '', en: '' },
    photos: [],
    notes: { bg: '', en: '' },
  });
}

// ---- list -----------------------------------------------------------------

async function renderList(root) {
  const batches = await all('pigmentBatches');
  const plants = new Map((await all('plants')).map(p => [p.id, p]));

  // Grouped by source — plant × part — with the batches nested, because two
  // makings of madder are two batches of one thing, not two unrelated rows.
  // Derived here, never stored (§13.6).
  const groups = new Map();
  for (const b of batches) {
    const key = `${b.plantId}|${b.partCode}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(b);
  }

  const cards = [];
  for (const [key, list] of groups) {
    const [plantId, partCode] = key.split('|');
    const plant = plants.get(plantId);
    const name = plant ? text(plant.nameCommon) : t('pigments.unknownPlant');
    const part = partCode ? await label('plant_part', partCode) : '';

    // Newest first inside a group.
    list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    // The group's swatch is its most recent successful batch. A failed batch
    // has no colour to show and must not lend the group a blank one.
    // The card shows the most recent successful batch's swatch. Read off the
    // LIST now (§13ds); the legacy pair is migrated into it, so reading both
    // would be two answers to one question.
    const swatchOf = (x) => (x.swatches || []).find(w => w.hex) || null;
    const shown = list.map(x => ({ b: x, w: swatchOf(x) }))
      .find(({ b: x, w }) => x.status !== 'failed' && w)?.w || null;

    const rows = list.map(b => {
      const failed = b.status === 'failed';
      return `
        <tr data-open="${b.id}">
          <td>${failed ? `<span class="tag">${t('pigments.status.failed')}</span> ` : ''}${
            swatchOf(b) && !failed
              ? `<span class="swatch sm" style="background:${esc(swatchOf(b).hex)}"></span> `
              : ''}${esc(text((b.swatches || [])[0]?.name) || '—')}</td>
          <td>${b.yieldG != null && !failed ? `${b.yieldG} g` : '—'}</td>
          <td>${b.quality && !failed ? esc(t('pigments.quality.' + b.quality)) : '—'}</td>
          <td>${esc(b.date || '')}</td>
        </tr>`;
    }).join('');

    cards.push(panel(`
      <h2>${esc(name)}${part ? ` <span class="hint">${esc(part)}</span>` : ''}</h2>
      ${shown ? `<div class="swatchline">
        <span class="swatch" style="background:${esc(shown.hex)}"></span>
        <span>${esc(text(shown.name))}</span></div>` : ''}
      <table class="grid">
        <thead><tr>
          <th>${t('pigments.batch')}</th>
          <th>${t('pigments.yield')}</th>
          <th>${t('pigments.qualityLabel')}</th>
          <th>${t('common.date')}</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>`));
  }

  root.innerHTML = page({
    title: t('pigments.title'),
    sub: t('pigments.sub'),
    actions: actionBtn('add', t('pigments.new'), 'data-new', 'primary'),
    body: batches.length
      ? `${panel(`<p class="note">${t('pigments.noStockNote')}</p>`)}
         <div style="height:16px"></div>
         ${cards.join('<div style="height:16px"></div>')}`
      : empty(t('pigments.empty'), t('pigments.emptyHint')),
  });
}

// ---- what was actually put in ---------------------------------------------
//
// `departureOf` and `linesFromRecipe` moved to `recipe-lines.js` at §13ee, so a
// paste print can ask the same question of the same code.

// May the recipe's lines be taken? A function rather than a condition written
// twice, because it is checked where the button is DRAWN and again where it is
// clicked, and those two drifting apart is how a disabled control turns out to
// be clickable. Exported so the guard can ask the same question the screen asks
// instead of searching the source for a string it half remembers (§13cz).
export function canTakeLines(batch, recipe) {
  if (!recipe) return false;
  if (batch.viaKind !== 'recipe') return false;
  // The one that matters: an evening's entries are not replaced by one click.
  if ((batch.lines || []).length) return false;
  return true;
}

// ---- one batch ------------------------------------------------------------

async function renderBatch(root, b, plants, recipes, chains, recipesAll = recipes) {
  const plant = plants.find(p => p.id === b.plantId);
  const parts = (plant?.parts || []).map(x => x.partCode);
  const via = b.viaKind === 'chain'
    ? chains.find(c => c.id === b.viaId)
    : recipes.find(r => r.id === b.viaId);

  const stages = (await Promise.all(b.stages.map(async (s, i) => panel(`
    <div class="stagehead"><span class="stepno">${i + 1}</span>
      <h3>${esc(t('pigments.stage.' + s.code))}</h3></div>
    ${field(t('common.notes'), `<textarea data-s="${i}.note" rows="2">${esc(text(s.note))}</textarea>`)}
    ${field(t('common.date'), `<input type="date" data-s="${i}.date" value="${esc(s.date || '')}">`)}
  `)))).join('<div style="height:12px"></div>');

  // A failed batch keeps its stages and its note and shows no result. That is
  // the point of recording it: where it got to is the most useful thing there
  // is for the next attempt. Showing an empty result panel instead would read
  // as unfinished rather than as instructive.
  const failed = b.status === 'failed';
  const choices = b.viaKind === 'chain' ? chains : recipes;
  const partOptions = (await Promise.all(parts.map(async pc =>
    `<option value="${pc}"${b.partCode === pc ? ' selected' : ''}>${
      esc(await label('plant_part', pc))}</option>`))).join('');

  const partName = b.partCode ? await label('plant_part', b.partCode) : '';
  const heading = plant
    ? `${text(plant.nameCommon)}${partName ? ' — ' + partName : ''}`
    : t('pigments.new');

  // Layout from the v0 prototype rather than from habit. The prototype put the
  // batch's context — dates, what it was made by — down the side and left the
  // wide column for the work itself, and it reads better than the two equal
  // columns every other screen here uses: the stages are what is looked at
  // while working, and the rest is answered once and then referred to.
  //
  // The context sections fold. `contextstrip` already does this for a trial
  // (§13ab) and is reused rather than reinvented — the summary keeps its words
  // visible, so folded is not hidden.
  // What was actually put in. Placed above the stages because it is the thing
  // read while weighing, and the stages are read after.
  const canTake = canTakeLines(b, b.viaKind === 'recipe' ? via : null);
  const lineRows = (b.lines || []).map((ln, i) => {
    const d = departureOf(ln);
    const chip = d === 'same' ? ''
      : `<span class="chip dep-${d}">${t('pigments.dep.' + d)}</span>`;
    const wasText = ln.was && (d === 'changed' || d === 'swapped')
      ? `<p class="hint">${t('pigments.wasLabel')}: ${esc(ln.was.name)} ${
          ln.was.amount ?? '—'} ${esc(ln.was.unit || '')}</p>`
      : '';
    return `
      <tr class="${ln.removed ? 'lineout' : ''}">
        <td><input type="text" data-l="${i}.name" value="${esc(ln.name || '')}">${chip}${wasText}</td>
        <td class="num"><input type="number" step="0.01" min="0" data-l="${i}.amount" value="${
          ln.amount ?? ''}"></td>
        <td><input type="text" data-l="${i}.unit" value="${esc(ln.unit || '')}" size="4"></td>
        <td><input type="text" data-l="${i}.note" value="${esc(text(ln.note))}"></td>
        <td><button class="btn quiet" data-line-out="${i}">${
          ln.removed ? t('pigments.lineBack') : t('pigments.lineOut')}</button></td>
      </tr>`;
  }).join('');

  // Each swatch may name a recipe of its own — the watercolour made from this
  // pigment came from the watercolour recipe, not from the one that made the
  // pigment. Any recipe is offerable here, not only those that output a
  // pigment, because a pastel recipe outputs nothing the application records.
  const swatchRecipes = recipesAll;
  const swatchRows = (await Promise.all((b.swatches || []).map(async (sw, i) => panel(`
    <div class="swatchrow">
      <span class="swatch" style="background:${esc(sw.hex || 'transparent')};${
        sw.hex ? '' : 'border:1px dashed var(--line)'}"></span>
      <div class="swatchfields">
        ${field(t('pigments.swatchKind'), `<select data-w="${i}.kind"><option value=""></option>${
          (await Promise.all(SWATCH_KINDS.map(async k =>
            `<option value="${k}"${sw.kind === k ? ' selected' : ''}>${
              esc(await label('swatch_kind', k))}</option>`))).join('')}</select>`)}
        ${field(t('pigments.swatchOn'), `<input type="text" data-w="${i}.substrate" value="${
          esc(text(sw.substrate))}" placeholder="${esc(t('pigments.swatchOnHint'))}">`)}
        ${field(t('pigments.swatchVia'), `<select data-w="${i}.viaId"><option value=""></option>${
          swatchRecipes.map(r => `<option value="${r.id}"${sw.viaId === r.id ? ' selected' : ''}>${
            esc(text(r.name))}</option>`).join('')}</select>`)}
        ${field(t('pigments.colour'), `<input type="color" data-w="${i}.hex" value="${
          esc(sw.hex || '#CCCCCC')}">
          <label class="inline"><input type="checkbox" data-w="${i}.nohex"${
            sw.hex ? '' : ' checked'}> ${t('pigments.swatchNoHex')}</label>`)}
        ${field(t('pigments.colourName'), `<input type="text" data-w="${i}.name.bg" value="${
          esc(sw.name?.bg || '')}" placeholder="${esc(t('pigments.swatchNameHint'))}">`)}
      </div>
      <button class="btn quiet" data-swatch-del="${i}" aria-label="×">×</button>
    </div>
  `)))).join('<div style="height:12px"></div>');

  const linesPanel = panel(`
    <h2>${t('pigments.linesTitle')}</h2>
    <p class="note">${t('pigments.linesHint')}</p>
    ${b.linesFrom ? `<p class="hint">${t('pigments.linesFrom')}: ${
      esc(text(b.linesFrom.recipeName))}${b.linesFrom.takenOn ? ` · ${esc(b.linesFrom.takenOn)}` : ''}</p>` : ''}
    ${b.lines.length ? `<table class="grid lines">
      <thead><tr>
        <th>${t('pigments.lineWhat')}</th><th class="num">${t('pigments.lineAmount')}</th>
        <th>${t('pigments.lineUnit')}</th><th>${t('common.notes')}</th><th></th>
      </tr></thead>
      <tbody>${lineRows}</tbody></table>` : ''}
    <div style="height:12px"></div>
    ${actionBtn('add', t('pigments.lineAdd'), 'data-line-add')}
    ${canTake ? `<button class="btn quiet" data-take-lines>${t('pigments.takeLines')}</button>` : ''}
    ${!b.lines.length && !canTake && b.viaKind === 'recipe' && !via
      ? `<p class="hint">${t('pigments.takeNeedsRecipe')}</p>` : ''}
  `);

  root.innerHTML = page({
    title: heading,
    sub: '',
    actions: `${backTo('#/pigments', t('pigments.title'))}
              <button class="btn primary" data-save>${t('common.save')}</button>`,
    body: `
      <div class="pigmentcols">
        <div class="col">
          ${linesPanel}
          <div style="height:16px"></div>
          ${panel(`
            <p class="note">${t('pigments.processHint')}</p>
            <div style="height:12px"></div>
            ${stages}
          `)}
          <div style="height:16px"></div>
          ${failed ? panel(`
            <h2>${t('pigments.noResult')}</h2>
            <p class="note">${t('pigments.noResultHint')}</p>
          `) : panel(`
            <h2>${t('pigments.result')}</h2>
            ${field(t('pigments.yield'), `<input type="number" data-f="yieldG" value="${
              b.yieldG ?? ''}" min="0" step="1"> g`)}
            ${field(t('pigments.qualityLabel'), `<select data-f="quality"><option value=""></option>${
              QUALITIES.map(q => `<option value="${q}"${b.quality === q ? ' selected' : ''}>${
                t('pigments.quality.' + q)}</option>`).join('')}</select>`)}
          `)}
          <div style="height:16px"></div>
          ${failed ? '' : panel(`
            <h2>${t('pigments.swatchesTitle')}</h2>
            <p class="note">${t('pigments.swatchesHint')}</p>
            ${swatchRows}
            <div style="height:12px"></div>
            ${actionBtn('add', t('pigments.swatchAdd'), 'data-swatch-add')}
          `)}
          <div style="height:16px"></div>
          ${panel(`
            <h2>${t('pigments.nextTime')}</h2>
            ${pairField('', 'notes', b.notes, { multiline: true })}
          `)}
        </div>

        <aside class="side">
          ${panel(`
            ${field(t('pigments.statusLabel'), `<select data-f="status">${
              STATUSES.map(x => `<option value="${x}"${b.status === x ? ' selected' : ''}>${
                t('pigments.status.' + x)}</option>`).join('')}</select>`)}
            ${field(t('plants.one'), `<select data-f="plantId"><option value=""></option>${
              plants.map(p => `<option value="${p.id}"${b.plantId === p.id ? ' selected' : ''}>${
                esc(text(p.nameCommon))}</option>`).join('')}</select>`)}
            ${field(t('pigments.part'), parts.length
              ? `<select data-f="partCode"><option value=""></option>${partOptions}</select>`
              : `<p class="hint">${t('pigments.pickPlantFirst')}</p>`)}
            ${field(t('pigments.raw'), `<input type="number" data-f="rawWeightG" value="${
              b.rawWeightG ?? ''}" min="0" step="1"> g`)}
            <p class="note">${t('pigments.rawWhy')}</p>
          `)}
          <div style="height:12px"></div>
          <details class="contextstrip"${b.date || b.finishedOn ? ' open' : ''}>
            <summary>${t('pigments.dates')}${b.date ? ` <span class="chip">${esc(b.date)}</span>` : ''}</summary>
            <div class="foldbody">
              ${field(t('pigments.started'), `<input type="date" data-f="date" value="${esc(b.date || '')}">`)}
              ${field(t('pigments.finished'), `<input type="date" data-f="finishedOn" value="${esc(b.finishedOn || '')}">`)}
            </div>
          </details>
          <div style="height:12px"></div>
          <details class="contextstrip" open>
            <summary>${t('pigments.via')}${via ? ` <span class="chip">${esc(text(via.name))}</span>` : ''}</summary>
            <div class="foldbody">
              ${field(t('pigments.viaKind'), `<select data-f="viaKind">
                <option value="recipe"${b.viaKind === 'recipe' ? ' selected' : ''}>${t('pigments.viaRecipe')}</option>
                <option value="chain"${b.viaKind === 'chain' ? ' selected' : ''}>${t('pigments.viaChain')}</option>
              </select>`)}
              ${choices.length
                ? field('', `<select data-f="viaId"><option value=""></option>${
                    choices.map(r => `<option value="${r.id}"${b.viaId === r.id ? ' selected' : ''}>${
                      esc(text(r.name))}</option>`).join('')}</select>`)
                // An empty dropdown with no explanation reads as broken. It is
                // not: there is simply no recipe yet that produces a pigment,
                // and the way out is to write one, so the way out is offered
                // here instead of being hunted for.
                : `<p class="hint">${t('pigments.noRecipes')}</p>
                   ${actionBtn('add', t('pigments.newRecipe'), 'data-newrecipe')}`}
            </div>
          </details>
          ${openId !== 'new' ? `<div style="height:12px"></div>
            ${panel(actionBtn('delete', t('pigments.delete'), 'data-delete', 'destructive'))}` : ''}
        </aside>
      </div>`,
  });
}

function readForm(root) {
  for (const el of root.querySelectorAll('[data-f]')) {
    const k = el.dataset.f;
    draft[k] = el.type === 'number'
      ? (el.value === '' ? null : Number(el.value))
      : el.value;
  }
  for (const el of root.querySelectorAll('[data-l]')) {
    const [i, key] = el.dataset.l.split('.');
    const ln = draft.lines[Number(i)];
    if (!ln) continue;
    if (key === 'note') ln.note.bg = el.value;
    else if (key === 'amount') ln.amount = el.value === '' ? null : Number(el.value);
    else ln[key] = el.value;
  }
  // `data-w="0.name.bg"` — a path, not a name, so `readPairs` cannot serve it:
  // that helper splits on the first dot and would have written the whole
  // swatch's name under the key „name", silently, for every swatch at once.
  for (const el of root.querySelectorAll('[data-w]')) {
    const [idx, key, lang] = el.dataset.w.split('.');
    const sw = draft.swatches[Number(idx)];
    if (!sw) continue;
    if (key === 'nohex') continue;          // read after the colour, below
    else if (lang) { sw[key] = sw[key] || {}; sw[key][lang] = el.value.trim(); }
    else if (key === 'substrate') { sw.substrate = sw.substrate || {}; sw.substrate.bg = el.value.trim(); }
    else sw[key] = el.value;
  }
  // „No measurement" wins over the colour input, and is read second so it can.
  // The picker always holds SOME colour — it cannot be empty — so a swatch
  // described only in words would otherwise be given whatever grey the control
  // opened on, and an invented measurement is worse than none (§13dl).
  for (const el of root.querySelectorAll('[data-w$=".nohex"]')) {
    const i = Number(el.dataset.w.split('.')[0]);
    if (draft.swatches[i] && el.checked) draft.swatches[i].hex = '';
  }
  for (const el of root.querySelectorAll('[data-s]')) {
    const [i, key] = el.dataset.s.split('.');
    if (key === 'note') draft.stages[Number(i)].note.bg = el.value;
    else draft.stages[Number(i)][key] = el.value;
  }
  readPairs(root, draft);
}

export default {
  id: 'pigments',
  title: () => t('pigments.title'),
  sub: () => t('pigments.sub'),

  open(first) { draft = null; openId = first || null; },
  reset() { openId = null; draft = null; },

  async render(root) {
    if (openId) {
      if (!draft || (openId !== 'new' && draft.id !== openId)) {
        draft = openId === 'new' ? blank() : structuredClone(await get('pigmentBatches', openId));
      }
      // An address naming a batch that is gone — a bookmark to something
      // deleted, or Back after deleting it. Rendering throws, and a thrown
      // render leaves the previous screen up, which reads as the address being
      // ignored (§11b).
      if (!draft) return navigate('#/pigments');
      const [rawPlants, recipes, chains] = await Promise.all([
        all('plants'), all('recipes'), all('chains'),
      ]);
      // Sorted by name, in the reader's own language. Unsorted, a list of 57
      // plants is a list nobody can find anything in.
      const plants = rawPlants.sort(
        (a, b) => text(a.nameCommon).localeCompare(text(b.nameCommon), getLang()));
      // Only recipes that say they produce a pigment. A recipe with
      // `output: 'none'` is read and followed, never logged (§13by), and
      // offering it here would invite a batch that records the making of a
      // watercolour the owner does not count.
      await renderBatch(root, draft, plants,
        recipes.filter(r => r.output === 'pigment' || r.output === 'extract'), chains,
        // The full list, for the swatches: a watercolour made from this pigment
        // came from the watercolour recipe, which outputs nothing the
        // application records and so is filtered out of the batch's own
        // dropdown for good reason (§13by) — but naming it beside a swatch is
        // not logging a making, it is saying what the swatch is of.
        recipes);
    } else {
      draft = null;
      await renderList(root);
    }

    root.onclick = async (e) => {
      if (e.target.closest('a')) return;
      if (e.target.closest('[data-new]')) return navigate('#/pigments/new');
      const row = e.target.closest('[data-open]');
      if (row) return navigate(`#/pigments/${row.dataset.open}`);
      if (e.target.closest('[data-back]')) return navigate('#/pigments');
      if (e.target.closest('[data-save]')) {
        readForm(root);
        await put('pigmentBatches', draft);
        // The put succeeded, so the address change that follows is not a
        // departure from unsaved work (§13ad).
        markClean();
        return navigate('#/pigments');
      }
      // Taking the recipe's lines. Offered only while the list is empty, so
      // there is no path by which one click replaces an evening's entries
      // (§13dr) — the button is not drawn once lines exist, and this re-checks
      // rather than trusting that.
      if (e.target.closest('[data-take-lines]')) {
        readForm(root);
        const recipe = recipes.find(r => r.id === draft.viaId);
        if (!canTakeLines(draft, recipe)) return;
        draft.lines = await linesFromRecipe(recipe, { rawG: draft.rawWeightG, weightG: draft.rawWeightG || 0 }, await all('substances'), plants);
        draft.linesFrom = {
          recipeId: recipe.id,
          // Copied, not only referenced: the departure has to stay readable if
          // the recipe is renamed or withdrawn later.
          recipeName: { ...recipe.name },
          takenOn: today(),
        };
        return this.render(root);
      }
      if (e.target.closest('[data-swatch-add]')) {
        readForm(root);
        draft.swatches.push({ id: uid(), kind: '', substrate: { bg: '', en: '' },
                              viaId: '', hex: '', name: { bg: '', en: '' }, photos: [] });
        return this.render(root);
      }
      const swDel = e.target.closest('[data-swatch-del]');
      if (swDel) {
        readForm(root);
        // Deleted outright, unlike a recipe line. A swatch has no history to
        // depart from — it is a thing the owner wrote down, and removing it is
        // removing her own entry, not erasing a comparison (§13dr).
        draft.swatches.splice(Number(swDel.dataset.swatchDel), 1);
        return this.render(root);
      }
      if (e.target.closest('[data-line-add]')) {
        readForm(root);
        // `was: null` is what makes this line an ADDITION rather than a change.
        // The soda that the recipe never mentioned is the case this exists for.
        draft.lines.push({ id: uid(), roleCode: '', substanceId: '', name: '',
                           amount: null, unit: '', removed: false, was: null,
                           note: { bg: '', en: '' } });
        return this.render(root);
      }
      const out = e.target.closest('[data-line-out]');
      if (out) {
        readForm(root);
        const ln = draft.lines[Number(out.dataset.lineOut)];
        if (!ln) return;
        // A line taken from the recipe is struck out, never deleted: „I left
        // the soda out" is knowledge, and removing the row would make it
        // indistinguishable from never having followed a recipe at all. A line
        // the owner added herself has no such history, so hers goes.
        if (ln.was) ln.removed = !ln.removed;
        else draft.lines.splice(Number(out.dataset.lineOut), 1);
        return this.render(root);
      }
      if (e.target.closest('[data-newrecipe]')) {
        readForm(root);
        await put('pigmentBatches', draft);
        markClean();
        return navigate('#/recipes/new');
      }
      if (e.target.closest('[data-delete]')) {
        if (!confirm(t('pigments.confirmDelete'))) return;
        await remove('pigmentBatches', draft.id);
        return navigate('#/pigments');
      }
    };

    // Switching between recipe and chain changes which list the second dropdown
    // holds, so the screen is drawn again rather than left showing options from
    // the other kind.
    // Two dropdowns decide what a THIRD one may hold, so both redraw. Without
    // the plant one, Part stayed empty however a plant was chosen — the options
    // are read off the plant, and nothing re-read them. A select that never
    // fills looks broken rather than empty, which is what it was.
    const plantSel = root.querySelector('[data-f="plantId"]');
    if (plantSel) plantSel.onchange = async () => {
      readForm(root);
      draft.partCode = '';
      await this.render(root);
    };

    const kind = root.querySelector('[data-f="viaKind"]');
    if (kind) kind.onchange = async () => {
      readForm(root);
      draft.viaId = '';
      await this.render(root);
    };
  },
};

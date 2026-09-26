// modules/pigments.js — making a pigment, which is work on a SUBSTANCE (§13bx).
//
// A trial is work on CLOTH: it has pieces, each with its own placement and its
// own outcome. A batch has one output — one quantity of one pigment.
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
// A JOURNAL ENTRY, NOT A WORKFLOW (§13fg). A batch says what it was made from,
// which recipe it followed, what actually went in, what happened, and what came
// out. The recipe already describes the method; the batch records this time.
// Until rc105 it carried six fixed stages, a recipe-or-chain choice, a
// classification of every departure from the recipe, a quality rating and six
// kinds of product swatch. Pigment-making is occasional, and that was a
// workflow engine for something done a few times a year. What was taken out is
// listed in §13fg, and old records keep every field they had.

import { all, get, put, remove, newRecord, uid } from '../db.js';
import { linesFromRecipe } from '../recipe-lines.js';
import { t, text, getLang } from '../i18n.js';
import { markClean } from '../dirty.js';
import { shrinkResult } from '../photo.js';
import { page, panel, field, fieldGroup, esc, empty, pairField, readPairs, navigate,
         backTo, actionBtn, label, today } from '../ui.js';

let openId = null;
let draft = null;

// The shape a batch is written in from rc105 (§13fg). Fields an older batch
// carries and this one does not — `stages`, `finishedOn`, `quality`,
// `swatchHex`, `swatchName`, a swatch's `kind`, `substrate` and `viaId` — are
// left on those records and shown read-only where they hold something; nothing
// new is written into them.
function blank() {
  return newRecord({
    // `failed` or not. A failed batch is the most useful note there is for the
    // next attempt and must not read as a batch of zero grams (§13bx), so the
    // one state that matters stays. `planned` is no longer offered; an old
    // batch that says it keeps saying it until the owner ticks the box.
    status: 'done',
    date: today(),
    plantId: '',
    partCode: '',
    rawWeightG: null,
    // Always a recipe for a new batch. `viaKind` stays in the shape because an
    // older batch may say `chain`, and that batch is shown as made by its
    // chain rather than reinterpreted (§13fg).
    viaKind: 'recipe',
    viaId: '',
    // WHAT WAS ACTUALLY PUT IN (§13dr, simplified at §13fg). Taken from the
    // recipe once, then edited as the work went. The lines still carry `was`
    // because `linesFromRecipe` is shared with the paste print (§13ee), but
    // this screen does not classify or display departures.
    lines: [],
    linesFrom: null,
    // What happened this time, in one text. Replaces the six stages.
    process: { bg: '', en: '' },
    yieldG: null,
    // Simple colour records: a colour, a name, a short note (§13fg).
    swatches: [],
    photos: [],
    // „Резултат и извод" — what came out and what to change next time.
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

    // The group's swatch is its most recent successful batch's. A failed batch
    // has no colour to show and must not lend the group a blank one.
    const swatchOf = (x) => (x.swatches || []).find(w => w.hex) || null;
    const shown = list.map(x => ({ b: x, w: swatchOf(x) }))
      .find(({ b: x, w }) => x.status !== 'failed' && w)?.w || null;

    // Three columns. Quality left the list at §13fg: it is no longer entered,
    // and a column that is empty for every new batch reads as work left undone.
    const rows = list.map(b => {
      const failed = b.status === 'failed';
      return `
        <tr data-open="${b.id}">
          <td>${failed ? `<span class="tag">${t('pigments.status.failed')}</span> ` : ''}${
            swatchOf(b) && !failed
              ? `<span class="swatch sm" style="background:${esc(swatchOf(b).hex)}"></span> `
              : ''}${esc(text((b.swatches || [])[0]?.name) || '—')}</td>
          <td>${b.yieldG != null && !failed ? `${b.yieldG} g` : '—'}</td>
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

// May the recipe's lines be taken? A function rather than a condition written
// twice, because it is checked where the button is DRAWN and again where it is
// clicked, and those two drifting apart is how a disabled control turns out to
// be clickable. Exported so the guard can ask the same question the screen asks
// instead of searching the source for a string it half remembers (§13cz).
export function canTakeLines(batch, recipe) {
  if (!recipe) return false;
  // An older batch made by a chain has no recipe lines to take (§13fg).
  if (batch.viaKind === 'chain') return false;
  // The one that matters: an evening's entries are not replaced by one click.
  if ((batch.lines || []).length) return false;
  return true;
}

// ---- one batch ------------------------------------------------------------

async function renderBatch(root, b, plants, recipes, chains, recipesAll) {
  const plant = plants.find(p => p.id === b.plantId);
  const parts = (plant?.parts || []).map(x => x.partCode);
  // An older batch may say it was made by a chain. It is shown as that, read
  // only: turning it into a recipe would be a guess about which step of the
  // chain made the pigment (§13fg).
  const byChain = b.viaKind === 'chain';
  const chain = byChain ? chains.find(c => c.id === b.viaId) : null;
  const recipe = byChain ? null : recipesAll.find(r => r.id === b.viaId);
  const failed = b.status === 'failed';

  const partOptions = (await Promise.all(parts.map(async pc =>
    `<option value="${pc}"${b.partCode === pc ? ' selected' : ''}>${
      esc(await label('plant_part', pc))}</option>`))).join('');
  const partName = b.partCode ? await label('plant_part', b.partCode) : '';
  const heading = plant
    ? `${text(plant.nameCommon)}${partName ? ' — ' + partName : ''}`
    : t('pigments.new');

  // 1. Source.
  const sourcePanel = panel(`
    <h2>${t('pigments.sourceTitle')}</h2>
    ${field(t('plants.one'), `<select data-f="plantId"><option value=""></option>${
      plants.map(p => `<option value="${p.id}"${b.plantId === p.id ? ' selected' : ''}>${
        esc(text(p.nameCommon))}</option>`).join('')}</select>`)}
    ${parts.length
      ? field(t('pigments.part'), `<select data-f="partCode"><option value=""></option>${partOptions}</select>`)
      : fieldGroup(t('pigments.part'), `<p class="hint">${t('pigments.pickPlantFirst')}</p>`)}
    ${field(t('pigments.raw'), `<input type="number" data-f="rawWeightG" value="${
      b.rawWeightG ?? ''}" min="0" step="1"> g`)}
    <p class="note">${t('pigments.rawWhy')}</p>
  `);

  // 2. Recipe. Only recipes that make a pigment: a watercolour or pastel
  // recipe is read and followed, never logged (§13by), and `extract` is not a
  // pigment. A batch that already names some other recipe keeps it in the list
  // so opening and saving it never changes what it says.
  const offered = recipes.filter(r => r.output === 'pigment'
    || (!byChain && r.id === b.viaId));
  const recipePanel = panel(`
    <h2>${t('pigments.recipeTitle')}</h2>
    ${byChain
      ? `<p class="note">${t('pigments.legacyChain')}: <b>${
          esc(chain ? text(chain.name) : t('pigments.legacyChainGone'))}</b></p>`
      : offered.length
        ? field(t('pigments.recipeLabel'), `<select data-f="viaId"><option value=""></option>${
            offered.map(r => `<option value="${r.id}"${b.viaId === r.id ? ' selected' : ''}>${
              esc(text(r.name))}</option>`).join('')}</select>`)
        // An empty dropdown with no explanation reads as broken. It is not:
        // there is simply no recipe yet that produces a pigment, and the way
        // out is to write one, so the way out is offered here.
        : `<p class="hint">${t('pigments.noRecipes')}</p>
           ${actionBtn('add', t('pigments.newRecipe'), 'data-newrecipe')}`}
  `);

  // 3. What I actually used. A plain editable list: what, how much, a note.
  // No classification against the recipe (§13fg). A line an older batch struck
  // out is still drawn struck, because that is what she wrote; × removes any
  // line.
  const canTake = canTakeLines(b, recipe);
  const lineRows = (b.lines || []).map((ln, i) => `
      <tr class="${ln.removed ? 'lineout' : ''}">
        <td><input type="text" data-l="${i}.name" value="${esc(ln.name || '')}">${
          ln.removed ? `<p class="hint">${t('pigments.lineWasOut')}</p>` : ''}</td>
        <td class="num"><input type="number" step="0.01" min="0" data-l="${i}.amount" value="${
          ln.amount ?? ''}"></td>
        <td><input type="text" data-l="${i}.unit" value="${esc(ln.unit || '')}" size="4"></td>
        <td><input type="text" data-l="${i}.note" value="${esc(text(ln.note))}"></td>
        <td><button class="btn quiet" data-line-del="${i}" aria-label="${
          esc(t('pigments.lineDel'))}">×</button></td>
      </tr>`).join('');

  const usedPanel = panel(`
    <h2>${t('pigments.usedTitle')}</h2>
    <p class="note">${t('pigments.usedHint')}</p>
    ${b.linesFrom ? `<p class="hint">${t('pigments.linesFrom')}: ${
      esc(text(b.linesFrom.recipeName))}${b.linesFrom.takenOn ? ` · ${esc(b.linesFrom.takenOn)}` : ''}</p>` : ''}
    ${(b.lines || []).length ? `<table class="grid lines">
      <thead><tr>
        <th>${t('pigments.lineWhat')}</th><th class="num">${t('pigments.lineAmount')}</th>
        <th>${t('pigments.lineUnit')}</th><th>${t('common.notes')}</th><th></th>
      </tr></thead>
      <tbody>${lineRows}</tbody></table>` : ''}
    <div style="height:12px"></div>
    ${actionBtn('add', t('pigments.lineAdd'), 'data-line-add')}
    ${canTake ? `<button class="btn quiet" data-take-lines>${t('pigments.takeLines')}</button>` : ''}
    ${!(b.lines || []).length && !canTake && !byChain && !recipe
      ? `<p class="hint">${t('pigments.takeNeedsRecipe')}</p>` : ''}
  `);

  // 4. Process / notes — one text in place of the six stages.
  const processPanel = panel(`
    ${pairField(t('pigments.processNotes'), 'process', b.process || {},
      { multiline: true, placeholder: t('pigments.processPlaceholder') })}
  `);

  // 5. Result. A swatch is a colour, a name and a short note. What it was
  // (watercolour, pastel…), what it was on and by which recipe are no longer
  // asked; an older swatch that says any of them keeps saying it, read only.
  const swatchRows = (await Promise.all((b.swatches || []).map(async (sw, i) => {
    const legacy = [];
    if (sw.kind) legacy.push(await label('swatch_kind', sw.kind));
    if (text(sw.substrate)) legacy.push(text(sw.substrate));
    if (sw.viaId) {
      const r = recipesAll.find(x => x.id === sw.viaId);
      legacy.push(r ? text(r.name) : sw.viaId);
    }
    return `
    <div class="swatchrow">
      <span class="swatch" style="background:${esc(sw.hex || 'transparent')};${
        sw.hex ? '' : 'border:1px dashed var(--line)'}"></span>
      <div class="swatchfields">
        ${field(t('pigments.colour'), `<input type="color" data-w="${i}.hex" value="${
          esc(sw.hex || '#CCCCCC')}">`)}
        <label class="inline"><input type="checkbox" data-w="${i}.nohex"${
          sw.hex ? '' : ' checked'}> ${t('pigments.swatchNoHex')}</label>
        ${field(t('pigments.colourName'), `<input type="text" data-w="${i}.name.bg" value="${
          esc(sw.name?.bg || '')}" placeholder="${esc(t('pigments.swatchNameHint'))}">`)}
        ${field(t('pigments.swatchNote'), `<input type="text" data-w="${i}.note.bg" value="${
          esc(sw.note?.bg || '')}">`)}
        ${legacy.length ? `<p class="hint">${t('pigments.legacy')}: ${esc(legacy.join(' · '))}</p>` : ''}
      </div>
      <button class="btn quiet" data-swatch-del="${i}" aria-label="×">×</button>
    </div>`;
  }))).join('<div style="height:12px"></div>');

  // Photographs of the batch. The strip is a `fieldGroup`, not a `field`: a
  // label forwards every press inside it to its control, which swallowed the ×
  // on the plan photographs once (§13as). Photographs an older batch's stages
  // carried are shown beside them, read only — they live on the stage and are
  // not copied, so no image is stored twice.
  const stagePhotos = (b.stages || []).flatMap(st => st?.photos || []);
  const photoStrip = `
    <div class="stepphotos">
      ${(b.photos || []).map((src, j) => `
        <div class="stepphoto"><img src="${src}" alt="">
          <button class="btn quiet" data-photo-del="${j}" aria-label="×">×</button></div>`).join('')}
      <label class="addphoto" for="pigmentphoto" title="${esc(t('trials.addPhoto'))}">+</label>
      <input type="file" id="pigmentphoto" accept="image/*" multiple hidden>
    </div>
    ${stagePhotos.length ? `<p class="hint">${t('pigments.legacyStagePhotos')}</p>
      <div class="stepphotos">${stagePhotos.map(src =>
        `<div class="stepphoto"><img src="${src}" alt=""></div>`).join('')}</div>` : ''}`;

  const resultPanel = panel(`
    <h2>${failed ? t('pigments.noResult') : t('pigments.result')}</h2>
    ${failed
      ? `<p class="note">${t('pigments.noResultHint')}</p>`
      : `${field(t('pigments.yield'), `<input type="number" data-f="yieldG" value="${
            b.yieldG ?? ''}" min="0" step="1"> g`)}
         ${fieldGroup(t('pigments.swatchesTitle'), `${swatchRows}
           <div style="height:12px"></div>
           ${actionBtn('add', t('pigments.swatchAdd'), 'data-swatch-add')}`)}`}
    ${fieldGroup(t('pigments.photos'), photoStrip)}
    ${pairField(t('pigments.conclusion'), 'notes', b.notes || {},
      { multiline: true, placeholder: t('pigments.conclusionPlaceholder') })}
  `);

  // What an older batch recorded and the screen no longer asks for. Shown, not
  // edited, so nothing she wrote disappears from view (§13fg).
  const legacyRows = [];
  if (b.finishedOn) legacyRows.push(`${t('pigments.finished')}: ${esc(b.finishedOn)}`);
  if (b.quality) legacyRows.push(`${t('pigments.qualityLabel')}: ${esc(t('pigments.quality.' + b.quality))}`);

  root.innerHTML = page({
    title: heading,
    sub: '',
    actions: `${backTo('#/pigments', t('pigments.title'))}
              <button class="btn primary" data-save>${t('common.save')}</button>`,
    body: `
      <div class="pigmentcols">
        <div class="col">
          ${sourcePanel}
          <div style="height:16px"></div>
          ${recipePanel}
          <div style="height:16px"></div>
          ${usedPanel}
          <div style="height:16px"></div>
          ${processPanel}
          <div style="height:16px"></div>
          ${resultPanel}
        </div>

        <aside class="side">
          ${panel(`
            ${field(t('common.date'), `<input type="date" data-f="date" value="${esc(b.date || '')}">`)}
            <label class="inline"><input type="checkbox" data-failed${failed ? ' checked' : ''}> ${
              t('pigments.failedLabel')}</label>
          `)}
          ${legacyRows.length ? `<div style="height:12px"></div>${panel(`
            <p class="hint">${t('pigments.legacyNote')}</p>
            ${legacyRows.map(r => `<p>${r}</p>`).join('')}`)}` : ''}
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
  // Ticking the box makes the batch failed; unticking a failed one makes it
  // done. An older batch that says `planned` and was never ticked keeps saying
  // it — opening and saving must not rewrite a state nobody chose.
  const failedBox = root.querySelector('[data-failed]');
  if (failedBox) {
    if (failedBox.checked) draft.status = 'failed';
    else if (draft.status === 'failed') draft.status = 'done';
  }
  for (const el of root.querySelectorAll('[data-l]')) {
    const [i, key] = el.dataset.l.split('.');
    const ln = draft.lines[Number(i)];
    if (!ln) continue;
    if (key === 'note') { ln.note = ln.note || {}; ln.note.bg = el.value; }
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
      // Older records may lack a list the screen writes into.
      draft.lines = draft.lines || [];
      draft.swatches = draft.swatches || [];
      draft.photos = draft.photos || [];
      const [rawPlants, recipes, chains] = await Promise.all([
        all('plants'), all('recipes'), all('chains'),
      ]);
      // Sorted by name, in the reader's own language. Unsorted, a list of 57
      // plants is a list nobody can find anything in.
      const plants = rawPlants.sort(
        (a, b) => text(a.nameCommon).localeCompare(text(b.nameCommon), getLang()));
      // The recipe dropdown offers only `output === 'pigment'` (filtered in
      // renderBatch); the full list is passed so an older swatch's recipe and
      // a batch's own recipe can still be named.
      await renderBatch(root, draft, plants, recipes, chains, recipes);
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
          // Copied, not only referenced, so the batch still says where its
          // lines came from if the recipe is renamed or withdrawn later.
          recipeName: { ...recipe.name },
          takenOn: today(),
        };
        return this.render(root);
      }
      if (e.target.closest('[data-swatch-add]')) {
        readForm(root);
        draft.swatches.push({ id: uid(), hex: '', name: { bg: '', en: '' },
                              note: { bg: '', en: '' }, photos: [] });
        return this.render(root);
      }
      const swDel = e.target.closest('[data-swatch-del]');
      if (swDel) {
        readForm(root);
        draft.swatches.splice(Number(swDel.dataset.swatchDel), 1);
        return this.render(root);
      }
      if (e.target.closest('[data-line-add]')) {
        readForm(root);
        draft.lines.push({ id: uid(), roleCode: '', substanceId: '', name: '',
                           amount: null, unit: '', note: { bg: '', en: '' } });
        return this.render(root);
      }
      // A line is removed outright (§13fg). It used to be struck through when
      // it came from the recipe, so the departure could be read; the batch no
      // longer reads departures, and a struck row is a row in the way.
      const lineDel = e.target.closest('[data-line-del]');
      if (lineDel) {
        readForm(root);
        draft.lines.splice(Number(lineDel.dataset.lineDel), 1);
        return this.render(root);
      }
      const photoDel = e.target.closest('[data-photo-del]');
      if (photoDel) {
        readForm(root);
        draft.photos.splice(Number(photoDel.dataset.photoDel), 1);
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

    // Photographs, delegated so a redraw never orphans the handler. Also where
    // the two selects that decide what else the screen shows are redrawn: the
    // plant decides which parts exist, and the recipe decides whether its
    // lines can be taken. Without the second, choosing a recipe left the
    // „take the lines" button undrawn until the batch was saved and reopened.
    root.onchange = async (e) => {
      if (!draft) return;
      if (e.target.id === 'pigmentphoto' && e.target.files?.length) {
        readForm(root);
        for (const file of e.target.files) draft.photos.push(await shrinkResult(file));
        return this.render(root);
      }
      const f = e.target.dataset?.f;
      if (f === 'plantId') {
        readForm(root);
        draft.partCode = '';
        return this.render(root);
      }
      if (f === 'viaId') {
        readForm(root);
        return this.render(root);
      }
    };
  },
};

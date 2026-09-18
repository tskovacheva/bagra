// seed-ui.js — the merge preview (§10).
//
// A pack update is never applied silently. What is new, what would change,
// and what is protected because the user edited it are all shown first, each
// selectable, and nothing is written until she says so.

import { t } from './i18n.js';
import { page, panel, esc, label, note } from './ui.js';
import { diffPack, applyDiff, recordApplied, defaultChosen, pendingCount, recordStatus } from './seed.js';

let state = null;   // { name, diff, chosen:Set }

export function isOpen() { return !!state; }
export function close() { state = null; }

export async function open(name) {
  const diff = await diffPack(name);
  // The rule for what is ticked lives in seed.js, because the list button's
  // count has to be the same set (§13du).
  const chosen = defaultChosen(diff);
  state = { name, diff, chosen };
}

// A pack field in words, per pack. One field name means different things in
// different packs — `name`, `category`, `description` — so the dictionary is
// keyed by pack first.
//
// It was one flat list covering plants and substances, and anything else fell
// back to the raw field name: a recipe preview said „ingredients, steps" in the
// middle of a Bulgarian screen. The record note (§13du) names fields too, so
// the gap would have shown twice. `scripts/try-pack-field-labels.mjs` fails on
// any field a pack carries that has no entry here, and on an entry whose key is
// absent from i18n — so a new field cannot arrive unnamed.
export const FIELD_LABELS = {
  plants: {
    nameCommon: 'plants.nameCommon', nameBotanical: 'plants.nameBotanical',
    parts: 'plants.parts', colours: 'plants.colours', sections: 'plants.sections',
    lightfastness: 'plants.lightfastness', washfastness: 'plants.washfastness',
    role: 'plants.role', plantType: 'plants.plantType', habitat: 'plants.habitat',
    family: 'plants.family', compositionalRole: 'plants.compositional',
    confidence: 'plants.confidence', description: 'plants.description',
    dyeClass: 'plants.dyeClass', toxicity: 'plants.toxicity',
    photoCredit: 'plants.photo', photoHash: 'plants.photo', photoSrc: 'plants.photo',
  },
  substances: {
    name: 'materials.name', category: 'materials.category', formula: 'materials.formula',
    molarMass: 'materials.molarMass', maxTempC: 'materials.maxTemp',
    standardPercentWof: 'materials.standardWof', maxPercentWof: 'seed.field.maxPercentWof',
    typicalUse: 'substances.purpose', safetyNote: 'materials.safety',
    sourceCodes: 'ref.sources',
    handling: 'materials.handling', notes: 'common.notes',
    alPerUnit: 'substances.alPerUnit', naPerUnit: 'substances.naPerUnit',
    colourCast: 'materials.colourCast', colourEffect: 'materials.colourEffect',
    hydrationState: 'materials.hydration', mordantTypeCode: 'materials.mordantType',
    tanninTypeCode: 'materials.tanninType', needsAcid: 'substances.needsAcid',
    phDirection: 'materials.phDirection', suitableFibreClasses: 'materials.suitableFor',
  },
  techniques: {
    name: 'techniques.name', category: 'techniques.category',
    description: 'techniques.description', appliesTo: 'techniques.appliesTo',
  },
  combinations: {
    key: 'ref.inputs', expected: 'ref.expected', influences: 'ref.influences',
    confidence: 'ref.confidence', sourceCodes: 'ref.sources', learnedFrom: 'ref.sources',
    notes: 'common.notes',
  },
  sources: {
    name: 'sources.name', author: 'sources.author', kind: 'sources.kind',
    url: 'sources.url', note: 'sources.note',
  },
  glossary: {
    term: 'seed.field.term', definition: 'seed.field.definition', aliases: 'seed.field.aliases',
    seeAlso: 'seed.field.seeAlso', group: 'seed.field.group', sourceCode: 'ref.sources',
  },
  recipes: {
    name: 'recipes.name', type: 'recipes.type', output: 'seed.field.output',
    appliesTo: 'recipes.appliesTo', scaleBy: 'recipes.scaleBy', target: 'recipes.targetBasis',
    ingredients: 'recipes.ingredients', steps: 'recipes.steps', notes: 'common.notes',
    sourceCodes: 'recipes.source', distributable: 'recipes.distributable',
    requiredFollowOn: 'recipes.followOn',
    heldMinutes: 'recipes.heldMinutes', restMinutes: 'recipes.restMinutes',
    phTarget: 'recipes.phTarget',
    tempC: 'seed.field.temperature', tempMinC: 'seed.field.temperature',
    tempMaxC: 'seed.field.temperature',
  },
};

// Several fields can share one label — the three temperature fields, the three
// photograph fields — and a list saying „Снимка, Снимка, Снимка" is noise.
export function fieldNames(name, fields) {
  const dict = FIELD_LABELS[name] || {};
  return [...new Set(fields.map(f => dict[f] ? t(dict[f]) : f))].join(', ');
}

/**
 * The list button. Its count arrives after the screen is drawn (§13du).
 *
 * The count is the set the preview ticks when it opens, so working it out is
 * a whole `diffPack`: the pack fetched and parsed — half a megabyte for the
 * plants — and every record of the store compared. The first version did that
 * INSIDE the render, and every render waits for the one before it (app.js,
 * `renderView`), so a list with a count delayed whatever was asked for next.
 * The deep check found it as two unrelated sections failing at random, which
 * is how a slow render shows itself to a harness that waits for the screen to
 * stop changing.
 *
 * So the render draws the button, and `watchLibraryMarks` fills the number in
 * once it is known. No number when there is nothing to do.
 */
export function syncButton(name) {
  return `<button class="btn quiet" data-sync data-sync-pack="${esc(name)}">${t('seed.sync')}</button>`;
}

/**
 * On an open seeded record: a place for „the library holds a different
 * version of this", filled after the screen is drawn, for the same reason as
 * the count. Nothing is shown for a record that matches, or for the person's
 * own records.
 */
export function recordNote(name, id) {
  if (!id || !String(id).startsWith('seed:')) return '';
  return `<div data-libdiffers-slot data-pack="${esc(name)}" data-id="${esc(id)}"></div>`;
}

async function noteHtml(name, id) {
  const st = await recordStatus(name, id);
  if (!st) return '';
  // A withdrawn record her work uses stays (§13eo) — saying „the update will
  // offer to remove it" would be untrue for it.
  const msg = st.withdrawn
    ? t(st.inUse ? 'seed.recordWithdrawnInUse' : st.edited ? 'seed.recordWithdrawnEdited' : 'seed.recordWithdrawn', { n: st.inUse })
    : t(st.edited ? 'seed.recordDiffersEdited' : 'seed.recordDiffers',
        { fields: esc(fieldNames(name, st.fields)) });
  // The button is the list's button and goes to the same preview — one
  // destination, one name (§13dm).
  return `${note(msg, 'warn')}
      <button class="btn quiet" data-sync>${t('seed.sync')}</button>`;
}

// Each mark states when it is finished — `data-counted` / `data-checked` —
// so a check can wait for the answer instead of guessing how long it takes.
// A failure is stated too, and logged. The button still works without its
// number; what must not happen is a count of zero that was never counted.
// Started a moment late, and only for a mark still on screen.
//
// Every list render draws a new button, and a render follows every keystroke
// in a search box. Filling each one at once started a whole `diffPack` per
// keystroke — ten of them for a ten-letter word, nine for buttons already
// thrown away. In the deep check the same load showed up as two unrelated
// sections failing one run in four: the background comparisons stretched the
// pauses inside the NEXT screen's render past what `settle()` reads as
// finished. rc53 failed 0 of 9; this without the delay failed about 1 in 5.
// A mark replaced before its turn comes is left alone — nobody can see it.
const LATE_MS = 150;

async function fill(el) {
  const kind = el.dataset.syncPack ? 'counted' : 'checked';
  el.dataset[kind] = 'pending';
  await new Promise(r => setTimeout(r, LATE_MS));
  if (!el.isConnected) return;

  if (el.dataset.syncPack) {
    try {
      const n = await pendingCount(el.dataset.syncPack);
      if (!el.isConnected) return;
      if (n) el.insertAdjacentText('beforeend', ` · ${n}`);
      el.dataset.counted = String(n);
    } catch (err) {
      el.dataset.counted = 'failed';
      console.warn('library count failed:', el.dataset.syncPack, err);
    }
    return;
  }
  try {
    const html = await noteHtml(el.dataset.pack, el.dataset.id);
    if (!el.isConnected) return;
    if (html) { el.innerHTML = html; el.classList.add('libdiffers'); el.setAttribute('data-libdiffers', ''); }
    el.dataset.checked = html ? 'differs' : 'same';
  } catch (err) {
    el.dataset.checked = 'failed';
    console.warn('library check failed:', el.dataset.pack, el.dataset.id, err);
  }
}

/**
 * Fill every mark that appears, wherever a module draws it. Installed once,
 * from app.js, after the packs are loaded — for the reason `dirty.js` gives:
 * a rule five modules each have to remember is a rule the sixth forgets. No
 * module calls anything after drawing.
 */
let watching = false;
export function watchLibraryMarks(target = document.body) {
  if (watching || typeof MutationObserver === 'undefined') return;
  watching = true;
  const scan = () => {
    for (const el of target.querySelectorAll(
      '[data-sync-pack]:not([data-counted]), [data-libdiffers-slot]:not([data-checked])')) fill(el);
  };
  new MutationObserver(scan).observe(target, { childList: true, subtree: true });
  scan();
}

async function group(titleKey, entries, { ticked, hint = '' } = {}) {
  if (!entries.length) return '';
  const rows = await Promise.all(entries.map(async e => `
    <label class="difrow">
      <input type="checkbox" data-pick="${e.id}" ${state.chosen.has(e.id) ? 'checked' : ''}${e.inUse ? ' disabled' : ''}>
      <span class="difname">${esc(e.name)}</span>
      ${e.inUse ? `<span class="diffields">${esc(t('seed.withdrawnInUse', { n: e.inUse }))}</span>` : ''}
      ${e.fields ? `<span class="diffields">${esc(fieldNames(state.name, e.fields))}</span>` : ''}
    </label>`));
  return `
    <div class="difgroup">
      <div class="difhead">
        <h3>${t(titleKey)} <span class="difcount">${entries.length}</span></h3>
        <button class="btn quiet" data-toggle-group="${ticked}">${t('seed.toggleAll')}</button>
      </div>
      ${hint ? `<p class="hint">${hint}</p>` : ''}
      ${rows.join('')}
    </div>`;
}

export async function render(root, onDone) {
  const { diff } = state;
  const total = state.chosen.size;

  const nothing = !diff.added.length && !diff.changed.length
               && !diff.edited.length && !diff.withdrawn.length;

  root.innerHTML = page({
    title: t('seed.previewTitle'),
    sub: t('seed.previewSub'),
    actions: `<button class="btn quiet" data-cancel>${t('common.back')}</button>
              <button class="btn primary" data-apply ${total ? '' : 'disabled'}>
                ${t('seed.apply', { n: total })}</button>`,
    body: nothing
      ? panel(`<p class="note">${t('seed.upToDate', { n: diff.unchanged.length })}</p>`)
      : panel(`
          ${await group('seed.groupAdded', diff.added, { ticked: 'added' })}
          ${await group('seed.groupChanged', diff.changed, { ticked: 'changed' })}
          ${await group('seed.groupEdited', diff.edited, {
            ticked: 'edited', hint: t('seed.editedHint') })}
          ${await group('seed.groupWithdrawn', diff.withdrawn, {
            ticked: 'withdrawn', hint: t('seed.withdrawnHint') })}
          <p class="hint">${t('seed.unchanged', { n: diff.unchanged.length })}</p>
        `),
  });

  root.onclick = async (e) => {
    if (e.target.closest('[data-cancel]')) { close(); return onDone(); }

    const tog = e.target.closest('[data-toggle-group]');
    if (tog) {
      const list = diff[tog.dataset.toggleGroup];
      const allOn = list.filter(y => !y.inUse).every(x => state.chosen.has(x.id));
      for (const x of list.filter(y => !y.inUse)) allOn ? state.chosen.delete(x.id) : state.chosen.add(x.id);
      return render(root, onDone);
    }

    if (e.target.closest('[data-apply]')) {
      const offered = [...diff.added, ...diff.changed, ...diff.edited, ...diff.withdrawn];
      const all = offered.filter(x => state.chosen.has(x.id));
      const n = await applyDiff(diff.store, all, diff.pack);
      // This is the ONLY place a pack version becomes „applied" (§13cu). A boot
      // may seed missing records and must never retire an update the owner has
      // not seen — so the version she has actually reviewed is written here,
      // from the screen that showed it to her.
      //
      // Only a full apply closes it. If she left entries unticked, those are
      // precisely the ones the notice exists to keep offering — a withdrawal
      // above all, which is never performed except by a choice (§13cb).
      await recordApplied(state.name, { full: all.length === offered.length });
      close();
      alert(t('seed.applied', { n }));
      return onDone();
    }
  };

  root.onchange = (e) => {
    const pick = e.target.closest('[data-pick]');
    if (!pick) return;
    pick.checked ? state.chosen.add(pick.dataset.pick) : state.chosen.delete(pick.dataset.pick);
    const btn = root.querySelector('[data-apply]');
    if (btn) {
      btn.textContent = t('seed.apply', { n: state.chosen.size });
      btn.disabled = !state.chosen.size;
    }
  };
}

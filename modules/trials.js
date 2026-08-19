// modules/trials.js — one real piece of work (§8).
//
// The largest screen, built last because it composes records from every other
// module. Its substance lives in two nested lists: steps, which carry what was
// actually done and for how long, and placements, which attribute a result to
// one plant rather than to a whole bundle.

import { all, get, put, remove, newRecord, uid, setSetting } from '../db.js';
import { t, text } from '../i18n.js';
import { navigate, page, panel, field, options, label, terms, segmented, esc, empty, note,
         pickerInput,
         fmtDate, today, fact, facts, readBlock, foldable, fieldGroup, flash, icon, backTo, actionBtn } from '../ui.js';
import { shrinkResult, shrinkStep, shrinkThumb } from '../photo.js';
import { markClean } from '../dirty.js';
import { mordantBand } from '../vocab.js';
import { ACTION_FOR_STATE } from '../migrate-actions.js';
import { daysSinceMordanted, currentState, treatmentsOf, compositionTotal, coverPhoto, fibreClass as fibreClassOf,
         photoTimeline } from '../fabric-logic.js';
import { reserveLabel } from './fabrics.js';
import { trialStepWarnings } from '../calc/scale.js';

const ENHANCEMENTS = ['cloth_mordant', 'botanical_mordant', 'predye_substantive',
                      'blanket_mordant', 'blanket_dye', 'ph_modifier'];

let view = 'gallery';
let openId = null;
let draft = null;
// Which of the five screens (§8.0e), taken from the address rather than kept as
// a flag. `editing` was a hidden channel: the back button, a reload and a
// bookmark all disagreed with it, which is the fault §8.0c exists to prevent.
//   null      → the record's own screen: active work, or review when complete
//   'work'    → the working screen forced open on finished work
//   'finish'  → the finishing screen
let screen = null;
let filter = { plantId: '', processCode: '' };
// Which step is expanded on the working screen. One at a time: the row reads
// from a metre away closed, and everything a step carries is behind it.
let openStep = null;
// The same rule as a step: one placement open at a time (§8.0e, §13ag). Seven
// placements rendered open at once were most of the length of the entry form —
// the rule was written for steps and never applied to the thing beside them.
let openPlace = null;

// Whether the folded sections are open, kept across a redraw — adding a step
// must not snap the context strip shut under the person's hands.
let contextOpen = false;
let processOpen = false;

// The inline new piece on screen 2. Name, composition and weight only — the tag
// number is reserved at save, as everywhere else (§13e.2), so opening this and
// thinking better of it leaves no hole in the sequence.
let newFabric = { name: '', weightG: null, composition: [] };

// Which cloth a new trial was started from, taken from the address and used
// once. The trial reads the piece's own name and weight rather than opening by
// asking what the cloth already knows.
let handoff = null;

// Loaded once per render so the nested lists can name what they point at.
let plants = [], plantsById = new Map(), recipes = [], substances = [], combinations = [], chains = [], techniques = [];
// The cloth, by id. Needed because a trial's mordant usually is not on the
// trial: since §13bd it is on the piece, and the matcher has to read it there.
let fabricsById = new Map();

function blank() {
  return newRecord({
    // One record from intention to result (§8.0a). A new trial starts as an
    // intention, because that is when it actually starts.
    status: 'planned',
    intent: '',
    planPhotos: [],
    date: today(),
    // When the work was finished, which is not when it was recorded and not
    // always when it began (§13au). Null until screen 4 asks.
    finishedOn: null,
    title: '',
    processCode: 'ecoprint',
    enhancements: [],
    fabricIds: [],
    groundFrom: null,
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

// The date a piece of work is shown and sorted by.
//
// Work in hand is dated by when it is being done; finished work by when it was
// finished. A record entered a year after the fact carried only the day it was
// typed in, and that is the date the diary showed (§13au). `date` is kept, so
// a work begun on the 9th and finished on the 13th is still both.
const shownDate = (r) => (statusOf(r) === 'complete' && r.finishedOn) || r.date || '';

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

// The stages a step may be added to. `prep` is not among them any more (§13bd):
// preparation is the biography of the cloth, not part of one trial, and it is
// recorded as an action on the piece so that five pieces prepared together and
// then dyed separately do not have to be split apart afterwards. Steps already
// stored under `prep` still render — `STAGE_OF_TYPE` above is read, never
// written back — but no new one is created here.

// Leaving the work for somewhere else, and being able to come back (§13aq).
//
// Three things happen together and they were written out twice, once for the
// new-recipe button and once for add-preparation. The second copy is where the
// fault was: **it did not tell the unsaved-work guard that the work was saved**,
// so leaving raised "you have unsaved changes" over a record already written to
// the database, and the only way past was to discard — which is to say, there
// was no way past. Reported from real use: the group action could be reached
// and then not returned from.
//
// The guard clears itself when it sees the form leave the screen after a click
// on Save (dirty.js). A handoff saves without that click, so it has to say so.
// One function, so a third handoff cannot forget again.
async function handOff(hash, extra = {}) {
  await put('trials', draft);
  await setSetting('returnTo', {
    module: 'trials', id: draft.id, screen: 'work',
    label: draft.title || t('trials.one'),
    ...extra,
  });
  markClean();
  openId = null; draft = null;
  location.hash = hash;
}


// Where "work on this piece" leads.
//
// It used to be `#/trials/new/<id>` unconditionally, and pressing it twice made
// two records. Reported from real use: a silk scarf ended with two pieces of
// work in progress, both empty of most things, and no obvious way to tell which
// one to carry on with — the second was made while working around a different
// fault, and the application offered no sign that the first existed.
//
// A piece can only be in one bath at a time. So if work on it is already open,
// that IS the work on it, and the button opens it rather than starting a rival.
// Starting genuinely separate work on the same piece is still possible — finish
// the first — which matches the cloth: there is one scarf.
async function workOn(fabricId) {
  const open = (await all('trials'))
    .filter(tr => (tr.fabricIds || []).includes(fabricId) && tr.status !== 'complete')
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  return open.length ? `#/trials/${open[0].id}` : `#/trials/new/${fabricId}`;
}

const WORK_STAGES = ['decorate', 'colour', 'after'];

// A mark for each stage (§13bh). Borrowed from the prototype, which reaches for
// what the stage does to the cloth rather than for an abstract shape:
// preparation is the flask, decoration is the leaf laid on, colouring is the
// bath, after-treatment is the finish. A mark accompanies the name and never
// replaces it — six stages are six words and the words stay.
const STAGE_ICONS = {
  raw: 'i-fabric', prep: 'i-flask', decorate: 'i-plant',
  colour: 'i-beaker', after: 'i-finish', done: 'i-trial',
};
const stageIcon = (code) => icon(STAGE_ICONS[code] || 'i-trial');

// A mark for each kind of preparation, so a line of them is scanned rather than
// read (§13bh). The same marks the group action offers, which is where these
// lines are written.
const PREP_ICONS = {
  wash: 'i-drops', tannin: 'i-layers', mordant: 'i-flask',
  neutralise: 'i-beaker', iron: 'i-compound', soy: 'i-vial', bleach: 'i-drops',
};

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

// The progress line, generated from the runs that exist (§8.0b). Never a
// template: a template would claim "decoration" was reached on work that has no
// decorative action, and it cannot express dyeing before a print and again
// after — which is two passes through colouring, not one stage visited twice.
//
// The two fixed ends are read, not stored: raw cloth is the fabric record, done
// is `status: complete`.
async function progressMarks(r) {
  const runs = stageRuns(r.steps);
  const finished = statusOf(r) === 'complete';
  const marks = [
    { code: 'raw', done: (r.fabricIds || []).length > 0 },
    ...runs.map((run, n) => ({
      code: run.code,
      // The last run is where the work stands; everything before it is behind.
      done: finished || n < runs.length - 1,
      current: !finished && n === runs.length - 1,
    })),
    { code: 'done', done: finished },
  ];
  return Promise.all(marks.map(async m => ({ ...m, name: await label('trial_stage', m.code) })));
}

async function progressLine(r, opts = {}) {
  const marks = await progressMarks(r);
  return `<div class="progline${opts.compact ? ' compact' : ''}">${marks.map(m => `
    <span class="progmark${m.done ? ' done' : ''}${m.current ? ' current' : ''}">
      <span class="progdot">${m.done ? '✓' : ''}</span>
      <span class="proglabel">${esc(m.name)}</span>
    </span>`).join('<span class="progbar"></span>')}</div>`;
}

// What a finished piece came out as, for the card. Her own observed colours
// first — that is what `resultHex` is for — and nothing invented: a trial with
// no recorded colour shows its photograph and no swatches (§13h).
function trialSwatches(r, max = 6) {
  const out = [], seen = new Set();
  for (const pl of r.placements || []) {
    const hex = pl.resultHex;
    if (!hex || seen.has(hex.toLowerCase()) || out.length >= max) continue;
    seen.add(hex.toLowerCase());
    out.push({ hex, caption: pl.resultColour || '' });
  }
  return out;
}

// The picture that stands for the work: the most recent one taken, with the
// cloth's own shot standing in until there is one (§13ag). The cloth is looked
// up because the fallback lives on it.
const cover = (r, fabrics) =>
  coverPhoto(fabrics.find(f => (r.fabricIds || []).includes(f.id)), r);

// What to call a piece of work. The title is the person's own words and is kept
// — but when it was never written, the name was copied off the cloth at the
// moment the work began, and a copy taken once does not follow the original:
// renaming the cloth in Fabrics left the diary calling it by its old name
// (§13as).
//
// Derived on read rather than copied on write, which is the same rule as "no
// back-references in the data — related lists are worked out when the record is
// opened" (§3). The copy stays in the record only as a fallback for work that
// points at no cloth.
const workTitle = (r, fabrics) => {
  const cloth = fabrics.find(f => (r.fabricIds || []).includes(f.id));
  const clothName = cloth ? (cloth.name || cloth.label || '').trim() : '';
  // The cloth names the work when there is a cloth. No flag, no guessing at
  // whether the stored title was typed or copied: the piece is what the diary
  // is about, and Fabrics owns its name. A title of the person's own that says
  // something else is not lost — it is shown beneath, by the caller.
  return clothName || (r.title || '').trim();
};

// The person's own words, when they add something the cloth's name does not.
const workSubtitle = (r, fabrics) => {
  const own = (r.title || '').trim();
  return own && own !== workTitle(r, fabrics) ? own : '';
};

const fabricLine = (r, fabrics) => (r.fabricIds || [])
  .map(id => fabrics.find(f => f.id === id))
  .filter(Boolean)
  .map(f => `${f.label ? f.label + ' · ' : ''}${f.name || '—'}`)
  .join(' · ');

// ---------------------------------------------------------------- 1 · my work
//
// One list, two rhythms (§8.0e). Unfinished work is asked "how far along" and
// answers with a row and a progress line. Finished work is asked "what came
// out" and answers with a photograph. The same records, two questions.
// The reason is the part that transfers to the next piece; the verdict alone
// only says what happened to this one. Whichever was written — why it turned
// out as it did, or what to change — one line of it goes on the card.
function verdictWhy(tr) {
  const s = (tr.assessmentWhy || tr.nextTime || '').trim();
  return s;
}

async function renderList(root) {
  const trials = (await all('trials'))
    .sort((a, b) => shownDate(b).localeCompare(shownDate(a)));
  const fabrics = await all('fabrics');

  const shown = trials.filter(tr =>
    (!filter.plantId || (tr.placements || []).some(p => p.plantId === filter.plantId)) &&
    (!filter.processCode || tr.processCode === filter.processCode));

  const working = shown.filter(tr => statusOf(tr) !== 'complete');
  const finished = shown.filter(tr => statusOf(tr) === 'complete');

  const usedPlants = [...new Set(trials.flatMap(tr => (tr.placements || []).map(p => p.plantId)))]
    .filter(Boolean);

  const plantFilter = `<option value="">${t('trials.all')}</option>` + usedPlants.map(id =>
    `<option value="${id}"${id === filter.plantId ? ' selected' : ''}>${esc(text(plantsById.get(id)?.nameCommon) || '—')}</option>`).join('');

  const workRows = (await Promise.all(working.map(async tr => {
    const shot = cover(tr, fabrics);
    const names = (await Promise.all([...new Set((tr.placements || []).map(p => p.plantId))]
      .filter(Boolean).slice(0, 4)
      .map(async id => text(plantsById.get(id)?.nameCommon) || '—'))).join(', ');
    const cloth = fabricLine(tr, fabrics);
    return `
      <div class="workrowwrap">
      <button class="workrow" data-open="${tr.id}">
        <span class="workthumb">${shot
          ? `<img src="${shot}" alt="" loading="lazy">`
          : `<span class="thumb empty"></span>`}</span>
        <span class="workbody">
          <span class="worktop">
            <b>${esc(workTitle(tr, fabrics) || t('trials.one'))}</b>
            ${workSubtitle(tr, fabrics) ? `<span class="hint">${esc(workSubtitle(tr, fabrics))}</span>` : ''}
            <span class="hint">${fmtDate(shownDate(tr))}</span>
          </span>
          ${cloth ? `<span class="hint">${esc(cloth)}</span>` : ''}
          <span class="workstate">${await statusChip(tr)}${names ? `<span class="hint">${esc(names)}</span>` : ''}</span>
        </span>
        <span class="workprog">${await progressLine(tr, { compact: true })}</span>
        <span class="workgo">›</span>
      </button>
      ${cloth ? `
        <button class="btn quiet workfinish" data-finish-row="${tr.id}"
                title="${esc(t('trials.finish'))}">${t('trials.finishFromList')}</button>`
      : `
        <button class="btn quiet workfinish nocloth" data-attach="${tr.id}">
          ${t('trials.noClothOnWork')}
        </button>`}
      </div>`;
  }))).join('');

  // Finished work is grouped by the piece it was done to, not listed run by run
  // (§13am). A shawl printed in June and printed over again in August is one
  // shawl with two runs, and two cards side by side say it is two things. The
  // card shows the piece as it stands now — the most recent run leads — with
  // the earlier runs beneath it.
  //
  // Work touching several pieces is filed under the first of them rather than
  // repeated under each: repeating it would make one afternoon look like five.
  const byPiece = [];
  const pieceIndex = new Map();
  for (const tr of finished) {
    const key = (tr.fabricIds || [])[0] || 'loose:' + tr.id;
    if (!pieceIndex.has(key)) {
      pieceIndex.set(key, { key, fabric: fabrics.find(f => f.id === key) || null, runs: [] });
      byPiece.push(pieceIndex.get(key));
    }
    pieceIndex.get(key).runs.push(tr);
  }
  for (const group of byPiece) {
    group.runs.sort((a, b) => shownDate(b).localeCompare(shownDate(a)));
  }

  const doneCards = (await Promise.all(byPiece.map(async group => {
    const tr = group.runs[0];
    const earlier = group.runs.slice(1);
    const shot = cover(tr, fabrics);
    const sw = trialSwatches(tr);
    return `
      <div class="piececard">
      <button class="trialcard" data-open="${tr.id}">
        <div class="trialphoto">${shot
          ? `<img src="${shot}" alt="" loading="lazy">`
          : `<span class="trialnophoto">${esc(await label('process', tr.processCode))}</span>`}</div>
        <div class="trialmeta">
          ${sw.length ? `<span class="swatchrow">${sw.map(x =>
            `<span class="miniswatch" style="background:${esc(x.hex)}" title="${esc(x.caption)}"></span>`).join('')}</span>` : ''}
          <b>${esc(workTitle(tr, fabrics) || t('trials.one'))}</b>
          <span class="hint">${fmtDate(shownDate(tr))}</span>
          <span class="workstate">
            ${tr.assessment ? `<span class="statuschip ${esc(tr.assessment)}">${esc(await label('assessment', tr.assessment))}</span>` : ''}
            ${tr.repeat ? `<span class="verdict ${esc(tr.repeat)}">↻ ${esc(await label('repeat', tr.repeat))}</span>` : ''}
          </span>
          ${verdictWhy(tr) ? `<span class="whyline">${esc(verdictWhy(tr))}</span>` : ''}
        </div>
      </button>
      ${earlier.length ? `<div class="earlierruns">
        <span class="runshead">${t('trials.earlierRuns', { n: earlier.length })}</span>
        ${(await Promise.all(earlier.map(async prev => `
          <button class="runline" data-open="${prev.id}">
            <span>${esc(prev.title || t('trials.one'))}</span>
            <span class="hint">${fmtDate(shownDate(prev))}</span>
          </button>`))).join('')}
      </div>` : ''}
      ${group.fabric ? `
        <button class="btn quiet workagain" data-again="${group.fabric.id}">
          ${t('trials.workAgain')}
        </button>`
      : `
        <button class="btn quiet nocloth" data-attach="${tr.id}">
          ${t('trials.noClothOnWork')}
        </button>`}
      </div>`;
  }))).join('');

  // The third thing the diary is asked: not what is running and not what is
  // done, but what is *waiting*. Mordanted cloth does not keep indefinitely, and
  // a piece prepared and then forgotten is the most avoidable waste in the
  // studio. Only cloth with no unfinished trial on it — a piece already in
  // progress belongs to the section above.
  const busyIds = new Set(working.flatMap(tr => tr.fabricIds || []));

  // A piece can be here wrongly, and the records already written prove it: work
  // finished before §13al left the cloth at whatever state it had, so a garment
  // sat under "finished work" and under "ready to work" at the same time. The
  // default is fixed, but fixing a default does not correct what is already
  // stored. So the contradiction is shown where it appears, with the way to
  // settle it, rather than being left for the owner to notice and distrust the
  // whole column.
  const lastStateDate = (f) => (f.actions || [])
    .map(a => a.date || '').sort().pop() || '';
  const finishedOn = new Map();
  for (const tr of trials) {
    if (statusOf(tr) !== 'complete') continue;
    for (const id of tr.fabricIds || []) {
      const when = tr.date || '';
      if (!finishedOn.has(id) || when > finishedOn.get(id).when) {
        finishedOn.set(id, { when, trial: tr });
      }
    }
  }

  const ready = fabrics
    .filter(f => !busyIds.has(f.id))
    .map(f => {
      const done = finishedOn.get(f.id);
      return {
        f, state: currentState(f), days: daysSinceMordanted(f),
        // Stale when a completed piece of work is newer than anything the cloth
        // records about itself.
        stale: done && done.when >= lastStateDate(f) ? done.trial : null,
      };
    })
    .filter(x => x.state === 'mordanted' || x.state === 'tanned')
    .sort((a, b) => (b.days ?? -1) - (a.days ?? -1))
    .slice(0, 6);
  const readyCount = ready.length;
  const readyCards = ready.length ? `<div class="readyrow">${(await Promise.all(ready.map(async x => `
    <div class="readywrap">
      ${x.stale ? `
        <button class="readycard stale" data-settle="${x.stale.id}">
          <span class="readyname">${esc(x.f.name || x.f.label || '—')}</span>
          <span class="chip">${esc(await label('fabric_state', x.state))}</span>
          <span class="staleline">${t('trials.stateStale')}</span>
        </button>
        <button class="btn quiet againsmall" data-start="${x.f.id}">
          ${t('trials.startAnyway')}
        </button>`
      : `
        <button class="readycard" data-start="${x.f.id}">
          <span class="readyname">${esc(x.f.name || x.f.label || '—')}</span>
          <span class="chip">${esc(await label('fabric_state', x.state))}</span>
          <span class="hint">${x.f.weightG ? `${x.f.weightG} ${t('tools.grams')}` : ''}${
            x.days != null ? ` · ${t('trials.daysSince', { n: x.days })}` : ''}</span>
        </button>`}
    </div>`))).join('')}</div>` : '';

  const section = (titleText, count, inner) => inner ? `
    <div class="worksection">
      <div class="navhead">${esc(titleText)} · ${count}</div>
      ${inner}
    </div>` : '';

  root.innerHTML = page({
    title: t('trials.title'),
    sub: t('trials.sub'),
    actions: `${actionBtn('add', t('trials.new'), 'data-new', 'primary')}`,
    body: `
      ${trials.length ? `<div class="filterrow">
        <label class="inlinefield"><span>${t('trials.filterPlant')}</span>
          <select data-filter="plantId">${plantFilter}</select></label>
        <label class="inlinefield"><span>${t('trials.filterProcess')}</span>
          <select data-filter="processCode">${await options('process', filter.processCode, t('trials.all'))}</select></label>
      </div>` : ''}

      ${!shown.length ? empty(t('trials.empty'), t('trials.emptyHint')) : ''}
      ${section(t('trials.working'), working.length, workRows)}
      ${section(t('trials.ready'), readyCount, readyCards)}
      ${section(t('trials.finished'), finished.length, doneCards ? `<div class="trialgrid">${doneCards}</div>` : '')}`,
  });
}

// Read back before any redraw, or typing a name and pressing "+ fibre" loses it.
function readNewFabric(root) {
  for (const el of root.querySelectorAll('[data-nf]')) {
    const key = el.dataset.nf;
    newFabric[key] = el.type === 'number' ? (el.value === '' ? null : Number(el.value)) : el.value;
  }
  for (const el of root.querySelectorAll('[data-nf-comp]')) {
    const [i, key] = el.dataset.nfComp.split('.');
    const row = newFabric.composition[Number(i)];
    if (!row) continue;
    row[key] = key === 'percent' ? (el.value === '' ? null : Number(el.value)) : el.value;
  }
}

// ------------------------------------------------------------- 2 · new work
//
// One screen, one question (§8.0e).
//
// It used to split into "ready to work" and the rest, with "ready" meaning
// mordanted. That was wrong, and the tannin question is what exposed it
// (§13bd): readiness is not a property of a piece but of the pair of piece and
// intention. Mordanted linen is ready for a madder bath and tanned cotton is
// not; tanned cotton is ready for an eco print and raw cotton is not. Under the
// old rule a tanned piece — which is what an eco printer reaches for — sank to
// the bottom beside the raw wool.
//
// So: one list, every piece showing WHAT IT CARRIES, ordered by how much
// preparation stands behind it. The application knows what has been done to a
// piece; it does not know what she intends, and guessing costs more than
// showing.
//
// Choosing goes straight into the trial through the address, `#/trials/new/<id>`,
// which is the handoff that already exists (§8.0c). No intermediate form.
async function renderNew(root) {
  const fabrics = await all('fabrics');
  const trials = await all('trials');

  // A piece already carrying unfinished work is not offered: that is what the
  // fabric's own "continue this story" is for, and offering it here is how three
  // half-written trials end up on one garment.
  const busy = new Set(trials.filter(tr => statusOf(tr) !== 'complete')
    .flatMap(tr => tr.fabricIds || []));

  // How much preparation stands behind a piece. Not a score of readiness — it
  // is only an order, so that the cloth that has had the most done to it is
  // nearest the top and the raw wool is at the bottom. Every treatment counts
  // the same: an application that weighted mordanting above tannin would be
  // making the very guess about intention this list stopped making.
  const prepDepth = (f) => {
    const box = currentState(f);
    const boxRank = { unwashed: 0, scoured: 1, mordanted: 2, dyed: 2, finished: 1 }[box] ?? 0;
    return boxRank + treatmentsOf(f).length;
  };

  const rows = await Promise.all(fabrics.filter(f => !busy.has(f.id)).map(async f => {
    const days = daysSinceMordanted(f);
    const state = currentState(f);
    const comp = (await Promise.all((f.composition || [])
      .map(async c => `${c.percent}% ${await label('fibre', c.fibreCode)}`))).join(' / ');
    const tags = (await Promise.all(treatmentsOf(f).map(async code =>
      `<span class="tag">${esc(await label('fabric_action', code))}</span>`))).join('');
    return {
      f, depth: prepDepth(f),
      html: `
      <button class="workrow" data-pick="${f.id}">
        <span class="workthumb">${f.photoData
          ? `<img src="${f.photoData}" alt="" loading="lazy">`
          : `<span class="thumb empty"></span>`}</span>
        <span class="workbody">
          <span class="worktop">
            <b>${esc(f.label ? f.label + '  ' : '')}${esc(f.name || '—')}</b>
          </span>
          <span class="hint">${esc([comp, f.weightG ? f.weightG + ' ' + t('common.g') : ''].filter(Boolean).join(' · '))}</span>
          <span class="carries">
            <span class="chip">${esc(await label('fabric_state', state))}</span>${tags}
            ${days != null ? `<span class="hint"> · ${t('trials.mordantedAgo', { n: days })}</span>` : ''}
          </span>
        </span>
        <span class="workgo">›</span>
      </button>`,
    };
  }));

  const pieceList = rows
    .sort((a, b) => b.depth - a.depth)
    .map(x => x.html).join('');

  // Composition is fibre code plus percent, not free text: the fibre class, the
  // dye-receptive fraction and the mixed cellulose–protein warning are all
  // derived from it, and prose feeds none of them (§13.3).
  const fibreRows = (await Promise.all((newFabric.composition || []).map(async (c, i) => `
    <div class="comprow">
      <select data-nf-comp="${i}.fibreCode">${await options('fibre', c.fibreCode, '—')}</select>
      <input type="number" step="5" min="0" max="100" data-nf-comp="${i}.percent"
             value="${c.percent ?? ''}" placeholder="%">
      <span class="pct">%</span>
      <button class="btn quiet" data-nf-comp-del="${i}" aria-label="×">×</button>
    </div>`))).join('');

  const total = compositionTotal(newFabric.composition);

  root.innerHTML = page({
    title: t('trials.newWork'),
    sub: t('trials.newWorkAsk'),
    actions: `${actionBtn('cancel', t('common.cancel'), 'data-back', 'secondary')}`,
    body: `
      ${pieceList ? `<div class="worksection">
        <div class="navhead">${t('trials.choosePiece')} · ${rows.length}</div>
        ${pieceList}
      </div>` : ''}

      ${!rows.length ? empty(t('trials.noCloth'), t('trials.noClothHint')) : ''}

      ${panel(`
        <h2>${t('trials.newPiece')}</h2>
        <div class="newpiece">
          ${field(t('fabrics.name'), `<input type="text" data-nf="name" value="${esc(newFabric.name || '')}"
                   placeholder="${t('trials.newPieceName')}">`)}
          ${field(t('fabrics.weightG'), `<input type="number" step="1" min="0" data-nf="weightG"
                   value="${newFabric.weightG ?? ''}" placeholder="${t('trials.newPieceWeight')}">`)}
        </div>
        ${fieldGroup(t('fabrics.composition'), `
          ${fibreRows || `<p class="hint">—</p>`}
          ${actionBtn('add', t('fabrics.addFibre'), 'data-nf-comp-add', 'contextual')}
          ${total && total !== 100 ? note(t('fabrics.warn.total', { total }), 'warn') : ''}`)}
        <div class="btnrow">
          <button class="btn primary" data-nf-save>${t('trials.saveAndStart')}</button>
        </div>
      `)}`,
  });
}

// A strip of photographs with an add button. Offered, never required: at the
// bundle it leads the work, at the scale there is nothing to see (§8.0b).
//
// No capture attribute. It carried the right intention — at the bench the camera
// is what one wants — and the wrong consequence: forcing the camera does not
// *prefer* it, it removes every other choice, so a plan drawn in a notebook and
// photographed yesterday, or a diagram made on the laptop, could not be attached
// at all. Without it the operating system still offers the camera first, and the
// gallery and the file system underneath it.
function photoStrip(list, { addId, addAttr, delAttr, delValue = (j) => j, multiple = true }) {
  const shots = (list || []).map((src, j) => `
    <div class="stepphoto"><img src="${src}" alt="">
      <button class="btn quiet" ${delAttr}="${delValue(j)}" aria-label="×">×</button></div>`).join('');
  return `
    <div class="stepphotos">
      ${shots}
      <label class="addphoto" for="${addId}" title="${esc(t('trials.addPhoto'))}">+</label>
      <input type="file" id="${addId}" ${addAttr} accept="image/*"${multiple ? ' multiple' : ''} hidden>
    </div>`;
}

// The steps of one stage, and the progress line above them. The line is
// generated from what is there, never from a template: it shows the work as
// it went, repeats and all (§8.0b).
// What "+ action" offers. Ready sequences live in preparation, so they are only
// offered there; elsewhere the action is a plain step and the menu is a button.
function blankStep(stage) {
  return { id: uid(), typeCode: '', stageCode: stage,
           techniqueId: '', recipeId: '', chainId: '', roleCode: '', what: '',
           tempC: null, heldMinutes: null, restMinutes: null, mediumMod: null,
           photos: [], note: '' };
}

async function addActionMenu(stage, after) {
  const usable = stage === 'prep' ? chains.filter(c => (c.steps || []).length) : [];
  const afterAttr = after === undefined ? '' : ` data-after="${after}"`;

  if (!usable.length)
    return `<button class="btn quiet" data-add-step="${stage}"${afterAttr}>${t('trials.addAction')}</button>`;

  return `
    <details class="addmenu">
      <summary class="btn quiet">${t('trials.addAction')}</summary>
      <div class="addmenubody">
        <button class="btn quiet" data-add-step="${stage}"${afterAttr}>${t('trials.oneStep')}</button>
        <div class="navhead">${t('trials.readySequences')}</div>
        ${usable.map(c => `
          <button class="btn quiet" data-add-chain="${esc(c.id)}" data-stage="${stage}"${afterAttr}>
            ${esc(text(c.name))} <span class="hint">${(c.steps || []).length}</span>
          </button>`).join('')}
      </div>
    </details>`;
}

// A ready sequence of three inserts THREE steps, each carrying its own
// `recipeId` and the `chainId` of the sequence that brought it (§8.0e). Both
// fields already exist, so this costs no schema change.
//
// The reason is what follows the insert: with one indivisible step the owner
// cannot tick only the first two as done, cannot photograph the tannin
// separately from the acetate, and cannot correct the temperature of one of
// them. And a trial records what HAPPENED — a sequence held as a single id would
// silently rewrite the history of old work whenever the sequence itself was
// edited. Expanded steps are a snapshot and do not move.
function expandChain(chainId, stage) {
  const pick = chains.find(x => x.id === chainId);
  if (!pick) return [];
  return (pick.steps || []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map(cs => ({
      ...blankStep(stage),
      recipeId: cs.recipeId || '',
      chainId: pick.id,
      typeCode: recipeStepType(cs.recipeId),
    }));
}

// Inferred from the recipe's own type, so a preparation sequence does not insert
// three steps all reading "—".
function recipeStepType(recipeId) {
  const rec = recipes.find(x => x.id === recipeId);
  const map = { scour: 'scour', tannin: 'tannin', mordant: 'mordant', dye: 'dye' };
  return map[rec?.typeCode] || '';
}

// The stages as cards, in the order the work went. Runs, not unique stages: a
// second pass through colouring is its own card (§8.0b).
//
// Placements are a card belonging to colouring rather than a panel of their own,
// and shown once even when colouring is entered twice — `placements` is one flat
// list with no link to a step, the known limitation (§8.0e). Shown under the
// FIRST colouring run, because that is where the leaves were laid.
// The preparation the cloth already carries, read from the pieces rather than
// stored on the trial (§13bd).
//
// This card shows and does not hold. Scouring and mordanting are the biography
// of the piece: five pieces prepared in one bath and then dyed separately have
// one preparation between them, and a copy of it inside each trial is the
// duplication that made group work impossible to divide.
//
// Actions are grouped by their batch, because one bath is one line here however
// many pieces were in it.
async function preparationCard(r) {
  const pieces = (await all('fabrics')).filter(f => (r.fabricIds || []).includes(f.id));
  if (!pieces.length && !(r.steps || []).some(st => stageOf(st) === 'prep')) return '';

  const byBatch = new Map();
  for (const f of pieces) {
    for (const a of f.actions || []) {
      if (a.actionCode === 'dye' || a.actionCode === 'finish') continue;
      const key = a.batchId || a.id;
      const row = byBatch.get(key) || { ...a, pieces: [] };
      row.pieces.push(f);
      byBatch.set(key, row);
    }
  }

  const rows = (await Promise.all([...byBatch.values()]
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
    .map(async a => {
      const recipe = a.recipeId ? recipes.find(x => x.id === a.recipeId) : null;
      const shared = a.pieces.length > 1
        ? `<span class="prepshared">${esc(t('trials.prepShared', { n: a.pieces.length }))}</span>` : '';
      return `
        <li class="prepline"${a.batchId ? ` data-batch="${esc(a.batchId)}" style="cursor:pointer"` : ''}>
          ${icon(PREP_ICONS[a.actionCode] || 'i-flask')}
          <span class="prepwhat">${esc(await label('fabric_action', a.actionCode))}</span>
          <span class="prepwhen">${fmtDate(a.date)}</span>
          <span class="prepwith">${recipe ? esc(text(recipe.name)) : ''}${shared}</span>
        </li>`;
    }))).join('');

  // Not a `.stagecardhead`, deliberately. A stage card is one RUN of steps
  // through a stage, and the deep check counts them to prove that dyeing before
  // a print and again after it stays two passes rather than being collapsed
  // into one. This card is not a run — it holds nothing of this work's own —
  // so counting it as one would have made a real guard report a false number.
  // It said so on the first run.
  return `
    <div class="stagecard prepcard">
      <div class="prepcardhead">
        ${stageIcon('prep')}
        <b>${esc(await label('trial_stage', 'prep'))}</b>
        <span class="spacer"></span>
        ${actionBtn('add', t('trials.addPrep'), 'data-add-prep', 'contextual')}
      </div>
      ${rows
        ? `<ul class="preplist">${rows}</ul>`
        : `<p class="hint">${t('trials.noPrep')}</p>`}
    </div>`;
}

async function stageCards(r) {
  const runs = stageRuns(r.steps);
  // Shown for the bath too, under its own name (§13ap).
  //
  // It used to be eco print only, reasoning that a card headed "plants and
  // prints" asks a question a dye bath never poses. True of the heading and
  // wrong in consequence: the bath was then left with nowhere to record what
  // went into it or what came out, so a madder dyeing produced no swatch, gave
  // nothing to the plant, and could not be found by colour. A placement is
  // *what dyed, in what condition, and what it gave* — the position is only
  // the part of it that belongs to printing, and that part was already behind
  // `isEcoPrint`.
  const wantsPlacements = isEcoPrint(r) || isBath(r) || (r.placements || []).length > 0;
  const firstColour = wantsPlacements ? runs.findIndex(run => run.code === 'colour') : -1;
  const placementsCard = wantsPlacements ? await placementsBlock(r) : '';

  const cards = await Promise.all(runs.map(async (run, n) => {
    const last = run.items[run.items.length - 1].i;
    // Steps that came from one sequence carry a note above the group, not on a
    // step — and it never says "chain": the owner should not have to hold that
    // concept (§8.0e).
    const chainIds = [...new Set(run.items.map(({ st }) => st.chainId).filter(Boolean))];
    const chainNote = chainIds
      .map(id => text(chains.find(x => x.id === id)?.name))
      .filter(Boolean)
      .map(name => `<div class="fromchain">${esc(t('trials.fromChain', { name }))}</div>`).join('');

    return `
      <div class="stagecard">
        <div class="stagecardhead">
          ${stageIcon(run.code)}
          <b>${esc(await label('trial_stage', run.code))}</b>
          <span class="spacer"></span>
          ${await addActionMenu(run.code, last)}
        </div>
        ${chainNote}
        ${(await Promise.all(run.items.map(({ st, i }) => stepRow(r, st, i)))).join('')}
        ${n === firstColour ? placementsCard : ''}
      </div>`;
  }));

  // Nothing yet: one button per working stage, so the first action is chosen by
  // what is being done rather than by a type from a list.
  const starters = (await Promise.all(WORK_STAGES.map(async code =>
    `<button class="btn quiet" data-add-step="${code}">+ ${esc(await label('trial_stage', code))}</button>`
  ))).join('');

  // Reachable before any colouring step exists — and, for a bath, before
  // anything at all has been written. The condition used to require a placement
  // already to be there, which is fine for leaves recorded from a photograph
  // and useless for a dye bath: there was no way to add the first one (§13ap).
  const orphan = wantsPlacements && firstColour === -1
    && ((r.placements || []).length || isBath(r))
    ? `<div class="stagecard">${placementsCard}</div>` : '';

  return `
    ${await preparationCard(r)}
    ${cards.join('')}
    ${orphan}
    ${runs.length ? '' : `<p class="hint">${t('trials.noStepsYet')}</p>`}
    <div class="stagestarters">${starters}</div>`;
}

// One step, one line, readable from a metre away over a scale. Everything the
// step carries opens in place, one at a time.
// A warning from a scaled recipe names its ingredient rather than a substance.
const nameOfRole = async (w) =>
  text(w.ingredient?.option?.name) || (w.ingredient?.roleCode
    ? await label('ingredient_role', w.ingredient.roleCode) : '\u2014');

async function stepRow(r, st, i) {
  const open = openStep === st.id;
  const recipe = st.recipeId ? recipes.find(x => x.id === st.recipeId) : null;
  // The ceilings, checked here rather than only on the recipe (§13ah). Shown on
  // the closed line as well as inside: a warning that only appears once the
  // step is opened is silent at exactly the moment it matters, because the step
  // being worked is usually the one that is shut.
  const warns = trialStepWarnings(st, {
    recipe, substancesById: new Map(substances.map(x => [x.id, x])),
    weightG: r.weightOfGoodsG,
  });
  const chain = st.chainId ? chains.find(x => x.id === st.chainId) : null;
  const times = [
    st.tempC != null ? `${st.tempC}\u00B0` : '',
    st.heldMinutes ? `${st.heldMinutes}\u2032` : '',
    st.restMinutes ? `${st.restMinutes}\u2032 ${t('trials.restShort')}` : '',
  ].filter(Boolean).join('  ');

  const summary = `
    <div class="steplinerow">
      <button class="stepline" data-step-open="${esc(st.id)}" aria-expanded="${open}">
        <span class="stepnum">${i + 1}</span>
        <span class="steptype">${esc(await label('step_type', st.typeCode) || t('trials.stepType'))}</span>
        <span class="steprecipe">${esc(text(recipe?.name) || (st.recipeId ? '' : t('trials.improvised')))}</span>
        <span class="steptimeline">${esc(times)}</span>
        ${warns.length ? `<span class="stepwarn${warns.every(w => w.kind === 'warn') ? ' soft' : ''}" title="${esc(warns.map(w =>
          `${text(w.substance?.name) || ''} ${w.value} > ${w.limit}`).join(' · '))}">!</span>` : ''}
      </button>
      <button class="btn quiet" data-step-del="${i}" aria-label="\u00D7">\u00D7</button>
    </div>`;

  if (!open) return summary;

  // Recipes only. A sequence is inserted expanded, so offering it here as well
  // would be the same thing twice, and would let one step "become" a sequence.
  const recipeOptions = `<option value="">${t('trials.improvised')}</option>` +
    recipes.map(x => `<option value="r:${x.id}"${st.recipeId === x.id ? ' selected' : ''}>${esc(text(x.name))}</option>`).join('');

  const m = st.mediumMod;
  const substanceOptions = `<option value="">\u2014</option>` + substances.map(x =>
    `<option value="${x.id}"${x.id === m?.materialId ? ' selected' : ''}>${esc(text(x.name))}</option>`).join('');

  const warnHtml = (await Promise.all(warns.map(async (w) => {
    const name = esc(text(w.substance?.name) || await nameOfRole(w));
    if (w.code === 'over_max_temp')
      return note(t('trials.warn.maxTemp', { name, value: w.value, limit: w.limit }), 'error');
    if (w.code === 'near_max_temp')
      return note(t('trials.warn.nearTemp', { name, value: w.value, limit: w.limit }), 'warn');
    if (w.code === 'over_max_wof')
      return note(t('trials.warn.maxWof', { name, value: w.value, limit: w.limit }), 'error');
    return '';
  }))).join('');

  return `
    ${summary}
    <div class="stepopen">
      ${warnHtml}
      <div class="stepgrid">
        <select data-step="${i}.typeCode">${await options('step_type', st.typeCode, t('trials.stepType'))}</select>
        <select data-step="${i}.stageCode" title="${esc(t('trials.stage'))}">${await options('trial_stage', stageOf(st))}</select>
        <select data-step="${i}.source">${recipeOptions}</select>
        <button class="btn quiet" data-newrecipe="${i}" title="${esc(t('trials.newRecipe'))}">+</button>
      </div>

      ${chain ? `<p class="hint">${esc(t('trials.fromChain', { name: text(chain.name) }))}</p>` : ''}

      ${stageOf(st) === 'decorate' ? `
        <select data-step="${i}.techniqueId">
          <option value="">${t('trials.noTechnique')}</option>
          ${techniques.map(x => `<option value="${x.id}"${
            x.id === st.techniqueId ? ' selected' : ''}>${esc(text(x.name))}</option>`).join('')}
        </select>` : ''}

      ${['lay_base', 'lay_blanket', 'arrange', 'bundle'].includes(st.typeCode) ? `
        <div class="mediumrow">
          <select data-step="${i}.roleCode">${await options('bundle_role', st.roleCode, t('trials.layerRole'))}</select>
          <input type="text" data-step="${i}.what" value="${esc(st.what || '')}" placeholder="${t('trials.layerWhat')}">
        </div>` : ''}

      ${DYE_STEPS.includes(st.typeCode) ? `
        <div class="stepdyes">${await placementsBlock(r, st.id)}</div>` : ''}

      <div class="steptimefields">
        <label class="inlinefield"><span>${t('trials.temp')}</span>
          <input type="number" step="5" data-step="${i}.tempC" value="${st.tempC ?? ''}"></label>
        <label class="check approxcheck" title="${esc(t('common.approxHint'))}">
          <input type="checkbox" data-step-bool="${i}.tempApprox"${st.tempApprox ? ' checked' : ''}>
          ${t('common.approx')}</label>
        <label class="inlinefield"><span>${t('trials.held')}</span>
          <input type="number" step="5" min="0" data-step="${i}.heldMinutes" value="${st.heldMinutes ?? ''}"></label>
        <label class="inlinefield"><span>${t('trials.rest')}</span>
          <input type="number" step="10" min="0" data-step="${i}.restMinutes" value="${st.restMinutes ?? ''}"></label>
      </div>

      ${m ? `
        <div class="mediumrow">
          <select data-medium="${i}.whereCode">${await options('medium_where', m.whereCode, '\u2014')}</select>
          <select data-medium="${i}.materialId">${substanceOptions}</select>
          <input type="text" data-medium="${i}.amount" value="${esc(m.amount || '')}" placeholder="${t('trials.mediumAmount')}">
          <input type="number" step="0.1" data-medium="${i}.phMeasured" value="${m.phMeasured ?? ''}" placeholder="pH">
          <input type="text" data-medium="${i}.intent" value="${esc(m.intent || '')}" placeholder="${t('trials.mediumIntent')}">
          <button class="btn quiet" data-medium-del="${i}" aria-label="\u00D7">\u00D7</button>
        </div>`
      : `${actionBtn('add', t('trials.addMedium'), `data-medium-add="${i}"`, 'contextual')}`}

      <input type="text" data-step="${i}.note" value="${esc(st.note || '')}" placeholder="${t('common.notes')}">

      ${photoStrip(st.photos, {
        addId: `stepphoto${i}`,
        addAttr: `data-step-photo="${i}"`,
        delAttr: 'data-step-photo-del',
        delValue: (j) => `${i}.${j}`,
      })}
    </div>`;
}

// What the trial says about its mordant, gathered from wherever it was recorded.
//
// Since §13bd that is usually NOT a step of the trial: preparation belongs to
// the cloth, so an ordinary piece of work mentions no mordant at all and the
// mordant sits on the cloth's own biography, with the recipe that was used.
// A matcher that only reads the trial's steps therefore sees nothing on almost
// every real record — which is what it was doing.
//
// Returns `{ code, band }`, either of which may be null. Null means NOT KNOWN,
// and not-known must never be matched against as if it were a value.
function mordantOf(trial, fabricsById) {
  // A recipe's ingredient is a ROLE filled by one of several substances, not a
  // substance — the fixed decision that recipes are roles (§5). So the mordant
  // is found by walking the options of each role, and the quantity is on the
  // option rather than on the role.
  //
  // Written first as if an ingredient named a substance directly, which found
  // nothing on any real recipe and quietly matched everything to one record.
  const fromRecipe = (recipeId, when) => {
    const recipe = recipes.find(r => r.id === recipeId);
    if (!recipe) return null;
    for (const ing of recipe.ingredients || []) {
      if (ing.basis && ing.basis !== 'percent_wof') continue;
      for (const opt of ing.options || []) {
        const sub = substances.find(x => x.id === opt.substanceId);
        if (!sub || sub.category !== 'mordant') continue;
        const pc = opt.qtyMin ?? opt.qtyMax ?? null;
        return { code: sub.mordantTypeCode || null, band: mordantBand(pc, sub), when };
      }
    }
    return null;
  };

  // The trial's own steps first: when mordanting IS the experiment, that is
  // where it lives and it is the more specific answer (§13bd).
  const step = (trial.steps || []).find(x => x.typeCode === 'mordant' && x.recipeId);
  if (step) { const m = fromRecipe(step.recipeId, step.date); if (m) return m; }

  // Otherwise the cloth: the last mordanting on or before the day of the work.
  // Later mordantings belong to work that came after this and must not be read
  // back into it (§13bn).
  const cutoff = trial.date || '';
  let best = null;
  for (const id of trial.fabricIds || []) {
    for (const a of fabricsById.get(id)?.actions || []) {
      if (a.actionCode !== 'mordant' || !a.recipeId) continue;
      if (cutoff && a.date && a.date > cutoff) continue;
      if (!best || (a.date || '') > (best.date || '')) best = a;
    }
  }
  return best ? fromRecipe(best.recipeId, best.date) : null;
}

/**
 * The reference record a placement belongs to.
 *
 * It used to match on plant, part and process and nothing else — so a piece
 * dyed with iron and a piece dyed with alum, on the same plant, attached to the
 * same record. The fixed decision is that combinations match on BANDS, and the
 * band was not being read at all (§13bp).
 *
 * Now every dimension of the key that the trial actually knows must agree. A
 * dimension the trial does not know is not matched against — an unrecorded
 * mordant is not the same as no mordant, and treating it as one would file a
 * result under a condition nobody worked in.
 *
 * Where several records survive, the one agreeing on MORE known dimensions
 * wins: a record naming this mordant and this strength is a better answer than
 * one naming neither, and picking the first would make the order of the seed
 * decide the reference.
 */
// The pH the work was carried out at, if it was recorded.
//
// Read from the step that names one — a modifier applied to the bath or to the
// cloth. Null means not recorded, which is not the same as neutral: an
// unmeasured bath is usually near neutral and sometimes not, and filing an
// unmeasured result under "neutral" would put a guess into the reference.
function phOf(trial) {
  for (const st of trial.steps || []) {
    const code = st.mediumMod?.phCode;
    if (code) return code;
  }
  return null;
}

function matchCombination(placement, trial, fabricsById = new Map()) {
  const mordant = mordantOf(trial, fabricsById);
  const fibreClass = [...new Set((trial.fabricIds || [])
    // `fibreClass` takes a COMPOSITION, not a piece — passing the piece threw
    // on every save, which is the sort of thing a type would have caught and a
    // check did instead.
    //
    // A trial may also name cloth that has since been deleted, and a missing
    // piece is not a piece with no fibres.
    .map(id => { const f = fabricsById.get(id); return f ? fibreClassOf(f.composition || []) : null; })
    .filter(Boolean))];
  const oneFibre = fibreClass.length === 1 ? fibreClass[0] : null;

  let best = null, bestScore = -1;
  for (const c of combinations) {
    const k = c.key || {};
    if (k.dyeSource?.plantId !== placement.plantId) continue;
    if (placement.partCode && k.dyeSource?.partCode !== placement.partCode) continue;
    if (trial.processCode && k.processCode !== trial.processCode) continue;

    let score = 0;
    // Each known dimension may agree (and count) or contradict (and disqualify).
    //
    // pH is among them because it is not a condition of the bath but a MODIFIER
    // OF THE COLOUR: tagetes on cellulose with the same mordant at the same
    // strength gives pale yellow in acid and bright canary in alkali. It has
    // been in the key since the library was seeded, inside `medium`.
    for (const [known, theirs] of [
      [oneFibre, k.fibreClass],
      [mordant?.code, k.mordantCode],
      [mordant?.band, k.mordantBand],
      [phOf(trial), k.medium?.phCode],
    ]) {
      if (known == null || theirs == null) continue;
      if (known !== theirs) { score = -1; break; }
      score++;
    }
    if (score < 0) continue;
    if (score > bestScore) { best = c; bestScore = score; }
  }
  return best;
}

// The leaves, as a card belonging to colouring. Photo-first: at the bundle,
// seeing precedes describing (§8.5).
// A bath: the dyestuff is in the pot rather than laid on the cloth. The same
// record, asked in the words of the process.
const isBath = (r) => r.processCode === 'immersion';

// Steps that put colour in a pot. "No recipe" has never meant "no dyestuff",
// but until now the dyestuff could only be named through a recipe's
// ingredients, so a bath written without one had nowhere to say what was in it
// (§13ar). The dyestuff belongs to the step: one trial can hold a tagetes bath
// and a madder bath, and a list hanging off the trial cannot tell them apart.
const DYE_STEPS = ['dye', 'bundle_boil'];

// `stepId` narrows the block to the dyestuffs belonging to one step (§13ar).
// Called with nothing, it shows the ones belonging to no step — the leaves of
// an eco print, which are laid on the cloth rather than put in a pot.
//
// One list, filtered, rather than a second list per step: a placement is a
// placement, and two stores of the same thing drift apart (§13ak).
async function placementsBlock(r, stepId = null) {
  // Forty-eight rows in a dropdown is a list you scroll, not one you choose
  // from. A datalist lets three letters do it, and works with a phone keyboard.
  const plantList = plants
    .map(p => ({ id: p.id, name: text(p.nameCommon) }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // The index is the real one in `r.placements`, because every control below
  // addresses a placement by position. Filtering with `.filter()` would
  // renumber them and the second dye bath would edit the first one's plant.
  const mine = (r.placements || [])
    .map((pl, i) => ({ pl, i }))
    .filter(({ pl }) => (pl.stepId || null) === stepId);

  const rows = (await Promise.all(mine.map(async ({ pl, i }) => {
    const match = matchCombination(pl, r);
    const open = openPlace === (pl.id || String(i));
    const plantName = plants.find(x => x.id === pl.plantId);
    // The closed line says the three things that tell one placement from
    // another: which plant, which part, and what is expected of it.
    const line = [
      text(plantName?.nameCommon) || (isBath(r) ? t('trials.pickDyestuff') : t('trials.pickPlant')),
      pl.partCode ? await label('plant_part', pl.partCode) : '',
      text(match?.expected?.colourText) || '',
    ].filter(Boolean);
    const summary = `
      <div class="placeline">
        <button class="stepline" data-place-open="${esc(pl.id || String(i))}" aria-expanded="${open}">
          <span class="placedot">${pl.photo
            ? `<img src="${pl.photo}" alt="">`
            : `<span class="thumb empty"></span>`}</span>
          <span class="steptype">${esc(line[0])}</span>
          <span class="steprecipe">${esc(line.slice(1).join(' \u00B7 '))}</span>
        </button>
        <button class="btn quiet" data-place-del="${i}" aria-label="\u00D7">\u00D7</button>
      </div>`;
    if (!open) return summary;
    return summary + `
      <div class="placement${isBath(r) ? ' nophoto' : ''}">
        <div class="placephoto">
          ${pl.photo
            ? `<img src="${pl.photo}" alt=""><button class="btn quiet" data-place-photo-del="${i}">\u00D7</button>`
            : `<label class="addphoto" for="placephoto${i}">+</label>
               <input type="file" id="placephoto${i}" data-place-photo="${i}" accept="image/*" hidden>`}
        </div>

        <div class="placebody">
          <div class="placemain">
            ${pickerInput({ listId: 'plantlist', attr: 'place', index: i, field: 'plantId',
                            selectedId: pl.plantId, items: plantList,
                            placeholder: t('trials.pickPlant') })}
            <select data-place="${i}.partCode">${await options('plant_part', pl.partCode, t('trials.part'))}</select>
            <select data-place="${i}.condition">${await options('placement_condition', pl.condition, t('trials.condition'))}</select>
          </div>

          ${isEcoPrint(r) ? `
            <div class="placemain">
              <select data-place="${i}.facing">${await options('facing', pl.facing, t('trials.facing'))}</select>
              <select data-place="${i}.printQuality">${await options('print_quality', pl.printQuality, t('trials.printQuality'))}</select>
              <input type="text" data-place="${i}.localTreatment" value="${esc(pl.localTreatment || '')}" placeholder="${t('trials.localPlaceholder')}">
            </div>` : ''}

          <textarea data-place="${i}.observation" rows="2" placeholder="${t('trials.observationPlaceholder')}">${esc(pl.observation || '')}</textarea>

          ${pl.plantId ? (match
            ? `<p class="hint matched">${t('trials.matched')}: ${esc(text(match.expected?.colourText) || '\u2014')}</p>`
            : `<p class="hint">${t('trials.noMatch')}</p>`) : ''}
        </div>
      </div>`;
  }))).join('');

  return `
    <div class="placeblock">
      <div class="stagecardhead sub">
        ${icon('i-plant')}
        <b>${isBath(r) ? t('trials.dyestuffs') : t('trials.placements')}</b>
        <span class="spacer"></span>
        ${actionBtn('add', 
          isBath(r) ? t('trials.addDyestuff') : t('trials.addPlacement'), `data-place-add="${esc(stepId || '')}"`, 'contextual')}
      </div>
      ${rows || `<p class="hint">${isBath(r) ? t('trials.dyestuffsHint') : t('trials.photoFirst')}</p>`}
      ${(r.placements || []).length > 1 && stageRuns(r.steps).filter(x => x.code === 'colour').length > 1
        ? `<p class="hint">${t('trials.placementsOncePerTrial')}</p>` : ''}
    </div>`;
}

// ------------------------------------------------------------- read view
//
// A finished trial is read far more often than it is written, and what one
// wants from it is a story: these plants, on this cloth, through these steps,
// with this result. The editing form answers a different question.

// ------------------------------------------------- 5 · reviewing finished work
//
// The result IS the screen (§8.0e): the photograph, the verdict, the swatches,
// whether it would be repeated. The process folds underneath and opens as the
// same stepped story, read-only — collapsed, not hidden, so the summary says what
// is inside.
async function renderReview(root, r) {
  const fabrics = await all('fabrics');
  const cloth = fabricLine(r, fabrics);
  const sw = trialSwatches(r, 8);

  const hero = cover(r, fabrics);

  // The whole of the work in pictures, in the order it happened — the same
  // strip the cloth has had since §8.0c, which the trial itself never got. Its
  // absence is why reading how a piece developed meant opening every step in
  // turn (§13ag). The cloth's own shot is included: it is where the piece
  // started, and a strip that begins after the first bath does not show a
  // change.
  //
  // EVERY piece of work on this cloth up to and including this one, not this
  // one alone (§13bn). A scarf that has been through two eco prints showed the
  // raw cloth and the final result and nothing between: from the strip there
  // was no way to tell it had been printed before. The earlier print IS how
  // this one started, and leaving it out makes a second print look like a
  // first.
  //
  // Cut off after this work rather than showing everything the cloth ever
  // became: reading a finished record should not show what happened to the
  // cloth afterwards, which had not happened when this was written.
  const piece = fabrics.find(f => (r.fabricIds || []).includes(f.id)) || {};
  const byDate = (a, b) => (a.date || '').localeCompare(b.date || '')
    || (a.createdAt || '').localeCompare(b.createdAt || '');
  const onThisCloth = (await all('trials'))
    .filter(tr => (tr.fabricIds || []).includes(piece.id))
    .sort(byDate);
  const upToHere = onThisCloth.slice(0, Math.max(1, onThisCloth.findIndex(tr => tr.id === r.id) + 1));

  const shots = photoTimeline(piece, upToHere);
  const earlier = upToHere.length > 1;

  const strip = shots.length > 1 ? `
    <div class="lifestrip">
      ${(await Promise.all(shots.map(async (p) => {
        // Which work a shot belongs to, said only when there is more than one:
        // on a piece worked once the label is noise, on a piece worked twice it
        // is the whole point.
        const from = earlier && p.trialId && p.trialId !== r.id
          ? `<span class="shotfrom">${esc(p.trialTitle || t('trials.earlierWork'))}</span>` : '';
        return `
        <figure class="lifeshot${p.trialId && p.trialId !== r.id ? ' earlier' : ''}">
          <img src="${p.src}" alt="" loading="lazy">
          <figcaption>
            <span>${esc(p.stageCode
              ? await label('trial_stage', p.stageCode)
              : t('fabrics.shot.' + p.kind))}</span>
            <span class="hint">${fmtDate(p.date)}</span>
            ${from}
          </figcaption>
        </figure>`;
      }))).join('')}
    </div>
    ${earlier ? `<p class="hint">${t('trials.nthWork', { n: upToHere.length })}</p>` : ''}` : '';

  const plantNames = (await Promise.all([...new Set((r.placements || []).map(p => p.plantId))]
    .filter(Boolean).map(async id => text(plantsById.get(id)?.nameCommon) || '\u2014'))).join(', ');

  const colourText = (r.placements || []).map(p => p.resultColour).filter(Boolean).join(', ');

  // A mark on each of the four, so the row is scanned rather than read: the
  // plants, the process, what came out, and whether she would do it again
  // (§13bh). The would-do-again mark is the one the prototype gets right — a
  // turning arrow says "again" before the words "yes, with changes" are read.
  const summaryFacts = [
    { label: t('trials.plants'), value: esc(plantNames), mark: 'i-plant' },
    { label: t('trials.process'), value: esc(await label('process', r.processCode)), mark: 'i-beaker' },
    { label: t('trials.result'), value: esc(colourText), mark: 'i-finish' },
    { label: t('trials.repeat'), value: esc(await label('repeat', r.repeat)), mark: 'i-again' },
  ].filter(x => x.value);

  const runs = stageRuns(r.steps);
  const processRows = (await Promise.all(runs.map(async (run) => {
    const bits = [t('trials.nActions', { n: run.items.length })];
    if (run.code === 'colour' && (r.placements || []).length)
      bits.push(t('trials.nPlacements', { n: r.placements.length }));
    const steps = (await Promise.all(run.items.map(({ st, i }) => reviewStep(r, st, i)))).join('');
    return `
      <details class="procrow">
        <summary>
          <span class="procdot">\u2713</span>
          ${stageIcon(run.code)}
          <span class="procname">${esc(await label('trial_stage', run.code))}</span>
          <span class="hint">${esc(bits.join(' \u00B7 '))}</span>
        </summary>
        <div class="procbody">
          ${steps}
          ${run.code === 'colour' ? await reviewPlacements(r) : ''}
        </div>
      </details>`;
  }))).join('');

  const head = `
    <div class="procrow fixed">
      <span class="procdot">\u2713</span>
      ${stageIcon('raw')}
      <span class="procname">${esc(await label('trial_stage', 'raw'))}</span>
      <span class="hint">${esc(cloth || '\u2014')}</span>
    </div>`;

  const tail = `
    <div class="procrow fixed">
      <span class="procdot">\u2713</span>
      ${stageIcon('done')}
      <span class="procname">${esc(await label('trial_stage', 'done'))}</span>
      <span class="hint">${fmtDate(shownDate(r))}</span>
    </div>`;

  root.innerHTML = page({
    title: r.title || t('trials.one'),
    sub: `${fmtDate(shownDate(r))} \u00B7 ${esc(await label('trial_status', statusOf(r)))}`,
    // The result is editable too. Screen 4 was reachable only on the way to
    // finishing, so once a piece was finished the five questions — and the
    // colour that carries the result to the plant and the reference — could not
    // be corrected at all (§13as). One screen owns finishing (§13an); it must
    // therefore be reachable after it, not only before.
    actions: `${backTo('#/trials', t('nav.trials'))}
              <button class="btn quiet" data-refinish>${t('trials.editResult')}</button>
              ${actionBtn('edit', t('trials.editHistory'), 'data-edit', 'primary')}`,
    body: `
      <div class="workcol">
        <div class="reviewhero">
          ${hero ? `<img src="${hero}" alt="">`
                  : `<span class="trialnophoto">${esc(await label('process', r.processCode))}</span>`}
          ${r.assessment ? `<span class="statuschip ${esc(r.assessment)} onphoto">${esc(await label('assessment', r.assessment))}</span>` : ''}
        </div>

        ${sw.length ? `<div class="reviewswatches">${sw.map(x => `
          <span class="reviewswatch">
            <span class="swatchblock" style="background:${esc(x.hex)}"></span>
            ${x.caption ? `<span class="hint">${esc(x.caption)}</span>` : ''}
          </span>`).join('')}</div>` : ''}

        ${strip ? panel(readBlock(t('trials.lifeStrip'), strip)) : ''}

        ${summaryFacts.length ? panel(`<div class="reviewfacts">${summaryFacts.map(f => `
          <div class="reviewfact">
            <span class="factvalue">${f.value}</span>
            <span class="factlabel">${f.mark ? icon(f.mark) : ''}${esc(f.label)}</span>
          </div>`).join('')}</div>`) : ''}

        ${r.assessmentWhy || r.nextTime || r.intent || r.notes ? panel(`
          <div class="story">
            ${r.intent ? `<div class="storypart">
              <h3>${esc(t('trials.intent'))}</h3>
              <div class="prose"><p>${esc(r.intent)}</p></div>
            </div>` : ''}
            ${r.intent && r.assessmentWhy ? `<div class="storythen">${icon('i-then')}</div>` : ''}
            ${r.assessmentWhy ? `<div class="storypart">
              <h3>${esc(t('trials.whatHappened'))}</h3>
              <div class="prose"><p>${esc(r.assessmentWhy)}</p></div>
            </div>` : ''}
          </div>
          ${r.nextTime ? `<div class="storypart apart">
            <h3>${esc(t('trials.nextTime'))}</h3>
            <div class="prose"><p>${esc(r.nextTime)}</p></div>
          </div>` : ''}
          ${r.notes ? `<div class="storypart apart quiet">
            <h3>${esc(t('common.notes'))}</h3>
            <div class="prose"><p>${esc(r.notes)}</p></div>
          </div>` : ''}
        `) : ''}

        <details class="processfold"${processOpen ? ' open' : ''} data-process>
          <summary><span class="foldtitle">${t('trials.showProcess')}</span>
            <span class="hint">${esc(t('trials.nStages', { n: runs.length }))}</span></summary>
          <div class="foldbody">
            ${head}
            ${processRows || `<p class="hint">${t('trials.noStepsYet')}</p>`}
            ${tail}
          </div>
        </details>
      </div>`,
  });
}

// One step, read-only, in the same shape the working screen shows it closed.
async function reviewStep(r, st, i) {
  const recipe = st.recipeId ? recipes.find(x => x.id === st.recipeId) : null;
  const chain = st.chainId ? chains.find(x => x.id === st.chainId) : null;
  const m = st.mediumMod;
  const sub = substances.find(x => x.id === m?.materialId);
  const times = [
    st.tempC != null ? `${st.tempC}\u00B0` : '',
    st.heldMinutes ? `${st.heldMinutes}\u2032` : '',
    st.restMinutes ? `${st.restMinutes}\u2032 ${t('trials.restShort')}` : '',
  ].filter(Boolean).join('  ');

  return `
    <div class="stepline read">
      <span class="stepnum">${i + 1}</span>
      <span class="steptype">${esc(await label('step_type', st.typeCode) || '\u2014')}</span>
      <span class="steprecipe">${esc(text(recipe?.name) || '')}</span>
      <span class="steptimeline">${esc(times)}</span>
    </div>
    ${st.what ? `<p class="hint indent">${esc(st.what)}</p>` : ''}
    ${m ? `<p class="hint indent">${esc(await label('medium_where', m.whereCode))}: ${
      esc(text(sub?.name) || '\u2014')} ${esc(m.amount || '')}${m.phMeasured ? ` \u00B7 pH ${m.phMeasured}` : ''}${
      m.intent ? ` \u2014 ${esc(m.intent)}` : ''}</p>` : ''}
    ${st.note ? `<p class="hint indent">${esc(st.note)}</p>` : ''}
    ${(st.photos || []).length ? `<div class="stepphotos indent">${
      st.photos.map(src => `<div class="stepphoto"><img src="${src}" alt=""></div>`).join('')
    }</div>` : ''}`;
}

async function reviewPlacements(r) {
  const rows = (await Promise.all((r.placements || []).map(async pl => {
    const plant = plantsById.get(pl.plantId);
    const bits = [
      pl.partCode ? await label('plant_part', pl.partCode) : '',
      pl.condition ? await label('placement_condition', pl.condition) : '',
      pl.facing ? await label('facing', pl.facing) : '',
      pl.printQuality ? await label('print_quality', pl.printQuality) : '',
      pl.localTreatment || '',
    ].filter(Boolean).join(' \u00B7 ');
    const combo = matchCombination(pl, r);
    return `
      <div class="placement read">
        ${pl.photo ? `<div class="placephoto"><img src="${pl.photo}" alt=""></div>` : ''}
        <div class="placebody">
          <b>${esc(text(plant?.nameCommon) || '\u2014')}</b>
          ${bits ? `<div class="hint">${esc(bits)}</div>` : ''}
          ${pl.resultColour ? `<div class="factvalue">
            ${pl.resultHex ? `<span class="miniswatch" style="background:${esc(pl.resultHex)}"></span> ` : ''}
            ${esc(pl.resultColour)}</div>` : ''}
          ${pl.observation ? `<div class="prose"><p>${esc(pl.observation)}</p></div>` : ''}
          ${combo ? `<div class="hint">${t('trials.expected')}: ${esc(text(combo.expected?.colourText) || '\u2014')}</div>` : ''}
        </div>
      </div>`;
  }))).join('');
  return rows ? `<div class="placeblock read">${rows}</div>` : '';
}

// ---------------------------------------------------------------- the form

// ---------------------------------------------------------------- 4 · finishing
//
// Its own screen rather than a field at the bottom of a form (§8.0e). Five
// questions, all over fields that already exist — `resultPhotos`, the
// placements' own `resultColour`, `assessment`, `assessmentWhy`, `repeat`,
// `nextTime`, and the cloth's `stateEvents`.
//
// The state the finished work implies, offered already chosen (§13al).
//
// It used to offer "leave the state as it is" first and selected, so finishing
// a piece of work and touching nothing left the cloth where it started: the
// owner finished a garment and the cloth stayed *mordanted*, appearing at once
// under "finished work" and under "ready to work" on the same screen. The
// specification (§8.0e, question five) says this screen changes the state of
// the cloth; the screen defaulted to not doing it.
//
// `finished` rather than `dyed`, because screen 4 is where work on a piece
// ends. A piece that is only part-way — dyed now, printed next week — is the
// case for choosing `dyed` deliberately, and doing nothing is still available,
// but it is now a choice rather than the absence of one.
const impliedState = (r) => (r.processCode ? 'finished' : '');
//
// The colour is asked per placement, not per trial, because that is where
// `resultColour` lives — and it puts the reference's expectation on the same
// line as what actually came out, which is the comparison the whole library
// exists for.
// The day the cloth changed state. Almost always the day the work finished, so
// it opens there rather than at today — it was fixed at `today()` and silently
// re-dated the piece every time the result was edited (§13au). Kept separate:
// a bundle opened a week after the print is a real case.
function stateStamp(r, pieces) {
  const mine = pieces.flatMap(f => (f.actions || []).filter(a => a.trialId === r.id));
  return mine.length ? mine[mine.length - 1].date : (r.finishedOn || r.date || today());
}

async function renderFinish(root, r) {
  const fabrics = await all('fabrics');
  const pieces = (r.fabricIds || []).map(id => fabrics.find(f => f.id === id)).filter(Boolean);

  const photos = (r.resultPhotos || []).map((src, i) => `
    <div class="resultphoto"><img src="${src}" alt="">
      <button class="btn quiet" data-photo-del="${i}">×</button></div>`).join('');

  const colourRows = (await Promise.all((r.placements || []).map(async (pl, i) => {
    const plant = plantsById.get(pl.plantId);
    const match = matchCombination(pl, r);
    return `
      <div class="finishcolour">
        <span class="workthumb">${pl.photo
          ? `<img src="${pl.photo}" alt="">`
          : `<span class="thumb empty"></span>`}</span>
        <span class="finishwho">
          <b>${esc(text(plant?.nameCommon) || '—')}</b>
          ${pl.partCode ? `<span class="hint">${esc(await label('plant_part', pl.partCode))}</span>` : ''}
          ${match ? `<span class="hint">${t('trials.expected')}: ${esc(text(match.expected?.colourText) || '—')}</span>` : ''}
        </span>
        <input type="text" data-place="${i}.resultColour" value="${esc(pl.resultColour || '')}"
               placeholder="${t('trials.resultColour')}">
        <input type="color" data-place="${i}.resultHex" value="${esc(pl.resultHex || '#8C7B6B')}"
               title="${esc(t('trials.resultHex'))}">
      </div>`;
  }))).join('') || `<p class="hint">${t('trials.noPlacementsYet')}</p>`;

  const q = (n, ask, inner, hint = '') => `
    <div class="finishq">
      <span class="finishnum">${n}</span>
      <div class="finishbody">
        <div class="finishask">${esc(ask)}</div>
        ${inner}
        ${hint ? `<p class="hint">${esc(hint)}</p>` : ''}
      </div>
    </div>`;

  root.innerHTML = page({
    title: t('trials.finishTitle'),
    sub: r.title || fmtDate(r.date),
    actions: `${backTo('#/trials', t('nav.trials'))}`,
    body: panel(`
      <div class="finishwhen">
        <label class="field">
          <span class="fieldlabel">${t('trials.finishedOn')}</span>
          <input type="date" data-f="finishedOn" value="${esc(r.finishedOn || r.date || today())}">
        </label>
        <p class="hint">${t('trials.finishedOnHint')}</p>
      </div>

      ${q(1, t('trials.qLooks'), `
        <div class="resultphotos">
          <label class="addphoto big" for="resultphoto">+</label>
          ${photos}
        </div>
        <input type="file" id="resultphoto" accept="image/*" multiple hidden>`)}

      ${q(2, t('trials.qColour'), colourRows)}

      ${q(3, t('trials.qHowWent'),
        await segmented('assessment', 'assessment', r.assessment, { allowEmpty: false }) +
        `<textarea data-f="assessmentWhy" rows="2" placeholder="${t('trials.qWhy')}">${esc(r.assessmentWhy || '')}</textarea>`)}

      ${q(4, t('trials.qAgain'),
        await segmented('repeat', 'repeat', r.repeat, { allowEmpty: false }) +
        `<textarea data-f="nextTime" rows="2" placeholder="${t('trials.nextTimePlaceholder')}">${esc(r.nextTime || '')}</textarea>`)}

      ${q(5, t('trials.qCloth'), pieces.length ? `
        <div class="finishstate">
          <select data-newstate>
            ${(await terms('fabric_state')).map(v =>
              `<option value="${v.code}"${v.code === impliedState(r) ? ' selected' : ''}>${esc(text(v.label))}</option>`).join('')}
            <option value="">${t('trials.leaveState')}</option>
          </select>
          <input type="date" data-statedate value="${esc(stateStamp(r, pieces))}">
        </div>
        <p class="hint">${esc(pieces.map(f => `${f.label ? f.label + ' ' : ''}${f.name || '—'}`).join(' · '))}</p>`
        : `<p class="hint">${t('trials.noCloth')}</p>`,
        pieces.length > 1 ? t('trials.stateAllPieces') : '')}

      <div class="btnrow end">
        <button class="btn primary" data-finish-save>${t('trials.saveAndFinish')}</button>
      </div>
    `),
  });
}

// ----------------------------------------------------- 3 · the active trial
//
// One column, because the order is the work (§8.0e). The form was six panels
// side by side, one per corner of the record, which made administering the record
// look like the main thing one does with it.
async function renderWork(root, r) {
  const isNew = openId === 'new';
  const fabrics = await all('fabrics');
  const finished = statusOf(r) === 'complete';

  const cloth = fabricLine(r, fabrics);

  // Work pointing at no cloth. It cannot change a state, cannot be filed under
  // a piece, and takes no part in the life of anything — yet it looks like an
  // ordinary record. Folding the strip that holds the answer is right when the
  // cloth is chosen and exactly wrong when it is not, so the one case where the
  // question is unanswered is the one case the panel opens itself (§13ao).
  const noCloth = !isNew && !(r.fabricIds || []).length;

  // The strip states what is inside it, so folding it away is not hiding it.
  const contextChips = [
    r.water?.sourceCode ? await label('water_source', r.water.sourceCode) : '',
    r.processCode ? await label('process', r.processCode) : '',
    (r.enhancements || []).length ? t('plants.filled', { n: r.enhancements.length }) : '',
    (r.techniqueIds || []).length ? t('plants.filled', { n: r.techniqueIds.length }) : '',
    cloth,
  ].filter(Boolean);

  const enh = (await Promise.all(ENHANCEMENTS.map(async c => `
    <label class="check"><input type="checkbox" data-multi="enhancements" value="${c}"
      ${(r.enhancements || []).includes(c) ? 'checked' : ''}>
      ${esc(await label('enhancement', c))}</label>`))).join('');

  const fabricChecks = fabrics.map(f => `
    <label class="check"><input type="checkbox" data-multi="fabricIds" value="${f.id}"
      ${(r.fabricIds || []).includes(f.id) ? 'checked' : ''}>
      ${esc(f.label ? f.label + ' \u00B7 ' : '')}${esc(f.name || '\u2014')}</label>`).join('')
    || `<p class="hint">\u2014</p>`;

  const techChecks = techniques.map(x => `
    <label class="check"><input type="checkbox" data-multi="techniqueIds" value="${x.id}"
      ${(r.techniqueIds || []).includes(x.id) ? 'checked' : ''}>
      ${esc(text(x.name))}</label>`).join('') || `<p class="hint">\u2014</p>`;

  root.innerHTML = page({
    title: isNew ? t('trials.newWork') : (r.title || t('trials.one')),
    sub: fmtDate(r.date),
    actions: `
      ${!isNew && !finished ? `<button class="btn quiet" data-finish>${t('trials.finish')}</button>` : ''}
      ${backTo('#/trials', t('nav.trials'))}
      <button class="btn primary" data-save>${t('common.save')}</button>`,
    body: `
      <div class="workcol">
        <div class="workhead">
          <input type="text" class="worktitle" data-f="title" value="${esc(r.title || '')}"
                 placeholder="${t('trials.titlePlaceholder')}">
          <div class="workheadmeta">
            <input type="date" data-f="date" value="${esc(r.date || '')}">
            ${await segmented('trial_status', 'status', statusOf(r), { allowEmpty: false })}
          </div>
        </div>

        ${!isNew ? `<div class="workprogfull">${await progressLine(r)}</div>` : ''}

        ${r.groundFrom ? panel(`
          <h2>${t('trials.ground')}</h2>
          <div class="groundrow">
            ${r.groundFrom.photo
              ? `<img class="groundshot" src="${r.groundFrom.photo}" alt="">`
              : '<span class="thumb empty"></span>'}
            <div>
              <p class="note">${t('trials.groundHint')}</p>
              <button class="btn quiet" data-open-ground="${esc(r.groundFrom.trialId)}">
                ${esc(r.groundFrom.title || t('trials.one'))}${r.groundFrom.date ? ` · ${fmtDate(r.groundFrom.date)}` : ''}
              </button>
              ${(r.groundFrom.swatches || []).length ? `<span class="swatchrow">${
                r.groundFrom.swatches.map(hex =>
                  `<span class="miniswatch" style="background:${esc(hex)}"></span>`).join('')}</span>` : ''}
            </div>
          </div>`) : ''}

        ${panel(`
          ${field(t('trials.intent'),
            `<textarea data-f="intent" rows="2" placeholder="${t('trials.intentPlaceholder')}">${esc(r.intent || '')}</textarea>`,
            t('trials.intentHint'))}
          ${fieldGroup(t('trials.planPhotos'),
            photoStrip(r.planPhotos, {
              addId: 'planphoto',
              addAttr: 'data-plan-photo',
              delAttr: 'data-plan-photo-del',
            }),
            t('trials.planPhotosHint'))}
        `)}

        <details class="contextstrip${noCloth ? ' needsattention' : ''}"${contextOpen || noCloth ? ' open' : ''} data-context>
          <summary>
            <span class="foldtitle">${t('trials.aboutThisWork')}</span>
            ${noCloth ? `<span class="chip warn">${t('trials.noClothChip')}</span>` : ''}
            ${contextChips.map(c => `<span class="chip">${esc(c)}</span>`).join('')}
          </summary>
          <div class="foldbody">
            ${field(t('trials.process'), `<select data-f="processCode">${await options('process', r.processCode, '')}</select>`)}
            ${r.processCode === 'paste' ? note(t('trials.pasteNotYet'), 'warn') : ''}
            ${noCloth ? note(t('trials.noClothWhy'), 'warn') : ''}
            ${fieldGroup(t('trials.fabrics'), `<div class="checks column">${fabricChecks}</div>`)}
            ${field(t('trials.weightOfGoods'), `<input type="number" step="1" min="0" data-f="weightOfGoodsG" value="${r.weightOfGoodsG ?? ''}">`, t('trials.weightHint'))}
            ${field(t('trials.waterSource'), `<select data-f="water.sourceCode">${await options('water_source', r.water?.sourceCode)}</select>`)}
            ${field(t('trials.waterNote'), `<input type="text" data-f="water.note" value="${esc(r.water?.note || '')}" placeholder="${t('trials.waterPlaceholder')}">`)}
            ${fieldGroup(t('trials.enhancements'), `<div class="checks">${enh}</div>`, t('trials.enhancementsWhat'))}
            ${fieldGroup(t('trials.techniques'), `<div class="checks">${techChecks}</div>`)}
          </div>
        </details>

        ${await stageCards(r)}

        ${panel(`
          ${field(t('common.notes'), `<textarea data-f="notes" rows="3">${esc(r.notes || '')}</textarea>`)}
          ${!isNew ? `${actionBtn('delete', t('trials.delete'), 'data-delete', 'destructive')}` : ''}
        `)}
      </div>`,
  });
}

// ----------------------------------------------------------------- reading

function readWork(root) {
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

  // Only from a screen that actually offers the choice. Rebuilding these from
  // whatever is on screen is the same fault the note below describes about
  // steps, and it had the same consequence: screen 4 renders no cloth
  // checkboxes, so finishing a piece of work emptied `fabricIds` — and the loop
  // that writes the cloth's new state then had nothing to write to. The
  // symptom was a finished garment still listed as mordanted (§13al).
  for (const name of ['enhancements', 'fabricIds', 'techniqueIds']) {
    const boxes = root.querySelectorAll(`[data-multi="${name}"]`);
    if (!boxes.length) continue;
    draft[name] = [];
    for (const el of boxes) {
      if (el.checked) draft[name].push(el.value);
    }
  }

  // Patched in place, never rebuilt from the screen.
  //
  // This used to collect only the rows it found and replace the array with them.
  // That was safe while every step rendered all its fields — and became data loss
  // the moment steps started rendering collapsed (§8.0e): a trial with five steps
  // and one open would have been written back with one step. A reader that treats
  // the screen as the whole truth is only correct by accident.
  const patchList = (attr, existing = []) => {
    const rows = (existing || []).map(x => ({ ...x }));
    for (const el of root.querySelectorAll(`[data-${attr}]`)) {
      const [i, key] = el.dataset[attr].split('.');
      const idx = Number(i);
      if (!rows[idx]) continue;
      let value = el.value;
      if (el.type === 'number') value = value === '' ? null : Number(value);
      rows[idx][key] = value;
    }
    // A checkbox has a value whether or not it is ticked, so it cannot go
    // through the loop above — `el.value` on an unticked box is still "on".
    for (const el of root.querySelectorAll(`[data-${attr}-bool]`)) {
      const [i, key] = el.dataset[attr + 'Bool'].split('.');
      if (rows[Number(i)]) rows[Number(i)][key] = el.checked;
    }
    return rows;
  };

  draft.placements = patchList('place', draft.placements);

  const steps = patchList('step', draft.steps);
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
    pl.combinationId = matchCombination(pl, draft, fabricsById)?.id || null;
  }
}

// ------------------------------------------------------------------ module

export default {
  id: 'trials',
  title: () => t('trials.title'),
  sub: () => t('trials.sub'),

  reset() {
    openId = null; draft = null; screen = null; openStep = null; openPlace = null;
    filter = { plantId: '', processCode: '' };
    newFabric = { name: '', weightG: null, composition: [] };
    contextOpen = false; processOpen = false;
  },

  // Opened by the router when the address names something (§8.0c). Every screen
  // of the working flow has an address, so the back button, a reload and a
  // bookmark all agree with what is on the screen.
  //   #/trials/new              → screen 2, choose the cloth
  //   #/trials/new/<fabricId>   → screen 3, the cloth already chosen
  //   #/trials/<id>             → screen 3, or 5 when the work is finished
  //   #/trials/<id>/work        → screen 3 forced open on finished work
  //   #/trials/<id>/finish      → screen 4
  open(arg, second = null) {
    openId = arg;
    draft = null;
    openStep = null;
    openPlace = null;
    handoff = arg === 'new' ? second : null;
    screen = arg === 'new' ? null : (second || null);
  },

  async render(root) {
    plants = (await all('plants')).sort((a, b) => text(a.nameCommon).localeCompare(text(b.nameCommon)));
    plantsById = new Map(plants.map(p => [p.id, p]));
    recipes = await all('recipes');
    techniques = await all('techniques');
    chains = await all('chains');
    substances = await all('substances');
    combinations = await all('combinations');
    fabricsById = new Map((await all('fabrics')).map(f => [f.id, f]));

    // Screen 2: choosing the cloth. `#/trials/new` with nothing after it asks the
    // question; `#/trials/new/<fabricId>` has already been answered and goes
    // straight through, which is the handoff from the cloth itself (§8.0c).
    if (openId === 'new' && !handoff && !draft) {
      await renderNew(root);
    } else if (openId) {
      if (!draft || (openId !== 'new' && draft.id !== openId)) {
        const found = openId === 'new' ? blank() : await get('trials', openId);
        // A link to a record that has since been deleted, or a mistyped
        // address. Falling back to the list is the whole recovery: a blank
        // screen with nothing on it is the worst outcome this app has.
        if (!found) { openId = null; screen = null; draft = null; return this.render(root); }
        draft = structuredClone(found);
        if (openId === 'new' && handoff) {
          const cloth = await get('fabrics', handoff);
          if (cloth) {
            draft.fabricIds = [cloth.id];
            draft.title = cloth.name || cloth.label || '';
            if (cloth.weightG) draft.weightOfGoodsG = cloth.weightG;
            draft.status = 'in_progress';  // the cloth is in hand; this is not a daydream

            // Work on a piece that has been worked before starts from what the
            // piece has become, not from raw cloth (§13am). "Finished" is a
            // state of a run, never the end of the cloth: a printed shawl can
            // be re-mordanted and printed over.
            //
            // The ground is recorded rather than left to memory, because it
            // changes what the reference can honestly predict. Oak on white
            // silk and oak on a shawl already printed rust are not the same
            // question, and a combination matched against the second while
            // keyed on the first would be answering the wrong one.
            const earlier = (await all('trials'))
              .filter(x => (x.fabricIds || []).includes(cloth.id) && statusOf(x) === 'complete')
              .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
            const previous = earlier[earlier.length - 1];
            if (previous) {
              const shots = photoTimeline(cloth, [previous]);
              draft.groundFrom = {
                trialId: previous.id,
                title: previous.title || '',
                date: previous.date || '',
                // The last photograph of the previous run is the first
                // photograph of this one: it is literally what is in the hand
                // when the new work begins.
                photo: shots.length ? shots[shots.length - 1].src : null,
                swatches: trialSwatches(previous).map(x => x.hex),
              };
            }
          }
          handoff = null;
        }
      }
      // Which screen the record gets is decided by the record plus the address,
      // never by a flag: finished work is reviewed, unfinished work is worked on.
      if (screen === 'finish') await renderFinish(root, draft);
      else if (screen === 'work' || statusOf(draft) !== 'complete' || openId === 'new')
        await renderWork(root, draft);
      else await renderReview(root, draft);
    } else {
      draft = null;
      await renderList(root);
    }

    const redraw = () => this.render(root);

    // Remembered so a redraw does not shut them. A `<details>` toggle is not a
    // navigation, so the unsaved-work guard must stay silent on it (§13f).
    for (const d of root.querySelectorAll('[data-context]'))
      d.addEventListener('toggle', () => { contextOpen = d.open; });
    for (const d of root.querySelectorAll('[data-process]'))
      d.addEventListener('toggle', () => { processOpen = d.open; });

    root.onclick = async (e) => {
      if (e.target.closest('label')) return;   // let file pickers open

      // Every move between screens goes through the address, so the browser's
      // own history is the history of the work (§8.0c).
      // Straight into a new trial on that piece — the handoff that already
      // exists (§8.0c), reached from the diary rather than only from the
      // choosing screen. Cloth that is ready is one press from being used.
      const start = e.target.closest('[data-start]');
      if (start) return navigate(await workOn(start.dataset.start));

      // Working a finished piece again. The same address as starting from a
      // ready piece, because it is the same act — the handoff decides for
      // itself whether the cloth arrives raw or already carrying a print
      // (§13am).
      const again = e.target.closest('[data-again]');
      if (again) return navigate(await workOn(again.dataset.again));

      const ground = e.target.closest('[data-open-ground]');
      if (ground) return navigate(`#/trials/${ground.dataset.openGround}`);

      // Work that points at no cloth. It updates nothing, groups with nothing
      // and belongs to no piece's life, while looking like an ordinary record
      // (§13ao) — so it says so, and goes to the screen where the cloth is
      // chosen rather than attaching one from a card.
      const attach = e.target.closest('[data-attach]');
      if (attach) return navigate(`#/trials/${attach.dataset.attach}/work`);
      if (e.target.closest('[data-new]')) return navigate('#/trials/new');
      if (e.target.closest('[data-refinish]')) return navigate(`#/trials/${draft.id}/finish`);
      if (e.target.closest('[data-edit]')) return navigate(`#/trials/${draft.id}/work`);
      if (e.target.closest('[data-finish]')) { readWork(root); await put('trials', draft);
                                               return navigate(`#/trials/${draft.id}/finish`); }
      // Finishing reachable from the list, so a piece can be closed without
      // going round through the cloth (§13ag). It goes to screen 4 rather than
      // setting `status` here: the five questions are what finishing *is* —
      // the result, the verdict, and the cloth's change of state. A row that
      // marked work complete on its own would leave all three unasked.
      const fin = e.target.closest('[data-finish-row]');
      if (fin) return navigate(`#/trials/${fin.dataset.finishRow}/finish`);

      // Settling a stale state reopens the finishing screen of the work that
      // left it stale, rather than writing a state event from the list. The
      // five questions are where a piece is closed, and answering them again is
      // how the record becomes right — not a quiet correction from a card.
      const settle = e.target.closest('[data-settle]');
      if (settle) return navigate(`#/trials/${settle.dataset.settle}/finish`);

      const row = e.target.closest('[data-open]');
      if (row) return navigate(`#/trials/${row.dataset.open}`);
      if (e.target.closest('[data-back]')) {
        // Back from the working screen forced open on finished work returns to
        // reading that same record, not to the list — one usually corrects a
        // step, checks how it reads, corrects again.
        if (screen === 'work' && statusOf(draft) === 'complete') return navigate(`#/trials/${draft.id}`);
        if (screen === 'finish') return navigate(`#/trials/${draft.id}`);
        return navigate('#/trials');
      }

      // ---- screen 4: writing the result and closing the work
      if (e.target.closest('[data-finish-save]')) {
        readWork(root);
        draft.status = 'complete';
        // The trial does not own the cloth's state — Fabrics does — but the
        // state event carries a `trialId` precisely so the work can say what it
        // did to the piece. Applied to every piece on the trial: twenty pieces
        // in one bath is the case `fabricIds` exists for.
        if (!draft.finishedOn) draft.finishedOn = draft.date || today();
        const stateCode = root.querySelector('[data-newstate]')?.value || '';
        const stamp = root.querySelector('[data-statedate]')?.value || draft.finishedOn;

        // One work leaves one mark on a piece, and finishing again corrects it
        // rather than adding another (§13au).
        //
        // This pushed unconditionally, so every visit to screen 4 added another
        // event — and because the date opened at `today()`, the second one bore
        // today's date. A tunic printed in May 2025 ended up finished twice,
        // once on the day it happened and once on the day the record was
        // touched. The event is found by `trialId`, which it has carried from
        // the start precisely so the work can say what it did to the piece.
        //
        // Written to `actions`, not to `stateEvents`. §13bd converted every
        // READER to the new list and left this writer on the old one, so from
        // 0.98.0 finishing a piece of work stamped a list nothing read: the
        // cloth stayed in the mordanted box and its biography said nothing
        // about having been finished. The fallback in `currentState` hid it —
        // it reads `stateEvents` only for a record that has never been
        // migrated, and after the migration every record has been.
        //
        // Which is the fallback rule exactly: something that produces plausible
        // output conceals the fault it covers for.
        for (const id of draft.fabricIds || []) {
          const f = await get('fabrics', id);
          if (!f) continue;
          f.actions = f.actions || [];
          const mine = f.actions.filter(a => a.trialId === draft.id);
          if (!stateCode) {
            // "Leave the state alone" said after a state was recorded means
            // withdraw it, not keep the old one and stay silent about it.
            if (!mine.length) continue;
            f.actions = f.actions.filter(a => a.trialId !== draft.id);
          } else if (mine.length) {
            // Any duplicates from before the fix collapse into the one kept.
            const keep = mine[0];
            keep.date = stamp;
            keep.actionCode = ACTION_FOR_STATE[stateCode] || 'other';
            keep.fromStateCode = stateCode;
            f.actions = f.actions.filter(a => a.trialId !== draft.id || a === keep);
          } else {
            f.actions.push({
              id: uid(), fabricId: f.id,
              actionCode: ACTION_FOR_STATE[stateCode] || 'other',
              fromStateCode: stateCode,
              date: stamp, recipeId: null, chainId: null,
              // A trial IS the shared context, so no batch (§13bd).
              trialId: draft.id, batchId: null,
              note: '', deviation: '', observation: '',
              createdAt: new Date().toISOString(),
            });
          }
          await put('fabrics', f);
        }
        await put('trials', draft);
        return navigate(`#/trials/${draft.id}`);
      }

      // ---- screen 2: choosing or adding the cloth
      const pick = e.target.closest('[data-pick]');
      if (pick) return navigate(await workOn(pick.dataset.pick));

      if (e.target.closest('[data-nf-comp-add]')) {
        readNewFabric(root);
        newFabric.composition.push({ fibreCode: '', percent: null });
        return this.render(root);
      }
      const nfdel = e.target.closest('[data-nf-comp-del]');
      if (nfdel) {
        readNewFabric(root);
        newFabric.composition.splice(Number(nfdel.dataset.nfCompDel), 1);
        return this.render(root);
      }
      if (e.target.closest('[data-nf-save]')) {
        readNewFabric(root);
        if (!(newFabric.name || '').trim()) { alert(t('trials.newPieceNeedsName')); return; }
        const piece = newRecord({
          label: await reserveLabel(),
          name: newFabric.name.trim(),
          weightG: newFabric.weightG,
          composition: newFabric.composition.filter(c => c.fibreCode),
          origin: 'new', form: '', structure: '', baseColour: '',
          stateEvents: [], notes: '', photoData: null,
        });
        await put('fabrics', piece);
        newFabric = { name: '', weightG: null, composition: [] };
        return navigate(`#/trials/new/${piece.id}`);
      }

      const padd = e.target.closest('[data-place-add]');
      if (padd) {
        readWork(root);
        // Added from inside a step, it belongs to that step; added from the
        // block below, it belongs to none — which is what a leaf laid on cloth
        // is (§13ar).
        const belongsTo = padd.dataset.placeAdd || null;
        draft.placements.push({ id: uid(), stepId: belongsTo,
                                plantId: '', partCode: '', condition: 'fresh',
                                facing: '', printQuality: null, localTreatment: '',
                                resultColour: '', resultHex: '', observation: '',
                                photo: null, combinationId: null });
        // A placement added closed is a placement nobody can fill in.
        openPlace = draft.placements[draft.placements.length - 1].id;
        // Adding a dyestuff must not shut the step it was added from.
        if (!belongsTo) openStep = null;
        return redraw();
      }
      const pdel = e.target.closest('[data-place-del]');
      if (pdel) { readWork(root); draft.placements.splice(Number(pdel.dataset.placeDel), 1); return redraw(); }
      const ppdel = e.target.closest('[data-place-photo-del]');
      if (ppdel) { readWork(root); draft.placements[Number(ppdel.dataset.placePhotoDel)].photo = null; return redraw(); }

      // Leaving to write a recipe must not cost the trial. It is saved first,
      // and where to come back to is remembered, so the detour is a detour and
      // not a decision between recording the work and recording the method.
      // Writing the recipe this step needs, without losing the step (§13aq).
      //
      // The button existed and did not do what it offered: it went to the
      // recipes *list* rather than to a new recipe, and saving returned to the
      // trials *list* rather than to the work, with nothing attached. So the
      // person wrote the recipe, came back, and had to find the trial, find the
      // step, and choose the recipe by name — which is most of the work the
      // button was there to save.
      const nr = e.target.closest('[data-newrecipe]');
      if (nr) {
        readWork(root);
        // The step is remembered by its id, not its index: coming back to a
        // record that has had a step added or removed meanwhile would attach
        // the recipe to the wrong one.
        await handOff('#/recipes/new', {
          stepId: draft.steps?.[Number(nr.dataset.newrecipe)]?.id || null,
        });
        return;
      }

      // A step opens in place, one at a time.
      const placeOpen = e.target.closest('[data-place-open]');
      if (placeOpen) {
        readWork(root);
        const id = placeOpen.dataset.placeOpen;
        openPlace = openPlace === id ? null : id;
        openStep = null;
        return redraw();
      }

      const stepOpen = e.target.closest('[data-step-open]');
      if (stepOpen) {
        readWork(root);
        const id = stepOpen.dataset.stepOpen;
        openStep = openStep === id ? null : id;
        return redraw();
      }

      // Preparation is recorded on the cloth, so the button leaves the trial
      // and goes to the group action with this work's pieces already ticked.
      // Nothing is stored on the trial: the card reads the pieces back.
      if (e.target.closest('[data-add-prep]')) {
        readWork(root);
        const ids = (draft.fabricIds || []).join(',');
        await handOff('#/batch' + (ids ? '?pieces=' + ids : ''));
        return;
      }

      const batchLine = e.target.closest('[data-batch]');
      if (batchLine) return navigate('#/batch/' + batchLine.dataset.batch);

      const addStep = e.target.closest('[data-add-step]');
      const addChain = e.target.closest('[data-add-chain]');
      if (addStep || addChain) {
        readWork(root);
        const el = addStep || addChain;
        const stage = addStep ? el.dataset.addStep : (el.dataset.stage || 'prep');
        const inserted = addChain ? expandChain(el.dataset.addChain, stage) : [blankStep(stage)];
        if (!inserted.length) return;
        // Adding several actions to work already marked finished is almost always
        // a mistake, so it is confirmed rather than silently done (§8.0e).
        if (inserted.length > 1 && statusOf(draft) === 'complete'
            && !confirm(t('trials.confirmAddToFinished'))) return;
        // Inserted at the end of the run it was added from, not at the end of the
        // trial — otherwise a second mordanting step would land after the drying,
        // and the order of the steps IS the order of the work.
        const at = el.dataset.after === undefined
          ? draft.steps.length : Number(el.dataset.after) + 1;
        draft.steps.splice(at, 0, ...inserted);
        draft.steps.forEach((st, n) => { st.order = n; });
        // A single new step opens, because it is empty and the next thing wanted
        // is to say what it was. A sequence inserts several and opens none.
        openStep = inserted.length === 1 ? inserted[0].id : null;
        return redraw();
      }
      const sdel = e.target.closest('[data-step-del]');
      if (sdel) {
        readWork(root);
        draft.steps.splice(Number(sdel.dataset.stepDel), 1);
        draft.steps.forEach((st, n) => { st.order = n; });
        return redraw();
      }

      const madd = e.target.closest('[data-medium-add]');
      if (madd) {
        readWork(root);
        draft.steps[Number(madd.dataset.mediumAdd)].mediumMod =
          { whereCode: '', materialId: '', amount: '', phMeasured: null, intent: '' };
        return redraw();
      }
      const mdel = e.target.closest('[data-medium-del]');
      if (mdel) { readWork(root); draft.steps[Number(mdel.dataset.mediumDel)].mediumMod = null; return redraw(); }

      const spdel = e.target.closest('[data-step-photo-del]');
      if (spdel) {
        readWork(root);
        const [i, j] = spdel.dataset.stepPhotoDel.split('.').map(Number);
        draft.steps[i].photos.splice(j, 1);
        return redraw();
      }

      const ppldel = e.target.closest('[data-plan-photo-del]');
      if (ppldel) {
        readWork(root);
        draft.planPhotos.splice(Number(ppldel.dataset.planPhotoDel), 1);
        return redraw();
      }

      const phdel = e.target.closest('[data-photo-del]');
      if (phdel) { readWork(root); draft.resultPhotos.splice(Number(phdel.dataset.photoDel), 1); return redraw(); }

      if (e.target.closest('[data-save]')) {
        readWork(root);
        if (!draft.status) draft.status = 'planned';
        // A verdict on a record still marked as an intention is a contradiction,
        // and almost always means the status was simply not touched. Offered,
        // never applied silently — the app does not decide the work is over.
        if (draft.assessment && draft.status !== 'complete'
            && confirm(t('trials.markComplete'))) draft.status = 'complete';
        await put('trials', draft);
        // A brand-new trial has been living at `#/trials/new`; once it has an id
        // its address is its own, so a reload after saving reopens the work
        // rather than an empty new one.
        if (openId === 'new') return navigate(`#/trials/${draft.id}`);
        openId = draft.id;
        // Saving used to redraw the same screen and say nothing, so pressing
        // Save read as pressing nothing. Every other module in the application
        // confirms; this one was the exception, and it was reported as one.
        flash(t('common.saved'));
        return this.render(root);
      }
      if (e.target.closest('[data-delete]')) {
        if (!confirm(t('trials.confirmDelete'))) return;
        await remove('trials', draft.id);
        return navigate('#/trials');
      }
    };

    root.onchange = async (e) => {
      if (e.target.dataset.filter) {
        filter[e.target.dataset.filter] = e.target.value;
        return this.render(root);
      }

      // The searchable picker: resolve the typed name to an id and write it into
      // the hidden field the reader looks at. A name matching nothing leaves the
      // previous id alone — losing a plant to a typo would be a poor trade for
      // the convenience of typing.
      if (e.target.dataset.picker) {
        const [attr, idx, fieldName] = e.target.dataset.picker.split(':');
        const hidden = root.querySelector(`[data-${attr}="${idx}.${fieldName}"]`);
        if (!hidden) return;
        const typed = e.target.value.trim();
        if (!typed) { hidden.value = ''; return; }
        const hit = plants.find(p => text(p.nameCommon).toLowerCase() === typed.toLowerCase())
                 || plants.find(p => text(p.nameCommon).toLowerCase().startsWith(typed.toLowerCase()));
        if (hit) hidden.value = hit.id;
        else e.target.value = text(plants.find(p => p.id === hidden.value)?.nameCommon) || '';
        readWork(root);
        return redraw();
      }

      // Photo-first is the real order of work: open the bundle, photograph it,
      // then say what it was. Delegated so a redraw never orphans the handler.
      if (e.target.dataset.placePhoto !== undefined && e.target.files?.[0]) {
        readWork(root);
        draft.placements[Number(e.target.dataset.placePhoto)].photo = await shrinkThumb(e.target.files[0]);
        return redraw();
      }
      // A photograph on a step, at any stage of the work — not only the
      // placement and the result. The middle of the process is where the
      // fabric's story used to have a hole in it (§8.0a).
      if (e.target.dataset.stepPhoto !== undefined && e.target.files?.length) {
        readWork(root);
        const i = Number(e.target.dataset.stepPhoto);
        draft.steps[i].photos = draft.steps[i].photos || [];
        for (const file of e.target.files) draft.steps[i].photos.push(await shrinkStep(file));
        return redraw();
      }

      if (e.target.dataset.planPhoto !== undefined && e.target.files?.length) {
        readWork(root);
        draft.planPhotos = draft.planPhotos || [];
        // Result size, not step size: a plan is usually a diagram with writing.
        for (const file of e.target.files) draft.planPhotos.push(await shrinkResult(file));
        return redraw();
      }

      if (e.target.id === 'resultphoto' && e.target.files?.length) {
        readWork(root);
        for (const file of e.target.files) draft.resultPhotos.push(await shrinkResult(file));
        return redraw();
      }

      // Marking the work complete from the chips goes to the finishing screen
      // rather than doing it quietly (§13an).
      //
      // The chips are the third door to "complete", and the only one that
      // reached it without passing the five questions — so the work went into
      // the finished column with no result, no verdict and no change to the
      // cloth, which is how a garment came to sit under "finished work" and
      // "ready to work" at once. Work is not finished because a chip says so;
      // it is finished when it is known what it gave and what became of the
      // cloth. The status is written first, so nothing is lost if the person
      // turns back from screen 4.
      if (e.target.matches('[data-f="status"]') && e.target.value === 'complete'
          && statusOf(draft) !== 'complete') {
        readWork(root);
        draft.status = 'complete';
        await put('trials', draft);
        return navigate(`#/trials/${draft.id}/finish`);
      }

      // Switching process changes which fields apply, so the form is redrawn.
      if (e.target.matches('[data-f="processCode"]') || e.target.matches('[data-f="repeat"]')
          || e.target.matches('[data-f="status"]')
          // A stage change regroups the steps; a type change can reveal the
          // layer row. Both need the form drawn again.
          || /\.(stageCode|typeCode)$/.test(e.target.dataset.step || '')) {
        readWork(root); return redraw();
      }
      if ((e.target.dataset.step || '').endsWith('.typeCode')) { readWork(root); return redraw(); }
    };
  },
};

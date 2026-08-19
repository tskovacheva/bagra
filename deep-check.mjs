// deep-check.mjs — renders every module past its first screen.
//
// check-boot.mjs proves the app STARTS. It visits each module but stops at the
// list, so a fault inside a read view or a form — a missing import, a helper
// that was never brought in — still ships. Both bugs found the day this file
// was written were of exactly that kind, and both would have reached the
// studio as a blank screen with nothing on it to explain itself.
//
// What it does: opens the first record in each module, opens its editor,
// presses the star, applies the favourites filter, and checks the two rules
// that are easy to break by accident — that opening a blank fabric form takes
// no tag number, and that a trial written before `status` existed is left
// exactly as it is.
//
// Clicks are dispatched as real events. Calling root.onclick directly skips
// handlers registered with addEventListener, which is how a harness comes to
// report green on a screen that does not work.
//
// Requires jsdom and fake-indexeddb:  npm install --no-save jsdom fake-indexeddb

import fs from 'fs';
import { JSDOM } from 'jsdom';
import 'fake-indexeddb/auto';

const dom = new JSDOM(fs.readFileSync('index.html','utf8'),
  { url:'https://example.org/bagra/', runScripts:'outside-only' });
const d=(n,v)=>Object.defineProperty(global,n,{value:v,configurable:true,writable:true});
d('window',dom.window); d('document',dom.window.document); d('location',dom.window.location);
d('navigator',dom.window.navigator); d('HTMLElement',dom.window.HTMLElement);
d('Image',dom.window.Image); d('FileReader',dom.window.FileReader); d('Blob',dom.window.Blob);
d('URL',dom.window.URL); d('alert',()=>{});
// Counted, not merely stubbed: several checks below care about whether the
// application asked at all, and a stub that always says yes hides the question.
// A guard that asks when it should not is exactly as wrong as one that does not
// ask when it should — and the first is the one that makes a screen unusable.
let prompts = 0;
d('confirm', () => { prompts++; return true; });
// `Event` and `MouseEvent` are globals in a browser and were not here, so any
// code path calling `new Event(...)` threw only under the harness. `navigate`
// does exactly that when the hash is unchanged (§8.0c), which is how a screen
// asks to be re-rendered at the same address.
d('Event',dom.window.Event); d('MouseEvent',dom.window.MouseEvent);
d('CustomEvent',dom.window.CustomEvent);
d('MutationObserver',dom.window.MutationObserver);
d('crypto',{randomUUID:()=>'id-'+Math.random().toString(36).slice(2)});
d('fetch', async(u)=>{ const p=String(u).replace(/^.*\/bagra\//,'');
  if(!fs.existsSync(p)) return {ok:false,status:404,json:async()=>({})};
  return {ok:true,status:200,json:async()=>JSON.parse(fs.readFileSync(p,'utf8'))}; });

let failed=false;
const fail=(l,e)=>{failed=true;console.log(`FAIL ${l}: ${e?.message||e}`);
  if(e?.stack) console.log(e.stack.split('\n').slice(1,4).join('\n'));};
process.on('unhandledRejection',e=>{console.log(e && e.stack);fail('rejection',e);});

await import('./app.js');
await new Promise(r=>setTimeout(r,1500));

const db = await import('./db.js');
const root = document.getElementById('view');

// Give trials something to render: one legacy record (no status) and one new.
const legacy = db.newRecord({ date:'2026-05-01', title:'стар запис без статус',
  processCode:'ecoprint', placements:[], steps:[], resultPhotos:[], assessment:'success' });
delete legacy.status;
await db.put('trials', legacy);
await db.put('trials', db.newRecord({ status:'planned', intent:'гащеризон, дъб и клен',
  date:'2026-08-07', title:'гащеризон', processCode:'ecoprint',
  placements:[], steps:[], resultPhotos:[] }));

// The star lives on these three. Seed anything empty so the path is real.
if (!(await db.all('recipes')).length) {
  await db.put('recipes', db.newRecord({ name:{bg:'танинова баня',en:'tannin bath'},
    type:'tannin', appliesTo:['cellulose'], ingredients:[], steps:[], version:1 }));
}
if (!(await db.all('combinations')).length) {
  await db.put('combinations', db.newRecord({
    key:{ dyeSource:{}, fibreClass:'cellulose', processCode:'ecoprint' },
    expected:{ colourText:{bg:'сиво-кафяво',en:'grey-brown'}, swatchHex:'#7A6A55' },
    confidence:'practice' }));
}
for (const store of ['plants','recipes','combinations']) {
  const rows = await db.all(store);
  await db.toggleFavorite(store, rows[0].id);
}

// Dispatch a real event rather than calling root.onclick by hand: some
// handlers are registered with addEventListener in the capture phase, and a
// direct call silently skips them — which is exactly how a harness ends up
// reporting green on a broken screen.
// A click starts an async re-render that nothing here can await: the handler is
// `root.onclick = async …` and its promise is dropped by the dispatcher. So the
// harness waits for the screen to stop changing rather than for a fixed number
// of milliseconds. A flat sleep passed for a year and then began failing one run
// in ten the moment the plant list grew — a check that fails at random teaches
// people to re-run it, which is the opposite of what it is for.
const settle = async (max = 1500) => {
  let last = -1, stable = 0, waited = 0;
  while (waited < max) {
    await new Promise(r => setTimeout(r, 15));
    waited += 15;
    const now = root.innerHTML.length;
    if (now === last) { if (++stable >= 2) return; } else { stable = 0; last = now; }
  }
};

const click = async (el) => {
  if (!el) throw new Error('nothing to click — the expected control is not on screen');
  el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
  await settle();
};


// Opening a fresh working screen. `[data-new]` in My work now asks which cloth
// (§8.0e screen 2), so the harness goes through the address the way the app
// does: `#/trials/new/<fabricId>`. Any cloth will do; one is made if none exist.
async function openFreshWork(trials) {
  let cloth = (await db.all('fabrics'))[0];
  if (!cloth) {
    cloth = db.newRecord({ label: 'П-999', name: 'платно за проверка',
      composition: [{ fibreCode: 'cotton', percent: 100 }], weightG: 100, stateEvents: [] });
    await db.put('fabrics', cloth);
  }
  trials.reset?.();
  trials.open('new', cloth.id);
  await trials.render(root);
  return cloth;
}

const mods = { plants:'./modules/plants.js', recipes:'./modules/recipes.js',
  reference:'./modules/reference.js', trials:'./modules/trials.js',
  fabrics:'./modules/fabrics.js' };

for (const [name, path] of Object.entries(mods)) {
  const m = await import(path);
  const mod = m.default || m;
  try {
    mod.reset?.();
    await mod.render(root);
    // Reference opens on the search tab; the record list is the other one.
    if (name === 'reference') {
      const tab = root.querySelector('[data-refmode="records"]');
      if (!tab) throw new Error('the records tab is missing');
      await click(tab);
    }
    if (root.innerHTML.length < 40) throw new Error('rendered nothing');
    console.log(`  ${name}: list ok (${root.innerHTML.length} chars)` +
      ` star=${root.querySelectorAll('[data-fav]').length}` +
      ` rows=${root.querySelectorAll('[data-open]').length}`);

    // Open the first record, then its editor.
    const row = root.querySelector('[data-open]');
    if (row) {
      await click(row);
      console.log(`  ${name}: read ok`);
      const edit = root.querySelector('[data-edit]');
      if (edit) { await click(edit);
        console.log(`  ${name}: form ok`); }
    }
    // Back to the list. `enter()` does not always reset the open record, so
    // walk out the way a person would: press the way up until the list
    // reappears.
    //
    // `[data-goto]` since §13bo, where the word "back" became the module's own
    // name and an address rather than a step through history. This check found
    // the rename by walking a route that no longer existed — which is exactly
    // what it is for, and a reminder that a UI pass moves the things checks
    // hold on to.
    for (let i = 0; i < 3; i++) {
      const back = root.querySelector('[data-goto], [data-back]');
      if (!back) break;
      await click(back);
    }
    await mod.render(root);
    if (name === 'reference' && !root.querySelector('[data-fav]')) {
      const tab = root.querySelector('[data-refmode="records"]');
      if (tab) await click(tab);
    }
    const starred = ['plants','recipes','reference'].includes(name);
    const star = root.querySelector('[data-fav]');
    if (starred && !star) throw new Error('no star rendered in the list');
    if (star) {
      const before = root.querySelectorAll('.fav.on').length;
      await click(star);
      const after = root.querySelectorAll('.fav.on').length;
      if (before === after) throw new Error('the star did not toggle');
      if (root.querySelector('[data-open]') === null) throw new Error('the star emptied the list');
      console.log(`  ${name}: star ok (${before} → ${after})`);
    }
    const chip = root.querySelector('[data-favonly]');
    if (starred && chip) {
      await click(chip);
      console.log(`  ${name}: favourites filter ok`);
      mod.reset?.();
    }
  } catch (err) { fail(name, err); }
}

// ---- the two fixes, checked as behaviour rather than as diffs -------------

// 1. Opening the new-fabric form must not consume a tag number.
{
  const fabrics = (await import('./modules/fabrics.js')).default
    || await import('./modules/fabrics.js');
  const before = await db.getSetting('fabricLabelCounter', 0);
  fabrics.reset?.();
  await fabrics.render(root);
  for (let i = 0; i < 3; i++) {
    const nu = root.querySelector('[data-new]');
    await click(nu);
    const back = root.querySelector('[data-goto], [data-back]');
    if (back) await click(back);
  }
  const after = await db.getSetting('fabricLabelCounter', 0);
  if (after !== before) fail('label', new Error(`counter moved ${before} → ${after} without a save`));
  else console.log(`  label: three opens, no save — counter still ${after}`);

  // And a save must take exactly one.
  fabrics.reset?.();
  await fabrics.render(root);
  await click(root.querySelector('[data-new]'));
  const save = root.querySelector('[data-save]');
  if (save) {
    await click(save);
    const saved = await db.getSetting('fabricLabelCounter', 0);
    if (saved !== after + 1) fail('label', new Error(`save took ${saved - after}, expected 1`));
    else {
      const rows = await db.all('fabrics');
      console.log(`  label: one save took one number → ${rows[rows.length - 1].label}`);
    }
  }
}

// 2. A record written before status existed must read as finished, not blank.
{
  const trials = (await import('./modules/trials.js')).default
    || await import('./modules/trials.js');
  const rows = await db.all('trials');
  const old = rows.find(r => r.status === undefined);
  if (!old) fail('status', new Error('the legacy record lost its missing status'));
  else {
    trials.reset?.();
    await trials.render(root);
    const html = root.innerHTML;
    if (!html.includes('замислен') && !html.includes('в ход'))
      console.log('  status: legacy record shows no chip, as intended');
    else console.log('  status: chips render');
    if (old.status !== undefined)
      fail('status', new Error('a migration wrote a guessed status back to disk'));
    else console.log('  status: nothing written back to the legacy record');
  }
}


const dirty = await import('./dirty.js');

// ---- 3. Unsaved work is not thrown away on a stray click -----------------
{
  const plants = (await import('./modules/plants.js')).default
    || await import('./modules/plants.js');

  // Rebuild the guard with a refusal we control, so both answers are tested.
  let answer = false, asked = 0;
  dirty.install(() => { asked++; return answer; });

  plants.reset?.();
  await plants.render(root);
  await click(root.querySelector('[data-open]'));
  await click(root.querySelector('[data-edit]'));

  const input = root.querySelector('[data-f]');
  if (!input) fail('guard', new Error('no editable field in the plant form'));
  else {
    if (dirty.isDirty()) fail('guard', new Error('marked unsaved before anything was typed'));

    input.value = (input.value || '') + ' x';
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    if (!dirty.isDirty()) fail('guard', new Error('typing did not mark the work unsaved'));
    else console.log('  guard: typing marks the work unsaved');

    // Refused: the click must not reach the module, so the form stays.
    answer = false;
    const before = asked;
    await click(root.querySelector('[data-goto], [data-back]'));
    if (asked !== before + 1) fail('guard', new Error('leaving did not ask'));
    else if (!root.querySelector('[data-save]'))
      fail('guard', new Error('Back went through after being refused — work lost'));
    else console.log('  guard: Back refused, the form is still open');

    // Accepted: it goes through, and the state resets.
    answer = true;
    await click(root.querySelector('[data-goto], [data-back]'));
    if (dirty.isDirty()) fail('guard', new Error('still marked unsaved after discarding'));
    else console.log('  guard: Back accepted, the state resets');
  }

  // Saving clears it, and a save is not confused with a navigation.
  plants.reset?.();
  await plants.render(root);
  await click(root.querySelector('[data-open]'));
  await click(root.querySelector('[data-edit]'));
  const f = root.querySelector('[data-f]');
  f.value = (f.value || '') + ' y';
  f.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  const save = root.querySelector('[data-save]');
  if (save) {
    const askedBefore = asked;
    await click(save);
    await new Promise(r => setTimeout(r, 250));
    if (asked !== askedBefore) fail('guard', new Error('saving was treated as leaving'));
    else if (dirty.isDirty()) {
      console.log('   debug: save still present?', !!document.querySelector('[data-save]'),
                  '| edit present?', !!document.querySelector('[data-edit]'),
                  '| edit-attrs in view:', root.querySelectorAll('[data-f],[data-multi],[data-opt]').length);
      fail('guard', new Error('still marked unsaved after saving'));
    }
    else console.log('  guard: saving clears it without asking');
  }
  dirty.markClean();

  // And it must stay out of the way when nothing is unsaved. A guard that
  // asks on an ordinary click is worse than no guard: it gets dismissed
  // reflexively, and then it is not read on the day it matters.
  {
    const quiet = asked;
    plants.reset?.();
    await plants.render(root);
    await click(root.querySelector('[data-open]'));
    await click(root.querySelector('[data-goto], [data-back]'));
    if (asked !== quiet) fail('guard', new Error('asked when there was nothing unsaved'));
    else console.log('  guard: silent when nothing is unsaved');
  }

  // A save that is refused mid-way leaves the person in the form with the
  // same unsaved work. This is the case the clearing logic exists for, and
  // getting it wrong means the app calls the work saved when it is not.
  {
    const fabrics = (await import('./modules/fabrics.js')).default
      || await import('./modules/fabrics.js');
    global.confirm = () => false;              // decline "the composition is not 100%"
    fabrics.reset?.();
    await fabrics.render(root);
    await click(root.querySelector('[data-new]'));
    const pct = root.querySelector('[data-comp-pct]');
    if (pct) {
      pct.value = '60';                        // deliberately not 100
      pct.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
      await click(root.querySelector('[data-save]'));
      await new Promise(r => setTimeout(r, 800));
      if (!root.querySelector('[data-save]'))
        console.log('  (the form closed; this build does not refuse the save)');
      else if (!dirty.isDirty())
        fail('guard', new Error('a refused save was counted as saved — work now unprotected'));
      else console.log('  guard: a refused save leaves the work marked unsaved');
    }
    global.confirm = () => true;
  }

  // A filter is not a way out of a form, and must not be treated as one.
  {
    plants.reset?.();
    await plants.render(root);
    const chip = root.querySelector('[data-role]');
    if (chip) {
      const quiet = asked;
      await click(chip);
      if (asked !== quiet) fail('guard', new Error('a list filter was treated as leaving'));
      else console.log('  guard: filters are not navigations');
    }
  }
}


// ---- 4. A photograph can be attached at any step, and removed again -------
{
  const trials = (await import('./modules/trials.js')).default
    || await import('./modules/trials.js');

  // shrink() resizes through a canvas, which jsdom does not implement, and an
  // ES module's exports cannot be replaced. So the browser pieces it needs are
  // stood up instead: an Image that reports a size and loads, and a canvas that
  // returns a data URL. The resizing is not what is under test — the wiring is.
  const realCreate = document.createElement.bind(document);
  document.createElement = (tag) => tag === 'canvas'
    ? { width: 0, height: 0,
        getContext: () => ({ drawImage() {} }),
        toDataURL: () => 'data:image/jpeg;base64,AAAA' }
    : realCreate(tag);
  global.Image = class {
    constructor() { this.width = 1000; this.height = 800; }
    set src(_v) { setTimeout(() => this.onload?.(), 0); }
  };
  global.URL.createObjectURL = () => 'blob:x';
  global.URL.revokeObjectURL = () => {};

  await openFreshWork(trials);
  await click(root.querySelector('[data-add-step]'));

  const add = root.querySelector('[data-step-photo]');
  if (!add) fail('photos', new Error('a step offers no way to attach a photograph'));
  else {
    // A step photo input must not be picked up as a step FIELD: `[data-step]`
    // matches the attribute name exactly, and data-step-photo is a different
    // name — the same trap that made the guard miss half the form.
    const fields = root.querySelectorAll('[data-step]');
    if ([...fields].includes(add))
      fail('photos', new Error('the photo input is being read as a step field'));

    Object.defineProperty(add, 'files', {
      value: [new dom.window.File(['x'], 'a.jpg', { type: 'image/jpeg' })],
      configurable: true,
    });
    add.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 200));

    const shots = root.querySelectorAll('.stepphoto img');
    if (!shots.length) fail('photos', new Error('the photograph did not attach'));
    else {
      console.log(`  photos: attached to a step (${shots.length})`);
      const del = root.querySelector('[data-step-photo-del]');
      if (!del) fail('photos', new Error('an attached photograph cannot be removed'));
      else {
        if (!/^\d+\.\d+$/.test(del.dataset.stepPhotoDel))
          fail('photos', new Error(`the delete button carries "${del.dataset.stepPhotoDel}",`
            + ' which does not identify both the step and the photograph'));
        await click(del);
        if (root.querySelectorAll('.stepphoto img').length)
          fail('photos', new Error('removing the photograph left it on screen'));
        else console.log('  photos: removed again');
      }
    }
  }
  // A plan brought in as a drawing (§8.0d) — attached whole, with no field
  // asking to be filled in from it.
  const plan = root.querySelector('[data-plan-photo]');
  if (!plan) fail('photos', new Error('there is nowhere to attach a plan drawing'));
  else {
    const shotsBefore = root.querySelectorAll('.stepphoto img').length;
    Object.defineProperty(plan, 'files', {
      value: [new dom.window.File(['x'], 'plan.png', { type: 'image/png' })],
      configurable: true,
    });
    plan.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 200));
    if (root.querySelectorAll('.stepphoto img').length !== shotsBefore + 1)
      fail('photos', new Error('the plan drawing did not attach'));
    else console.log('  photos: a plan drawing attaches to the trial');
  }

  // And it must survive a save, which is the whole point of attaching it.
  const save = root.querySelector('[data-save]');
  if (save) {
    await click(save);
    await new Promise(r => setTimeout(r, 300));
    const saved = (await db.all('trials')).find(x => (x.planPhotos || []).length);
    if (!saved) fail('photos', new Error('the plan drawing was not written to the record'));
    else console.log('  photos: survives a save');
  }
  dirty.markClean?.();
}


// ---- 5. Stages group the steps, and a stage may recur ---------------------
{
  const trials = (await import('./modules/trials.js')).default
    || await import('./modules/trials.js');

  // Dyeing, then a print, then dyeing again: two passes through colouring.
  // Collapsing them into one group would rewrite the order of the work.
  const woven = db.newRecord({
    status: 'in_progress', date: '2026-08-07', title: 'два пъти багрене',
    processCode: 'ecoprint', placements: [], resultPhotos: [], planPhotos: [],
    steps: [
      { id: 'a', order: 0, stageCode: 'prep',     typeCode: 'mordant',      photos: [] },
      { id: 'b', order: 1, stageCode: 'colour',   typeCode: 'dye',          photos: [] },
      { id: 'c', order: 2, stageCode: 'decorate', typeCode: 'print_paste',  photos: [] },
      { id: 'd', order: 3, stageCode: 'colour',   typeCode: 'dye',          photos: [] },
      { id: 'e', order: 4, stageCode: 'after',    typeCode: 'rinse',        photos: [] },
    ],
  });
  await db.put('trials', woven);

  trials.reset?.();
  await trials.render(root);
  const row = [...root.querySelectorAll('[data-open]')]
    .find(el => el.textContent.includes('два пъти'));
  if (!row) fail('stages', new Error('the woven trial is not in the list'));
  else {
    await click(row);
    // Unfinished work opens ready to be worked on, not as something to read
    // first (§8.0e). That is the whole change: the row is not a preview.
    if (!root.querySelector('[data-add-step]'))
      fail('stages', new Error('an unfinished row did not open the working screen'));
    else console.log('  stages: unfinished work opens on the working screen');

    // The same record, finished, must group the same way when reviewed — and
    // must offer a way back in. Checked on a genuinely complete copy: asserting
    // it on the unfinished one tested the working screen twice, because both
    // screens use the same stage headings.
    {
      const done = structuredClone(await db.get('trials', woven.id));
      done.id = woven.id + '-done';
      done.status = 'complete';
      done.title = 'два пъти багрене, завършено';
      await db.put('trials', done);
      trials.reset?.();
      trials.open(done.id);
      await trials.render(root);
      const readHeads = [...root.querySelectorAll('.stagecardhead:not(.sub) > b, .procrow:not(.fixed) .procname')].map(el => el.textContent.trim());
      if (readHeads.length !== 5)
        fail('stages', new Error(`the review shows ${readHeads.length} runs, not five`));
      else if (!root.querySelector('[data-edit]'))
        fail('stages', new Error('finished work offers no way back into it'));
      else console.log('  stages: the review groups the same way and reopens');
      await db.remove('trials', done.id);
    }

    trials.reset?.();
    trials.open(woven.id);
    await trials.render(root);

    const heads = [...root.querySelectorAll('.stagecardhead:not(.sub) > b, .procrow:not(.fixed) .procname')].map(el => el.textContent.trim());
    // Five runs, not four stages: colouring is entered, left for the print,
    // and entered again. That second visit is the thing being protected.
    if (heads.length !== 5)
      fail('stages', new Error(`expected five runs, got ${heads.length}: ${heads.join(' | ')}`));
    else if (heads[1] !== heads[3])
      fail('stages', new Error(`colouring should appear twice, got: ${heads.join(' | ')}`));
    else console.log(`  stages: ${heads.join(' › ')}`);

    // Every step must still be on screen exactly once after grouping.
    const rows = root.querySelectorAll('.stagecard .stepline').length;
    if (rows !== 5) fail('stages', new Error(`five steps went in, ${rows} came out`));
    else console.log('  stages: every step is shown exactly once');

    // Adding to a stage inserts into that run, not at the end of the trial.
    const addToFirst = root.querySelector('.stagecard [data-add-step]');
    await click(addToFirst);
    const after = root.querySelectorAll('.stagecard .stepline').length;
    if (after !== 6) fail('stages', new Error('adding a step to a stage did nothing'));
    else {
      const nowHeads = [...root.querySelectorAll('.stagecardhead:not(.sub) > b, .procrow:not(.fixed) .procname')].map(el => el.textContent.trim());
      if (nowHeads.length !== 5)
        fail('stages', new Error(`the new step broke the grouping: ${nowHeads.join(' | ')}`));
      else console.log('  stages: a step added to a stage stays inside it');
    }
  }
  dirty.markClean?.();

  // A record written before stages existed must group sensibly and, crucially,
  // must not be rewritten on disk by having been looked at.
  {
    const legacy = (await db.all('trials')).find(x => x.steps?.some(st => !st.stageCode));
    if (legacy) {
      trials.reset?.();
      await trials.render(root);
      const again = await db.get('trials', legacy.id);
      if (again.steps.some(st => st.stageCode))
        fail('stages', new Error('a stage was written back to a record that never had one'));
      else console.log('  stages: legacy steps are grouped by inference, not by migration');
    }
  }
}


// ---- 6. A piece's photographs read as one sequence ------------------------
{
  const { photoTimeline } = await import('./fabric-logic.js');

  const cloth = { id: 'f1', label: 'П-900', createdAt: '2026-05-01T00:00:00Z',
                  photoData: 'RAW', composition: [] };
  const trial = {
    id: 't1', date: '2026-05-14', title: 'гащеризон', fabricIds: ['f1'],
    planPhotos: ['PLAN'],
    placements: [{ photo: 'LEAVES' }],
    steps: [
      { id: 's1', stageCode: 'colour', typeCode: 'bundle', photos: ['ROLL'] },
      { id: 's2', stageCode: 'after',  typeCode: 'rinse',  photos: ['RINSE'] },
    ],
    resultPhotos: ['DONE'],
  };

  const order = photoTimeline(cloth, [trial]).map(p => p.src);
  const want = ['RAW', 'PLAN', 'LEAVES', 'ROLL', 'RINSE', 'DONE'];
  if (order.join(',') !== want.join(','))
    fail('strip', new Error(`out of order: ${order.join(' → ')}`));
  else console.log(`  strip: ${order.join(' → ')}`);

  // The middle is the whole point: before and after alone was the old shape.
  const middle = photoTimeline(cloth, [trial]).filter(p => p.kind === 'step');
  if (middle.length !== 2) fail('strip', new Error('the middle of the process is missing'));
  else if (!middle[0].stageCode)
    fail('strip', new Error('a step photograph does not say which stage it came from'));
  else console.log('  strip: step photographs carry their stage');

  // An earlier trial must sort before a later one whatever order it is passed in.
  const earlier = { ...trial, id: 't0', date: '2026-05-02', planPhotos: ['EARLY'],
                    placements: [], steps: [], resultPhotos: [] };
  const mixed = photoTimeline(cloth, [trial, earlier]).map(p => p.src);
  if (mixed[1] !== 'EARLY')
    fail('strip', new Error(`sorted by the order trials were passed, not by date: ${mixed.join(' → ')}`));
  else console.log('  strip: ordered by date, not by how the trials came in');

  // And it must actually reach the screen.
  const fabrics = (await import('./modules/fabrics.js')).default
    || await import('./modules/fabrics.js');
  // newRecord spreads the fields over its own id, so an explicit `id: undefined`
  // would blank the key rather than leave it alone.
  const { id: _cid, ...clothFields } = cloth;
  await db.put('fabrics', db.newRecord({ ...clothFields, name: 'тест лента' }));
  const saved = (await db.all('fabrics')).find(x => x.name === 'тест лента');
  const { id: _tid, ...trialFields } = trial;
  await db.put('trials', db.newRecord({ ...trialFields, fabricIds: [saved.id] }));
  fabrics.reset?.();
  await fabrics.render(root);
  const row = [...root.querySelectorAll('[data-open]')]
    .find(el => el.textContent.includes('тест лента'));
  if (!row) fail('strip', new Error('the test cloth is not in the list'));
  else {
    await click(row);
    const shown = root.querySelectorAll('.lifeshot img').length;
    if (shown !== 6) fail('strip', new Error(`six photographs, ${shown} on screen`));
    else console.log('  strip: all six render in the biography');
  }
}


// ---- 7. The cloth starts and continues its own story ----------------------
{
  const fabrics = (await import('./modules/fabrics.js')).default
    || await import('./modules/fabrics.js');
  const trials = (await import('./modules/trials.js')).default
    || await import('./modules/trials.js');

  const cloth = db.newRecord({ label: 'П-950', name: 'гащеризон', weightG: 420,
                               composition: [{ fibreCode: 'cotton', percent: 100 }] });
  await db.put('fabrics', cloth);

  const openCloth = async () => {
    fabrics.reset?.();
    await fabrics.render(root);
    const row = [...root.querySelectorAll('[data-open]')]
      .find(el => el.textContent.includes('гащеризон'));
    if (!row) throw new Error('the cloth is not in the list');
    await click(row);
  };

  // A cloth with no trials offers to start one.
  await openCloth();
  const start = root.querySelector('[data-startstory]');
  if (!start) fail('handoff', new Error('an unused cloth does not offer to start'));
  else {
    await click(start);
    if (!location.hash.startsWith('#/trials/new/'))
      fail('handoff', new Error(`went to ${location.hash} instead of a new trial`));
    else console.log('  handoff: an unused cloth offers to start one');

    // What the cloth knows must arrive with it, not be asked for again.
    // The address is the only channel: '#/trials/new/<fabricId>'.
    const [, , , fromId] = location.hash.split('/');
    trials.reset?.();
    trials.open('new', fromId);
    await trials.render(root);
    const title = root.querySelector('[data-f="title"]');
    const weight = root.querySelector('[data-f="weightOfGoodsG"]');
    const ticked = [...root.querySelectorAll('[data-multi="fabricIds"]')].filter(el => el.checked);
    if (title?.value !== 'гащеризон')
      fail('handoff', new Error(`the title did not travel: "${title?.value}"`));
    else if (String(weight?.value) !== '420')
      fail('handoff', new Error(`the weight did not travel: "${weight?.value}"`));
    else if (ticked.length !== 1)
      fail('handoff', new Error(`${ticked.length} pieces ticked, expected one`));
    else console.log('  handoff: name, weight and the piece itself arrive with it');

    // Saving it makes it this cloth's unfinished trial.
    await click(root.querySelector('[data-save]'));
    await new Promise(r => setTimeout(r, 300));
  }
  dirty.markClean?.();

  // Now the same cloth offers to CONTINUE rather than to start again.
  await openCloth();
  const cont = root.querySelector('[data-continue]');
  if (!cont) fail('handoff', new Error('a cloth with unfinished work still offers to start afresh'));
  else {
    const id = cont.dataset.continue;
    await click(cont);
    if (location.hash !== '#/trials/' + id)
      fail('handoff', new Error(`continue went to ${location.hash}`));
    else console.log('  handoff: unfinished work is continued, not duplicated');

    // And the router must land in the form, not in the gallery.
    trials.reset?.();
    trials.open(id);
    await trials.render(root);
    if (!root.querySelector('[data-save]'))
      fail('handoff', new Error('continuing landed somewhere other than the form'));
    else console.log('  handoff: continuing opens the form itself');
  }
  dirty.markClean?.();

  // A hash naming a record that no longer exists must not blank the screen.
  trials.reset?.();
  trials.open('no-such-trial');
  try {
    await trials.render(root);
    if (root.innerHTML.length < 40) fail('handoff', new Error('a stale link renders nothing'));
    else console.log('  handoff: a stale link still renders something');
  } catch (err) { fail('handoff: stale link', err); }
  dirty.markClean?.();

  // The router itself, not just the modules: setting the address must land in
  // the right module with the right record open. This is the part the modules
  // cannot test between themselves.
  {
    const live = (await db.all('trials')).find(x => (x.status || 'complete') !== 'complete');
    if (live) {
      // Start from elsewhere: assigning an unchanged hash fires no event, and
      // the point here is to prove the ROUTER opens the record.
      location.hash = '#/dashboard';
      await new Promise(r => setTimeout(r, 200));
      location.hash = '#/trials/' + live.id;
      await new Promise(r => setTimeout(r, 400));
      const view = document.getElementById('view');
      if (!view.querySelector('[data-save]'))
        fail('handoff', new Error('the address did not open the trial form'));
      else console.log('  handoff: the address alone opens the right record');
      dirty.markClean?.();
      location.hash = '#/dashboard';
      await new Promise(r => setTimeout(r, 200));
    }
  }
}


// ---- 7b. Collapsed steps survive a save -----------------------------------
//
// The working screen renders one step open and the rest as single lines, so most
// steps have no fields on screen. A reader that rebuilds the list from the screen
// writes those steps away. This is the check for that, and it failed before the
// reader was changed to patch in place.
{
  const trials = (await import('./modules/trials.js')).default;

  const many = db.newRecord({
    status: 'in_progress', date: '2026-08-08', title: 'пет стъпки, една отворена',
    processCode: 'immersion', placements: [], resultPhotos: [], planPhotos: [], fabricIds: [],
    steps: ['scour', 'tannin', 'mordant', 'dye', 'rinse'].map((tc, n) =>
      ({ id: 'k' + n, order: n, typeCode: tc, photos: [], note: 'бележка ' + n })),
  });
  await db.put('trials', many);

  trials.reset?.();
  trials.open(many.id);
  await trials.render(root);

  const lines = root.querySelectorAll('.stepline[data-step-open]').length;
  if (lines !== 5) fail('collapse', new Error(`five steps, ${lines} lines on screen`));
  else console.log('  collapse: every step is a line, whether open or not');

  // Open one — the others now have no fields at all on screen.
  await click(root.querySelector('.stepline[data-step-open]'));
  const fieldSteps = new Set([...root.querySelectorAll('[data-step]')]
    .map(el => el.dataset.step.split('.')[0]));
  if (fieldSteps.size !== 1)
    fail('collapse', new Error(`${fieldSteps.size} steps have fields on screen, expected one`));
  else console.log('  collapse: only the open step puts fields on screen');

  await click(root.querySelector('[data-save]'));
  await new Promise(r => setTimeout(r, 300));
  const back = await db.get('trials', many.id);
  if ((back.steps || []).length !== 5)
    fail('collapse', new Error(`five steps went in, ${back.steps?.length} survived the save`));
  else if (back.steps.some((st, n) => st.note !== 'бележка ' + n))
    fail('collapse', new Error('a collapsed step lost its note'));
  else console.log('  collapse: all five survive a save with their notes');

  await db.remove('trials', many.id);
  dirty.markClean?.();
}


// ---- 7c. Search narrows, and does not stay behind -------------------------
//
// The same shape as the favourites-filter fault (§13g): a filter left on when
// the module is re-entered makes a list look short for a reason nobody can see.
// Search text is a filter.
{
  for (const [name, path, term] of [
    ['plants', './modules/plants.js', 'дъб'],
    ['recipes', './modules/recipes.js', 'зз-няма-такова'],
    ['techniques', './modules/techniques.js', 'зз-няма-такова'],
  ]) {
    const mod = (await import(path)).default;
    mod.reset?.();
    await mod.render(root);
    const before = root.querySelectorAll('tbody tr, .workrow, .refcard').length;

    const box = root.querySelector('[data-search]');
    if (!box) { fail('search', new Error(`${name} offers no search box`)); continue; }

    box.value = term;
    box.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    await settle();
    const after = root.querySelectorAll('tbody tr, .workrow, .refcard').length;
    if (before && after >= before)
      fail('search', new Error(`${name}: ${before} rows before, ${after} after typing`));
    else console.log(`  search: ${name} narrows ${before} → ${after}`);

    // Re-entering must not leave the text behind.
    mod.reset?.();
    await mod.render(root);
    if ((root.querySelector('[data-search]')?.value || '') !== '')
      fail('search', new Error(`${name}: the search text survived reset()`));
    else if (root.querySelectorAll('tbody tr, .workrow, .refcard').length !== before)
      fail('search', new Error(`${name}: the list did not come back after reset()`));
    else console.log(`  search: ${name} clears on re-entry`);
  }
}


// ---- 8. A plant shows what colours it can give ----------------------------
{
  const { plantSwatches } = await import('./modules/plants.js');

  const plant = { id: 'seed:test', colours: [{ hex: '#AA0000', name: { bg: 'червено' } }] };
  const combos = [
    { key: { dyeSource: { plantId: 'seed:test' } },
      expected: { swatchHex: '#00AA00', colourText: { bg: 'зелено' } } },
    { key: { dyeSource: { plantId: 'seed:other' } },
      expected: { swatchHex: '#0000AA', colourText: { bg: 'синьо' } } },
    // The same colour reached twice is one swatch, not two identical squares.
    { key: { dyeSource: { plantId: 'seed:test' } },
      expected: { swatchHex: '#aa0000', colourText: { bg: 'пак червено' } } },
  ];

  const sw = plantSwatches(plant, combos);
  if (sw.map(x => x.hex).join(',') !== '#AA0000,#00AA00')
    fail('swatches', new Error(`wrong set: ${sw.map(x => x.hex).join(',')}`));
  else console.log('  swatches: own palette first, combinations after, no duplicates');

  if (!sw[0].caption) fail('swatches', new Error('a swatch carries no caption to hover'));
  else console.log('  swatches: each carries a caption');

  if (plantSwatches({ id: 'x' }, []).length)
    fail('swatches', new Error('a plant with nothing known invents a colour'));
  else console.log('  swatches: nothing known shows nothing');

  const many = Array.from({ length: 20 }, (_, n) => ({
    key: { dyeSource: { plantId: 'seed:test' } },
    expected: { swatchHex: `#0000${String(n).padStart(2, '0')}` },
  }));
  if (plantSwatches(plant, many).length > 6)
    fail('swatches', new Error('the row is not capped and will break the column'));
  else console.log('  swatches: capped so the column cannot run away');

  // And the seeded library must actually light up, or the column ships empty.
  const plants = (await import('./modules/plants.js')).default
    || await import('./modules/plants.js');
  plants.reset?.();
  await plants.render(root);
  const lit = root.querySelectorAll('.miniswatch').length;
  const rows = root.querySelectorAll('tbody tr').length;
  if (!lit) fail('swatches', new Error('not one plant in the seeded library shows a colour'));
  else console.log(`  swatches: ${lit} swatches across ${rows} seeded plants`);
}


// ---- 9. The plant profile: list and detail agree, and no prose is lost -----
//
// Each of these guards a fault that shipped or nearly shipped. The colour
// disagreement between list and detail was live for two releases and invisible
// in a check that stopped at the list.
{
  const plants = (await import('./modules/plants.js')).default;
  const { groupSections } = await import('./modules/plants.js');

  plants.reset?.();
  await plants.render(root);

  const cols = root.querySelectorAll('thead th').length;
  if (cols !== 5)
    fail('profile', new Error(`the list has ${cols} columns; four blocks plus the star is five`));
  else console.log('  profile: the list is four blocks, not a spreadsheet');

  // Pick the row showing the most swatches and open it: the detail must not
  // show fewer colours than the row the person just clicked.
  let best = null, bestCount = -1;
  for (const tr of root.querySelectorAll('tbody tr')) {
    const n = tr.querySelectorAll('.miniswatch').length;
    if (n > bestCount) { bestCount = n; best = tr; }
  }
  if (!best || !bestCount) {
    fail('profile', new Error('no seeded plant shows a swatch in the list'));
  } else {
    await click(best);
    const inDetail = root.querySelectorAll('.colourcards .refswatch').length;
    if (inDetail < bestCount)
      fail('profile', new Error(`the list showed ${bestCount} colours, the record shows ${inDetail}`));
    else console.log(`  profile: the record shows the colours the list promised (${bestCount} → ${inDetail})`);

    const ctx = root.querySelectorAll('.colourcards .hint').length;
    if (!ctx) fail('profile', new Error('a swatch in the detail says what, but never how'));
    else console.log('  profile: each colour carries the conditions it was reached by');
  }

  // A heading nobody anticipated must still reach the screen. This is the whole
  // safety of routing by title: unknown falls to `more`, never to nowhere.
  const grouped = groupSections([
    { title: { bg: 'Багрилни качества' }, body: { bg: 'x' } },
    { title: { bg: 'Беритба и обработка' }, body: { bg: 'x' } },
    { title: { bg: 'Нещо съвсем ново' }, body: { bg: 'x' } },
    { title: { bg: 'Източници' }, body: { bg: 'x' } },
  ]);
  const total = Object.values(grouped).reduce((n, l) => n + l.length, 0);
  if (total !== 4)
    fail('profile', new Error(`four sections went in, ${total} came out`));
  else if (grouped.use.length !== 1 || grouped.grow.length !== 1
        || grouped.sources.length !== 1 || grouped.more.length !== 1)
    fail('profile', new Error('a heading was routed to the wrong block'));
  else console.log('  profile: known headings find their block, unknown ones are not lost');

  // §5.4 calls the chalk bath after aluminium acetate mandatory. It used to
  // render as a name in a warning strip at the foot of the page, with nothing
  // scaling it — so the 40 g of chalk it needs appeared nowhere at all. A
  // quantity you cannot read is a quantity you cannot weigh, and a footnote is
  // advice. Two things are asserted: the required step arrives with its own
  // figures, and it arrives exactly once.
  {
    const { expandChain } = await import('./calc/scale.js');
    const chalk = {
      id: 'x-chalk', name: { bg: 'Свързваща баня' }, scaleBy: 'volume', defaultLitres: 5,
      ingredients: [{ id: 'i1', roleCode: 'carbonate', basis: 'grams_per_litre',
        options: [{ id: 'o1', substanceId: 's-chalk', qtyMin: 8, qtyMax: 8 }] }],
    };
    const mordant = {
      id: 'x-mordant', name: { bg: 'Мордантиране' }, requiredFollowOn: ['x-chalk'],
      ingredients: [{ id: 'i1', roleCode: 'mordant', basis: 'percent_wof',
        options: [{ id: 'o1', substanceId: 's-alum', qtyMin: 5, qtyMax: 8 }] }],
    };
    const byId = new Map([[chalk.id, chalk], [mordant.id, mordant]]);
    const ctx = { weightG: 250, fibreClass: 'cellulose' };

    const one = expandChain({ steps: [{ order: 1, recipeId: 'x-mordant' }] }, byId, ctx);
    const injected = one.find(st => st.required);
    if (!injected)
      fail('followOn', new Error('the required step is not in the sequence'));
    else if (!(injected.scaled?.ingredients || []).some(i =>
      i.scaledAmount != null || i.scaledMin != null))
      fail('followOn', new Error('the required step arrives without quantities'));
    else console.log('  followOn: the required step is in the sequence, with its figures');

    // Placed by the owner herself, it is hers, and must not be doubled.
    const both = expandChain(
      { steps: [{ order: 1, recipeId: 'x-mordant' }, { order: 2, recipeId: 'x-chalk' }] },
      byId, ctx);
    const chalkCount = both.filter(st => st.recipe?.id === 'x-chalk').length;
    if (chalkCount !== 1)
      fail('followOn', new Error(`the chalk bath appears ${chalkCount} times, not once`));
    else console.log('  followOn: a step already in the plan is not injected again');

    // The numbers belong to the plan. An injected step takes none.
    if (injected.order != null)
      fail('followOn', new Error('the required step took a number of its own'));
  }

  // Logic passing does not prove the screen shows it. The recipe record is
  // rendered and the chalk bath's own figure looked for in the DOM: 8 g/L over
  // five litres is 40 g, and that number never once reached the page while the
  // follow-on was a name in a warning strip.
  {
    const recipes = (await import('./modules/recipes.js')).default
      || await import('./modules/recipes.js');
    const chalk = {
      id: 'zz-chalk', name: { bg: 'Свързваща баня', en: 'Binding bath' },
      type: 'finish', version: 1, appliesTo: ['cellulose'], scaleBy: 'volume',
      defaultLitres: 5, tempC: 60, heldMinutes: 10, requiredFollowOn: [],
      ingredients: [{ id: 'i1', roleCode: 'carbonate', basis: 'grams_per_litre',
        options: [{ id: 'o1', substanceId: 'zz-sub', qtyMin: 8, qtyMax: 8 }] }],
    };
    const mordant = {
      id: 'zz-mordant', name: { bg: 'Мордантиране с ацетат', en: 'Acetate mordant' },
      type: 'mordant', version: 1, appliesTo: ['cellulose'], scaleBy: 'weight',
      tempC: 70, heldMinutes: 60, requiredFollowOn: ['zz-chalk'],
      ingredients: [{ id: 'i1', roleCode: 'mordant', basis: 'percent_wof',
        options: [{ id: 'o1', substanceId: 'zz-sub2', qtyMin: 5, qtyMax: 8 }] }],
    };
    await db.put('substances', { id: 'zz-sub', name: { bg: 'Креда', en: 'Chalk' } });
    await db.put('substances', { id: 'zz-sub2', name: { bg: 'Ацетат', en: 'Acetate' } });
    await db.put('recipes', chalk);
    await db.put('recipes', mordant);

    // Opened by the address, which is the point: a record that only opens by
    // clicking cannot be linked, bookmarked, reloaded, or returned to with the
    // back button (§8.0d).
    recipes.reset?.();
    recipes.open('zz-mordant');
    await recipes.render(root);
    await settle();

    const text = root.textContent || '';
    if (!text.includes('Свързваща баня'))
      fail('followOn', new Error('the recipe record does not show the required step'));
    else if (!/\b40\b/.test(text))
      fail('followOn', new Error('the required step is shown without its 40 g of chalk'));
    else console.log('  followOn: the record shows the required step and its 40 g');

    await db.remove('recipes', 'zz-mordant');
    await db.remove('recipes', 'zz-chalk');
    recipes.reset?.();
    // Deliberately not `location.hash = …`: in jsdom that fires the router,
    // which starts a render of its own that lands *after* the next guard has
    // done its own render and quietly replaces the screen underneath it. That
    // is what made the work-view guard pass and fail on alternate runs.
  }

  // The work view is the screen a person reads while standing at the scale, so
  // its inputs have to move the figures. They did not on the record: the same
  // weight and bath-volume fields appear there and in the editor, but only the
  // editor has a `.scaleblock` to replace, so typing a bath volume changed
  // nothing and a volume-scaled recipe showed a dash where its quantity should
  // be. It looked like missing data rather than a dead control.
  {
    const recipes = (await import('./modules/recipes.js')).default
      || await import('./modules/recipes.js');
    await db.put('substances', { id: 'zz-chalk2', name: { bg: 'Креда', en: 'Chalk' } });
    await db.put('recipes', {
      id: 'zz-vol', name: { bg: 'Обемна баня', en: 'Volume bath' }, type: 'mordant',
      version: 1, appliesTo: ['cellulose'], scaleBy: 'volume', tempC: 60, heldMinutes: 10,
      requiredFollowOn: [],
      ingredients: [{ id: 'i1', roleCode: 'assistant', basis: 'grams_per_litre',
        options: [{ id: 'o1', substanceId: 'zz-chalk2', qtyMin: 10, qtyMax: 10 }] }],
    });

    recipes.reset?.();
    recipes.open('zz-vol');
    await recipes.render(root);
    await settle();

    // Waited for rather than assumed. `settle()` drains what is already
    // queued; a render that starts a fresh chain of awaits can finish after it,
    // and a guard that reads the DOM one tick too early reports a missing
    // control instead of a slow one — which sends the next person looking in
    // exactly the wrong place.
    let litres = null;
    for (let i = 0; i < 40 && !litres; i++) {
      litres = root.querySelector('[data-scale="bathLitres"]');
      if (!litres) await new Promise(r => setTimeout(r, 25));
    }
    if (!litres) {
      fail('workview', new Error('the record has no bath volume field'));
    } else {
      litres.value = '5';
      litres.dispatchEvent(new window.Event('input', { bubbles: true }));
      await settle();
      // Ten grams a litre over five litres is fifty.
      if (!/\b50\b/.test(root.textContent || ''))
        fail('workview', new Error('setting the bath volume did not change the quantity'));
      else console.log('  workview: the record recomputes when the bath volume changes');
    }

    await db.remove('recipes', 'zz-vol');
    recipes.reset?.();
  }

  // A band must render as a word. Bands are terms with a range attached and
  // live in their own store, which `label()` never read: chips said "калиева
  // стипца (medium)" in the middle of a Bulgarian row, and the band and pH
  // dropdowns in the reference search were empty because `options()` found no
  // terms for those dimensions at all. Both symptoms, one cause.
  {
    const { label, options, invalidateVocab } = await import('./ui.js');
    invalidateVocab();
    if (await label('concentration', 'medium') === 'medium')
      fail('bands', new Error('a band renders as its raw code'));
    else if (!(await options('ph', null)).includes('алкално'))
      fail('bands', new Error('a band dimension offers no options'));
    else console.log('  bands: band and pH codes render as words and fill their dropdowns');
  }

  // A chain at the head of the recipes list, showing its steps — and showing
  // its fibre class as a word. `appliesTo` is a single code on a chain in the
  // model and a list of them in the studio's own data; handed an array,
  // `label()` returns what it was given, and a bare English "cellulose" landed
  // in the middle of a Bulgarian line. Both shapes are asserted.
  {
    const recipes = (await import('./modules/recipes.js')).default
      || await import('./modules/recipes.js');
    await db.put('recipes', { ...(await db.get('recipes', 'zz-step')) || {},
      id: 'zz-step', name: { bg: 'Стъпка едно', en: 'Step one' }, type: 'scour',
      version: 1, appliesTo: ['cellulose'], ingredients: [] });
    for (const [id, applies] of [['zz-chain-a', ['cellulose']], ['zz-chain-b', 'cellulose']]) {
      await db.put('chains', { id, name: { bg: `Верига ${id}` }, appliesTo: applies,
        steps: [{ order: 1, recipeId: 'zz-step' }] });
    }

    recipes.reset?.();
    await recipes.render(root);
    await settle();
    let cards = [];
    for (let i = 0; i < 40 && cards.length < 2; i++) {
      cards = [...root.querySelectorAll('.chaincard')];
      if (cards.length < 2) await new Promise(r => setTimeout(r, 25));
    }
    if (cards.length < 2) {
      fail('chains', new Error('the chains are not at the head of the recipes list'));
    } else if (cards.some(c => c.textContent.includes('cellulose'))) {
      fail('chains', new Error('a fibre class renders as its raw code on a chain card'));
    } else if (!cards.every(c => c.textContent.includes('Стъпка едно'))) {
      fail('chains', new Error('a chain card does not show the steps it is made of'));
    } else {
      console.log('  chains: they head the recipes list, with their steps and a fibre in words');
    }

    await db.remove('chains', 'zz-chain-a');
    await db.remove('chains', 'zz-chain-b');
    await db.remove('recipes', 'zz-step');
    recipes.reset?.();
  }

  // A technique is its description, and the list used to cut it at 120
  // characters with an ellipsis — "при ант…", "нароч…". Cards hold the whole
  // text and let CSS clamp what will not fit, so nothing is thrown away before
  // it reaches the page. Asserted on the longest seeded description.
  {
    const techniques = (await import('./modules/techniques.js')).default
      || await import('./modules/techniques.js');
    const all = await db.all('techniques');
    const longest = all
      .map(x => ({ x, n: (x.description?.bg || '').length }))
      .sort((a, b) => b.n - a.n)[0];

    if (!longest || longest.n < 150) {
      console.log('  techniques: no description long enough to test the clamp');
    } else {
      techniques.reset?.();
      await techniques.render(root);
      await settle();
      let cards = [];
      for (let i = 0; i < 40 && !cards.length; i++) {
        cards = [...root.querySelectorAll('.techcard')];
        if (!cards.length) await new Promise(r => setTimeout(r, 25));
      }
      const mine = cards.find(c => c.textContent.includes(longest.x.name.bg));
      const shown = mine?.querySelector('.techdesc')?.textContent || '';
      if (!cards.length) fail('techniques', new Error('the list is not cards'));
      else if (shown.includes('…'))
        fail('techniques', new Error('the description is still truncated in the markup'));
      else if (shown.trim() !== longest.x.description.bg.trim())
        fail('techniques', new Error('the card does not carry the whole description'));
      else console.log('  techniques: the whole description reaches the card');
      techniques.reset?.();
    }
  }

  // One thing, one name. The navigation said "Моята работа" and the screen it
  // opened was headed "Тестове"; backup said "Резервно копие" and opened
  // "Архив". A person cannot tell whether they are in the right place, and it
  // is the kind of drift that arrives one screen at a time.
  {
    const { t, setLang } = await import('./i18n.js');
    const pairs = [['nav.trials', 'trials.title'], ['nav.backup', 'backup.title']];
    const wrong = [];
    for (const lang of ['bg', 'en']) {
      setLang?.(lang);
      for (const [navKey, titleKey] of pairs)
        if (t(navKey) !== t(titleKey)) wrong.push(`${lang}: ${t(navKey)} ≠ ${t(titleKey)}`);
    }
    setLang?.('bg');
    if (wrong.length) fail('naming', new Error(wrong.join('; ')));
    else console.log('  naming: a screen is headed by the name that opens it');
  }

  // The diary answers three questions, not two: what is running, what is
  // waiting, and what is done. Cloth that has been mordanted and then forgotten
  // is the most avoidable waste in the studio, and it had no place on the page
  // — it lived only inside the choosing screen.
  {
    const trials = (await import('./modules/trials.js')).default
      || await import('./modules/trials.js');
    const { newRecord } = db;
    const ready = { ...newRecord(), id: 'zz-ready', label: 'ZZ-1', name: 'Готов плат',
      weightG: 100, fibres: [], stateEvents: [{ stateCode: 'mordanted', date: '2026-07-01' }],
      events: [] };
    const busy = { ...newRecord(), id: 'zz-busy', label: 'ZZ-2', name: 'Зает плат',
      weightG: 100, fibres: [], stateEvents: [{ stateCode: 'mordanted', date: '2026-07-01' }],
      events: [] };
    await db.put('fabrics', ready);
    await db.put('fabrics', busy);
    await db.put('trials', { ...newRecord(), id: 'zz-running', status: 'in_progress',
      fabricIds: ['zz-busy'], placements: [], steps: [] });

    trials.reset?.();
    await trials.render(root);
    await settle();
    let cards = [];
    for (let i = 0; i < 40 && !cards.length; i++) {
      cards = [...root.querySelectorAll('.readycard')];
      if (!cards.length) await new Promise(r => setTimeout(r, 25));
    }
    const names = cards.map(c => c.textContent);
    if (!names.some(n => n.includes('Готов плат')))
      fail('ready', new Error('mordanted cloth is not offered on the diary'));
    else if (names.some(n => n.includes('Зает плат')))
      fail('ready', new Error('cloth already carrying unfinished work is offered again'));
    else console.log('  ready: waiting cloth is on the diary, and busy cloth is not');

    await db.remove('trials', 'zz-running');
    await db.remove('fabrics', 'zz-ready');
    await db.remove('fabrics', 'zz-busy');
    trials.reset?.();
  }

  // No two navigation entries wear the same mark. Three marks were serving
  // seven places — substances shared one with calculators, sources with
  // recipes, stock with backup and packs — and a mark that does not
  // distinguish accompanies nothing (§13.4). Read from the source rather than
  // the DOM, because the footer and the phone bar are not always rendered.
  {
    const src = fs.readFileSync('./app.js', 'utf8');
    const seen = new Map();
    const clash = [];
    for (const m of src.matchAll(/\{\s*id:\s*'([a-z]+)',\s*icon:\s*'(i-[a-z]+)'([^}]*)\}/g)) {
      const [, id, ico, rest] = m;
      if (m[0].trimStart().startsWith('//')) continue;
      const label = (rest.match(/label:\s*'([^']+)'/) || [, id])[1];
      const key = `${id}:${label}`;
      if (seen.has(ico) && seen.get(ico) !== key) clash.push(`${ico}: ${seen.get(ico)} and ${key}`);
      else seen.set(ico, key);
    }
    if (clash.length) fail('icons', new Error(`marks shared: ${clash.join('; ')}`));
    else console.log(`  icons: ${seen.size} navigation entries, ${seen.size} distinct marks`);
  }

  // A counted noun has to agree with its number. "1 записани платове" in a
  // warning meant to be taken seriously reads as though nobody proofread it,
  // and Bulgarian needs the counted form rather than the plural after a
  // numeral — два плата, never два платове.
  {
    const { plural } = await import('./i18n.js');
    if (plural(1, 'плат', 'плата') !== '1 плат' || plural(2, 'плат', 'плата') !== '2 плата')
      fail('plural', new Error('a counted noun does not agree with its number'));
    else console.log('  plural: a counted noun agrees with its number');
  }

  // The address is the state, not a copy of it. Four things, each of which was
  // broken before 0.85.0: a record opens from its address; the chains tab has
  // one; giving no record returns to the list rather than leaving the last one
  // open; and moving within the module keeps the search that led there, which
  // `route(true)` on every hash change used to throw away.
  {
    const recipes = (await import('./modules/recipes.js')).default
      || await import('./modules/recipes.js');
    await db.put('recipes', {
      id: 'zz-addr', name: { bg: 'Адресируема рецепта', en: 'Addressable' },
      type: 'mordant', version: 1, appliesTo: ['cellulose'], ingredients: [],
    });

    recipes.reset?.();
    recipes.open('zz-addr');
    await recipes.render(root);
    await settle();
    if (!(root.textContent || '').includes('Адресируема рецепта'))
      fail('address', new Error('#/recipes/<id> does not open the record'));
    else console.log('  address: a recipe opens from its address');

    recipes.open('chains');
    await recipes.render(root);
    await settle();
    const onChains = [...root.querySelectorAll('[data-mode]')]
      .some(b => b.dataset.mode === 'chains' && b.className.includes('active'));
    if (!onChains) fail('address', new Error('#/recipes/chains does not open the chains tab'));
    else console.log('  address: the chains tab has an address of its own');

    recipes.open();
    await recipes.render(root);
    await settle();
    if ((root.textContent || '').includes('Адресируема рецепта')
        && !root.querySelector('tbody tr')) {
      fail('address', new Error('an address with no record left the last one open'));
    } else console.log('  address: no record in the address means the list');

    // The search must survive going into a record and back, because `reset()`
    // now runs only when the module itself changes.
    const box = root.querySelector('[data-search]');
    if (box) {
      box.value = 'Адресируема';
      box.dispatchEvent(new window.Event('input', { bubbles: true }));
      await settle();
      recipes.open('zz-addr');
      await recipes.render(root);
      await settle();
      recipes.open();
      await recipes.render(root);
      await settle();
      const still = root.querySelector('[data-search]')?.value;
      if (still !== 'Адресируема')
        fail('address', new Error(`the search was lost on the way back (${still || 'empty'})`));
      else console.log('  address: the search survives opening a record and coming back');
    }

    await db.remove('recipes', 'zz-addr');
    recipes.reset?.();
  }

// The shelf reaches the material (§11b). Stock was a ledger that was only ever
// written to: a material opened straight into a form, so "do I have this" could
// be answered only by pressing Edit.
{
  const substances = (await import('./modules/substances.js')).default;
  const { jarState, stateOfSubstance } = await import('./stock-logic.js');

  // The rules first, on their own, because a chip that is right for the wrong
  // reason is a chip that will be wrong later.
  const cases = [
    ['a full jar', { quantity: { value: 500 }, remaining: { value: 400 } }, 'have'],
    ['a jar under the fallback fraction', { quantity: { value: 500 }, remaining: { value: 70 } }, 'low'],
    ['a jar at zero', { quantity: { value: 500 }, remaining: { value: 0 } }, 'empty'],
    ['a jar under its own threshold', { quantity: { value: 5000 }, remaining: { value: 900 }, lowBelow: 1000 }, 'low'],
    ['a jar over its own threshold', { quantity: { value: 5000 }, remaining: { value: 1200 }, lowBelow: 1000 }, 'have'],
    ['a wanted entry', { status: 'wanted' }, 'wanted'],
  ];
  for (const [what, jar, want] of cases) {
    const got = jarState(jar);
    if (got !== want) fail('shelf', new Error(`${what} reads as ${got}, not ${want}`));
  }
  if (stateOfSubstance([{ quantity: { value: 5, unit: 'l' }, remaining: { value: 4 } }, { status: 'wanted' }]) !== 'have')
    fail('shelf', new Error('a wanted entry beside a real jar still says wanted'));
  if (stateOfSubstance([]) !== null)
    fail('shelf', new Error('a material with no jars claims a state'));
  console.log('  shelf: the four states are read from the jars, and silence stays silent');

  await db.put('substances', db.newRecord({ id: 'zz-shelf', name: { bg: 'Кошинил' }, category: 'dyestuff' }));

  // Read, not edit: the jars must be on screen without pressing anything.
  substances.reset?.();
  substances.open('zz-shelf');
  await substances.render(root);
  await settle();
  if (root.querySelector('[data-f="category"]'))
    fail('shelf', new Error('a material opens straight into a form'));
  else if (!root.querySelector('[data-jar-new]'))
    fail('shelf', new Error('the read view offers no way to add a jar'));
  else console.log('  shelf: a material opens for reading, with its jars on it');

  // Wanting something with no jar, and taking it back.
  await click(root.querySelector('[data-want]'));
  await settle();
  const wanted = (await db.all('stock')).filter(j => j.substanceId === 'zz-shelf');
  if (wanted.length !== 1 || wanted[0].status !== 'wanted')
    fail('shelf', new Error('wanting a material wrote no wanted entry'));
  else if (!(root.textContent || '').includes('искам'))
    fail('shelf', new Error('a wanted material does not say so'));
  else console.log('  shelf: wanting a material with no jar is written down');

  await click(root.querySelector('[data-unwant]'));
  await settle();
  if ((await db.all('stock')).some(j => j.substanceId === 'zz-shelf'))
    fail('shelf', new Error('taking it off the list left the entry behind'));
  else console.log('  shelf: taking it off the list removes the entry');

  // A jar, written at its own address and read back on the material.
  substances.open('zz-shelf', 'jar', 'new');
  await substances.render(root);
  await settle();
  const set = (sel, v) => {
    const el = root.querySelector(sel);
    if (!el) return false;
    el.value = v;
    el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    return true;
  };
  if (!set('[data-j="supplier"]', 'Кремер') || !set('[data-j="quantity.value"]', '500')
      || !set('[data-j="remaining.value"]', '60') || !set('[data-j="quantity.unit"]', 'ml')) {
    fail('shelf', new Error('the jar form is missing its fields'));
  } else {
    await click(root.querySelector('[data-jar-save]'));
    await settle();
    const saved = (await db.all('stock')).filter(j => j.substanceId === 'zz-shelf');
    if (saved.length !== 1 || saved[0].supplier !== 'Кремер')
      fail('shelf', new Error('the jar was not written'));
    else if (saved[0].remaining?.unit !== 'ml')
      fail('shelf', new Error('the amount left did not take the unit of the jar'));
    else console.log('  shelf: a jar is written from its own address');

    substances.open('zz-shelf');
    await substances.render(root);
    await settle();
    const shown = root.textContent || '';
    if (!shown.includes('Кремер'))
      fail('shelf', new Error('the jar is not readable on the material'));
    else if (!shown.includes('привършва'))
      fail('shelf', new Error('a jar at 60 of 500 ml is not called running low'));
    else console.log('  shelf: the jar and its state are read on the material');

    // And the list says the same thing, which is what the filter runs on.
    substances.reset?.();
    substances.open();
    await substances.render(root);
    await settle();
    const row = [...root.querySelectorAll('tbody tr')]
      .find(tr => (tr.textContent || '').includes('Кошинил'));
    if (!row) fail('shelf', new Error('the material is not in the list'));
    else if (!(row.textContent || '').includes('привършва'))
      fail('shelf', new Error('the list row carries no state'));
    else console.log('  shelf: the list says what the material record says');
  }

  for (const j of (await db.all('stock')).filter(j => j.substanceId === 'zz-shelf')) await db.remove('stock', j.id);
  await db.remove('substances', 'zz-shelf');
  substances.reset?.();
}

// The bottle on the shelf reaches the calculator (§11b). The jars carried a
// concentration from the day Stock existed and nothing read it: the calculator
// asked for a vinegar strength and suggested nine.
{
  const tools = (await import('./modules/tools.js')).default;

  await db.put('substances', db.newRecord({ id: 'zz-vin', name: { bg: 'Оцет' },
                                            category: 'modifier', phDirection: 'acid' }));
  await db.put('stock', db.newRecord({ id: 'zz-vinjar', substanceId: 'zz-vin', form: 'liquid',
                                       supplier: 'Кремер', concentrationPercent: 5,
                                       quantity: { value: 5, unit: 'l' }, remaining: { value: 4, unit: 'l' } }));

  tools.reset?.();
  tools.open('alum');
  await tools.render(root);
  await settle();

  const picker = root.querySelector('[data-calc="alum.vinegarJar"]');
  if (!picker) {
    fail('shelf', new Error('the calculator offers no bottle from the shelf'));
  } else if (![...picker.options].some(o => o.value === 'zz-vinjar')) {
    fail('shelf', new Error('the vinegar jar is not among the bottles offered'));
  } else {
    picker.value = 'zz-vinjar';
    picker.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    await settle();
    const strength = root.querySelector('[data-calc="alum.vinegar"]');
    if (Number(strength?.value) !== 5)
      fail('shelf', new Error(`choosing the bottle left the strength at ${strength?.value}`));
    else console.log('  shelf: choosing a bottle puts its strength into the calculator');
  }

  // A wanted entry is not a bottle and must not be offered.
  await db.put('stock', db.newRecord({ id: 'zz-vinwant', substanceId: 'zz-vin', status: 'wanted',
                                       concentrationPercent: 25 }));
  tools.reset?.();
  tools.open('alum');
  await tools.render(root);
  await settle();
  const again = root.querySelector('[data-calc="alum.vinegarJar"]');
  if ([...(again?.options || [])].some(o => o.value === 'zz-vinwant'))
    fail('shelf', new Error('a bottle she does not own is offered to the calculator'));
  else console.log('  shelf: a wanted bottle is not offered as one she has');

  await db.remove('stock', 'zz-vinjar');
  await db.remove('stock', 'zz-vinwant');
  await db.remove('substances', 'zz-vin');
  tools.reset?.();
}

// A number is worn by one piece (§13av). Both П-04s on the owner's shelf were
// typed by hand, and nothing ever checked whether the number was already taken.
{
  const fabrics = (await import('./modules/fabrics.js')).default;
  const { labelKey } = await import('./modules/fabrics.js');

  if (labelKey('П-04') !== labelKey('П-004'))
    fail('label', new Error('П-04 and П-004 read as two different tags'));
  else console.log('  label: the same number written two ways is one tag');

  await db.put('fabrics', db.newRecord({ id: 'zz-tag', label: 'П-04', name: 'вече носи номера',
                                         composition: [], stateEvents: [] }));

  fabrics.reset?.();
  fabrics.open('new');
  await fabrics.render(root);
  await settle();
  const typed = root.querySelector('[data-f="label"]');
  if (!typed) {
    fail('label', new Error('the new piece form has no label field'));
  } else {
    typed.value = 'П-004';
    typed.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    const nameField = root.querySelector('[data-f="name"]');
    if (nameField) {
      nameField.value = 'втори претендент';
      nameField.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    }
    const before = (await db.all('fabrics')).length;
    await click(root.querySelector('[data-save]'));
    await settle();
    const after = await db.all('fabrics');
    if (after.length !== before)
      fail('label', new Error('a number already worn was accepted onto a second piece'));
    else console.log('  label: a number already worn is refused');
  }

  // And a reserved number steps over what is worn rather than trusting the
  // counter to be ahead of it.
  await db.put('settings', { key: 'fabricLabelCounter', value: 3 });
  const { reserveLabel } = await import('./modules/fabrics.js');
  const next = await reserveLabel();
  if (labelKey(next) === labelKey('П-04'))
    fail('label', new Error('the counter handed out a number already pinned to a piece'));
  else console.log('  label: a reserved number steps over one already in use');

  // The duplicate that already exists is named, because the application cannot
  // rewrite a paper tag.
  await db.put('fabrics', db.newRecord({ id: 'zz-tag2', label: 'П-004', name: 'близнак',
                                         composition: [], stateEvents: [] }));
  fabrics.reset?.();
  fabrics.open();
  await fabrics.render(root);
  await settle();
  if (!root.querySelector('.notice'))
    fail('label', new Error('two pieces wearing one number are not reported'));
  else console.log('  label: two pieces wearing one number are reported in the list');

  await db.remove('fabrics', 'zz-tag');
  await db.remove('fabrics', 'zz-tag2');
  fabrics.reset?.();
}

  // The old Stock addresses still lead somewhere (§11b). Stock is no longer a
  // screen; `#/materials/<jarId>` must find the jar's material and open the jar
  // inside it, because an address already saved must not become a dead end.
  {
    const materials = (await import('./modules/materials.js')).default;
    await db.put('substances', db.newRecord({ id: 'zz-jaralum', name: { bg: 'Адресируем материал' }, category: 'mordant' }));
    await db.put('stock', db.newRecord({ id: 'zz-oldjar', substanceId: 'zz-jaralum', form: 'powder',
                                         quantity: { value: 500, unit: 'g' }, remaining: { value: 400, unit: 'g' } }));

    let went = null;
    const realHash = dom.window.location.hash;
    materials.open('zz-oldjar');
    await materials.render(root);
    await settle();
    went = dom.window.location.hash;
    if (went !== '#/substances/zz-jaralum/jar/zz-oldjar')
      fail('address', new Error(`the old stock address led to ${went}, not to the jar`));
    else console.log('  address: an old stock address opens the jar inside its material');

    // A jar whose material is gone must land on the list, not on a blank screen.
    //
    // Watching where it ENDS UP is not the same question: a redirect into a
    // material that does not exist is itself sent back to the list, so the
    // final address is right by accident whatever this module does. The first
    // step is what is being asked about, so the first step is what is recorded.
    await db.remove('stock', 'zz-oldjar');
    const steps = [];
    const spy = () => steps.push(dom.window.location.hash);
    dom.window.addEventListener('hashchange', spy);
    materials.open('zz-oldjar');
    await materials.render(root);
    await settle();
    dom.window.removeEventListener('hashchange', spy);
    if (steps[0] !== '#/substances')
      fail('address', new Error(`a jar with no material led first to ${steps[0]}`));
    else console.log('  address: a jar whose material is gone lands on the list');

    dom.window.location.hash = realHash;
    await db.remove('substances', 'zz-jaralum');
    materials.reset?.();
  }

  // An address naming a record that no longer exists — a bookmark to something
  // deleted, the back button after deleting it. Found on Materials and then
  // present in five more modules: `get()` returns nothing, the render throws,
  // and a thrown render leaves the PREVIOUS screen in place, so the application
  // appears to ignore the address rather than to have failed (§11b).
  {
    const gone = ['plants', 'recipes', 'techniques', 'library', 'substances', 'fabrics'];
    let bad = 0;
    for (const name of gone) {
      const mod = (await import(`./modules/${name}.js`)).default;
      mod.reset?.();
      // Nothing of this id was ever written. The Library reaches a record
      // through a tab, so its missing-record address is one segment deeper —
      // pointed at the tab it actually uses, not at the module name, or this
      // would test that `#/library/zz-never-existed` falls back to the glossary
      // and prove nothing about the case it exists for.
      if (name === 'library') mod.open('sources', 'zz-never-existed');
      else mod.open('zz-never-existed');
      try {
        await mod.render(root);
        await settle();
      } catch (err) {
        fail('address', new Error(`${name}: an address to a deleted record throws — ${err.message}`));
        bad++;
      }
      mod.reset?.();
    }
    if (!bad) console.log(`  address: all ${gone.length} modules survive an address to a deleted record`);
  }

  // The seven modules converted in §13ad. The conversion was mechanical, which
  // is exactly why it is checked mechanically: seven near-identical edits are
  // seven chances to convert six of them. Each is asked three questions — does
  // an address open the record, does an address with no record return to the
  // list, and does the module still have the `open()` the router calls at all.
  //
  // The third question is not redundant. A module with no `open()` fails
  // silently: `MODULES[id].open?.(...)` is optional-called, so the address is
  // simply ignored and the list appears, which looks like a working list.
  {
    const cases = [
      ['plants',     'plants',       { nameCommon: { bg: 'Адресируемо растение' }, parts: [], colours: [] }, 'Адресируемо растение'],
      ['substances', 'substances',   { name: { bg: 'Адресируемо вещество' }, category: 'mordant' }, 'Адресируемо вещество'],
      ['techniques', 'techniques',   { name: { bg: 'Адресируема техника' }, category: 'resist', description: { bg: 'описание' } }, 'Адресируема техника'],
      // The Library reaches a record through a tab, so its record address is
      // `#/library/sources/<id>` — one segment deeper than every other module.
      // The fifth element carries whatever comes before the id; empty for the
      // modules whose record sits directly under the module name.
      ['library',    'sources',      { name: 'Адресируем източник', kind: 'book', author: '' }, 'Адресируем източник', ['sources']],
      ['fabrics',    'fabrics',      { label: 'ПЛ-77', name: 'Адресируемо парче', composition: [], stateEvents: [] }, 'Адресируемо парче'],
      ['reference',  'combinations', { key: { dyeSource: { plantId: 'seed:test' } }, confidence: 'practice' }, null],
    ];

    for (const [name, store, extra, marker, prefix = []] of cases) {
      const mod = (await import(`./modules/${name}.js`)).default;
      if (typeof mod.open !== 'function') {
        fail('address', new Error(`${name} has no open() — its address is ignored, not obeyed`));
        continue;
      }
      const id = 'zz-addr-' + name;
      await db.put(store, db.newRecord({ id, ...extra }));

      mod.reset?.();
      mod.open(...prefix, id);
      await mod.render(root);
      await settle();
      // The record's own words AND a Back button, not either one.
      //
      // The marker alone was not enough and had not been: a record's name
      // appears in the LIST as well as on the record, so a module that ignored
      // the address entirely and fell back to its list still contained the
      // marker and still passed. Caught by deliberately breaking the Library's
      // record address and watching this layer stay green — a check aimed at
      // the wrong thing is not neutral, it reads as cover.
      //
      // Back is the honest half: every record screen carries one and no list
      // does. The marker stays because Back alone would not notice a module
      // opening the WRONG record.
      const back = !!root.querySelector('[data-goto], [data-back]');
      const opened = marker
        ? ((root.textContent || '').includes(marker) && back)
        : back;
      if (!opened) fail('address', new Error(`#/${[name, ...prefix].join('/')}/<id> does not open the record`));

      mod.open(...prefix);
      await mod.render(root);
      await settle();
      const backToList = marker
        ? !(root.textContent || '').includes(marker) || !!root.querySelector('tbody tr, [data-open]')
        : !root.querySelector('[data-goto], [data-back]');
      if (!backToList) fail('address', new Error(`${name}: an address with no record left the last one open`));

      await db.remove(store, id);
      mod.reset?.();
    }
    console.log(`  address: all ${cases.length} converted modules obey their address`);
  }

  // The reference tab is an address of its own, as the chains tab is. It was
  // the one address in the application that resolved to the wrong screen:
  // `#/reference/records` showed the search until the module had an `open()`.
  {
    const reference = (await import('./modules/reference.js')).default;
    reference.reset?.();
    reference.open('records');
    await reference.render(root);
    await settle();
    const onRecords = [...root.querySelectorAll('[data-refmode]')]
      .some(b => b.dataset.refmode === 'records' && b.className.includes('active'));
    if (!onRecords) fail('address', new Error('#/reference/records does not open the records tab'));
    else console.log('  address: the reference records tab has an address of its own');
    reference.reset?.();
  }

  // Saving is not leaving. Every converted module now changes the address after
  // a successful save, and the unsaved-work guard reads an address change as a
  // departure unless it is told otherwise (§13ad).
  {
    const { isDirty, markDirty } = await import('./dirty.js');
    const sources = (await import('./modules/library.js')).default;
    await db.put('sources', db.newRecord({ id: 'zz-dirty', name: 'Тест', kind: 'book', author: '' }));
    sources.reset?.();
    sources.open('sources', 'zz-dirty');
    await sources.render(root);
    await settle();
    if (!root.querySelector('[data-save]')) {
      fail('guard', new Error('the source form did not open, so saving cannot be tested'));
    } else {
      markDirty();
      await click(root.querySelector('[data-save]'));
      await settle();
      if (isDirty()) fail('guard', new Error('a saved record is still marked unsaved'));
      else console.log('  guard: a save clears the unsaved mark before the address moves');
    }
    await db.remove('sources', 'zz-dirty');
    sources.reset?.();
  }

  // Counting vocabulary terms says nothing about whether the codes actually in
  // the data have one. Avocado read "seed, обвивка" on screen for as long as
  // `seed` and `shell` were used in the seed file and absent from the
  // vocabulary — an English code in the middle of a Bulgarian row, which is the
  // documented failure of §13e·3 arriving by a different door.
  {
    const { VOCABULARY, BANDS } = await import('./vocab.js');
    const ALL_TERMS = [...VOCABULARY, ...BANDS];
    const has = (dim, code) => ALL_TERMS.some(v => v.dimension === dim && v.code === code);

    // Every place a stored code is looked up against a dimension. The first
    // version of this guard checked plant parts alone, and `confidence:
    // 'practice'` — on all thirty-one seeded combinations — went on rendering as
    // a raw English word and a grey dot for exactly as long.
    const orphan = new Set();
    const check = (dim, code) => { if (code && !has(dim, code)) orphan.add(`${dim}:${code}`); };

    for (const p of await db.all('plants')) {
      for (const part of p.parts || []) {
        check('plant_part', part.partCode);
        for (const c of part.chemistry || []) {
          check('chemistry_class', c.classCode);
          check('chemistry_level', c.level);
        }
        for (const d of part.dosing || []) check('placement_condition', d.condition);
      }
      for (const c of p.colours || []) {
        check('fibre_class', c.fibreClass);
        check('mordant_type', c.mordantCode);
        check('process', c.processCode);
      }
      check('availability', p.availability);
      // Not a code: a map of field name to how well that field is known.
      for (const level of Object.values(p.confidence || {})) check('confidence', level);
    }
    for (const r of await db.all('combinations')) {
      check('confidence', r.confidence);
      const k = r.key || {};
      check('plant_part', k.dyeSource?.partCode);
      check('fibre_class', k.fibreClass);
      check('process', k.processCode);
      check('mordant_type', k.mordantCode === 'none' ? null : k.mordantCode);
      check('concentration', k.mordantBand);
      check('ph', k.medium?.phCode);
    }
    for (const r of await db.all('recipes')) {
      for (const ing of r.ingredients || []) {
        check('ingredient_role', ing.roleCode);
        for (const o of ing.options || []) check('plant_part', o.partCode);
      }
    }

    if (orphan.size)
      fail('vocabulary', new Error(`codes used but not in the vocabulary: ${[...orphan].join(', ')}`));
    else console.log('  vocabulary: every code in the seeded data has a term');
  }

  // Opening a record and saving it without an edit must change nothing. A
  // select built only from the vocabulary quietly dropped any code the
  // vocabulary did not know, so a plant lost a part to a form nobody had
  // touched. Tested with a code deliberately outside the vocabulary.
  {
    const { options } = await import('./ui.js');
    const html = await options('plant_part', 'not_a_real_code');
    if (!html.includes('value="not_a_real_code" selected'))
      fail('options', new Error('a select drops a value the vocabulary does not know'));
    else console.log('  options: an unknown code survives the form instead of being erased');
  }

  // The library is a reference, so a section either stands on every plant or it
  // does not exist. Before this was enforced, thirty-two plants had four
  // sections and seven had ten, which read as two different books bound
  // together. The four gardening headings and the recipe prose left; what is
  // named here is the whole of what may remain.
  {
    // Six since §13ay. „Как се държи" joined as observed behaviour — what the
    // plant actually gives — beside „Багрилни качества", which is the recipe.
    // „Защо действа" did NOT join: it is „Багрилна съставка" asked in plainer
    // words, and it was folded into it rather than added beside it.
    const KEEP = ['Багрилни качества', 'Използвани части', 'Багрилна съставка',
                  'Как се държи', 'Беритба и обработка', 'Източници'];
    const seeded = await db.all('plants');
    const seen = new Map();
    for (const p of seeded) {
      for (const s of p.sections || []) {
        const title = s.title?.bg || '?';
        seen.set(title, (seen.get(title) || 0) + 1);
      }
    }
    const stranger = [...seen.keys()].filter(k => !KEEP.includes(k));
    if (stranger.length)
      fail('library', new Error(`heading outside the five: ${stranger.join(', ')}`));
    else console.log('  library: no heading outside the six');

    // "Беритба и обработка" is deliberately not yet everywhere — forty texts are
    // still to be written — so it is named rather than counted. The other four
    // are complete and a gap in them is a fault.
    const gaps = KEEP.filter(k => k !== 'Беритба и обработка')
                     .filter(k => (seen.get(k) || 0) !== seeded.length);
    if (gaps.length)
      fail('library', new Error(`not on every plant: ${gaps.join(', ')}`));
    else console.log(`  library: all ${KEEP.length} sections stand on all ${seeded.length} plants`);
  }

  // The character text is a field, so it must reach the record without a
  // section to carry it. Opening a plant that has one and finding the words is
  // the only proof; the field existing in the data proves nothing.
  {
    const seeded = await db.all('plants');
    const withChar = seeded.find(p => (p.character?.bg || '').length > 20);
    if (!withChar) {
      fail('character', new Error('no seeded plant carries a character text'));
    } else {
      plants.reset?.();
      await plants.render(root);
      const row = [...root.querySelectorAll('tbody tr')]
        .find(tr => tr.textContent.includes(withChar.nameCommon.bg));
      if (!row) {
        fail('character', new Error(`${withChar.nameCommon.bg} is not in the list`));
      } else {
        await click(row);
        const words = withChar.character.bg.slice(0, 24);
        if (!root.textContent.includes(words))
          fail('character', new Error('the record does not show the character text'));
        else console.log('  character: the text reaches the record without a section');
      }
    }
  }

  plants.reset?.();
  await plants.render(root);
}

// Every declared pack reaches the database.
//
// `sources` was declared in PACKS with a comment saying it is seeded
// deliberately, and left out of the hand-written list app.js looped over. The
// library therefore credited nobody, while the specification and the roadmap
// both said four sources were seeded. Nothing noticed for four releases: the
// screen showed its empty state, which looks exactly like a library whose owner
// has not written anything yet.
//
// The list is now derived from PACKS, so this guard is here to catch the pack
// that is declared and never arrives — by whatever new route. It counts, rather
// than asking whether the store is non-empty, because a pack that half-loads is
// the more likely fault now (§13aa).
{
  const { PACKS } = await import('./seed.js');
  const short = [];
  for (const [name, p] of Object.entries(PACKS)) {
    if (!fs.existsSync(p.file)) { short.push(`${name}: ${p.file} is not there`); continue; }
    const wanted = JSON.parse(fs.readFileSync(p.file, 'utf8'));
    const list = Array.isArray(wanted) ? wanted : (wanted[p.listKey] || []);
    const held = await db.all(p.store);
    const ids = new Set(held.map(r => r.id));
    const missing = list.filter(r => !ids.has('seed:' + r.code)).length;
    if (missing) short.push(`${name}: ${missing} of ${list.length} never arrived`);
  }
  if (short.length) fail('seed', new Error(short.join('; ')));
  else console.log(`  seed: all ${Object.keys(PACKS).length} declared packs reach the database`);
}

// A calculator answers while the question is asked (rule 6, §13s). Every number
// on every calculator could be retyped and nothing moved: there was no `input`
// handler, and the `change` handler returned early for anything that was not a
// `<select>`. The comment in the file said the opposite, which is why it went
// four releases unnoticed — the code was read and believed (§13af).
//
// Driven through the events a person actually generates, not by calling
// `apply()`: the fault was entirely in what was listened for.
{
  const tools = (await import('./modules/tools.js')).default;
  tools.reset?.();
  tools.open('wof');
  await tools.render(root);
  await settle();

  const box = root.querySelector('input[data-calc="wof.weight"]');
  if (!box) {
    fail('calc', new Error('the WOF calculator has no weight field'));
  } else {
    const reading = () => (root.querySelector('.calcout, .out, .result')?.textContent
      || root.textContent || '').replace(/\s+/g, ' ');
    const before = reading();
    box.value = '999';
    box.dispatchEvent(new window.Event('input', { bubbles: true }));
    await settle();
    const after = reading();
    if (before === after)
      fail('calc', new Error('typing a new weight changed nothing on screen'));
    else console.log('  calc: a calculator answers while the number is being typed');

    // And the field keeps the caret, or it recomputes once and then cannot be
    // typed into.
    const still = root.querySelector('input[data-calc="wof.weight"]');
    if (still && document.activeElement !== still)
      fail('calc', new Error('the field lost focus on the first keystroke'));
    else console.log('  calc: the field being typed into keeps its focus');
  }

  // The timer minutes field wrote to `state.timer`, which does not exist.
  const mins = root.querySelector('input[data-calc="timer.minutes"]')
    || (tools.open('timer'), await tools.render(root), await settle(),
        root.querySelector('input[data-calc="timer.minutes"]'));
  if (mins) {
    mins.value = '7';
    mins.dispatchEvent(new window.Event('input', { bubbles: true }));
    await settle();
    if (!(root.textContent || '').includes('07:00'))
      fail('calc', new Error('the timer face ignored the minutes typed into it'));
    else console.log('  calc: the timer takes the minutes it is given');
  }
  tools.reset?.();
}

// The diary shows the work, not the plan (§13ag).
{
  const { coverPhoto, photoTimeline } = await import('./fabric-logic.js');
  const px = (n) => `data:image/gif;base64,${n}`;

  const cloth = { id: 'zz-cloth', photoData: px('CLOTH'), createdAt: '2026-01-01' };
  const trial = {
    id: 'zz-cover', date: '2026-02-02', status: 'complete',
    fabricIds: ['zz-cloth'],
    planPhotos: [px('PLAN')],
    placements: [{ plantId: 'seed:test', photo: px('LEAVES') }],
    steps: [{ id: 's1', stageCode: 'colour', photos: [px('STEAM')] }],
    resultPhotos: [px('FIRST'), px('LAST')],
  };

  // The last picture taken, not the first result and not the plan. The list
  // used to lead with `planPhotos[0]` while work was running and
  // `resultPhotos[0]` once it was done, so the diary was illustrated with the
  // intention rather than the outcome.
  if (coverPhoto(cloth, trial) !== px('LAST'))
    fail('cover', new Error('the cover is not the most recent photograph'));
  else console.log('  cover: a work is shown by its latest photograph');

  // And with nothing photographed yet, the cloth stands in — without a second
  // rule, because it is simply the only thing in the timeline.
  const bare = { id: 'zz-bare', date: '2026-02-02', fabricIds: ['zz-cloth'],
                 placements: [], steps: [], resultPhotos: [] };
  if (coverPhoto(cloth, bare) !== px('CLOTH'))
    fail('cover', new Error('work with no photographs does not fall back to the cloth'));
  else console.log('  cover: work not yet photographed is shown by its cloth');

  // The strip the trial now carries is the same ordered timeline, and it must
  // include the cloth: a strip that begins after the first bath shows no change.
  // The cloth's own shot leads even when its record was created after the work
  // was entered, which is the ordinary way past work gets recorded (§13am).
  const late = { ...cloth, createdAt: '2026-12-31' };
  const shots = photoTimeline(late, [trial]);
  if (shots.length !== 6 || shots[0].kind !== 'fabric' || shots[shots.length - 1].kind !== 'result')
    fail('cover', new Error(`the strip is not the whole story in order (${shots.map(x => x.kind).join(',')})`));
  else console.log('  cover: the strip runs from the raw cloth to the result');
}

// A placement is one line until it is opened, as a step is (§8.0e). Seven of
// them rendered open at once were most of the length of the entry form.
{
  const trials = (await import('./modules/trials.js')).default;
  const made = db.newRecord({
    id: 'zz-place', status: 'planned', title: 'дълга форма', date: '2026-08-01',
    processCode: 'ecoprint', fabricIds: [], steps: [], resultPhotos: [],
    placements: [1, 2, 3, 4, 5, 6, 7].map(n => ({
      id: 'p' + n, plantId: '', partCode: '', condition: 'fresh',
      observation: '', photo: null,
    })),
  });
  await db.put('trials', made);
  trials.reset?.();
  trials.open('zz-place', 'work');
  await trials.render(root);
  await settle();

  const lines = root.querySelectorAll('[data-place-open]');
  const bodies = root.querySelectorAll('.placement');
  if (lines.length !== 7)
    fail('placements', new Error(`seven placements gave ${lines.length} lines`));
  else if (bodies.length > 1)
    fail('placements', new Error(`${bodies.length} placements are open at once`));
  else console.log('  placements: seven placements are seven lines, none forced open');

  if (lines.length) {
    await click(lines[2]);
    await settle();
    const openNow = root.querySelectorAll('.placement').length;
    if (openNow !== 1) fail('placements', new Error(`pressing a line opened ${openNow} of them`));
    else console.log('  placements: pressing a line opens that one');
  }
  await db.remove('trials', 'zz-place');
  trials.reset?.();
}

// The screen shows the address that was asked for last, not the render that
// happened to finish last (§13ah). Driven through the address, because the race
// is in the router and not in any one module.
{
  const settleLong = async (ms = 1400) => new Promise(r => setTimeout(r, ms));
  location.hash = '#/sources';
  await settleLong();

  // The race has to be made deterministic, or the guard passes because the two
  // renders happened not to overlap on this machine — which is a guard that has
  // never been seen to fail. Plants is slowed on purpose, then overtaken: the
  // fault is that the slow one lands last and draws over the address that was
  // actually asked for.
  const plants = (await import('./modules/plants.js')).default;
  const realRender = plants.render;
  plants.render = async function (r) {
    await new Promise(x => setTimeout(x, 700));
    return realRender.call(this, r);
  };
  try {
    location.hash = '#/plants';
    await new Promise(x => setTimeout(x, 30));
    location.hash = '#/sources';
    await settleLong(2600);
  } finally {
    plants.render = realRender;
  }

  const text = root.textContent || '';
  const onPlants = text.includes('Багрилни растения');
  if (onPlants) fail('race', new Error('the overtaken render drew over the one asked for'));
  else console.log('  race: the screen shows the address asked for last');
}

// The ceiling is checked where the iron is actually poured (§13ah). Recipes
// have checked their limits since the calculators were written; a trial checked
// nothing, so the application was silent at the one moment it mattered.
{
  const { trialStepWarnings } = await import('./calc/scale.js');
  const iron = { id: 'zz-iron', name: { bg: 'желязо' }, maxPercentWof: 4, maxTempC: 60 };
  const subs = new Map([[iron.id, iron]]);

  const hot = { id: 's', tempC: 90, mediumMod: { materialId: iron.id, amount: '2 г' } };
  if (!trialStepWarnings(hot, { substancesById: subs }).some(w => w.code === 'over_max_temp'))
    fail('ceiling', new Error('90 °C over a 60 °C ceiling raised nothing'));
  else console.log('  ceiling: a step over the temperature limit says so');

  const strong = { id: 's', mediumMod: { materialId: iron.id, amount: '8%' } };
  if (!trialStepWarnings(strong, { substancesById: subs }).some(w => w.code === 'over_max_wof'))
    fail('ceiling', new Error('8% against a 4% ceiling raised nothing'));
  else console.log('  ceiling: a medium modification over the dose limit says so');

  // And the other direction, which matters more: an amount nobody wrote as a
  // number must not be guessed at. A wrong warning teaches the person to
  // dismiss the right one.
  for (const [amount, why] of [['около лъжица', 'words'], ['8 г', 'grams, not per cent']]) {
    const vague = { id: 's', mediumMod: { materialId: iron.id, amount } };
    if (trialStepWarnings(vague, { substancesById: subs }).length) {
      fail('ceiling', new Error(`"${amount}" (${why}) was read as a dose and warned about`));
      break;
    }
  }
  console.log('  ceiling: an amount not written as a percentage is left alone');

  // A number the person marked as an estimate cannot support a flat verdict
  // (§13ai). Still said — "about 90 against a ceiling of 60" is worth hearing —
  // but as a caution.
  const guessed = { id: 's', tempC: 90, tempApprox: true,
                    mediumMod: { materialId: iron.id, amount: '2 г' } };
  const w = trialStepWarnings(guessed, { substancesById: subs })
    .find(x => x.code === 'near_max_temp' || x.code === 'over_max_temp');
  if (!w) fail('ceiling', new Error('an estimated temperature over the ceiling said nothing'));
  else if (w.kind !== 'warn')
    fail('ceiling', new Error('an estimate was stated as a verdict'));
  else console.log('  ceiling: an estimated temperature cautions rather than pronounces');

  const fine = { id: 's', tempC: 50, mediumMod: { materialId: iron.id, amount: '3%' } };
  if (trialStepWarnings(fine, { substancesById: subs }).length)
    fail('ceiling', new Error('a step inside its limits was warned about'));
  else console.log('  ceiling: a step inside its limits is silent');
}

// The other direction: "I want this colour on this cloth" (§13ah).
{
  const { colourDistance, rankByColour, colourDifference } = await import('./calc/colour.js');

  // Distance in sRGB is not a distance the eye agrees with, which is the whole
  // reason this goes through Lab, and the palette itself proves it. Measured as
  // plain arithmetic on the channels, the two wells of weld are *further apart*
  // (40.9) than iron is from indigo (38.8) — which is nonsense to anyone
  // looking at them. In Lab the yellows are 9.9 and iron to indigo is 21.9.
  const weld = '#C9A227', weldPale = '#D4B44A', iron = '#3A3733', indigo = '#2C3B57';
  if (!(colourDistance(weld, weldPale) < colourDistance(iron, indigo)))
    fail('colour', new Error('two shades of weld are not closer than iron is to indigo'));
  else console.log('  colour: distance is measured where a step is a step the eye agrees with');

  const records = [
    { id: 'a', expected: { swatchHex: '#B4613F' } },   // the one asked for
    { id: 'b', expected: { swatchHex: '#5A2220' } },   // much darker
    { id: 'c', expected: { swatchHex: '#2C3B57' } },   // a different colour
    { id: 'd', expected: {} },                         // no swatch at all
  ];
  const ranked = rankByColour(records, '#B4613F');
  if (ranked[0]?.r.id !== 'a')
    fail('colour', new Error('the closest record is not first'));
  else console.log('  colour: the closest recorded result comes first');

  // A record with no swatch cannot answer the question, and must not appear to
  // have answered it badly.
  if (ranked.some(x => x.r.id === 'd'))
    fail('colour', new Error('a record with no swatch was ranked by colour'));
  else console.log('  colour: a record with no swatch is left out, not put last');

  // And a colour far from everything must return nothing rather than the least
  // bad of fifty: a list ordered by distance always has a first item.
  if (rankByColour(records, '#00FF00').length)
    fail('colour', new Error('a colour nothing comes near still returned matches'));
  else console.log('  colour: a colour nothing comes near returns nothing');

  if (colourDifference('#B4613F', '#5A2220')?.code !== 'darker')
    fail('colour', new Error('a much darker result is not described as darker'));
  else console.log('  colour: the difference is described in words that can be acted on');
}

// "About" survives the round trip through the form, or the mark is decoration
// (§13ai). A checkbox cannot go through the value loop that reads the rest of a
// step: `el.value` on an unticked box is still "on".
{
  const { readApprox, approxNumber } = await import('./ui.js');
  const box = document.createElement('div');
  box.innerHTML = `<input type="checkbox" data-approx="tempDyeC" checked>
                   <input type="checkbox" data-approx="liquorRatio">`;
  const read = readApprox(box);
  if (read.tempDyeC !== true || 'liquorRatio' in read)
    fail('approx', new Error(`the mark did not read back: ${JSON.stringify(read)}`));
  else console.log('  approx: only the fields actually marked are recorded');

  if (approxNumber('80 °C', true) === approxNumber('80 °C', false))
    fail('approx', new Error('an estimate reads the same as a measurement'));
  else console.log('  approx: an estimate does not read as a measurement');

  if (approxNumber(null, true) !== '')
    fail('approx', new Error('an empty value was marked as an estimate of nothing'));
  else console.log('  approx: nothing recorded is still nothing, not "about nothing"');
}

// A colour search answers in a table, and a compact one (§13aj). The first
// version answered in twelve full result cards, each around three hundred
// pixels tall, which is a page of scrolling in reply to "what gives me this".
{
  const reference = (await import('./modules/reference.js')).default;
  reference.reset?.();
  reference.open();
  await reference.render(root);
  await settle();

  const swatch = root.querySelector('[data-q="colourHex"]');
  if (!swatch) {
    fail('colour', new Error('the reference has no colour to search by'));
  } else {
    swatch.value = '#B4613F';
    swatch.dispatchEvent(new window.Event('change', { bubbles: true }));
    await settle();
    await new Promise(r => setTimeout(r, 400));

    const rows = root.querySelectorAll('table.grid tbody tr');
    const cards = root.querySelectorAll('.refcard');
    if (!rows.length) fail('colour', new Error('a colour search returned no rows'));
    else if (cards.length)
      fail('colour', new Error(`${cards.length} full result cards came back instead of rows`));
    else console.log(`  colour: the answer is ${rows.length} rows, not a page of cards`);
  }
  reference.reset?.();
}

// A computed recipe and the calculator agree, because they are one function
// (§13ak). They had not agreed: the calculator worked from molar masses and the
// recipe from stored percentages, so the same cloth got two different answers
// on two screens.
{
  const { scaleRecipe } = await import('./calc/scale.js');
  const { aluminiumAcetate } = await import('./calc/alum-acetate.js');
  const subs = new Map((await db.all('substances')).map(x => [x.id, x]));
  const find = (code) => [...subs.values()].find(x => x.id === 'seed:' + code);
  const al = find('al_sulfate_anhydrous'), na = find('soda_ash');

  if (!al || !na) {
    fail('recipe', new Error('the seeded substances for the reaction are missing'));
  } else {
    const recipe = {
      computedBy: 'aluminium_acetate', vinegarPercent: 6, scaleBy: 'weight',
      target: { percentWof: 8, basisRefersTo: 'finished_product' },
      ingredients: [
        { id: 'a', roleCode: 'aluminium_source', basis: 'percent_wof', options: [{ id: 'o1', substanceId: al.id }] },
        { id: 'b', roleCode: 'sodium_source', basis: 'percent_wof', options: [{ id: 'o2', substanceId: na.id }] },
        { id: 'c', roleCode: 'acid_source', basis: 'absolute', unit: 'ml', options: [{ id: 'o3' }] },
      ],
    };
    const scaled = scaleRecipe(recipe, { weightG: 56, substancesById: subs });
    const direct = aluminiumAcetate({
      fabricWeightG: 56, percentWof: 8,
      aluminiumSubstance: al, sodiumSubstance: na, vinegarPercent: 6,
    });
    const got = Object.fromEntries(scaled.ingredients.map(i => [i.roleCode, i.scaledAmount]));
    if (got.aluminium_source !== direct.aluminiumSource.grams
        || got.sodium_source !== direct.sodiumSource.grams
        || got.acid_source !== direct.acid.vinegarMl) {
      fail('recipe', new Error(`the recipe and the calculator disagree: ${JSON.stringify(got)}`));
    } else console.log('  recipe: a computed recipe gives exactly the calculator figures');

    // And the part that surprised the owner, which is chemistry rather than a
    // bug: on the finished-product basis the moles of acetate are fixed, so
    // changing the aluminium salt moves the weight of the salt and nothing
    // else.
    const hydrated = find('al_sulfate_14');
    if (hydrated) {
      recipe.ingredients[0].options[0].substanceId = hydrated.id;
      const other = scaleRecipe(recipe, { weightG: 56, substancesById: subs });
      const now = Object.fromEntries(other.ingredients.map(i => [i.roleCode, i.scaledAmount]));
      if (now.aluminium_source === got.aluminium_source)
        fail('recipe', new Error('a different hydrate needed the same weight of salt'));
      else if (now.sodium_source !== got.sodium_source || now.acid_source !== got.acid_source)
        fail('recipe', new Error('the soda or vinegar moved on the finished-product basis'));
      else console.log('  recipe: another hydrate changes the salt alone, as the chemistry says');

      // On the raw basis the opposite must happen, or the two bases are not
      // actually distinguished and §5.1 is only half applied.
      recipe.target = { percentWof: 18, basisRefersTo: 'raw_input' };
      const raw = scaleRecipe(recipe, { weightG: 56, substancesById: subs });
      recipe.ingredients[0].options[0].substanceId = al.id;
      const rawAnhydrous = scaleRecipe(recipe, { weightG: 56, substancesById: subs });
      const soda = (x) => x.ingredients.find(i => i.roleCode === 'sodium_source').scaledAmount;
      if (soda(raw) === soda(rawAnhydrous))
        fail('recipe', new Error('on the raw basis the soda did not follow the hydration'));
      else console.log('  recipe: on the raw basis the soda follows the hydration');
    }
  }
}

// Finishing a piece of work changes the state of the cloth (§8.0e question 5,
// §13al). It did not: the choice was offered with "leave it as it is" selected,
// so the owner finished a garment and the cloth stayed mordanted — showing at
// once under "finished work" and under "ready to work".
{
  const trials = (await import('./modules/trials.js')).default;
  const cloth = db.newRecord({
    id: 'zz-state', label: 'ПЛ-99', name: 'плат за проба', weightG: 100,
    stateEvents: [{ id: 'e1', date: '2026-08-01', stateCode: 'mordanted' }],
  });
  await db.put('fabrics', cloth);
  const work = db.newRecord({
    id: 'zz-statework', status: 'working', title: 'проба за състоянието',
    date: '2026-08-05', processCode: 'ecoprint', fabricIds: ['zz-state'],
    placements: [], steps: [], resultPhotos: [],
  });
  await db.put('trials', work);

  trials.reset?.();
  trials.open('zz-statework', 'finish');
  await trials.render(root);
  await settle();

  const chooser = root.querySelector('[data-newstate]');
  if (!chooser) {
    fail('state', new Error('the finishing screen does not ask about the cloth'));
  } else {
    // Not merely that some option exists — that doing nothing does the right
    // thing. The fault was entirely in what was selected by default.
    if (!chooser.value)
      fail('state', new Error('finishing offers to change nothing, selected'));
    else console.log(`  state: finishing proposes a state for the cloth (${chooser.value})`);

    const save = root.querySelector('[data-finish-save]');
    if (!save) fail('state', new Error('there is no way to save the finish'));
    else {
      await click(save);
      await settle();
      await new Promise(r => setTimeout(r, 400));
      const after = await db.get('fabrics', 'zz-state');
      // `actions` since §13bd, and read through `currentState` rather than off
      // the last entry: only a box-moving action decides where the cloth is,
      // and reading the raw tail would call an iron afterbath a box.
      const { currentState: boxOf } = await import('./fabric-logic.js');
      const last = (after.actions || []).slice(-1)[0];
      if (!last || boxOf(after) === 'mordanted')
        fail('state', new Error('the cloth kept its old state after the work was finished'));
      else if (last.trialId !== 'zz-statework')
        fail('state', new Error('the state event does not say which work caused it'));
      else console.log('  state: the cloth records what the finished work did to it');
    }
  }

  await db.remove('trials', 'zz-statework');
  await db.remove('fabrics', 'zz-state');
  trials.reset?.();
}

// Working a finished piece again (§13am). "Finished" is a state of a run, not
// the end of the cloth: a printed shawl can be re-mordanted and printed over.
{
  const trials = (await import('./modules/trials.js')).default;
  const px = (n) => `data:image/gif;base64,${n}`;

  const shawl = db.newRecord({
    id: 'zz-shawl', label: 'ПЛ-88', name: 'копринен шал', weightG: 28,
    photoData: px('RAW'),
    stateEvents: [{ id: 'e', date: '2026-06-01', stateCode: 'finished' }],
  });
  await db.put('fabrics', shawl);
  const first = db.newRecord({
    id: 'zz-run1', status: 'complete', title: 'първи печат', date: '2026-06-02',
    processCode: 'ecoprint', fabricIds: ['zz-shawl'],
    placements: [], steps: [], resultPhotos: [px('FIRSTRESULT'), px('LASTRESULT')],
  });
  await db.put('trials', first);

  // The list files the runs under the piece, not one card per run.
  trials.reset?.();
  trials.open();
  await trials.render(root);
  await settle();
  if (!root.querySelector('[data-again="zz-shawl"]'))
    fail('again', new Error('a finished piece offers no way to be worked again'));
  else console.log('  again: a finished piece can be taken up again from the diary');

  // And starting from it carries the ground, automatically.
  trials.reset?.();
  trials.open('new', 'zz-shawl');
  await trials.render(root);
  await settle();

  const text = root.textContent || '';
  const ground = root.querySelector('.groundshot, [data-open-ground]');
  if (!ground) {
    fail('again', new Error('the new work does not record what it is standing on'));
  } else {
    const img = root.querySelector('.groundshot');
    // The last photograph of the previous run, not the first and not the raw
    // cloth: it is literally what is in the hand when the new work begins.
    if (img && img.getAttribute('src') !== px('LASTRESULT'))
      fail('again', new Error('the ground is not the most recent photograph of the piece'));
    else console.log('  again: the new work starts from the last photograph of the old');
    if (!text.includes('първи печат'))
      fail('again', new Error('the ground does not name the work it came from'));
    else console.log('  again: the ground names the run it came from');
  }

  // A piece with no earlier work must not be given a ground it does not have.
  const raw = db.newRecord({ id: 'zz-raw', name: 'суров плат', weightG: 40 });
  await db.put('fabrics', raw);
  trials.reset?.();
  trials.open('new', 'zz-raw');
  await trials.render(root);
  await settle();
  if (root.querySelector('.groundshot, [data-open-ground]'))
    fail('again', new Error('raw cloth was given a ground'));
  else console.log('  again: raw cloth is not given a ground it does not have');

  await db.remove('trials', 'zz-run1');
  await db.remove('fabrics', 'zz-shawl');
  await db.remove('fabrics', 'zz-raw');
  trials.reset?.();
}

// Every door to "complete" passes through the five questions (§13an). There
// were three, and one of them — the status chips on the working screen — went
// straight there, so work landed in the finished column with no result, no
// verdict and no change to the cloth.
{
  const trials = (await import('./modules/trials.js')).default;
  const cloth = db.newRecord({
    id: 'zz-door', label: 'ПЛ-77', name: 'плат за врата', weightG: 60,
    stateEvents: [{ id: 'e', date: '2026-08-01', stateCode: 'mordanted' }],
  });
  await db.put('fabrics', cloth);
  const work = db.newRecord({
    id: 'zz-doorwork', status: 'in_progress', title: 'работа за врата',
    date: '2026-08-10', processCode: 'ecoprint', fabricIds: ['zz-door'],
    placements: [], steps: [], resultPhotos: [],
  });
  await db.put('trials', work);

  trials.reset?.();
  trials.open('zz-doorwork', 'work');
  await trials.render(root);
  await settle();

  const chip = [...root.querySelectorAll('[data-f="status"]')]
    .find(el => el.value === 'complete');
  if (!chip) {
    fail('doors', new Error('the working screen has no way to mark work complete'));
  } else {
    chip.checked = true;
    chip.dispatchEvent(new window.Event('change', { bubbles: true }));
    await settle();
    await new Promise(r => setTimeout(r, 400));
    if (!location.hash.endsWith('/finish'))
      fail('doors', new Error(`marking complete did not reach the finishing screen (${location.hash})`));
    else console.log('  doors: marking work complete goes through the five questions');
  }

  // A piece that contradicts itself offers settling as the card, not as a note
  // under a button that starts a second, empty piece of work.
  const done = db.newRecord({
    id: 'zz-doordone', status: 'complete', title: 'завършено', date: '2026-08-11',
    processCode: 'ecoprint', fabricIds: ['zz-door'], placements: [], steps: [],
  });
  await db.put('trials', done);
  trials.reset?.();
  trials.open();
  await trials.render(root);
  await settle();
  const card = root.querySelector('.readycard.stale');
  if (!card) fail('doors', new Error('the stale piece is not marked on its own card'));
  else if (!card.hasAttribute('data-settle'))
    fail('doors', new Error('pressing the stale card still starts new work'));
  else console.log('  doors: a piece that contradicts itself is settled by its own card');

  await db.remove('trials', 'zz-doorwork');
  await db.remove('trials', 'zz-doordone');
  await db.remove('fabrics', 'zz-door');
  trials.reset?.();
}

// Work that points at no cloth says so (§13ao). It updates no state, groups
// with nothing and belongs to no piece's life — and looked like an ordinary
// record. The owner's own diary held one, made when `readWork()` emptied
// `fabricIds` on the finishing screen (§13al), and nothing anywhere said so.
{
  const trials = (await import('./modules/trials.js')).default;
  const orphanDone = db.newRecord({
    id: 'zz-orphan', status: 'complete', title: 'работа без плат',
    date: '2026-08-09', processCode: 'ecoprint', fabricIds: [],
    placements: [], steps: [], resultPhotos: [],
  });
  const orphanRunning = db.newRecord({
    id: 'zz-orphan2', status: 'in_progress', title: 'тече без плат',
    date: '2026-08-10', processCode: 'ecoprint', fabricIds: [],
    placements: [], steps: [], resultPhotos: [],
  });
  await db.put('trials', orphanDone);
  await db.put('trials', orphanRunning);

  trials.reset?.();
  trials.open();
  await trials.render(root);
  await settle();

  for (const [id, what] of [['zz-orphan', 'finished'], ['zz-orphan2', 'running']]) {
    const mark = root.querySelector(`[data-attach="${id}"]`);
    if (!mark) fail('orphan', new Error(`${what} work with no cloth is not marked`));
    else console.log(`  orphan: ${what} work with no cloth says so, and offers the way back`);
  }

  // And the mark must not appear on work that does have cloth, or it becomes
  // decoration that everybody learns to ignore.
  const cloth = db.newRecord({ id: 'zz-has', name: 'плат', weightG: 50 });
  await db.put('fabrics', cloth);
  const attached = db.newRecord({
    id: 'zz-attached', status: 'in_progress', title: 'с плат', date: '2026-08-10',
    processCode: 'ecoprint', fabricIds: ['zz-has'], placements: [], steps: [],
  });
  await db.put('trials', attached);
  trials.reset?.();
  trials.open();
  await trials.render(root);
  await settle();
  if (root.querySelector('[data-attach="zz-attached"]'))
    fail('orphan', new Error('work that has cloth was marked as having none'));
  else console.log('  orphan: work that has cloth is not marked');

  await db.remove('trials', 'zz-orphan');
  await db.remove('trials', 'zz-orphan2');
  await db.remove('trials', 'zz-attached');
  await db.remove('fabrics', 'zz-has');
  trials.reset?.();
}

// Work that points at no cloth says so, and opens the panel that fixes it
// (§13ao). This is not hypothetical: the owner's own backup carries a record
// with five steps, seven placements and an empty `fabricIds`, left that way by
// the fault fixed in §13al. It looked like an ordinary finished record, and the
// panel holding the answer was folded shut.
{
  const trials = (await import('./modules/trials.js')).default;
  const orphan = db.newRecord({
    id: 'zz-orphan', status: 'complete', title: 'работа без плат',
    date: '2026-08-09', processCode: 'ecoprint', fabricIds: [],
    placements: [{ id: 'p1', plantId: '' }], steps: [{ id: 's1' }], resultPhotos: [],
  });
  await db.put('trials', orphan);

  trials.reset?.();
  trials.open('zz-orphan', 'work');
  await trials.render(root);
  await settle();

  const strip = root.querySelector('.contextstrip');
  if (!strip) {
    fail('orphan', new Error('the working screen has no context strip'));
  } else {
    if (!strip.hasAttribute('open'))
      fail('orphan', new Error('the panel that holds the cloth is folded shut on work that has none'));
    else console.log('  orphan: the panel that fixes it opens itself');
    if (!root.querySelector('[data-multi="fabricIds"]'))
      fail('orphan', new Error('there is no way to attach a cloth'));
    else console.log('  orphan: a cloth can be attached from there');
  }

  // And it is visible from the list, or it is only found by accident.
  trials.reset?.();
  trials.open();
  await trials.render(root);
  await settle();
  if (!root.querySelector('[data-attach="zz-orphan"]'))
    fail('orphan', new Error('work with no cloth is not marked in the diary'));
  else console.log('  orphan: work with no cloth is marked where it is listed');

  // The ordinary case must stay folded, or the strip is open on every screen
  // and the mark means nothing.
  const fine = db.newRecord({
    id: 'zz-fine', status: 'in_progress', title: 'нормална работа', date: '2026-08-09',
    processCode: 'ecoprint', fabricIds: ['zz-any'], placements: [], steps: [],
  });
  await db.put('trials', fine);
  trials.reset?.();
  trials.open('zz-fine', 'work');
  await trials.render(root);
  await settle();
  if (root.querySelector('.contextstrip')?.hasAttribute('open'))
    fail('orphan', new Error('the strip opens on work that has a cloth too'));
  else console.log('  orphan: work with a cloth is left folded as before');

  await db.remove('trials', 'zz-orphan');
  await db.remove('trials', 'zz-fine');
  trials.reset?.();
}

// A dye bath can record what it gave (§13ap). It could not: placements were
// offered for eco print only, so a madder dyeing produced no swatch, gave the
// plant nothing, and could not be found by colour.
{
  const trials = (await import('./modules/trials.js')).default;
  const madder = (await db.all('plants')).find(p => (p.nameCommon?.bg || '').includes('брош'))
    || (await db.all('plants'))[0];

  const bath = db.newRecord({
    id: 'zz-bath', status: 'in_progress', title: 'баня с брош', date: '2026-08-13',
    processCode: 'immersion', fabricIds: [], placements: [], steps: [], resultPhotos: [],
  });
  await db.put('trials', bath);

  trials.reset?.();
  trials.open('zz-bath', 'work');
  await trials.render(root);
  await settle();

  const add = root.querySelector('[data-place-add]');
  if (!add) {
    fail('bath', new Error('a dye bath has nowhere to record what went into it'));
  } else {
    console.log('  bath: a dye bath can say what went into it');
    await click(add);
    await settle();
    // The position belongs to printing and must not be asked of a bath: there
    // is no face of a leaf and no print quality when the cloth is in a pot.
    if (root.querySelector('[data-place="0.facing"], [data-place="0.printQuality"]'))
      fail('bath', new Error('the bath is asked where the leaf was facing'));
    else console.log('  bath: the bath is not asked about position');
    if (!root.querySelector('[data-place="0.plantId"]'))
      fail('bath', new Error('the bath cannot name its dyestuff'));
    else console.log('  bath: the bath names its dyestuff');
  }

  // And the colour reaches the finish, which is what carries it onward.
  const dyed = await db.get('trials', 'zz-bath');
  dyed.placements = [{ id: 'd1', plantId: madder.id, partCode: 'root', condition: 'dried',
                       resultColour: 'керемидено', resultHex: '#B4613F' }];
  dyed.status = 'complete';
  await db.put('trials', dyed);

  trials.reset?.();
  trials.open('zz-bath', 'finish');
  await trials.render(root);
  await settle();
  if (!root.querySelector('[data-place="0.resultHex"]'))
    fail('bath', new Error('the finish does not ask what colour the bath gave'));
  else console.log('  bath: the finish asks what colour the bath gave');

  // Eco print keeps its position questions, or this fix has taken something
  // away from the process it was not about.
  const print = db.newRecord({
    id: 'zz-print', status: 'in_progress', title: 'принт', date: '2026-08-13',
    processCode: 'ecoprint', fabricIds: [],
    placements: [{ id: 'p1', plantId: madder.id }], steps: [], resultPhotos: [],
  });
  await db.put('trials', print);
  trials.reset?.();
  trials.open('zz-print', 'work');
  await trials.render(root);
  await settle();
  const line = root.querySelector('[data-place-open]');
  if (line) { await click(line); await settle(); }
  if (!root.querySelector('[data-place="0.facing"]'))
    fail('bath', new Error('eco print lost its position questions'));
  else console.log('  bath: eco print keeps its position questions');

  await db.remove('trials', 'zz-bath');
  await db.remove('trials', 'zz-print');
  trials.reset?.();
}

// Writing a recipe from inside a step, and coming back to that step with it
// attached (§13aq). The button existed and went to the recipes *list*, then
// returned to the trials *list* with nothing attached — most of the work it
// was there to save.
{
  const trials = (await import('./modules/trials.js')).default;
  const recipesMod = (await import('./modules/recipes.js')).default;
  const { getSetting } = await import('./db.js');

  const work = db.newRecord({
    id: 'zz-round', status: 'in_progress', title: 'обиколка', date: '2026-08-13',
    processCode: 'immersion', fabricIds: [], placements: [], resultPhotos: [],
    steps: [{ id: 'st1', typeCode: 'dye', stageCode: 'colour', recipeId: '' }],
  });
  await db.put('trials', work);

  trials.reset?.();
  trials.open('zz-round', 'work');
  await trials.render(root);
  await settle();
  const line = root.querySelector('[data-step-open]');
  if (line) { await click(line); await settle(); }

  const plus = root.querySelector('[data-newrecipe]');
  if (!plus) {
    fail('round', new Error('a step offers no way to write the recipe it needs'));
  } else {
    await click(plus);
    await new Promise(r => setTimeout(r, 300));
    const memo = await getSetting('returnTo');
    if (!memo || memo.stepId !== 'st1')
      fail('round', new Error(`the step was not remembered: ${JSON.stringify(memo)}`));
    else console.log('  round: the step is remembered by id, not by position');
    if (!location.hash.includes('/new'))
      fail('round', new Error(`the button lands on ${location.hash}, not on a new recipe`));
    else console.log('  round: the button lands on a new recipe');

    // Saving the recipe attaches it and returns to the work.
    recipesMod.reset?.();
    recipesMod.open('new');
    await recipesMod.render(root);
    await settle();
    const name = root.querySelector('[data-f="name.bg"]');
    if (name) { name.value = 'баня с тагетис'; name.dispatchEvent(new window.Event('input', { bubbles: true })); }
    const save = root.querySelector('[data-save]');
    if (!save) {
      fail('round', new Error('the new recipe cannot be saved'));
    } else {
      await click(save);
      await settle();
      await new Promise(r => setTimeout(r, 400));
      const back = await db.get('trials', 'zz-round');
      if (!back.steps[0].recipeId)
        fail('round', new Error('the recipe was written and not attached to the step'));
      else console.log('  round: the recipe written comes back attached to its step');
      if (!location.hash.includes('zz-round'))
        fail('round', new Error(`the return landed on ${location.hash}, not on the work`));
      else console.log('  round: and the return lands on the work, not on the list');
    }
  }

  await db.remove('trials', 'zz-round');
  trials.reset?.();
  recipesMod.reset?.();
}

// A dye step names its own dyestuff, with or without a recipe (§13ar). "No
// recipe" never meant "no dyestuff", but the dyestuff could only be reached
// through a recipe's ingredients, so a bath written without one had nowhere to
// say what was in it.
{
  const trials = (await import('./modules/trials.js')).default;
  const plants = await db.all('plants');
  const tagetes = plants[0], madder = plants[1];

  const work = db.newRecord({
    id: 'zz-steps', status: 'in_progress', title: 'две бани', date: '2026-08-13',
    processCode: 'immersion', fabricIds: [], resultPhotos: [],
    steps: [{ id: 'sA', typeCode: 'dye', stageCode: 'colour', recipeId: '' },
            { id: 'sB', typeCode: 'dye', stageCode: 'colour', recipeId: '' }],
    // One dyestuff per bath, and a third belonging to no step — a leaf.
    placements: [
      { id: 'dA', stepId: 'sA', plantId: tagetes.id, partCode: 'flower', condition: 'dried' },
      { id: 'dB', stepId: 'sB', plantId: madder.id, partCode: 'root', condition: 'dried' },
      { id: 'leaf', stepId: null, plantId: tagetes.id, partCode: 'leaf', condition: 'fresh' },
    ],
  });
  await db.put('trials', work);

  trials.reset?.();
  trials.open('zz-steps', 'work');
  await trials.render(root);
  await settle();

  const lines = root.querySelectorAll('[data-step-open]');
  if (lines.length < 2) {
    fail('stepdye', new Error('the two baths are not both on screen'));
  } else {
    await click(lines[0]);
    await settle();
    const box = root.querySelector('.stepdyes');
    if (!box) {
      fail('stepdye', new Error('an opened dye step does not show its dyestuff'));
    } else {
      const text = box.textContent || '';
      const mine = (tagetes.nameCommon?.bg || '').slice(0, 8);
      const theirs = (madder.nameCommon?.bg || '').slice(0, 8);
      if (!text.includes(mine))
        fail('stepdye', new Error('the step does not show the dyestuff that belongs to it'));
      else console.log('  stepdye: a dye step shows its own dyestuff');
      // The decisive one: two baths in one trial must not show each other's.
      if (theirs && text.includes(theirs))
        fail('stepdye', new Error('the first bath is showing the second bath dyestuff'));
      else console.log('  stepdye: two baths in one trial are told apart');
      // Pressed, not inspected: reading the attribute only proved the markup
      // carries the step id, which says nothing about what the handler does
      // with it — and the first version of this check passed with the handler
      // deliberately broken.
      const addHere = box.querySelector('[data-place-add]');
      if (!addHere) {
        fail('stepdye', new Error('a step offers no way to add a dyestuff'));
      } else {
        await click(addHere);
        await settle();
        const save = root.querySelector('[data-save]');
        if (save) { await click(save); await settle(); await new Promise(r => setTimeout(r, 300)); }
        const after = await db.get('trials', 'zz-steps');
        const fresh = (after.placements || []).find(x => !x.plantId);
        if (!fresh || fresh.stepId !== 'sA')
          fail('stepdye', new Error(`what was added from a step did not belong to it: ${JSON.stringify(fresh?.stepId)}`));
        else console.log('  stepdye: what is added from a step belongs to it');
      }
    }
  }

  // A leaf belongs to no step and must stay reachable in the block below,
  // or eco print loses its placements to a change that was not about it.
  const loose = [...root.querySelectorAll('.placeblock')]
    .filter(b => !b.closest('.stepdyes'));
  if (!loose.length)
    fail('stepdye', new Error('placements belonging to no step have nowhere to live'));
  else console.log('  stepdye: a leaf, belonging to no step, is still listed on its own');

  await db.remove('trials', 'zz-steps');
  trials.reset?.();
}

// Four faults from real use (§13as).
{
  const trials = (await import('./modules/trials.js')).default;
  const { fieldGroup, field } = await import('./ui.js');

  // 1. A label swallows the presses of buttons inside it. The plan photographs
  //    sat in `field()`, so their × did nothing at all.
  if (/<label/.test(fieldGroup('x', '<button data-x>×</button>')))
    fail('reports', new Error('fieldGroup still renders a label'));
  else console.log('  reports: a group of controls is not wrapped in a label');
  if (!/<label/.test(field('x', '<input>')))
    fail('reports', new Error('field stopped being a label — a caption must still label its control'));
  else console.log('  reports: a single control keeps its label');

  const cloth = db.newRecord({ id: 'zz-name', label: 'ПЛ-01', name: 'старо име', weightG: 30 });
  await db.put('fabrics', cloth);
  const work = db.newRecord({
    id: 'zz-namework', status: 'complete', title: 'старо име', date: '2026-08-13',
    processCode: 'immersion', fabricIds: ['zz-name'], placements: [], steps: [],
    resultPhotos: [],
  });
  await db.put('trials', work);

  // 4. Renaming the cloth renames the work in the diary: the title was copied
  //    once, and a copy does not follow the original.
  cloth.name = 'ново име';
  await db.put('fabrics', cloth);
  trials.reset?.();
  trials.open();
  await trials.render(root);
  await settle();
  const listed = root.textContent || '';
  if (!listed.includes('ново име'))
    fail('reports', new Error('the diary still calls the piece by its old name'));
  else console.log('  reports: renaming the cloth renames the work in the diary');

  // 3. The result of finished work can be corrected: screen 4 was reachable
  //    only on the way to finishing.
  trials.reset?.();
  trials.open('zz-namework');
  await trials.render(root);
  await settle();
  if (!root.querySelector('[data-refinish]'))
    fail('reports', new Error('a finished result cannot be edited'));
  else console.log('  reports: the result of finished work can be corrected');

  await db.remove('trials', 'zz-namework');
  await db.remove('fabrics', 'zz-name');
  trials.reset?.();
}

// Finished work is dated by the day it finished, and finishing twice corrects
// one mark on the cloth rather than leaving two (§13au).
{
  const trials = (await import('./modules/trials.js')).default;

  const cloth = db.newRecord({ id: 'zz-when', label: 'ПЛ-09', name: 'туника', weightG: 200, stateEvents: [] });
  await db.put('fabrics', cloth);
  const work = db.newRecord({
    id: 'zz-whenwork', status: 'in_progress', title: '', date: '2026-08-14',
    processCode: 'immersion', fabricIds: ['zz-when'], placements: [], steps: [],
    resultPhotos: [], finishedOn: null,
  });
  await db.put('trials', work);

  const finishOnce = async (when) => {
    trials.reset?.();
    trials.open('zz-whenwork', 'finish');
    await trials.render(root);
    await settle();
    const when_ = root.querySelector('[data-f="finishedOn"]');
    if (!when_) { fail('finished', new Error('screen 4 does not ask when the work finished')); return null; }
    when_.value = when;
    when_.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    const stamp = root.querySelector('[data-statedate]');
    if (stamp) stamp.value = when;
    const state = root.querySelector('[data-newstate]');
    if (state) state.value = 'finished';
    await click(root.querySelector('[data-finish-save]'));
    await settle();
    return when_;
  };

  if (await finishOnce('2025-05-12')) {
    const saved = await db.get('trials', 'zz-whenwork');
    if (saved.finishedOn !== '2025-05-12')
      fail('finished', new Error(`the chosen day was not kept: ${saved.finishedOn}`));
    else console.log('  finished: the day chosen on screen 4 is the day recorded');

    // The diary must show it, not the day the record was made.
    trials.reset?.();
    trials.open();
    await trials.render(root);
    await settle();
    // Its own card, not the whole screen: other fixtures carry other dates,
    // and a check that reads the page as one string passes on their evidence.
    const card = [...root.querySelectorAll('.trialcard, .workrow')]
      .find(el => (el.textContent || '').includes('туника'));
    const shown = card?.textContent || '';
    if (!card) fail('finished', new Error('the finished work is not listed at all'));
    else if (!shown.includes('12.05.2025') || shown.includes('14.08.2026'))
      fail('finished', new Error(`the diary dates the work by when it was written down: ${shown.match(/\d\d\.\d\d\.\d{4}/g)}`));
    else console.log('  finished: the diary dates finished work by when it finished');

    // Correcting the result must not stamp the cloth a second time.
    //
    // Reads `actions` — the check was written against `stateEvents` and went on
    // passing after §13bd moved the readers, because the fixture wrote the old
    // list too. It only spoke up once the writer moved as well, which is a fair
    // description of what a check is for.
    await finishOnce('2025-05-12');
    const piece = await db.get('fabrics', 'zz-when');
    const mine = (piece.actions || []).filter(a => a.trialId === 'zz-whenwork');
    if (mine.length !== 1)
      fail('finished', new Error(`one work left ${mine.length} marks on the cloth`));
    else if (mine[0].date !== '2025-05-12')
      fail('finished', new Error(`the mark was re-dated to ${mine[0].date}`));
    else console.log('  finished: finishing again corrects the mark instead of adding one');
  }

  // And the repair of what the fault already wrote: a piece stamped twice by
  // one work keeps the earlier stamp — the later one is always the re-visit —
  // and the day it names fills the work's missing `finishedOn`.
  {
    const { healDoubleStateEvents } = await import('./app.js');
    const tr = db.newRecord({
      id: 'zz-heal', status: 'complete', title: 'стара работа', date: '2026-08-13',
      processCode: 'immersion', fabricIds: ['zz-healcloth'], placements: [], steps: [],
      resultPhotos: [], finishedOn: null,
    });
    await db.put('trials', tr);
    await db.put('fabrics', db.newRecord({
      id: 'zz-healcloth', label: 'ПЛ-10', name: 'стар плат', stateEvents: [
        { id: 'e1', date: '2025-05-12', stateCode: 'finished', trialId: 'zz-heal' },
        { id: 'e2', date: '2026-08-13', stateCode: 'finished', trialId: 'zz-heal' },
        { id: 'e3', date: '2026-08-01', stateCode: 'scoured', trialId: '' },
      ],
    }));

    await healDoubleStateEvents();
    const healed = await db.get('fabrics', 'zz-healcloth');
    const mine = (healed.stateEvents || []).filter(e => e.trialId === 'zz-heal');
    if (mine.length !== 1 || mine[0].date !== '2025-05-12')
      fail('finished', new Error(`the doubled mark was not healed: ${JSON.stringify(mine.map(e => e.date))}`));
    else console.log('  finished: a piece stamped twice by one work keeps the day that was chosen');

    if ((healed.stateEvents || []).length !== 2)
      fail('finished', new Error('the repair touched an event that belongs to no work'));
    else console.log('  finished: an event belonging to no work is left alone');

    if ((await db.get('trials', 'zz-heal')).finishedOn !== '2025-05-12')
      fail('finished', new Error('the recovered day did not reach the work'));
    else console.log('  finished: the recovered day becomes the work finished day');

    // Run twice: a repair that is not idempotent is a repair that eats data.
    const before = JSON.stringify((await db.get('fabrics', 'zz-healcloth')).stateEvents);
    await healDoubleStateEvents();
    if (JSON.stringify((await db.get('fabrics', 'zz-healcloth')).stateEvents) !== before)
      fail('finished', new Error('the repair changed something on a second run'));
    else console.log('  finished: the repair changes nothing on a second run');

    await db.remove('trials', 'zz-heal');
    await db.remove('fabrics', 'zz-healcloth');
  }

  await db.remove('trials', 'zz-whenwork');
  await db.remove('fabrics', 'zz-when');
  trials.reset?.();
}

// The audit merge is a script, and a script that is not idempotent eats data on
// the second run (§13aw). The names it corrected must also have stayed
// corrected, and the photographs it credited must not have lost their images.
{
  const plants = await db.all('plants');
  // Keyed on the id, not on `code`: the pack strips the code and turns it into
  // `seed:<code>` as the id. Reading `p.code` off a stored record returns
  // undefined, and a Map keyed on undefined answers every question with the
  // last plant loaded — a guard that would have passed while proving nothing.
  const byCode = new Map(plants.map(p => [p.id, p]));

  const sappan = byCode.get('seed:paubrasilia_echinata');
  if (!sappan) fail('audit', new Error('the sappanwood record is gone — it was renamed, not replaced'));
  else if (!/Biancaea sappan/.test(sappan.nameBotanical || ''))
    fail('audit', new Error(`sappanwood still reads ${sappan.nameBotanical}`));
  else console.log('  audit: a renamed plant keeps its code and changes its names');

  // Renaming must never orphan a swatch or a placement: those point at the id.
  if (sappan && sappan.id !== 'seed:paubrasilia_echinata')
    fail('audit', new Error('the renamed plant took a new id, so everything pointing at it is orphaned'));

  const credited = plants.filter(p => p.photoCredit?.author);
  if (credited.length < 48)
    fail('audit', new Error(`only ${credited.length} plants carry an author`));
  else console.log(`  audit: ${credited.length} plants carry a named author`);

  // Every plant now carries a photograph. A credit without an image was the
  // honest state while the files were still coming; it must not become a
  // permanent half-record, so the check is that none is left in it.
  const creditNoPhoto = plants.filter(p => p.photoCredit?.author && !p.photoData);
  if (creditNoPhoto.length)
    fail('audit', new Error(`still credited without an image: ${creditNoPhoto.map(p => p.id).join(', ')}`));
  else console.log(`  audit: all ${plants.length} plants carry a photograph and a credit`);

  // A claim nobody could source is a claim that must not ship (§13ax). Eleven
  // plants were marked as aluminium accumulators — oak, pomegranate, apple,
  // medlar among them — and the accumulators in the literature are Symplocos,
  // clubmosses and tea. They were marked for their TANNINS, and a tannin is not
  // a mordant: it helps cellulose hold the dye and replaces no metal salt.
  // "You may be able to skip mordanting" is advice that wastes a day's work.
  const claiming = plants.filter(p => (p.role || []).includes('mordant_accumulator'));
  if (claiming.length)
    fail('audit', new Error(`still claiming to replace a mordant: ${claiming.map(p => p.id).join(', ')}`));
  else console.log('  audit: no plant claims to replace a mordant without a source');

  // The term stays in the vocabulary. It is real knowledge, the filter honestly
  // reads zero, and Symplocos may yet join the library.
  if (!(await import('./vocab.js')).VOCABULARY.some(v => v.key === 'plant_role:mordant_accumulator'))
    fail('audit', new Error('the accumulator term was deleted rather than left unused'));

  // Growth form and habitat are facts about the plant; `availability` said
  // something about the owner and shipped inside a pack to other people (§13ay).
  if (plants.some(p => 'availability' in p))
    fail('audit', new Error('a personal field survives on a distributable record'));
  else console.log('  audit: no personal field on a reference record');

  const typed = plants.filter(p => p.plantType);
  if (typed.length !== plants.length)
    fail('audit', new Error(`${plants.length - typed.length} plants have no growth form`));
  else if (typed.some(p => !['tree', 'shrub', 'subshrub', 'herb'].includes(p.plantType)))
    fail('audit', new Error('a growth form outside the four'));
  else console.log(`  audit: all ${typed.length} plants carry one growth form`);

  const homed = plants.filter(p => (p.habitat || []).length);
  if (homed.length !== plants.length)
    fail('audit', new Error(`${plants.length - homed.length} plants say nothing about where they grow`));
  else if (homed.some(p => p.habitat.some(h => !['wild', 'garden', 'imported'].includes(h))))
    fail('audit', new Error('a habitat outside the three'));
  else console.log('  audit: every plant says where it grows, in the three agreed values');

  // A temperature belongs to the part (§13az). Elder leaf wants 70–85 and elder
  // fruit 40–65, and while the field was per-plant one of those had to be lost.
  if (plants.some(p => 'tempDyeC' in p || 'tempExtractC' in p || 'softMaxTempC' in p))
    fail('temperature', new Error('a temperature survives on the plant, where parts disagree with it'));
  else console.log('  temperature: no temperature left on a plant');

  const elder = byCode.get('seed:sambucus_nigra');
  const leaf = (elder?.parts || []).find(x => x.partCode === 'leaf');
  const fruit = (elder?.parts || []).find(x => x.partCode === 'fruit');
  if (!leaf || !fruit) fail('temperature', new Error('elder lost a part'));
  else if (leaf.tempDyeC?.max === fruit.tempDyeC?.max)
    fail('temperature', new Error('elder leaf and elder fruit were given the same heat'));
  else console.log('  temperature: two parts of one plant can want different heat');

  // Woad has no extraction temperature — not an unknown one, none. Saying so is
  // a different statement from leaving the field empty.
  const woad = byCode.get('seed:isatis_tinctoria');
  if (!(woad?.parts || []).every(x => x.extractionMode === 'vat'))
    fail('temperature', new Error('woad does not say that it is a vat, so its blank reads as unmeasured'));
  else console.log('  temperature: a plant outside the ordinary schema says which schema it is in');

  // The ceiling that stops madder being boiled brown, at the value the owner
  // accepted from the audit.
  const madder = (byCode.get('seed:rubia_tinctorum')?.parts || [])[0];
  if (madder?.softMaxTempC !== 82)
    fail('temperature', new Error(`madder's ceiling is ${madder?.softMaxTempC}, not 82`));
  else console.log('  temperature: madder keeps the ceiling that protects the red');

  // And it must reach the screen: a temperature only the database knows is a
  // temperature nobody is warned by.
  {
    const plantsMod = (await import('./modules/plants.js')).default;
    plantsMod.reset?.();
    plantsMod.open('seed:sambucus_nigra');
    await plantsMod.render(root);
    await settle();
    // The rows that actually carry degrees, not the page as a whole: „40" also
    // occurs in a dosing percentage, and a check satisfied by another row's
    // number is a check that proves nothing (§13aw).
    // `.usetile` since §13bs, where the working figures became a strip of
    // tiles. `.fact` is still used elsewhere on the screen, so this asked a
    // question about a part of the page that no longer holds the answer — and
    // reported zero rather than reporting that it could not tell.
    const degrees = [...root.querySelectorAll('.usetile, .fact')]
      .map(el => el.textContent || '')
      .filter(x => x.includes('°C'));
    const distinct = new Set(degrees.map(x => x.replace(/\s+/g, ' ').trim()));
    if (distinct.size < 2)
      fail('temperature', new Error(`elder shows ${distinct.size} temperature row(s); its parts disagree`));
    else if (![...distinct].some(x => x.includes('40')) || ![...distinct].some(x => x.includes('85')))
      fail('temperature', new Error('the differing part temperatures are not both on screen'));
    else console.log('  temperature: both are readable on the plant record');

    plantsMod.reset?.();
    plantsMod.open('seed:isatis_tinctoria');
    await plantsMod.render(root);
    await settle();
    if (!(root.textContent || '').includes('редукционна вана'))
      fail('temperature', new Error('the vat is not named where the temperature would be'));
    else console.log('  temperature: the vat is named where a temperature would otherwise stand');
    plantsMod.reset?.();
  }

  // Tannin levels live on the part, and only where a level was actually
  // reported (§13ba). Thirty-two plants whose audit line reads „ниски / не е
  // основна характеристика" must carry nothing: that is the absence of a
  // finding, and writing it down would turn it into one.
  {
    const withTannin = plants.filter(p => (p.parts || [])
      .some(pt => (pt.chemistry || []).some(c => c.classCode === 'tannin')));
    if (withTannin.length < 10)
      fail('tannin', new Error(`only ${withTannin.length} plants carry a tannin level`));
    else console.log(`  tannin: ${withTannin.length} plants carry a level, on the part`);

    const levelless = plants.flatMap(p => (p.parts || []))
      .flatMap(pt => pt.chemistry || [])
      .filter(c => c.classCode === 'tannin' && !c.level);
    if (levelless.length)
      fail('tannin', new Error('a tannin entry with no level says nothing'));
    else console.log('  tannin: every entry carries a level');

    // The galls, which are the point: a nearly non-staining tannin for
    // pre-treating cellulose, distinct from the bark that colours as it goes.
    const gall = (byCode.get('seed:quercus_robur')?.parts || [])
      .find(x => x.partCode === 'gall');
    if (gall?.chemistry?.[0]?.level !== 'dominant')
      fail('tannin', new Error('oak galls do not carry the level the audit gave them'));
    else console.log('  tannin: oak galls are marked, and separately from the bark');
  }

  // Every name begins with a capital, in both languages (§13bb). The library
  // had „дъб" beside „Бял равнец" because each was typed as whoever wrote it
  // felt at the time; a list where half the rows shout looks broken before it
  // is read.
  {
    const lower = plants.filter(p => ['bg', 'en'].some(lang => {
      const name = (p.nameCommon || {})[lang];
      return name && name[0] !== name[0].toUpperCase();
    }));
    if (lower.length)
      fail('names', new Error(`names beginning lower case: ${lower.slice(0, 5).map(p => p.id).join(', ')}`));
    else console.log(`  names: all ${plants.length} begin with a capital, both languages`);
  }

  // Dosing that came from a book says so. In a year the owner must be able to
  // tell which figures she measured and which she read (§13bb).
  {
    const dosed = plants.filter(p => (p.parts || []).some(pt => (pt.dosing || []).length));
    const unmarked = dosed.filter(p => !p.confidence?.dosing);
    if (unmarked.length > 2)
      fail('dosing', new Error(`${unmarked.length} plants carry dosing with no confidence marker`));
    else console.log(`  dosing: ${dosed.length} plants carry dosing, marked for where it came from`);

    const newNine = ['sambucus_nigra', 'rubus_fruticosus', 'dahlia_pinnata', 'genista_tinctoria',
                     'alkanna_tinctoria', 'rheum_rhabarbarum', 'fraxinus_excelsior',
                     'frangula_alnus', 'pelargonium_zonale'];
    const bare = newNine.filter(c => !(byCode.get('seed:' + c)?.parts || [])
      .some(pt => (pt.dosing || []).length));
    if (bare.length)
      fail('dosing', new Error(`still without dosing: ${bare.join(', ')}`));
    else console.log('  dosing: all nine new plants can be scaled by the calculator');

    // This guard used to insist the nine had NO colours, because a hex read out
    // of a sentence would have answered reverse searches beside colours that
    // were actually obtained off cloth.
    //
    // The owner reversed that deliberately in 0.98.1 (§13be): the nine were the
    // only plants in the library saying nothing in the column that matters most
    // to someone who dyes. What protects the reverse search now is not absence
    // but the confidence marker, so that is what is checked. `literature` and
    // never `own_trial` — nobody has put these in a pot yet.
    const naked = newNine.filter(c => !(byCode.get('seed:' + c)?.colours || []).length);
    if (naked.length)
      fail('dosing', new Error(`still no colours: ${naked.join(', ')}`));
    else console.log('  dosing: all nine now say what colour they give');

    const overclaimed = [];
    for (const c of newNine)
      for (const sw of byCode.get('seed:' + c)?.colours || [])
        if (sw.confidence !== 'literature') overclaimed.push(`${c}:${sw.confidence}`);
    if (overclaimed.length)
      fail('dosing', new Error(`an inferred hex claims more than literature: ${overclaimed.slice(0, 4).join(', ')}`));
    else console.log('  dosing: every inferred colour says it came from literature');
  }

  // The library is bilingual from the first record (§13bc). It was Bulgarian
  // throughout and the English half was empty, which is not a half-finished
  // translation but an application that says it speaks two languages and does
  // not.
  {
    const bare = [];
    for (const p of plants) {
      for (const sec of p.sections || []) {
        const body = sec.body || {};
        if (body.bg?.trim() && !body.en?.trim())
          bare.push(`${p.id} · ${sec.title?.bg}`);
      }
    }
    if (bare.length)
      fail('english', new Error(`${bare.length} sections have no English: ${bare.slice(0, 3).join(', ')}`));
    else console.log('  english: every section that says something says it twice');

    // And a translation that is the Bulgarian copied across is not one. The
    // Sources section is exempt: a citation is not translated.
    const copied = [];
    for (const p of plants) {
      for (const sec of p.sections || []) {
        if (sec.title?.bg === 'Източници') continue;
        const body = sec.body || {};
        if (body.bg?.trim() && body.bg.trim() === body.en?.trim())
          copied.push(`${p.id} · ${sec.title?.bg}`);
      }
    }
    if (copied.length)
      fail('english', new Error(`${copied.length} sections have the Bulgarian on both sides`));
    else console.log('  english: no section carries the Bulgarian twice');

    // Names too: a plant whose English name is missing shows a Bulgarian name
    // on an English screen, which reads as a fault rather than as a gap.
    const unnamed = plants.filter(p => !(p.nameCommon || {}).en?.trim());
    if (unnamed.length)
      fail('english', new Error(`${unnamed.length} plants have no English name`));
    else console.log(`  english: all ${plants.length} plants are named in both languages`);
  }

  const oak = byCode.get('seed:quercus_robur');
  if (!(oak?.parts || []).some(x => x.partCode === 'gall'))
    fail('audit', new Error('oak galls did not survive the merge'));
  else console.log('  audit: a part added by the audit is on the record');
}

// A term that cannot be understood from its own label carries an explanation
// (§13aw). The owner — who is the domain expert — did not know what „акумулатор"
// meant, and that is a fault in the label, not in her.
{
  const { VOCABULARY } = await import('./vocab.js');
  const needsSaying = ['plant_role:mordant_accumulator'];
  for (const key of needsSaying) {
    const term = VOCABULARY.find(v => v.key === key);
    if (!term) fail('vocabulary', new Error(`${key} is not in the vocabulary at all`));
    else if (!term.description?.bg || !term.description?.en)
      fail('vocabulary', new Error(`${key} is shown without an explanation of what it means`));
  }
  console.log('  vocabulary: a term that needs explaining carries the explanation');

  // And the explanation has to reach the screen, or it is a comment.
  const plants = (await import('./modules/plants.js')).default;
  await db.put('plants', db.newRecord({ id: 'zz-acc', code: 'zz_acc',
    nameCommon: { bg: 'Акумулаторно растение' }, nameBotanical: 'Zzz test',
    role: ['mordant_accumulator'], parts: [], colours: [], sections: [] }));
  plants.reset?.();
  plants.open('zz-acc');
  await plants.render(root);
  await settle();
  if (!(root.textContent || '').includes('трупа алуминий'))
    fail('vocabulary', new Error('the explanation of a role never reaches the plant record'));
  else console.log('  vocabulary: the explanation is shown where the role is');
  await db.remove('plants', 'zz-acc');
  plants.reset?.();
}

// A photograph carries the name of whoever took it (§13at). Several are
// CC BY-SA, which requires it wherever the image appears, and this application
// is meant to be given away.
{
  const seeded = await db.all('plants');
  const withPhoto = seeded.filter(p => p.photoData);
  if (!withPhoto.length) {
    fail('credit', new Error('no seeded plant carries a photograph'));
  } else {
    console.log(`  credit: ${withPhoto.length} of ${seeded.length} plants carry a photograph`);
    const free = (l) => ['cc0', 'publicdomain'].includes(String(l || '').toLowerCase().replace(/\s/g, ''));
    const nameless = withPhoto.filter(p => !(p.photoCredit?.author) && !free(p.photoCredit?.licence));
    if (nameless.length)
      fail('credit', new Error(`shipped without an author: ${nameless.map(p => p.code).join(', ')}`));
    else console.log('  credit: every photograph that needs an author has one');

    const noLicence = withPhoto.filter(p => !(p.photoCredit?.licence));
    if (noLicence.length)
      fail('credit', new Error(`no licence recorded: ${noLicence.map(p => p.code).join(', ')}`));
    else console.log('  credit: every photograph records its licence');

    // And it must be on the screen, not merely in the record.
    const one = withPhoto.find(p => p.photoCredit?.author);
    const plantsMod = (await import('./modules/plants.js')).default;
    plantsMod.reset?.();
    plantsMod.open(one.id);
    await plantsMod.render(root);
    await settle();
    if (!(root.textContent || '').includes(one.photoCredit.author))
      fail('credit', new Error('the author is in the record and not on the screen'));
    else console.log('  credit: the author is shown with the photograph');
    plantsMod.reset?.();
  }
}

// ---- 14. A swatch says which process produced it, and none is lost ---------
//
// The same leaf gives yellow in a dye bath and almost black under iron in an
// eco print (§13be). The detail groups the swatches by process, and grouping is
// where swatches go missing: a filter that keeps only the ones with a process
// would silently drop all 48 seeded plants, whose swatches have none.
{
  const { groupSwatchesByProcess, plantColourSources } = await import('./modules/plants.js');

  const probe = {
    id: 'probe',
    colours: [
      { hex: '#C6B76D', name: { bg: 'меко жълто' }, process: 'immersion', partCode: 'leaf' },
      { hex: '#5D6258', name: { bg: 'тъмносиво' }, process: 'ecoprint', partCode: 'leaf' },
      { hex: '#A26F84', name: { bg: 'розово-лилаво' } },
    ],
  };
  const swatches = plantColourSources(probe, [], { max: 24, distinctContext: true });
  const { ungrouped, byProcess } = groupSwatchesByProcess(swatches);

  const total = ungrouped.length + [...byProcess.values()].reduce((n, l) => n + l.length, 0);
  if (total !== swatches.length)
    fail('swatch', new Error(`grouping lost swatches: ${swatches.length} in, ${total} out`));
  else console.log('  swatch: grouping loses nothing');

  if (ungrouped.length !== 1)
    fail('swatch', new Error(`a swatch with no process must survive ungrouped, got ${ungrouped.length}`));
  else console.log('  swatch: a swatch with no process is kept, not dropped');

  if (byProcess.get('immersion')?.[0]?.hex !== '#C6B76D' ||
      byProcess.get('ecoprint')?.[0]?.hex !== '#5D6258')
    fail('swatch', new Error('a swatch landed under the wrong process'));
  else console.log('  swatch: bath and print are told apart');

  // And it reaches the screen: the process heading and the part are both shown.
  const plantsMod = (await import('./modules/plants.js')).default;
  const real = (await db.all('plants'))[0];
  const saved = real.colours;
  real.colours = probe.colours;
  await db.put('plants', real);
  plantsMod.reset?.();
  plantsMod.open(real.id);
  await plantsMod.render(root);
  await settle();
  const txt = root.textContent || '';
  if (!txt.includes('еко принт') || !txt.includes('лист'))
    fail('swatch', new Error('the process heading or the part is not on the screen'));
  else console.log('  swatch: the process and the part are shown, not merely stored');
  real.colours = saved;
  await db.put('plants', real);
  plantsMod.reset?.();
}

// ---- 15. Every plant gives a colour, and every swatch cites the register ---
//
// Read from the SEED FILES, not from the database. The claim is about what
// ships: earlier sections here create scratch plants and edit real ones on
// purpose, and holding those to the standard of a shipped record reports a
// failure the library does not have. It reported exactly that on the first run
// — an avocado an earlier section had emptied.
//
// The library reached 57 of 57 in 0.98.1. This is what keeps it there: a plant
// added without swatches is a plant whose row is blank in the column that
// matters most to someone who dyes (§13h).
{
  const seedPlants = JSON.parse(fs.readFileSync('seed/plants.json', 'utf8')).plants;
  const seedSources = JSON.parse(fs.readFileSync('seed/sources.json', 'utf8')).sources;
  const codes = new Set(seedSources.map(x => x.code));

  const bare = seedPlants.filter(p => !(p.colours || []).length);
  if (bare.length)
    fail('swatch', new Error(`${bare.length} plants give no colour: ${bare.slice(0, 5).map(p => p.code).join(', ')}`));
  else console.log(`  swatch: all ${seedPlants.length} shipped plants say what colour they give`);

  // A citation the register does not hold leads nowhere — the fault Part A2
  // exists to close, checked here rather than discovered by a reader.
  const orphan = [];
  for (const p of seedPlants)
    for (const c of p.colours || [])
      if (c.source && !codes.has(c.source)) orphan.push(`${p.code}:${c.source}`);
  if (orphan.length)
    fail('swatch', new Error(`swatches cite a source not in the register: ${[...new Set(orphan)].slice(0, 4).join(', ')}`));
  else console.log(`  swatch: every citation reaches the register (${codes.size} sources)`);

  // An inferred hex must say so. None of these was measured off cloth.
  const unmarked = seedPlants.filter(p => (p.colours || []).some(c => !c.confidence));
  if (unmarked.length)
    fail('swatch', new Error(`swatches with no confidence: ${unmarked.slice(0, 4).map(p => p.code).join(', ')}`));
  else console.log('  swatch: every shipped swatch says how well it is known');

  // A part on a swatch that the plant does not have is a typo that would read
  // as fact — elder fruit is real, elder root is not.
  const wrongPart = [];
  for (const p of seedPlants) {
    const parts = new Set((p.parts || []).map(x => x.partCode));
    for (const c of p.colours || [])
      if (c.partCode && !parts.has(c.partCode)) wrongPart.push(`${p.code}:${c.partCode}`);
  }
  if (wrongPart.length)
    fail('swatch', new Error(`a swatch names a part the plant has not got: ${wrongPart.slice(0, 4).join(', ')}`));
  else console.log('  swatch: every part named on a swatch is a part of that plant');
}

// ---- 16. A group action can actually be gathered -------------------------
//
// Reported from real use on 0.98.0: ticking a piece in the fabrics list opened
// the piece instead of selecting it, so the bulk bar never appeared and a group
// action could not be assembled at all. The checkbox sits inside the row, and
// the row's `[data-open]` swallowed its click.
//
// The lesson worth keeping is not the fix but the gap: `deep-check` opened every
// record and asserted every screen rendered, and the whole §13bd feature shipped
// with its only entry point unusable. A screen that draws is not a screen that
// works. This walks the path a person walks — tick, tick, press — and asserts the
// address that comes out of it.
{
  const fabricsMod = (await import('./modules/fabrics.js')).default;
  const pieces = (await db.all('fabrics')).slice(0, 2);

  if (pieces.length < 2) {
    console.log('  batch: skipped, fewer than two pieces in the test database');
  } else {
    fabricsMod.reset?.();
    fabricsMod.open();
    await fabricsMod.render(root);
    await settle();

    const ticks = [...root.querySelectorAll('[data-pick]')].slice(0, 2);
    if (ticks.length < 2) {
      fail('batch', new Error('the fabrics list offers no way to tick a piece'));
    } else {
      ticks[0].click();
      await settle();

      if (!root.querySelector('.bulkbar'))
        fail('batch', new Error('ticking a piece did not raise the bulk bar — the tick was swallowed'));
      else console.log('  batch: ticking a piece selects it rather than opening it');

      const again = [...root.querySelectorAll('[data-pick]')].find(x => !x.checked);
      if (again) { again.click(); await settle(); }

      const chosen = [...root.querySelectorAll('[data-pick]')].filter(x => x.checked).length;
      if (chosen < 2)
        fail('batch', new Error(`a second piece could not be added: ${chosen} selected`));
      else console.log('  batch: a second piece can be added to the selection');

      const go = root.querySelector('[data-batch]');
      if (!go) fail('batch', new Error('no way through to the group action'));
      else {
        go.click();
        await settle();
        const hash = String(location.hash);
        if (!hash.startsWith('#/batch') || !hash.includes('pieces='))
          fail('batch', new Error(`the group action was reached without its pieces: ${hash}`));
        else console.log('  batch: the chosen pieces travel to the group action in the address');
      }
    }
    fabricsMod.reset?.();
    location.hash = '#/dashboard';
    await settle();
  }
}

// ---- 17. A mark accompanies a label and never replaces it -----------------
//
// Twelve icons arrived in 0.99.0 and every one of them is decoration in the
// strict sense: remove it and the screen still says everything it said. That is
// the rule (§13ac), and it is the rule an icon set quietly erodes — one glyph
// stands in for a word, then two, and a screen becomes unreadable to anyone who
// does not already know what the pictures mean.
//
// So: the words that gained a mark must still be words.
{
  const plantsMod = (await import('./modules/plants.js')).default;
  const recipesMod = (await import('./modules/recipes.js')).default;

  // Matched on the id, not on `code`: a seeded record's code lives in its id as
  // `seed:<code>` and the field itself is not carried into the store. Looking
  // for it on the record found nothing and the check passed by not running,
  // which is the quietest way for a guard to be useless.
  const madder = (await db.all('plants')).find(p => /rubia/i.test(String(p.id)));
  if (madder) {
    plantsMod.reset?.();
    plantsMod.open(madder.id);
    await plantsMod.render(root);
    await settle();
    const txt = root.textContent || '';

    // The level bar carries the word beside it, in every language.
    const levels = [...root.querySelectorAll('.level')];
    const wordless = levels.filter(el => !(el.querySelector('.levelword')?.textContent || '').trim());
    if (!levels.length) console.log('  marks: no level bars on this record to check');
    else if (wordless.length)
      fail('marks', new Error(`${wordless.length} level bars show a quantity and no word`));
    else console.log(`  marks: ${levels.length} level bars, each with its word beside it`);

    // And the bar must agree with the word rather than drift from it: four
    // segments filled means the last of four levels.
    const bad = levels.filter(el => {
      const segs = [...el.querySelectorAll('.seg')];
      const on = segs.filter(x => x.classList.contains('on')).length;
      return on < 1 || on > segs.length;
    });
    if (bad.length) fail('marks', new Error('a level bar is filled beyond its own scale'));
    else if (levels.length) console.log('  marks: every bar is filled within its scale');
    plantsMod.reset?.();
  }

  recipesMod.reset?.();
  recipesMod.open();
  await recipesMod.render(root);
  await settle();

  // A temperature keeps its unit; a thermometer is not a unit.
  const conds = [...root.querySelectorAll('.cond')].map(el => el.textContent.trim());
  const tempCells = conds.filter(x => /\d/.test(x));
  if (tempCells.length && !tempCells.some(x => /°C|мин|min|л|l\b/i.test(x)))
    fail('marks', new Error('a figure lost its unit when it gained an icon'));
  else console.log('  marks: figures keep their units beside the icons');

  // A type cell keeps its name.
  const types = [...root.querySelectorAll('.typecell')];
  const nameless = types.filter(el => !el.textContent.trim());
  if (nameless.length)
    fail('marks', new Error(`${nameless.length} recipe types show an icon and no name`));
  else if (types.length) console.log(`  marks: ${types.length} recipe types named as well as marked`);
  recipesMod.reset?.();
}

// ---- 18. The review reads as a story, and nothing in it is lost -----------
//
// Four kinds of writing lived in one panel under three different treatments:
// the intention in a headed box, what happened as loose prose with no heading at
// all, and what she would change and the notes squeezed into a two-column fact
// grid where a paragraph got half the width of the page. Reported as "the notes
// are not set apart", which was the visible half of it.
//
// The pair that matters is intention and outcome, and they now sit side by side
// with an arrow between: the record exists to answer one against the other.
{
  const trialsMod = (await import('./modules/trials.js')).default;
  const full = db.newRecord({
    status: 'complete', title: 'проверка на разказа', date: '2026-05-01',
    intent: 'дъбови листа върху памук',
    assessmentWhy: 'по-бледо от очакваното заради дебелия плат',
    nextTime: 'по-дълга пара',
    notes: 'банята стигна само 42 °C',
    steps: [], placements: [], fabricIds: [],
  });
  await db.put('trials', full);

  trialsMod.reset?.();
  trialsMod.open(full.id);
  await trialsMod.render(root);
  await settle();

  const parts = [...root.querySelectorAll('.storypart')];
  const heads = parts.map(el => (el.querySelector('h3')?.textContent || '').trim());
  if (parts.length < 4)
    fail('story', new Error(`four kinds of writing, ${parts.length} blocks on screen`));
  else console.log('  story: intention, outcome, what to change and the notes each have a block');

  if (heads.some(h => !h))
    fail('story', new Error('a block of writing carries no heading'));
  else console.log('  story: every block says what it is');

  // Every word survives. A layout change that drops a paragraph is the worst
  // kind, because the screen still looks right.
  const txt = root.textContent || '';
  for (const [what, str] of [['intent', full.intent], ['outcome', full.assessmentWhy],
                             ['nextTime', full.nextTime], ['notes', full.notes]]) {
    if (!txt.includes(str)) fail('story', new Error(`${what} is not on the screen`));
  }
  console.log('  story: nothing written was dropped by the layout');

  if (!root.querySelector('.storythen'))
    fail('story', new Error('no arrow between what was meant and what happened'));
  else console.log('  story: an arrow stands between the intention and the outcome');

  // The notes are set apart rather than run on from what precedes them.
  const notesBlock = parts[parts.length - 1];
  if (!notesBlock?.classList.contains('apart'))
    fail('story', new Error('the notes are not set apart'));
  else console.log('  story: the notes are set apart');

  await db.remove('trials', full.id);
  trialsMod.reset?.();
}

// ---- 19. Leaving the work and coming back --------------------------------
//
// Both reported from real use, on one attempt to re-work a finished scarf.
//
// (a) The handoff to the group action wrote the record and then left, but never
//     told the unsaved-work guard the record had been written. So the guard
//     asked "discard your unsaved changes?" over work already in the database,
//     and there was no answer that both kept the work and moved on.
//
// (b) "Work on this piece again" made a new record every time it was pressed.
//     The scarf ended with two pieces of work in progress and no sign which to
//     carry on with.
{
  const trialsMod = (await import('./modules/trials.js')).default;
  const dirtyMod = await import('./dirty.js');
  const piece = (await db.all('fabrics'))[0];

  // (b) — exactly the reported case: a piece with finished work on it, and work
  // on it already open. Screen 2's picker already excludes busy cloth, so the
  // route that could double up was the finished card's own "work on this piece
  // again", which went straight to `#/trials/new/<id>` without looking.
  const done = db.newRecord({
    status: 'complete', title: 'първи печат', date: '2026-04-01',
    finishedOn: '2026-04-01', fabricIds: [piece.id], steps: [], placements: [],
  });
  await db.put('trials', done);
  const open = db.newRecord({
    status: 'in_progress', title: 'вече в ход', date: '2026-05-01',
    fabricIds: [piece.id], steps: [], placements: [],
  });
  await db.put('trials', open);

  trialsMod.reset?.();
  trialsMod.open();
  await trialsMod.render(root);
  await settle();

  const againBtn = root.querySelector(`[data-again="${piece.id}"]`);
  if (!againBtn) {
    console.log('  rework: the finished card offers no way back in, skipped');
  } else {
    const before = (await db.all('trials')).length;
    againBtn.click();
    await settle();
    const after = (await db.all('trials')).length;

    if (String(location.hash) !== `#/trials/${open.id}`)
      fail('rework', new Error(`work already open was not reopened: ${location.hash}`));
    else console.log('  rework: a piece already in work opens that work');

    if (after !== before)
      fail('rework', new Error('a second piece of work was created for the same cloth'));
    else console.log('  rework: no rival record is made for the same cloth');
  }

  // (a) — a handoff leaves nothing unsaved behind it.
  trialsMod.reset?.();
  trialsMod.open(open.id);
  await trialsMod.render(root);
  await settle();

  dirtyMod.markDirty();
  const prep = root.querySelector('[data-add-prep]');
  if (!prep) {
    console.log('  handoff: no preparation button on this record, skipped');
  } else {
    // The assertion is that nothing was ASKED, read from the guard's own count.
    // Two earlier attempts at this both passed against code known to be broken:
    // counting calls to the global `confirm` misses it, because the guard's
    // question is an injected function; and reading `isDirty` afterwards misses
    // it, because the guard clears itself the moment the question is answered.
    const asked = dirtyMod.askCount();
    prep.click();
    await settle();

    if (dirtyMod.askCount() > asked)
      fail('handoff', new Error('leaving after a save asked whether to discard the work'));
    else console.log('  handoff: leaving after a save asks nothing');

    if (dirtyMod.isDirty())
      fail('handoff', new Error('the work was written and the guard still calls it unsaved'));
    else console.log('  handoff: writing the work clears the unsaved-work guard');

    if (!String(location.hash).startsWith('#/batch'))
      fail('handoff', new Error(`the handoff did not arrive: ${location.hash}`));
    else console.log('  handoff: the group action is reached, with a way back recorded');

    const back = await db.getSetting('returnTo', null);
    if (back?.id !== open.id)
      fail('handoff', new Error('the way back does not point at the work it left'));
    else console.log('  handoff: the way back points at the work it left');
    await db.setSetting('returnTo', null);
  }

  await db.remove('trials', open.id);
  await db.remove('trials', done.id);
  trialsMod.reset?.();
  location.hash = '#/dashboard';
  await settle();
}

// ---- 20. Finishing reaches the cloth -------------------------------------
//
// The whole re-work path, walked end to end on one record: open work that is in
// progress, add a colouring step, record which leaf went on, finish.
//
// The assertion that matters is the last one. From 0.98.0 to 0.99.2 finishing a
// piece of work wrote to `stateEvents` while everything read `actions`, so the
// work went complete and **the cloth was never told**: it stayed in the
// mordanted box and its biography said nothing about having been finished.
// Nothing on screen looked wrong, which is why it survived four releases.
{
  const trialsMod = (await import('./modules/trials.js')).default;
  const { currentState } = await import('./fabric-logic.js');

  const piece = (await db.all('fabrics'))[0];
  const work = db.newRecord({
    status: 'in_progress', title: 'втори печат', date: '2026-06-01',
    intent: 'нов еко принт върху вече багрен шал',
    processCode: 'ecoprint', fabricIds: [piece.id], steps: [], placements: [],
  });
  await db.put('trials', work);

  location.hash = '#/trials/' + work.id;
  await settle();

  const addColour = [...root.querySelectorAll('[data-add-step]')]
    .find(b => b.dataset.addStep === 'colour');
  if (!addColour) {
    fail('rework', new Error('a colouring step cannot be added to work in progress'));
  } else {
    addColour.click();
    await settle();
    console.log('  rework: a colouring step can be added');

    const addPlant = root.querySelector('[data-place-add]');
    if (!addPlant) fail('rework', new Error('no way to record which plant went on'));
    else { addPlant.click(); await settle(); console.log('  rework: a plant can be laid on the step'); }

    const finish = [...root.querySelectorAll('button')]
      .find(b => /\/trials\/[^/]+\/finish/.test(b.getAttribute('data-go') || '')
              || /Заверши|Завърши|Finish/i.test(b.textContent || ''));
    if (!finish) {
      fail('rework', new Error('no way through to finishing'));
    } else {
      finish.click();
      await settle();

      // The step and the plant must already be stored: leaving the working
      // screen for the finishing screen is a departure, and unsaved work does
      // not survive one.
      const mid = await db.get('trials', work.id);
      if (!(mid.steps || []).length || !(mid.placements || []).length)
        fail('rework', new Error('the step or the plant was lost on the way to finishing'));
      else console.log('  rework: the step and the plant survive the way to finishing');

      const done = [...root.querySelectorAll('button')]
        .find(b => /Запиши и завърши|Save and finish/i.test(b.textContent || ''));
      if (!done) {
        fail('rework', new Error('the finishing screen offers no way to finish'));
      } else {
        done.click();
        await settle();

        const after = await db.get('trials', work.id);
        if (after.status !== 'complete')
          fail('rework', new Error(`the work did not complete: ${after.status}`));
        else console.log('  rework: the work completes');

        const cloth = await db.get('fabrics', piece.id);
        const stamped = (cloth.actions || []).filter(a => a.trialId === work.id);
        if (!stamped.length)
          fail('rework', new Error('the work finished and the cloth was never told'));
        else console.log(`  rework: the cloth carries the finishing (${currentState(cloth)})`);

        if ((cloth.stateEvents || []).some(e => e.trialId === work.id))
          fail('rework', new Error('finishing wrote to the old state list as well'));
        else console.log('  rework: nothing was written to the old list');
      }
    }
  }

  await db.remove('trials', work.id);
  const cloth = await db.get('fabrics', piece.id);
  cloth.actions = (cloth.actions || []).filter(a => a.trialId !== work.id);
  await db.put('fabrics', cloth);
  trialsMod.reset?.();
  location.hash = '#/dashboard';
  await settle();
}

// ---- 21. The preparation the cloth carries, on the work -------------------
//
// Reported from real use: "the text is stuck together". It was three spans with
// dots between them, which read as one sentence broken in the wrong places. Now
// columns, so the dates line up down the list and the eye can run the column
// rather than reading each line.
//
// In its own section rather than inside the story check: dropped in there, its
// fixture record became the record that check was reading, and three of that
// check's assertions failed on evidence that was never theirs. A check that
// builds a fixture owns the screen while it does.
{
// The preparation the cloth carries reads as columns, not as one sentence
// with dots in it. Reported from real use: "the text is stuck together".
{
  const piece = (await db.all('fabrics'))[0];
  const batch = db.newRecord({
    actionCode: 'mordant', date: '2026-08-11', recipeId: null,
    fabricIds: [piece.id], totalWeightG: 28, deviation: '', note: '',
  });
  await db.put('batchActions', batch);
  piece.actions = [...(piece.actions || []), {
    id: 'zz-prep', fabricId: piece.id, actionCode: 'mordant',
    date: '2026-08-11', batchId: batch.id, trialId: null,
  }];
  await db.put('fabrics', piece);

  const w = db.newRecord({
    status: 'in_progress', title: 'подготовка на екран', date: '2026-08-12',
    fabricIds: [piece.id], steps: [], placements: [],
  });
  await db.put('trials', w);
  location.hash = '#/trials/' + w.id;
  await settle();

  const line = root.querySelector('.prepline');
  if (!line) {
    fail('prep', new Error('the preparation the cloth carries is not shown on the work'));
  } else {
    const what = line.querySelector('.prepwhat')?.textContent?.trim() || '';
    const when = line.querySelector('.prepwhen')?.textContent?.trim() || '';
    if (!what || !when)
      fail('prep', new Error(`a preparation line is missing its action or its date: "${what}" "${when}"`));
    else console.log(`  prep: each preparation says what and when in its own column (${what}, ${when})`);
  }

  await db.remove('trials', w.id);
  await db.remove('batchActions', batch.id);
  const back = await db.get('fabrics', piece.id);
  back.actions = (back.actions || []).filter(a => a.id !== 'zz-prep');
  await db.put('fabrics', back);
}
  location.hash = '#/dashboard';
  await settle();
}

// ---- 22. A bath can be unmade ---------------------------------------------
//
// Reported from real use, and it is the sharpest kind of fault: a record that
// can be MADE and cannot be UNMADE. A scarf ended with two mordantings a week
// apart, one of them a mistake, and no screen anywhere could take it back —
// the group action wrote onto the cloth and then offered nothing but reading.
//
// Also checked here: that deleting the bath deletes what it wrote. Leaving the
// pieces' actions behind would produce exactly the orphans the invariant of
// §13bd forbids — an action belonging to nothing.
{
  const batchMod = (await import('./modules/batch.js')).default;
  const piece = (await db.all('fabrics'))[0];

  const b = db.newRecord({
    actionCode: 'mordant', date: '2026-07-01', recipeId: null, chainId: null,
    fabricIds: [piece.id], totalWeightG: 28, deviation: '', note: '',
  });
  await db.put('batchActions', b);
  piece.actions = [...(piece.actions || []), {
    id: 'zz-undo', fabricId: piece.id, actionCode: 'mordant',
    date: '2026-07-01', batchId: b.id, trialId: null,
  }];
  await db.put('fabrics', piece);

  batchMod.reset?.();
  batchMod.open(b.id);
  await batchMod.render(root);
  await settle();

  const dateField = root.querySelector('[data-edit="date"]');
  const save = root.querySelector('[data-edit-save]');

  if (!dateField || !save) {
    fail('unmake', new Error('a recorded bath cannot be corrected'));
  } else {
    dateField.value = '2026-07-05';
    save.click();
    await settle();

    const b2 = await db.get('batchActions', b.id);
    const cloth = await db.get('fabrics', piece.id);
    const act = (cloth.actions || []).find(a => a.batchId === b.id);
    if (b2.date !== '2026-07-05')
      fail('unmake', new Error('correcting the bath did not save'));
    else if (act?.date !== '2026-07-05')
      fail('unmake', new Error('the bath was re-dated and the cloth still says the old day'));
    else console.log('  unmake: correcting a bath corrects it on every piece in it');
  }

  // Re-queried, not held from before the save: saving redraws the screen, so a
  // node captured earlier is detached and clicking it does nothing at all. The
  // first version of this check held one and reported the delete as broken.
  const del = root.querySelector('[data-batch-del]');
  if (!del) {
    fail('unmake', new Error('a recorded bath cannot be deleted'));
  } else {
    del.click();
    await settle();

    // `get` throws for a missing key rather than returning null, so a plain
    // truthiness test on it reports "still there" for a record that is gone.
    const still = await db.get('batchActions', b.id).then(x => x, () => null);
    if (still)
      fail('unmake', new Error('the bath survived being deleted'));
    else console.log('  unmake: a bath can be deleted');

    const cloth = await db.get('fabrics', piece.id);
    const left = (cloth.actions || []).filter(a => a.batchId === b.id);
    if (left.length)
      fail('unmake', new Error(`${left.length} orphaned actions left on the cloth`));
    else console.log('  unmake: deleting the bath takes it out of the biography too');
  }

  const cloth = await db.get('fabrics', piece.id);
  cloth.actions = (cloth.actions || []).filter(a => a.id !== 'zz-undo');
  await db.put('fabrics', cloth);
  batchMod.reset?.();
  location.hash = '#/dashboard';
  await settle();
}

// ---- 23. The strip shows the piece, not one trial --------------------------
//
// Reported from real use, on a scarf printed twice: the strip showed the raw
// cloth and the final result and nothing between. From it there was no way to
// tell the piece had been printed before, which is the one thing a second print
// most needs to say.
//
// The earlier print IS how this one started. Leaving it out makes a second look
// like a first.
{
  const trialsMod = (await import('./modules/trials.js')).default;
  const piece = (await db.all('fabrics'))[0];
  const dot = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

  const first = db.newRecord({
    status: 'complete', title: 'първи печат', date: '2026-03-01',
    finishedOn: '2026-03-01', fabricIds: [piece.id], steps: [], placements: [],
    resultPhotos: [dot],
  });
  const second = db.newRecord({
    status: 'complete', title: 'втори печат', date: '2026-04-01',
    finishedOn: '2026-04-01', fabricIds: [piece.id], steps: [], placements: [],
    resultPhotos: [dot],
  });
  await db.put('trials', first);
  await db.put('trials', second);

  trialsMod.reset?.();
  location.hash = '#/trials/' + second.id;
  await settle();

  const shots = [...root.querySelectorAll('.lifeshot')];
  const fromEarlier = shots.filter(el => el.classList.contains('earlier'));

  if (shots.length < 2)
    fail('strip', new Error(`a twice-printed piece shows ${shots.length} shots`));
  else console.log(`  strip: a twice-printed piece shows its earlier work too (${shots.length} shots)`);

  if (!fromEarlier.length)
    fail('strip', new Error('nothing marks which shots came from earlier work'));
  else console.log('  strip: shots from earlier work are marked as such');

  // And the first work must NOT show the second: reading a finished record
  // should not show what happened to the cloth after it was written.
  location.hash = '#/trials/' + first.id;
  await settle();
  const firstShots = [...root.querySelectorAll('.lifeshot')];
  if (firstShots.some(el => el.classList.contains('earlier')))
    fail('strip', new Error('the first piece of work shows work that came later'));
  else console.log('  strip: earlier work does not show what came after it');

  await db.remove('trials', first.id);
  await db.remove('trials', second.id);
  trialsMod.reset?.();
  location.hash = '#/dashboard';
  await settle();
}

// ---- 24. The bands, against the library they band ------------------------
//
// Bands decide which results merge into one reference record, so they are the
// numbers that most want checking against practice — and until 1.0 nobody had.
// Checking found the definitions and the seeded data already disagreeing.
{
  const { BANDS, bandFor, mordantBand, bandRange } = await import('./vocab.js');
  const plants = JSON.parse(fs.readFileSync('seed/plants.json', 'utf8')).plants;
  const subs = JSON.parse(fs.readFileSync('seed/substances.json', 'utf8')).substances;
  const combos = JSON.parse(fs.readFileSync('seed/combinations.json', 'utf8')).combinations;

  // 1. Every band a combination names must exist on the scale it is read
  //    against. Renaming a dimension without moving the data is how a key comes
  //    to hold a word nothing can resolve.
  const strengths = new Set(BANDS.filter(b => b.dimension === 'mordant_strength').map(b => b.code));
  const orphans = combos.filter(c => c.key?.mordantBand && !strengths.has(c.key.mordantBand));
  if (orphans.length)
    fail('bands', new Error(`${orphans.length} combinations name a strength that is not on the scale`));
  else console.log(`  bands: every combination's strength is on the scale (${combos.length} records)`);

  // 2. A mordant at its own standard dose must band as MEDIUM. This is what
  //    the relative scale is for, and the assertion that fixed the old one:
  //    under an absolute scale, ordinary alum banded "high" and ordinary iron
  //    "low", while the data called both "the usual amount".
  const wrong = [];
  for (const sub of subs) {
    if (!sub.standardPercentWof) continue;
    const b = mordantBand(sub.standardPercentWof, sub);
    if (b !== 'medium') wrong.push(`${sub.code}:${b}`);
  }
  if (wrong.length)
    fail('bands', new Error(`a standard dose does not band as medium: ${wrong.join(', ')}`));
  else console.log('  bands: every mordant at its standard dose bands as medium');

  // 3. Iron and alum must not band the same at the same percentage — the whole
  //    reason the scale became relative.
  const alum = subs.find(x => x.mordantTypeCode === 'alum_potassium' && x.standardPercentWof);
  const iron = subs.find(x => x.mordantTypeCode === 'iron' && x.standardPercentWof);
  if (alum && iron && mordantBand(4, alum) === mordantBand(4, iron))
    fail('bands', new Error('4% alum and 4% iron band identically'));
  else console.log('  bands: the same percentage means different things for different mordants');

  // 4. A band must divide the library rather than swallow it. Not an even
  //    split — the craft clusters — but no band may hold everything.
  const temps = plants.flatMap(p => (p.parts || [])
    .map(x => (x.tempDyeC || {}).min).filter(v => v != null));
  const spread = {};
  for (const v of temps) { const b = bandFor('temperature', v); spread[b] = (spread[b] || 0) + 1; }
  const biggest = Math.max(...Object.values(spread));
  if (Object.keys(spread).length < 2)
    fail('bands', new Error('every dye temperature in the library falls in one band'));
  else if (biggest === temps.length)
    fail('bands', new Error('the temperature scale does not divide the library at all'));
  else console.log(`  bands: dye temperature divides into ${Object.keys(spread).length} bands`);

  // 5. The separations that MATTER, named rather than counted. Madder loses its
  //    red above about 60 °C and oak bark is worked at 85-95; if those two band
  //    alike, the reference merges results that behave nothing like each other.
  const at = (code, part) => {
    const p = plants.find(x => x.code === code);
    const pt = (p?.parts || []).find(x => x.partCode === part);
    return (pt?.tempDyeC || {}).min;
  };
  const madder = at('rubia_tinctorum', 'root'), oak = at('quercus_robur', 'bark');
  if (madder != null && oak != null && bandFor('temperature', madder) === bandFor('temperature', oak))
    fail('bands', new Error('madder and oak bark band to the same temperature'));
  else console.log('  bands: madder and oak bark are told apart');

  // 6. No dimension may be missing a range it claims to have.
  const holes = BANDS.filter(b => b.min == null || (b.max != null && b.max <= b.min));
  if (holes.length)
    fail('bands', new Error(`a band has no range: ${holes.map(b => b.key).join(', ')}`));
  else console.log(`  bands: ${BANDS.length} bands, each with a real range`);
}

// ---- 24b. No two reference records answer the same question ---------------
//
// A combination IS its key: plant, part, fibre class, mordant, strength,
// process, blanket, medium. Two records with one key are two answers to one
// question, and which of them a trial reaches is decided by the order of the
// seed file — which is to say, by nothing.
//
// Found by the matcher, not by reading: oak bark with alum on cellulose has two
// records that differ in no dimension at all.
{
  const combos = JSON.parse(fs.readFileSync('seed/combinations.json', 'utf8')).combinations;
  // `medium` and `blanket` are OBJECTS — the pH and where it was applied live
  // inside `medium`. Joining them turned both into "[object Object]" and every
  // pair that differed only by pH looked identical.
  //
  // Which is how this check reported that the model had no pH slot when the
  // model has carried one all along. A check that flattens a structure it does
  // not understand invents the fault it reports, and this one nearly cost a
  // change to the key.
  const keyOf = (c) => {
    const k = c.key || {};
    return JSON.stringify([k.dyeSource?.plantId, k.dyeSource?.partCode, k.fibreClass,
      k.fibreCode, k.mordantCode, k.mordantBand, k.processCode, k.blanket, k.medium]);
  };
  const byKey = new Map();
  for (const c of combos) {
    const k = keyOf(c);
    byKey.set(k, [...(byKey.get(k) || []), c.code]);
  }
  const clashes = [...byKey.values()].filter(v => v.length > 1);

  // Reported and not failed, deliberately.
  //
  // These are data, and one of the four is not a duplicate at all: the two
  // tagetes records are named "acid" and "alkaline" and the key has no pH slot,
  // so the model cannot yet tell them apart even though the search asks about
  // pH. Repairing them means either adding pH to the key or deciding those two
  // records are one — a decision for the owner, not a migration inferred from a
  // code string (§8.0b).
  //
  // A hard failure over outstanding data work is a check that gets switched off,
  // and a check that is off protects nothing.
  if (clashes.length) {
    console.log(`  combos: ${clashes.length} question(s) with more than one answer — Part A1:`);
    for (const v of clashes) console.log(`          ${v.join('  =  ')}`);
  } else console.log(`  combos: ${combos.length} records, each answering a different question`);
}

// ---- 24c. Every vocabulary a seed pack names must render as a word --------
//
// `cameo-mfa` shipped with `kind: 'reference'` and `natures-rainbow` with
// `kind: 'website'`. Neither was in `KINDS` in modules/sources.js and neither
// had a translation, so the Sources screen printed the literal key
// `sources.kind.reference` where a word belonged — for as long as both records
// have existed, in both languages, in plain sight.
//
// Nothing was looking. Layer 3b of check.sh reads literal `t('...')` keys, and
// this one is built at run time as `t('sources.kind.' + sx.kind)`; that layer's
// own comment says a constructed key cannot be checked there. So the check has
// to come from the other end: from the DATA, asking whether every code a seed
// pack actually uses resolves to a word.
//
// Held against the code's own KINDS list rather than a copy: a second list here
// would be a second thing to keep in step, and it would drift.
{
  const src = fs.readFileSync('modules/library.js', 'utf8');
  const m = src.match(/const KINDS = \[([^\]]*)\]/);
  if (!m) {
    fail('vocab', new Error('cannot find KINDS in modules/library.js'));
  } else {
    const kinds = [...m[1].matchAll(/'([a-z_]+)'/g)].map(x => x[1]);
    const sources = JSON.parse(fs.readFileSync('seed/sources.json', 'utf8')).sources;

    const unlisted = [...new Set(sources.map(s => s.kind).filter(k => !kinds.includes(k)))];
    if (unlisted.length)
      fail('vocab', new Error(`seeded source kind not in KINDS: ${unlisted.join(', ')}`));
    else console.log(`  vocab: every seeded source kind is a known kind (${sources.length} sources)`);

    // A kind in KINDS with no translation renders as the key too — the same
    // fault from the other direction, and the reason this checks both lists
    // rather than only the data.
    const dict = fs.readFileSync('i18n.js', 'utf8');
    const cut = dict.indexOf('  en: {');
    const has = (lang, key) => {
      const part = lang === 'bg' ? dict.slice(dict.indexOf('  bg: {'), cut) : dict.slice(cut);
      return part.includes(`'${key}':`);
    };
    const untranslated = [];
    for (const k of kinds)
      for (const lang of ['bg', 'en'])
        if (!has(lang, `sources.kind.${k}`)) untranslated.push(`${k} (no ${lang})`);

    if (untranslated.length)
      fail('vocab', new Error(`source kind with no translation: ${untranslated.join(', ')}`));
    else console.log(`  vocab: every source kind has a word in both languages (${kinds.length} kinds)`);
  }
}

// ---- 24d. The glossary holds together and does not duplicate the vocabulary
//
// Two failures this is built to catch.
//
// The first is ordinary: a `seeAlso` or `sourceCode` pointing at something that
// is not there. One shipped in the first draft — `tannin` pointed at `iron`,
// which is a substance, not a glossary term. A dead cross-reference renders as
// nothing or as a broken chip, and nobody notices which.
//
// The second is the reason the glossary is built the way it is. Five codes in
// vocab.js already carry their own explanation and show it where the code is
// shown (§13aw) — `mordant_accumulator` and the four extraction modes. A
// glossary term repeating one of those is a SECOND definition of one thing in
// two files, and the two will drift at the first edit. The glossary reads those
// five rather than restating them, and this guard holds that line.
{
  const gloss = JSON.parse(fs.readFileSync('seed/glossary.json', 'utf8')).terms;
  const codes = new Set(gloss.map(t => t.code));

  const dangling = [];
  for (const t of gloss)
    for (const s of (t.seeAlso || []))
      if (!codes.has(s)) dangling.push(`${t.code} -> ${s}`);
  if (dangling.length)
    fail('glossary', new Error(`seeAlso pointing nowhere: ${dangling.join(', ')}`));
  else console.log(`  glossary: every cross-reference reaches a term (${gloss.length} terms)`);

  const sourceCodes = new Set(
    JSON.parse(fs.readFileSync('seed/sources.json', 'utf8')).sources.map(s => s.code));
  const badSource = gloss
    .filter(t => t.sourceCode && !sourceCodes.has(t.sourceCode))
    .map(t => `${t.code} -> ${t.sourceCode}`);
  if (badSource.length)
    fail('glossary', new Error(`sourceCode pointing nowhere: ${badSource.join(', ')}`));
  else console.log('  glossary: every attribution reaches a real source');

  // Both languages, on the term and on the definition. A half-translated term
  // renders as an empty line rather than as an obvious gap.
  const halfTranslated = [];
  for (const t of gloss)
    for (const field of ['term', 'definition'])
      for (const lang of ['bg', 'en'])
        if (!t[field]?.[lang]?.trim()) halfTranslated.push(`${t.code}.${field}.${lang}`);
  if (halfTranslated.length)
    fail('glossary', new Error(`missing text: ${halfTranslated.join(', ')}`));
  else console.log('  glossary: every term reads in both languages');

  // The line against duplication.
  const vocabSrc = fs.readFileSync('vocab.js', 'utf8');
  const explained = [...vocabSrc.matchAll(
    /V\('[a-z_]+',\s*'([a-z_]+)',\s*'[^']*',\s*'[^']*',\s*\d+,\s*\{/g)].map(m => m[1]);
  const clash = explained.filter(c => codes.has(c));
  if (clash.length)
    fail('glossary', new Error(
      `term also explained in vocab.js — one thing, two definitions: ${clash.join(', ')}`));
  else console.log(`  glossary: nothing restates a vocabulary explanation (${explained.length} in vocab.js)`);
}

// ---- 25. A placement finds the right reference record ---------------------
//
// The other half of §13bp. The matcher read plant, part and process and nothing
// else, so a piece dyed on oak bark with IRON and a piece dyed on oak bark with
// ALUM attached to the same reference record — two results that look nothing
// alike, filed as one.
//
// The library holds both records, and has all along. Nothing was reading them.
{
  const trialsMod = (await import('./modules/trials.js')).default;
  const combos = await db.all('combinations');
  const subs = await db.all('substances');

  // Matched on the id: a seeded record's code lives in `seed:<code>` and the
  // field itself is not carried into the store. Looked for on the record it
  // finds nothing, and the check passes by not running — the same quiet
  // uselessness §13bh recorded, made twice now.
  const oakAlum = combos.find(c => /quercus_robur_bark_alum/.test(String(c.id)));
  const oakIron = combos.find(c => /quercus_robur_bark_iron/.test(String(c.id)));
  const oak = (await db.all('plants')).find(p => /quercus_robur/.test(String(p.id)));

  if (!oakAlum || !oakIron || !oak) {
    console.log('  match: the oak records are not in this database, skipped');
  } else {
    const alumSub = subs.find(x => x.mordantTypeCode === 'alum_potassium' && x.standardPercentWof);
    const ironSub = subs.find(x => x.mordantTypeCode === 'iron' && x.standardPercentWof);

    // Two pieces of cloth, prepared differently, dyed on the same plant and part.
    const make = async (sub, pc, label) => {
      const recipe = db.newRecord({
        name: { bg: label }, type: 'mordant',
        // A role filled by one substance, which is the shape a real recipe has.
        ingredients: [{ id: 'zz-i', roleCode: 'mordant', basis: 'percent_wof',
                        options: [{ id: 'zz-o', substanceId: sub.id, qtyMin: pc, qtyMax: pc }] }],
      });
      await db.put('recipes', recipe);
      const cloth = db.newRecord({
        label, name: label, weightG: 100, composition: [{ fibreCode: 'cotton', percent: 100 }],
        state: 'mordanted',
        actions: [{ id: 'zz-' + label, actionCode: 'mordant', date: '2026-01-01',
                    recipeId: recipe.id, batchId: 'zz-b-' + label }],
      });
      await db.put('fabrics', cloth);
      const trial = db.newRecord({
        status: 'in_progress', title: label, date: '2026-02-01',
        processCode: 'immersion', fabricIds: [cloth.id], steps: [],
        placements: [{ id: 'zz-p-' + label, plantId: oak.id, partCode: 'bark' }],
      });
      await db.put('trials', trial);
      return { trial, cloth, recipe };
    };

    // Doses chosen to land in the band each record names, rather than at the
    // standard: the oak iron record says LOW iron, and a trial at the standard
    // 1% is medium — a different condition, and rightly not that record. The
    // first version of this check mordanted both at standard and read the
    // resulting non-match as a fault in the matcher.
    const A = await make(alumSub, alumSub.standardPercentWof, 'ZZALUM');       // medium
    const I = await make(ironSub, ironSub.standardPercentWof * 0.5, 'ZZIRON'); // low

    // Saved through the module, so the matcher runs the way it runs in use.
    for (const { trial } of [A, I]) {
      trialsMod.reset?.();
      location.hash = '#/trials/' + trial.id;
      await settle();
      const save = root.querySelector('[data-save]');
      if (save) { save.click(); await settle(); }
    }

    const a = (await db.get('trials', A.trial.id)).placements[0].combinationId;
    const i = (await db.get('trials', I.trial.id)).placements[0].combinationId;

    if (!a || !i)
      fail('match', new Error(`a placement found no reference record (alum=${a}, iron=${i})`));
    else if (a === i)
      fail('match', new Error('alum and iron on the same plant matched the same record'));
    else console.log('  match: alum and iron on one plant reach different reference records');

    // The library holds more than one alum record for oak bark with identical
    // keys, so the assertion is that the alum placement reached AN alum record —
    // asserting which one would be asserting the order of the seed file.
    const alumIds = combos.filter(c => /quercus_robur_bark_alum|quercus_bark_alum/.test(String(c.id)))
      .map(c => c.id);
    if (a && !alumIds.includes(a))
      fail('match', new Error('the alum placement did not reach an alum record'));
    else if (i && i !== oakIron.id)
      fail('match', new Error('the iron placement did not reach the iron record'));
    else console.log('  match: each reaches the record naming its own mordant');

    // pH separates where nothing else does. Tagetes on cellulose, same mordant,
    // same strength: pale yellow in acid, bright canary in alkali. If the
    // matcher ignored pH these two would be one answer — and they are the pair
    // that nearly persuaded the model to grow a field it already had.
    const tagetes = (await db.all('plants')).find(p => /tagetes_erecta/.test(String(p.id)));
    const acidRec = combos.find(c => /tagetes.*acid/.test(String(c.id)));
    const alkRec = combos.find(c => /tagetes.*alkaline/.test(String(c.id)));

    if (tagetes && acidRec && alkRec) {
      const dyeAt = async (phCode, label) => {
        const cloth = db.newRecord({
          label, name: label, weightG: 100,
          composition: [{ fibreCode: 'cotton', percent: 100 }], state: 'mordanted',
          actions: [{ id: 'zz-' + label, actionCode: 'mordant', date: '2026-01-01',
                      recipeId: A.recipe.id, batchId: 'zz-b-' + label }],
        });
        await db.put('fabrics', cloth);
        const trial = db.newRecord({
          status: 'in_progress', title: label, date: '2026-02-01',
          processCode: 'immersion', fabricIds: [cloth.id],
          steps: [{ id: 'zz-s-' + label, stageCode: 'colour', typeCode: 'dye',
                    mediumMod: { phCode, whereCode: 'dye_bath' } }],
          placements: [{ id: 'zz-pl-' + label, plantId: tagetes.id, partCode: 'flower' }],
        });
        await db.put('trials', trial);
        trialsMod.reset?.();
        location.hash = '#/trials/' + trial.id;
        await settle();
        const save = root.querySelector('[data-save]');
        if (save) { save.click(); await settle(); }
        const out = (await db.get('trials', trial.id)).placements[0].combinationId;
        await db.remove('trials', trial.id);
        await db.remove('fabrics', cloth.id);
        return out;
      };

      const acid = await dyeAt('acid', 'ZZACID');
      const alk = await dyeAt('alkaline', 'ZZALK');

      if (!acid || !alk)
        fail('match', new Error(`a pH-modified bath found no record (acid=${acid}, alkaline=${alk})`));
      else if (acid === alk)
        fail('match', new Error('an acid and an alkaline bath matched the same record'));
      else if (acid !== acidRec.id || alk !== alkRec.id)
        fail('match', new Error('the pH placements reached the wrong records'));
      else console.log('  match: acid and alkaline reach different records for the same plant');
    }

    for (const { trial, cloth, recipe } of [A, I]) {
      await db.remove('trials', trial.id);
      await db.remove('fabrics', cloth.id);
      await db.remove('recipes', recipe.id);
    }
    trialsMod.reset?.();
    location.hash = '#/dashboard';
    await settle();
  }
}

// ---- 26. The figures you need over a pot ---------------------------------
//
// The working strip (§13bs). Its job is that somebody standing at the stove
// finds the part, the dose, both temperatures and the ceiling in one place,
// rather than gathering them from three.
{
  const plantsMod = (await import('./modules/plants.js')).default;
  // Pelargonium, not madder. Only the nine plants swatched in 0.98.1 carry a
  // part on their colours, so on any of the older 48 this check would pass by
  // not testing — which it did on the first run, and which is the quietest way
  // for a guard to be useless (§13bh).
  const madder = (await db.all('plants')).find(p => /pelargonium/.test(String(p.id)));

  if (!madder) {
    console.log('  usenow: madder is not in this database, skipped');
  } else {
    plantsMod.reset?.();
    plantsMod.open(madder.id);
    await plantsMod.render(root);
    await settle();

    const strip = root.querySelector('.usenow');
    if (!strip) {
      fail('usenow', new Error('the working figures are not shown as a strip'));
    } else {
      const heads = [...strip.querySelectorAll('.usetile')]
        .map(el => (el.querySelector('.usehead')?.textContent || '').trim());
      const vals = [...strip.querySelectorAll('.usetile')]
        .map(el => (el.querySelector('.useval')?.textContent || '').trim());

      if (heads.some(h => !h))
        fail('usenow', new Error('a figure is shown with no word saying what it is'));
      else console.log(`  usenow: ${heads.length} figures, each named as well as marked`);

      if (vals.some(v => !v))
        fail('usenow', new Error('a tile was rendered with nothing in it'));
      else console.log('  usenow: nothing empty is shown');

      // The three that decide whether a bath works, present by name.
      const text = strip.textContent || '';
      const missing = ['WOF', '°C'].filter(x => !text.includes(x));
      if (missing.length)
        fail('usenow', new Error(`the strip carries no ${missing.join(' and no ')}`));
      else console.log('  usenow: the dose and the temperatures are on it');
    }

    // A swatch says the heat it was got at, read from its own part.
    const caps = [...root.querySelectorAll('.refcard .hint')].map(el => el.textContent || '');
    if (!caps.some(x => x.includes('°C')))
      fail('usenow', new Error('a colour is shown without the temperature it needs'));
    else console.log('  usenow: a swatch carries the temperature of the part it came from');

    plantsMod.reset?.();
    location.hash = '#/dashboard';
    await settle();
  }
}

console.log(failed ? 'DEEP CHECK FAILED' : 'deep check passed');
process.exit(failed?1:0);

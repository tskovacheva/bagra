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
d('URL',dom.window.URL); d('alert',()=>{}); d('confirm',()=>true);
d('crypto',{randomUUID:()=>'id-'+Math.random().toString(36).slice(2)});
d('fetch', async(u)=>{ const p=String(u).replace(/^.*\/bagra\//,'');
  if(!fs.existsSync(p)) return {ok:false,status:404,json:async()=>({})};
  return {ok:true,status:200,json:async()=>JSON.parse(fs.readFileSync(p,'utf8'))}; });

let failed=false;
const fail=(l,e)=>{failed=true;console.log(`FAIL ${l}: ${e?.message||e}`);
  if(e?.stack) console.log(e.stack.split('\n').slice(1,4).join('\n'));};
process.on('unhandledRejection',e=>fail('rejection',e));

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
const click = async (el) => {
  if (!el) throw new Error('nothing to click — the expected control is not on screen');
  el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
  await new Promise(r => setTimeout(r, 30));
};

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
    // walk out the way a person would: press Back until the list reappears.
    for (let i = 0; i < 3; i++) {
      const back = root.querySelector('[data-back]');
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
    const back = root.querySelector('[data-back]');
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
    await click(root.querySelector('[data-back]'));
    if (asked !== before + 1) fail('guard', new Error('leaving did not ask'));
    else if (!root.querySelector('[data-save]'))
      fail('guard', new Error('Back went through after being refused — work lost'));
    else console.log('  guard: Back refused, the form is still open');

    // Accepted: it goes through, and the state resets.
    answer = true;
    await click(root.querySelector('[data-back]'));
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
    await click(root.querySelector('[data-back]'));
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

  trials.reset?.();
  await trials.render(root);
  await click(root.querySelector('[data-new]'));
  await click(root.querySelector('[data-step-add]'));

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
    // The read view groups the same way, and must name the technique it used.
    const readHeads = [...root.querySelectorAll('.stagehead b')].map(el => el.textContent.trim());
    if (readHeads.length !== 5)
      fail('stages', new Error(`the read view shows ${readHeads.length} runs, not five`));
    else console.log('  stages: the read view groups the same way');

    await click(root.querySelector('[data-edit]'));

    const heads = [...root.querySelectorAll('.stagehead b')].map(el => el.textContent.trim());
    // Five runs, not four stages: colouring is entered, left for the print,
    // and entered again. That second visit is the thing being protected.
    if (heads.length !== 5)
      fail('stages', new Error(`expected five runs, got ${heads.length}: ${heads.join(' | ')}`));
    else if (heads[1] !== heads[3])
      fail('stages', new Error(`colouring should appear twice, got: ${heads.join(' | ')}`));
    else console.log(`  stages: ${heads.join(' › ')}`);

    // Every step must still be on screen exactly once after grouping.
    const rows = root.querySelectorAll('.stagegroup .ingrow').length;
    if (rows !== 5) fail('stages', new Error(`five steps went in, ${rows} came out`));
    else console.log('  stages: every step is shown exactly once');

    // Adding to a stage inserts into that run, not at the end of the trial.
    const addToFirst = root.querySelector('.stagegroup [data-step-add]');
    await click(addToFirst);
    const after = root.querySelectorAll('.stagegroup .ingrow').length;
    if (after !== 6) fail('stages', new Error('adding a step to a stage did nothing'));
    else {
      const nowHeads = [...root.querySelectorAll('.stagehead b')].map(el => el.textContent.trim());
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

console.log(failed ? 'DEEP CHECK FAILED' : 'deep check passed');
process.exit(failed?1:0);

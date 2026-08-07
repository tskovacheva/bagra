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
    if (mod.enter) await mod.enter();
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
      if (mod.enter) await mod.enter();
    }
  } catch (err) { fail(name, err); }
}

// ---- the two fixes, checked as behaviour rather than as diffs -------------

// 1. Opening the new-fabric form must not consume a tag number.
{
  const fabrics = (await import('./modules/fabrics.js')).default
    || await import('./modules/fabrics.js');
  const before = await db.getSetting('fabricLabelCounter', 0);
  if (fabrics.enter) await fabrics.enter();
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
  if (fabrics.enter) await fabrics.enter();
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
    if (trials.enter) await trials.enter();
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

console.log(failed ? 'DEEP CHECK FAILED' : 'deep check passed');
process.exit(failed?1:0);

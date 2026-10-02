// try-data-safety.mjs — Commercial Data Safety package 1 (§13ft).
//
// The question a paying customer's journal has to survive, asked end to end
// and with a CLEAN database on the far side of every restore:
//
//     DB A  →  export  →  a new, empty installation  →  restore  →  start  →  DB B
//
// and then „is every record of HERS in B exactly as it was in A" — same id,
// same fields, same createdAt and updatedAt, every reference still resolving.
// Byte equality of the whole database is not the claim: the library is laid
// down again by the start, the counters are reset on purpose, and the language
// belongs to the device (§13co). Her work is compared record by record.
//
// A clean database means a new process. db.js keeps one open connection and
// fake-indexeddb keeps one store per process, so each installation below is a
// child process of this script, handed the file the previous one wrote. That
// is also the honest shape of the thing: a restore onto a new phone shares
// nothing with the old one but the file.
//
// What it holds, and where each was first seen failing:
//   - a MERGE of an older file leaves the added records unrepaired for ever,
//     because the database's markers say every repair has run (the P0 of this
//     package; seen failing on rc118);
//   - the same through a replace from a file with no settings in it;
//   - a merge that leaves out her differing record says so (rc118: silent);
//   - a file from a newer database is refused (rc118: accepted);
//   - a replace is planned — date, what goes — before it is confirmed;
//   - the backup download keeps its address alive past the click (rc118:
//     revoked on the next line, which Safari cannot take);
//   - validation, and multi-store atomicity, before anything is destroyed;
//   - the seven personal recipes and `seed:aluminium-acetate-prep` across
//     upgrade → export → clean restore, both modes, before and after the
//     owner applies the recipe update;
//   - Plans, Trials, the eco-print bundle and `combinationId` across the trip;
//   - an IndexedDB opened at an older version keeps every record.
//
// Run on its own:  node scripts/try-data-safety.mjs

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import 'fake-indexeddb/auto';

const SELF = new URL(import.meta.url).pathname;
const ROOT = path.resolve(path.dirname(SELF), '..');
process.chdir(ROOT);

const define = (n, v) => Object.defineProperty(globalThis, n, { value: v, configurable: true, writable: true });
define('fetch', async (u) => {
  const p = String(u).replace(/^.*\/bagra\//, '').replace(/^\.\//, '');
  if (!fs.existsSync(p)) return { ok: false, status: 404, json: async () => ({}) };
  return { ok: true, status: 200, json: async () => JSON.parse(fs.readFileSync(p, 'utf8')) };
});

let failed = false;
const ok = (m) => console.log('  ok   ' + m);
const fail = (m) => { failed = true; console.log('  FAIL ' + m); };
const is = (got, want, m) => JSON.stringify(got) === JSON.stringify(want)
  ? ok(m) : fail(`${m} — expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);
process.on('unhandledRejection', (e) => fail('rejection: ' + (e?.stack || e)));

const stable = (v) => JSON.stringify(v, (_k, x) => (x && typeof x === 'object' && !Array.isArray(x))
  ? Object.fromEntries(Object.keys(x).sort().map(k => [k, x[k]])) : x);
const isWork = (r) => !!r && (r.origin !== 'seed' || !!r.editedByUser);

const PERSONAL = ['nicoleta-al-fe-impregnation', 'pastels-from-pigment', 'pastel-binder-oat', 'dye-print-paste',
  'compound-mordant-dark', 'soy-milk-bath', 'iron-bath-dark'].map(c => 'seed:' + c);
const AA = 'seed:aluminium-acetate-prep';
const OLD = '2025-03-14T08:00:00.000Z';
const OLDER = '2024-11-02T10:30:00.000Z';

const TMP = process.env.BAGRA_SAFETY_TMP || fs.mkdtempSync(path.join(os.tmpdir(), 'bagra-safety-'));
const file = (n) => path.join(TMP, n);
const phase = process.argv[2] || 'main';

// The start sequence, without the screens: what app.js does between opening the
// database and drawing the first route (`ensurePacks`, then `runMigrations`). A
// reload after a restore is this, run again over what the restore left.
async function start() {
  const seed = await import('../seed.js');
  const { runMigrations } = await import('../migrations.js');
  await seed.ensurePacks();
  await runMigrations();
}

async function dump() {
  const db = await import('../db.js');
  const out = {};
  for (const s of Object.keys(db.STORES)) out[s] = await db.all(s);
  return out;
}

// ------------------------------------------------------------------ DB A
//
// An installation that has lived: the rc117 recipe library still in it, one
// seeded recipe edited, a plant given her own photograph, cloth with a wash
// history and a shared bath, an eco-print trial with a bundle and placements
// that point at a combination, a plan, a pigment batch, a jar, a chain of hers,
// a recipe of hers. Written raw with OLD times, so a restore that restamped
// anything would be visible.
async function buildA() {
  const db = await import('../db.js');
  const seed = await import('../seed.js');
  await start();                                    // installed at some point
  const packId = JSON.parse(fs.readFileSync('seed/recipes.json', 'utf8')).packId;

  // rc117's seven, as an installed copy holds them — seeded, one edited by her.
  for (const id of PERSONAL) {
    await db.putRaw('recipes', { id, origin: 'seed', packId, packVersion: '0.20.1',
      editedByUser: id === 'seed:soy-milk-bath', editedFields: id === 'seed:soy-milk-bath' ? ['notes'] : [],
      type: 'mordant', output: 'none', scaleBy: 'weight', appliesTo: ['cellulose'], version: 1,
      name: { bg: 'рецепта ' + id, en: 'recipe ' + id },
      notes: { bg: id === 'seed:soy-milk-bath' ? 'моята бележка' : 'бележка', en: 'note' },
      ingredients: [{ id: 'i1', roleCode: 'modifier', basis: 'percent_wof', unit: 'g', quantity: 3,
                      quantityMin: 3, quantityMax: 3, options: [] }],
      steps: [], requiredFollowOn: [], sourceCodes: [], distributable: true,
      createdAt: OLDER, updatedAt: OLD });
  }

  // A seeded recipe she edited (scenario D).
  const madder = await db.get('recipes', 'seed:madder-dye');
  await db.putRaw('recipes', { ...madder, editedByUser: true, editedFields: ['notes'],
    notes: { bg: 'моят вариант: 110 % корен', en: 'my version: 110 % root' }, updatedAt: OLD });

  // A plant with her own photograph over the shipped one.
  const plant = (await db.all('plants'))[0];
  await db.putRaw('plants', { ...plant, editedByUser: true, photoData: 'data:image/jpeg;base64,SEVSUw==',
    updatedAt: OLD });

  const comb = (await db.all('combinations'))[0];
  const substance = (await db.all('substances'))[0];

  await db.putRaw('recipes', { id: 'own-recipe', origin: 'user', packId: null, packVersion: null,
    editedByUser: false, editedFields: [], type: 'dye', output: 'none', scaleBy: 'weight', version: 1,
    name: { bg: 'моя брош', en: 'my madder' }, shortCode: 'PAS + COT', notes: { bg: '', en: '' }, ingredients: [], steps: [],
    requiredFollowOn: [], sourceCodes: [], createdAt: OLDER, updatedAt: OLD });
  await db.putRaw('chains', { id: 'own-chain', origin: 'user', name: { bg: 'моята АА верига', en: 'my AA chain' },
    notes: { bg: '', en: '' }, appliesTo: [], steps: [
      { id: 'c1', order: 0, recipeId: 'seed:cellulose-scour', choices: {}, note: '' },
      { id: 'c2', order: 1, recipeId: AA, choices: {}, note: 'моята' }],
    createdAt: OLDER, updatedAt: OLD });

  await db.putRaw('batchActions', { id: 'bath-1', actionCode: 'wash', date: '2025-03-01', recipeId: 'seed:cellulose-scour',
    chainId: null, fabricIds: ['cloth-1', 'cloth-2'], totalWeightG: 240, deviation: '', note: 'две парчета',
    origin: 'user', createdAt: OLDER, updatedAt: OLD });
  for (const [id, label] of [['cloth-1', 'K-001'], ['cloth-2', 'K-002']]) {
    await db.putRaw('fabrics', { id, origin: 'user', label, fibreCode: 'cotton', weightG: 120, state: 'dyed',
      actions: [
        { id: `${id}-a1`, fabricId: id, actionCode: 'wash', date: '2025-03-01', batchId: 'bath-1', trialId: null,
          recipeId: 'seed:cellulose-scour', note: '' },
        { id: `${id}-a2`, fabricId: id, actionCode: 'mordant', date: '2025-03-02', batchId: null, trialId: 'trial-eco',
          recipeId: AA, note: '' }],
      photoData: 'data:image/jpeg;base64,Q0xPVEg=', createdAt: OLDER, updatedAt: OLD });
  }

  await db.putRaw('trials', { id: 'trial-eco', origin: 'user', status: 'complete', title: 'дъб върху памук',
    processCode: 'ecoprint_steam', date: '2025-03-03', finishedOn: '2025-03-04', fabricIds: ['cloth-1', 'cloth-2'],
    steps: [{ id: 's1', typeCode: 'mordant_bath', stageCode: 'prepare', recipeId: AA, photos: [] },
            { id: 's2', typeCode: 'lay_base', stageCode: 'colour', roleCode: 'print', what: 'памук', photos: [] }],
    bundle: { roll: 'на тръба', layers: [
      { id: 'L1', kind: 'printing_cloth', what: 'памук', note: '', stepId: 's2',
        prep: { washed: true, treatment: 'AA', duration: '', bath: 'bath-1', note: '' } },
      { id: 'L2', kind: 'plants', what: 'дъбови листа', note: 'гръб надолу', stepId: null, prep: null }] },
    placements: [{ id: 'p1', plantId: plant.id, part: 'leaf', facing: 'face_down', combinationId: comb.id,
                   observation: 'тъмно', photo: 'data:image/jpeg;base64,UExBQ0U=' }],
    resultPhotos: ['data:image/jpeg;base64,UkVTVUxU'], notes: '', createdAt: OLDER, updatedAt: OLD });

  await db.putRaw('plans', { id: 'plan-1', title: 'пролетни опити', status: 'active', notes: 'бележки',
    // v1.1 (§13gb): a source and a picture — compareWork holds them field for field.
    sourceLabel: 'Printing with Botanicals — Laura Mead', sourceUrl: 'https://www.facebook.com/groups/x/posts/1',
    referenceImage: 'data:image/jpeg;base64,UExBTi1SRUZFUkVOQ0U=',
    items: [{ id: 'i1', text: 'брош върху коприна', checked: true }, { id: 'i2', text: 'орех', checked: false }],
    createdAt: OLDER, updatedAt: OLD });
  await db.putRaw('pigmentBatches', { id: 'pb-1', origin: 'user', status: 'done', plantId: plant.id,
    viaKind: 'recipe', viaId: 'seed:pastels-from-pigment', lines: [], linesFrom: null, swatches: [],
    process: { bg: 'три часа', en: '' }, photos: ['data:image/jpeg;base64,UElHTUVOVA=='],
    createdAt: OLDER, updatedAt: OLD });
  await db.putRaw('stock', { id: 'jar-1', origin: 'user', substanceId: substance.id, status: 'have',
    amount: 500, createdAt: OLDER, updatedAt: OLD });
  await db.setSetting('fabricLabelCounter', 2);

  // The upgrade: this build starts over it.
  await start();
  fs.writeFileSync(file('A-before-apply.json'), JSON.stringify(await (await import('../backup.js')).exportAll()));

  // And she applies the recipe update as offered — the seven become hers.
  const diff = await seed.diffPack('recipes');
  is(diff.retired.map(e => e.id).sort(), [...PERSONAL].sort(), 'A: the upgrade offers the seven as becoming hers');
  is(diff.withdrawn.length, 0, 'A: and offers none of them for removal');
  is(diff.edited.map(e => e.id).includes('seed:madder-dye'), true, 'A: her edited madder recipe is listed as hers, unticked');
  const chosen = seed.defaultChosen(diff);
  is(chosen.has('seed:madder-dye'), false, 'A: the update would not touch her edit');
  await seed.applyDiff('recipes', [...diff.retired, ...diff.changed, ...diff.added].filter(e => chosen.has(e.id)), diff.pack);
  for (const id of PERSONAL) {
    const r = await db.get('recipes', id);
    if (r?.origin !== 'user' || r.packId || r.retiredFrom !== packId) fail(`A: ${id} not handed over`);
  }
  ok('A: the seven are hers — origin user, no pack, retiredFrom the recipe pack');
  is((await db.get('recipes', 'seed:madder-dye')).notes.bg, 'моят вариант: 110 % корен', 'A: her madder edit survived the update');

  const A = await dump();
  const backup = await (await import('../backup.js')).exportAll();
  fs.writeFileSync(file('A.json'), JSON.stringify(backup));
  fs.writeFileSync(file('A-dump.json'), JSON.stringify(A));
  return backup;
}

// ------------------------------------------------------------- comparing
//
// Every record of hers in A is in B with the same content — createdAt and
// updatedAt included, which is what „historical timestamps preserved" means —
// and every reference that resolved in A resolves in B.
async function compareWork(A, label, { skipIds = [] } = {}) {
  const db = await import('../db.js');
  let checked = 0;
  for (const store of Object.keys(A)) {
    if (['vocabulary', 'bands', 'settings'].includes(store)) continue;
    const keyPath = db.STORES[store].keyPath;
    for (const row of A[store].filter(isWork)) {
      if (skipIds.includes(row[keyPath])) continue;
      const got = await db.get(store, row[keyPath]);
      if (!got) { fail(`${label}: ${store}/${row[keyPath]} is gone`); continue; }
      if (stable(got) !== stable(row)) {
        const diffKeys = [...new Set([...Object.keys(row), ...Object.keys(got)])]
          .filter(k => stable(row[k]) !== stable(got[k]));
        fail(`${label}: ${store}/${row[keyPath]} differs in ${diffKeys.join(', ')}`);
        continue;
      }
      checked++;
    }
  }
  ok(`${label}: ${checked} records of hers identical, ids and timestamps included`);

  // The references, asked of B.
  const has = async (s, id) => !!(await db.get(s, id));
  const refs = [];
  for (const f of await db.all('fabrics')) for (const a of f.actions || []) {
    if (a.batchId) refs.push(['batchActions', a.batchId, `fabric ${f.id} → batch`]);
    if (a.trialId) refs.push(['trials', a.trialId, `fabric ${f.id} → trial`]);
    if (a.recipeId) refs.push(['recipes', a.recipeId, `fabric ${f.id} → recipe`]);
  }
  for (const b of await db.all('batchActions')) for (const fid of b.fabricIds || []) refs.push(['fabrics', fid, `batch ${b.id} → cloth`]);
  for (const tr of await db.all('trials')) {
    for (const fid of tr.fabricIds || []) refs.push(['fabrics', fid, `trial ${tr.id} → cloth`]);
    for (const st of tr.steps || []) if (st.recipeId) refs.push(['recipes', st.recipeId, `trial ${tr.id} → recipe`]);
    for (const pl of tr.placements || []) {
      if (pl.plantId) refs.push(['plants', pl.plantId, `trial ${tr.id} → plant`]);
      if (pl.combinationId) refs.push(['combinations', pl.combinationId, `trial ${tr.id} → combination`]);
    }
  }
  for (const c of await db.all('chains')) for (const st of c.steps || []) refs.push(['recipes', st.recipeId, `chain ${c.id} → recipe`]);
  for (const b of await db.all('pigmentBatches')) if (b.viaKind === 'recipe' && b.viaId) refs.push(['recipes', b.viaId, `pigment ${b.id} → recipe`]);
  for (const j of await db.all('stock')) if (j.substanceId) refs.push(['substances', j.substanceId, `jar ${j.id} → substance`]);
  const dangling = [];
  for (const [s, id, what] of refs) if (!(await has(s, id))) dangling.push(what + ' ' + id);
  is(dangling, [], `${label}: all ${refs.length} references resolve`);
}

async function checkPersonal(label, { handedOver }) {
  const db = await import('../db.js');
  const seed = await import('../seed.js');
  const packId = JSON.parse(fs.readFileSync('seed/recipes.json', 'utf8')).packId;
  const rows = await Promise.all(PERSONAL.map(id => db.get('recipes', id)));
  is(rows.filter(Boolean).length, 7, `${label}: all seven personal recipes are here, by their ids`);
  if (handedOver) {
    is(rows.every(r => r && r.origin === 'user' && !r.packId && r.retiredFrom === packId), true,
       `${label}: and all seven are still hers — origin user, no pack, retiredFrom`);
  }
  is((await db.get('recipes', 'seed:soy-milk-bath'))?.notes?.bg, 'моята бележка', `${label}: her edit to one of them survived`);
  const diff = await seed.diffPack('recipes');
  is(diff.withdrawn.length, 0, `${label}: the recipe update offers none of them for removal`);
  is(diff.retired.length, handedOver ? 0 : 7, `${label}: and ${handedOver ? 'nothing more' : 'all seven'} to hand over`);
  const aa = await db.get('recipes', AA);
  is(!!aa && aa.origin === 'seed', true, `${label}: ${AA} is here under its own id`);
}

// ------------------------------------------------------------------- phases

const PHASES = {
  // A new installation, the file restored as a snapshot, then a start.
  async replace() {
    const db = await import('../db.js');
    const { importBackup, planReplace } = await import('../backup.js');
    await start();
    const A = JSON.parse(fs.readFileSync(file('A-dump.json'), 'utf8'));
    const backup = JSON.parse(fs.readFileSync(file('A.json'), 'utf8'));
    // A record of her own on the new device before the restore — the snapshot
    // must take it away, and the plan must have said so first.
    await db.put('trials', db.newRecord({ id: 'new-device-trial', title: 'written on the new phone', steps: [], placements: [] }));
    const plan = await planReplace(backup);
    is(plan.removedWork, 1, 'replace: the plan says exactly one record of hers will go');
    is(plan.exportedAt, backup.exportedAt, 'replace: and names the file by its date');
    await importBackup(backup, 'replace');
    await start();
    is(await db.get('trials', 'new-device-trial'), undefined, 'replace: that record went, as the plan said');
    await compareWork(A, 'replace');
    await checkPersonal('replace', { handedOver: true });
    is(await db.getSetting('changeCounter', 0), 0, 'replace: the unsaved-changes counter reads zero');
    is(await db.getSetting('lastExportAt'), backup.exportedAt, 'replace: the last backup is dated to the file');
    is(await db.getSetting('fabricLabelCounter'), 2, 'replace: the label counter came back with the work');
  },

  // A new installation with work of its own, the file merged in.
  async merge() {
    const db = await import('../db.js');
    const { importBackup } = await import('../backup.js');
    await start();
    const A = JSON.parse(fs.readFileSync(file('A-dump.json'), 'utf8'));
    const backup = JSON.parse(fs.readFileSync(file('A.json'), 'utf8'));
    const local = { id: 'local-only', origin: 'user', title: 'само тук', date: '2026-09-01', steps: [], placements: [],
                    createdAt: OLDER, updatedAt: OLD };
    await db.putRaw('trials', local);
    const shippedMadder = await db.get('recipes', 'seed:madder-dye');
    const shippedPlant = await db.get('plants', A.plants.find(p => p.photoData).id);
    const report = await importBackup(backup, 'merge');
    await start();
    is(stable(await db.get('trials', 'local-only')), stable(local), 'merge: work already on this device is untouched');
    // The policy is unchanged — what is here wins — and is no longer silent: the
    // two records of hers the file holds differently are counted, and nothing else.
    is(report.differ, 2, 'merge: it reports the two records of hers it kept in place of the file\'s');
    is(stable(await db.get('recipes', 'seed:madder-dye')), stable(shippedMadder),
       'merge: the version already here is the one kept (by policy)');
    is(stable(await db.get('plants', shippedPlant.id)), stable(shippedPlant), 'merge: for the plant too');
    await compareWork(A, 'merge', { skipIds: ['seed:madder-dye', shippedPlant.id] });
    await checkPersonal('merge', { handedOver: true });
  },

  // The file the owner would have taken BEFORE applying the recipe update: the
  // seven still seeded. Restored onto a new installation, whose pack no longer
  // carries them, in either mode, they must arrive and still be offered to her.
  async beforeApply() {
    const { importBackup } = await import('../backup.js');
    const backup = JSON.parse(fs.readFileSync(file('A-before-apply.json'), 'utf8'));
    await start();
    await importBackup(backup, process.env.BAGRA_MODE);
    await start();
    await checkPersonal(`before-apply ${process.env.BAGRA_MODE}`, { handedOver: false });
  },

  // THE P0. A file from an older build merged into a current installation.
  async olderMerge() {
    const db = await import('../db.js');
    const { importBackup, exportAll } = await import('../backup.js');
    await start();
    const all = await db.getSetting('migrations');
    const old = JSON.parse(zlib.gunzipSync(fs.readFileSync('test/older-backups/bagra-1.0.0-rc56.json.gz')).toString('utf8'));
    const report = await importBackup(old, 'merge');
    const reopened = report.reopened || [];
    is(reopened.includes('ecoprintBundleLayers') && reopened.includes('recipeSourceList'), true,
       'older merge: the repairs its records predate are reopened');
    is(reopened.includes('fabricActions'), false, 'older merge: and not the ones the file had already run');
    await start();
    const ecoIds = old.data.trials.filter(t => String(t.processCode || '').startsWith('ecoprint')).map(t => t.id);
    const bare = [];
    for (const id of ecoIds) { const tr = await db.get('trials', id); if (!tr?.bundle) bare.push(id); }
    is(bare, [], `older merge: all ${ecoIds.length} eco-print trials from the file have their bundle after the start`);
    const noList = [];
    for (const r of old.data.recipes) { const got = await db.get('recipes', r.id); if (got && !Array.isArray(got.sourceCodes)) noList.push(r.id); }
    is(noList, [], 'older merge: every recipe from the file has its source list');
    is(await db.getSetting('migrations'), all, 'older merge: and every repair is marked as run again');

    // The other direction: a file from THIS build reopens nothing.
    const current = await exportAll();
    await db.put('trials', db.newRecord({ id: 'only-to-be-merged', steps: [], placements: [] }));
    const again = await exportAll();
    await db.remove('trials', 'only-to-be-merged');
    const r2 = await importBackup(again, 'merge');
    is(r2.added, 1, 'current merge: the one missing record is added');
    is(r2.reopened || [], [], 'current merge: and no repair is reopened for a file already in shape');

    // A replace from a file that carries no settings must not leave its records
    // under markers that say they were repaired.
    const bareFile = { ...old, data: { ...old.data } };
    delete bareFile.data.settings;
    const r3 = await importBackup(bareFile, 'replace');
    is((r3.reopened || []).includes('ecoprintBundleLayers'), true,
       'replace without settings: the repairs are reopened too');
    await start();
    const bare2 = [];
    for (const id of ecoIds) { const tr = await db.get('trials', id); if (!tr?.bundle) bare2.push(id); }
    is(bare2, [], 'replace without settings: and the start repairs the trials');
    void current;
  },

  // A database that is refused, and a database that is not touched.
  async validation() {
    const db = await import('../db.js');
    const { JSDOM } = await import('jsdom');
    const dom = new JSDOM('<!doctype html><body></body>', { url: 'https://example.org/bagra/' });
    for (const k of ['window', 'document', 'FileReader', 'Blob']) define(k, k === 'window' ? dom.window : dom.window[k]);
    const b = await import('../backup.js');
    const { VERSION } = await import('../version.js');
    await start();
    await db.putRaw('trials', { id: 't1', origin: 'user', title: 'първи', steps: [], placements: [], createdAt: OLD, updatedAt: OLD });
    await db.putRaw('fabrics', { id: 'f1', origin: 'user', actions: [], createdAt: OLD, updatedAt: OLD });

    const exp = await b.exportAll();
    const expected = Object.keys(db.STORES).filter(s => !['vocabulary', 'bands'].includes(s)).sort();
    is(Object.keys(exp.data).sort(), expected, 'export: every store but the two regenerated ones');
    is([exp.format, exp.schemaVersion, exp.appVersion, exp.dbVersion], ['bagra-backup', 3, VERSION, db.DB_VERSION],
       'export: says what it is, which build wrote it, and which database shape');
    is(Object.entries(exp.counts).every(([s, n]) => exp.data[s].length === n), true, 'export: its counts match its lists');

    const refuses = (payload, why) => { try { b.validateBackup(payload); fail(`accepted ${why}`); } catch { ok(`refuses ${why}`); } };
    refuses({ ...exp, schemaVersion: 4 }, 'a newer file format');
    refuses({ ...exp, dbVersion: db.DB_VERSION + 1 }, 'a file from a newer database');
    refuses({ format: 'bagra-backup', schemaVersion: 3, data: {} }, 'an empty backup');
    refuses({ format: 'bagra-backup', schemaVersion: 3 }, 'a backup with no data');
    refuses({ format: 'bagra-backup', schemaVersion: 3, data: { trials: 'x' } }, 'a store that is not a list');
    refuses(null, 'nothing at all');
    const noVersion = { ...exp }; delete noVersion.dbVersion; delete noVersion.appVersion;
    try { b.validateBackup(noVersion); ok('accepts a file from before the version was recorded'); }
    catch (e) { fail('refused an older file: ' + e.message); }

    // Malformed JSON is refused by the reader, before validation is even reached.
    let threw = false;
    try { await b.readFile(new Blob(['{"format":"bagra-backup","data":{"trials":[{"id":'])); } catch { threw = true; }
    is(threw, true, 'a truncated file is refused by the reader');

    const before = stable(await dump());
    // Validation before destruction: the first store is fine, a later one is not.
    try { await b.importBackup({ ...exp, data: { ...exp.data, trials: [], fabrics: [{ nope: 1 }] } }, 'replace'); fail('a file with a keyless record was restored'); }
    catch { ok('a file whose later store has a keyless record is refused'); }
    is(stable(await dump()) === before, true, 'and nothing was written — not even to the store that came first');
    // Atomicity across stores: a key IndexedDB refuses, found only inside the
    // transaction, after the first store has been cleared.
    try { await b.importBackup({ ...exp, data: { ...exp.data, trials: [], fabrics: [{ id: { not: 'a key' } }] } }, 'replace'); fail('an unkeyable record was restored'); }
    catch { ok('a record IndexedDB cannot key aborts the restore'); }
    is(stable(await dump()) === before, true, 'and every store is exactly as it was — the cleared one included');

    // An all-empty file is a valid backup of an empty database; the plan says
    // what it would cost, which is what the confirmation shows.
    const empty = { ...exp, data: Object.fromEntries(Object.keys(exp.data).map(s => [s, []])) };
    const plan = b.planReplace ? await b.planReplace(empty) : {};
    is(plan.removedWork, 2, 'an empty backup: the plan says both records of hers would go');

    // The download: attached when clicked, and its address alive afterwards.
    let connected = null, revoked = 0;
    define('URL', { createObjectURL: () => 'blob:bagra', revokeObjectURL: () => { revoked++; } });
    dom.window.HTMLAnchorElement.prototype.click = function () { connected = this.isConnected; };
    await db.setSetting('changeCounter', 5);
    await b.downloadBackup();
    is(connected, true, 'download: the link is in the document when it is clicked');
    is(revoked, 0, 'download: and its address is not revoked on the way out');
    is(document.querySelectorAll('a[download]').length, 0, 'download: and the link is taken out again');
    is(await db.getSetting('changeCounter'), 0, 'download: the counter is reset after the export');
  },

  // An installation opened at an older IndexedDB version keeps its records.
  async idbUpgrade() {
    const openRaw = (version, stores) => new Promise((res, rej) => {
      const req = indexedDB.open('bagra', version);
      req.onupgradeneeded = () => {
        for (const s of stores) {
          const kp = s === 'settings' ? 'key' : (['vocabulary', 'bands'].includes(s) ? 'key' : 'id');
          req.result.createObjectStore(s, { keyPath: kp });
        }
      };
      req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error);
    });
    const put = (d, s, row) => new Promise((res, rej) => {
      const t = d.transaction(s, 'readwrite'); t.objectStore(s).put(row); t.oncomplete = res; t.onerror = () => rej(t.error);
    });
    // Database version 6: before batchActions, glossary, pigmentBatches, plans.
    const v6 = ['fabrics', 'substances', 'stock', 'plants', 'recipes', 'chains', 'sources', 'techniques',
                'combinations', 'trials', 'photos', 'vocabulary', 'bands', 'settings'];
    const d = await openRaw(6, v6);
    await put(d, 'trials', { id: 'old-trial', origin: 'user', title: 'от 2024', createdAt: OLDER, updatedAt: OLD });
    await put(d, 'fabrics', { id: 'old-cloth', origin: 'user', stateEvents: [{ id: 'e1', stateCode: 'scoured', date: '2024-10-01' }],
                              createdAt: OLDER, updatedAt: OLD });
    await put(d, 'vocabulary', { key: 'stale', code: 'stale', dimension: 'x' });
    d.close();
    const db = await import('../db.js');
    await start();
    is(db.DB_VERSION, (await db.open()).version, 'upgrade: the database is at the current version');
    const names = [...(await db.open()).objectStoreNames];
    is(['batchActions', 'glossary', 'pigmentBatches', 'plans'].every(s => names.includes(s)), true, 'upgrade: the stores added since are created');
    is((await db.get('trials', 'old-trial'))?.updatedAt, OLD, 'upgrade: a trial from the old database is untouched');
    const cloth = await db.get('fabrics', 'old-cloth');
    is([cloth?.stateEvents?.length, cloth?.actions?.[0]?.actionCode, cloth?.updatedAt], [1, 'wash', OLD],
       'upgrade: the old cloth kept its list, gained its actions, and was not restamped');
    is(!!(await db.get('batchActions', cloth.actions[0].batchId)), true, 'upgrade: and the batch its action points at exists');
    is(await db.get('vocabulary', 'stale'), undefined, 'upgrade: the regenerated store was recreated, as designed');
  },
};

// ------------------------------------------------------------------ driver

if (phase !== 'main') {
  try { await PHASES[phase](); } catch (e) { fail(`${phase} stopped: ${e?.stack || e}`); }
  process.exit(failed ? 1 : 0);
}

const run = (name, env = {}) => {
  console.log(`\n${name}${env.BAGRA_MODE ? ' (' + env.BAGRA_MODE + ')' : ''}`);
  try {
    process.stdout.write(execFileSync(process.execPath, [SELF, name],
      { env: { ...process.env, BAGRA_SAFETY_TMP: TMP, ...env }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
  } catch (e) {
    process.stdout.write(e.stdout || '');
    process.stdout.write(e.stderr ? String(e.stderr).split('\n').filter(l => !/Warning|Reparsing|trace-warnings|MODULE_TYPELESS/.test(l)).join('\n') : '');
    failed = true;
    console.log(`  FAIL ${name} exited ${e.status}`);
  }
};

console.log('DB A — an installation that has lived, upgraded, and exported');
try { await buildA(); } catch (e) { fail('building A stopped: ' + (e?.stack || e)); }
run('replace');
run('merge');
run('beforeApply', { BAGRA_MODE: 'replace' });
run('beforeApply', { BAGRA_MODE: 'merge' });
run('olderMerge');
run('validation');
run('idbUpgrade');

if (!process.env.BAGRA_SAFETY_TMP) fs.rmSync(TMP, { recursive: true, force: true });
console.log(failed ? '\ndata safety FAILED' : '\ndata safety passed');
process.exit(failed ? 1 : 0);

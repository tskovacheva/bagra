// check-actions.mjs — the three invariants of §13bd, checked against the code
// and against a backup file if one is given.
//
//   node check-actions.mjs                        # code-level checks only
//   node check-actions.mjs ../bagra-2026-08-17.json
//
// Each of the three was written by breaking it first and watching it fail. A
// guard never seen to fail has not been tested, and the failures are kept in
// `--selftest` so the next person can see them fail too rather than taking it
// on trust.

import { readFileSync } from 'node:fs';
import { migrateAll, migrateFabric, MANUAL_ACTIONS, MOVES_BOX, movesBox }
  from './migrate-actions.js';
import { currentState, treatmentsOf, STATE_ORDER } from './fabric-logic.js';
import { VOCABULARY } from './vocab.js';

let failed = false;
const fail = (what, why) => { failed = true; console.error(`FAIL ${what}: ${why}`); };
const pass = (what) => console.log(`ok  ${what}`);

// --- 1. the vocabulary and the code agree ----------------------------------
//
// The chip row is drawn from `fabric_action` in the vocabulary; the box moves
// are decided by `MOVES_BOX` in the code. Two lists, and nothing stopping one
// from gaining a term the other has never heard of — which is exactly how the
// prototype ended up showing three different sets of boxes on three screens.

{
  const vocabActions = VOCABULARY.filter(v => v.dimension === 'fabric_action').map(v => v.code);
  const codeActions = [...MANUAL_ACTIONS, 'dye', 'finish'];

  const missing = codeActions.filter(c => !vocabActions.includes(c));
  const extra = vocabActions.filter(c => !codeActions.includes(c));
  if (missing.length) fail('vocabulary', `code knows actions the vocabulary does not: ${missing.join(', ')}`);
  if (extra.length) fail('vocabulary', `vocabulary has actions the code does not: ${extra.join(', ')}`);
  if (!missing.length && !extra.length) pass(`${vocabActions.length} actions, code and vocabulary agree`);

  const vocabStates = VOCABULARY.filter(v => v.dimension === 'fabric_state').map(v => v.code);
  const boxes = [...new Set(Object.values(MOVES_BOX))];
  const unknownBox = boxes.filter(b => !vocabStates.includes(b));
  if (unknownBox.length) fail('boxes', `an action moves a piece into a box that does not exist: ${unknownBox.join(', ')}`);
  else pass('every box an action moves into is a real state');

  const orderMismatch = vocabStates.filter(c => !STATE_ORDER.includes(c));
  if (orderMismatch.length) fail('boxes', `states absent from STATE_ORDER: ${orderMismatch.join(', ')}`);
  else pass('STATE_ORDER covers every state in the vocabulary');

  if (vocabStates.includes('tanned') || STATE_ORDER.includes('tanned'))
    fail('boxes', '`tanned` is back as a state — it is a treatment, not a box (§13bd)');
  else pass('tannin is a treatment, not a box');
}

// --- 2. tannin does not move the box ---------------------------------------

{
  const p = migrateFabric({
    id: 'p', state: 'unwashed',
    stateEvents: [
      { id: 'a', date: '2026-01-01', stateCode: 'scoured' },
      { id: 'b', date: '2026-01-02', stateCode: 'tanned' },
    ],
  }).fabric;

  if (currentState(p) !== 'scoured')
    fail('tannin', `a scoured then tanned piece reports "${currentState(p)}", expected "scoured"`);
  else if (!treatmentsOf(p).includes('tannin'))
    fail('tannin', 'the piece does not carry a tannin label');
  else pass('a tanned piece stays in the washed box and carries the label');
}

// --- 3. an iron afterbath does not unmake a dyed piece ---------------------
//
// The old rule was "the latest event owns the state". Under it, an iron
// afterbath recorded after dyeing would have moved the piece into a box called
// after the bath. This is the same fault as tannin, from the other end.

{
  const p = migrateFabric({
    id: 'q', state: 'unwashed',
    stateEvents: [{ id: 'a', date: '2026-01-01', stateCode: 'dyed' }],
  }).fabric;
  p.actions.push({ id: 'b', date: '2026-02-01', actionCode: 'iron', batchId: 'x' });

  if (currentState(p) !== 'dyed')
    fail('afterbath', `an iron bath after dyeing reports "${currentState(p)}", expected "dyed"`);
  else pass('an afterbath does not move the piece out of its box');
}

// --- 4. every action belongs to a batch or a trial -------------------------

if (process.argv[2]) {
  const backup = JSON.parse(readFileSync(process.argv[2], 'utf8'));
  const { fabrics, batches, report } = migrateAll(backup.data?.fabrics || []);

  const orphans = [];
  for (const f of fabrics)
    for (const a of f.actions || [])
      if (!a.batchId && !a.trialId) orphans.push(`${f.label || f.id}/${a.actionCode}`);

  if (orphans.length) fail('orphans', `${orphans.length} actions belong to nothing: ${orphans.slice(0, 3).join(', ')}`);
  else pass(`${report.actions} actions, every one of them in a batch or a trial`);

  const ids = new Set(batches.map(b => b.id));
  if (ids.size !== batches.length) fail('batches', 'two batches share an id');
  else pass(`${batches.length} batches, all distinct`);

  const twice = migrateAll(fabrics);
  if (twice.batches.length) fail('idempotence', `a second run created ${twice.batches.length} more batches`);
  else if (JSON.stringify(twice.fabrics) !== JSON.stringify(fabrics))
    fail('idempotence', 'a second run changed the fabrics');
  else pass('running the migration twice changes nothing');
} else {
  console.log('--  no backup file given; skipped the data checks');
}

// --- 5. nothing writes to the old list -------------------------------------
//
// This is the check that would have caught the worst fault in the whole of
// §13bd. Every READER was converted to `actions` and one WRITER was left on
// `stateEvents`, so from 0.98.0 finishing a piece of work stamped a list that
// nothing read: the cloth stayed in the mordanted box and its biography said
// nothing about ever having been finished.
//
// It was invisible because `currentState` falls back to `stateEvents` for a
// record that has never been migrated — and after the migration none is. The
// fallback produced a plausible answer and hid the fault it covered for.
//
// So: `stateEvents` may be READ, for a record that predates the migration, and
// may be RESET to empty for a piece cut from a batch. It may not be added to.

{
  const files = ['modules/trials.js', 'modules/fabrics.js', 'app.js', 'backup.js'];
  const offences = [];

  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    src.split('\n').forEach((line, i) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
      // A line that repairs old records on purpose says so, and is left alone.
      if (line.includes('legacy:')) return;

      const push = /\bstateEvents\b[^=]*\.push\(/.test(line);

      // Written out rather than done with a lookahead: the regex version was
      // clever, wrong, and reported an empty-array reset as a write. A check
      // nobody can read is a check nobody can trust.
      let assign = false;
      const at = line.split(/\bstateEvents\s*=\s*/);
      if (at.length > 1) {
        const rhs = at[1].replace(/[\s;]/g, '');
        assign = rhs !== '[]' && !/\.stateEvents\|\|\[\]$/.test(rhs);
      }

      if (push || assign) offences.push(`${file}:${i + 1}  ${trimmed.slice(0, 72)}`);
    });
  }

  if (offences.length) {
    fail('legacy', `something still writes to stateEvents:\n    ${offences.join('\n    ')}`);
  } else {
    pass('nothing writes to the old state list — actions is the only writer');
  }
}

// --- the failures, kept ----------------------------------------------------

if (process.argv.includes('--selftest')) {
  console.log('\n--- each guard, broken on purpose ---');

  const p = migrateFabric({
    id: 'p', stateEvents: [
      { id: 'a', date: '2026-01-01', stateCode: 'scoured' },
      { id: 'b', date: '2026-01-02', stateCode: 'tanned' },
    ],
  }).fabric;
  // pretend tannin were a box move
  const saved = MOVES_BOX.tannin;
  MOVES_BOX.tannin = 'tanned';
  console.log(`  if tannin moved boxes, the piece would report "${currentState(p)}"`,
    currentState(p) === 'tanned' ? '— guard 2 would fire' : '— GUARD 2 IS BLIND');
  if (saved === undefined) delete MOVES_BOX.tannin; else MOVES_BOX.tannin = saved;

  const q = migrateFabric({ id: 'q', stateEvents: [{ id: 'a', date: '2026-01-01', stateCode: 'scoured' }] }).fabric;
  q.actions[0].batchId = null;
  const orphan = q.actions.filter(a => !a.batchId && !a.trialId).length;
  console.log(`  an action with its batch removed:`,
    orphan ? '— guard 4 would fire' : '— GUARD 4 IS BLIND');

  const before = MANUAL_ACTIONS.length;
  MANUAL_ACTIONS.push('invented');
  const vocabActions = VOCABULARY.filter(v => v.dimension === 'fabric_action').map(v => v.code);
  console.log(`  an action the vocabulary has never heard of:`,
    !vocabActions.includes('invented') ? '— guard 1 would fire' : '— GUARD 1 IS BLIND');
  MANUAL_ACTIONS.length = before;
}

process.exit(failed ? 1 : 0);

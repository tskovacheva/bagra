// backup.js — the personal safety net (§11).
//
// Distinct from reference packs (§10): a backup is a round trip of everything
// the owner has entered, meant to restore a device. A pack carries knowledge
// and merges. Mixing the two would make both unreliable.

import { STORES, DB_VERSION, all, get, putRaw, removeSystem, replaceStores, getSetting, setSetting, open } from './db.js';
import { VERSION } from './version.js';

const SCHEMA_VERSION = 3;

// Whose record is this, for the two questions a restore has to answer honestly:
// „how many of HER records will a snapshot take away" and „how many of her
// records did a merge leave out". A library record she never edited is not
// hers in that sense — the next start lays it down again from the pack — and
// counting it would make both numbers larger than anything she stands to lose,
// which is how a warning stops being read (§13cx). No `origin` at all is read
// as hers: only the pack writes `seed`.
const isWork = (row) => !!row && (row.origin !== 'seed' || !!row.editedByUser);

// Two records the same, whatever order their keys were written in. A record
// read back from IndexedDB and the same record parsed from a file need not
// list their fields in one order, and a comparison that minded would report a
// difference nobody made.
function stable(value) {
  return JSON.stringify(value, (_k, v) => (v && typeof v === 'object' && !Array.isArray(v))
    ? Object.fromEntries(Object.keys(v).sort().map(key => [key, v[key]]))
    : v);
}

// Vocabulary and bands are regenerated from code on every start, so they are
// not worth carrying. Everything else is either the user's work or a seeded
// record she may have edited — both must survive.
const SKIP = ['vocabulary', 'bands'];

export async function exportAll() {
  const data = {};
  for (const name of Object.keys(STORES)) {
    if (SKIP.includes(name)) continue;
    data[name] = await all(name);
  }

  return {
    format: 'bagra-backup',
    schemaVersion: SCHEMA_VERSION,
    // Which build and which database shape wrote this (§13ft). `schemaVersion`
    // describes the FILE and has stood at 3 while the database went from 7 to
    // 10 underneath it, so on its own it could not tell a restore that the file
    // came from a newer application. Additive: an older build ignores both.
    appVersion: VERSION,
    dbVersion: DB_VERSION,
    exportedAt: new Date().toISOString(),
    counts: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v.length])),
    data,
  };
}

export async function downloadBackup() {
  const payload = await exportAll();
  const blob = new Blob([JSON.stringify(payload, null, 1)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `bagra-${new Date().toISOString().slice(0, 10)}.json`;
  // In the document when it is clicked, and the address kept alive afterwards
  // (§13ft). Revoking it on the next line is what Safari cannot take: the
  // download starts asynchronously, finds its blob already gone, and fails —
  // while this function goes on to reset the counter and the screen says the
  // backup was downloaded. A minute is far longer than any download of a file
  // made in memory needs, and the cost of keeping it is one blob.
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);

  await setSetting('lastExportAt', new Date().toISOString());
  await setSetting('changeCounter', 0);
  return payload.counts;
}

/**
 * Read the file and say whether it can be restored — BEFORE anything is
 * written. A destructive operation must not discover halfway through that the
 * file it is restoring from is unusable.
 *
 * Returns the stores that will actually be touched, so `replace` knows its own
 * scope and the confirmation can say how much is involved.
 */
export function validateBackup(payload) {
  if (payload?.format !== 'bagra-backup') {
    throw new Error('unrecognised format');
  }
  if (payload.schemaVersion > SCHEMA_VERSION) {
    throw new Error('backup is from a newer version of the app');
  }
  // A file written by a newer DATABASE may carry a store this build does not
  // know. Restoring it would drop that store without a word — a snapshot that
  // is not the snapshot — so it is refused, and the answer is to update the
  // application first (§13ft). Files from before rc119 carry no `dbVersion`
  // and are read exactly as they always were.
  if (typeof payload.dbVersion === 'number' && payload.dbVersion > DB_VERSION) {
    throw new Error('backup is from a newer version of the app');
  }
  const data = payload.data;
  if (!data || typeof data !== 'object') {
    throw new Error('the backup carries no data');
  }

  const stores = [];
  for (const [name, rows] of Object.entries(data)) {
    if (!STORES[name] || SKIP.includes(name)) continue;
    if (!Array.isArray(rows)) throw new Error(`${name}: not a list of records`);
    const keyPath = STORES[name].keyPath;
    // A row with no key cannot be written, and finding that out inside the
    // restore transaction would abort a restore that had already been
    // announced. Cheaper to refuse the file.
    const n = rows.findIndex(r => !r || r[keyPath] === undefined || r[keyPath] === null);
    if (n !== -1) throw new Error(`${name}: record ${n + 1} has no ${keyPath}`);
    stores.push(name);
  }
  if (!stores.length) throw new Error('the backup holds no restorable store');
  return { stores, counts: Object.fromEntries(stores.map(s => [s, data[s].length])) };
}

/**
 * What a snapshot restore WOULD do, worked out before anything is written.
 *
 * Asked by the backup screen before its confirmation, so the question a person
 * answers names the file (its date) and what she stands to lose (how many of
 * her records are in the database and not in the file). A generic „everything
 * after this backup is lost" cannot tell last month's file from last week's,
 * and picking the wrong one of two is exactly the mistake a replace cannot
 * undo (§13ft). Validates first, so nothing is computed for a file that will
 * be refused.
 */
export async function planReplace(payload) {
  const { stores, counts } = validateBackup(payload);
  const data = payload.data;
  const gone = {}, goneWork = {};
  let removed = 0, removedWork = 0;
  for (const name of stores) {
    const keyPath = STORES[name].keyPath;
    const inFile = new Set(data[name].map(r => r[keyPath]));
    const leaving = (await all(name)).filter(r => !inFile.has(r[keyPath]));
    gone[name] = leaving.length;
    removed += leaving.length;
    // Settings are state, not records — the counter, the pack state, the
    // markers — and are never „her records" in the sense the question means.
    goneWork[name] = name === 'settings' ? 0 : leaving.filter(isWork).length;
    removedWork += goneWork[name];
  }
  return { stores, counts, gone, removed, goneWork, removedWork,
           exportedAt: payload.exportedAt || null, appVersion: payload.appVersion || null };
}

/**
 * The repairs a restore has made eligible again (§13ft).
 *
 * A migration's marker is data and travels with the data it describes
 * (§13cw): a snapshot of a database from before a repair restores the absence
 * of its marker along with the records that need it. That covered `replace`
 * and nothing else. A MERGE adds old records into a database whose markers say
 * every repair has run, so the added records were never repaired — an eco-print
 * trial with no bundle, a recipe with no source list, a cloth still on
 * `stateEvents` — and nothing would ever look at them again. Saving such a
 * trial from its screen then wrote an empty bundle, the repair would skip it
 * for having one, and its construction steps disappeared from the screen for
 * good. The same happened to a `replace` from a file with no settings in it.
 *
 * The rule: after a restore the database's marker is the LOWER of its own and
 * the file's, per repair. A file written by a build that had run a repair
 * carries records already in its shape, and nothing is reopened for it; a file
 * that had not, reopens exactly the repairs its records still need. Every
 * repair is idempotent — a record already in shape is skipped — and the guard
 * holds that, so reopening one costs a walk over the store at the next start
 * and nothing else. The reload that follows a restore runs them.
 *
 * @returns {string[]} the repairs reopened
 */
async function reopenMigrations(data) {
  const current = await getSetting('migrations', null);
  if (!current || typeof current !== 'object') return [];
  const row = Array.isArray(data.settings) ? data.settings.find(r => r && r.key === 'migrations') : null;
  const inFile = (row && row.value && typeof row.value === 'object') ? row.value : {};
  const kept = {}, reopened = [];
  for (const [name, version] of Object.entries(current)) {
    if ((Number(inFile[name]) || 0) >= version) kept[name] = version;
    else reopened.push(name);
  }
  if (reopened.length) await setSetting('migrations', kept);
  return reopened;
}

/**
 * Restore from a backup file.
 *
 * @param {'merge'|'replace'} mode
 *   merge   — adds records whose id is not already present, touches nothing
 *             else. The safe default: it can only ever add.
 *   replace — brings the database back to what the file holds. Used when moving
 *             to a new device or recovering from real loss.
 *
 * WHAT `replace` USED TO DO, and why it was wrong.
 *
 * It wrote every record from the file over the one with the same id and added
 * the ones that were missing — and stopped there. A record that existed in the
 * database and NOT in the file simply stayed. So restoring last week's backup
 * did not return the database to last week: it returned last week's records
 * and kept everything written since, mixed together with no way to tell them
 * apart. That is a merge with overwriting, and it was offered under a label
 * that promised a snapshot, to a person who had reached for it because
 * something had already gone wrong.
 *
 * Both modes now write RAW. A restored record keeps the `updatedAt` the file
 * gives it: the file records when the work was last touched, and stamping every
 * restored record with the hour of the restore erases that, permanently and
 * without saying so. Nor does either mode count against the backup reminder —
 * a restored database is, by definition, the contents of a backup file.
 */
export async function importBackup(payload, mode = 'merge') {
  const { stores } = validateBackup(payload);
  const data = payload.data;

  if (mode === 'replace') {
    const subset = Object.fromEntries(stores.map(name => [name, data[name]]));

    // WHAT ACTUALLY WENT, not how many fewer there are.
    //
    // The first version subtracted the count after from the count before, which
    // is right only when the file is a subset of the database. Current {A,B}
    // against a backup of {B,C} is two records before and two after, so the
    // arithmetic reported nothing removed — while A had gone. The one thing a
    // person wants to know after a snapshot restore is precisely how many of
    // her records the file did not carry, and that is a set difference.
    // The same set difference the confirmation showed her (§13ft), from one place.
    const { gone } = await planReplace(payload);

    // `language` is a property of the DEVICE, not of the work (§13co). Nobody
    // reaches for a restore in order to change the language, and a person
    // recovering from data loss should not be met with an interface in the
    // other one. `fabricLabelCounter` stays in the snapshot: losing it means
    // the next piece takes a number that is already on a label in the studio.
    // Absence is preserved as carefully as a value — no row means the
    // application default, English since rc108 (`DEFAULT_LANG` in i18n.js,
    // §13fi), so restoring one where there was none would change the language
    // just as surely.
    const language = await get('settings', 'language');
    // The unit system travels with the person, not with the work — same
    // argument as the language, and the same trap: restoring a phone's backup
    // must not put the laptop into ounces (§13dc).
    const units = await get('settings', 'units');

    const { written } = await replaceStores(subset);

    if (language) await putRaw('settings', language);
    else await removeSystem('settings', 'language');
    if (units) await putRaw('settings', units);
    else await removeSystem('settings', 'units');

    const report = { added: 0, replaced: 0, skipped: 0, removed: 0, restored: written, byStore: {} };
    for (const name of stores) {
      report.byStore[name] = { restored: data[name].length, removed: gone[name] };
      report.removed += gone[name];
      report.replaced += data[name].length;
    }

    // The file carries its OWN `changeCounter` and `lastExportAt`, and both are
    // stale by construction: `downloadBackup` exports first and resets the
    // counter afterwards, so what travels in the file is the count from before
    // the export. Restoring them verbatim would tell her she has unsaved work
    // at the exact moment the database equals a file on her disk. It does not,
    // and the file's own date is the truthful answer to when it was last saved.
    await setSetting('changeCounter', 0);
    await setSetting('lastExportAt', payload.exportedAt || new Date().toISOString());
    // A handoff address from another session, pointing at a screen this restore
    // may have just removed the record for (§13bo).
    await setSetting('returnTo', null);
    // A file that carried its settings brought its own markers and this changes
    // nothing; one that did not must not leave the old records under markers
    // that say they were repaired.
    report.reopened = await reopenMigrations(data);

    return report;
  }

  // MERGE — what is already here wins, and the file never overwrites.
  //
  // That policy is unchanged. What changed at §13ft is that it is no longer
  // silent: a record of HERS that exists on both sides and differs was reported
  // as „skipped", in one number with every record that was simply identical,
  // so the version in the file — an edit made on the other device — was left
  // out without anything saying so. It is counted apart now, as `differ`, and
  // the screen says how many. Library records she never edited are not
  // counted: the pack decides those, not the file.
  const report = { added: 0, replaced: 0, skipped: 0, differ: 0, removed: 0, byStore: {} };
  let addedWork = 0;

  for (const name of stores) {
    const keyPath = STORES[name].keyPath;
    const existing = new Map((await all(name)).map(r => [r[keyPath], r]));
    let added = 0, skipped = 0, differ = 0;

    for (const row of data[name]) {
      const here = existing.get(row[keyPath]);
      if (here) {
        skipped++;
        if (name !== 'settings' && isWork(row) && stable(here) !== stable(row)) differ++;
        continue;
      }
      await putRaw(name, row);
      added++;
      if (name !== 'settings') addedWork++;
    }

    report.byStore[name] = { added, skipped, differ };
    report.added += added;
    report.skipped += skipped;
    report.differ += differ;
  }

  // Records came in from a file; the repairs they may still need are reopened.
  report.reopened = addedWork ? await reopenMigrations(data) : [];

  return report;
}

export function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try { resolve(JSON.parse(reader.result)); }
      catch (err) { reject(err); }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

// ---------------------------------------------------------------- state

/**
 * How exposed the data currently is: how many edits since the last export,
 * and how long ago that was. Shown plainly rather than as a nag — the point
 * is that the answer should never be a surprise.
 */
export async function backupState() {
  const lastExportAt = await getSetting('lastExportAt', null);
  const changes = await getSetting('changeCounter', 0);
  const days = lastExportAt
    ? Math.floor((Date.now() - new Date(lastExportAt).getTime()) / 86400000)
    : null;
  return { lastExportAt, changes, days, never: !lastExportAt };
}

/**
 * Ask the browser not to evict this database when storage runs low.
 * Without it, data is "best effort" and can be cleared silently. Also reports
 * whether storage persists at all — in a private window it does not, and
 * anything entered there is lost when the window closes.
 */
export async function ensurePersistence() {
  const out = { supported: false, persisted: false, quota: null, usage: null };
  if (!navigator.storage) return out;

  out.supported = true;
  try {
    out.persisted = await navigator.storage.persisted?.() || false;
    if (!out.persisted && navigator.storage.persist) {
      out.persisted = await navigator.storage.persist();
    }
    const est = await navigator.storage.estimate?.();
    if (est) { out.quota = est.quota; out.usage = est.usage; }
  } catch { /* nothing to do; the flag simply stays false */ }

  await open();
  return out;
}

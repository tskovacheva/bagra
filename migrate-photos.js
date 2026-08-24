// migrate-photos.js — the shipped plant photographs leave the record (§13cr).
//
// Its own file rather than a function in app.js, for the reason migrate-actions
// gives: nothing here touches the DOM, so it can be run and tested on its own
// instead of only as a side effect of booting the whole application.

import { all, putSystem, getSetting, setSetting } from './db.js';

// The shipped plant photographs leave the record (§13cr).
//
// Until rc27 a seeded plant carried its photograph as a base64 JPEG inside the
// record: 3.49 MB of the 3.97 MB plant pack, and — worse than the download —
// every `all('plants')` in the application cloned all of it out of IndexedDB to
// answer questions about names and parts. Plants are read by Reference,
// Recipes, Trials, the seasonal panel and the plant screens.
//
// The photographs now ship as files and the record holds `photoSrc`, so the
// browser fetches one only when an `<img>` is actually on screen.
//
// THE ONE THING THIS MIGRATION MUST NOT DO is replace a photograph the owner
// put there herself. `photoData` on an installed copy is one of two things and
// the record does not say which: the photograph rc27 shipped, or one she chose.
// `editedByUser` cannot decide it — it is set by saving the record at all, for
// any reason.
//
// So it is not inferred. The pack records the SHA-256 of the exact string it
// shipped, and the migration compares. Equal means this is the shipped
// photograph and the file now holds it; anything else is hers and is left
// exactly where it is, where `photoOf` will go on preferring it over the
// shipped one for ever.
//
// Attribution is untouched: `photoCredit` lives on the record and neither half
// of this moves it.

export async function migratePlantPhotos() {
  const done = await getSetting('plantPhotoMigration', null);
  if (done) return;

  let table = null;
  try {
    const res = await fetch('seed/plant-photos.json');
    if (res.ok) table = (await res.json()).photos || null;
  } catch { /* offline and uncached: try again next start */ }
  // Without the table nothing can be compared, and comparing nothing would
  // mean guessing. Leave every record alone and do not mark it done.
  if (!table) return;

  let moved = 0, kept = 0;

  for (const plant of await all('plants')) {
    if (!plant.photoData) continue;
    const shipped = table[plant.id];
    if (!shipped) { kept++; continue; }

    const digest = await sha256(plant.photoData);
    if (digest !== shipped.hash) { kept++; continue; }   // hers

    delete plant.photoData;
    plant.photoSrc = shipped.src;
    plant.photoHash = shipped.hash;
    await putSystem('plants', plant);
    moved++;
  }

  await setSetting('plantPhotoMigration', { at: new Date().toISOString(), moved, kept });
  if (moved || kept) {
    console.info(`plant photographs: ${moved} moved to files, ${kept} personal one(s) left alone`);
  }
}

async function sha256(text) {
  const bytes = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}


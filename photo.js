// photo.js — turning a chosen file into something worth storing.
//
// Photographs are first-class here: colour is the subject matter and a text
// description of a colour is never enough. But a trial can carry a dozen of
// them, and full-size camera files would make the backup unusable. Resized on
// the way in, they stay recognisable and the database stays portable.

const MAX_RESULT = 1280;   // a finished piece, worth looking at closely
const MAX_STEP = 800;      // a moment in the process — the sandwich, the roll
const MAX_THUMB = 480;     // a placement or a reference shot

export function shrink(file, maxSide = MAX_RESULT, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };

    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('not an image')); };
    img.src = url;
  });
}

export const shrinkResult = (file) => shrink(file, MAX_RESULT);

// A step photograph shows an arrangement rather than a colour — how the layers
// went together, how tightly it was rolled. It has to be legible, not exact,
// and a trial can carry a dozen, so it sits between the two other sizes. A
// diagram brought in as a plan uses the result size instead: it has writing on
// it, and writing at 800px is writing that cannot be read.
export const shrinkStep = (file) => shrink(file, MAX_STEP);
export const shrinkThumb = (file) => shrink(file, MAX_THUMB);

/** Rough size of a data URL in kilobytes, for anything that wants to warn. */
export const dataUrlKb = (dataUrl) =>
  dataUrl ? Math.round((dataUrl.length * 3 / 4) / 1024) : 0;


/**
 * How many photographs would be lost — the real ones (§13cx).
 *
 * The backup warning counted `count('photos')`, and the `photos` store has
 * never been written to. Not once, by anything. So the sentence that tells a
 * person what she stands to lose said „0 photographs" to somebody with two
 * hundred of them, and said it in the one place designed to make her take a
 * backup seriously.
 *
 * WHAT COUNTS. An image that exists nowhere else. If it is gone, it is gone.
 *
 * WHAT DOES NOT. A shipped plant photograph. `photoSrc` names a file the
 * application carries and can lay down again from the pack — it is not at risk
 * and counting it would inflate the warning, which is its own kind of lie. A
 * warning that overstates gets ignored at exactly the speed it deserves.
 *
 * Counts IMAGES, not records: a trial with five result photographs is five.
 *
 * One helper, used everywhere the warning appears, because the reason this
 * drifted in the first place is that two screens each counted for themselves.
 */
export async function countUserPhotos() {
  const { all } = await import('./db.js');
  const n = (list) => (Array.isArray(list) ? list.length : 0);
  let total = 0;

  for (const f of await all('fabrics')) {
    if (f.photoData) total += 1;
  }

  for (const tr of await all('trials')) {
    total += n(tr.resultPhotos);
    for (const st of tr.steps || []) total += n(st.photos);
  }

  for (const b of await all('pigmentBatches')) {
    total += n(b.photos);
    for (const st of b.stages || []) total += n(st.photos);
  }

  // A plant photograph counts only when it is HERS. `photoData` on a plant is
  // an override the owner put there; the shipped one lives in `photoSrc` and
  // is replaceable (§13cr).
  for (const p of await all('plants')) {
    if (p.photoData) total += 1;
  }

  // Kept last and deliberately: the store is empty today and is the one the
  // count used to read. If photographs are ever moved into it, this line means
  // the warning follows them instead of quietly going back to zero.
  total += (await all('photos')).length;

  return total;
}

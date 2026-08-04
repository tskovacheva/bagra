// photo.js — turning a chosen file into something worth storing.
//
// Photographs are first-class here: colour is the subject matter and a text
// description of a colour is never enough. But a trial can carry a dozen of
// them, and full-size camera files would make the backup unusable. Resized on
// the way in, they stay recognisable and the database stays portable.

const MAX_RESULT = 1280;   // a finished piece, worth looking at closely
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
export const shrinkThumb = (file) => shrink(file, MAX_THUMB);

/** Rough size of a data URL in kilobytes, for anything that wants to warn. */
export const dataUrlKb = (dataUrl) =>
  dataUrl ? Math.round((dataUrl.length * 3 / 4) / 1024) : 0;

// calc/colour.js — how far apart two colours are.
//
// The reference has always answered "oak on cotton with alum, what should I
// expect". The other direction — "I want this colour on this cloth, how do I
// get it" — has been in the specification from the first day and is one of the
// two reasons the library exists (§13ah).
//
// Answering it needs a distance, and a distance in sRGB is not one: #808000 and
// #008080 are the same arithmetic step apart as two olives nobody could tell
// apart. So the comparison happens in Lab, where a step is roughly a step the
// eye agrees with. ΔE76 rather than ΔE2000 — the newer formula is better and
// the difference does not change which three records come back first, and this
// application is read by one person who will want to know why a number is what
// it is.
//
// Pure and DOM-free.

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

export function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// sRGB → linear → XYZ (D65) → Lab. The constants are the standard ones.
export function hexToLab(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const lin = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const [r, g, b] = lin;
  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  const y = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 1.0;
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const [fx, fy, fz] = [f(x), f(y), f(z)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/**
 * ΔE76 between two hex colours, or null when either cannot be read.
 *
 * Rough reading of the number: under 2 is a difference most people cannot see,
 * under 10 is the same colour described the same way, over 25 is a different
 * colour with a different name.
 */
export function colourDistance(a, b) {
  const la = hexToLab(a), lb = hexToLab(b);
  if (!la || !lb) return null;
  return Math.hypot(la[0] - lb[0], la[1] - lb[1], la[2] - lb[2]);
}

/**
 * How the difference should be described, given that it exists.
 *
 * Words rather than a number on the card: "по-тъмно" tells the person what to
 * change, and 14.3 tells them nothing they can act on. The lightness comparison
 * comes first because it is the one that is nearly always the real difference
 * between a sample and a hope.
 */
export function colourDifference(wanted, got) {
  const a = hexToLab(wanted), b = hexToLab(got);
  if (!a || !b) return null;
  const d = colourDistance(wanted, got);
  const dl = b[0] - a[0];
  if (d < 6) return { d, code: 'same' };
  if (Math.abs(dl) >= Math.hypot(b[1] - a[1], b[2] - a[2]))
    return { d, code: dl > 0 ? 'lighter' : 'darker' };
  const chroma = (l) => Math.hypot(l[1], l[2]);
  if (Math.abs(chroma(b) - chroma(a)) > 12)
    return { d, code: chroma(b) > chroma(a) ? 'stronger' : 'greyer' };
  return { d, code: 'other' };
}

/**
 * Rank records by how close their expected colour is to the one asked for.
 *
 * Records with no swatch are dropped rather than sorted to the end: a record
 * that cannot answer the question should not appear to have answered it badly.
 * `limit` exists because a colour search always "matches" everything to some
 * degree, and a list of fifty ordered by distance is not an answer.
 */
export function rankByColour(records, wantedHex, { limit = 12, maxDistance = 45 } = {}) {
  if (!hexToLab(wantedHex)) return [];
  return records
    .map((r) => ({ r, d: colourDistance(wantedHex, r.expected?.swatchHex) }))
    .filter((x) => x.d != null && x.d <= maxDistance)
    .sort((a, b) => a.d - b.d)
    .slice(0, clamp(limit, 1, 50));
}

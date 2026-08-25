// units.js — one system stored, another shown (§13dc).
//
// EVERY FIGURE IS STORED IN ONE SYSTEM AND ONE ONLY: grams, millilitres,
// degrees Celsius, grams per square metre. The field names say so —
// `weightG`, `tempC`, `weightGsm` — and nothing in this file changes what is
// written to the database.
//
// The reason is the one the whole project runs on. A record that carries its
// own unit is a record that has to be read twice: once for the number and once
// to find out what the number means. Two trials become incomparable, an export
// becomes ambiguous, and a backup taken on a device set to ounces restores onto
// one set to grams and is quietly wrong by a factor of 28. Storing canonically
// makes every one of those impossible rather than unlikely.
//
// So this is a DISPLAY layer, and it is symmetrical: what it renders on the way
// out it parses on the way back in, so a person working in ounces types ounces
// and the database still holds grams.
//
// WHAT NEVER CONVERTS. A ratio is not a measurement. Percent WOF, a liquor
// ratio of 1:20, a percentage strength — these are the same number in every
// system, and converting one would be a bug of the worst kind, because the
// result would look plausible. `wof()` and `ratio()` exist to say so out loud
// at the call site.
//
// The choice is a property of the DEVICE, like the language (§13co): it travels
// with the person, not with the work, so a snapshot restore leaves it alone.

import { getSetting, setSetting } from './db.js';

export const SYSTEMS = ['metric', 'imperial'];

// Exact by definition, not rounded constants. The pound and the inch have been
// defined in metric terms since 1959, so these are conversions and not
// measurements — and writing them exactly means the round trip closes.
const G_PER_OZ = 28.349523125;      // international avoirdupois ounce
const G_PER_LB = 453.59237;
const ML_PER_FLOZ = 29.5735295625;  // US fluid ounce
const ML_PER_GAL = 3785.411784;     // US gallon
const MM_PER_IN = 25.4;
const SQM_PER_SQYD = 0.83612736;

let system = 'metric';

export function getSystem() { return system; }

export async function initUnits() {
  const saved = await getSetting('units', null);
  system = SYSTEMS.includes(saved) ? saved : 'metric';
  return system;
}

export async function setSystem(next) {
  if (!SYSTEMS.includes(next)) return system;
  system = next;
  await setSetting('units', next);
  return system;
}

const isImperial = () => system === 'imperial';

// THREE SIGNIFICANT FIGURES, not a fixed number of decimal places.
//
// A fixed two places is right for pounds and wrong for ounces: one gram of iron
// becomes „0.04 oz", and reading that back gives 1.13 g — a thirteen per cent
// error on a quantity a recipe really does call for. The round trip has to
// close at every magnitude, because a person who opens a record while set to
// ounces and saves it without touching the weight must get the same grams back.
//
// So the places follow the size of the number: 0.0353, 3.53, 27.2, 250. Capped
// at four, because past that a kitchen scale is being described as a laboratory
// one.
function trim(n, minPlaces = 0) {
  if (n === 0) return '0';
  const magnitude = Math.floor(Math.log10(Math.abs(n)));
  const places = Math.min(4, Math.max(minPlaces, 2 - magnitude));
  const f = 10 ** places;
  return String(Math.round(n * f) / f);
}

// ---------------------------------------------------------------- mass
//
// Crosses from ounces to pounds at a pound, because „28.2 oz" is a number
// nobody weighs and „1 lb 12 oz" is not something to put in a field. One unit
// per figure: a value shown in two units is a value that has to be added up
// before it can be used.

/** A mass held in grams, as a number for display. */
export function mass(grams) {
  if (grams == null || grams === '') return '';
  const g = Number(grams);
  if (!isImperial()) return g >= 1000 ? trim(g / 1000) : trim(g);
  const oz = g / G_PER_OZ;
  return oz >= 16 ? trim(g / G_PER_LB) : trim(oz);
}

/** The unit that `mass()` just used, for the label beside it. */
export function massUnit(grams) {
  const g = Number(grams || 0);
  if (!isImperial()) return g >= 1000 ? 'kg' : 'g';
  return g / G_PER_OZ >= 16 ? 'lb' : 'oz';
}

/** A mass typed by a person, back to grams. */
export function massToG(value, unit = null) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const u = unit || (isImperial() ? 'oz' : 'g');
  switch (u) {
    case 'kg': return n * 1000;
    case 'lb': return n * G_PER_LB;
    case 'oz': return n * G_PER_OZ;
    default:   return n;
  }
}

// ---------------------------------------------------------------- volume
export function volume(ml) {
  if (ml == null || ml === '') return '';
  const v = Number(ml);
  if (!isImperial()) return v >= 1000 ? trim(v / 1000) : trim(v);
  const floz = v / ML_PER_FLOZ;
  return floz >= 128 ? trim(v / ML_PER_GAL) : trim(floz);
}

export function volumeUnit(ml) {
  const v = Number(ml || 0);
  if (!isImperial()) return v >= 1000 ? 'l' : 'ml';
  return v / ML_PER_FLOZ >= 128 ? 'gal' : 'fl oz';
}

export function volumeToMl(value, unit = null) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const u = unit || (isImperial() ? 'fl oz' : 'ml');
  switch (u) {
    case 'l':     return n * 1000;
    case 'gal':   return n * ML_PER_GAL;
    case 'fl oz': return n * ML_PER_FLOZ;
    default:      return n;
  }
}

// ---------------------------------------------------------------- temperature
//
// The one conversion with an offset, which is why it is the one a `× factor`
// helper would silently get wrong. A DIFFERENCE in temperature converts by the
// factor alone; a temperature does not.

export function temp(celsius) {
  if (celsius == null || celsius === '') return '';
  const c = Number(celsius);
  // Whole degrees. Nobody sets a pot to 176.4 °F, and the extra figure would
  // claim a precision the thermometer does not have.
  const v = isImperial() ? c * 9 / 5 + 32 : c;
  return String(Math.round(v));
}

export const tempUnit = () => (isImperial() ? '°F' : '°C');

export function tempToC(value, unit = null) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const u = unit || (isImperial() ? '°F' : '°C');
  return u === '°F' ? (n - 32) * 5 / 9 : n;
}

/** A temperature RANGE, both ends, with the unit written once. */
export function tempSpan(min, max) {
  if (min == null && max == null) return '';
  if (max == null || max === min) return `${temp(min)}\u00A0${tempUnit()}`;
  return `${temp(min)}–${temp(max)}\u00A0${tempUnit()}`;
}

// ---------------------------------------------------------------- cloth weight
export function gsm(value) {
  if (value == null || value === '') return '';
  const n = Number(value);
  // oz/yd², the weight a weaver quotes.
  return isImperial() ? trim(n * SQM_PER_SQYD / G_PER_OZ) : trim(n);
}

export const gsmUnit = () => (isImperial() ? 'oz/yd²' : 'г/м²');

export function gsmToMetric(value, unit = null) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const u = unit || (isImperial() ? 'oz/yd²' : 'g/m²');
  return u === 'oz/yd²' ? n * G_PER_OZ / SQM_PER_SQYD : n;
}

// ---------------------------------------------------------------- length
export function length(mm) {
  if (mm == null || mm === '') return '';
  const n = Number(mm);
  if (!isImperial()) return n >= 10 ? trim(n / 10) : trim(n);
  return trim(n / MM_PER_IN);
}

export const lengthUnit = (mm) =>
  (isImperial() ? 'in' : (Number(mm || 0) >= 10 ? 'cm' : 'mm'));

// ---------------------------------------------------------------- never
//
// Named functions rather than „just print the number", so that a call site
// asking for a percentage says out loud that it knows better than to convert
// it. Silence would be indistinguishable from having forgotten.

/** Percent weight of fibre. A ratio: the same in every system. */
export const wof = (percent) => (percent == null || percent === '' ? '' : String(percent));
export const wofUnit = () => '% WOF';

/** A liquor ratio, 1 : 20. A ratio: the same in every system. */
export const ratio = (n) => (n == null || n === '' ? '' : `1\u00A0:\u00A0${n}`);

/** A percentage strength of a solution. A ratio: the same in every system. */
export const percent = (n) => (n == null || n === '' ? '' : `${n}%`);

// ---------------------------------------------------------------- together
//
// Most call sites want the number and its unit as one string, joined by a
// non-breaking space so a figure never breaks across a line (§13cz).
export const massWith   = (g)  => (mass(g) === '' ? '' : `${mass(g)}\u00A0${massUnit(g)}`);
export const volumeWith = (ml) => (volume(ml) === '' ? '' : `${volume(ml)}\u00A0${volumeUnit(ml)}`);
export const tempWith   = (c)  => (temp(c) === '' ? '' : `${temp(c)}\u00A0${tempUnit()}`);
export const gsmWith    = (v)  => (gsm(v) === '' ? '' : `${gsm(v)}\u00A0${gsmUnit()}`);

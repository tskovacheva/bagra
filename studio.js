// studio.js — Studio System v1 (§13gc).
//
// The colour on a paper tag pinned to a piece of cloth says how far along it
// is; the same colour says it in the app. One module holds the five statuses,
// the code dictionary and the two derivations every screen uses — the filter
// chips, the list, the record, the working label and the Library — so that
// nothing can show a piece in one colour here and another there.
//
// Labels RENDER the history; they never store another one. Nothing here writes
// to the database: a status is read from the piece's actions, a summary from
// the recipes those actions name, a trail from both.
//
// Pure: no database, no DOM. Callers pass the recipes and trials they have
// already loaded, keyed by id.

import { actionHistory } from './fabric-logic.js';
import { boxAfter, movesBox } from './migrate-actions.js';

// ---- the five statuses -------------------------------------------------------
//
// Colour means the current stage and nothing else — not the recipe, the plant,
// the chemical or the technique. Each has an icon, a code and a name in both
// languages, so the colour is never the only thing that says it.
//
// Muted, on the linen ground, and printable on coloured paper: mid tones dark
// text reads on (every one at least 4.7:1 against #2A2724), told apart from each
// other at a badge's size, and no red. Coral is the last. These are status
// tokens beside the palette, not part of it: the working surface stays neutral,
// and a status is the one place a colour is the information.
export const STUDIO_STATUSES = [
  { code: 'RAW', key: 'raw',       hex: '#9DB08E', icon: 's-unwashed',  bg: 'Неизпран',           en: 'Raw / Unwashed',
    explain: { bg: 'Както е дошъл: още неизпран.', en: 'As it arrived: not yet washed.' } },
  { code: 'W',   key: 'washed',    hex: '#8FAAC4', icon: 's-scoured',   bg: 'Изпран',             en: 'Washed',
    explain: { bg: 'Изпран и готов за обработка.', en: 'Washed and ready to be treated.' } },
  { code: 'T',   key: 'tannin',    hex: '#BD8450', icon: 'c-tannin',    bg: 'Таниниран',          en: 'Tannin treated',
    explain: { bg: 'Изпран и носи танин — път към еко принт или към стипца.', en: 'Washed and carrying tannin — on the way to an eco print or to alum.' } },
  { code: 'M',   key: 'mordanted', hex: '#D8C35A', icon: 's-mordanted', bg: 'Мордантиран',        en: 'Mordanted',
    explain: { bg: 'Със закрепител, готов за багрило.', en: 'Mordanted, ready for colour.' } },
  { code: 'D',   key: 'dyed',      hex: '#E08A73', icon: 's-dyed',      bg: 'Обагрен / отпечатан', en: 'Dyed / Printed',
    explain: { bg: 'Обагрен или отпечатан.', en: 'Dyed or printed.' } },
];
export const studioByCode = (code) => STUDIO_STATUSES.find(s => s.code === code) || STUDIO_STATUSES[0];
export const studioLabel = (s, lang) => (lang === 'en' ? s.en : s.bg);

// ---- the status ----------------------------------------------------------------

const byDate = (a, b) => (a.date || '').localeCompare(b.date || '') || (a.createdAt || '').localeCompare(b.createdAt || '');

// The box the piece's processing reached, the finishing act left out: a
// finished piece is shown in the colour of the last stage it went through
// (decision 2), and it is the same box `currentState` gives every other piece.
function processingBox(fabric) {
  const acts = actionHistory(fabric).filter(a => a.actionCode && a.actionCode !== 'finish' && movesBox(a.actionCode));
  if (acts.length) return { box: boxAfter(acts[acts.length - 1].actionCode), at: acts[acts.length - 1] };
  if (fabric.actions) return { box: fabric.state && fabric.state !== 'finished' ? fabric.state : 'unwashed', at: null };
  // Not yet migrated (stateEvents): the latest state that is not `finished`.
  const ev = [...(fabric.stateEvents || [])].sort(byDate).filter(e => e.stateCode && e.stateCode !== 'finished');
  return { box: ev.length ? ev[ev.length - 1].stateCode : (fabric.state && fabric.state !== 'finished' ? fabric.state : 'unwashed'), at: null };
}

/**
 * The studio status of a piece (§13gc) — the ONE derivation behind the filter
 * chips, the list, the record and the label.
 *
 *   unwashed → RAW · scoured → W, or T when it carries tannin applied since it
 *   reached that box (decision 1: tannin is a treatment, §13bd, and T is how
 *   the studio sees a washed piece carrying one) · mordanted → M · dyed → D.
 *   `finished` stays its own state (decision 2): the colour is the last
 *   processing stage, and `finished` is reported beside it.
 *
 * @returns {{ code: string, status: object, finished: boolean, box: string }}
 */
export function deriveStudioStatus(fabric) {
  const hist = actionHistory(fabric);
  const finished = (() => {
    const moves = hist.filter(a => a.actionCode && movesBox(a.actionCode));
    if (moves.length) return moves[moves.length - 1].actionCode === 'finish';
    if (fabric.actions) return fabric.state === 'finished';
    const ev = [...(fabric.stateEvents || [])].sort(byDate);
    return ev.length ? ev[ev.length - 1].stateCode === 'finished' : fabric.state === 'finished';
  })();
  const { box, at } = processingBox(fabric);
  let code = { unwashed: 'RAW', scoured: 'W', mordanted: 'M', dyed: 'D' }[box] || 'RAW';
  if (code === 'W') {
    const tannin = hist.filter(a => a.actionCode === 'tannin' && (!at || byDate(a, at) >= 0));
    if (tannin.length) code = 'T';
  }
  return { code, status: studioByCode(code), finished, box };
}

// ---- the code dictionary ---------------------------------------------------------
//
// `type` says what kind of code it is, and never pretends more:
//   formula   — a chemical formula or symbol, as chemistry writes it;
//   practical — an abbreviation dyers use in practice;
//   studio    — Bagra's own, for the studio's tags. Not a standard.
//
// Collision rules (§13gc), held by the gate: one code, one meaning; COT is
// cream of tartar and never cotton; AA is aluminium acetate and AAc ascorbic
// acid; CA is citric acid and never calcium; a formula wins any ambiguity;
// fibres and plants are not coded.
const D = (code, category, type, bg, en, formula, use) => ({ code, category, type, bg, en, formula: formula || null, use });
export const STUDIO_CODES = [
  // lifecycle
  ...STUDIO_STATUSES.map(s => D(s.code, 'lifecycle', 'studio', s.bg, s.en, null, s.explain)),
  // mordants and treatments
  D('AA', 'mordant', 'practical', 'Алуминиев ацетат', 'Aluminium acetate', 'Al(CH₃COO)₃ (basic forms vary)',
    { bg: 'Закрепител за целулоза и за печат.', en: 'Mordant for cellulose and for printing.' }),
  D('PAS', 'mordant', 'practical', 'Калиева стипца', 'Potassium aluminium sulfate (alum)', 'KAl(SO₄)₂·12H₂O',
    { bg: 'Класическата стипца.', en: 'The classic alum.' }),
  D('AS', 'mordant', 'practical', 'Алуминиев сулфат', 'Aluminium sulfate', 'Al₂(SO₄)₃',
    { bg: 'Стипца без калий.', en: 'Alum without potassium.' }),
  D('ATF', 'mordant', 'practical', 'Алуминиев триформиат', 'Aluminium triformate', 'Al(HCOO)₃',
    { bg: 'Студен закрепител за целулоза.', en: 'A cold mordant for cellulose.' }),
  D('Fe', 'mordant', 'formula', 'Желязо / железен сулфат', 'Iron / ferrous sulfate', 'FeSO₄',
    { bg: 'Затъмнява; модификатор или закрепител.', en: 'Saddens; modifier or mordant.' }),
  D('TAN', 'mordant', 'studio', 'Танин', 'Tannin treatment', null,
    { bg: 'Танинова баня.', en: 'A tannin bath.' }),
  D('SOY', 'mordant', 'studio', 'Соево мляко', 'Soy milk', null,
    { bg: 'Белтъчна подготовка на целулоза.', en: 'Protein preparation of cellulose.' }),
  // assists, modifiers, chemistry
  D('COT', 'assist', 'practical', 'Винен камък', 'Cream of tartar', 'KC₄H₅O₆',
    { bg: 'Помощно вещество със стипцата. Никога „памук“.', en: 'Assist with alum. Never „cotton“.' }),
  D('VINEGAR', 'assist', 'studio', 'Оцет', 'Vinegar', null,
    { bg: 'Когато е оцет, пише се VINEGAR и процентът му: VINEGAR 6%.', en: 'When it is vinegar, write VINEGAR and its strength: VINEGAR 6%.' }),
  D('AcOH', 'assist', 'formula', 'Оцетна киселина', 'Acetic acid', 'CH₃COOH',
    { bg: 'Концентрираната киселина, не оцетът.', en: 'The concentrated acid, not vinegar.' }),
  D('CA', 'assist', 'practical', 'Лимонена киселина', 'Citric acid', 'C₆H₈O₇',
    { bg: 'Подкисляване. Никога калций.', en: 'Acidifier. Never calcium.' }),
  D('TA', 'assist', 'practical', 'Винена киселина', 'Tartaric acid', 'C₄H₆O₆',
    { bg: 'Подкисляване.', en: 'Acidifier.' }),
  D('Na₂CO₃', 'assist', 'formula', 'Натриев карбонат (сода)', 'Sodium carbonate (soda ash)', 'Na₂CO₃',
    { bg: 'Алкализиране, изпиране.', en: 'Alkali; scouring.' }),
  D('NaHCO₃', 'assist', 'formula', 'Сода бикарбонат', 'Sodium bicarbonate', 'NaHCO₃',
    { bg: 'Меко алкализиране.', en: 'A gentle alkali.' }),
  D('CaCO₃', 'assist', 'formula', 'Калциев карбонат (креда)', 'Calcium carbonate (chalk)', 'CaCO₃',
    { bg: 'Кредова баня след закрепителя.', en: 'Chalk bath after the mordant.' }),
  D('Ca(OH)₂', 'assist', 'formula', 'Калциев хидроксид (гасена вар)', 'Calcium hydroxide (slaked lime)', 'Ca(OH)₂',
    { bg: 'Индиго; силно алкално.', en: 'Indigo; strongly alkaline.' }),
  D('NaOH', 'assist', 'formula', 'Натриев хидроксид', 'Sodium hydroxide', 'NaOH',
    { bg: 'Силна основа. Внимание.', en: 'A strong base. Care.' }),
  D('K₂CO₃', 'assist', 'formula', 'Калиев карбонат (поташ)', 'Potassium carbonate (potash)', 'K₂CO₃',
    { bg: 'Алкализиране.', en: 'Alkali.' }),
  // indigo, reduction
  D('FRU', 'reduction', 'studio', 'Фруктоза', 'Fructose', 'C₆H₁₂O₆',
    { bg: 'Редуктор за индиго.', en: 'Indigo reducer.' }),
  D('GLU', 'reduction', 'studio', 'Глюкоза', 'Glucose', 'C₆H₁₂O₆',
    { bg: 'Редуктор за индиго.', en: 'Indigo reducer.' }),
  D('MOL', 'reduction', 'studio', 'Меласа', 'Molasses', null,
    { bg: 'Редуктор за индиго.', en: 'Indigo reducer.' }),
  D('AAc', 'reduction', 'studio', 'Аскорбинова киселина', 'Ascorbic acid', 'C₆H₈O₆',
    { bg: 'Редуктор. Различно от AA.', en: 'Reducer. Not AA.' }),
  D('Na₂S₂O₄', 'reduction', 'formula', 'Натриев дитионит', 'Sodium dithionite', 'Na₂S₂O₄',
    { bg: 'Химичен редуктор за индиго.', en: 'Chemical indigo reducer.' }),
  // techniques
  D('DYE', 'technique', 'studio', 'Потапящо багрене', 'Immersion dyeing', null,
    { bg: 'Багрене в баня.', en: 'Dyeing in a bath.' }),
  D('EP', 'technique', 'studio', 'Еко принт', 'Eco-print', null,
    { bg: 'Печат с растения.', en: 'Printing with plants.' }),
  D('MP', 'technique', 'studio', 'Печат със закрепител', 'Mordant print', null,
    { bg: 'Паста със закрепител.', en: 'A mordant paste.' }),
  D('DMP', 'technique', 'studio', 'Печат с багрило и закрепител', 'Dye + mordant print', null,
    { bg: 'Паста с багрило и закрепител.', en: 'A paste with dye and mordant.' }),
  D('PIG', 'technique', 'studio', 'Пигмент', 'Pigment process', null,
    { bg: 'Правене на пигмент.', en: 'Making a pigment.' }),
  D('BLK', 'technique', 'studio', 'Одеяло', 'Blanket method / layer', null,
    { bg: 'Одеяло при еко принт.', en: 'The blanket in an eco print.' }),
  D('IND', 'technique', 'studio', 'Индигова вана', 'Indigo vat', null,
    { bg: 'Индиго.', en: 'Indigo.' }),
];
export const codeByName = new Map(STUDIO_CODES.map(c => [c.code, c]));

// The tokens of a recipe's shortCode: „PAS/AS + Na₂CO₃" → PAS, AS, Na₂CO₃.
// A strength after a code („VINEGAR 6%") belongs to the code before it.
export const codeTokens = (shortCode) => String(shortCode || '').split(/\s*\+\s*/)
  .flatMap(part => part.split('/')).map(s => s.trim().replace(/\s+\d+(?:[.,]\d+)?\s*%$/, '')).filter(Boolean);

// ---- the summary and the trail ---------------------------------------------------

const name = (r, lang) => (r && r.name && (r.name[lang] || r.name.bg || r.name.en)) || '';

// A recipe in a few characters: its shortCode, or — decision 3 — its name.
const recipeCode = (id, ctx, lang) => {
  const r = id && ctx.recipes ? ctx.recipes.get(id) : null;
  if (!r) return '';
  return r.shortCode ? String(r.shortCode) : name(r, lang);
};
// An action with no recipe still says something when its kind does.
const ACTION_CODE = { tannin: 'TAN', iron: 'Fe', soy: 'SOY' };
const actionCode = (a, ctx, lang) => recipeCode(a.recipeId, ctx, lang) || ACTION_CODE[a.actionCode] || '';

// The technique of a colouring action, from the work it was part of.
function techniqueOf(a, ctx) {
  const tr = a.trialId && ctx.trials ? ctx.trials.get(a.trialId) : null;
  const p = String(tr?.processCode || '');
  if (p.startsWith('ecoprint')) return 'EP';
  if (p === 'paste') {
    const dmp = (tr.steps || []).some(s => ctx.recipes?.get(s.recipeId)?.shortCode === 'DMP');
    return dmp ? 'DMP' : 'MP';
  }
  return 'DYE';
}

const join = (parts) => [...new Set(parts.filter(Boolean))].join(' + ');

/**
 * What the working label says under the status (§13gc): the treatment that put
 * the piece where it is, in codes — decision 3, a recipe's shortCode, its name
 * when it has none. The ONE derivation behind the record and the label.
 *
 *   M — the latest mordant's recipe, and every treatment after it (a chalk
 *       bath, an iron afterbath): „AA + CaCO₃".
 *   T — the tannin since the wash: „TAN", or the tannin recipe's code.
 *   W — the wash's recipe. RAW — nothing.
 *   D — the technique of the colouring: „EP", „DYE", „MP", „DMP".
 *
 * @returns {{ text: string, date: string|null }}
 */
export function deriveStudioTreatmentSummary(fabric, ctx = {}, lang = 'bg') {
  const { code } = deriveStudioStatus(fabric);
  const hist = actionHistory(fabric).filter(a => a.actionCode !== 'finish');
  const last = (pred) => { const xs = hist.filter(pred); return xs.length ? xs[xs.length - 1] : null; };
  const after = (a) => hist.filter(b => byDate(b, a) > 0 || (byDate(b, a) === 0 && hist.indexOf(b) > hist.indexOf(a)));

  if (code === 'M') {
    const m = last(a => a.actionCode === 'mordant');
    if (!m) return { text: '', date: null };
    const later = after(m).filter(b => !movesBox(b.actionCode) && b.actionCode !== 'other');
    const parts = [actionCode(m, ctx, lang), ...later.map(b => actionCode(b, ctx, lang))];
    return { text: join(parts), date: (later.length ? later[later.length - 1] : m).date || null };
  }
  if (code === 'T') {
    const w = last(a => a.actionCode === 'wash');
    const tans = hist.filter(a => a.actionCode === 'tannin' && (!w || byDate(a, w) >= 0));
    return { text: join(tans.map(a => actionCode(a, ctx, lang))), date: tans.length ? tans[tans.length - 1].date || null : null };
  }
  if (code === 'W') {
    const w = last(a => a.actionCode === 'wash');
    return { text: w ? recipeCode(w.recipeId, ctx, lang) : '', date: w?.date || null };
  }
  if (code === 'D') {
    const d = last(a => a.actionCode === 'dye');
    return { text: d ? techniqueOf(d, ctx) : '', date: d?.date || null };
  }
  return { text: '', date: null };
}

/**
 * The whole way the piece has come, in codes (§13gc): every stage it reached,
 * in order, each with what did it — „W → M (AA + CaCO₃) → D (EP)". Read from
 * the actions every time; never stored.
 *
 * @returns {{ steps: {code: string, detail: string}[], text: string, finished: boolean }}
 */
export function deriveProcessTrail(fabric, ctx = {}, lang = 'bg') {
  const hist = actionHistory(fabric);
  const steps = [];
  const push = (code, detail) => {
    const prev = steps[steps.length - 1];
    if (prev && prev.code === code) { prev.detail = join([prev.detail, detail]); return; }
    steps.push({ code, detail: detail || '' });
  };
  let finished = false;
  for (const a of hist) {
    const c = a.actionCode;
    if (c === 'wash') push('W', '');
    else if (c === 'tannin') push('T', actionCode(a, ctx, lang));
    else if (c === 'mordant') push('M', actionCode(a, ctx, lang));
    else if (c === 'dye') push('D', [techniqueOf(a, ctx), workRider(a, ctx, lang)].filter(Boolean).join(' · '));
    else if (c === 'finish') finished = true;
    else if (c && c !== 'other' && steps.length) {
      // A treatment that moves no box belongs to the stage it followed.
      const prev = steps[steps.length - 1];
      prev.detail = join([prev.detail, actionCode(a, ctx, lang)]);
    }
  }
  const text = steps.map(s => s.detail ? `${s.code} (${s.detail})` : s.code).join(' → ');
  return { steps, text, finished };
}

// ---- the process summary (§13ge) ------------------------------------------------
//
// What was done to one piece, laid out so it can be copied onto a tag by hand.
// Everything comes from what is already recorded — the actions, the recipes
// they name, the work the colouring was part of — and nothing is stored. What
// the record does not know is not said: a recipe that offers PAS or AS stays
// „PAS/AS", and a blanket is described in the words written for it.

const plantName = (id, ctx, lang) => {
  const p = id && ctx.plants ? ctx.plants.get(id) : null;
  const n = p && p.nameCommon;
  return n ? (typeof n === 'string' ? n : (n[lang] || n.bg || n.en || '')) : '';
};
const workOf = (a, ctx) => (a && a.trialId && ctx.trials ? ctx.trials.get(a.trialId) : null);
const plantsOf = (tr, ctx, lang) => [...new Set((tr?.placements || []).map(p => plantName(p.plantId, ctx, lang)).filter(Boolean))];
const blanketOf = (tr) => (tr?.bundle?.layers || []).find(l => l && l.kind === 'carrier_blanket') || null;
const words = (v) => String(v || '').trim();

// The short addition to D in the trail: only what is recorded and short.
function workRider(a, ctx, lang) {
  const tr = workOf(a, ctx);
  if (!tr) return '';
  const p = String(tr.processCode || '');
  if (p.startsWith('ecoprint')) {
    const b = blanketOf(tr);
    return b ? ['BLK', words(b.what)].filter(Boolean).join(' ') : '';
  }
  const plants = plantsOf(tr, ctx, lang);
  return plants.length > 2 ? plants.slice(0, 2).join(', ') + '…' : plants.join(', ');
}

// A modifier the work names as one: an iron afterbath is Fe; a modifier bath is
// its recipe's code, or the words written on the step.
function modifiersOf(tr, ctx, lang) {
  const out = [];
  for (const st of tr?.steps || []) {
    if (st.typeCode === 'post_iron') out.push('Fe');
    else if (st.typeCode === 'post_modifier') out.push(recipeCode(st.recipeId, ctx, lang) || words(st.what));
  }
  return [...new Set(out.filter(Boolean))];
}

/** The human name of a dictionary code, in the language shown: „EP · Eco-print". */
export function codeWithName(code, lang = 'bg') {
  const c = codeByName.get(code);
  return c ? `${code} · ${lang === 'en' ? c.en : c.bg}` : code;
}

/**
 * The process summary of a piece (§13ge) — a projection, never stored.
 *
 * Fields are present only when the record says them:
 *   status       — deriveStudioStatus
 *   preparation  — every treatment before the colouring, from the trail's own
 *                  stages: „AA + CaCO₃", „TAN → PAS + COT"
 *   technique    — the colouring's technique, a code with its name
 *   pasteCode    — a paste work's paste recipe, when it has a code
 *   dye          — a bath's or a paste's dyestuff (the work's placements)
 *   plants       — an eco print's plants (the work's placements)
 *   blanket      — an eco print's carrier blanket: { material, treatment, bath },
 *                  each in the words written on the layer
 *   modifiers    — the work's iron or modifier baths
 *   date, trialId
 */
export function deriveProcessSummary(fabric, ctx = {}, lang = 'bg') {
  const s = deriveStudioStatus(fabric);
  const out = { status: s };
  const trail = deriveProcessTrail(fabric, ctx, lang);
  const prep = trail.steps.filter(x => x.code !== 'D' && x.detail).map(x => x.detail);
  if (prep.length) out.preparation = prep.join(' → ');

  const hist = actionHistory(fabric).filter(a => a.actionCode === 'dye');
  const dye = hist.length ? hist[hist.length - 1] : null;
  if (dye) {
    const code = techniqueOf(dye, ctx);
    out.technique = { code, label: codeWithName(code, lang) };
    const tr = workOf(dye, ctx);
    if (tr) {
      out.trialId = tr.id;
      const plants = plantsOf(tr, ctx, lang);
      if (code === 'EP') {
        if (plants.length) out.plants = plants;
        const b = blanketOf(tr);
        if (b) {
          const blanket = { material: words(b.what), treatment: words(b.prep?.treatment), bath: words(b.prep?.bath) };
          if (blanket.material || blanket.treatment || blanket.bath) out.blanket = blanket;
        }
      } else if (plants.length) out.dye = plants;
      if (code === 'MP' || code === 'DMP') {
        const paste = (tr.steps || []).map(st => ctx.recipes?.get(st.recipeId)).find(r => r && r.shortCode && /MP$/.test(r.shortCode));
        if (paste && paste.shortCode !== code) out.pasteCode = paste.shortCode;
      }
      const mods = modifiersOf(tr, ctx, lang);
      if (mods.length) out.modifiers = mods;
    }
    if (dye.date) out.date = dye.date;
  } else {
    const sum = deriveStudioTreatmentSummary(fabric, ctx, lang);
    if (sum.date) out.date = sum.date;
  }
  return out;
}

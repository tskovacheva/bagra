// try-studio.mjs — Studio System v1, the logic (§13gc). The screens are
// try-studio-screens.mjs.
//
// The five statuses (unique, iconed, readable, told apart), the code dictionary
// and its collision rules, the recipes' short codes, and the two shared
// derivations with the trail — from fixtures for every case, the finished and
// the old-shaped included. Nothing here writes; neither does studio.js.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
process.chdir(ROOT);
const { STUDIO_STATUSES, STUDIO_CODES, codeTokens, deriveStudioStatus, deriveStudioTreatmentSummary, deriveProcessTrail, deriveProcessSummary, codeWithName, studioHistory } =
  await import('../studio.js');

let failed = false;
const ok = (m) => console.log('  ok   ' + m);
const fail = (m) => { failed = true; console.log('  FAIL ' + m); };
const is = (got, want, m) => JSON.stringify(got) === JSON.stringify(want) ? ok(m) : fail(`${m} — expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);

// ---- the five
console.log('the five statuses');
is(STUDIO_STATUSES.map(s => s.code), ['RAW', 'W', 'T', 'M', 'D'], 'five, in order, D last');
for (const k of ['code', 'hex', 'icon', 'bg', 'en']) {
  const vals = STUDIO_STATUSES.map(s => s[k]);
  new Set(vals).size === 5 && vals.every(Boolean) ? ok(`each has its own ${k}`) : fail(`${k} missing or shared: ${vals}`);
}
const sprite = new Set([...fs.readFileSync('index.html', 'utf8').matchAll(/<symbol id="([^"]+)"/g)].map(m => m[1]));
STUDIO_STATUSES.every(s => sprite.has(s.icon)) ? ok('every icon is in the existing sprite') : fail('an icon is not in the sprite');
const rgb = (h) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const lum = (h) => { const c = rgb(h).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const worst = Math.min(...STUDIO_STATUSES.map(s => contrast(s.hex, '#2A2724')));
worst >= 4.5 ? ok(`dark text reads on every status colour (lowest ${worst.toFixed(1)}:1)`) : fail(`dark text on a status colour is only ${worst.toFixed(2)}:1`);
let near = Infinity;
for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) {
  const [a, b] = [rgb(STUDIO_STATUSES[i].hex), rgb(STUDIO_STATUSES[j].hex)];
  near = Math.min(near, Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]));
}
near >= 45 ? ok(`the five are told apart (closest pair ${Math.round(near)} apart in RGB)`) : fail(`two status colours are only ${Math.round(near)} apart`);
const hsv = (h) => { const [r, g, b] = rgb(h).map(v => v / 255); const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  const hh = !d ? 0 : mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (hh * 60 + 360) % 360, s: mx ? d / mx : 0 }; };
STUDIO_STATUSES.every(s => hsv(s.hex).s <= 0.6) ? ok('all muted (HSV saturation at most 0.6)') : fail('a status colour is saturated');
STUDIO_STATUSES.every(s => { const { h, s: sat } = hsv(s.hex); return !(sat > 0.4 && (h < 10 || h > 350)); })
  ? ok('none is red — coral is the last stage, not an alarm') : fail('a status colour is red');

// ---- the dictionary
console.log('the code dictionary');
const codes = STUDIO_CODES.map(c => c.code);
new Set(codes).size === codes.length ? ok(`${codes.length} codes, none twice`) : fail('a code appears twice: ' + codes.filter((c, i) => codes.indexOf(c) !== i));
const lower = codes.map(c => c.toLowerCase());
const folded = lower.filter((c, i) => lower.indexOf(c) !== i);
folded.length ? fail('codes that differ only by case: ' + folded) : ok('no two codes differ only by case');
const by = (c) => STUDIO_CODES.find(x => x.code === c);
is([by('COT').en, /cotton/i.test(JSON.stringify(by('COT')).replace(/Never „cotton“/, ''))], ['Cream of tartar', false], 'COT is cream of tartar, never cotton');
is([by('AA').en, by('AAc').en], ['Aluminium acetate', 'Ascorbic acid'], 'AA is aluminium acetate and AAc ascorbic acid');
is([by('CA').en, /calcium/i.test(by('CA').en)], ['Citric acid', false], 'CA is citric acid, never calcium');
is(by('VINEGAR') && by('AcOH') ? [by('VINEGAR').en, by('AcOH').en] : null, ['Vinegar', 'Acetic acid'], 'vinegar and acetic acid are two codes');
STUDIO_CODES.every(c => ['lifecycle', 'mordant', 'assist', 'reduction', 'technique'].includes(c.category))
  ? ok('no fibre and no plant is coded — five categories only') : fail('a code has a category outside the five');
STUDIO_CODES.every(c => ['formula', 'practical', 'studio'].includes(c.type) && c.bg && c.en && c.use?.bg && c.use?.en)
  ? ok('every code says what kind it is, and its name and use in both languages') : fail('a code lacks its kind, a name or a use');
STUDIO_CODES.filter(c => c.type === 'formula').every(c => /[A-Z][a-z]?/.test(c.code) && !/\s/.test(c.code))
  ? ok('formula codes are written as formulas') : fail('a formula code is not a formula');

// ---- the recipes' short codes
console.log('recipe short codes');
const pack = JSON.parse(fs.readFileSync('seed/recipes.json', 'utf8')).recipes;
const sc = Object.fromEntries(pack.filter(r => r.shortCode).map(r => [r.code, r.shortCode]));
const sortKeys = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
is(sortKeys(sc), sortKeys({ 'silk-mordant': 'PAS', 'cellulose-alum-soda-mordant': 'PAS/AS + Na₂CO₃', 'aluminium-acetate-mordant': 'AA',
  'chalk-bath': 'CaCO₃', 'mordant-print-paste': 'MP', 'dye-mordant-print-paste': 'DMP',
  'compound-mordant-bright': 'PAS + Fe + Na₂CO₃ + VINEGAR', 'tannin-bath': 'TAN' }), 'eight recipes carry a code, each the whole of what it applies');
const unknown = Object.values(sc).flatMap(codeTokens).filter(tk => !codes.includes(tk));
is(unknown, [], 'every token of every recipe code is in the dictionary');
is(codeTokens('VINEGAR 6% + PAS'), ['VINEGAR', 'PAS'], 'a strength after a code belongs to it');

// ---- the status
console.log('deriveStudioStatus');
const A = (actionCode, date, extra = {}) => ({ id: actionCode + date + (extra.recipeId || ''), actionCode, date, ...extra });
const F = (...actions) => ({ id: 'f', label: 'П-028', actions });
const st = (f) => { const s = deriveStudioStatus(f); return s.code + (s.finished ? '+finished' : ''); };
is(st(F()), 'RAW', 'no action: RAW');
is(st(F(A('wash', '2026-01-01'))), 'W', 'washed: W');
is(st(F(A('wash', '2026-01-01'), A('tannin', '2026-01-02'))), 'T', 'washed, then tannin: T — derived, the box stays scoured');
is(st(F(A('tannin', '2025-12-30'), A('wash', '2026-01-01'))), 'W', 'tannin BEFORE the wash does not make it T');
is(st(F(A('wash', '2026-01-01'), A('tannin', '2026-01-02'), A('mordant', '2026-01-03'))), 'M', 'tannin then mordant: M');
is(st(F(A('wash', '2026-01-01'), A('mordant', '2026-01-02'), A('dye', '2026-01-03'))), 'D', 'dyed: D');
is(st(F(A('wash', '2026-01-01'), A('dye', '2026-01-02'), A('finish', '2026-01-05'))), 'D+finished', 'finished after dyeing: D, and finished');
is(st(F(A('wash', '2026-01-01'), A('tannin', '2026-01-02'), A('finish', '2026-01-03'))), 'T+finished', 'finished as it is, tanned and never dyed: T, not D');
is(st(F(A('wash', '2026-01-01'), A('iron', '2026-01-02'))), 'W', 'a treatment that moves no box changes nothing');
is(st({ id: 'x', stateEvents: [{ stateCode: 'scoured', date: '2024-01-01' }, { stateCode: 'finished', date: '2024-02-01' }] }), 'W+finished',
   'an unmigrated record, finished from washed: W, and finished');
is(st({ id: 'x', state: 'mordanted', actions: [] }), 'M', 'a record whose only history is its state at creation');

// ---- the summary
console.log('deriveStudioTreatmentSummary');
const recipes = new Map([
  ['seed:aluminium-acetate-mordant', { id: 'seed:aluminium-acetate-mordant', shortCode: 'AA', name: { bg: 'Алуминиев ацетат', en: 'Aluminium acetate' } }],
  ['seed:chalk-bath', { id: 'seed:chalk-bath', shortCode: 'CaCO₃', name: { bg: 'Кредова баня', en: 'Chalk bath' } }],
  ['seed:tannin-bath', { id: 'seed:tannin-bath', shortCode: 'TAN', name: { bg: 'Танин', en: 'Tannin' } }],
  ['own-pas', { id: 'own-pas', shortCode: 'PAS + COT', name: { bg: 'Стипца с винен камък', en: 'Alum with tartar' } }],
  ['own-nocode', { id: 'own-nocode', name: { bg: 'Моята стипца', en: 'My alum' } }],
  ['seed:dye-mordant-print-paste', { id: 'seed:dye-mordant-print-paste', shortCode: 'DMP', name: { bg: 'Паста', en: 'Paste' } }],
]);
const trials = new Map([['tr-ep', { id: 'tr-ep', processCode: 'ecoprint' }], ['tr-dye', { id: 'tr-dye', processCode: 'immersion' }],
  ['tr-dmp', { id: 'tr-dmp', processCode: 'paste', steps: [{ recipeId: 'seed:dye-mordant-print-paste' }] }]]);
const ctx = { recipes, trials };
const sum = (f, lang = 'bg') => { const s = deriveStudioTreatmentSummary(f, ctx, lang); return [s.text, s.date]; };
const aa = F(A('wash', '2026-09-28'), A('mordant', '2026-10-01', { recipeId: 'seed:aluminium-acetate-mordant' }),
             A('neutralise', '2026-10-02', { recipeId: 'seed:chalk-bath' }));
is(sum(aa), ['AA + CaCO₃', '2026-10-02'], 'mordant and the chalk bath after it: AA + CaCO₃, dated by the last');
is(sum(F(A('wash', '2026-01-01'), A('mordant', '2026-01-02', { recipeId: 'own-pas' }))), ['PAS + COT', '2026-01-02'],
   'a recipe of hers with a code says it whole: PAS + COT');
is(sum(F(A('wash', '2026-01-01'), A('mordant', '2026-01-02', { recipeId: 'own-nocode' }))), ['Моята стипца', '2026-01-02'],
   'a recipe with no code falls back to its name (decision 3)');
is(sum(F(A('wash', '2026-01-01'), A('mordant', '2026-01-02', { recipeId: 'own-nocode' })), 'en')[0], 'My alum', 'in the language shown');
is(sum(F(A('wash', '2026-01-01'), A('tannin', '2026-01-02'))), ['TAN', '2026-01-02'], 'tannin with no recipe: TAN');
is(sum(F(A('wash', '2026-01-01'), A('mordant', '2026-01-02', { recipeId: 'seed:aluminium-acetate-mordant' }), A('dye', '2026-01-04', { trialId: 'tr-ep' }))),
   ['EP', '2026-01-04'], 'dyed in an eco print: EP');
is(sum(F(A('dye', '2026-01-04', { trialId: 'tr-dmp' })))[0], 'DMP', 'a paste print with the dye-and-mordant paste: DMP');
is(sum(F(A('dye', '2026-01-04')))[0], 'DYE', 'a dye action with no work behind it: DYE');
is(sum(F()), ['', null], 'RAW: nothing to say');

// ---- the trail
console.log('deriveProcessTrail');
const ep = F(...aa.actions, A('dye', '2026-10-04', { trialId: 'tr-ep' }));
is(deriveProcessTrail(ep, ctx).text, 'W → M (AA + CaCO₃) → D (EP)', 'the eco-print example: W → M (AA + CaCO₃) → D (EP)');
const tpd = F(A('wash', '2026-01-01'), A('tannin', '2026-01-02', { recipeId: 'seed:tannin-bath' }),
  A('mordant', '2026-01-03', { recipeId: 'own-pas' }), A('dye', '2026-01-05', { trialId: 'tr-dye' }));
is(deriveProcessTrail(tpd, ctx).text, 'W → T (TAN) → M (PAS + COT) → D (DYE)', 'W → T (TAN) → M (PAS + COT) → D (DYE)');
const fin = deriveProcessTrail(F(...ep.actions, A('finish', '2026-10-10')), ctx);
is([fin.text, fin.finished], ['W → M (AA + CaCO₃) → D (EP)', true], 'finishing ends the trail without becoming a stage');
is(deriveProcessTrail(F(), ctx).text, '', 'no actions: no trail');

// ---- the process summary (§13ge)
console.log('deriveProcessSummary');
const plants = new Map([
  ['seed:eucalyptus_cinerea', { id: 'seed:eucalyptus_cinerea', nameCommon: { bg: 'евкалипт', en: 'eucalyptus' } }],
  ['seed:rosa_canina', { id: 'seed:rosa_canina', nameCommon: { bg: 'шипка', en: 'dog rose' } }],
  ['seed:rubia_tinctorum', { id: 'seed:rubia_tinctorum', nameCommon: { bg: 'брош', en: 'madder' } }],
]);
recipes.set('seed:cellulose-alum-soda-mordant', { id: 'seed:cellulose-alum-soda-mordant', shortCode: 'PAS/AS + Na₂CO₃', name: { bg: 'Стипца и сода', en: 'Alum and soda' } });
recipes.set('seed:mordant-print-paste', { id: 'seed:mordant-print-paste', shortCode: 'MP', name: { bg: 'Паста', en: 'Paste' } });
trials.set('tr-ep-full', { id: 'tr-ep-full', processCode: 'ecoprint',
  placements: [{ plantId: 'seed:eucalyptus_cinerea' }, { plantId: 'seed:rosa_canina' }, { plantId: 'seed:eucalyptus_cinerea' }],
  bundle: { layers: [{ kind: 'receiving_cloth', what: 'коприна' },
                     { kind: 'carrier_blanket', what: 'памук', prep: { treatment: 'Fe', bath: 'брош' } },
                     { kind: 'plants', what: '' }] },
  steps: [] });
trials.set('tr-madder', { id: 'tr-madder', processCode: 'immersion', placements: [{ plantId: 'seed:rubia_tinctorum' }], steps: [] });
trials.set('tr-walnut-fe', { id: 'tr-walnut-fe', processCode: 'immersion', placements: [{ plantId: 'seed:rubia_tinctorum' }],
  steps: [{ typeCode: 'dye' }, { typeCode: 'post_iron' }] });
trials.set('tr-mp', { id: 'tr-mp', processCode: 'paste', placements: [{ plantId: 'seed:rubia_tinctorum' }],
  steps: [{ typeCode: 'print_paste', recipeId: 'seed:mordant-print-paste' }] });
const cx = { recipes, trials, plants };
const silk = { id: 'silk', label: 'П-104', composition: [{ fibreCode: 'silk', percent: 100 }], actions: [
  A('wash', '2026-09-28'), A('mordant', '2026-10-01', { recipeId: 'seed:aluminium-acetate-mordant' }),
  A('neutralise', '2026-10-02', { recipeId: 'seed:chalk-bath' }), A('dye', '2026-10-04', { trialId: 'tr-ep-full' })] };
const frozen = JSON.stringify(silk);
const eps = deriveProcessSummary(silk, cx, 'bg');
is({ code: eps.status.code, preparation: eps.preparation, technique: eps.technique, blanket: eps.blanket, plants: eps.plants, date: eps.date,
     trialId: eps.trialId, dye: eps.dye, modifiers: eps.modifiers },
   { code: 'D', preparation: 'AA + CaCO₃', technique: { code: 'EP', label: 'EP · Еко принт' },
     blanket: { material: 'памук', treatment: 'Fe', bath: 'брош' }, plants: ['евкалипт', 'шипка'], date: '2026-10-04', trialId: 'tr-ep-full' },
   'eco print: AA + CaCO₃, EP · Еко принт, the blanket in its own words, the plants once each');
is(deriveProcessTrail(silk, cx, 'bg').text, 'W → M (AA + CaCO₃) → D (EP · BLK памук)', 'its trail: D carries BLK and the blanket — no plant list');
is(deriveProcessSummary(silk, cx, 'en').plants, ['eucalyptus', 'dog rose'], 'in English, the plants are named in English');
is(deriveProcessSummary(silk, cx, 'en').technique.label, 'EP · Eco-print', 'and the technique too');

const bath = F(A('wash', '2026-01-01'), A('mordant', '2026-01-02', { recipeId: 'seed:aluminium-acetate-mordant' }), A('dye', '2026-01-03', { trialId: 'tr-madder' }));
const b = deriveProcessSummary(bath, cx, 'bg');
is([b.technique.label, b.dye, b.plants, b.blanket], ['DYE · Потапящо багрене', ['брош'], undefined, undefined], 'dye bath: DYE, its dyestuff as Dye — not as eco-print plants');
is(deriveProcessTrail(bath, cx, 'en').text, 'W → M (AA) → D (DYE · madder)', 'its trail: D (DYE · madder)');
is(deriveProcessSummary(F(A('dye', '2026-01-03', { trialId: 'tr-walnut-fe' })), cx, 'bg').modifiers, ['Fe'], 'an iron afterbath on the work: Fe, because it is recorded');
is(b.modifiers, undefined, 'and none where none is recorded');
is(codeWithName('Fe', 'en'), 'Fe · Iron / ferrous sulfate', 'a modifier is shown with its name');
const mp = deriveProcessSummary(F(A('dye', '2026-01-03', { trialId: 'tr-mp' })), cx, 'bg');
is([mp.technique.code, mp.dye, mp.pasteCode], ['MP', ['брош'], undefined], 'a mordant print: MP, its dyestuff; the paste code is not repeated when it is the technique');

const tan = F(A('wash', '2026-01-01'), A('tannin', '2026-01-02', { recipeId: 'seed:tannin-bath' }), A('mordant', '2026-01-03', { recipeId: 'own-pas' }));
is(deriveProcessSummary(tan, cx, 'bg').preparation, 'TAN → PAS + COT', 'tannin path: TAN → PAS + COT');
is(deriveProcessTrail(tan, cx, 'bg').text, 'W → T (TAN) → M (PAS + COT)', 'and its trail');

const either = F(A('wash', '2026-01-01'), A('mordant', '2026-01-02', { recipeId: 'seed:cellulose-alum-soda-mordant' }));
is(deriveProcessSummary(either, cx, 'bg').preparation, 'PAS/AS + Na₂CO₃', 'a recipe offering PAS or AS stays PAS/AS — never PAS');

const bare = deriveProcessSummary(F(A('wash', '2026-01-01')), cx, 'bg');
is(Object.keys(bare).sort(), ['date', 'status'], 'a washed piece: its status and date, and no empty field at all');
is(Object.keys(deriveProcessSummary(F(), cx, 'bg')), ['status'], 'a raw piece: its status alone');
is(JSON.stringify(silk), frozen, 'deriving the summary writes nothing to the piece');

// ---- legacy pieces: the work proves the colouring (§13gf)
console.log('legacy reconstruction');
const W = (id, processCode, status, fabricIds, extra = {}) => ({ id, processCode, status, fabricIds, date: '2025-06-10', placements: [], steps: [], ...extra });
const legacyTrials = new Map([
  ['w-ep', W('w-ep', 'ecoprint', 'complete', ['L1'], { placements: [{ plantId: 'seed:eucalyptus_cinerea' }],
    bundle: { layers: [{ kind: 'carrier_blanket', what: 'П-120 памук', prep: { treatment: 'Fe' } }] } })],
  ['w-dye', W('w-dye', 'immersion', 'complete', ['L2'], { placements: [{ plantId: 'seed:rubia_tinctorum' }] })],
  ['w-open', W('w-open', 'ecoprint', 'in_progress', ['L1b', 'Lact'])],
  ['w-plan', W('w-plan', 'ecoprint', 'planned', ['Lplan'])],
  ['w-early', W('w-early', 'immersion', 'complete', ['Llate'], { date: '2025-01-01' })],
]);
const lx = { recipes, trials: legacyTrials, plants };
const L = (id, ...actions) => ({ id, label: 'П-' + id, actions });
const ls = (f) => { const r = deriveStudioStatus(f, lx); return r.code + (r.finished ? '+finished' : ''); };
const done = (d = '2025-07-01') => A('finish', d);
is(ls(L('L1', done())), 'D+finished', 'L1: finished, no dye action, the receiving piece of a completed eco print → D');
is(ls(L('L2', A('wash', '2025-05-01'), A('mordant', '2025-05-02', { recipeId: 'seed:aluminium-acetate-mordant' }), done())), 'D+finished',
   'L2: finished, washed and mordanted, a completed dye bath → D');
is(ls(L('L3', A('wash', '2025-05-01'), A('tannin', '2025-05-02'), done())), 'T+finished', 'L3: finished, washed and tanned, no colouring work → T, not D');
is(ls(L('L4', A('wash', '2025-05-01'), done())), 'W+finished', 'L4: finished, washed only → W');
is(ls(L('L5', done())), 'RAW+finished', 'L5: finished, nothing recorded, no work → RAW');
is(ls(L('L6', A('wash', '2025-05-01'), done())), 'W+finished',
   'L6: a piece written into an eco print\'s blanket layer, not one of its pieces → not D');
is(ls(L('L1b', done())), 'D+finished', 'a finished piece in a work never closed was worked → D');
is(ls(L('Lact', A('wash', '2025-05-01'))), 'W', 'an ACTIVE piece in a work still in progress is not yet coloured → W');
is(ls(L('Lplan', done())), 'RAW+finished', 'a planned work proves nothing, finished or not');
is(ls(L('Llate', A('wash', '2024-12-01'), A('mordant', '2025-03-01'), done('2025-04-01'))), 'M+finished',
   'a mordant dated after the work wins: the piece is at that later stage');
is(ls(L('L1', done())) === ls(L('L1', done())) && deriveStudioStatus(L('L1', done())).code, 'RAW', 'without the works passed in, nothing is inferred');
const leg = L('L2', A('wash', '2025-05-01'), A('mordant', '2025-05-02', { recipeId: 'seed:aluminium-acetate-mordant' }), done());
const legBefore = JSON.stringify(leg);
is(deriveProcessTrail(leg, lx, 'en').text, 'W → M (AA) → D (DYE · madder)', 'its trail gains the colouring the work proves');
const lsum = deriveProcessSummary(L('L1', done()), lx, 'bg');
is([lsum.status.code, lsum.technique?.code, lsum.plants, lsum.blanket?.material, lsum.trialId, lsum.date],
   ['D', 'EP', ['евкалипт'], 'П-120 памук', 'w-ep', '2025-06-10'], 'and its summary reads the work as rc129 reads any colouring');
is(studioHistory(leg, lx).find(a => a.actionCode === 'dye')?.derived, true, 'the colouring is marked derived');
is(JSON.stringify(leg), legBefore, 'and nothing is written to the piece');

// No module stores a summary on a piece (§13ge): it is drawn, every time.
const writers = fs.readdirSync('modules').map(f => 'modules/' + f).concat(['studio.js', 'studio-ui.js', 'migrations.js'])
  .filter(f => /(processSummary|studioSummary|treatmentSummary)\s*[:=](?!=)/.test(fs.readFileSync(f, 'utf8').replace(/\/\/.*$/gm, '')));
is(writers, [], 'no module assigns a stored summary field');

// ---- data written by older releases
console.log('older data');
const old = JSON.parse(zlib.gunzipSync(fs.readFileSync('test/older-backups/bagra-1.0.0-rc56.json.gz')).toString('utf8'));
let threw = 0;
for (const f of old.data.fabrics) { try { deriveStudioStatus(f); deriveStudioTreatmentSummary(f, ctx); deriveProcessTrail(f, ctx); } catch { threw++; } }
is(threw, 0, `every cloth in an rc56 backup (${old.data.fabrics.length}) has a status, a summary and a trail — its recipes carry no codes`);
const before = JSON.stringify(old.data.fabrics);
old.data.fabrics.forEach(f => deriveProcessTrail(f, ctx));
is(JSON.stringify(old.data.fabrics) === before, true, 'and deriving changes nothing in them');

console.log(failed ? 'studio FAILED' : 'studio passed');
process.exit(failed ? 1 : 0);

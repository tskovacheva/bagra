# Roadmap

Build order matters here: each stage stands on the one before it. Trials come last not because
they are least important — they are the point — but because a trial composes records from every
other module, and building it first would mean building it twice.

Status legend: **done** · **in progress** · *planned*

---

## Stage 0 — Foundation · **done**

- `index.html` shell, palette, dual-form-factor navigation with real SVG icons
- `db.js` — IndexedDB, all stores from §13, migrations that only add
- `i18n.js` — dictionary, language switching, `{bg, en}` resolution with fallback
- `vocab.js` — controlled vocabularies and band definitions, seeded on first run
- `ui.js` — the shared rendering vocabulary, fixed once for all modules
- `sw.js` + `check.sh` — offline shell and the cache-list guard

## Stage 1 — Fabrics · **done**

- One record is one physical piece, with a generated tag code (`П-001`)
- Composition as fibre/percentage pairs; fibre class and dye-receptive fraction derived live
- Warnings: composition not totalling 100, mixed cellulose–protein, majority synthetic
- Treatment lifecycle as dated events; the box inventory as a filter
- Days since mordanting, because cured cloth reads differently

## Stage 2 — Materials · *next*

Dyestuffs, tannins, mordants, pH modifiers, auxiliaries in one module with five categories.

Carries more weight than it looks:
- Chemical identity — `formula`, `hydrationState`, `molarMass`, `concentrationPercent`.
  Without these the substitution arithmetic in the calculators is impossible.
- `maxTempC` on mordants, so a step above the ceiling can be flagged rather than buried in
  prose. Titanium oxalate above 70 °C is the case that matters.
- Handling, disposal and safety notes per mordant — they are not interchangeable.

## Stage 3 — Calculators · *planned*

Reached early because they are self-contained, immediately useful on their own, and because
the aluminium acetate preparation will prove whether ingredient roles are modelled correctly.

- % WOF calculator
- Recipe scaling to weight of goods, carried into a trial as the step performed
- Aluminium acetate preparation, scaled to fabric weight
- Solution calculator (1% iron in N litres) for blankets and afterbaths
- Bath volume at a chosen liquor ratio
- **Reverse mode** — scale from the limiting ingredient, because the cupboard usually sets the
  batch size

## Stage 4 — Plants · *planned*

The reference library's backbone. Fixed chemistry vocabulary with levels; compositional role
(shape printer / filler / resist); preferred leaf surface; preparation before bundling;
steaming tendency; identification note for use while out walking.

## Stage 5 — Recipes · *planned*

Ingredient **roles** rather than fixed materials; `basis` and `basisRefersTo`; multiple methods
per recipe with different arithmetic; required follow-on steps; versioning by `lineageId`;
source attribution visible in list and detail.

## Stage 6 — Techniques · *planned*

Small module, mostly seeded vocabulary. Quick.

## Stage 7 — Combinations · *planned*

The reference engine. Forward, reverse and partial matching. Band-based keys. Confidence
markers. Suggestions from accumulated placements — offered, never computed.

## Stage 8 — Trials · *planned*

The largest screen, built last. Steps with held and rest times kept separate; medium
modification as a structured field including *where*; bundle layers with roles; placements
with per-plant photographs, photo-first for eco print.

## Stage 9 — Packs and backup · *planned*

Personal backup (round-trip, replaces) and reference packs (merge with preview, user edits
win). Export of a user-authored pack, respecting `distributable`.

---

## Parallel workstream — the seed library

Not a stage, because it does not wait for the code. This is the long pole: the application is
weeks of work, a reference library of hundreds of entries is months. If it does not start
early, the result is a finished app with an empty heart.

Order of compilation:
1. Vocabularies and band definitions (done, provisional numbers)
2. Mordants and tannins with real chemical identity
3. Standard recipes — scour, tannin, mordant, aluminium acetate
4. Plants, beginning with what grows at Crafty Place and what is foraged locally
5. Combinations, drawn from the plant × mordant tables in the source guides

Every entry: written in the app's own words, source credited, `distributable` set deliberately.

---

## Open decisions

1. **Does season belong in the combination key?** Autumn oak is loaded with tannin and prints
   boldly; spring oak is thin and soft. Excluded, the reference merges two different results
   and reports an unhelpfully wide variation. Included, combinations roughly double and each
   fills more slowly. Provisional: an optional dimension, set when it is known to matter for
   that plant.
2. **Band numbers are provisional.** The values in `vocab.js` are a first guess and need
   checking against practice before combinations start accumulating — they decide which results
   merge into one reference record.
3. **PWA icons** are not yet made; `manifest.json` carries an empty icon list.

## Deliberately not doing

- Colour measurement from photographs — unreliable without calibration
- Orders, pricing, client records
- Multi-user accounts and cloud sync
- Automated matching against Pantone or NCS

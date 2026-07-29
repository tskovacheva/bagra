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

## Stage 2 — Substances and Stock · **done**

Built as **two** modules, not one. The first attempt made "material" a single record and the
interface was confusing for a structural reason: one record was trying to be both what aluminium
acetate *is* and *which jar is on the shelf*.

- **Substances** — reference knowledge: formula, hydration state, molar mass, standard and maximum
  % WOF, temperature ceiling, handling, disposal, what it is for. Chemistry shown only where a
  substance is a defined compound; a tannin extract is a mixture, not a molecule.
- **Stock** — supplier, date, quantity, remaining, the concentration of *this* bottle.
- A recipe points at a substance, never at a jar, so it does not break when the jar runs out.
- **Base library seeded from `seed/substances.json`** — 26 substances with real chemistry: six
  aluminium salts, iron with its 2% damage ceiling, titanium oxalate with its 70 °C limit, five
  tannins, the sodas and acetates, chalk, lime, cream of tartar, Synthrapol.
- A *Restore base library* button adds only what is missing and can never overwrite her records.

## Stage 3 — Calculators · **done**

Reached early because they are self-contained, immediately useful on their own, and because
the aluminium acetate preparation will prove whether ingredient roles are modelled correctly.

- % WOF calculator
- Recipe scaling to weight of goods, carried into a trial as the step performed
- Aluminium acetate preparation, scaled to fabric weight
- Solution calculator (1% iron in N litres) for blankets and afterbaths
- Bath volume at a chosen liquor ratio
- **Reverse mode** — renamed *Planning a purchase* and moved last: it belongs to stock, not to a
  dye session
- **Exhaust bath** — a rule of thumb, presented as one

Presented one at a time rather than stacked: seven calculators for seven different moments in the
process, listed together, is a wall. The picker reuses the same chip row as the fabric boxes —
with seven modules, one thing looking the same everywhere matters more than each screen being
locally optimal.

The aluminium acetate calculator keeps **no table of its own**. Formulas and molar masses are read
from Substances; a second copy would guarantee the two drift apart.

## Stage 4 — Plants · *next*

The reference library's backbone. Fixed chemistry vocabulary with levels; compositional role
(shape printer / filler / resist); preferred leaf surface; preparation before bundling;
steaming tendency; identification note for use while out walking.

## Stage 5 — Recipes · **done** (chains outstanding)

Built ahead of Plants, because plants need content as much as code and that is separate work.

- Ingredients are **roles** filled by substances, with interchangeable alternatives: one "tannin"
  line holding gallnut 8–10%, myrobalan 20%, cutch 20%. The picker sits next to the number it
  changes, not in the definition above.
- **Quantities are ranges**, because sources give ranges — 8–10% tannin, 12–15% alum on wool.
- `basisRefersTo` shown only for aluminium and sodium sources, where the ambiguity is real.
- **Conditional ingredients** — cream of tartar with wool, dropped entirely for cotton.
- **Two durations**: held while heated, and steeped after the heat goes off. Often the second is
  what makes the result.
- Required follow-on recipes, surfaced with the scaled quantities rather than as advice.
- Live scaling with ceiling warnings read from the substances.
- Versioning by `lineageId`, source attribution, `distributable`.

**Still to build:** recipe chains (§5.3) — scour → tannin → mordant scaled together from one
weight. Better done once there are a few real recipes to chain.

## Stage 5a — Backup · **done** (brought forward from Stage 9)

Brought forward deliberately: data entered now is worth protecting now.

- Export of everything entered, as a dated JSON file
- Import in two modes — *add only what is missing* (cannot harm) and *replace from file*
- Days since the last backup and edits since then, shown plainly
- `navigator.storage.persist()` requested, so the browser will not evict the database
- A clear warning that **nothing persists in a private window** — the lesson learned the hard way

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
2. Mordants and tannins with real chemical identity (done — `seed/substances.json`)
3. Standard recipes — scour, tannin, mordant, aluminium acetate (in progress, entered by hand)
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
4. **The aluminium acetate stoichiometry has not been checked against an independent source.**
   It is written out openly in `calc/alum-acetate.js` for exactly that purpose. Compare against
   Chandra Rice's calculator before trusting it with a large batch.

## Deliberately not doing

- Colour measurement from photographs — unreliable without calibration
- Orders, pricing, client records
- Multi-user accounts and cloud sync
- Automated matching against Pantone or NCS

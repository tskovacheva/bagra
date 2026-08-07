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

## Stage 4 — Plants · **done** (library still filling)

The reference library's backbone, and the module the whole app exists for.

Built as **a few structured fields plus free sections**: structured where the reference needs to be
queried — chemistry classes and levels, dosing per part and per condition, extraction and dyeing
temperatures, water ratio, drying ratio, fastness, harvest months, compositional role — and
book-like sections for everything that is prose. Ten fixed textareas per plant would have made
entry a chore.

Also: a colour range with swatches and conditions; a reference photograph, resized on the way in;
fastness as a visible scale rather than a dropdown; the eight profile headings offered as a nudge,
never as a schema.

**Seeded with 41 Bulgarian dye plants** generated from the owner's own guide — the plants table for
all of them, the full eight-section profiles for the seven garden plants, and dosing, temperatures
and recipes for the fourteen that have recipes in sections III and IV.

Seven anthocyanin plants are marked as fugitive with an explanation. A reference earns its keep by
saying *this one does not work, and here is why* as much as by saying what does.

**Pack sync with a preview** (§10) is implemented here: added, changed and edited records shown in
groups with checkboxes, the ones she has edited unticked by default, nothing written until she says
so, and personal fields — photographs, hand-filled doses — never touched by an update.

### Library coverage

Four workbooks of research later, the library holds **48 plants** — the Bulgarian table, the seven
garden profiles, and the standard trade dyes an eco printer meets anywhere: dyer's chamomile,
Persian berries, brazilwood, cutch, chestnut, henna, eucalyptus, avocado.

Eight purely anthocyanin plants were removed rather than kept as warnings. The library is for
knowledge worth having, not a catalogue of everything green.

| Field | Covered |
|---|---|
| Role, parts, chemistry classes | 46–48 |
| Lightfastness | 51 |
| Washfastness, English names, family, availability | 47–48 |
| Dyeing temperature, soft ceiling | 44–45 |
| Toxicity, sources | 40–41 |
| Dosing (by part) | 29 |
| Compositional role | 33 |
| Chemistry *levels* | 12 |
| Substantive/adjective | 6 |
| Drying ratio, harvest months, years to maturity, colour range, preferred leaf surface, photos | 0 |

**The six at zero will not come from reading.** A drying ratio needs a scale — weigh fresh, dry,
weigh again. A preferred leaf surface needs one leaf placed both ways in one bundle. They are empty
because no source can supply them honestly.

**The real gap is eco print.** Twenty-five plants are marked for it and *none* records which leaf
surface prints better; eighteen have a compositional role marked *needs testing*. Here the reference
still does not answer the question it exists for.

**And a number worth stating plainly:** of some 280 marked claims, none is from literature and none
from an own trial. The whole library is a compilation — useful, unverified. Ten real bundles,
recorded, would turn more amber dots to indigo than another workbook would.

### Earlier snapshot, of 41 plants:

| Field | Covered |
|---|---|
| Latin name, parts, chemistry classes | 39–41 |
| Lightfastness | 28 |
| Recipe text | 14 |
| Dosing % WOF, dyeing temperature | 12 |
| Washfastness, availability | 7 |
| Extraction temperature | 6 |
| Water ratio | 1 |
| English names, family, chemistry *levels*, drying ratio, harvest months, colour range, compositional role, substantive/adjective | 0 |

The empty columns are not oversights — the guide does not contain them, and inventing them would
be worse than leaving them blank. Filling them is a research task in its own right, best done
plant by plant against several sources, and it improves the guide as much as the app.

Most complete today: birch, coreopsis, St John's wort, apple, weld, rosemary, tagetes.
Emptiest: safflower, cornelian cherry, medlar, plum, buckthorn, willow, tomato, nettle.

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

## Stage 6 — Techniques · **done**

Twenty seeded techniques across five categories: four shibori, three resists, three bundling
methods including the barrier layer, three printing methods, and six post-treatments. Each carries
not just a description but the trap: why an iron afterbath is weak and short, why wax fails in a
hot bath, why soaping now is better than soaping on someone's garment.

Fresh-leaf indigo is here rather than among the recipes, because it is not a reduction vat and
saying so plainly saves a wasted harvest.

## Stage 7 — Combinations · **done** (trial links pending)

The reference engine, living inside the Reference module with two tabs: *Search* and *Records*.

**Partial matching is the whole point.** Fill in any subset — plant, part, fibre, mordant, process,
medium — and empty fields widen rather than narrow. Results rank by how many criteria agree; exact
matches carry a badge, partial ones name what differs. Seeing "the same but with iron" beside the
exact answer is usually more useful than the exact answer alone.

**Seeded with 31 combinations transferred by hand** from the owner's guide: oak in five variants,
birch in four, madder's four shades, plus smoke bush, walnut, St John's wort, yarrow, tagetes,
indigo and sumac. Transferred by hand deliberately — an automated pass over the guide's arrow
notation produced nonsense, and a reference holding nonsense is worse than one holding nothing.

**Still to build:** the link to trials. A combination should show the owner's own placements
beneath the expected outcome, with divergence visible. That waits on Stage 8.

## Stage 7a — PWA and versioning · **done**

- Icons drawn in the app palette — a printed leaf in madder on unbleached linen, in plain and
  maskable variants
- `manifest.json` complete, so the app installs to a phone home screen or a desktop dock
- `version.js` as the single place a release number is written; shown in the sidebar

## Stage 8 — Trials · **done** (reverse link pending)

The largest screen, built last because it composes records from every other module.

- **Gallery first** — a photo grid filterable by plant and process, with a list view for when the
  question is chronological rather than visual
- **Placements lead the form**, and each opens with its photograph. The real order of work is:
  open the bundle, photograph it, then say what it was
- Placement fields follow the process: leaf surface, print quality and local treatment appear for
  eco print and vanish for immersion dyeing
- **Steps carry both durations** — held at temperature, and resting after the heat goes off — and
  a structured medium modification that records *where* the vinegar went
- Bundle layers with roles, the barrier among them
- A step without a recipe is allowed; improvised ones are the interesting ones
- Each placement resolves to a reference record at save time and says so, or says there is none

**Still to build:** the reverse view — a combination showing the owner's own placements beneath the
expected outcome, with divergence visible. The data is there; only the view is missing.

## Stage 9 — Read modes and studio use · **done**

After the first sessions of real work, three audits — two from other models, one from the owner —
agreed on the same diagnosis: the interface had become a screen-by-screen translation of the data
model. Everything opened as a form, which made *administering the record* look like the main thing
one does with it.

The correction was structural rather than cosmetic. Four modes were being run together and are now
separated: **finding an answer**, **following a procedure**, **recording what happened**, and
**editing library knowledge**.

- **Read mode on five modules** — plants, recipes, fabrics, trials, combinations. A record opens
  for reading; the form is behind an *Edit* button, and Back from the editor returns to reading the
  same record rather than to the list.
- **Plants lead with a "To use now" card**: which part, how much, how hot, what the ceiling is —
  the answers wanted standing in front of the bed, not fifty controls.
- **Recipes have a working view**: one column, quantities in large figures beside the step that
  uses them, readable from a metre away over a scale.
- **Fabrics read as a biography** — composition, then a dated timeline of every state change, then
  the trials the piece went through.
- **Combinations show the owner's own placements** beneath the expected outcome, with photographs.
  This closes the promise made in the very first conversation: general knowledge on top, personal
  experience beneath, divergence visible. Search results carry the count too.
- **Trials lead with the result** — photograph, assessment, whether it is worth repeating — because
  that is why one opens a finished trial. Secondary sections fold away, their summaries showing
  what is inside so collapsing is not hiding.

Smaller things from the same audits: a timer, a running-low signal on stock, plants as recipe
ingredients, chains selectable as a trial step, writing a recipe from within a trial without losing
the trial, "would I do this again" separate from "did it succeed", and vocabulary renamed from the
theory to the action — *blanket soaked in dye* rather than *adjective carrier blanket*.

## Stage 10 — The story of a piece · **complete (0.68.0)**

All five steps are done, across 0.63.0 to 0.68.0. The stage began as a note in
a feedback document — that the interface still followed the data model rather
than the way an artist works — and ends with a record that runs from an
intention to a finished piece without asking for anything twice.

What was learned along the way is in §13e and §13f: three silent faults, one of
which had been recording plant fastness wrongly for as long as the segmented
control existed, and a deep render harness that opens records instead of
stopping at the list.

The largest remaining piece of work, and the one that came out of real use rather than out of the
model. Specified in §8.0a–d; the reasoning is there and is not repeated here.

Order of work, because the parts depend on one another:

1. ~~**Trial status**~~ — **done**. `planned → in_progress → complete` and `intent` on the header.
   Records written before it existed read as complete and are never written back to; a trial with
   a verdict but no status is *offered* completion on save, never given it silently.
2. ~~**Stages**~~ — **done in 0.66.0**. Six named stages, of which four hold steps; raw cloth and
   finished are read from the fabric and from the trial's status rather than entered again. A stage
   may recur, so steps group into consecutive runs and the progress line is generated from what
   happened. Four new step types for decoration, and a technique on the decoration step. §8.0b.
3. ~~**Photographs on steps**~~ — **done in 0.65.0**. A strip on every step, offered and never
   required, plus `planPhotos` on the trial for a diagram attached whole. The middle of the process
   now has somewhere to live; the fabric's story no longer has a hole between the placement and the
   result. Step photographs are stored at 800px, plan diagrams at the result size so writing on them
   stays readable.
4. ~~**One chronological photo strip**~~ — **done in 0.67.0**. Five sources gathered into one
   sequence on the fabric record, sorted by date and then by rank within the day. §8.0c.
5. ~~**The cloth as the entry point**~~ — **done in 0.68.0**. One button that continues unfinished
   work or starts new, decided by the cloth; the handoff travels in the address. §8.0c.

Two smaller ones ride along because they are cheap and were asked for in the same round:

- ~~**Favourites** on plants, recipes and combinations~~ — **done**. Star in the list, star on the
  record, and a filter chip that appears only once there is something to filter.
- ~~**The label number reserved on save**~~ — **done**. The form shows the code it will get.

Deliberately *not* built: planned-versus-actual figures. Agreed and recorded in §8.0a — one figure
per field, corrected in place.

## Stage 11 — Packs · *after*

Import with merge preview is done (§10, used by substances, plants, techniques and combinations).
What remains is **export**: writing a user-authored pack of records marked `distributable`, so
knowledge can be shared without sharing private work.

That is the last module. After it the app is complete as specified, which is what 1.0 means here.

---

## Still outstanding, by weight

Accepted from the audits and not yet built:

~~**Protecting unsaved work.**~~ — **done in 0.64.0**. One guard over the whole application rather
than a rule each module follows; §13f. It covers the sidebar, Back, opening another record, the
browser's back button and closing the tab, and stays silent on filters and tabs.

**Ceiling warnings inside a trial.** Recipes check the iron and temperature limits; trials do not.
The app is therefore silent at the exact moment the iron is being poured.

**Stock visible on the substance.** The split between what a substance *is* and which jar is on the
shelf is right, but the substance record shows only a thin list, so "do I have it, and how much"
still goes unanswered.

**Reverse search** — "I want this colour on this cloth, how do I get it". In the specification from
the first day, and a genuine gap: it is one of the two directions the reference exists for.

**Bulk actions.** Twenty pieces go into one alum bath; opening twenty records to record it is how
people stop recording.

**Four small ones:** repeat a trial as a variant, a photograph's context (wet or dry, before or
after washing, daylight or lamp), a follow-up observation after the first wash and after a season,
and a thumbnail strip on trial photographs. The last two are now partly absorbed into Stage 10.

**Not needed for now:** a produced pigment as tracked stock — batch and quantity. Recipe type 6
(pigment making) covers writing the procedure down, which is what is actually wanted; tracking how
many grams remain is not.

**Considered and deferred:** extraction as its own reusable object — one extraction serves several
baths and several trials, and recording it as a step loses that. The strongest idea in the last
round of feedback, and worth a proper design rather than a quick field.

## Parallel workstream — the seed library

Not a stage, because it does not wait for the code. This is the long pole: the application is
weeks of work, a reference library of hundreds of entries is months. If it does not start
early, the result is a finished app with an empty heart.

Order of compilation:
1. Vocabularies and band definitions (done; **band numbers still provisional** — they decide which
   results merge into one reference record and want checking before trials accumulate)
2. Mordants and tannins with real chemical identity (done — `seed/substances.json`)
3. Standard recipes — scour, tannin, mordant, aluminium acetate (in progress, entered by hand)
4. Plants — 41 seeded from the guide; structure complete, many fields still empty (see Stage 4)
5. **Gap-filling research** — the columns at zero above, plant by plant, against several sources.
   The output improves the printed guide as much as the app, so the two can be written together
6. Combinations, drawn from the plant × mordant tables in the source guides

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
3. **The aluminium acetate stoichiometry has not been checked against an independent source.**
   It is written out openly in `calc/alum-acetate.js` for exactly that purpose. Compare against
   Chandra Rice's calculator before trusting it with a large batch.

## Deliberately not doing

- Colour measurement from photographs — unreliable without calibration
- Orders, pricing, client records
- Multi-user accounts and cloud sync
- Automated matching against Pantone or NCS

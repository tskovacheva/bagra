# Changelog

The history that used to live at the bottom of `ROADMAP.md`. It was moved here in the
1.0.0-rc23 documentation audit so that the roadmap could be what remains rather than
what has happened.

It is kept because the reasoning is worth more than the list of versions. Most entries
say why a thing was built the way it was, and several say what was got wrong first.

For the decision behind a change, `FUNCTIONAL_SPEC.md` is the source of truth: it is
numbered by section and every entry from §13bq onward cites the version it shipped in.

---

## 1.0.0-rc27 — 24 August 2026

A reliability patch, from an independent technical audit of rc25, with the two
corrections from her first reading of it folded in (the removal count, and the
language) rather than left for a further candidate. Four faults in one
place — the path a record takes into the database — and the discipline that should
have caught them. **No features, no performance work, no change to start-up, seeding,
the service worker or the module graph**, deliberately: the release changes how every
record is written, and a package that also moved other things would not be testable
against the thing it was made for.

- **`replace` did not replace.** It overwrote what matched, added what was missing and
  removed nothing, so restoring last week's backup returned last week's records and
  kept everything written since, mixed together. A merge with overwriting, offered
  under a label promising a snapshot, to a person who had reached for it because
  something had already gone wrong. It now clears and restores, in **one** IndexedDB
  transaction across every store involved, so `clear → half the records → error`
  cannot leave a person with less than she started with. Validated before anything is
  destroyed; a store the file does not carry is left alone rather than emptied. §13co
- **A restored record kept the time the file gives it.** Every write stamped
  `updatedAt` with the current time, so recovering a record destroyed the only record
  of when the work happened. Three named write paths now: `put` stamps and counts,
  `putSystem` stamps and does not count, `putRaw` does neither. §13co
- **The backup counter counts her work.** It counted every write, including the several
  hundred a first install performs — so a person opening the app for the first time was
  told she had hundreds of unsaved changes before typing anything, against a warning
  threshold of forty. Seeding, pack updates, migrations, repairs and restores are now
  invisible to it. `remove` counts, which it never did: the surest way to have no
  unsaved changes had been to spend the afternoon deleting things. §13co
- **The language belongs to the device.** `settings` is restored as part of the snapshot,
  but `language` is not: restoring a phone's backup onto the laptop leaves the laptop in
  the language it was in. Absence is preserved too — no row means Bulgarian by default, so
  writing one where there was none changes the language just as surely.
  `fabricLabelCounter` stays in the snapshot: it is state, not preference. §13co
- **The removal count is a set difference.** It was first written as the count before minus
  the count after, which is right only when the file is a subset of the database. Current
  `{A,B}` against a backup of `{B,C}` is two before and two after, so it reported nothing
  removed while A had gone. §13co
- **The file's own counter is stale by construction** — `downloadBackup` exports and
  then resets, so the count travelling inside the file predates the export. Harmless
  while `replace` was a merge; a new fault the moment it became a snapshot. After a
  restore the counter is zero and the last-backup date is the file's own. §13co
- **The confirmation described the fault.** „Записите с еднакъв идентификатор ще бъдат
  презаписани" was an accurate account of the broken behaviour. Corrected in both
  languages, with the snapshot restore reporting in its own sentence and naming how
  many newer records went. §13co
- **A run that may skip, and a run that may not.** `check.sh` ended with status 0 after
  skipping three of its six layers for a missing shim, so a candidate could be declared
  checked while its runtime tests had never started — the same fault as §1 of the script
  itself. `sh check.sh --release` now fails where a development run skips.
  `screen-check.mjs` had a second silent skip inside it, for a missing Chromium; that
  is closed too. The gate has a guard of its own, asked in both directions. §13cp
- **Two new layers**: `scripts/try-backup-restore.mjs` (a real export, real work on top
  of it, a real restore, asked in both directions) and `scripts/try-release-gate.sh`.
  Every one of the new guards was watched failing against the restored old behaviour
  before it was accepted.
- **The screen layer had been measuring the wrong screen.** Its route list still said
  `#/sources`, and there has been no module of that name since attribution folded into
  the Library. An unknown id falls back to the dashboard, so the layer rendered the home
  screen and reported its faults under the name of Sources — four of the six failures on
  the first release run were that one line, and the Sources screen had never been
  measured at all. Corrected here, with `#/library` and `#/library/ph` added; it is the
  test pipeline, which is what this release is about. §13cp
- **Two real screen faults remain and are NOT fixed here**: „Виж всички →" at 23px on the
  home screen, and the *use now* tiles overflowing on an opened plant. Neither is
  mechanical — one moves a heading row, the other lets a figure wrap — so both want the
  owner's eye and both are the first work of rc28. Until then `check.sh --release`
  refuses the candidate, and rc27 is a candidate that passes five of six layers and says
  so, rather than one that passes six by not running one. §13cp

---

## 1.0.0-rc13 … rc22 — August 2026

The release-candidate run. In order:

- **rc13** — the glossary edited down from 30 terms to 32 (five out, seven in, eight
  reader-facing groups); membership in the glossary stated on the vocabulary entry
  rather than inferred from having a description; guard 24d fixed, having missed the
  one duplicate it existed to catch because the order number was a decimal; a pack
  update taught to withdraw a record, which no pack had ever needed before. §13cb
- **rc14** — `extractionMode` split into a constraint on the part, a choice on the
  placement and a dimension on the dose. The recipe auto-fill had been handing over
  the decoction figure for an alkaline extraction — a ten-fold error arriving as a
  convenience. §13cc
- **rc15** — the seasonal panel, „Какво можеш да събираш сега". §13cd
- **rc16** — a general description for all 57 plants; gathering months moved to the
  part and completed, 118 of 118. §13ce
- **rc17** — the home screen rebuilt around the work in hand. §13cf
- **rc18** — „Как се държи" had been both a field and a section and appeared twice on
  fourteen records; a negative horizontal margin had been widening the whole page on
  a phone; a card carried an attribute the router does not listen for. §13cg
- **rc19** — home screen second pass: „Тъкани по етап", marks on the stages, quick
  actions reduced to what is done often. A request for colour-coded stages and a green
  panel was refused, and the refusal recorded. §13ch
- **rc20** — Stopka's ratios were confirmed and then **not** written: they are WOA and
  `dosing` is WOF, a factor of ten. „Декокция" corrected to „гореща отвара"; one
  record had been carrying three Bulgarian names. §13ci, §13cj
- **rc21** — the reference engine taught that „does not say" is not „says something
  else". §13ck
- **rc22** — the combination library merged: 28 records over 10 plants became 102 over
  35. Four records had been disappearing between the pack and the database because two
  keys shared a code. §13cl

---

# History

What follows is the record of what was built. It is not a to-do list; where an old section
says something is outstanding, the two lists above are what holds.

Build order matters here: each stage stands on the one before it. Trials come last not because
they are least important — they are the point — but because a trial composes records from every
other module, and building it first would mean building it twice.

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

Four workbooks of research later, the library held **48 plants**; it now holds **57** — the Bulgarian table, the seven
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

## Stage 5 — Recipes · **done**

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

**Chains are built** (§5.3) — scour → tannin → mordant scaled together from one weight, and
selectable as a trial step. Two of them exist in the studio database; none ships in the seed,
which is Part A1.

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

## Library additions

- **Rose and hazel** — added in 0.70.0, plants pack 0.2.0. §13h.
- Gaps the owner notices go here as they come up. Adding a plant is cheap; what
  is not cheap is discovering mid-way that a part code or a role does not exist,
  so §13h lists the three that were missing this time.

## From the owner's review of the prototype

Recorded here so they are not lost between stages. Numbering follows her notes.

- ~~**3.1 colour swatches in the plant list**~~ — **done in 0.69.0**. §13g.
- **3.4 icons on the calculators** — not built. The calculator picker is nine
  text buttons; the app has real SVG icons in the navigation but `tools.js` uses
  none. Wants a scale, a drop, a thermometer, a clock drawn in the palette —
  more drawing than code.
- **3.2 a photograph on a recipe** — deferred by the owner: not missed now,
  worth having if the app is released publicly.
- **3.5 swatch library and inspiration** — left open; the owner is not sure it
  is needed.
- **Reverse colour lookup** — now the obvious next step, since the swatches are
  in the list: ask for a colour range and get the plants that reach it.

## The plant profile · **done (0.71.0)**

Specified in §13i, built without a schema change and without touching the edit
form. The fault it carried — the detail reading colours from `p.colours` while
the list derived them from combinations too, so opening a plant lost what the
list had just shown — is fixed: both now read one function, and in the detail
each swatch carries the part, fibre, mordant and process it was reached by.

The list went from eight columns to five. Availability became a filter rather
than a standing column; chemistry moved into the detail; the botanical name
became a subline; the swatches roughly doubled.

The detail is one vertical column of six blocks. The part that was not in the
plan: the blocks fill themselves from the **section headings**, because the
structured fields they were specified against are largely empty — `facing`,
`harvestMonths` and toxicity level on all fifty plants — while the prose that
carries the same knowledge uses recurring headings. A display-time lookup routes
83 sections into *how it is used* and 34 into *gathering*; an unknown heading
falls to *more* and so cannot be lost. Three departures from the specified
layout, all recorded in §13i, the last of which was only visible once three real
profiles were rendered side by side.

Also fixed on the way: `deep-check.mjs` slept a flat 30 ms after a click and had
begun failing two runs in twenty as soon as the plant list grew. It now waits on
a condition. §13e.3 — a check that fails at random is worse than no check.

## Navigation · **done (0.72.0)**

Specified in §11a. The sidebar is two halves and a rule: the reference part, the
diary, and the housekeeping that belongs to neither. The module under *Diary* is
*My work*, the rename held back from Stage 11 and arriving here because the
sidebar was what was being edited. The backup left the calculator picker and got
its own address. The phone bar was inverted — it had carried the reference, which
is read at the desk, while the diary sat behind "more" on the one device the work
is recorded on.

`check-boot.mjs` now checks that every module is reachable from the sidebar.
There are more entries than modules, so a count proves nothing.

Stock stays beside Substances rather than moving to the diary, because that is
where it is going. §11b.

## Interface, third pass · **done (0.74.0 – 0.79.0)**

Step 3 of the agreed order, from the prototype, from ChatGPT's review and from
the owner's own three feedback documents.

**Safety** became a level plus coded precautions across all forty-eight plants,
replacing a sentence of prose per plant. §13.2a.

**The library shrank to forty-eight and got tidier.** Tomato leaves out. Rosemary
was recorded twice — `Rosmarinus officinalis` and `Salvia rosmarinus`, one plant
under the name it had before 2017 and the name it has now, from two sources; no
duplicate check catches that, because the botanical names genuinely differ. Two
dead fields dropped: `liquorRatio`, recorded on one plant of fifty and a property
of the bath rather than the plant, and `facing` on the plant part, empty on all
eighty-two and already meaningful on the placement, where it says how this leaf
was laid this time.

**Harvest months filled** for forty-four, from several sources, for the Bulgarian
climate — the window for the *dye-bearing part*, which is not always the showy
season. Four are deliberately empty: brazilwood, cutch, henna and avocado are not
gathered in a garden. All at `confidence: literature`.

**Fixes:** the batch had two mechanisms and the form offered both; the recipe
ingredient's own dropdown had 150px on an eight-column row; saving showed no
confirmation, which the owner read as "Save does not return to the list, even
though it saves"; "Delete trial" became "Delete this record"; Packs left the
sidebar, declared in `HIDDEN_MODULES` so the reachability check stays a real
guard; the calculators were reordered by how often they are reached for.

**Search** in plants, recipes, techniques and the plant picker. §13j.
**Marks** across the three filter dimensions and the calculators. §13k.

Four silent faults found on the way, all in §13e: a vocabulary that only ever
loaded into an empty store — which the owner saw as English text in the Bulgarian
version — two handlers assigned to one property, a check placed after
`process.exit()`, and a missing icon rendering as a hole rather than an error.

`check.sh` now has five layers. Three of them were added this pass, and each one
exists because something got through.

## The reference library · **complete (0.82.0)**

Forty-eight plants with no gaps against the agreed floor. The owner reviewed every
record in a workbook; what follows is what changed and what was learned.

**What she did:** filled dye qualities on all forty-eight — thirteen of them with
*different text per part and condition*, since sage gives ochre dried and pale
lemon fresh; filled dosing on every part; named the eight parts that arrived from
the second source with no code; retired sixteen odd headings by moving their text
into named columns.

**What was compiled:** harvest months for forty-four (four are bought, not
gathered); chemistry for thirty-two parts; the constituent text for twenty-one
plants, written *after* the chemistry so the prose and the structured field cannot
contradict each other; and 132 colours drafted from her own guide text.

**Corrections found on the way.** Rosemary was two records, one plant under the
name it had before 2017 and the name it has now. Brazilwood's dye was recorded as
a quinone — brazilin is a neoflavonoid. Apple's part was `fruit` where she doses
the peel: a renamed part, not a second one. The vocabulary had no anthraquinone
class at all, which is the chemistry of madder, buckthorn and henna — three of the
four plants marked at heightened care, marked for exactly that reason.

**A merge that would have deleted twenty-one texts.** The workbook was exported
before the constituent texts were written, and the loader rebuilt sections from
the sheet. Keeping everything would have undone her editing; keeping nothing would
have deleted work merged in between. Resolved with a snapshot from the moment of
export: present at export and absent now means she removed it, absent at export
and present now means it was added since. The same shape as §13e.5.

**Not resolved.** Fourteen short texts were dropped by her sheet, four of which
are protective: which buckthorn is which, both ways; madder above 75 °C; which
fibres henna holds on. Offered back for approval, not restored unilaterally.

## Open, after the prototype pass (0.88.6)

Ordered by weight rather than by when they arrived.

**Contradicts the specification, or loses data**
- ~~**Sources are never seeded.**~~ — **fixed in 0.88.7** (§13ab). Two faults, not
  one: the boot list was written by hand and omitted the pack, and the pack
  itself carried `id` where `seedPack` expects `code`, which would have defeated
  the already-seeded check and rewritten all four sources over the owner's edits
  at every launch. The boot list now derives from `PACKS`; the pack is
  normalised; a guard counts every declared pack into the database.

**Blocks work already agreed**
- ~~**Seven modules have no `open()`**~~ — **done in 0.88.9** (§13ad). Six
  converted; `packs` is out of the 1.0 plan and has no records to address. Found
  on the way: `#/reference/records` had been resolving to the search screen, and
  a save had become a departure as far as the unsaved-work guard was concerned.
- ~~**Two renders of one module can be in flight at once**~~ — **fixed in
  0.89.3** (§13ah). A generation and a chain in the router. Worth reading the
  section: the guard fails only when both halves are removed, because
  `parseRoute()` is read at draw time and accidentally covers for either one
  alone.

**Content, waiting on the owner**
- **Forty *Beritba i obrabotka* texts** — the workbook is with her.
- **The list of sources** — four are seeded; she will give the rest.
- **Combinations**: thirty-one cover ten plants, so the swatches of the other
  thirty-eight are empty.
- **Seed recipes**: the studio has seven recipes and two chains in its own
  database; the shipped seed has none. A corrected backup exists.

## From real use, August 2026

The owner's own working notes, after using the application for real work. Taken one at
a time, each discussed before it is built.

- ~~**A finished piece of work left the cloth unfinished.**~~ — **fixed in 0.89.7**
  (§13al) and again in **0.89.9** (§13an). Four faults over two versions, one shape: the
  state chooser defaulted to changing nothing; `readWork()` emptied `fabricIds` on a
  screen with no cloth checkboxes; the status chips reached `complete` without passing
  the five questions; and the card offering to settle the contradiction was a button that
  started new work instead. **One screen owns finishing, and every route leads to it** —
  that is the rule the four of them were each a local exception to. The damage those
  faults already did to stored records is now visible rather than silent (§13ao): work
  that points at no cloth says so, on the card, with the way to attach one.
- **Group work that then divides.** Five pieces scoured and mordanted together, after
  which one goes to eco print, one to a madder bath, and three are dyed together with
  tagetes and shibori. So a bulk action is not a property of the bath — it is **a shared
  stretch of history across several pieces that then branches**. `fabricIds` already lets
  one trial span pieces; there is no way to divide. Open question underneath it: whether
  preparation is a trial at all, or something before one.
- ~~**Working again on a finished piece.**~~ — **done in 0.89.8** (§13am). One card per
  piece with the runs inside; the new work starts from the last photograph of the old and
  carries the ground it stands on, recorded automatically. Found on the way: the cloth's
  own photograph was dated by when its *record* was created, so a piece entered after the
  work was done showed the blank cloth as its most recent picture.
- **Discharge printing** — see below (B2).

- ~~**A dye bath had nowhere to record its colour.**~~ — **done in 0.90.1** (§13ap). A bath
  result is a placement without a position; no second carrier for colour.
- ~~**No way to write a recipe from the step that needs it.**~~ — **done in 0.90.2**
  (§13aq). Found underneath it: `returnTo` was never read, and `flash` was never imported
  in `recipes.js`, so **every save of a recipe had been throwing** — the record written,
  the screen frozen, nothing reported. `check-scope.js` now catches a call to a shared
  helper that was not imported.
- ~~**A dyestuff belongs to a step, not to a process.**~~ — **done in 0.90.3** (§13ar).
  One list carrying `stepId`, not a list per step. The reasoning that settled it: §13ap keyed the
  dyestuff block on the trial's process, which is right for a trial that is only a bath
  and wrong for the ordinary case the owner actually has: an eco print whose steps include
  a dye bath. The bath step then has no dyestuff of its own unless a recipe names one.
  a trial with two baths, tagetes and then madder, cannot say which was in which pot.

- ~~**Photographs of plants have no attribution.**~~ — **done in 0.91.0** (§13at). 40 of 48
  plants carry a photograph with author, licence and source, shown under the picture.
  **Eight are held back:** six with no author recorded (one of them CC BY-SA), sumac —
  NoDerivatives, must be added by hand and uncropped — and coreopsis, whose file did not
  arrive. Rerun `scripts/import-plant-photos.py` when the names and the files are there.
  48 seeded plants, with author, licence and source in a spreadsheet. A plant carries
  `photoData` and nothing else. CC BY-SA requires the author to be named, and this
  application is meant for public distribution — so the three fields must exist and be
  shown before any of those photographs is imported. Waiting on the image files themselves.

- ~~**Four from a morning's use**~~ — **done in 0.90.4** (§13as): a plan photograph that
  could not be removed (a `<label>` was swallowing the press, in ten places), a life strip
  that appeared to end at its fifth photograph, a finished result that could not be
  corrected, and a cloth whose new name did not reach the diary.

- ~~**The day a piece was finished was not recorded**~~ — **done in 0.91.1** (§13au).
  A work had only its own date; the date offered on screen 4 belonged to the cloth's
  state event, so the diary dated finished work by the day it was typed in. `finishedOn`
  now exists and is what finished work is shown and ordered by. Two faults underneath:
  the state date always opened at today, and finishing again **stamped the cloth a second
  time** — three pieces in the live diary claimed to be finished twice. Repaired at boot,
  keeping the earlier stamp and recovering the lost dates onto the work.

- ~~**Stock was a ledger only ever written to**~~ — **done in 0.92.0** (§11b). Substances is now
  **Materials**, opens for reading with its jars on it, and carries the shelf state as a chip and a
  filter. Stock left the navigation; its old addresses redirect into the jar. Found on the way: an
  address to a deleted record threw in six modules, and **Fabrics has no `open()` at all** — its open
  record lives in a variable, which is the hidden state channel §13q forbids. Still open: the jar's
  concentration reaching the alum acetate calculator.

- ~~**Two pieces wearing one number · the bottle not reaching the calculator · Fabrics without an
  address**~~ — **done in 0.93.0** (§13av). Both П-04s were typed by hand and never checked against
  the shelf; the alum acetate calculator now offers the bottles she owns and takes their strength;
  and Fabrics has `open()` at last, so a piece can be reloaded, bookmarked and sent. The existing
  duplicate is reported rather than renamed — the tag is on paper in the studio.

- ~~**The plant audit**~~ — **merged in 0.94.0** (§13aw). Eight photograph authors, two
  taxonomic corrections, fifteen plants gained a part, `heartwood` added to the vocabulary, and
  the accumulator role now explains itself. Held back: tannin levels (they belong in
  `parts[].chemistry`), the boilerplate tannin sentence, the prose temperatures, and four part
  removals. **Open:** whether the eleven plants marked `mordant_accumulator` were marked for
  aluminium or for tannins — to check against the owner's guide and Boutrup & Ellis.
- **Still needed for the eight credited photographs**: the image files themselves, and a re-run of
  `scripts/import-plant-photos.py`.

- ~~**Growth form and habitat · nine new plants · the second audit pass**~~ — **done in 0.95.0**
  (§13ay). `availability` removed as personal; `plantType` and `habitat` added as facts; six
  sections on all 57 plants; 49 of 57 carry a photograph.
- **Next, and now unavoidable**: temperature belongs to the **part**, not the plant, and „unknown"
  and „approximate" must become sayable. Until then the audit's temperature column cannot be merged.
- **Waiting on the owner**: which sumac (the photograph is *R. typhina*, the record *R. coriaria*);
  the twenty compound growth forms, where `subshrub` is likely truer for five; seven more photograph
  files; English throughout.

- ~~**Temperature on the part · „no temperature" as distinct from „unknown"**~~ — **done in
  0.96.0** (§13az). The audit's temperature column is merged, 57 of 57 plants carry a photograph,
  five plants moved to `subshrub`, and the sumac is resolved with a real *R. coriaria* image.
- ~~**Tannin levels into `parts[].chemistry`**~~ — **done in 0.96.1** (§13ba), with a new
  subtype-free `tannin` class so the level can be recorded without inventing which kind.
- ~~**Dosing and fastness for the nine new plants · names capitalised · the phone headline**~~ —
  **done in 0.96.2** (§13bb).
- ~~**English for the library**~~ — **done in 0.97.0** (§13bc). 342 of 342 sections, in nine batch
  files kept in `seed/en/` so the owner's corrections survive every later import. To be read by her
  before distribution: it is a translation, not her second voice.
- **Still open**: their colours (**not** derivable here — a hex from a sentence is a guess wearing the
  costume of a measurement); group work that branches; discharge printing.

## Measured against the course material

The owner's course guide from Chandra Rice, read against what is built.

**Already modelled, and closely:** the seven enhancements, named after the action rather
than the chemistry. The bundle roles — printing cloth, receiving cloth, carrier blanket,
barrier. The physical steps of the standard bundle method: laying on a base, arranging
the plants, laying the blanket, bundling, steaming, rinsing. pH modifiers as the seventh
enhancement.

**Missing entirely: discharge printing** — a leaf that *removes* colour from a pre-dyed
ground. The hard part is not the effect but the shape of the knowledge: discharge
behaviour belongs to **a pair**, a specific plant against a specific dye. A leaf that
strips logwood cleanly may do nothing to madder. That is a third kind of record, neither
a plant fact nor a combination as currently keyed. The guide also insists on a
distinction the community blurs — **true discharge** (the dye bond is broken, a pale
shape) against **a pH shift** (the dye is still there and has changed colour). Neither is
expressible today.

**Missing: madder above 60 °C.** The guide notes that heat itself discharges madder, so
steaming onto a madder ground always shifts it. `softMaxTempC` is the field for this;
whether it is filled for madder needs checking.

**Missing: how the bundle was built** — a second cloth on top, rolled onto a dowel, how
tightly tied. The roles exist; the construction does not. Already deferred.

**Available and not yet used:** the guide's reference list, fifteen sources, which is
what the Sources module has been waiting for.

## Still open from the third pass

- ~~**Stock folding into Substances**~~ — **done in 0.92.0** (§11b). The module is Materials
  and opens for reading with its jars on it.
- **Two photo fields**, reported by the owner and not reproducible: every module
  has one file input except trials, which has three for three different things.
  Waiting on which screen.
- **Pigment extraction and watercolour** — the recipe model is "percent of the
  weight of goods", and a pigment has no cloth. A separate conversation.
- **Unknown and approximate as legitimate values** — ~~"about"~~ **done in
  0.89.4** (§13ai): a mark beside the confidence on the six numbers in a plant
  and on a step's temperature, which also softens the ceiling warning from a
  verdict to a caution. **Unknown and not applicable are deliberately not
  built** — the reasoning, and a middle path worth considering first, are in
  §16.00.
- Five deferred additions from the review: the plant's role in the composition,
  bundle construction, two levels of assessment, series of related trials, and
  the result after drying and washing.

## The agreed order of work (superseded)

Settled with the owner after 0.71.1 and kept for the record. **The two lists at the top of
this document replace it.** What remains live from it is point 4, the phone's diary screens,
which is now B3.

1. ~~**Navigation**~~ — done in 0.72.0.
2. **Stage 11** — the five screens of *My work*.
3. ~~**The rest of the interface**~~ — largely done in 0.74.0–0.79.0; stock
   folding into Substances (§11b) is what remains.
3b. ~~**The prototype pass**~~ — done in 0.88.0–0.88.6. An outside prototype was
   compared screen by screen, fourteen pairs of screenshots, and the differences
   reduced to six rules (§13s) rather than ten separate redesigns. Reference
   (§13t), Home (§13u), Recipes (§13v), Techniques (§13w), Backup (§13x), My
   work (§13y), icons (§13z).

4. **The phone** — *next*. Screens that render badly and parts that cannot be
   reached. Deliberately after 3, because fixing the narrow layout before the
   other interface changes means fixing it twice.

   **The whole application, not the diary.** An earlier version of this entry
   scoped the stage to the diary, on the grounds that the reference is read at a
   desk. The owner rejected that, and §13o had already contradicted it: two of
   the three faults the sixth layer found on its first run were in the reference
   half, and the `overflow-x:auto` applied then was named a stopgap for stacked
   rows in this stage. Every address is in scope. §13aa.

   Known so far, from the owner: the home screen has not been reworked for a
   narrow viewport, and the trial form and read view need horizontal scrolling.
   The "More" sheet is fine.

   The order, from §13aa: ~~the sixth layer first, widened to every address and
   with a 44 px touch target as a phone failure~~ (done, §13aa); ~~then the
   controls sized for a finger~~ (done, §13ac); ~~then §13q~~ (done in
   0.88.9, §13ad — six modules converted; `packs` has no records to address);
   ~~then one shared stacked-row pattern for the eight `table.grid` lists~~ (done
   in 0.89.0, §13ae); ~~then home, calculators and backup~~ (done in 0.89.1,
   §13af — and the calculators turned out not to be calculating at all). **The
   diary screens are held back at the owner's request:** the work there is not
   only about the phone, and will be taken as its own conversation. Four points
   from real use were taken out of it and fixed in 0.89.2 (§13ag): the cover
   photograph, the trial's photo strip, finishing from the list, and placements
   collapsing to one line. What remains for that conversation is the larger one —
   the active trial reads as a form to fill in where it should read as a story to
   follow.

   Worth stating before it starts: **the diary's faults are the ones that only a
   real phone finds.** `deep-check.mjs` renders in jsdom, which has no camera, no
   gallery and no narrow viewport — it could not have caught the `capture` fault
   and will not catch the next one of that kind. `screen-check.mjs` catches
   geometry and nothing else. This stage needs a pass on a real phone after each
   step, or something invented to replace it.

Running alongside, not a stage: **filling the reference**. Recipes and plant
profiles both need content. The plant colour swatches are the case worth naming —
the mechanism shipped in 0.69.0 and is right, but 31 combinations cover ten
plants, so forty of fifty show nothing. **That gap closes by writing
combinations, not by filling `colours` on plants**, which is the same work as
making the reference engine useful rather than polish beside it.

Literature can supply prose, dose ranges and temperatures with a citation and
`confidence: 'literature'`. It cannot supply a hex: sources disagree, and one
book's "brown" is another's "ochre". A swatch wants her own dyeing, or a source
that shows the sample. §13h refused to invent them and that holds.

**Packs are out of the 1.0 plan.** The owner has no clear picture of what she
wants to import, and an import module built without one gets rewritten.

## Stage 11 — The working flow · **done (0.73.0)**

Specified in §8.0e; five screens, one column, every screen with its own address.
`editing` is gone — which screen a record gets is decided by the record plus the
address, so the back button, a reload and a bookmark finally agree with what is
on the screen.

**Fixed on the way in, in 0.71.1:** adding a photograph to a plan, a step or a
placement opened the camera and offered nothing else. `capture="environment"` does
not prefer the camera — it removes the gallery and the file system, so an
already-taken photograph could not be attached at all. Guarded in `check.sh`. §8.5.

What the build changed against the specification and the prototype:

- **The progress line is generated from the runs that exist**, not drawn as five
  fixed stops. The prototype's own screens showed why: it claimed decoration was
  reached on work that had none.
- **One field added** — `resultHex` on the placement. The only route by which her
  own dyeing feeds the plant swatches, which until now filled from literature.
- **Ready sequences insert expanded** and left the per-step dropdown. Two
  mechanisms for one thing is confusing and would let a step become a sequence.
- **Composition is fibre plus percent**, not prose: the fibre class and the mixed
  cellulose–protein warning are derived from the structured form.
- **The palette is ours.** The prototype was green throughout — active states,
  primary buttons, the "success" chip. A success chip is madder now: the interface
  must not put a colour opinion beside a photograph of dyed cloth.

Two faults found and fixed while building, both in §13e: a form reader that
rebuilt its arrays from the screen and would have deleted every collapsed step on
save, and missing `Event` globals that made the harness fail on working code.

Two long-standing faults disappeared with the rewrite rather than being fixed: the
list table had five headers over six cells, and the form carried an empty panel.
`panel()` now returns nothing for empty content, so that class cannot recur.

## Stage 12 — Packs · *parked, not deferred*

Removed from the 1.0 plan by the owner: no clear picture yet of what an import
should actually bring in, and a module built without one gets rewritten. The
reference fills faster by hand in the meantime.

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

~~**Ceiling warnings inside a trial.**~~ — **done in 0.89.3** (§13ah). `trialStepWarnings()` beside
the recipe one, checking the step's temperature, its scaled recipe, and the medium modification —
that last only when its amount is written as a plain percentage, because reading "8 г" as eight per
cent would raise warnings against numbers nobody wrote. The mark shows on the shut step, since the
step being worked is usually the one that is closed.

**Stock visible on the substance.** The split between what a substance *is* and which jar is on the
shelf is right, but the substance record shows only a thin list, so "do I have it, and how much"
still goes unanswered.

~~**Reverse search**~~ — **done in 0.89.3** (§13ah). One form, not a second screen: colour is another
criterion that narrows, and when it is given the conditions become the answer rather than the
question. Distance is measured in Lab (`calc/colour.js`), because on the sRGB channels two shades of
weld come out further apart than iron is from indigo. The results are a table rather than cards
(0.89.5, §13aj): backwards one is scanning for the record to open, not reading matches.

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

# Roadmap

**What remains.** History was moved to `CHANGELOG.md` in the 1.0.0-rc23 documentation
audit; completed items are not repeated here. For the reasoning behind any decision,
`FUNCTIONAL_SPEC.md` is the source of truth.

Three lists, kept apart on purpose:

- **A — required before a paid v1.0.** Only what actually remains. Mostly not features:
  completeness of the shipped data, attribution, translation, units, legal and safety
  text, and where the data lives.
- **B — after v1.0.** Sensible, and not blocking a release.
- **C — deliberately not planned.** Kept only where recording the decision stops it being
  proposed again.

An item moves from B to A by decision, never by drift. Anything listed here is
outstanding unless a line says otherwise.

---

# Part A — required before a paid v1.0

## A1. The shipped data

This is the product. The JavaScript is not the moat; the library is.

- **Combinations: the fibre column.** 102 records now cover 35 of 57 plants (§13cl), but
  91 do not name the fibre and 93 do not name the mordant strength. The guide records
  neither — it was written for someone who knows what is on the bench. **Only the owner can
  answer this**, and it is one column against her own swatches. It turns 91 records from
  „does not state the fibre" into answers about cotton or wool.
- **Combinations: protein.** Every record is cellulose or silent. Wool and silk are a
  second pass and were always understood to be.
- **Two groups set aside** because the key cannot carry the extraction method: woad leaf
  (immersion against a reduction vat) and alkanet root (bath against an alcohol extract).
  Either the key gains the dimension or these stay swatches. §13cl, §13cc
- **Seed recipes.** Three ship. A buyer opening Recipes finds three records. The studio
  database holds more; which are fit to distribute has not been decided.
- **Eco print is the weakest half of the library.** 25 plants are marked for it and none
  records which leaf surface prints better; 18 carry a compositional role marked *needs
  testing*. No book supplies these — they come from bundles, recorded.
- **Six fields are empty for a reason:** drying ratio, preferred leaf surface, years to
  maturity, and the rest. They need a scale and a bundle. Either fill them or say plainly
  in the application that they are unfilled.
- **Library expansion** from Nicola Cliffe's book — complete records only, never partial.
  **Not a release blocker by default.** 57 plants is a library; more is better and is not a
  condition of selling. Whether 1.0 ships with 57 or waits for more is a product decision,
  and it is listed here so it is taken rather than assumed. Moved out of A1's blocking set
  at the owner's instruction, rc25.

## A2. Sources and attribution

- **The register is thin.** Ten sources are seeded. Chandra Rice's guide alone lists fifteen.
- **Traceability of a claim.** When a buyer reads *lightfastness 4/5* it must be visible
  whether that came from literature, from a compilation, from the owner's own trial, or is
  unverified. The confidence model exists per field; what is missing is that every
  significant claim reaches a named source with title, author, year and page.
- **Does attribution move onto the record?** §13.1 keeps the register separate because
  proportions pass from hand to hand and their origin is usually unknown. That holds for a
  private library and inverts for a distributed one. **Open, for the owner.**
- **Photographs are settled** — 57 of 57 carry author, licence and source, and the import
  script refuses one without an author. This is the standard the rest should meet.

## A3. Language and terminology

- **The English of the plant library is a translation, not a second voice.** 342 sections,
  made by the developer and kept in `seed/en/` so corrections survive later imports. **The
  owner reads it before anything is distributed.**
- **One name per thing, in both languages.** Found in use: one record carried three
  Bulgarian names („Нова работа", „Тест", „Ново изпитание"), settled on „опит" in rc20.
  Others reported and not yet looked at: „Справочна част", „Моята работа", and vocabulary
  labels written as codes first and translated afterwards.
  - **„Екстракт" was rejected deliberately.** The root already carries three jobs —
    `recipe_output: extract` is „извлек", the glossary term is „Извличане / екстракция",
    and one method is „алкална екстракция". A fourth sense would empty the word.
  - The English needs an editorial pass **as a second original**, not a synchronisation
    phrase by phrase. §13cb did this for the glossary; nothing else has had it.
- Personal notes are never translated.

## A4. Units — **a decision, not automatically a blocker**

- **A language switch is a blocker.** The application is bilingual and both languages are
  already written; a buyer must be able to choose.
- **Imperial units are NOT**, unless it is decided that they are. It is a real piece of work
  — it touches every calculator, every dose, every temperature and every recipe, and wants
  numerical tests — and it buys nothing for a Bulgarian or European buyer. Shipping 1.0
  metric-only is a defensible position and possibly the right one.
  **Moved out of the blocking set at the owner's instruction, rc25**, so the decision is
  taken deliberately rather than inherited from a list.
- If it is built: metric / imperial stored canonically in g, ml, °C, cm and rendered per
  preference. Two switches, not a preferences system.

## A5. Where the data lives

The one item that is a decision rather than work.

- **Today: local only.** IndexedDB is the source of truth; no account, no server. This is
  the strongest position the product has — *no account, no cloud, your studio data stays on
  your device* — and it removes authentication, password recovery, cloud bills, account
  deletion, sync conflicts and much of GDPR at a stroke.
- **The two problems it leaves**, to be solved without a cloud if possible:
  1. **Data loss.** Clearing site data wipes everything; a private window stores nothing.
     Backup exists and reports how stale it is. Consider making a backup a condition of an
     update.
  2. **Two devices.** Work is recorded on the phone in the studio and read on the laptop.
     Today that is a JSON file carried by hand — honest, and tedious.
- **The decision:** whether 1.0 ships local-only with file transfer, or whether an optional
  sync is worth becoming a data controller for. **Recommended: local-only for 1.0**, sync
  considered only if buyers ask. Sync should not be a prerequisite for selling anything.

## A6. Release hygiene

None of this is a feature; all of it is a condition of taking money.

- **About and version · Help or a short onboarding · Terms · Privacy · Licence · a safety
  and chemical-handling disclaimer · a way to report a bug.** None of these exist.
- **Migration tests as a release blocker.** Before each release: a backup from the previous
  version, update, open, verify. The expensive bug is not a crooked button — it is eighty
  trials and six hundred photographs gone after an update. **Partly done at rc26**: the
  restore path itself is now covered by `scripts/try-backup-restore.mjs`, which runs a real
  export, real work on top of it and a real restore, in both directions (§13co). What is
  still missing is the other half — a backup written by an OLDER version, opened by this
  one.
- **Referential integrity — done at rc28.** A record the history points at can no longer be
  deleted (§13cq). What is NOT done, and is now a decision rather than a task: whether cloth
  gets a *retired* state, and whether reference entities get archiving at all. Both are in
  `DOCUMENTATION_DECISIONS_NEEDED.md`.
- **Numerical tests on the calculators.** A disclaimer does not cover an unchecked formula.
  The aluminium acetate stoichiometry has still not been compared against an independent
  source; it is written out openly in `calc/alum-acetate.js` for exactly that.
- **Release process:** `main` plus short-lived branches, release tags, semantic versioning.
  Never release from the working copy — development, then a candidate the owner uses for a
  while, then production.
- **The documents ship inside the release ZIP**, at the same version as the code.
- **The screen check has now run — and it failed.** It needed `puppeteer-core`, which was
  never installed, so every layout decision from rc13 to rc25 was verified by reading rather
  than by rendering, and `check.sh` left with status 0 regardless. The release gate added in
  rc26 (§13cp) closed that, and the first release run turned up six failures present in rc25
  byte for byte. Four were one stale route in the harness — it still asked for `#/sources`,
  a module that has not existed since attribution folded into the Library, so it was
  measuring the home screen and reporting its faults under another name. That is corrected.
  **Two real faults remain**: „Виж всички →" at 23px on the home screen, and the *use now*
  tiles overflowing on an opened plant. Both are layout decisions rather than mechanical
  corrections and both want the owner's eye. They are the first work of rc28; until then
  `sh check.sh --release` refuses the candidate, which is the point of having it.
- **A release run is now a different run.** `sh check.sh --release` fails where a
  development run skips a layer for a missing dependency. The invariant: a candidate cannot
  be called checked if a layer of its release policy never started. §13cp
- **README and ROADMAP are read before each release.** README claimed 48 plants and a Stock
  module long after both had changed. Audited at rc23; the habit is the point.

---

# Part B — after v1.0

## B1. Re-working a finished piece — **built, and this entry was wrong**

Checked against the code at rc25 and corrected. `trials.workAgain` — „Работи пак върху това
парче" — is on the finished card, the picker excludes cloth that is already busy, and the
record shows the earlier runs on the same piece with dates. It shipped in 0.99.2 and §13bj
records both faults found on the way: a handoff that asked to discard work it had just
saved, and a button that made a rival record every time it was pressed.

This entry claimed the diary had no way to say a second trial happened to a finished piece.
It has had one for six versions. **The roadmap was being written from the specification
rather than from the code**, which is exactly what the rc23 audit was supposed to stop.

What is genuinely still open is smaller and worth keeping:

- **The second trial does not point at the first.** The earlier runs are found by looking
  up the cloth, not by a link on the trial. That is the no-reverse-links rule working as
  intended, and it is fine — but it means a trial read on its own does not know it was a
  re-working.
- **There is no word for it on the trial.** A re-working and a first dyeing look identical
  in the diary list.

## B2. Discharge printing

A third kind of record, keyed by plant × dyestuff, distinguishing true discharge — the dye
destroyed — from a pH shift that only moves the colour. The two look alike on cloth and are
not the same thing. Heat alone discharges madder above 60 °C, so steaming onto a madder
ground always shifts it; `softMaxTempC` is the field, and whether it is filled for madder
wants checking.

**The glossary term went with it in rc13** (§13cb): „Изтегляне" was a definition for a
practice no screen can record, which is a promise the application does not keep. It returns
with the method, under a title that says what it is — **„Печат чрез отнемане на цвят"**.
The rc12 text is in git history and already drew the distinction this section asks for.

## B3. The phone, and the diary screens

An active trial reads as a form and should read as a story. Wants walking through on a real
phone rather than in jsdom, which has no camera and no narrow viewport. Two such walks have
already found faults no check caught.

## B4. Model questions still open

- **Can a piece be finished without a trial?** Tannin as a final colour is the case.
- **Does the season belong in the combination key?**
- **Should the chemistry vocabulary include technologically important non-pigments?**
  Oxalates in rhubarb leaf are the case. §13bu
- **Does the extraction method belong in the combination key?** Deferred in rc14 on the
  same grounds as dye strength: the key widens when there is something to fill it with. Two
  groups are already set aside because of this. §13cc, §13cl
- **Does `dosing` need a base — WOF or WOA?** Stopka's chart is WOA and the doses are WOF, a
  factor of ten. Either the field gains a base and both sit honestly side by side, or the
  chart belongs only to the pigment module, where the base *is* the alum. The second reads
  as the truer one. §13ci
- **A term met on another screen should reach its glossary entry.** The more valuable half
  of the Library, and it touches every screen. §13bt

## B5. Packs — export

Installing a pack works. Making one does not: no export, no versioned publication, no way
for the owner to ship a library update to someone who has bought the application. Parked
rather than deferred — needed the moment a second person owns a copy.

## B6. Home screen and navigation tidying — **the tiles are done (rc25)**

The „Източници" tile was a button that did nothing: `data-go="sources"` with no module of
that id, the register having moved into the Library (§13bt). The „Наличности" tile pointed
at a hidden module — the old Stock address kept alive so saved links resolve (§11b). Both
are gone and the Library takes their place, which is where a person pressing either was
trying to arrive.

What remains here is the wider question, and it belongs with the terminology pass (A3): the
screen still speaks the shape the model had two versions ago, in more places than these.

## B7. Smaller, accepted, not built

- **The visual pass deferred at 0.98.2.** Density, rhythm, the weight of headings. The
  screen was noted at rc19 as close to too even — everything a beige box of equal weight.
  The answer is hierarchy by spacing and heading weight, **not** by colour.
- **Global search.** Cross-module: „жълто" reaching plants, combinations, recipes and
  swatches, each with its own idea of a match. Worth building, with its own brief. An empty
  box that searches less than it appears to is worse than none.

---

# Part C — deliberately not planned

Recorded so they are not proposed again.

- **No cloud account for 1.0.** See A5. Local-only is a feature, not a limitation.
- **No colour coding anywhere in the interface, and no green.** Asked for at rc19 — a soft
  green ground on the seasonal block, a colour per fabric stage — and refused. A person
  judging „is this the ochre I wanted" must not have five invented colours in the corner of
  the eye. Not a style preference: it is the reason the workspace is neutral at all. The
  single exception is a plant's own recorded hex, which is data.
- **No emoji.** They render differently on every platform and would arrive in a bilingual
  offline application as a third typeface nobody chose.
- **No hero image on the home screen.** A third of the first screen, the same picture every
  day, pushing the work below the fold. The first thing you see should be your own work.
- **Seasons as a filter.** „Лято" puts elder flower in June and walnut husks in September
  in one bucket. Months only. §13cd
- **Bath strength as a key dimension.** „Слаба баня", „концентрирана баня" are notes on the
  record. §13br
- **Reverse links in the data.** Related lists are derived on opening, never stored.
- **A second plant list for the seasonal filter.** The same list with a month filter in the
  address. Two lists of plants are two lists that eventually disagree.

# Documentation decisions needed

Raised by the 1.0.0-rc23 documentation audit. Each is a place where the specification,
the code and the documents do not agree, and where choosing between them is a product
decision rather than an editorial one.

**Nothing here has been changed.** The audit corrected only what the code plainly settled;
these are the cases where it does not.

Ordered by weight.

---

> **Items 1, 2 and 3 were settled in 1.0.0-rc25** and are recorded in §13cn. Item 1 was a
> button that did nothing; items 2 and 3 were a field and a section that had been marked
> superseded and never removed. They are struck from this list rather than kept as history —
> `CHANGELOG.md` holds that.

---

## 1. Is the seasonal panel's plant-level fallback still wanted?

**Settled in part at rc25.** `plant.harvestMonths` is retired (§13cn) and `windowOf` no
longer reads it, so the transitional fallback is gone. `viaPlant` survives in the shape and
is now produced only by a plant that records **no parts at all** — a plant entered before
its parts, which the library expansion will create.

**Settled at 1.0.0-rc46.** Such a plant does NOT appear in the seasonal panel, which is the
present behaviour. The months live on the part; a plant with no parts has no months, and the
panel says nothing rather than guessing. The guard states this so a change to it has to be
deliberate.

---

## 2. Which recipes ship — **now ROADMAP A7, item 4**

> Still open, and no longer only about recipes: the pack holds SIXTEEN from six sources, and
> the question is which of them are distributable. It moved to the release list so it cannot
> be lost among decisions that are already settled.

## 2 (as raised). Which recipes ship

**ROADMAP, before this audit.** „The studio database holds eight recipes and two chains;
the shipped seed holds none. A buyer opening the app finds an empty recipe module."

**Code.** `seed/recipes.json` holds three.

**Suggested.** The stale claim has been corrected in the roadmap. What remains is the
decision it was pointing at: **three is not a recipe library.** Which of the studio's
recipes are fit to distribute — and whether a recipe of the owner's own is reference
material or personal work — has not been settled. Left in A1.

---

## 3. The phone navigation bar — **CHECKED at rc64**

> `PHONE_NAV` in `app.js` reads `['dashboard', 'trials', 'plants', 'fabrics']`, with everything
> else behind *More*. So the README's sentence is correct as written — *Home · My work ·
> Plants · Fabrics · More* — and `pigments` did NOT join the bar, it joined the sheet. Checked
> against the code rather than a phone, which is what the entry asked for; the audit that
> raised it had no way to render a narrow viewport, and `screen-check.mjs` has run at every
> width since rc31.

## 3 (as raised). The phone navigation bar

**README.** „The phone bar carries the diary, not the reference: *Home · My work · Plants ·
Fabrics · More*."

**Code.** Not verified in this audit. The claim predates several navigation changes,
`pigments` has since joined the diary group, and the audit had no way to render a narrow
viewport — see the note in ROADMAP A6 about `screen-check.mjs` never having run here.

**Suggested.** Somebody reads it off a phone and confirms or corrects the line. It is one
sentence and it is the only claim in the README that could not be checked against the code.

---

## 4. Whether the specification should be split

Not a discrepancy — an observation from having read it end to end.

`FUNCTIONAL_SPEC.md` is 108 sections and holds three different kinds of writing: the data
model, the product decisions, and the record of faults found and how they were fixed. The
third is by now the largest, and it is the most valuable part of the document — but it
makes the first two hard to find.

**Settled at 1.0.0-rc46: leave it as one document.** A reviewer asked to judge commercial
readiness benefits from the fault record sitting next to the decision it corrected. Revisit
after that review, not before.

---

## 5. What a snapshot restore does to the language — **settled**

**Settled in 1.0.0-rc26 and recorded in §13co.** `language` is a device
preference and survives a snapshot restore; `fabricLabelCounter` stays part of the
snapshot, because losing it means the next piece takes a number already on a label
in the studio. Absence of a language row is preserved as carefully as a value.

---

## 6. Two screen faults, now visible

**Raised by 1.0.0-rc26.** Not a decision about documentation — a decision about a release.

The release gate (§13cp) ran `screen-check.mjs` for the first time and it failed on six
things, every one present in rc25 unchanged. Four were one stale route in the harness and
are corrected in rc26. Two are real and are **not**:

- **„Виж всички →" is 23px** on the home screen, against a 44px finger target (§13ac).
  Growing it moves the heading row it sits in.
- **The *use now* tiles overflow** on an opened plant, 337px of content in 322px. Letting
  a tile shrink means letting a figure wrap — and these are the figures meant to be read
  at a glance over a pot (§13bs).

Neither is a mechanical application of a rule the project already states, which is why
they were left. They want an eye on a real phone.

**Settled.** rc31 was these two and nothing else — which would keep the
discipline of this release and make it as easy to regression-test — or whether they ride
along with the next piece of real work.

**Done.** rc31 was the two, on its own. The last time layout faults were bundled with
something else they were found by the owner on a phone rather than by a check.

---

## 7. A piece of cloth that has been used cannot be deleted

**Raised by 1.0.0-rc28.** The delete policy (§13cq) refuses any record the history points
at, and for a recipe or a plant that is plainly right — they are reference, and the history
means nothing without them.

Cloth is the one entity a person genuinely disposes of. A piece is cut up, given away,
worn out. Under the new policy, a piece that has been in a single trial can never leave the
list, and the list is a working surface rather than an archive.

**What could be done instead**, in rough order of weight:

- Leave it. A finished piece is already out of the way, and the list has boxes.
- A *retired* state on the cloth, so it leaves the working list and keeps its history. This
  is real work: a new state in the vocabulary, in `STATE_ORDER`, and in every screen that
  reads a box.
- Allow deletion of cloth specifically, and accept the orphaned actions. **Not
  recommended** — it is the fault this section exists to close, with an exception carved
  into it.

**Not decided. Asked of the owner.**

---

## 8. Does an `archive` concept belong in the model at all?

**Raised by 1.0.0-rc28.** The second audit suggested Archive/Retire as the answer for
reference entities, and rc28 deliberately did not build it: a new model concept inside an
iteration whose point was a small measurable change would have made it neither small nor
measurable.

The question stands for 1.0. Blocking a delete is honest and it is also a dead end — a
recipe superseded three versions ago is refused deletion for ever, and the list only grows.
An archived record would leave the list and keep the history.

**Suggested.** Decide it after the library is filled, not before. The list is short enough
that the cost is theoretical today, and the concept would touch every reference module.

---

## 9. Sixteen values where the workbook and the pack disagree

**Raised by 1.0.0-rc32.** The phase 1 merge fills only; these were held. Nothing is applied
and nothing will be until each is decided. Grouped by what kind of decision it is.

**SETTLED at rc33.** Alkanet stays at 60 — the owner has no data for a higher ceiling and
the recorded figure stands. Chestnut keeps `gloves` AND gains `dust_mask`: the workbook
replaced one with the other, which reads as a swap and is a loss; dried bark ground to
powder wants both. The chestnut risk LEVEL stays `caution` — nothing was offered to justify
lowering it, and the safe direction is the one to hold when nobody has a reason.

Safflower is not a disagreement about a number. It is the model being wrong, and it has its
own section below.

**Still open (6):** the five additive safety values and the one fastness rating.

---

**Contradicts the record itself — recommend REFUSE (6).** Safflower, flower and leaf:
extraction and dyeing at 70–75 °C with a ceiling of 75. The record's `extractionModes` says
`cold` and its colour note says the red comes from an alkaline extraction. Carthamin is
drawn out cold; heat destroys it. Accepting these would lose the red the plant is in the
library for.

**Raises a ceiling — needs a reason (2).** Alkanet root: dyeing 60 → 60–70 and the ceiling
60 → 70. Alkannin is heat-sensitive. Raising a limit is a claim, and a limit is the field
where a wrong claim costs a dye pot.

**Lowers a stated risk — needs a reason (2).** Henna: `elevated` → `caution`. Chestnut:
`caution` → `low`, and `gloves` replaced by `dust_mask`. Dropping gloves from chestnut is
a loss rather than a swap; dried bark powder wants both.

**Raises a stated risk, or adds a precaution — recommend ACCEPT (5).** Dyer's chamomile:
`low` → `caution`, and `gloves` added to `contact_allergy`. Lavender: `contact_allergy`
added. Henna: `dust_mask` added. These are additive and the notes cite DermNet on Compositae
allergy. Raising a caution is the safe direction.

**A fastness rating moved (1).** Dyer's chamomile: light `good` → `moderate`, with a
peer-reviewed source (Cristea & Vilarem 2006) behind the new value and nothing recorded
behind the old one. **Recommend ACCEPT.**

**Not decided. Asked of the owner.**

---

## 10. Safflower has two extraction routes, and the model has room for one

**Raised by 1.0.0-rc33, and it is a model question rather than a data one.**

The workbook returned safflower at 70–75 °C. The pack said cold, 20–25 °C. Both are right,
and they describe different routes from the same petals:

| | Hot water, first | Cold alkaline, after |
|---|---|---|
| temperature | 70–75 °C, 45–60 min | room temperature, 2 hours |
| pH | neutral | 11, then brought down to 6 |
| mordant | required — alum or alum acetate | none |
| `dyeClass` | **adjective** | **substantive** |
| chemistry | flavonoid — safflower yellow A and B | quinone — carthamin |
| colour | lemon to mustard | pink, coral, red |

Two things follow that the current shape cannot hold.

**`dyeClass` is on the PLANT.** Safflower is adjective by one route and substantive by the
other. Fifty-one plants had this field filled in phase 1 as one fact about the plant; for
safflower it is a fact about the route.

**The routes are sequential, not alternative.** The yellow must be washed out — four to six
rinses — before the red can be got at all. The model has a concept for a sequence (chains),
and it does not live on a plant part.

### Two shapes

**A. The route becomes a thing on the part.**

```js
part.routes = [{ mode, tempExtractC, tempDyeC, softMaxTempC, dyeClass, chemistry, yields }]
```

One home for every figure. 113 parts get a single unnamed route by mechanical migration;
five keep the mode they already declare; safflower's flower gets two. Costs: the *use now*
tiles must decide what to show when a part has two routes (a UI question), and `deep-check`,
the cold-extraction guard and the workbook all follow.

**B. The part keeps one set of figures and the second route lives in the combination.**

Cheaper, and it puts a temperature in two places. That is the fault removed from the CSS in
rc31 — two mechanisms deciding one thing eventually decide differently.

**Recommended: A**, as a session of its own. Phase 2 of the workbook does not wait for it:
none of the three remaining sheets touches this field.

### What the reference half already handles

The two colours are ALREADY expressible as two combination records — same plant, same part,
different pH and mordant, different expected colour — and safflower's `colours[]` already
records both in words. So it is only the FIGURES that have nowhere to go, not the knowledge.

### Meanwhile

Safflower's part still says `cold, 20–25 °C`, which describes the red route only. Incomplete
rather than wrong, and left alone rather than half-corrected.

---

## 11. A combination has one attribution slot and several sources

**Raised by 1.0.0-rc34.** Every one of the 24 records filled in phase 2 already said
`learnedFrom: "Ръководство НАТУРАЛНИ БАГРИЛА, Crafty Place"`. The workbook brought a second
citation for each — and it is not a correction. The guide taught the COLOUR; the paper
taught which FIBRE and MORDANT that colour was got on. Two sources, two different claims,
one field.

**Settled at rc40.** `sourceCodes` on a combination is a list, `learnedFrom` is untouched and
still read, and an influence carries a source of its own (§13dg).

**Recommended: `learnedFrom` becomes a list of source codes.** Small — a seed field and one
render — and it also turns free-text attribution into codes that resolve in the register,
which §13ct already protects from deletion. The thirteen new sources are registered and
currently cited by nothing, which is why nothing yet points at them.

**Also open:** whether a source code should attach to the CLAIM rather than the record —
„this source is why the fibre says cellulose" — which is the fuller answer and a much larger
one. Recommend the list first.

---

## 12. „How does it differ" — SETTLED at rc40

`influences` is the home, with a closed list of six factors and a source per entry (§13dg).
37 texts imported. `notes` was left alone; the 22 condition labels sitting in it are still
there and still look like an old import landing in the wrong field, which is a tidy-up
rather than a decision.

---

## 12a. The original wording of the question

**Settled at rc71** (§13el): the notes were classified and acted on by the owner's instruction — real notes
kept, labels that only restated the key emptied, the rest translated. The account is in
`docs/language/rc71-combinations.md`.

**Raised by 1.0.0-rc34.** Twenty-two rows came back with a sentence about how the result
changes. All three plausible fields are already spoken for or ambiguous:

- **`notes`** is occupied on all 22. And occupied by two different KINDS of thing: real
  prose on some records („Орехът е субстантивен — хваща без мордант"), and what are plainly
  condition labels on others („с железни соли", „кора, алуминиев мордант") — which look like
  the `conditions` text from an earlier import landing in the wrong field.
- **`expected.variation`** carries what the reference engine writes when it compares
  records. A sentence written by hand sitting there would be indistinguishable from one the
  engine produced, which is the fault §13.1 exists to prevent.
- **`influences`** is declared on all 102 records and populated on none.

**Recommended:** clean `notes` first — find how many of the 79 are condition labels rather
than prose, and whether they duplicate a field that already exists. Then decide whether
`influences` is the home for „what changes it" or should be removed as a field that was
declared and never used. Nothing was written into any of the three.

---

## 13. „The back of the leaf prints better" has nowhere to go, and the word for it is a trap

**Raised by 1.0.0-rc35.** The owner set the rule: for roughly nine plants in ten the BACK of
the leaf gives the stronger print, with exceptions — eucalyptus prints strongly from both
sides. It is a good rule and the library needs it. It cannot be written down yet, for two
separate reasons.

**It has no field.** `facing` exists in the vocabulary but it is a dimension of a PLACEMENT
in a trial — where a leaf was laid on a particular day — and it is not part of a combination
key. „This plant prints better from the back" is not a fact about one trial; it is a fact
about the leaf, true whatever the mordant. It belongs beside `compositionalRole` on the
plant or its part, and there is no such field.

**And the existing word is ambiguous in a way that would silently invert the advice.**
`face_down` reads „с лицето надолу" — the leaf's FACE toward the cloth. „The back prints
better" therefore means the back should touch the cloth, which is `face_up`. Anyone reading
the field name will assume the opposite at least half the time, and a rule recorded
backwards is worse than a rule not recorded: it would be followed.

**Recommended:** a new part-level field naming the side that PRINTS, not the side that
points somewhere — `printingSide: 'back' | 'face' | 'either'`. It says the thing directly
and cannot be read upside down. `either` covers eucalyptus, and `facing` stays what it is:
what was done on a particular day.

Until then the print behaviour is in the record's `notes`, in the owner's own words, which
is where it can be read without being misinterpreted. Nothing was written into `facing`.

---

## 14. Alder buckthorn prints from a leaf the record does not have

**Raised by 1.0.0-rc35.** The eco print library describes `rhamnus_cathartica` printing from
its leaves. The plant record has `fruit` and `bark` and no `leaf`, so the record was not
written — one of twenty-five, and the only one skipped.

Either the leaf is a real dye part the plant record is missing, or the entry means a
different species. The library holds THREE buckthorns:

| code | botanical | parts |
|---|---|---|
| `rhamnus_cathartica` | Rhamnus cathartica | fruit, bark |
| `rhamnus_tinctoria` | Rhamnus tinctoria / saxatilis | fruit |
| `frangula_alnus` | Frangula alnus (syn. Rhamnus frangula) | bark, **leaf**, fruit |

`frangula_alnus` is the one with a leaf, and it is also the one the phase 3 workbook cites
Luhamaa 2025 for. The eco print entry mentions „сап-зелено" from the FRUIT, which is
Rhamnus cathartica's famous colour — so the entry may be describing one species' fruit and
another's leaves under one heading.

**Recommended:** check the source of the entry before anything is written. If the leaves are
Frangula, the record moves; if Rhamnus cathartica genuinely dyes from its leaves, the plant
gains a part — and a part is a claim about the plant, not a convenience for the record.

**Not decided. Asked of the owner.**

---

## 15. Two plants have no combination, and that is the finished state

**Settled at 1.0.0-rc36**, against clause 4 of the Definition of Done: a plant without a
reliable combination is a DOCUMENTED absence, not unfinished work.

**Лавандула — `lavandula_angustifolia`.** There is scattered information about dyeing with
lavender and none of it resolves into a clean key for this model: the accounts do not agree
on the part, and where a colour is reported the fibre and the mordant are usually left out.
A record would have to be assembled from fragments that were never about the same
experiment.

**Мушмула — `mespilus_germanica`.** The one historical combination found uses **bismuth**,
which is not in the vocabulary and is not a mordant this application will teach. Adding a
code for it in order to close a gap would be the tail wagging the dog: the vocabulary
describes what the studio does.

Both remain in the library with a full plant profile — they are real dye plants and the
profile is what the plant screen shows. What is absent is the reference answer, and the
application says so rather than guessing.

**These two are why the audit reads the reasons out of THIS file.** An exemption whose
reason lives somewhere else is an exemption nobody can check; if either name is removed from
this section, `audit-library.mjs` fails again the same day.

---

## 16. Plant Library v1 — DONE

**1.0.0-rc36.** Every clause of the owner's Definition of Done holds, and `check.sh` runs
the audit as a layer so it goes on holding.

```
plants with a full basic profile      57/57
plants with at least one combination   55/57
plants without one                       2  — lavender and medlar, both documented above
combination records                    163
  of them eco print                     55
intentional nulls (eco print fibre)     54
unresolved gaps (other fibre)           28
sources registered                      45
invalid codes                            0
```

Moved to post-v1 continuous enrichment, by clause 8 and the owner's own list: the
compositional role for the remaining 24 plants, `printingSide` (§13), a bibliography per
row, a swatch for every literature combination, and more combinations per plant.

---

## 17. The pigment recipes name roles that no substance fills

Raised at 1.0.0-rc46 from a screenshot of „Свързващо за акварел" in the working view.
**Nothing has been changed.** Five findings, and the first two are one decision.

### What the screen showed

The working view of the binder recipe listed five lines: свързващо · разтворител ·
задържа влага · задържа влага · консервант. Two of them are identical, three of them
had a dash where a quantity belongs, and none of them named a substance.

### 17a. The substances do not exist

`seed/substances.json` holds 26 records and every one of them is for dyeing — alums,
tannins, sodas, acids. **Gum arabic, glycerine, honey, clove oil, gum tragacanth,
methylcellulose and kaolin are not among them.** The pigment recipes reference roles
that nothing in the shipped library can fill.

### 17b. So the fallback prints a role, and it looks like a recipe

`nameOf()` in `modules/recipes.js` falls back to `label('ingredient_role', roleCode)`
when a line has no substance. The output is plausible — „свързващо", „разтворител" —
and plausible output hides the fault it covers for, which is a named failure mode in
this project. Its ugliest form is here: **two lines reading „задържа влага" one under
the other**, which are glycerine and honey and are indistinguishable on screen. Their
real names are buried in `note`, which the working view does not draw.

**The decision:** do the seven pigment substances join `seed/substances.json` as
records, so the lines can name them — or do pigment recipes name substances some other
way? They are not dye materials and a buyer opening Материали would meet them among the
mordants. Bearing on this: fabrics and materials are already separate stores because
they are different kinds of thing (§13.4).

### 17c. The numbers are in the prose

The other three pigment recipes — лаков пигмент, акварелна боя, меки пастели — carry
`quantity: null` and `unit: null` on **every** ingredient. Their working view is
entirely dashes. „10 г стипца" and „5 г сода" exist only as sentences inside `note`.

This is the same fault as the 22 condition labels sitting in the combination notes:
correct content in the field for prose. The difference is that here the correct field
is empty, so the screen has nothing to say.

### 17d. The binder does not scale with itself

The recipe is `scaleBy: 'raw'` and the raw material is the gum arabic. But the gum is
written `absolute: 42 g` while the water, glycerine and honey are ratios against the
raw amount. Type 100 into the field and the water and honey move; the gum still says 42.

**This is asserted deliberately** — `scripts/try-calculators.mjs` holds „the gum itself
is absolute and unchanged — 42". So it is a decision already taken, not an oversight,
and the question is whether it was the right one. Either the gum is a line and is not
the base, or it is the base and is not a line. It is currently both, and the screen
cannot show which.

### 17e. A batch shows the recipe's name and none of its quantities

`modules/pigments.js` puts the recipe in a dropdown in the folding aside. Standing over
the pot, the batch screen says which recipe and not how much of anything; the amounts
are on another screen. `rawWeightG` is entered on the batch **and** again in the
recipe's working view — one number in two places, free to disagree.

This runs against „one screen owns finishing, and every route leads to it". Whether the
batch should scale the recipe it names is a model question, not a layout one.

### What the owner settled, 1.0.0-rc46

Answered in full. **Recorded, not yet built** — the shape below is a proposal awaiting
agreement, but these answers are decisions and stand on their own.

- **Practice.** Pigment-making is real but rare — about twice a year, and laborious. It does
  not need to be elaborate. What it must do: link a pigment recipe, the choice of binder and
  the binder's own recipe; hold the materials and substances; let a plant be chosen; and end
  in a photograph and a written result — which colours were got, and what to conclude.
- **17b — honey and glycerine are two roles, not one.** They substitute for each other in
  some cases and not in general; the jobs differ. Glycerine wants a role of its own.
- **17a — the seven substances join the library under a NEW category**, and the owner does
  want a jar of gum arabic. Not folded into `auxiliary`.
- **17c/17d — one master lake recipe, modified in the BATCH.** Not a recipe per plant, which
  was the owner's first answer and was then withdrawn in favour of this. The plant lives on
  the batch, where it already lives. Every specific pigment uses the master and departs from
  it, and the departure is the batch's business.
- **A batch line may carry a substance the master never had** — soda for one plant and not
  another. „That is the point of it": the owner has experimented by modifying and adding.
- **17e — watercolour and pastel stay recipes.** No second record kind. Both start from a
  finished pigment, both have a standard recipe, and one batch of pigment can become both.
  The results — photographs of the colour got from that pigment — attach to the BATCH.
- **The shipped binder keeps the glycerine.** The owner has made watercolours by nearly this
  recipe. Ox gall is untried.
- **The list of what a swatch can be is NOT closed.** Inks, and beyond them paints for other
  purposes entirely, down to building paint. Out of scope now, but the list must not be shut.

### Three things the sources corrected, and one of them was mine

- **Ox gall does not replace glycerine.** The owner supposed it an equivalent substitute.
  By Stopka's own text it is a **surfactant** — it makes the paint flow and mingle on the
  page — while glycerine keeps the cake from drying hard. Stopka's medium carries honey and
  clove oil and optional ox gall and **no glycerine at all**, so the two recipes differ by
  two substances in two directions rather than by one standing in for another. Recorded so
  that a binder made without a plasticiser and with added flow is not later a mystery.
- **The basis is the CARRIER, not the alum — a correction to this document's own proposal.**
  §17c had suggested a `percent_woa` basis, „per cent of the weight of the alum", because
  Stopka's chart is exactly that. Nabil Ali's second madder recipe precipitates the dye onto
  **chalk** — 6 g of dye to 3 g of chalk — with no alum anywhere. Naming the field after the
  alum would have refused that recipe and invited a second field measuring the same thing.
- **A swatch is not labelled by use alone.** Ali's swatch chart names three things at once:
  which recipe, what the result was (dye, paint, glaze), and what it was on — safflower
  appears as „potash on cotton" and again as „potash on leather", two colours from one
  recipe. A closed list of three uses would have broken on the first real example.

### The agreed model — AGREED at 1.0.0-rc46, NOT BUILT

Seven parts. All of it sits after A6; none of it is in 1.0. It is written here rather than
as a §13 section because those sections describe how the application works, and a
specification that describes something unbuilt is a specification that lies. When it is
built it gets a section of its own and this block is replaced by a pointer to it.

**1. Categories say what a substance IS, and the category must be earned.**

A category „for pigment-making" would have grouped seven substances by the book they appear
in rather than by what they do — a bucket by context, which is what the existing five
categories are not. The owner's rule, stated at rc46 and now general: *the category follows
from understanding what the substance is for and what it does.*

Applying it gives a different answer from the one first agreed:

| new category | members |
|---|---|
| **binder** | gum arabic, gum tragacanth, methylcellulose |
| **filler** | kaolin — and **chalk moves here** from `auxiliary` |

Glycerine, honey and clove oil stay in the existing **`auxiliary`**. They neither bind nor
fill; they improve how the paint handles and keeps, which is what neutral soap and
Synthrapol already sit there for.

So it is **six new substances, not seven** — calcium carbonate is already in the library.

**Moving chalk is a migration, not a merge.** The merge scripts only fill what is empty and
print what they hold back; changing a category is not filling an empty field. If the owner
has edited that record, the owner's value is held and printed.

**Slaked lime is reviewed in the same pass.** `calcium_hydroxide` sits under `auxiliary` and
is a strong alkali that raises pH in an indigo vat and in safflower's alkaline extraction.
The `modifier` category exists and has six members. Agreed at rc46: it moves.

**2. Two new roles, not one.**

- **`plasticiser`** — glycerine. Keeps the cake from drying hard and cracking. Honey stays
  `humectant`: it draws moisture so the paint rewets. The vocabulary comment at
  `ingredient_role` already argued that four different jobs must not read as one thing on
  screen, and then two of them were given the same code. This closes that.
- **`carrier`** — the thing a lake precipitates ONTO. Required by part 3: the new basis has
  to point at a line, and there was no line it could honestly point at.

Ox gall is `surfactant`, chalk and kaolin are `filler`, a finished pigment is `pigment` —
all three roles exist and nothing is added for them.

**3. A new basis: per cent of the CARRIER's weight.**

Not „of the alum". Stopka's chart is a percentage of the alum — madder root 500%, greater
celandine 180% — but Ali's second madder recipe precipitates onto **chalk**, 6 g of dye to
3 g of chalk, with no alum anywhere. A field named after the alum refuses that recipe and
invites a second field measuring the same thing, which is the two-mechanisms fault removed
from the CSS at rc31.

**The lake recipe's alum line is corrected to `carrier`.** It currently says `mordant`, and
the alum there mordants nothing — the pigment forms on it. True of Stopka's recipe by
accident and false of Ali's.

Guard: a recipe with a per-cent-of-carrier line and no carrier line is refused.

This is why the three pigment recipes carry `quantity: null` on every ingredient. The
numbers were not forgotten at data entry. They had nowhere to go, and the source register's
own note for Stopka says so — „a chart of plant material as a percentage of the weight of
alum (WOA, not WOF)" — documented when the source was entered, and the field never grew.

**4. A fourth scale mode: by OUTPUT.**

The owner: *„you make a binder, and how much gum you need follows from how much binder you
are making."* The three existing modes scale by cloth weight, bath volume, or raw input.
None of them is what a paste recipe does.

A paste recipe declares what it yields — Stopka's medium about 225 ml, which she calls
twenty pans; the watercolour one to two pans; the pastel per stick — and the field asks how
much you want to get. Every line moves together, the gum with them.

The three dyeing modes are untouched.

**`scripts/try-calculators.mjs` asserts „the gum itself is absolute and unchanged — 42".**
That assertion describes a decision taken when there was no fourth mode. It will fail, and
it must be seen to fail before it is rewritten.

**5. The batch holds what was actually put in — and what differed.**

The master lake recipe is one recipe. A batch takes its lines at the start, every line is
then editable, and a line may be added for a substance the master never had — soda for one
plant and not another. The owner: *„that is the point of it."*

**And the batch remembers which lines depart from the master.** A batch that only holds
lines gives back a list and no knowledge; a batch that marks its departures answers „what
did I do differently for madder", which is the thing the owner was recording when she
experimented in the first place.

This also closes §17e: standing over the pot, the batch shows quantities rather than the
name of a recipe on another screen.

**6. Swatches on the batch become a list.**

Each swatch carries: which recipe, what the result was, what it was on when there is a
substrate, the colour, and photographs. Measured or indicative follows §13dl.

One batch of madder becomes powder, watercolour and pastel, each its own colour — which is
how Ali's chart shows madder, as three swatches, and safflower as „potash on cotton" and
again as „potash on leather", two colours from one recipe.

**7. The list of what a swatch can be is CLOSED for now, and this is a constraint, not a
preference.**

Seeded: dye, pigment, watercolour, pastel, ink, glaze. The owner asked for an open list and
was right to; the application cannot keep one today.

`vocab.js` opens by saying that adding a term is a data change rather than a code change and
that the seeded terms are editable in the `vocabulary` store. Neither half holds:

- **There is no screen for adding a term.** The store is filled on first run and nothing
  writes to it afterwards.
- **`backup.js` skips `vocabulary`.** A term added by any means does not survive a restore —
  at exactly the moment a person believes they have everything back.

So „editable there" was true as an intention and never became true. Not a fault rc46
introduced; nobody had asked until now.

**A vocabulary editor goes on the roadmap after 1.0** (B6a), with the reason recorded: it is
the preferred answer and is deferred only because it needs the backup to change too.
Otherwise a later reader meets „closed list" and concludes it was the design.

### And one thing that is not a defect

**Four seed recipes ship and none of them is for dyeing.** A buyer opens Рецепти in an
application for natural dyeing and finds lake pigment, watercolour, pastels and a
binder. That is item 2 above — which recipes ship — and it is sharper now than when it
was written.

---

## 18. The working view is broken in five ways, found 11 September 2026

Reported by the owner from `bagra-ten.vercel.app` at 1.0.0-rc52, with screenshots, after a
day of trying to work in it. All five are confirmed in the code. **18a is fixed at rc53
(§13dt), 18e at rc54 (§13du), 18f at rc55 (§13dv), 18g and 18h at rc56 (§13dw, §13dx), and
18b, 18c and 18d at rc58 (§13dz). **Every item of 18 is settled.** 18i is open.**

**No data was lost.** Her 11 September backup was read and checked: the lake recipe still
carries its three ingredients and seven steps, and every other recipe is intact. Three of her
own recipes have thin records — „Приготвяне на алуминиев ацетат" with no ingredients,
„Изпиране на целулоза" and „Пигмент от брош" with no steps — but those were last touched in
July and August and are unrelated.

### 18a. The read view guts the record in memory — **SETTLED at rc53 (§13dt)**

> **This entry was wrong about how far the damage went, and the correction matters.** It
> said an Edit-then-Save would persist the emptied recipe. It would not: Edit is a change of
> address, `open()` sets `draft = null`, and the editor reads the recipe afresh from the
> database. Run, not reasoned — after the emptying the editor showed every ingredient and
> step. Nothing on this path writes. It was a screen that destroyed itself in use, not a
> route to losing data. The same path also cleared `appliesTo` and reset `distributable`, in
> memory only. The entry is kept below as written.
>
> Fixed in two places: the `change` branch returns on the record, and `readForm` throws when
> called outside the editor. The guard that missed it sent `input` and never `change`; the new
> one sends both.

`root.onchange`, last branch:

    if (e.target.dataset.scale || e.target.dataset.ing || e.target.dataset.opt) {
      readForm(root);                               // ← unconditional
      const box = root.querySelector('.scaleblock');
      if (box) box.innerHTML = await scaleBlock(...); // ← the guard is only here

`readForm` ends with `draft.ingredients = ings.filter(Boolean)` and does the same for steps.
In the READ view there are no `[data-ing]` elements — the editor has them — so it collects
nothing and **empties both arrays on the draft**. There IS a `data-scale` input on the read
view, so changing the amount fires this branch.

That is the screenshot: type 20 into „Количество суровина", and the weigh list and every step
vanish at once. The guard was placed on the redraw and not on the read.

The damage is in memory only — nothing writes to the database on this path, and navigating
away reloads the record. **But pressing Edit and then Save after this would persist an
emptied recipe.** That is a real route to losing work and it is the reason this is the first
thing to fix.

### 18b. A read view that is also an editor, and neither — **SETTLED at rc58 (§13dz)**

> The second shape was chosen: the record scales and says so. The figure is per recipe and
> per session; the fibre class stays global, because it describes the cloth rather than the
> recipe.

The amount field sits on the record, outside edit mode, and changes as you type. Two readings
are possible and the screen commits to neither: either a recipe is a fixed thing you read, or
it is a calculator you drive. The field also keeps its value when you leave and come back —
`scaleCtx` is module state, shared by every recipe, so a figure entered on one recipe is
still there when the next one opens.

**This is a decision, not a bug**, and it has to be taken before 18c and 18d can be judged.
Three shapes:

- the record is static and any scaling happens in a calculator of its own;
- the record scales, and says so — the field is plainly a control, the recipe's own figures
  stay visible beside the scaled ones, and the value is per recipe rather than global;
- the record scales only for recipes where scaling means something (see 18c).

### 18c. A scaling field on recipes that cannot scale — **SETTLED at rc58 (§13dz)**

> Wider than this entry said: FOUR of the six, including the lake master, whose dyestuff is a
> percentage of an absolute carrier. So the answer is computed — scale twice and compare —
> not listed by basis or by type.

`scaleModeOf` gives „raw" to anything with `scaleBy: 'raw'`. Both madder lake recipes have
`scaleBy: 'raw'` and **every ingredient absolute** — 20 g of root, 2900 ml of water, 10 ml of
alum, 5 ml of chalk — because that is what the books state. So the field is offered, accepts
a number, and nothing below it moves. The owner tried 10 and then 100 and reasonably
concluded the scaling was broken.

Entered at rc50 by me. A recipe whose every line is absolute has nothing to scale BY, and the
field should not be drawn.

### 18d. The caret jumps to the front after the first digit — **SETTLED at rc58 (§13dz)**

> The field is `type="text" inputmode="decimal"` and the `try` is gone. A comma works now too.
> **jsdom does not throw where Chrome does**, so this one is guarded in `screen-check.mjs`,
> typing on a real keyboard.

The redraw restores the caret with `setSelectionRange`, inside a `try` that swallows the
failure — and Chrome **throws** for `input type="number"`. The comment above it says a number
typed digit by digit is unusable otherwise, which is exactly right and exactly what happens.
Two- and three-digit numbers cannot be typed.

The fix is not a better `try`: either the field is not of type `number`, or the redraw does
not touch that input at all.

### 18e. Corrections shipped and never arrived — **SETTLED at rc54 (§13du)**

> **Built, and not as suggested below.** The suggestion compared the record's `packVersion`
> with the shipped one. A record's version moves only when that record is updated, the
> pack's with any change to any record in it — so the test would flag current records for
> ever. The record is compared by CONTENT, through the same `diffPack` the preview uses.
> The note stands on the record in all five modules with a button; the list button counts
> what the preview would tick. The entry is kept as written.

Her records are at mixed pack versions: the lake master at **0.3.0**, the binder at
**0.2.0**, and the two madder recipes at **0.7.0**.

The two madder recipes are NEW records, and `loadPack` adds what is absent at boot, so they
came by themselves. The lake master's figures — the whole of rc48 — are a CHANGE to an
existing record, and a change travels only through „Обнови от библиотеката".

So the dashes she is looking at are rc47's record, and rc48, rc49 and rc50 never reached her.
This is §13dn working exactly as designed and **it is still a fault**, because nothing tells
her there is anything to press. The application knows the record's `packVersion` and the
shipped manifest version and says nothing.

**Suggested:** the record itself says when the library has a newer version of it, beside the
button that fetches it. A stale record is indistinguishable from a broken feature, and she
spent a day on that indistinguishability.

### 18f. Substances that DO exist and were never pointed at — mine — **SETTLED at rc55 (§13dv)**

> Six lines linked: carrier and alkali in all three pigment recipes. **The sauerkraut juice
> is not a substance** — the owner, 11 September 2026: food, not a dye material; it stays in
> the description. Water is treated the same way. Not added: an aluminium sulphate option on
> Stopka's line, because the hydrate is not stated. A guard now asks which shipped line names
> nothing and has not said why.
>
> **Raised by it, and open:** the work view names a line by its option and otherwise shows the
> role. So „помощно 7.5 ml" and „разтворител 2900 ml" remain, and „Калиева стипца 10 ml" on
> the hot lake does not say it is a volume of DISSOLVED alum — the note does, and the weigh
> list does not show notes. Whether it should is a layout decision. See 18h.

The fermentation recipe's lines read „носител", „алкали", „помощно". The owner asked why,
and the answer is not §17a.

**The alum, the soda ash and the chalk are all in the library**, with full records —
`alum_potassium_12`, `soda_ash`, `calcium_carbonate`. When the two madder recipes were
written at rc50 their lines were given a NOTE in prose — „10 г стипца", „10 г калцинирана
сода" — and no `substanceId`. So `nameOf` falls back to the role, exactly as it does for a
substance that is genuinely absent, and the two cases are indistinguishable on screen.

That is a defect I introduced. It is a few lines of seed data: link the carrier and the
alkali in all three pigment recipes — Stopka's carrier is alum and its alkali soda ash;
Green's carrier is alum and its alkali chalk.

**One thing in the fermentation recipe is genuinely absent:** the sauerkraut juice. It is
food rather than a dye material, and whether it should be a substance at all or stay part of
the description is a small question worth asking before answering it by habit.

### 18g. The six new substances — and the workbook was the wrong answer — **SETTLED at rc56 (§13dw)**

> **Seven, not six.** „Chalk was already there, so six, not seven" subtracted chalk from a
> list that never held it; the names below are seven and all seven were written. Categories:
> `binder` for the gums and methylcellulose, `filler` for kaolin, **`auxiliary` for glycerine,
> honey and clove oil** — they neither bind nor fill. Safety fields left empty, as decided
> below. The seven recipe lines now point at them. **Raised by it: 18i**, that a substance
> record has no source field, so „Stopka says" is written in free text.

Gum arabic, glycerine, honey, clove oil, gum tragacanth, methylcellulose, kaolin. (Chalk was
already there, so six, not seven.)

**This was deferred as needing a workbook and that was wrong.** The owner pushed back —
having supplied several recipes, why can nothing be drawn from them — and she is right. The
schema was checked:

    code       26 of 26        formula      19 of 26
    category   26 of 26        typicalUse    8 of 26
    name       26 of 26        handling      4 of 26
                               safetyNote    3 of 26

**Three fields are required.** `safetyNote` appears on three records out of twenty-six.
The claim that a substance record „carries hazard, handling and purpose" was made from
memory and is not what the data says. Nothing was blocked.

What the sources already on hand support, per substance:

- **gum arabic** — binder. Stopka: the commonest binder in watercolour. The owner's own
  recipe: powdered, not liquid, because the powder is what dissolves completely, and more
  powder thickens.
- **honey** — humectant. Stopka, in those words: it attracts moisture so the paint rewets.
- **clove oil** — preservative. Stopka, in those words.
- **glycerine** — plasticiser, keeping the cake from drying hard. From the owner's recipe and
  §13dn, not from Stopka, who does not use it.
- **gum tragacanth** — binder for pastels. Stopka calls it the more traditional binder, which
  she replaces with oat water.
- **methylcellulose** — binder, the alternative to tragacanth. From our own pastel recipe.
- **kaolin** — filler. From our own pastel recipe: more filler, softer and paler pastel.

And one attribute worth a field if ox gall is ever added: Stopka records that it is an
**animal product**, which is why she marks it optional.

**What will NOT be written:** a `safetyNote` for clove oil as a skin sensitiser, or
`handling` for kaolin dust. Both are true and neither is on a page in hand. Thirteen of the
twenty-six existing records carry no such field, so leaving it empty is the normal state and
not a gap.

Open, and it blocks nothing: **if the owner's books state anything about the safety of these
six, it goes in with a citation.** Otherwise the field stays empty, which is honest.

### 18h. The weigh list does not show what a line's note says — **SETTLED at rc56 (§13dx)**

> Built as suggested: the first sentence of a line's note under the line; the note in place of
> the role for a line that names nothing. **Left undone and worth a data pass:** several notes
> restate the name and figure, so a line that needed nothing now carries „20 г смлян корен от
> брош." under „20 g".

**Raised by rc55.** A line names what goes in by its option, and the note beside it — in the
editor — carries what the name cannot: „разтворена", „на буркан", „или алуминиев сулфат",
„суров сок от кисело зеле". The work view's weigh list shows name and amount only. So:

- a line named in prose by decision (the juice, water) reads as its ROLE, „помощно";
- „Калиева стипца 10 ml" does not say it is ten millilitres of a solution, and someone
  weighing could measure ten millilitres of powder.

Suggested shape, not built: under each weigh line, the first sentence of its note in small
muted text; for a line that names nothing, the note in place of the role. A layout change on
the screen read over a pot — it wants a plan and the owner's agreement.

**Not decided. Asked of the owner.**

---

## 18i. A substance record has no source field — **SETTLED at rc59 (§13ea)**

> Widened when the owner raised the compound mordant: Garcia's recipe, adapted by Kelly, and
> Flint teaches something close. `sourceCodes` is now a LIST on recipes and substances, one
> reader for all four callers, and the audit validates the codes — which it had never done for
> a recipe. It found an old fault on the way: the recipe screen printed raw source codes,
> because a seeded source keeps its code only in its id.
>
> **Not built, and deliberately:** who came first. That is a relationship between sources, not
> a field, and it stays in the recipe's note.

**Raised by rc56.** The seven pigment substances each say where the reading comes from —
Stopka for the honey and the clove oil, our own recipes for the kaolin and methylcellulose —
and they say it in the prose of `typicalUse`, because the schema has nowhere else to put it.

Every other reference entity has outgrown this. A combination carries `sourceCodes`, a list
that resolves in the register, protected from deletion by §13ct; a recipe carries
`sourceCode`. A substance carries nothing, so its attribution cannot be listed, checked, or
followed to a book.

**Suggested:** `sourceCodes` on a substance, the same shape as a combination's, with the 26
existing records left as they are — an empty list is the honest state for a record whose
reading nobody wrote down. Small, and it is the same change §11 already made once.

**Not decided. Asked of the owner.**

---

## 19. Restoring an old backup brings back an old library — and two packs can never catch up

**Settled at rc87 (§13fa):** both packs have the button on their Library tab.

**Raised after rc66 by the older-backup restore check** (ROADMAP A7 item 2).

**The fault, found.** Restoring a backup from rc6 puts `seed:natures-rainbow` back with
`kind: 'website'`. The shipped pack has said `site` since the fix recorded in deep-check 24c,
but `modules/library.js` knows only `site`, so the Sources tab prints the key
`sources.kind.website` where a word belongs. The same is true of **every copy installed before
that fix**, restore or no restore, because Sources has no update button (`UNREACHABLE_PACKS`).

**Planned fix, agreed to wait for an audit release:** read `website` as `site` at the point of
drawing. The stored record is not rewritten — migrations add, they do not reinterpret — and
the alias is named in one place with the reason beside it.

**The wider question, NOT decided.** A snapshot restore brings back the library records the
file carried, as they were. After an rc6 restore: 57 plants, 28 combinations, 2 substances,
2 techniques and 1 source differ from the shipped pack. Five of those packs have
„Обнови от библиотеката" and can be brought current by hand. **Sources and the glossary
cannot.** Today that only reaches the owner. After 1.0 it reaches every buyer: a 1.0 backup
restored on 1.1 brings back 1.0's sources and glossary with no way forward.

Ways out, roughly by weight:
- Leave it; the update button for the Library is B7.
- On restore, do not bring back seed records the person never edited (`editedByUser: false`)
  — let the start seed them fresh. Changes what „snapshot" means for the library half.
- Build the Library's update button before 1.1 (B7 pulled forward).

**Not decided. Asked of the owner.**

---

## 20. A source's name is one string, and three of them want two languages

**Settled at rc72** (§13em): shape A — `name` and `author` are `{bg, en}` on all 57, read through `text()`
so older string records still work.

**Raised by the language package, step 2 (rc68).** The owner decided: „Практиката на ателието"
reads „Crafty Place studio practice" in English, and „Еко принт библиотека — преглед на 25
растения" reads „Eco-print reference: a review of 25 plants" if it is a descriptive name rather
than a title; „НАТУРАЛНИ БАГРИЛА — ръководство" keeps its title.

`name` on a source record is a plain string. Every other named reference entity carries `{bg, en}`.
So the decision cannot be written down without a change of structure — which is why nothing was
done.

**Two shapes:**

- **A. `name` becomes a pair on every source.** 57 records: the 54 with a Latin-script name get
  the same text in both halves, the three get their two. One reader (`modules/library.js` and
  wherever a source name is printed — the combination, recipe and substance screens), one
  migration for sources a person added herself, and the fingerprint moves on all 57. Consistent
  with the rest of the model.
- **B. An optional `nameEn` beside `name`.** Three records change, the readers take `nameEn` in
  English when it is there. Smaller; it is also a second way of being bilingual, which is the kind
  of thing that later decides differently from the first.

**Recommended: A**, in its own small release, because a citation's title and its translation are
the same fact in two languages and the model already has one shape for that. **Also asked:** is
„Еко принт библиотека — преглед на 25 растения" the title of a document, or a description of one?

**Not decided. Asked of the owner.**

---

## 21. Woad's temperatures: the prose is right and the part record is not — a proposal, not applied

**Settled at rc74** (§13eo): `tempDyeC` 45–50 °C, `softMaxTempC` 55 °C; `tempExtractC` unchanged.

**Raised by the scientific audit, package 1 (rc73).** `isatis_tinctoria` leaf: `tempExtractC` 70–80 °C,
`tempDyeC` min 80 °C, `softMaxTempC` 85 °C. The plant's prose: the leaves are covered with hot water, the
bath is cooled, and from there above 55 °C it is spoiled.

**What the sources say** (docs/science/rc73-package-1.md, S16–S18): the leaves are steeped in water at
about 80–90 °C; the extract is cooled, alkali is added below about 50 °C, and the vat is kept at no more
than about 50 °C while dyeing. So there are two stages, and the part record puts the extraction figure in
the dyeing field: `tempDyeC` min 80 °C and a ceiling of 85 °C describe steeping the leaves, not the vat.

**Proposed, for approval:** `tempExtractC` stays 70–80 °C (the sources say up to 90 °C; not widened without
a decision); `tempDyeC` about 45–50 °C; `softMaxTempC` 55 °C, matching the prose. Nothing was changed.
Until then the *use now* tile shows 80 °C for dyeing with woad. **Asked of the owner.**

---

## 22. Ferrous sulfate: the 2% ceiling is conservative, and one recipe goes past it

**Settled at rc74** (§13eo): 2% stays as the conservative ceiling; the recipe keeps its published 2.5% with an explicit warning.

**Raised by package 1 (rc73).** `iron_sulfate.maxPercentWof` is 2; the recipe `iron-bath-dark` allows up to
2.5%; the old texts said fibre becomes brittle above 2%.

**Sources:** Maiwa gives 2–4% WOF, with higher rates possibly damaging fibre and care on protein fibres (S3);
CAMEO says excess exposure leaves wool stiff and harsh (S4). No source found gives 2% as a threshold of damage.

**Done:** every categorical „above 2% it embrittles" was replaced by a conditional statement — higher
concentrations and longer exposure can make fibres, especially wool and silk, harsh and brittle. **Not done:**
no number moved. The recipe's 2.5% is the published recipe's figure (Alison Kelly) and sits inside Maiwa's
range; the substance's 2% is below it.

**For decision:** keep 2 as a deliberately conservative ceiling (and then the recipe's 2.5% needs a note, or
its range capped at 2), or raise the ceiling. The calculators read `maxPercentWof`, so raising it changes a
warning a person sees. **Asked of the owner.**

---

## 23. The madder fermentation recipe — proposed for temporary withdrawal

**Settled at rc74** (§13eo): withdrawn from the pack through the existing withdrawal path, archived whole; a withdrawal no longer removes a record the person's work uses.

**Raised by package 1 (rc73).** Two instructions were unsafe as written and are corrected: five minutes in
boiling water was presented as killing mould spores (now: it reduces surface microbes and is not
sterilisation), and visible mould was to be scraped off and the ferment continued (now: stop and discard).

What remains unverified is the process itself — a two-week open ferment seeded with raw sauerkraut juice,
judged by smell and pH. No source for its safety was checked in this package.

**Proposed:** take the recipe out of the distributed library until the technology and its safety are checked.
**Not done, and why:** the only existing field, `distributable: false`, is shown on the record as a fact and
hides nothing — it does not keep a recipe out of the shipped pack. Withdrawing it needs either removing the
record from `seed/recipes.json` (an installed copy keeps it; the pack's withdrawn list offers its removal) or
a new mechanism, and the owner asked for neither to be introduced without approval. **Asked of the owner.**

---

## 24. The oat or bran bath — storage and reuse are the recipe's, not verified

**Settled at rc74** (§13eo): the three-day period removed; reuse described as not guaranteed safe.

**Raised by package 1 (rc73).** The claim that the bath „strengthens the bond of the metallic salts with the
fibre" was replaced by a neutral description: it rinses unbound mordant off the surface (S14). The storage —
reusable for up to three days, covered and cool — is now attributed to the recipe. Botanical Colors reuses
bran baths several times (S15) but gives no period. **Open:** whether three days is a safe limit, and whether
oats and bran behave the same. No figure changed.

---

## 25. Open after scientific package 2 (rc76)

**Items 1–3 settled at rc77** (§13er). Item 4 settled at rc78 (§13es): tannin level marked unknown.

1. **Fastness ratings without a source.** Walnut, cutch, pomegranate and eucalyptus carry `lightfastness`
   and `washfastness` = `excellent`, with confidence `practice` and no cited source. CAMEO supports cutch
   (good retention through washing and light); nothing found supports the others at that level across fibres
   and mordants. **Proposed:** keep the ratings and mark them for sourcing, or lower the confidence to
   `unverified` where no source is found. No rating was changed.
2. **The substantive/adjective definition.** The glossary's English names indigo among substantive dyes, the
   Bulgarian does not. Indigo is a vat dye; AATCC (in the register) uses it as the substantive example, most
   dyers' sources treat it as its own class. **Proposed:** remove indigo from the English, or name it as a vat
   dye in both.
3. **Sumac's dose in prose.** „As a tannin the leaves go in at around 10–20%" is not in the part's dosing.
   **Proposed:** move it into `dosing` with a source, or remove the figure from the prose.
4. **Brazilwood heartwood chemistry.** Recorded as `tannin: high`; the colorant is brazilin (a homoisoflavonoid)
   (S21, S22). **Proposed:** a chemistry review in the next data package, not a guess here.

---

## 26. `madder-lake-hot` is incomplete — ship it or withdraw it

**Settled at rc79** (§13et): withdrawn through the existing path, archived whole, kept for anyone whose work uses it.

**Raised at rc78** (§13es). The recipe gives 10 ml of alum solution and 5 ml of chalk in water per jar, and
neither the concentration of the solution nor the amount of chalk. The text now says the quantities cannot be
reproduced exactly. **Proposed:** withdraw it from the pack through the existing path (as the fermentation recipe
at rc74) until the source book is checked; the record would be archived whole and kept for anyone whose work uses
it. **Asked of the owner.**

---

## 27. Titanium oxalate: 2% WOF against 8–10%

**Settled at rc79** (§13et): 2% stays, the record names the source it follows and the range other suppliers give. No number and no calculator changed.

**Raised at rc78** (§13es). `titanium_oxalate.standardPercentWof` is 2. Maiwa gives 8–10% WOF; Wild Colours uses
5–15 g per 100 g of fibre. The calculators read this field, so a person scaling a titanium bath from the library
gets a quarter of what those suppliers use. No source for 2% was found in the record. **Not changed** — a
number is not replaced by assumption. **Asked of the owner:** which figure, and on which source. Until then this is
the one concrete scientific contradiction left open.


---

## 28. Attribution package 1 (rc80) — four questions for the owner

**Raised by §13eu.** Nothing below was applied.

**a. `distributable` on the three pastes.** `mordant-print-paste`, `dye-print-paste` and `dye-mordant-print-paste`
carry no value, which the pack reads as `true`. The texts are now in the library's own words and cite Cliffe (and
Maiwa for the mordant paste), but that is not a decision to distribute. **Asked:** set `true`, set `false`, or
leave the default. The two pastel binders are the same case and were not looked at.

**b. Does Kelly's attribution to Garcia cover the oat bath?** The bath now says only that it is Kelly's, as part
of the compound mordant procedure. If her text attributes the whole procedure to Garcia, the bath's note should
say so in the same form as the two mordants.

**c. Garcia's code left the three recipes.** A code in `sourceCodes` says Bagra drew on that source; it did not
draw on Garcia. If the owner wants his name visible as a link on the recipe screen rather than only in the note,
it is one line per recipe to put back — and then his register note is what carries the qualification.

**d. Boutrup & Ellis.** Linked to no recipe. If one of the eight follows their book closely enough to cite — the
paste chapter, or the bran bath after aluminium acetate — the owner has the book and can say which, with the page.

**Not decided. Asked of the owner.**

---

## 29. Attribution closing package (rc81) — what the owner decides

**Raised by §13ev.** Nothing below was applied.

**a. `distributable` on five records — proposal.** None carries a value, which the pack reads as `true`. §13.1
keeps the opt-out for two cases: verbatim wording, or a named authored system. None of the five is either, as far
as could be judged without the pages. Proposed, for the owner to confirm:

| record | proposed | why |
|---|---|---|
| `mordant-print-paste` | `true` | own words (§13eu), Cliffe and Maiwa cited, the same figures in both |
| `dye-print-paste` | `true` | own words, Cliffe cited, the clean-ground promise and the keeping time qualified |
| `dye-mordant-print-paste` | `true` | own words, Cliffe cited |
| `pastel-binder-oat` | `true` | complete — quantities and steps — and attributed as a formula Stopka presents |
| `pastel-binder-gum` | `true`, as guidance | no quantities, now said so; it is an option of `pastels-from-pigment`, so marking it `false` would leave a published pastel recipe offering a binder the pack does not carry |

Condition on the three pastes: the owner's own comparison with Cliffe's pages, which this audit did not have.

**b. „Овесени ядки" / „oat groats".** This is the name of the substance `seed:oats`, shared by the pastel binder
and Kelly's oat bath. In Bulgarian usage „овесени ядки" is usually rolled oats; „groats" are whole kernels. Which
one Stopka (and Kelly) mean could not be confirmed, so nothing was changed.

**c. Who stands behind `pastel-binder-gum`.** It cites the studio's practice only. The substance records say gum
tragacanth as a pastel binder is Stopka's (`gum_tragacanth`) and methylcellulose is the studio's
(`methylcellulose`). If the recipe draws on Stopka for the tragacanth half, it should cite her; not added on
inference.

**d. Which part of `watercolour-binder` is the studio's.** It cites Green and the studio. Nothing in the record says
what the studio adapted. Either a sentence saying so, or the studio code comes off.

**e. Thinning with alcohol.** Removed from `watercolour-binder`. If Green gives it, it can return with that source.

**f. „варова баня" elsewhere.** Still in `seed/substances.json` — aluminium acetate's note — outside this package.

**Not decided. Asked of the owner.**

---

## 30. The five recipes, and what still needs the owner (rc82)

**Raised by §13ew.** Nothing below was applied.

**a. Publication is controlled by the seed file, not by `distributable`.** Every row in `seed/recipes.json` ships to
every installation; a missing value is read as `true`, and even `false` would ship. **Proposed, minimal:** a release
layer that fails when a shipped recipe carries no explicit `distributable: true` — so an unapproved record cannot
leave in a release, and a record kept private is simply not in the seed. On today's data it fails on exactly the
five below, which is the point; so it goes in together with the owner's answers. Techniques carry no explicit value
on any of 21 and would need the same decision before the layer covers them. (`db.js` has a comment saying the
default is `false`; the code sets `true`. The comment is wrong.)

For each of the five, in `docs/attribution/rc82-five-for-approval.md`: **publish, keep unpublished (removed from the
seed, kept on her own copy), or correct.**

**b. `watercolour-binder`: what would restore the studio's code.** Either (1) what differs from Green's version —
which ingredient or step, by how much — and whether it is what Bagra should show; then one sentence in the recipe
says so and the code goes back; or (2) confirmation that Bagra shows Green's version as printed, and the code stays
off. The formula itself is not changed either way unless she says so.

**c. `pastel-binder-oat`: which oats.** The form Stopka names, with the page.

**d. Found, not requested.** „Варовата баня" is still in `calcium_carbonate`'s typical use (`seed/substances.json`)
and „варова баня" in the finishing text of the tools screen (`i18n.js`, `tools.finishing`). Same fix; one decision.
And `methylcellulose` says it comes „from the Crafty Place pastel recipe" — which, with §13ew, presents an untried
method as the studio's.

**Not decided. Asked of the owner.**

---

## 31. Taking `pastel-binder-gum` out of the published pack (rc83)

**Settled at rc84 (§13ey), as proposed below.**

**Blocked by one dependency.** `pastels-from-pigment` (published) offers two binders: the oat binder and this one
(`past-b-gum`). Remove the gum binder alone and the published pastel recipe shows „—" as a binder choice on every
new installation, silently — no check sees it (§13ex).

**Minimal safe exclusion, proposed:**
1. Remove the one option `past-b-gum` from `pastels-from-pigment`; the oat binder stays as its only binder.
2. Move the record, whole, to `archive/withdrawn/recipes-pastel-binder-gum.json` with a line in `archive/README.md`,
   as madder-lake-hot was (§13et) — so it can come back.
3. Remove its excused line from `scripts/try-recipe-lines-named.mjs`; raise the recipes pack.

**Her records are safe.** User work points at a recipe by `recipeId`, not at an option. On an installed copy the
update OFFERS the withdrawal (§13cb) as a tick-box, and a record her own work points at is not removed (§13eo). Her
own recipes are untouched.

Needs one permission: to change `pastels-from-pigment` by that one option.

**§30a** (a release layer that fails on a shipped recipe with no explicit `distributable: true`) is still proposed,
not built; after this, it would fail on `pastel-binder-gum` alone. **§30c** (the oat form at Stopka) is open.
The English name „Oat groats" can only change by renaming `seed:oats` (§13ex).

---

## 32. The paste category holds more than printing pastes (rc85)

**Settled at rc86: option A, with the label „бои, пасти и свързващи вещества".**

Asked: move `mordant-print-paste` into the paste category and call it „Пасти за печат / Printing pastes". Not done,
because `paste` („багрилна паста") also holds `watercolour-from-pigment`, `pastels-from-pigment`,
`watercolour-binder` and `pastel-binder-oat`. Renamed as asked, four non-printing recipes would read as printing
pastes; moved without the rename, the mordant paste would sit under „багрилна паста", which is the claim being
removed.

Two further effects of the move, neither blocking: the type `paste` hides the fibre panel (`MAKES_SUBSTANCE`), as it
already does for the other two pastes; and the batch action „mordanting" offers only recipes of type `mordant`, so
the mordant paste would leave that picker — arguably right, since it is printed, not a whole-cloth bath. Her records
point at recipes by id and are unaffected either way.

**Options, for the owner:**
- **A.** Neutral label „Пасти / Pastes" on `paste`, then move the mordant paste. One label, one field.
- **B.** „Пасти за печат / Printing pastes" for the three print pastes, and the watercolour, pastel and binder
  recipes in a category of their own — a new category code and four recipes' `type`.

---

## 33. The release gate fails at rc104, before the pigments package touched anything (rc105)

Found when `sh check.sh --release` was run on the rc104 ZIP as it arrived, as a baseline. The
run stops at the first failure, so the CI job on `main` has most likely been red since rc100.
None of the four is in the pigments, and rc105 deliberately leaves all four alone so that it
stays one change. Every other layer passes when run on its own, on rc104 and on rc105 alike.

1. **Two headings `## 15.` in the specification** — „Visual identity and naming" and the rc100
   seed-recipe section. Layer 1c stops the run here. `.spec-sections` also lists `## 15.`
   twice. Either heading can be renamed; §15.3 (visual identity) and §15, §15a–§15d (rc100
   onward) are both cited, so the choice decides which citations change.
2. **`check-scope.js` misreads `modules/recipes.js`.** The regex literal in `typeOptions`
   contains double quotes; the checker strips string literals by their quotes and does not
   know regex syntax, so it reads the rest of the file as one string and reports five declared
   names — `draft`, `openId`, `filterType`, `query`, `favOnly` — as undeclared. Present at
   rc101 already. A one-line fix: build that regex with `new RegExp('…')`; checked to give the
   identical pattern.
3. **`try-pack-field-labels`** — `chains` has no field dictionary at all (chains became a pack
   at rc100), and `recipes.origin`, `liquorRatio`, `vinegarPercent`, `defaultLitres` have no
   label, so the pack preview would print the raw field name.
4. **`check-boot.mjs` looks for `#sidebar .navitem`.** The redesign moved navigation into
   `#topbar` with space and module buttons, so the boot check reports „navigation is empty".
   Its orphan check also assumes one sidebar holding every entry, which the two-row bar does
   not.

**Recommended:** one small package for these four and nothing else, before 1.0 — a release
gate that has been red for five releases is a gate nobody is reading. **Asked of the owner.**

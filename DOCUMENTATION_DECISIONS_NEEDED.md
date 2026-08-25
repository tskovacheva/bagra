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

**What is left to decide.** Should such a plant appear in the seasonal panel at all? It
currently does not: the months live on the part and it has none. That is defensible and it
is also the kind of silence that reads as a bug from the outside. The guard states the
present behaviour so a change to it has to be deliberate.

---

## 2. Which recipes ship

**ROADMAP, before this audit.** „The studio database holds eight recipes and two chains;
the shipped seed holds none. A buyer opening the app finds an empty recipe module."

**Code.** `seed/recipes.json` holds three.

**Suggested.** The stale claim has been corrected in the roadmap. What remains is the
decision it was pointing at: **three is not a recipe library.** Which of the studio's
recipes are fit to distribute — and whether a recipe of the owner's own is reference
material or personal work — has not been settled. Left in A1.

---

## 3. The phone navigation bar

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

**Suggested.** Leave it alone for the audit ahead. A reviewer being asked to judge
commercial readiness benefits from the fault record sitting next to the decision it
corrected. Revisit after.

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

**Recommended: `learnedFrom` becomes a list of source codes.** Small — a seed field and one
render — and it also turns free-text attribution into codes that resolve in the register,
which §13ct already protects from deletion. The thirteen new sources are registered and
currently cited by nothing, which is why nothing yet points at them.

**Also open:** whether a source code should attach to the CLAIM rather than the record —
„this source is why the fibre says cellulose" — which is the fuller answer and a much larger
one. Recommend the list first.

---

## 12. „How does it differ" has three candidate homes and no chosen one

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

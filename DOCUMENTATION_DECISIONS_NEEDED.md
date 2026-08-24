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

**What needs deciding.** Whether rc30 is these two and nothing else — which would keep the
discipline of this release and make it as easy to regression-test — or whether they ride
along with the next piece of real work.

**Suggested.** rc30 is the two, on its own. The last time layout faults were bundled with
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

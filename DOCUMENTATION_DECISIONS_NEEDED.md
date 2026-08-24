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

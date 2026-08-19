# Багра / Rubia — Functional Specification

*Natural dye and eco print notebook, by Crafty Place*

**Status:** v1.26 — the plant profile, specified (not yet built)
**Scope:** Functional modules, data model and technical architecture.

---

## 1. Purpose and positioning

A record-keeping and **reference** application for natural dyeing and eco printing.

The distinguishing goal is that the app must **answer questions**, not merely store history:

- What can I expect from oak leaves on cotton with aluminium acetate?
- What colour will I get if I pre-treat this fabric with a given tannin?
- What result should I expect from a blanket soaked in 1% iron solution?

This makes the app a **knowledge base with a personal experience layer on top**, rather than a diary
with search. Every design decision below follows from that.

### 1.1 Two kinds of information

| | Knowledge | Experience |
|---|---|---|
| Source | Literature, courses, other practitioners | The user's own work |
| Truth value | Generally accepted, not personally verified | Verified, but specific to one setup |
| Example | "Oak leaves + cotton + alum acetate → grey-brown print" | "12 May: oak on cotton, alum acetate — came out greener than expected" |

**Decision:** these are not two separate modules. They are one **Combination** record (knowledge) with
**Trials** (experience) attached to it. Over time the personal layer refines the general one — the value
compounds, because the resulting reference reflects the user's own water, fabrics and local plants.

### 1.2 Product ambition

Unlike Глина (an explicitly personal tool), this app is a **candidate for public release**, since no
comparable product exists. This changes several early decisions:

- **Bilingual (BG/EN) from the start** — not retrofitted. All user-facing strings go through a
  dictionary; all stored values use stable language-neutral codes.
- Reference data (plants, mordants, standard recipes) must be **seedable** — a new user should
  receive a useful starting library, not an empty app.
- Personal data and seeded reference data must be **distinguishable** in the model.
- Schema versioning and clean export/import matter more than they did for Глина.

Offline-first remains a hard requirement.

### 1.3 Seed-first, not empty-first

The app ships **loaded**, not blank. Plant data and the great majority of recipes already exist in
published literature and established practice; none of it needs to be reinvented. The user starts
from a working reference library and modifies it as her own experience accumulates.

This reverses the usual order of use:

1. **Day one** — the library is already useful. She can look up a plant, a mordant recipe, an
   aluminium acetate preparation, and start working.
2. **Later** — her own trials attach to the seeded combinations, refining and sometimes
   contradicting them.
3. **Ongoing** — newly discovered recipes arrive as reference packs (§10), or are entered by hand.

Consequences for the build:
- The reference library is a **deliverable in its own right**, not a by-product. Compiling it is
  real work and should be planned as such, in parallel with the code.
- Every seeded record needs a **source attribution** field. For a public release this matters
  beyond good manners: factual data about plants is not protected, but a recipe copied verbatim
  from a book is someone's text. Seeded recipes must be written as procedures in the app's own
  words with the source credited, not pasted.
- Seeded records must be marked as such and stay distinguishable from her own edits (§10).
- Seeded entries are authored in whichever language comes naturally; the paired field structure is
  present from the first record, but filling the second language is deferred to a bulk translation
  pass before publication, and only for records marked distributable (§13.1).

---

## 2. Module overview

| # | Module | Nature |
|---|---|---|
| A | Materials | Inventory + properties |
| B | Plant Library | Reference |
| C | Recipes | Procedures |
| D | Techniques (decoration) | Reference vocabulary |
| E | Combinations | **Knowledge core — the reference engine** |
| F | Trials | Experience log / gallery |
| G | Library & Tools | Calculators, backup, guides |

---

## 3. Module A — Materials

One module, several categories. Each category has shared fields plus its own.

### Shared fields
Name, category, supplier/source, acquisition date, quantity/stock, notes, photo.

### A.1 Fabrics / Fibres

A fabric record is **one physical piece**, not a fabric type. A reclaimed t-shirt is unique and
single-use; a bought roll of crepe is a length that gets consumed. The record must describe the
individual object, because two pieces of "cotton" can behave entirely differently.

#### Identity
- **Origin:** new (with supplier and purchase date) or reclaimed (what it was, condition, prior use)
- **Form:** garment / scarf / cut piece / roll — this determines the unit of quantity
- **Quantity:** count for garments and scarves, length or area for yardage; consumed as it is used
- **Dimensions and weight** — weight is needed for every % WOF calculation, so it is a real field,
  not a note

#### Composition — structured, not free text
A list of fibre shares totalling 100%: e.g. 99% cotton + 1% elastane, or 50% cotton + 50% linen.
Stored as pairs (fibre, percentage), never as a label.

This matters because synthetic content does not take natural dye. The app derives from the
composition:
- the **dye-receptive fraction**, used to qualify % WOF calculations and expected saturation
- the **fibre class** (cellulose / protein / mixed / part-synthetic), which decides the whole
  mordanting route and which reference results apply (§7)

A mixed cellulose-protein cloth is a case of its own: the two fractions take mordant and colour
differently, and the app should flag it rather than pretend one route fits.

#### Structure
Weave or knit type — plain weave, crepe, jersey/knit, twill, gauze, velvet — plus weight (g/m²).
Structure changes how sharply an eco print registers, so it belongs in the combination identity.

#### Treatment state — a lifecycle, not a field
The user physically sorts fabric into boxes by treatment state, and the app mirrors exactly that:

`unwashed → scoured → mordanted → dyed / printed → finished`

**Revised in §13bd.** There were six states and `tannin-treated` was one of them. It is not a box:
tannin on cellulose is a *route*, an alternative to aluminium acetate, and a tanned piece may go to
an eco print, to a paste print, wait for alum, or be finished as it is. It is now an action the
piece carries, shown as a label beside the box. Nothing had ever been written with the old state.

A transition is one of the **actions** in §13bd, and only four of the ten move a piece between
boxes. Each is an event with a date and a link to the recipe used. Dates matter: mordanted cloth
benefits from curing, and knowing when it was mordanted is part of reading the result.
Pieces may skip states (a mordant is not always preceded by tannin).

Filtering by state gives a live inventory of the boxes — "what is in the mordanted box" is a query,
not a memory exercise.

#### Physical labelling
Each piece gets a short human-writable code (e.g. `П-042`) generated by the app, intended to be
written on a tag and pinned to the cloth. **The number is reserved on save, never on opening the
form.** Opening the new-fabric form three times and saving once must yield one code, not a gap of
three. A sequence with holes in it is a small thing that quietly erodes trust in the record. The tag carries only the code; composition, treatment
history and dates stay in the app. No barcodes or QR — a pinned paper tag survives a steam bath
and a wash better than anything scannable.

#### Other fields
Colour (natural / bleached / already dyed / previously dyed by her), behaviour notes
(shrinkage, how it takes colour), photo.

### A.2 Dyestuffs
Three sub-forms of the same thing:
- **Extract** (concentrated, purchased) — concentration, manufacturer
- **Dried plant material** — part used, harvest date, storage
- **Fresh plant material** — part used, harvest date, seasonal state

All three link to a **Plant Library** entry (B) for the botanical background.

### A.3 Tannins
Tannin type (gallotannin, ellagitannin, condensed/catechol), source (gall nut, oak, myrobalan,
sumac, pomegranate…), colour cast (clear / yellowing / darkening). Tannins act both as mordant
assistants on cellulose and as dyes in their own right — the model must allow both roles.

### A.4 Mordants
Alum (potassium, aluminium acetate), iron, copper, tin, symplocos, etc.
Fields: standard working concentration (% WOF), which fibre classes it suits, colour effect
(brightening / saddening / darkening), safety notes.

### A.5 pH modifiers & assistants
Soda ash, vinegar, citric acid, lime, cream of tartar, calcium carbonate, etc.
Fields: acid/alkaline, typical use, effect on specific dye classes (anthocyanins shift dramatically;
tannins darken in alkali, etc.).

---

## 4. Module B — Plant Library

A large reference body, kept separate from Materials because a plant is knowledge, while a material
is a physical thing on a shelf. A single plant entry may back several material records
(fresh leaves, dried leaves, purchased extract).

### Fields
- Common name (BG/EN), botanical name
- **Parts used:** leaves, bark, roots, flowers, fruit, hulls, galls — each part may behave differently
- **Chemistry:** a **fixed vocabulary** of constituent classes, each with a level
  (trace / moderate / high / dominant) and an optional note.

  The vocabulary — tannins (with subtype: gallotannin, ellagitannin, condensed), anthocyanins,
  flavonoids, quinones, carotenoids, indigoids, betalains, alkaloids, and any further class added
  deliberately as a schema change, never ad hoc by the user.

  Fixed rather than free tags because the reference engine depends on it: only a controlled
  vocabulary supports queries such as *"all high-tannin plants that grow locally"* or *"which
  anthocyanin plants shift most under alkali"*. Free tags fragment on spelling and language and
  make such questions unanswerable. Since the app is bilingual, each class is stored as a stable
  code and rendered per language.
- **Role:** dye plant / eco print plant / both / mordant plant (accumulators)
- **Compositional role** — eco print specific, and absent from most references: is this plant a
  *shape printer* (a clear silhouette with vein detail), a *texture or background filler* (used in
  quantity behind stronger printers), or a *resist* (horsetail's silica leaves a ghost rather than
  a print). This is how a bundle is actually composed, and it is not derivable from tannin level
- **Preferred surface** — some plants print more crisply from the leaf underside than the upper
  side. Where known, the library records it, and the trial's `facing` field can be prefilled from it
- **Preparation before bundling** — plant-specific handling that materially changes the result:
  eucalyptus soaked for hours (sometimes with a splash of vinegar) before it will give colour, oak
  pressed flat if it curls, robinia bundled quickly before its edges dry. This is practical
  knowledge that exists nowhere in a chemistry field and is exactly what the user needs at the table
- **Steaming tendency** — some plants need markedly longer than the 60–120 minute norm; acacia and
  eucalyptus want 90 minutes or more. Recorded as a tendency, not a rule
- **Identification note** — what the plant looks like and where it is encountered. A reference the
  user consults while out walking has to help her recognise the plant, not only look it up
- **Distribution / native range**

#### Cultivation — a block the model originally lacked
The owner grows dye plants rather than only foraging them, and her own guide organises every
profile around growing as much as around dyeing. Reference material that stops at chemistry is
useless in the garden, so a plant carries:

- **Agronomy** — light, soil structure, watering, soil pH (madder wants alkaline, limey ground at
  pH 7–8; getting this wrong means no dye at all, three years later)
- **Propagation** — from seed, from rhizome division, when to sow
- **Care and maintenance**
- **Pests and diseases**, and any invasiveness warning — madder needs its own bed or a deep raised
  one, which is a planting decision, not a footnote
- **Years to maturity** — madder roots only begin accumulating dye after two or three years. A
  reference that omits this invites a wasted season

#### Harvest and processing
Distinct from *preparation before bundling*, which is an eco print concern. This is what happens
between the garden and the jar: when to lift or cut, washing, drying time and conditions, cutting
or crushing, storage.

- **Drying ratio** — drying reduces madder root roughly sixfold. Any recipe written for dry
  material must be rescaled when fresh material is used, so this is a number the calculators need,
  not a remark

#### Dosing and temperature — structured, because the calculators read them
- **% WOF guidance per part and per condition** — madder root at 50–100% WOF dried, 200–300%
  fresh. One figure per plant would be wrong twice over
- **Extraction temperature** and **dyeing temperature** as separate ranges (madder: 60–75 °C and
  60–70 °C)
- **Hard ceiling** — some dyes are destroyed by boiling. Recorded as `maxTempC` so a trial step
  above it can be flagged, in the same way as titanium oxalate on the mordant side
- Seasonality — when to harvest, how the season changes the result
- Substantivity — does it need a mordant, or is it substantive
- Lightfastness / washfastness notes
- Toxicity and handling warnings
- Local availability (grows at Crafty Place / foraged locally / must be bought)
- Free-text observations
- Photo

Plants can be seeded from established reference sources and extended by the user.

---

## 5. Module C — Recipes

A recipe is a **procedure with proportions**, reusable across trials. Recipe types:

1. **Scouring / preparation** — how the fibre is cleaned before anything else
2. **Tannin treatment** — % WOF, temperature, time, order relative to mordanting
3. **Mordanting** — substance, % WOF, temperature, time, fibre class it applies to
4. **Dyeing** — with a specific dye source; ratio of dyestuff to fibre, temperature, time, pH
5. **Eco print** — bundling method, blanket type, plant placement, steaming/boiling, time, pressure
6. **Pigment making** — precipitation/lake-making from a dye bath
7. **Dye paste** — thickener, binder, proportions, for printing
8. **Blanket** — the cloth laid against the bundle, prepared as either a *dye blanket* (soaked in a
   dye or extract) or a *mordant blanket* (soaked in a mordant solution, e.g. 1% iron). A blanket is
   a recipe, not a field on the trial: it has a formula, a concentration and a method, it is reused
   across many bundles, and its exact make-up is one of the strongest determinants of the result.
   A blanket may also be reused while still loaded from a previous bundle — the recipe therefore
   records whether it is freshly prepared or carried over, and how many uses it has had

### Shared fields
Name, type, ingredients (roles filled by substances, with quantity ranges), steps, temperature,
applicable fibre classes, source (own / book / course — with attribution), notes.

**Duration is two figures, not one.** `heldMinutes` is the time at temperature; `restMinutes` the
time steeping after the heat is switched off. A tannin bath heated to 60–70 °C and then left to
cool for one to two hours is not a ninety-minute bath, and collapsing the two loses the part that
most often decides the result. The same split already exists on trial steps (§8.3).

### 5.1 Ingredient roles and substitution

**A role may be filled by interchangeable substances, each with its own quantity.** A tannin bath
is one recipe, not three: gallnut at 8–10% WOF gives a colourless ground, myrobalan at 20% a yellow
one, cutch at 20% a red-brown one. Modelled as a list of options on the ingredient, the advice
"substitute sumac if you want a neutral ground" stops being a note the user must read and apply
mentally, and becomes a choice in the interface — and, later, the difference between two distinct
combinations in the reference (§7).

`RecipeIngredient.options: [ { id, substanceId, qtyMin, qtyMax, note {bg,en} } ]`

**Quantities are ranges.** Sources give ranges far more often than single figures — 8–10% tannin,
12–15% alum on wool, 50–100% dried madder root. A field holding one number forces the user to throw
away half of what the source said. A single figure is the degenerate case where min equals max.

**Two substances used together are two ingredients, not two options.** The distinction must be
unmistakable in the interface: options replace one another, ingredients accumulate.


Real recipes are written against roles, not against specific products. "Aluminium source" may be
potassium alum, ammonium alum, or aluminium sulfate in any of four hydration states — and the
choice changes the quantities of *other* ingredients: anhydrous aluminium sulfate needs roughly
twice the soda and acid of the 18-hydrate form, gram for gram.

This has three consequences:

1. **Materials need chemical identity, not just a name.** A mordant or assistant carries
   `formula`, `hydrationState`, `molarMass` and, for liquids, `concentrationPercent` (vinegar
   ranges from 5% to 25%). Without these the substitution arithmetic is impossible.
2. **Substitution can remove a line.** Choosing sodium acetate as the sodium source removes the
   acid step entirely — the conversion has already happened. A recipe is therefore not a fixed list
   of ingredients but a set of roles resolved at scaling time.
3. **A recipe may carry more than one method** with genuinely different arithmetic. A full
   immersion bath doses by weight of fibre; a saturated soak — fibre soaked, wrung and dried in one
   pass — doses by concentration in g/L, because there is no repeat dip to build up mordant. Same
   recipe, two methods, two bases. `RecipeMethod` = `{ code, basis, defaults, note {bg,en} }`.

### 5.2 Conditional ingredients

An ingredient may apply only to certain fibres. Cream of tartar is required when mordanting wool
with alum and pointless on cotton; a recipe that lists it unconditionally is wrong half the time,
and one that omits it is wrong the other half.

`RecipeIngredient` therefore carries `whenFibreClass: [code] | null`. When a recipe is scaled
against a specific fabric, ingredients whose condition does not match are dropped from the result
rather than shown greyed out — the output should be the list to weigh, not a list to filter mentally.

### 5.3 Recipe chains — the preparation sequence

Cellulose needs three separate processes before it can be dyed: scour, tannin, mordant. Each is its
own recipe, but they are always run as a sequence against **one** weight of goods, and doing the
arithmetic three times by hand is where errors enter.

A **Chain** is an ordered list of recipe references scaled together from a single weight:

```
Chain
  id, name {bg,en}, appliesTo [fibreClassCode]
  steps [ { order, recipeId, note } ]
  sourceRef, distributable
```

Entering one weight yields the full shopping list for the whole preparation, in order, with each
recipe's own ingredients scaled and conditional ones resolved against that fabric. This is the
"wizard" idea, but modelled as data rather than as a hard-coded screen — new chains can be added
without touching code, and a chain is itself shippable in a reference pack.

`requiredFollowOn` (§5.4) remains distinct: a chain is a plan the user assembles, a follow-on is a
step the recipe cannot be correct without.

### 5.4 Required follow-on steps

Some recipes are incomplete without a step that is not optional and not part of the main
procedure — an aluminium acetate mordant requires a chalk or bran finishing bath afterwards, which
binds the mordant to the fibre rather than merely adjusting pH. Modelled as
`requiredFollowOn: [recipeId]`, surfaced in the UI as part of the recipe rather than as advice, and
carried into a trial as a step when the parent recipe is applied.

### Versioning
As in Глина: changing proportions on a recipe that already has trials attached creates a **new
version** rather than overwriting — otherwise past results become unexplainable.

---

## 6. Module D — Techniques (decoration & manipulation)

A controlled vocabulary of what was physically done, orthogonal to the recipe:

- Resist: wax (batik), paste resist, clamp (itajime), stitch (nui shibori), bind, pole (arashi)
- Shibori variants
- Paste printing / screen printing / block printing
- Bundle types for eco printing
- Overdyeing, dip-dyeing, gradient
- Post-treatments: iron dip / afterbath, alkaline or acid modifier bath, soaping

Each entry: name, description, applicable to which processes, notes.

---

## 7. Module E — Combinations (the reference engine)

**This is the core of the app's value.** A Combination is a knowledge record describing an expected
outcome for a defined set of inputs.

### Identity of a combination
- **Dye source** — plant + part, or tannin, or extract
- **Fibre class + specific fibre** — cotton, silk, wool…
- **Mordant** (including "none") and its concentration band
- **Process type** — immersion dyeing / eco print / eco print with blanket / paste print
- **Blanket** (for eco print) — none / dye blanket / mordant blanket, and its concentration
  (e.g. 1% iron solution)
- **Medium modification** — none / acid / alkaline, and where it was applied (bath or steam);
  see §8.3

### Outcome fields
- Expected colour (swatch + name), and the range of variation
- Print quality (for eco print): sharpness of the leaf image, contrast
- Lightfastness / washfastness expectation
- What shifts the result: temperature, time, pH, iron
- Source of the knowledge, with attribution
- **Confidence:** literature-only / confirmed by own trials / contradicted by own trials

### Retrieval — the questions the app must answer
The reference engine must support both directions:

- **Forward:** "I have *these* inputs — what should I expect?"
  (choose dye source + fibre + mordant + process → outcome)
- **Reverse:** "I want *this* colour on *this* fabric — what do I need?"
  (choose target colour + fibre → list of routes)
- **Partial:** any subset of inputs, returning all matching combinations
  ("everything I know about aluminium acetate on cotton")

Partial matching matters most in practice. The user rarely has all five inputs fixed.

### Relationship to Trials
Every Trial (F) can be linked to one or more Combinations. The Combination detail shows:
expected outcome, then the user's own trials beneath it, with any divergence made visible.

### Matching on bands, not exact values
Trial inputs are never identical twice: one blanket is 1% iron, the next 1.5%; one steaming runs
90 minutes, the next 120. If combinations matched on exact values, nothing would ever match and the
reference would stay empty.

A combination is therefore identified by **bands**, not figures:
- Mordant and blanket concentration → trace / low (~1%) / medium (~2%) / high (3%+)
- Duration → short / medium / long, per process type
- Temperature → cold / warm / simmer / boil
- pH → acid / neutral / alkaline

Exact figures stay on the trial (§8.2), where they belong. The bands live only in the reference
layer. Band definitions are part of the seeded reference data and must be revisable, since they
encode judgement, not fact.

### Proposing a combination from accumulated trials
The app may notice that several placements share one input set while no combination record exists,
and offer to create one:

> Three placements share this input set (oak, leaf, dried → cotton, aluminium acetate, eco print,
> iron blanket ~1%) and there is no reference record. Create one?

The draft is pre-filled with the combination key, the three observed results quoted verbatim, a
confidence of *confirmed by own trials*, and links to the source trials.

**The expected outcome is a proposal, never a computed value.** Averaging "grey-green" and
"grey-brown" produces nothing meaningful; the user writes the conclusion herself from the raw
observations. The app supplies structure and evidence, not judgement — otherwise the reference
fills with mechanically generated statements that read like knowledge and are not.

Suggestions appear at a threshold (three or more matching placements), are dismissible, and never
recur once dismissed for that input set.

The reverse direction is automatic: a placement matching an existing combination is linked without
asking.

### Reference and search are one module
Combinations have no navigation entry of their own. They live inside **Reference**, as two tabs:
the search and the records behind it. The distinction the user cares about is *asking* versus
*curating*, not *engine* versus *store*, and an eleventh sidebar item would have cost more than it
explained.

### Partial matching is the default, not a fallback
Only the criteria actually filled in are compared; an unanswered field never counts against a
record. Results rank by agreement, exact matches are badged, and partial ones **name what differs**.
This last part is the useful one: shown "oak on cotton with alum", the neighbouring record "the same
but with iron" is frequently the answer being looked for, and hiding it would make the reference
narrower than the practice it describes.

### Multi-plant bundles — resolved
A single eco print bundle usually carries several plants at once. Such a trial links to several
Combinations through its **placements** (§8.5) — one per plant, each carrying its own observation
while inheriting the shared conditions of the bundle.

---

## 8. Module F — Trials (activity log & gallery)

A Trial is one actual piece of work, with photographs. It is deliberately **thin** at the top level —
it composes records from other modules rather than duplicating their fields. Its substance lives in
two nested lists: **steps** (what was done, in order, with timings) and **placements** (which plant
went where, and what each one gave).

### 8.0 Process is a set of enhancements, not a single type

The spec originally treated `processCode` as one value — immersion, eco print, eco print with
blanket, paste. Chandra Rice's *Ecoprinting 101* makes clear that this is wrong: a bundle is built
by **layering** independent enhancements, and in serious practice several are active at once. The
seven, as she sets them out:

1. Pre-soaking the **cloth** with a mordant
2. Pre-soaking the **botanicals** with a mordant — iron-dipping some leaves, titanium-dipping
   others, within one bundle
3. Pre-dyeing the cloth with a **substantive** dye (bonds without a mordant)
4. Concurrent dyeing with a **substantive carrier blanket**
5. Pre-dyeing with an **adjective** dye (requires a mordant)
6. Concurrent dyeing with an **adjective carrier blanket**
7. **pH modifiers**, applied before, during or after steaming

A trial therefore carries `processCode` (the base technique) plus `enhancements: [code]`. The
combination key (§7) includes the enhancement set, because "oak on cotton with alum" means
something different on a pre-dyed ground than on white cloth. Without this the reference engine
would silently merge results that are not comparable.

**Substantive vs adjective** is a property of the dye and belongs in the vocabulary: a substantive
dye bonds without a mordant, an adjective dye does not. It determines whether a mordant step is
required at all, and it splits carrier blankets into two kinds that behave differently in the bundle.

### 8.0a A trial is one story, told once

The single most costly mistake available here is to model *planning* and *recording* as two acts.
In practice they are one, often minutes apart: a plan is formed while the cloth is in hand, and the
work begins before the plan is finished. An application that asks for the plan and then asks again
for what happened has doubled the writing for no reference value — and writing is exactly what an
artist has least patience for.

**A trial therefore carries a status, not a twin.** `planned → in_progress → complete`. The record
is opened when the intention forms, holds whatever is known at that moment, and the *same fields*
are corrected as the work proceeds. Nothing is entered twice. Starting earlier costs nothing,
because starting earlier is not an extra step — it is the same step, taken sooner.

**Planned values are not preserved.** A step holds one figure and a `done` mark. If ninety minutes
became a hundred and twenty, the number is corrected and the ninety is gone. This is a deliberate
loss: the intended figure has no reference value — the reference is built from what happened — and
keeping both would double the fields on every step to record something consulted almost never.
Where a divergence is itself interesting, it belongs in the step note, in the user's own words, at
her discretion.

### 8.0b Stages, not step types

Entry is organised by **named stage** rather than by bath chemistry. The six, settled with the
owner:

| code | Bulgarian | what it holds |
|---|---|---|
| `raw` | сурова тъкан | *nothing — see below* |
| `prep` | предварителна обработка | scouring, tannin, mordanting, the chalk bath |
| `decorate` | декорация | shibori, resist, paste printing |
| `colour` | багрене и принт | dye baths, eco print, steaming, boiling |
| `after` | последваща обработка | iron bath, modifiers, soaping, rinsing, drying |
| `done` | готово | *nothing — see below* |

**Two of the six hold no steps, deliberately.** Raw cloth is the fabric record, which already exists
and already carries a photograph; finished is `status: complete` plus `resultPhotos`. Making either
a container would mean entering the same thing twice, which is the failure §8.0a exists to prevent.
They appear on the progress line as endpoints, read from the fabric and from the trial's own status.

**A stage is a label on a step, and it may recur.** This came from the owner and it is the part that
matters: dyeing before a print and again after it is *two passes* through colouring, not one stage
visited twice. So the screen groups steps into **consecutive runs** of the same stage, never into
one card per distinct stage — collapsing them would rewrite the order of the work. The progress line
is generated from the runs that exist. It is a record, not a template, and a trial with three
colouring passes shows three.

**Decoration needed step types that did not exist:** folding and binding, applying resist, paste
printing, and removing resist. Removing a resist is its own step because it usually happens much
later — after the dye bath, sometimes after the rinse. The existing `bundle` type is the eco-print
bundle and is a different act from binding for shibori.

**A decoration step points at a technique** from the Techniques module. The reference question is
"what does shibori on this cloth with this plant give", and that cannot be answered if the technique
is only recorded once at the level of the whole trial.

**Steps written before stages existed are grouped by inference from their type**, read at display
time and never written back. A record made before the question was asked is not wrong; a migration
that guessed would turn a guess into a fact.

**A photograph is offered at every stage and required at none.** Photo-first entry is right for
opening a bundle, where seeing precedes describing, and wrong at the scale, where there is nothing
to see. A stage may be nothing but a tick and a date. The rule from §8.5 is widened in *availability*,
never in *obligation*.

### 8.0c The piece is the entry point

The natural question is "what is happening with this garment", not "which trial was that". A fabric
record therefore offers **continue this story** directly, and a trial can be started from the cloth
without first choosing a module. The Trials gallery remains, for the times the question is visual or
chronological rather than about one piece.

**One button, two meanings, decided by the cloth.** If a trial on this piece is unfinished, the
button continues it; otherwise it starts a new one. This is what stops the app accumulating three
half-written trials on the same garment, which is what a plain "new trial" button would have done.

**The handoff travels in the address**, as `#/trials/<id>` or `#/trials/new/<fabricId>`. A hidden
channel was written first — the values stashed in `sessionStorage` — and replaced, because the
address costs nothing extra and makes the back button, a reload and a bookmark all behave. The new
trial then reads the cloth's own name and weight from the record rather than opening by asking what
it already knows.

**A route naming a record that no longer exists falls back to the gallery.** Deleting a trial and
then following an old link used to render nothing at all, and a blank screen with nothing on it to
explain itself is the worst outcome this application has.

**Assigning an unchanged hash fires no event**, so `navigate()` in `ui.js` dispatches the change
itself in that case. Without it, asking a piece to open a record it is already showing does nothing
at all, silently.

**One chronological photo strip.** Photographs about a single cloth are scattered across five
places: the fabric's own shot, a plan diagram, the placements, the steps, and the finished result.
Shown as separate blocks — which is how they were shown — they can state a before and an after but
never a middle, and the middle is where eco print happens. They are gathered into one strip so the
piece reads as it was lived: raw cloth, diagram, leaves laid out, rolled, rinsed, done.

**Sorted by date, then by rank within the day.** The rank is what does the real work: a trial's
plan, placements, steps and result almost always share one date, so date alone would leave the order
to chance and the roll could appear before the leaves were laid out. Plan first, then placements,
then steps in their own order, then the result.

`photoTimeline(fabric, trials)` lives in `fabric-logic.js` and is pure: it returns codes for what
each photograph is and leaves every word to the view. A step's photograph carries its `stageCode`,
so the strip names the stage rather than saying only "step".

### 8.0d Plans that are drawings

A worked-out plan is often a picture — a layering diagram, a folding sequence — and it should be
attachable as exactly that: an image on the trial, with no structured field asking to be filled from
it. What genuinely belongs in structured form is only the part that will later be searched: the
layers and their roles, which `BundleLayer` (§8.1) already holds, the barrier among them. The drawing
carries the rest, and carries it better than any form would.

### 8.0e The working flow — five screens

**Built in 0.73.0.** One field was added — see *the colour that came out* below —
and everything else is a rearrangement of fields that already existed.

The diagnosis first, because it explains the shape. The trial form is six panels
side by side — title, water, techniques, placements, steps, result — one per
corner of the `Trial` record. The stages added in 0.66.0 live *inside* the steps
panel, so the story is a subsection of a form. This inverts that: the story is
the screen, and the form's other corners become context folded above it.

**1 · My work.** The Trials module, reframed. Unfinished entries read as *how far
along* — a row with progress. Finished ones read as *what came out* — a card led
by a photograph and swatches. One list, two rhythms, because the question asked
of the two is not the same. Fabrics stays the wardrobe: what I own and what state
it is in. My work is what is happening.

**2 · New work.** One screen, one question: what are you working on?

**Revised in §13bd.** This screen sorted mordanted pieces to the top under *ready
to work*. Readiness turned out not to be a property of a piece but of the pair of
piece and intention: tanned cotton is ready for an eco print and never will be for
a madder bath, and under the old rule it sank to the bottom beside the raw wool.
One list now, every piece showing its box and the treatments it carries, ordered
by how much preparation stands behind it. Choosing goes straight into the trial — no intermediate form.
A new cloth can be added inline with name, composition and weight only; the tag
number is reserved on save as everywhere else. Intent is written afterwards, at
the top of the trial, if at all.

**3 · The active trial.** A single column: header, progress line, then the stages
open as cards. Three things move and nothing is added — placements become an
action inside *colouring and printing* rather than a separate panel (the data
stays in `trial.placements`); water, process and enhancements fold into a
collapsed *about this work* strip, because they are context and not work; and
every stage carries its own **+ add action**, which knows the stage it inserts
into.

**4 · Finishing.** Its own screen rather than a field at the bottom of a form:
photographs, the colour that came out, how it went and why, *would I do this
again*, and the cloth's change of state. All five already exist — `resultPhotos`,
`assessment`, `assessmentWhy`, `repeat`, `stateEvents` — gathered in one place
and put as questions.

**5 · Reviewing finished work.** The result is the screen: a large photograph,
the verdict, the swatches, whether it would be repeated. The process folds
underneath and opens as the same stepped story, read-only.

#### Chains are inserted expanded

Choosing a ready sequence of three inserts **three steps**, each carrying its
`recipeId` and the `chainId` of the sequence that brought it. Both fields already
exist on the step, so this costs no schema change.

The reason is what follows the insert: with one indivisible step the owner cannot
tick only the first two as done, cannot photograph the tannin separately from the
acetate, and cannot correct the temperature of one of them. Those three things
are the whole of working through a process.

There is a quieter reason. A trial records what *happened*, not what was
prescribed. A chain held as a single `chainId` would silently rewrite the history
of old work whenever the chain itself was edited. Expanded steps are a snapshot
and do not move.

What is lost is that the three no longer look like one thing, which a faint
*from "cellulose preparation"* above the group recovers — without the word
"chain" appearing anywhere. The owner should not have to hold that concept.

**One exception:** confirm before inserting into a trial already marked complete.
Adding three actions to finished work is almost always a mistake.

#### Two placements in one trial: a known limitation

Dyeing, then printing, then dyeing again with a *different* arrangement of leaves
cannot be recorded distinctly: `placements` is one flat list on the trial with no
link to a step. The owner reports this is rare, so it stays. Written down so it
is not rediscovered: if it ever becomes common the fix is a `stepId` on the
placement, not a new object.

#### Renaming Trials to "My work"

Done in 0.72.0, ahead of the flow, because the sidebar was what was being edited
at the time (§11a). The module id stays `trials`.

#### What building it changed

**Every screen has an address.** `editing` was a hidden flag, so the back button,
a reload and a bookmark all disagreed with what was on screen — the fault §8.0c
exists to prevent, still present in the one module that most needed it fixed:

```
#/trials                  1 · my work
#/trials/new              2 · new work
#/trials/new/<fabricId>   → 3, the cloth already chosen (the existing handoff)
#/trials/<id>             3 if unfinished, 5 if complete
#/trials/<id>/work        3 forced open on finished work
#/trials/<id>/finish      4 · finishing
```

Which screen a record gets is decided by the record plus the address, never by a
variable. Unfinished work opens ready to be worked on; the row is not a preview.

**The progress line is generated, never templated.** The prototype drew five
fixed stops with ticks on them, and its own screens showed why that is wrong: it
claimed decoration was reached on work with no decorative action, and the folded
process listed "decoration · no actions". A template also cannot express dyeing
before a print and again after it — two passes through colouring — which was the
owner's own correction when stages were introduced. Absence of a stage is not a
gap: work without decoration is not unfinished work.

**The colour that came out needed one field.** `resultColour` on the placement was
text only, so a finished card could only show what the reference *expected* while
being labelled with what came out. `resultHex` was added to the placement —
additive, optional, and the only route by which her own dyeing feeds the plant
swatches of §13g, which until now filled from literature and from 31 seeded
combinations covering ten plants.

**The colour is asked per placement, not per trial**, because that is where the
field lives, and it puts the reference's expectation on the same line as the
result — the comparison the whole library exists for.

**The cloth's state change applies to every piece.** `fabricIds` is a list and
twenty pieces in one alum bath is the case it exists for, so question five writes
one `stateEvent` per piece with `trialId` set. Fabrics remains the single owner of
a piece's state; the trial only says what it did.

**Composition is entered as fibre and percent**, not as prose. The prototype had a
free-text field; the fibre class, the dye-receptive fraction and the mixed
cellulose–protein warning are all derived from the structured form (§13.3) and
prose feeds none of them.

**Ready sequences are offered only in preparation**, from an add-action menu
opened in place, and are removed from the per-step dropdown entirely. Two
mechanisms for one thing is confusing, and it would let a single step "become" a
sequence. Records written before this keep rendering: a step carrying a `chainId`
alone shows the sequence name above its group as any other does.

**A step is one line, and opens in place.** Readable from a metre away over a
scale; everything the step carries is behind the line, one open at a time.

**The reader patches in place instead of rebuilding.** This is the fault the
change nearly shipped, and it is recorded in §13e.5.

### 8.1 Bundle construction

A bundle is layered, and the layers have roles. The trial's `fabricIds` list is insufficient — each
cloth in the bundle needs a role:

- **printing cloth** — the piece being made
- **receiving cloth** — a second cloth that picks up what transfers through
- **carrier blanket** — mordant or dye blanket (§5, recipe type 8)
- **barrier** — plastic, foil or old cloth, laid to stop adjacent layers printing each other

`BundleLayer` = `{ order, roleCode, fabricId | recipeId | materialCode, note }`.

The barrier matters more than it looks: whether a layer is separated or deliberately allowed to
print through is a design decision that changes the result, and it currently has nowhere to live.

### 8.2 Trial header
- Date, title
- Fabric(s) used → Materials (A.1), with weight of goods (WOF)
- Overall process type — immersion dyeing / eco print / eco print with blanket / paste print
- Technique(s) → Techniques (D)
- Water notes (source, hardness) — a real variable in natural dyeing
- Overall assessment: success / partial / failure, and why, in her own words
- Photographs of the finished work

### 8.3 Steps — the ordered process with timings
An ordered list. Each step records what was actually done, which may differ from the recipe it
came from. Recorded times are the real ones, not the intended ones.

Per step:
- **Type:** scour / tannin / mordant / dye bath / bundle & steam / bundle & boil / post-treatment
  (iron dip, alkaline or acid modifier, soaping) / rinse / dry / cure
- Recipe applied → Recipes (C), optional — a step may be improvised
- Materials used, with quantities (% WOF or grams)
- **Duration** — how long it actually stayed: in the mordant, in the bath, in the steamer
- **Temperature**, and whether it was held or allowed to cool in the bath
- **Post-bath rest** — many results come from leaving the goods in the cooling bath overnight;
  this is a separate figure from the heated time and must not be merged with it
- **Medium modification** (see 8.3)
- Step notes

Duration and temperature are the two variables the user most often changes deliberately, so they
are structured fields on every step — not free text.

### 8.4 Medium modification — a structured field, not a note
Anything added to the water, bath or steam that changes the chemistry is recorded as a small
structured group, present on any step:

- **Where:** dye bath / mordant bath / steam water / rinse / afterbath
- **Substance** → Materials (A.5): vinegar, citric acid, soda ash, lime, cream of tartar…
- **Amount / concentration**, and measured pH if taken
- **Intent:** free text — what she was trying to achieve

The vinegar-in-the-steaming-water trick is exactly this: a small acid addition to the steam medium
that shifts the outcome. Left in free-text notes it would be invisible to the reference engine
(§7), which means the app could never answer *"what does oak give on silk under acid steam?"* —
and that question is precisely why the trick is worth doing. Structured, it becomes part of the
combination identity and accumulates across trials.

Notes remain for the one-off observations that do not repeat and cannot be queried.

### 8.5 Placements — per-plant results
Because a bundle almost always carries several plants at once, observations must be attributable
per plant, not only per trial.

An eco print trial holds a list of placements. Each placement:
- Plant + part used → Plant Library (B) / Materials (A.2)
- Condition: fresh / dried / rehydrated; season of harvest
- Position on the cloth, and orientation (face down / face up) — free text or a sketch
- Any local treatment: dipped in iron, sprayed, folded onto itself
- **Result for this plant:** colour, print sharpness, contrast, bleed
- Observation notes for this plant

Everything in the header and steps (fabric, mordant, blanket, medium modification, timings) is
**inherited** by every placement — it applies to the whole bundle. Only what differs per plant is
recorded on the placement.

Each placement resolves to a Combination (§7) and contributes to it. This is what makes the
reference grow quickly: one five-plant bundle enriches five combination records at once.

When a trial has a single plant, the interface collapses this level and asks for the result
directly — the structure is present in the data, invisible in the UI.

### 8.6 Gallery view
The trials list is primarily **visual** — a photo grid, filterable by plant, fibre, mordant,
process type, medium modification, and resulting colour. This is how one actually recalls past work.

---

## 9. Module G — Library & Tools

Calculators are a primary feature, not an accessory — almost every recipe has to be rescaled
before it can be used, and doing that on paper each time is where errors enter.

- **% WOF calculator** — weight of fibre → grams of mordant/dyestuff at a chosen percentage
- **Recipe scaling** — open any recipe, enter the weight of goods, and every ingredient is
  recalculated in grams and millilitres. The scaled version can be carried into a trial as the
  step actually performed
- **Aluminium acetate preparation** — scaled to the fabric weight, since it is prepared rather
  than bought: proportions of alum and the acetate source, water volume, and the resulting bath
- **Solution calculator** — e.g. how much iron for a 1% solution in N litres of water; used for
  blankets and afterbaths
- **Reverse mode / limiting ingredient** — "I have 180 g of alum; scale everything else to it." In
  practice the cupboard, not the cloth, often sets the batch size. Any calculator that scales
  forward must also scale backward from whichever ingredient is the constraint
- **Dye-to-fibre ratio calculator**
- **Bath volume** — water needed for a given weight of goods at a chosen liquor ratio
- **Exhaust bath** — after the first dyeing the bath still holds pigment. A rule of thumb rather
  than a computation: roughly half the strength remains, so either a lighter shade on the same
  weight or a full shade on less. Presented as an estimate with its uncertainty stated, since the
  real figure depends on how thoroughly the first bath was exhausted

### 9.1 Where the boundary runs — calculator or recipe?

A **calculator** is a conversion with no author: % WOF, solution strength, bath volume, fresh-to-dried.
Nobody wrote these; they are arithmetic, and hard-coding them is right.

A **recipe** is a procedure with proportions that someone wrote: scouring cellulose at 2% soda ash,
a tannin bath at 7–10%, Michel Garcia's 1-2-3 indigo vat, a carrier blanket at 1–2% iron. These
look like calculators but are not: they have authorship, versions, sources, and steps. They belong
in Recipes and are served by **one** generic scaling engine, not by fifteen bespoke screens.

The aluminium acetate preparation is the deliberate exception. It is not proportions scaled by
weight but stoichiometry with substitution — changing the aluminium source changes the quantities
of the others — so it earns dedicated code.

**The blanket trap deserves naming:** a carrier blanket's iron solution is calculated against the
weight of *the blanket*, not of the art cloth. Same arithmetic, different weight of goods, and
getting it wrong is a common and expensive mistake. Blanket recipes therefore state their basis
explicitly rather than inheriting the trial's weight.
- Reference guides and glossary
- Backup: export / import, with a staleness reminder (the Глина lesson)
- Version info

---

## 10. Reference packs — separate export/import for knowledge

Reference content (plants, mordants, standard recipes, combinations) must be exportable and
importable **independently of personal data**. This is a distinct mechanism from the personal
backup in §9, not a variant of it.

### Why this matters
- The knowledge base grows slowly and by hand. Being able to ship an improved plant library to an
  existing installation without touching the user's own trials is the difference between a living
  reference and a frozen one.
- It allows knowledge to be shared between practitioners without sharing private work.
- It gives a clean route for the public version: the app ships with a base pack, and updated packs
  can be published later.

### Two independent channels

| | Personal backup | Reference pack |
|---|---|---|
| Contains | Materials in stock, trials, photos, own notes | Plants, techniques, standard recipes, combinations |
| Purpose | Data safety, device transfer | Knowledge distribution and update |
| Direction | Round-trip (own data out and back) | Mostly inbound (receive updates) |
| On import | Replaces / restores | **Merges** into the existing library |

### Requirements
- Every reference record carries a **pack identifier and a version**, plus a stable ID that survives
  re-import. Records are matched on that ID, never on name.
- Import is a **merge with a preview**: what is new, what is updated, what conflicts — shown before
  anything is written, never applied silently.
- **User edits win by default.** If she has edited a seeded plant entry, an incoming update must not
  overwrite it — it is flagged as a conflict and she decides. This is why the seed/personal
  distinction in §11.5 must live at the record level, and per field where feasible.
- Deletion never travels through a pack. A newer pack may add or revise, never remove her records.
- A user-authored subset must be exportable as a pack of her own, so her accumulated knowledge can
  be shared, published, or simply carried to another device.
- Packs are plain files (JSON), human-readable and diff-able. No server required.

### Bilingual implication
A published pack should carry both language variants, since the receiving installation may run in
either language. This is a requirement on *publishing*, not on authoring: the translation pass runs
over the records selected for the pack, immediately before it is built. A pack missing a language
for some records still imports — the receiving app falls back to the language present.

---

## 11. Cross-cutting requirements

1. **Offline-first, absolutely.** IndexedDB is the truth. No cloud dependency.
2. **Bilingual BG/EN** from day one in *structure*, not in obligation. Stored values are stable
   codes resolved through a dictionary; authored reference prose is stored as a `{bg, en}` pair
   whose second half may stay empty indefinitely. Free text stays in whatever language it was
   written. See §13.1.
3. **Two real form factors, laptop first.** Unlike Глина (a phone tool used at the wheel), this
   app is expected to be used more from a laptop — the reference library, recipe entry and
   bilingual authoring all want a keyboard and a wide screen. The phone matters for the studio and
   the garden: photographing results, checking a recipe mid-process, recording a plant on the spot.
   The layout must genuinely serve both — a wide reading and editing layout, and a narrow
   one-handed layout — not a phone design stretched across a laptop screen.
4. **Photographs are first-class.** Colour is the subject matter; a text description of colour is
   never sufficient. Multiple photos per trial, ideally with lighting notes.
5. **Seed data vs. personal data** must be distinguishable at record level (and per field where
   feasible), so seeded content can be updated without touching the user's own records. See §10.
6. **Backward compatibility** on every version, as in Глина.
7. **Derived, not duplicated** — no stored back-references; related lists computed on open.

---

## 11a. Navigation — two halves and a rule

Twelve flat sidebar entries told nobody what shape the application has. Grouped in 0.72.0 along the
line the data already draws:

**The reference part** — knowledge that is true whether or not this particular person owns anything.
It ships in seed packs, it is read at the desk, and another practitioner would recognise every word
of it: *Reference* (combinations), *Plants*, *Recipes*, *Substances*, *Stock*, *Techniques*,
*Calculators*, *Sources*.

**The diary** — her own work, never distributed: *My work* (trials) and *Fabrics*.

**Below a rule** — what belongs to neither: the backup and the packs. Housekeeping filed with one
half for want of anywhere else is how a sidebar stops meaning anything.

**Stock is parked, not placed.** By nature it belongs to the diary — `materials.js` opens with
"Personal, never distributed" — but it is listed beside Substances because that is where it is
going: folded into the substance record. Moving it to the diary first would move it twice. See §11b.

**The module under *Diary* is "My work", not "Trials".** The rename was agreed long before and held
back; it arrives here because the sidebar is what was being edited, and because "Trials" under a
heading reading "Diary" describes the schema rather than the act. The module id stays `trials` — it
is in every address and every backup, and renaming it would be a migration for nothing.

**Two addresses, one module.** The backup was the first of nine buttons in the calculator picker,
chosen from the same row as the WOF conversion — one module trying to be two things, the same fault
as the original "material" record (§13.4). Split in the navigation rather than in the code:
`#/tools` opens the calculators, `#/tools/backup` opens the backup. Which entry is lit is resolved
from the full address; a record address like `#/plants/<id>` matches no entry and falls back to its
module, which is what keeps a plant lit while it is open.

Giving the backup its own address is worth more than it sounds: it can be bookmarked, and it is the
one screen a person needs to reach in a hurry on a device they are about to replace.

**The phone bar carries the diary, not the reference.** It had held *Home · Reference · Plants ·
Recipes* — two of which are read at the desk — while *My work* and *Fabrics* sat behind "more", on
the one device where the work is actually recorded. Now *Home · My work · Plants · Fabrics · More*.
Plants stays: that one is read standing in front of the bed. Five is the maximum a narrow screen
carries, and the fifth is "more". The sheet behind it is grouped the same way as the sidebar, because
the phone is where a person is least able to hold twelve unlabelled tiles in their head.

**A heading is not a destination**, so it does not look like one — no hover, no cursor. And a heading
may not share a name with a module under it: the reference half is labelled *Reference library* while
the combinations module keeps *Reference*, for the same reason the diary is *Diary* and not *My work*.

**Guarded.** `check-boot.mjs` now counts the reverse direction: every module must be reachable from
the sidebar. There are more entries than modules, so a count alone proves nothing — a module with no
way in is a module that quietly stops being used.

---

## 11b. Stock, and why it is folding into Substances

Recorded because the owner asked what Stock was for and could not find the answer in her own
application — which is the finding, not the question.

**The record split stays.** §13.4 separated Substance from Stock for two reasons that have nothing
to do with navigation: a recipe points at a substance so it does not break when a jar runs out, and
a pack can ship substances without pretending the recipient owns anything. Both hold.

**The module does not.** Splitting records is not splitting screens. Глина models the same thing as
a field on the material plus a wishlist, with no separate module, and that is the better shape.

**Why the thread was lost.** Four things read the `stock` store: its own list, two counters, and the
Substances module — where it appears as a count in the list and a thin `<li>` *inside the edit form*.
Substances has no read view; §13c gave read mode to five modules and this was not one, so a substance
opens straight into a form and its jars are visible only while editing. **Stock is a ledger that is
only written to.** Nothing reads it back, and the field it exists for — this bottle's concentration,
vinegar at 5% or at 25% — reaches no calculator.

**The state is per substance, in four values.** *Have* (a jar with something left), *empty* (a jar at
zero), *wanted* (no jar, and it is wanted — titanium oxalate), and the silent fourth, *nothing said*,
which is most of the seeded library. The first two are derived from `remaining`; *wanted* cannot be
derived, because the absence of a jar does not describe itself.

**Wanted does not live on the Substance.** A substance is a reference record: seeded, distributed in
packs, subject to "restore base library". A personal flag on it would leak into an export and fight
the merge — exactly what §13.4 avoided. It lives in `stock`, which is already personal and already
never distributed, as a named `status` field rather than a boolean: with a boolean someone forgets to
filter, with a name they cannot miss it.

The honest cost: every reader of `stock` must then exclude wanted entries from jar counts and
low-stock logic. Four readers today, so it is affordable — but it is the kind of widening that
produces "the wishlist item showed up as an empty jar" six months later, hence the named field.

**Jars stay as records.** The tempting simplification — one checkbox on the substance and no jars at
all — loses this bottle's concentration, and that is the difference between a working aluminium
acetate and a wasted batch. Along with supplier, harvest date for foraged material, and batch.

What this needs, and why it is not a rearrangement: a read view on the substance, the jars as a real
block inside it, the state as a chip in the substances list, a filter for *don't have / running low /
wanted*, and the bottle's concentration reaching the calculator.

### Built in 0.92.0

**Substances is now Materials.** The shelf holds cochineal and bought indigo extract — neither a
plant nor a chemical — and "substance" pushed them out of the word. The owner named this: she buys
cochineal and wants to know whether she has it. The model already held them (category `dyestuff`
does not require a plant); only the label was wrong. **The stores keep their names** — `substances`
and `stock` — because migrations only ever add.

**The material opens for reading.** §13c gave read mode to five modules and this was not one of
them, which is why the jars were visible only while editing. The shelf sits **first**, before
chemistry and safety: every other fact on the record is true whether or not she owns any.

**A jar has its own address** — `#/substances/<id>/jar/<jarId>` — rather than a panel inside the
material, because a screen without an address cannot be returned to, reloaded or bookmarked (§13q).

**Stock has no module.** Its entry left the navigation; "what is running low" is a filter over the
materials list, the way Глина asks it. `#/materials/<jarId>` still resolves — it finds the jar's
material and opens the jar there — because addresses already saved must not become dead ends. The
module is declared in `HIDDEN_MODULES` so the orphan guard does not read it as a module someone
forgot to link.

**The four states live in `stock-logic.js`.** Four things ask the same question, and four copies of
"running low" is four thresholds that drift apart. `wanted` is not a fifth degree of having — it is
what is said when there is nothing — so a wanted entry beside a real jar is ignored rather than
shown. "Nothing said" returns null and stays silent: a chip on every row reading *unknown* is noise
on four hundred rows.

**The threshold is both.** A jar carries `lowBelow` in its own unit; left empty, the fallback
fraction of 15% applies. Five litres of vinegar and five hundred grams of powder do not run low at
the same fraction.

### Found while building

**An address naming a deleted record threw**, and a thrown render leaves the *previous* screen in
place — so the application appeared to ignore the address rather than to have failed. Present in
Plants, Recipes, Techniques, Sources, Fabrics and Materials. All six now return to their list.

**Fabrics cannot be addressed at all.** It has no `open()`, so `#/fabrics/<id>` names a record the
module never hears about; its open record lives in a module variable. This is the hidden state
channel §13q exists to forbid, still present in one module. Recorded, not worked around.

**A guard passed for the wrong reason.** The check that a jar with no material lands on the list
watched where the address *ended up* — and a redirect into a material that does not exist is itself
sent back to the list, so the final address was right whatever the module did. It now records the
**first** step. Likewise the unit guard set both fields to `g` and would have passed with the copy
removed; it now writes `ml`.

Still open from the list above: the bottle's concentration reaching the alum acetate calculator,
which asks for a vinegar percentage and offers 9 while the jar knows it is 5.

---

## 12. Deliberately out of scope (for now)

- Colour measurement from photographs (light conditions make this unreliable without calibration)
- Commercial/production features: orders, pricing, client records
- Multi-user accounts and cloud sync
- Automated colour matching against a standard system (Pantone/NCS)

---

## 13. Data model

Written as entities and fields, storage-agnostic. IndexedDB object stores map one-to-one onto the
top-level entities; nested lists are embedded, not separate stores, unless stated.

### 13.1 Conventions used throughout

**Identifiers.** Every record has a stable `id` (UUID) that never changes and survives export,
import and re-import. References are always by `id`, never by name — names are bilingual and
editable, and matching on them would break on the first translation or typo.

**Bilingual text — three kinds of text, only one of them costly.**

1. **Vocabulary and interface labels** — fibre classes, process types, chemistry classes, band
   names, every caption in the UI. Stored as codes, resolved to a language at render time. The user
   never writes them; they ship with the app. Bilingualism here is free, and it covers far more than
   it appears to: a plant record's tannin level, role, availability, seasonality and preferred leaf
   surface all display in both languages without a single word being translated.
2. **Personal free text** — trial notes, per-plant observations, assessments. Stored as a plain
   string in whatever language it was written, never translated. Unchanged.
3. **Authored reference prose** — a plant description, the wording of a recipe step. This is the
   only place where real double work exists.

For the third kind the storage shape is a pair:

```
{ bg: "дъб", en: "oak" }
```

**The second language is optional and never blocks.** A record saved with only `bg` is complete and
fully usable. The app renders whatever is present and shows a quiet indicator where a translation is
missing. Nothing in the application requires both halves to function.

**Translation is a step before publishing, not a step during entry.** A dedicated screen lists every
untranslated field, so the pass happens once, in bulk, with machine translation as a first draft —
and only for records that will actually travel. Since reference material defaults to
`distributable: false` (§13.1), the set needing translation is a small fraction of the library.

The pair shape is kept from the outset even while half of it stays empty, because converting a plain
string into a pair later is a migration of the entire database. The shape costs nothing; the
obligation would have cost a great deal.

**Controlled vocabularies.** Fixed lists — fibre classes, chemistry classes, process types, step
types, bands — are stored as **stable codes** (`tannin_gallo`, `fibre_cellulose`, `proc_ecoprint`).
The code is the data; the label is looked up per language at render time. Codes never change once
published, because they travel inside reference packs.

**Provenance.** Every record carries:

```
origin:        "seed" | "user"
packId:        string | null      // which reference pack it came from
packVersion:   string | null
editedByUser:  boolean            // a seeded record the user has modified
editedFields:  [string]           // which fields she changed — protected on pack update
distributable: boolean                       // may this record travel in a published pack?
```

There is no `sourceRef` and no `learnedFrom` — see §13r.

**Attribution belongs to the library, not to every record.** The original model put a source and a
`distributable` flag on each entry, defaulting to *not* redistributable. That was wrong on the
facts. Proportions and sequences are not authored works: "6% aluminium acetate, then a chalk bath"
is a fact, independently arrived at by many people. Boutrup and Ellis did not invent it — they
systematised it and cite their own sources. Chandra Rice learned it from them. The next
practitioner learns it from her. Nobody in that chain owns the recipe, and treating each link as
an owner misrepresents how the craft actually transmits knowledge.

What *is* protected is **text** — particular wording, order of exposition, and the selection and
arrangement of a whole collection. Fifty recipes transcribed from one book is a problem even
though each one alone is a fact. Recipes written in the app's own words are not.

The model therefore becomes:

1. **A general Sources section** — books, courses, people and sites the library rests on, listed
   with thanks and links. This is the honest form of credit, and the right scale for it.
2. ~~A free-text `learnedFrom` on the record.~~ **Removed in 0.87.0 — §13r.** The reasoning
   below was right and did not go far enough: a free-text field still holds one answer, and the
   usual case has several at once.
3. **Redistributable by default.** `distributable` inverts to an opt-*out*, marked only where there
   is a real reason.

Two cases still warrant asking rather than assuming, and both are courtesy and accuracy more than
law: **whole transcribed text**, and a **named authored system** — Michel Garcia's 1-2-3 vat is his
specific achievement and carries his name.

Practically: a record is opted out of distribution when it reproduces someone's wording verbatim,
or when it is a named system whose author has not been asked.

`editedFields` is what makes §10's merge policy possible: an incoming pack may update any field the
user has not touched, and must flag the rest as a conflict rather than overwrite it.

**Timestamps.** `createdAt`, `updatedAt` on everything.

**Favourites.** `favorite: boolean` on Plant, Recipe and Combination. Personal, never distributed
in a pack, and never a substitute for search: it marks the handful one reaches for constantly, or
the ones that have given the best results. It earns its place because a reference consulted daily
develops a working set far smaller than the library, and walking past forty plants to reach the same
six is friction with no purpose. Combinations carry it too — a trusted result is exactly the thing
worth pinning.

**No back-references.** Related lists are derived by scanning, never stored — the Глина principle.
A plant's trials are found by scanning placements, not kept on the plant.

---

### 13.2 Plant

Reference entity. The botanical background behind any number of dyestuff materials.

```
id
nameCommon      { bg, en }
nameBotanical   string                  // Latin, single language
family          string
parts           [ PlantPart ]
role            [ "dye" | "ecoprint" | "mordant_accumulator" ]
chemistry       [ { classCode, level, note } ]   // level: trace|moderate|high|dominant
substantive     boolean | null          // dyes without a mordant?
cultivation     {
                  light, soilStructure, watering, soilPh,
                  invasive: boolean, invasiveNote {bg,en},
                  yearsToMaturity: number | null
                } | null
                // `propagation`, `care` and `pests` were removed in 0.83.0 — §13m.
character       { bg, en }              // "How it behaves" — §13m
harvest         {
                  whenNote {bg,en}, processing {bg,en},
                  dryingRatio: number | null   // fresh weight ÷ dried weight
                } | null
dosing          [ { partCode, condition, percentWofMin, percentWofMax } ]
tempExtractC    { min, max } | null
tempDyeC        { min, max } | null
maxTempC        number | null           // hard ceiling; flagged when a step exceeds it
seasonality     { harvestMonths: [int], note {bg,en} }
lightfastness   code | null             // poor|moderate|good|excellent|unknown
washfastness    code | null
toxicity        { level: code, precautions: [code], note {bg,en} }   // §13.2a
availability    code                    // grows_here | forageable_local | purchased
notes           { bg, en }
photos          [ photoId ]
```

`PlantPart` = `{ partCode, note {bg,en}, chemistry: [...] | null }` — a part may override the
plant-level chemistry, because bark and leaf are frequently not the same dye at all.

### 13.3 Fabric

**A separate entity from Material**, despite living in the same UI module. Its lifecycle, its
composition arithmetic and its per-piece identity have nothing in common with a jar of alum.

```
id
label           string                  // short human code written on the pinned tag, e.g. "П-042"
name            string                  // free description: "стар чаршаф", "тениска"
origin          "new" | "reclaimed"
originDetail    { supplier, purchaseDate } | { wasA, condition, priorUse }
form            code                    // garment | scarf | cut_piece | roll
composition     [ { fibreCode, percent } ]        // must total 100
structure       code                    // plain | crepe | jersey | twill | gauze | velvet | other
weightGsm       number | null
dimensions      { text }                // free — "40×180 cm", "size M"
weightG         number                  // the actual weighed mass; required for every WOF sum
quantity        { value, unit }         // count for pieces, metres for roll
baseColour      code                    // natural | bleached | predyed | dyed_by_me
state           code                    // derived — see below
stateEvents     [ FabricStateEvent ]
notes           string
photos          [ photoId ]
```

**Derived fields.** `fibreClass` (cellulose / protein / mixed / part_synthetic) and
`dyeReceptiveFraction` are computed from `composition` — never stored. A 99% cotton + 1% elastane
cloth is cellulose with a 99% receptive fraction; a 50/50 cotton-linen is cellulose at 100%; a
cotton-silk mix is `mixed` and the app warns that one mordanting route will not serve both.

`FabricStateEvent` = `{ id, date, stateCode, recipeId | null, trialId | null, note }`.

**Superseded by `FabricAction` in §13bd**, which is what the application reads and writes from
0.98.0. The old list is left in place for a version rather than removed, so the mapping can be
checked against real records before the only copy of a piece's history depends on it.

`state` is derived from the latest **box-moving** action, following the Глина single-owner rule:
when actions exist they own the state; otherwise the field set at creation does. Only a box-moving
action counts, which is the correction §13bd makes — under the old rule an iron afterbath recorded
after dyeing would have moved the piece into a box named after the bath.

### 13.4 Substance and Stock — two entities, not one

The original model made "material" a single record, and the interface built from it was confusing
for a reason that was structural rather than cosmetic: one record was trying to be two things.

**Substance** — what aluminium acetate *is*. Formula, hydration state, standard % WOF, which fibre
classes it suits, temperature ceiling, safety and disposal. This is reference knowledge: true
whether or not a jar is on the shelf, identical for every practitioner, and shipped in seed packs.

**Stock** — *this jar*. Which supplier, bought when, how much is left, what concentration this
particular bottle of vinegar is. Personal, never distributed, meaningless as reference.

The separation matters beyond tidiness: **a recipe points at a substance, never at a jar**, so a
recipe does not break when the jar runs out. And a seed pack can ship substances without
pretending the recipient owns anything.

```
Substance
  id, category, name {bg,en}
  formula, hydrationState, molarMass
  notes {bg,en}
  — dyestuff: plantId, defaultPartCode, dyeClass
  — tannin:   tanninTypeCode, plantId, colourCast
  — mordant:  mordantTypeCode, standardPercentWof, suitableFibreClasses[],
              colourEffect, maxTempC, handling[], disposalNote, safetyNote
  — modifier: phDirection, typicalUse {bg,en}, effectNotes {bg,en}

Stock
  id, substanceId
  form              // extract | dried | fresh | powder | liquid | crystal
  supplier, acquiredDate, harvestDate
  quantity { value, unit }, remaining { value, unit }
  concentrationPercent      // this bottle: vinegar 5% vs 25%
  batchNote, notes
```

Entering something for the first time costs two records; buying it again costs one, because the
substance already exists.

Category-specific fields:

- **dyestuff** — `plantId`, `form` (extract | dried | fresh), `partCode`, `harvestDate`,
  `concentration` (for extracts), `manufacturer`
- **tannin** — `tanninTypeCode` (gallo | ellagi | condensed), `plantId | null`, `colourCast`
- **mordant** — `mordantTypeCode`, `standardPercentWof`, `maxPercentWof`,
  `suitableFibreClasses [code]`,
  `colourEffect` (brightening | saddening | darkening | warming), `maxTempC`, `handlingCode`

  `maxPercentWof` is a **damage ceiling**, not a preference. Iron above roughly 2% WOF embrittles
  fibre: the cloth looks right when it comes out of the pot and tears a year later. The app flags a
  recipe or trial step that exceeds it, in the same way it flags a temperature above `maxTempC`.
  This is why the arithmetic behind iron does not need its own calculator — it is ordinary % WOF —
  while the limit very much needs to live in the data.
  (gloves | mask | ventilation), `disposalNote {bg,en}`, `safetyNote {bg,en}`

  The vocabulary must include **titanium oxalate** alongside iron, alum and aluminium acetate — it
  gives a strong orange with tannin, and it carries hard constraints the app should enforce rather
  than bury in prose: never heated above 70 °C, powder handled with mask and gloves. `maxTempC`
  exists so a recipe or trial step above the ceiling can be flagged. Iron carries a different
  caution — high concentrations degrade protein fibres over time — which belongs in `safetyNote`.
  Disposal differs by mordant and is not interchangeable.
- **modifier** — `phDirection` (acid | alkaline), `typicalUse {bg,en}`, `effectNotes {bg,en}`

### 13.5 Recipe

```
id
lineageId, version                      // versioning as in Глина
type            code                    // scour | tannin | mordant | dye | ecoprint |
                                        // pigment | paste | blanket
name            { bg, en }
appliesTo       [ fibreClassCode ]
ingredients     [ RecipeIngredient ]
steps           [ RecipeStepTemplate ]
liquorRatio     number | null           // litres of water per kg of goods
tempC, durationMin, phTarget
sourceRef       { text, author, url }   // always credited, never claimed as her own
notes           { bg, en }
```

`RecipeIngredient` = `{ id, roleCode, materialId | plantId | freeText, quantity, unit, basis,
basisRefersTo }`

**`basis`** is `percent_wof | percent_of_bath | grams_per_litre | ratio_to_dyestuff | absolute` —
this is what makes scaling possible. An ingredient expressed as `percent_wof` rescales with the
weight of goods; one expressed as `absolute` does not.

**`basisRefersTo`** disambiguates what a percentage is a percentage *of*: `finished_product` or
`raw_input`. This is not pedantry. A mordant recipe dosed at 5–8% of finished aluminium acetate and
one dosed at 15–20% of raw alum before conversion describe the same practice at a threefold
difference in number. Without this field the two are indistinguishable in storage and the
calculator produces a confident wrong answer — the worst class of error in an app whose purpose is
to be trusted as a reference.

**`roleCode`** is the function the ingredient performs — `aluminium_source`, `sodium_source`,
`acid_source`, `dyestuff`, `assistant`. A recipe specifies a role; several different materials can
fill it, with different chemistry. See §5.1.

`RecipeStepTemplate` = `{ order, text {bg,en}, tempC, durationMin, note }`.

**Blanket recipes** additionally carry `blanketKind` (dye | mordant), `concentrationPercent`,
`freshOrCarriedOver`, `useCount`.

**Versioning.** Editing quantities on a recipe that already has trials attached creates a new
version sharing the `lineageId`. Past trials keep pointing at the version actually used — otherwise
old results become unexplainable.

### 13.6 Technique

```
id, name {bg,en}, category code, description {bg,en},
appliesTo [processCode], sourceRef
```

Categories: resist, shibori, printing, bundling, post-treatment.

### 13.7 Combination — the reference record

```
id
key             CombinationKey          // see below — the identity
expected        {
                  colourText   {bg,en},
                  swatchHex    string | null,
                  variation    {bg,en},        // the range, not a single value
                  printQuality code | null,    // ecoprint only: sharp|soft|diffuse|none
                  lightfastness, washfastness
                }
influences      [ { factorCode, effect {bg,en} } ]   // what shifts it: temp, time, pH, iron
confidence      "literature" | "confirmed" | "contradicted" | "unverified"
sourceRef
notes           { bg, en }
```

`CombinationKey` — the identity, all as codes and **bands**, never raw figures:

```
{
  dyeSource:   { plantId, partCode } | { tanninTypeCode } | { materialId },
  fibreClass:  code,
  fibreCode:   code | null,          // cotton, silk — optional narrowing
  mordantCode: code | "none",
  mordantBand: code,                 // trace | low | medium | high
  processCode: code,                 // immersion | ecoprint | ecoprint_blanket | paste
  blanket:     { kindCode, band } | null,
  medium:      { phCode, whereCode } | null
}
```

Two placements belong to the same combination when their keys are equal. Bands exist precisely so
that a 1% and a 1.5% iron blanket land together; the exact figures stay on the trial.

**Band definitions** are themselves data (`BandDefinition`: `{ dimension, code, min, max, label
{bg,en} }`), seeded and revisable — they encode judgement, not fact.

**Derived on open:** the list of placements matching this key, with their trial dates and photos.
Never stored on the combination.

### 13.8 Trial

```
id
status          "planned" | "in_progress" | "complete"   // one record, three ages — §8.0a
date, title
intent          string                  // what she set out to do; written early, never re-asked
planPhotos      [ photoId ]             // attached diagrams and sketches — §8.0d
fabricIds       [ fabricId ]
weightOfGoodsG  number                  // total, the basis for every percentage
processCode     code
techniqueIds    [ techniqueId ]
water           { sourceCode, hardness, note }
steps           [ TrialStep ]
placements      [ Placement ]
assessment      "success" | "partial" | "failure"
assessmentWhy   string
resultPhotos    [ photoId ]
notes           string
```

`TrialStep`:

```
{
  id, order,
  stageCode,                    // raw|preparation|colouring|after|result — grouping only, §8.0b
  typeCode,                     // scour|tannin|mordant|dye|bundle_steam|bundle_boil|
                                // post_iron|post_modifier|soap|rinse|dry|cure
  done      boolean,            // intended vs performed; the figures themselves are corrected
  date      | null,
  recipeId | null,              // null = improvised, which must stay allowed
  materials [ { materialId, quantity, unit } ],
  tempC,
  heldMinutes,                  // active, heated time
  restMinutes,                  // time left in the cooling bath — a separate figure, never merged
  mediumMod: MediumModification | null,
  photos    [ photoId ],        // offered at every stage, required at none
  note
}

**There is no `plannedTempC` or `plannedMinutes`, deliberately.** See §8.0a: one figure per field,
corrected in place. The intended value is not kept.

**Three photograph sizes, because they are looked at differently.** A finished
piece is studied for colour and keeps 1280px. A step photograph shows an
arrangement — how the layers stacked, how tightly it was rolled — and 800px is
legible without making the backup unusable when a trial carries a dozen. A
placement stays at 480px. A plan diagram (§8.0d) uses the *result* size despite
being neither: it has writing on it, and writing at 800px is writing that cannot
be read.

**A trap worth naming, since it has now been hit twice.** `data-step-photo` is a
different attribute from `data-step`, and `[data-step]` does not match it — CSS
matches a prefix of an attribute's *value*, never of its name. Here that is what
is wanted, and `readForm` correctly leaves photo inputs alone. In §13f the same
rule silently defeated the unsaved-work guard. Any code that finds fields by
attribute name has to be checked against the real markup, not the pattern.
```

`MediumModification` = `{ whereCode (dye_bath|mordant_bath|steam_water|rinse|afterbath),
materialId, amount, unit, phMeasured | null, intent }`. Structured, not a note — §8.4.

**Placement fields are conditional on the process.** The concept is universal — a placement exists
to attribute a result to one dye source, which is equally necessary when a single bath holds both
madder and walnut. What is eco-print-specific is only a few of its fields: `position`, `facing` and
`printQuality` are not rendered for immersion dyeing. The process is already chosen in the trial
header, so the form knows which fields apply.

**Only four fields are required:** plant, part, condition, result colour. Everything else stays
collapsed until asked for.

**`position` is optional and hidden by default.** The placement photograph already records where
the leaf lay, far more precisely than a text field could. The field remains for the cases where a
sketch reference or a verbal note genuinely helps.

**Entry is photo-first for eco print.** The real sequence is: open the bundle, photograph the
result, then say what it was. The form follows that order — add photo → name the plant → write the
observation — rather than asking for a filled form before a photo can be attached.

**"Placements" is now "Plants and prints".** The old name described the schema:
for anyone outside the model it reads as a coordinate. Internal names are
unchanged — this is a label.

**The card appears only where the leaves are the composition.** For immersion
dyeing the centre of the work is the bath and the batch of dye material, and a
card headed "plants and prints" under a dye bath asks a question that process
never poses. Records that already hold placements keep showing them whatever the
process now says: nothing is hidden away from a record that has it.

**Photo-first must never mean camera-only.** The three photo inputs in the diary — the plan or
sketch, a step, a placement — carried `capture="environment"` from the day they were written. The
intention was right: standing over an opened bundle, the camera is what one wants. The consequence
was not. The attribute does not *prefer* the camera, it removes the gallery and the file system as
options, so **a photograph already taken could not be attached at all** — a plan drawn in a notebook
and shot yesterday, a diagram made on the laptop, a photograph of the bundle taken with the good
camera rather than the phone. Reported by the owner from real use in 0.71.0, and it had been true
for as long as the trial form existed.

Removed. Without it the operating system's own sheet still puts the camera first, with the gallery
and the files beneath it — camera-first as a default rather than as a wall. Guarded in `check.sh`
from 0.71.1, because the attribute is exactly the kind of thing that returns by being copied from a
neighbouring input, and because the symptom appears only on a phone, which is not where the app is
usually tested.

The general rule: **photo-first is about the order of the questions, not about which device supplies
the image.** Any screen in Stage 11 that offers a photograph inherits this.

`Placement`:

```
{
  id,
  plantId, partCode,             // always a Plant — never a Material
  materialId      id | null,     // optional, only when a stocked extract was used
  condition       code,          // fresh | dried | rehydrated | frozen
  harvestSeason   code | null,
  position        string | null, // optional, hidden by default — the photo records this
  facing          code | null,   // face_down | face_up — eco print only
  localTreatment  string | null, // dipped in iron, sprayed, folded
  resultColour    { text, swatchHex | null },
  printQuality    code | null,
  observation     string,
  combinationId   id | null,     // resolved automatically when a key matches
  photos          [ photoId ]
}
```

Everything in the header and steps is inherited by every placement. Only per-plant differences are
recorded here.

**A placement points at a Plant, not a Material.** A leaf picked off the tree that morning never
enters stock and creating a material record for it would be pure friction — the effect would be
that exactly the most spontaneous experiments stop being recorded. What matters about that leaf is
its `condition` (fresh, dried, rehydrated) and, where relevant, its season, both of which live on
the placement itself. `materialId` stays available for the case where a stocked extract or a
purchased dried plant was genuinely drawn from inventory, and is simply left empty otherwise.

### 13.9 Photo

```
id, blob, thumbnailBlob, takenAt, caption, lightingNote, ownerType, ownerId
```

Lighting note matters: the same cloth photographed in shade and in sun reads as two colours.

### 13.10 Vocabulary and settings

```
Vocabulary: { code, dimension, label {bg,en}, order, description {bg,en} }
BandDefinition: { dimension, code, min, max, unit, label {bg,en} }
Settings: { language, defaultLiquorRatio, lastExportAt, changeCounter, schemaVersion }
```

Vocabularies and bands ship as seed data and travel in reference packs, so adding a chemistry class
or renaming a label is a data change, not a code change.

### 13.11 Reference pack format

```
{
  packId, packVersion, createdAt, author, description {bg,en},
  schemaVersion,
  records: { plants: [], materials: [], recipes: [], techniques: [],
             combinations: [], vocabulary: [], bands: [] }
}
```

A pack never contains fabrics, trials or photos — those are personal. Import merges by `id`, shows
a preview, and never overwrites a field listed in the local record's `editedFields`.

### 13.12 Modelling questions — resolved

1. **Fabric and Material are separate stores.** A fabric is an object with a biography: it holds a
   composition, moves through states, carries a pinned label and ends as a finished piece. A jar of
   alum only decreases. Forcing both through one shape would fill the code with
   *if-this-is-a-fabric* branches and show through in the interface. The UI still presents a single
   Materials module with tabs; the separation is invisible to the user. The cost — supplier, photo,
   notes and stock declared in two places — is accepted.
2. **No per-placement quantity.** Recording "three leaves" or "a handful" adds nothing for eco
   printing; the placement's identity is the plant, its condition and its position.
3. **A placement points straight at a `Plant`**; condition is recorded on the placement, and
   `materialId` is optional for stocked items.

---

## 13.2a Safety, as a level and a set of things to do

**Built in 0.74.0**, across all forty-eight plants.

The library previously carried a sentence of prose per plant, filled on forty-one
of them, which had to be written and then translated. The owner asked for a
colour instead. The answer is a colour, but the colour is not the data.

**Three levels, not a toxic/not-toxic flag.** One word would put eucalyptus and
madder in the same box when their risk differs in kind rather than in degree.
`low` · `caution` · `elevated`, as vocabulary codes — so the label comes from the
term table in both languages and no sentence is written per plant.

**The precautions are codes too**, as a multiple choice: gloves, ventilation,
mask for dust, separate vessels, do not ingest, photosensitivity, possible
contact allergy, the concentrate is not the leaf. This collapses what a fuller
proposal had as four separate risk fields — skin, ingestion, inhalation,
photosensitivity — into the form that changes what happens at the bench.
"Inhalation risk: dust" and "wear a mask when grinding" are the same fact, and
only one of them is an instruction. Coded also means they can be filtered: *show
me everything that wants a mask* is a real question to ask before starting.

**The hybrid cases are `low`, not rounded up.** Seventeen of forty-nine
assessments came back as "low or caution", and they all meant one thing: *the
leaf is low risk and the essential oil or the concentrated extract is not*.
Rounding those up would have put a third of the library at `caution` and emptied
the word. The level stays low and the distinction is a precaution code.

**Prose survives only where it says something new** — five plants: G6PD deficiency
and henna, which chestnut, which brazilwood species, and why madder and tansy are
marked at all. On the other thirty-eight it repeated the level in a sentence.

**The colour renders the code and never carries the meaning alone.** Weld-yellow
for caution, madder for elevated, neutral for low — not green, since the whole
interface stays neutral. The label always stands beside the mark: a colour cannot
be read aloud, searched, filtered, or exported, and one in five men cannot
distinguish some of these pairs.

**The profile states its own scope**, once: *an assessment for the practice of
dyeing and eco print — not a food or medical judgement*. Without that line a
reader could take `elevated` on madder as "poisonous", when what it means is that
the dry root powder should not be inhaled. Madder is the plant the application is
named after, and normal dyeing with it is not dangerous.

**What is not verified.** The assessments were compiled with citations to EMA and
PMC where they exist, and most rows have none. `confidence` is per field, so the
level can honestly say `literature`. The four at `elevated` — madder, tansy,
buckthorn, henna — are worth checking against a primary source before the library
goes to anyone else; the other forty-four carry less weight.

---

## 13j. Search, and where a filter is still better

**Built in 0.78.0**, in plants, recipes, techniques, and the plant picker inside
a trial.

Typing beats a row of chips once a list is long enough that scanning costs more
than three letters. Forty-eight plants in a `<select>` is a list you scroll, not
one you choose from — and that select sits in the middle of recording work, where
the interruption is most expensive.

**Chips stay where they answer something typing cannot.** "Show me only the
mordant accumulators" is not a word anyone would search for, so the role tabs in
plants, the categories in substances and techniques, and the states in fabrics
all remain. The availability chips in plants were replaced, because availability
was already a weak filter and the search covers the common case.

**What is searched is names, not prose.** Common name, botanical name, family. A
search that reached into the body text would return half the library for "кора",
which is worse than no search.

**The picker keeps the id, not the typed text.** A native `datalist` avoids
writing a custom dropdown, and works with a phone keyboard. The visible input
holds the name and a hidden input holds the id, because the form reader reads
`value` from whatever carries the data attribute. **A name matching nothing
restores the previous selection** rather than clearing it — losing a plant to a
typo would be a poor trade for the convenience of typing.

**Search text is a filter, and is cleared by `reset()`** for the reason §13g
gives: a list that looks short for a reason nobody can see. Checked.

---

## 13k. Marks, and what they may not replace

**Built in 0.79.0.** Sixteen marks across three dimensions — the six fabric
states, the five substance categories, the five technique categories — plus eight
for the calculators.

**A mark stands above its label, never instead of it.** Sixteen drawings nobody
has seen before are sixteen guesses; "tanned" and "dyed" are not obvious as
pictures, and a person opening the application for the first time has no way to
learn them. A picture also cannot be read aloud or searched.

**One mark means one thing everywhere.** The crystal that marks a mordant in the
substance filter is the crystal on the mordanted fabric state; the leaf that
marks a tannin is the same leaf. The fabric state mark now appears in the filter
row, the list, the record and the history, through one helper — five copies would
have drifted.

**The tools screen is a menu, not a grid of labels.** Each calculator is a row
with a mark, its name, and one line saying when to use it — sentences that
already existed as `tools.when.*` and were only shown *after* the calculator had
been chosen, which is to say after they could help. `#/tools` is the menu and
`#/tools/<calc>` is the calculator, the shape the backup already had.

**Never green**, here as everywhere: the interface must not put a colour opinion
beside a photograph of dyed cloth.

---

## 13a. Versioning and installation

**One place holds the release number.** `version.js` exports `VERSION`; the sidebar shows it and the
service worker cache name is kept in step with it. Two numbers that can drift apart is one number
too many — a stale cache is invisible until it is expensive.

**Багра installs as a PWA.** Icons in the app palette, a complete manifest, standalone display. On a
phone this matters more than it sounds: the studio and the garden are exactly where a browser tab
is inconvenient, and where the app must work without a signal.

---

## 13b. What real use changed

Four sessions of the owner working with the app in the studio produced corrections that no amount
of specification would have found. They are recorded here because each one marks a place where the
model was built around the theory rather than around the hand.

**A recipe ingredient may be a plant.** The original model had ingredients point at substances
only, which made an entire category — dyeing with a plant — impossible to write down. "Madder
root at 50% WOF" has no substance to reference. Ingredient options now carry `plantId`, `partCode`
and `condition` (dried / fresh / extract), because the same plant at three different forms takes
three different percentages, and suppliers sell all three.

**Figures are pulled from the library, not retyped.** A plant record already holds dosing per part
and condition, extraction and dyeing temperatures, and a liquor ratio. Copying them into a recipe by
hand is how the recipe and the reference drift apart, so the recipe form takes them directly.

**A trial is one sequence, not a sequence beside a list.** Bundle layers began as their own section,
parallel to the steps. In practice, laying the cloth on foil, arranging the leaves and laying the
blanket *are* steps, in order, among the chemistry. The separate list broke the order in which the
work is done and remembered. Layers folded into steps, with new step types for the physical actions
and a role on each.

**A step may follow a chain.** Preparation is usually scour → tannin → mordant, already modelled as
a chain (§5.3). The trial's step selector offers chains and recipes together, because from the bench
they answer one question: what did I follow here.

**Writing a recipe must not cost the trial.** A step can open a blank recipe: the trial is saved
first, where to return is remembered, and saving the recipe comes straight back. Otherwise the
choice is between recording the work and recording the method, and one of them loses.

**Vocabulary named after action, not theory.** The seven enhancements were named after the
chemistry — "adjective carrier blanket" is precise and unusable at the bench. They now read as what
one does: *blanket soaked in dye*, *leaves dipped in mordant*. Substantive and adjective remain, but
on the plant record where they are a property of the dye, not on the screen describing an afternoon.

**Unmodelled things say so.** Paste printing needs a thickener, a stencil and a fixing step none of
which exist here. Offered silently it promises more than it delivers, so it carries a plain warning
instead.

**A single figure is not a range.** Filling only the upper bound produced "0–165 g", which reads as
a claim about a lower bound nobody made. Whichever box a lone number lands in, it is an exact
quantity.

---

## 13c. Four modes, and why they must be kept apart

Three independent reviews of the working app — two by other models, one by the owner — arrived at
the same diagnosis, which is worth recording as a principle rather than as a fix: **the interface
had become a screen-by-screen translation of the data model.** Every record opened as a form, so
administering the record looked like the main thing one does with it.

The app does four things, and they want different shapes:

| Mode | Shape |
|---|---|
| Finding an answer | Reference search: few inputs, ranked results, own results beneath the expected |
| Following a procedure | One column, quantity beside the step, legible from a metre away |
| Recording what happened | Result first, then conditions, then process |
| Editing library knowledge | A form — behind a button, never the default |

**Read mode is the default on every record with substance**: plants, recipes, fabrics, trials,
combinations. Back from the editor returns to reading the *same* record rather than to the list,
because one usually corrects a field and wants to see how it now reads.

Consequences worth stating:

- **A plant leads with what is wanted at the bench** — part, dose, temperature, ceiling — not with
  its taxonomy. It is edited once and consulted a hundred times.
- **A recipe's working view** puts the quantity beside the step that uses it. Two parallel panels
  force the answer to be assembled from two places at every step over a hot pot.
- **A fabric reads as a biography**: composition, then a dated timeline of its states, then the
  trials it went through. Its history is the point.
- **A trial leads with the result.** The photograph and the outcome are why one opens a finished
  trial; the process is why one keeps it.
- **A combination shows the owner's placements beneath the expected outcome.** This is the premise
  of the whole application made visible, and everything else exists to make it possible.

**The correction was incomplete, and this is the second half.** Read mode fixed how a record is
*consulted*; entry was left following the model — process type, then steps typed by bath chemistry,
then placements. That is the vocabulary of the craft's theory, not of an afternoon's work. §8.0a–d
carry the same principle into recording: one record from intention to result, named stages instead
of step types, the cloth as the entry point, and photographs on a single timeline. The test is
whether the app asks the artist to write anything twice. It should not.

### Naming follows the work, not the model

`Placements` is a correct name inside the model and an opaque one on screen; it reads as a
coordinate. The section is called *Plants and prints*. The same applies throughout: an enhancement
is described as *blanket soaked in dye*, not as an *adjective carrier blanket*.

### Succeeded and worth repeating are different questions

A technically clean result can be dull; a failed piece can reveal an effect worth chasing. A trial
therefore carries both an assessment and a separate *would I do this again* — unchanged, with
changes, no, not sure yet — and, when changed, what would change.

---

## 13d. Empty means unknown

The craft has too many unmeasured variables for the app to invent precision. The plant variety is
often unknown, the water hardness approximate, the temperature not watched throughout, the blanket
carried over from a previous bundle at an unknowable strength, the cloth an old sheet of unknown
origin, and the quantity of leaves "one full layer" rather than 83 grams.

Three rules follow, each of which was violated once and corrected:

1. **A blank is not a value.** An unrecorded pH is not a confirmed neutral bath. Treating it as one
   manufactured knowledge no source had, and made records match searches they had no business
   matching.
2. **A lone figure is not a range.** Filling only an upper bound produced "0–165 g", which asserts
   a lower bound nobody stated. Whichever box a single number lands in, it is exact.
3. **Confidence is per claim, not per record.** A plant's dyeing temperature can be well established
   while its preferred leaf surface is a guess. One marker over both would flatten exactly the
   distinction that matters.

---

## 13e. Silent faults, and the checks that now catch them

Each belongs here rather than in a commit message, because each is a *class* of
mistake this codebase invites, and because every one of them was invisible until
something else went looking.

**1. A radio group reads as its last option.** `readForm` walked every element
carrying `data-f` and assigned its value. A segmented control renders one input
per option, all with the same `data-f`, so the loop overwrote the chosen value
with the final option every time — whatever was clicked. Four modules shared the
pattern. The visible consequence is that **plant lightfastness and washfastness
have been recorded wrongly for as long as the segmented control has existed**;
values entered by hand are worth re-checking. The fix is one line — skip an
unchecked radio — and the lesson is that a generic reader over a hand-rolled
form has to know about input types it did not anticipate.

**2. A counter that advanced on being looked at.** The fabric tag number was
taken when the blank form was *opened*, so opening it and thinking better of it
left a hole in the sequence. Reserving an identifier is a write, and a write
belongs at save. Split into `peekLabel` (shows what the code will be, changes
nothing) and `reserveLabel` (takes it), with the form displaying the peek as a
placeholder — a promise the app then keeps.

**The check that would have caught the third.** `check-boot.mjs` proves the app
starts and visits each module, but stops at the list view. Read views and forms
are where imports are actually exercised, and a missing one there gives a blank
screen with nothing on it to explain itself — which is exactly what happened
when `segmented` was used in the trial form without being imported.
`deep-check.mjs` now opens the first record in each module, opens its editor,
presses the star, and asserts the two rules above as behaviour rather than as
diffs. It dispatches real events: calling `root.onclick` directly skips handlers
registered with `addEventListener`, and a harness that does so reports green on
a screen that does not work.

**3. A check that failed at random (found in 0.71.0).** After a click the harness
slept a flat 30 ms and then read the screen. A click starts an asynchronous
re-render whose promise the event dispatcher drops, so nothing could be awaited —
and for a year 30 ms was enough. The moment the plant list grew, the suite began
failing **twice in twenty runs**, on the favourites star in recipes and in the
reference, neither of which had been touched. The application was correct; the
check was not.

It now waits for the screen to *stop changing* rather than for a fixed number of
milliseconds: poll the rendered length, and return once it has held steady twice,
with a ceiling. Twenty runs before: two failures. Twenty after: none.

**5. A reader that treated the screen as the whole truth (0.73.0).** `readWork`
collected every `[data-step]` and `[data-place]` element on screen and *replaced*
the record's arrays with what it found. Correct for as long as every step rendered
all of its fields — and data loss the instant steps began rendering collapsed: a
trial with five steps and one open would have been written back holding one step.

Caught by the deep check within a minute of the collapse landing, because adding a
step to a stage stopped working; the same bug on a real record would have quietly
deleted four steps on save. It now patches the existing rows in place and ignores
indices it cannot see, and there is a check that writes five steps, opens one,
saves, and demands five back with their notes intact.

The general shape, worth naming because this codebase invites it: **a form reader
is only correct while the form renders everything.** Any progressive disclosure —
collapsed rows, tabs, a wizard — turns a rebuilding reader into a deleting one,
and the failure is silent because saving is exactly when it happens.

**6. Globals the harness did not have (0.73.0).** `navigate` calls
`new Event('hashchange')` when the address is unchanged. `Event` was not among the
globals the check harnesses define, so that path threw only under test and never
in a browser — a check failing on code that works is as costly as the reverse.
`Event`, `MouseEvent` and `CustomEvent` are now defined in both harnesses.

**7. A dictionary that only ever loaded into an empty store (0.76.0).** The
vocabulary was written on start under `if (await count('vocabulary') === 0)`,
while the comment directly above it said the opposite — that a term already
present is left alone, which describes topping up. The gate meant **every term
added after a person's first install never reached their database.**

`label()` returns the raw code when a term is missing, and the codes are English.
So the symptom was not "a term is missing"; it was *"there is English text in the
Bulgarian version"*, which is what the owner reported, on the enhancement
checkboxes reading `cloth_mordant` instead of „платът е мордантиран“. A search of
the translation files found nothing, because nothing was wrong with them.

Every safety term added in 0.74.0 would have done the same on her installed copy:
`elevated`, `dust_mask`, `separate_vessels`.

Now topped up on every start, the rule the seed packs already followed for
records, with her own edits to terms left alone. `check-boot.mjs` asserts that all
227 terms reach the database.

The general shape: **a fallback that produces plausible output hides the fault it
is covering for.** Returning the code was a reasonable thing to do and it turned
missing data into what looked like a translation gap. A fallback should be
correct, or visibly wrong — not quietly almost right.

**8. Two handlers, one property (0.78.0).** `root.oninput` was assigned twice in
the recipes module: once by the search box and once, further down, by the scaling
panel. The second assignment wins. The search box rendered, held its text, kept
the caret in place — and filtered nothing, while the code that should have
filtered read as perfectly correct.

Found only because the deep check asserted that typing *narrows* a list rather
than that a search box exists.

`check-scope.js` now fails the build if a module assigns `onclick`, `oninput`,
`onchange` or `onsubmit` more than once.

**9. A check placed after `process.exit()` (0.78.0).** The first version of the
guard above never ran: it sat below the line that ends the script. It reported
success on the very file that would have failed it, and the failure mode of a
check that does not run is indistinguishable from a check that passes.

Both of the guards added that day were therefore tested in **both directions** —
break the thing, watch the check fail, restore it, watch it pass. That is now the
rule for any new check: a guard that has never been seen to fail has not been
tested.

**10. A missing icon is a hole, not an error (0.79.0).** A `<symbol>` named in
code but absent from the sprite renders as nothing: no console error, no broken
image, just a gap beside a label that still reads correctly. Invisible in a
headless check and easy to miss on screen. `check-scope.js` now verifies every
mark named in code exists in the sprite.

Worth stating as a rule, because the cost is not the wasted minute. **A check
that fails at random teaches people to run it again** — which is the exact
opposite of what a pre-deploy gate is for, and it degrades quietly: the first
re-run that passes is the moment the gate stopped working. Any timing in
`deep-check.mjs` must be a condition, never a duration.

**11. A cache name that never changed (0.83.0).** `sw.js` carried
`bagra-v0.70.0` while `version.js` read `0.82.1` — twelve releases during which
the service worker file itself never changed. A browser installs a new worker
only when `sw.js` differs byte for byte, so devices went on serving the files
they already had. Invisible on a desktop, where a hard reload hides it, and
exactly the shape of fault that only appears on somebody else's phone.
`check.sh` now reads the version out of `version.js` and refuses to pass unless
the cache name carries it.

**12. An ignore file git never read (0.83.0).** The file was named `gitignore`,
without the dot, so `node_modules/` was never ignored and a single `git add -A`
committed 2 198 files. Nothing broke; the repository simply stopped being a
description of the app. The lesson is narrower than it looks: a configuration
file that is silently *not in force* looks identical to one that is being
obeyed, so its effect has to be observed rather than assumed.

**13. A form that erased what it never showed (0.84.1).** `seed` and `shell`
were used as part codes in the seeded library and were absent from the
vocabulary, so avocado read "seed, обвивка" — an English code in the middle of a
Bulgarian row. The display was the smaller half. `options()` built its `<select>`
only from the vocabulary, so a code it did not know appeared as no option at
all and the control fell back to the empty one: opening the record and pressing
save, without editing anything, deleted the part. A form that silently rewrites
data is worse than one that displays it wrongly, because the display is at
least visible.

Two guards, because there are two faults. `deep-check.mjs` now cross-checks the
codes *used in the data* against the vocabulary — counting vocabulary terms,
which the boot check already did, says nothing about whether the codes in use
have one. And `options()` keeps an unknown value as an option showing itself, so
it survives a save and reads as something wrong rather than as nothing.

**14. A work view whose controls did nothing (0.86.1).** The weight and
bath-volume fields stand on both the recipe record and the recipe editor, and
the handler for them replaced `.scaleblock` — which only the editor has. On the
record, typing a bath volume updated the context and redrew nothing. A
volume-scaled recipe with no `defaultLitres` therefore showed a dash beside its
substance for as long as anyone cared to type at it.

The failure is the shape that matters: it read as **missing data**, not as a
broken control. The chalk bath carries 10 g per litre and always had; the dash
said otherwise, and the first reading of the screen was that the quantity had
never been entered. A dead input that looks like an empty field costs more than
a visibly broken one.

Two smaller faults sat inside it. `Number('')` is 0, so clearing the field set
the volume to zero rather than to unset, and every quantity computed to nothing.
And redrawing the record put the caret back to the start of the field, which
makes a number typed digit by digit unusable, so the caret is restored.

Guarded by setting the volume on a rendered record and asserting the figure
moves.

**15. Bands were terms nobody could read (0.88.0).** Bands — concentration, pH,
duration, temperature — are terms with a range attached, and they live in their
own store because of the range. `label()` and `terms()` read the vocabulary
store alone, so every band code rendered as its raw English self: a chip saying
"калиева стипца (medium)" in the middle of a Bulgarian row, and the band and pH
dropdowns in the reference search silently offering **nothing**, because
`options('concentration', …)` found no terms for a dimension that does not exist
there. One cause, two symptoms, neither obviously related to the other.

`vocab()` now reads the two stores as one list; nothing else needed to know.

Found by generalising the guard from §13e·13, which checked plant parts alone.
It now walks every place a stored code is looked up against a dimension —
plants, combinations and recipes — and it immediately turned up a second thing:
`confidence: 'practice'`, carried by all thirty-one seeded combinations, was
never in the vocabulary either. A guard narrower than its own principle is a
guard that will be needed again.

**16. A specification section deleted by an edit (0.88.1).** Large edits to this
document are made by replacing an anchor heading with new text *plus* the
heading, so the new section lands above the old one. One such edit did not put
the heading back, and §13l — how the reference ships full, and the workbook
round trip — disappeared. Nothing noticed, because nothing was watching. The
decisions live in this file rather than in chat precisely so they survive; a
lost section is a lost decision, recoverable only from git and only if someone
happens to look.

`check.sh` now records the section letters and fails if any that existed before
is missing, or if two share a letter. Recovered from `83e0e64`.

**17. A guard that passed on alternate runs (0.88.2).** The work-view guard
reported "the record has no bath volume field" from time to time, and passed
the rest of the time. The field was always there. Two causes, stacked:

The guard read the DOM immediately after `settle()`, which drains what is
already queued — a render that starts a fresh chain of awaits finishes after it.
It now waits for the control rather than assuming it.

That alone did not stop it. The guard *before* it ended with
`location.hash = '#/recipes'`, and in jsdom that fires the router, which starts
a render of its own; that render landed after the next guard had rendered and
replaced the screen underneath it. Guards do not reset the address any more.

A guard that fails sometimes is worse than no guard: it teaches everyone to run
the suite again instead of reading it. Run three times consecutively before
being accepted.

**And an application-level fragility it exposed, not yet fixed:** two renders of
the same module can be in flight at once and the later-finishing one wins,
whichever was asked for first. It has not bitten in the browser, where renders
are not started a millisecond apart, but the module has no generation check and
nothing stops it.

---

## 13f. Protecting unsaved work

The heaviest item to come out of real use: forms here are long, and one stray
click on the sidebar discards an afternoon. The protection is **one guard over
the whole application**, not a rule each module follows, because a rule the
eleventh module has to remember is a rule the eleventh module will forget.

**How it knows a form is open: a Save button is on screen.** The first attempt
matched the data attributes `readForm` uses — `[data-f]`, `[data-comp]` and the
rest — and was quietly wrong, because the real attributes are `data-comp-pct`,
`data-place-photo`, `data-step-del`, and CSS matches a prefix of an attribute's
*value*, never of its name. About half the fields went unwatched, and the half
it missed were the nested ones: composition rows, placements, steps. The long
parts. The parts worth protecting. A Save button is the better signal — present
exactly when a form is, and unable to fall out of step with the markup.

**What counts as leaving:** the sidebar, the phone bar, Back, opening another
record, starting a new one, and the browser's own back button. A list filter or
a tab does not count; a list is not on screen while a form is. This distinction
matters more than it sounds: a guard that asks on ordinary clicks is worse than
no guard, because it gets dismissed reflexively and then goes unread on the day
it matters.

**Saving clears the state only when the form is observed to have gone.** Modules
save asynchronously and then re-render into the read view, so the click itself
proves nothing. Clearing on the click and undoing it on a timer was tried and is
a race: whichever way it is tuned, one answer is sometimes wrong, and the wrong
answer is silently discarded work. A save can also be *refused* mid-way — a
composition that does not total 100 — and the person is then still in the form
with the same unsaved work, which must stay protected.

**The browser's back button is refused by putting the address back**, since by
the time `hashchange` fires the navigation has already happened. `beforeunload`
covers closing the tab and reloading; the browser shows its own wording there
and ignores ours, which is fine — what matters is that it asks.

---

## 13g. What a plant can give

The owner's words: for someone who dyes, this is the most important thing on
the screen. It was in the database and not on it — the plant list carried a
column of chemistry classes, and the colours lived one click away inside the
record.

**Two sources, derived at display time.** A plant's own `colours` are the
owner's palette, written by hand, and come first. Combinations fill in the
rest, because a combination *is* an expected colour and carries a `swatchHex`
for exactly this purpose. Nothing is stored: there are no back-references in
the data, and a swatch cached on the plant would drift the moment a combination
was edited. As the reference library grows, the column fills itself in.

This mattered more than it looked. **Not one of the 48 seeded plants has a
`colours` entry**, so a column reading only from the plant would have shipped
empty across the whole library and looked broken. Reading combinations too
lights up 31 swatches on the seeded data on the first run.

Duplicates are collapsed by hex and the row is capped at six, so one
well-documented plant cannot stretch the column past everything else.

**A related fault, found while testing this.** The favourites filter was not
cleared by `reset()`, so leaving a module and returning left the list filtered
with nothing on screen to say why. Fixed in plants, recipes and combinations.
Any state a module keeps between renders belongs in its `reset()`, and the test
for it is whether the list can look short for a reason the person cannot see.

---

## 13h. Two plants, and what adding them exposed

Rose (*Rosa spp.*) and hazel (*Corylus avellana*), the first additions to the
seeded library since it shipped. Hazel is the more valuable of the two: it is
locally foraged and works as a dye bath, as an eco print and as a tannin
source, which is the shape of plant a reference should show strongly.

Three things the research notes assumed that the model does not have, recorded
because the next addition will meet them again:

**There is no `tannin_mordant` role.** The library already marks oak, sumac and
pomegranate as `mordant_accumulator`, so hazel follows them. The label reads
"accumulator", which is not quite right for a tannin plant — an accumulator
takes up aluminium — but consistency across the library matters more than one
imprecise word. Worth renaming if the vocabulary is ever tidied.

**`shell` was missing and has been added.** A hazelnut's green husk and its hard
shell are worked separately and give different things, so folding the shell into
`hull` would have lost a real distinction. Shells are also a genuine
waste-stream dye material.

**`availability` holds one code, not a list**, and there is no `aliases` field.
"Лешник" therefore lives in the name — `леска (лешник)` — following the
library's own convention, as in "кромид лук — жълти люспи". A field for a single
record would not have earned its place in the export.

**Colours were left empty, deliberately.** All 50 plants have an empty `colours`
array and their colour ranges live in the profile prose. Inventing hex values
for the two new ones would have lit up swatches (§13g) for colours nobody has
seen, and a reference that asserts what it has not observed is worth less than
one that says nothing.

The pack version moves to 0.2.0. `seedPack` adds absent records on every start,
so both plants reach an existing database rather than only a fresh install.

---

## 13i. The plant profile — list and detail

**Built in 0.71.0.** No schema change; the edit form was not touched. What
follows is the specification as agreed, then what building it changed.

### The fault to fix first

`renderRead()` builds its colour section from `p.colours` alone, while the list
built in 0.69.0 uses `plantSwatches(p, combinations)`. The two disagree, and
because almost no seeded plant has its own `colours`, the disagreement is
visible on the most common path: the list shows four swatches for oak, the
record is opened, and the colour section is empty.

This was introduced with the swatch column and is the smallest and most valuable
change here — **the detail must derive from the same two sources as the list**.
In the detail there is room to show the combination's context alongside each
swatch, which the list has no space for.

### The list is too much of a table

Eight columns: star, plant, gives, botanical name, role, parts, chemistry,
availability. That is a spreadsheet, and the question actually being asked of
this screen is narrower — *I have oak, walnut, rose and eucalyptus; which do I
use?*

Reduced to four blocks: **plant · what it gives · what for · part used**.
Chemistry moves to the detail. Availability becomes a filter or a small mark,
not a standing column — it matters when sourcing, not when choosing.

Swatches get larger: five or six chips rather than the current 15px squares,
naming the colour on hover or tap. Conditions stay out of the list; they belong
to the detail.

### The detail should answer four questions in order

*What is this? What does it give me? How do I use it? What else should I know?*

The present order is title, photograph, taxonomy, "for work now", then two equal
columns holding colours, chemistry, growing, cautions and the free text
sections. Technically tidy, and it tells no story — two equal columns leave the
reading order undefined, which is most of the scattered feeling.

One vertical hierarchy instead:

1. **Identity** — name, botanical name, photograph, role chips
2. **What it gives** — the derived swatches, each with its context (part,
   mordant, process). The first real block, not a panel in a column.
3. **How it is used** — for dyeing: part, fresh and dried WOF, extraction and
   dye temperatures. For eco print: print quality, facing, preparation, steam.
   All of this is already structured on the record; it is only presented as
   procedure rather than as fields.
4. **Why it works** — the chemistry, after the result and the use, not before.
5. **Gathering and growing** — season, harvest, propagation.
6. **More about the plant** — the free text sections, kept together rather than
   distributed between two columns automatically.

Blocks may hold two columns internally on a wide screen. The page itself has one
column, because the order is the meaning.

### Scope

Deliberately small: lighten the list, enlarge the swatches, move *what it gives*
to the top of the detail, derive it from both sources, and order the detail
vertically. The edit form is not touched. This is not a rewrite of the module.

### What the data said, and the block that filled itself

Counted before building, because the six blocks were specified against fields
the records mostly do not carry: `facing`, `harvestMonths` and toxicity level
are **empty on all fifty** seeded plants, dosing is present on thirty, and
`liquorRatio` on one. Built as specified, *how it is used* would have been half
empty and *gathering and growing* empty across the whole library — the failure
§13g exists to prevent, arriving by a different door.

The knowledge is not missing. It is in `sections`, and **the sections are not
anonymous prose**: the same headings recur across the library, because they came
from one guide written to one shape. "Багрилни качества" on thirty-five plants,
"Източници" on forty-one, "Рецепта" on fourteen, the six cultivation headings on
seven each.

So **the blocks fill themselves from the headings.** A lookup read at display
time maps a normalised heading to a block; parentheses and punctuation are
stripped first, so "Агротехника (отглеждане)" and "Агротехника" are one heading.
Both languages are tried. Across the seeded library this routes 83 sections into
*how it is used*, 34 into *gathering*, 28 into *why it works* and 41 into the
source note, leaving 38 in *more*.

**An unrecognised heading falls to `more`,** which is where every section used to
go — so a heading the table does not know cannot lose its text. That property is
what makes routing by title safe, and it is checked (§13e): four sections in,
four out, each in its expected block. The table is a living list, extended when a
heading recurs; it is data, not structure, and adding to it costs nothing.

**No migration, no writing back.** A record made before the question was asked
is not wrong, and a migration that guessed would turn a guess into a fact — the
same rule as the stage inference in §8.0b.

### Three departures from the plan, and why

**Cautions are their own block, immediately after the use.** Not in the list of
six. A warning read after the pot is on the heat is a warning too late.

**Two internal columns only where the prose is short** — *gathering* and *more*.
A recipe runs to nineteen hundred characters on madder and reads badly at half
width, so *how it is used* stays single-column however wide the screen.

**Fastness moved into the working facts, not into a block of its own.** It had
been sitting under "in the garden", which had become a bucket for whatever was
left over; fastness has nothing to do with a plot of ground. Its first home in
the redesign was *what it gives*, beside the swatches it qualifies — and that
was wrong for a reason only the rendered screen showed: forty-five of the fifty
plants have no recorded colour, so on those the block appeared containing
nothing but "moderate lightfastness", a heading answering a question nobody
asked. **A block with no content is absent**, exactly as the list column is
blank for the same plants, and fastness reads with the temperatures and the
ceiling instead.

That third one is the lesson of the round: the routing table and the block order
were both decided correctly on paper, and the only fault that survived to the end
was one that required looking at three real profiles side by side — a full one, a
thin one, and one in between.

### What the list became

Five columns: star · plant · what it gives · what for · which part. The botanical
name is a subline under the common name rather than a column, because identity is
one block and not two. Chemistry moved to the detail. Availability became a row of
filter chips under the role tabs, and is cleared by `reset()` for the reason §13g
gives — a list that looks short for a reason nobody can see. Swatches went from
15px to 26px, and to 20px on a narrow screen.

---

## 13l. Loading the reference, for other people

The owner's intention: the library ships **already full**, from many sources, so
that a new person opens a tool rather than an empty notebook. Plants first,
substances and recipes after.

**§13.1 has to be revisited for this.** Attribution today works three ways — a
standalone Sources register that is deliberately *not* a field on every record, a
free-text `learnedFrom` on recipes and combinations, and a prose "Sources"
section on the plants. That was right while the library was hers and the sources
were two. It inverts for distribution: once a pack reaches someone who was not in
the room, the provenance of each claim is the only thing by which they can judge
whether to trust it. A structured link to `sources` is proposed, with free text
kept for the cases where the honest answer is "this is how it is done here".

**Facts are free; expression and compilation are not.** "Oak bark holds tannins"
belongs to nobody. The wording of a book does, and so — in the EU — does a
substantially extracted database. The risk is not one sentence; it is
*systematically working through a single source*. Hence a floor: **no plant ships
with fewer than two independent sources.** Own words remains absolute.

**Where the swatches come from.** Three routes, and they are not equal:

1. *The plant's own palette* — a colour, a free-text condition, no key. This is
   what the guide text supports: "yellow-green to brown; black with iron salts"
   is honest as a colour with a condition and would be a fabrication as a
   combination, which needs fibre, mordant, band and process. Forty of the fifty
   plants had no colour at all, and this is the route that lights them.
2. *Combinations* — only where a source actually names fibre, mordant and
   process. Most plants will yield none, and that is the correct answer.
3. *`resultHex` on a placement* — her own dyeing, and the only route that
   produces `confirmed` rather than `literature`.

**A hex derived from a colour name is an illustration, not a measurement**, and is
marked as such. Drafting the names, conditions and citations is compilable work;
choosing the swatch is a judgement about colour, which is her craft.

**Where the sources disagree, that is information.** "Dosing in the sources ranges
from 8% to 20%" is more useful than a number chosen by whoever was compiling.
`confidence` is per field, not per record, which the schema already supported
before anyone noticed.

**The division of labour.** A four-sheet workbook joined on `code` — plants,
parts, sections, colours — with a column naming what each record is missing. She
edits Bulgarian and fills gaps; the English columns stay empty and are translated
on the way back in. The sections sheet is **one row per plant, one column per
standard heading**: the first version was one row per section, which is how the
data is stored and not how a person reviews it. Wide also makes unification
happen by itself — moving text out of the OTHER column into a named one is
exactly the edit that retires an odd heading.

**Completed in 0.82.0.** Forty-eight plants, no gaps: 242 sections, 132 colours, 97 dosing rows,
80 parts. Confidence per field throughout — `practice` where it is hers, `literature` where it is
compiled.

**Nothing is merged without being shown first.** The load-back script reports
every change and only writes with an explicit flag. On the first return it found
2,894 characters fewer than the record held, across nine plants — some deliberate
shortening, some possibly lost in moving text between cells. The two are
indistinguishable from outside, and the consequences are not, so the difference
went back to her as a list rather than being resolved by guessing.

**A sheet is a snapshot, and merging against a moved target deletes things.** The
workbook was exported before the constituent texts existed. Rebuilding sections
purely from it would have removed twenty-one texts written in between; keeping
every absent section would have undone her editing of sixteen headings. Neither
rule is right, because absence means two different things. Told apart by the
library as it stood *at export*: present then and absent now is a removal;
absent then and present now is a later addition. Any future round trip needs the
same snapshot — §13e.5 in a second costume.

---

## 13m. Five sections, and no exceptions

Reviewing the seeded library at 0.82.1 showed it was not one library. Thirty-two
plants carried exactly four sections; seven carried ten. The seven were the ones
the owner grows. Two different books had been bound together, and the join was
visible to anyone opening two records in a row.

**The rule adopted: a section either stands on every plant, or it does not
exist.** A reference is judged by its thinnest entry, not its fullest, and a
heading present on seven of forty-eight is not a section but a leftover.

### What left, and why

**Cultivation, propagation, care, pests** — four headings on seven plants.
These answer a *gardening* question, not a dyeing one. The app exists to answer
"oak leaves on cotton with aluminium acetate — what should I expect"; how to
propagate coreopsis is a different book. Writing them for all forty-eight would
also be absurd: nobody propagates an oak for dye, and avocado comes from the
kitchen. The texts were written out to `scripts/removed-sections.md` before
deletion — they are the owner's own work and are not thrown away.

**"Рецепта"** — fourteen plants, averaging 1 474 characters. This was the harder
call, because it read as the most valuable section in the library. It was
removed because it was a **fifth copy**. Dosing per part and condition,
extraction temperature, dye temperature and the ceiling already live in
structured fields, and `useNowCard()` renders them **directly above** the prose:
the madder record showed `root, dried: 50–100% WOF · 70–75 °C` and then two
thousand characters restating it. Not duplication in another place —
duplication on the same screen, one line apart.

A copy in prose is a copy that drifts, and it already had. On four plants the
prose and the fields disagreed, and in every case the *prose* matched the
owner's own guide while the *field* did not. Two were resolved as corrections
rather than as a choice between sources:

- **Japanese indigo** — the field read `leaf, dried 100–200%` with no fresh row
  at all, while the guide is explicit that the leaves are worked fresh and that
  drying costs dye strength. Corrected to `fresh 300–500%`, dried retained
  second.
- **Sumac** — the field read `leaf, dried 10–20%`, which is a tannin dose, not a
  dye dose. Corrected to `50–80%`. The tannin figure went into the character
  text rather than becoming a second row, because `dosing` has no dimension for
  *purpose* and two rows both labelled "leaf, dried" would read worse than none.

### "How it behaves" — a field, not a section

What the recipe prose held that no field did was **timing and temperament**:
soak the bark overnight, stir gently or it blotches, the bath is spoiled above
55 °C, the cloth may stand in the madder for a day. Most of it was boilerplate
repeated plant to plant; the departures were the knowledge.

This became `character { bg, en }` — a field on the plant, rendered inside the
*How it is used* block **below** the derived figures. Below, because the text
leans on the numbers: "must not pass the ceiling" means nothing until the
ceiling is on screen.

A field rather than a section, for the reason the whole rule rests on: something
that must be present on every plant is not a section. Sections are what a plant
*happens* to have to say.

### The harvest, and where the duplication actually was

The reported overlap between "Беритба и отглеждане" and "Беритба и обработка"
was not two sections. It was the *block heading* in the record, which read
"Harvest and growing", against the *section inside it*, which read "Harvest and
processing". With growing gone the block is simply **Beritba / Harvest**.

Harvest survives as the fifth section because it is dyeing knowledge — which
stage to pick at, how often, and what must be done the same day — and because
`harvestMonths` carries the *when* as structured data on 44 of 48. The section
holds only what the months cannot say. Forty texts remain to be written.

### The end state

`Багрилни качества` · `Използвани части` · `Багрилна съставка` ·
`Беритба и обработка` · `Източници`, plus the `character` field.

Three guards in `deep-check.mjs` hold it: no heading outside the five; the four
complete sections stand on all forty-eight; and the character text reaches the
record without a section to carry it. Harvest is named rather than counted while
the forty texts are outstanding.

`scripts/trim-library.py` performs the migration and is **re-runnable** — it
works towards a described end state rather than applying a diff, so a second run
reports nothing to change.

---

## 13n. What the prototype was right about

An outside prototype (v0.app, React and Tailwind, deployed separately) was built
as a second opinion on the interface. None of its code enters the app — the
stack is incompatible by design — but three of its choices were measurably
better and were carried across by hand.

The owner's reading was that it was *more legible*, its icons *more finished*,
and its rounding *overdone*. All three were correct; two of the causes were not
where they appeared to be.

**Legibility was line length, not typeface.** The prototype caps prose at 672px.
`.view` is 1080px and body text was running the whole of it — roughly 115
characters a line against a comfortable 60–75, past which the eye starts losing
the return sweep. A `--measure` token now caps `.prose` and `.sub`. This was the
largest single difference and cost one declaration. Heading size (23px → 30px on
a desk, 26px on a phone) and label tracking (.05em → .12em at 11.5px) followed
it.

**Rejected: a serif for headings, and a downloaded body font.** The prototype
sets headings in Fraunces and body in Geist with a Cyrillic subset. Ours is
`system-ui`, which means Segoe UI, SF and Roboto on three platforms — three
different Cyrillics, so the owner does not see what a reader sees. Fixable, but
it puts ~80 KB of `woff2` into the offline cache for a problem that line length
had already solved, and a serif heading is an identity decision rather than a
legibility one. Both deferred rather than refused.

**The icons were stroke weight and a plate, not colour.** Lucide at
`strokeWidth 1.9` against our 1.5, and the glyph sitting on a 36px plate tinted
with the primary at 10% rather than bare on the ground. No new colour was
needed — indigo already exists. Weight raised across nav, bottom bar and tiles;
the plate applied to the dashboard tiles.

**The rounding was overdone, and the swatches prove why.** The prototype's cards
are 24.5px and its swatches 19px, against a flat 8px here. Cards moved to 10px —
one step, not five. Swatches went the other way, to 3px: a 26px chip at a large
radius loses about a fifth of its visible area to the corners, and a colour
sample is the one thing on screen whose area must not be distorted.

**Not taken: dark mode and the dark sidebar.** The prototype ships both. A dark
rail beside the swatches shifts the perceived colour of what sits next to it,
and §15.3 already says why the working surface stays neutral. The light sidebar
stands.

---

## 13o. The layer with eyes

`deep-check.mjs` renders in jsdom, which has no layout engine. Every element is
zero by zero: nothing overflows, nothing overlaps, nothing is clipped, and a
stylesheet that failed to apply is indistinguishable from one that did. Every
fault of *shape* has therefore had to be found by hand on a phone — which is why
the diary's faults are all phone faults.

`screen-check.mjs` drives real Chromium at 390 × 844 and 1280 × 900 and asserts
what only exists once boxes have sizes: nothing past the right edge, rules
actually in force, text not overrunning its box, content not clipped by a pane
that should scroll, and room reserved for the bottom bar.

It found three faults in its first run, two of them in the *reference* half that
was believed checked:

- **The plants list was cut off, not scrolled.** `.panel.flush` carries
  `overflow:hidden` to round its corners over a table. On a phone the table is
  561px inside a 360px panel, so the last two columns — *what for* and *which
  part* — were simply unreachable. Clipped content gives no sign that anything
  is missing. Now `overflow-x:auto` below 820px; stage 4 replaces the narrow
  table with stacked rows.
- The same in substances (736px) and techniques (509px).
- **The tile plate collided with the count** — "Справо31ик" — because the 146px
  track had been sized for a bare 19px glyph. Caught only after a guard for text
  overrunning its box was added, which the first version did not have: measuring
  what leaves the window cannot see a collision in the middle of it.

**What it does not cover, and must not be trusted for:** the camera, the photo
gallery, real touch, and how any of it feels in the hand. The `capture` fault
would have passed here, since a file input looks identical either way. A real
phone remains the last word; this only stops the geometric faults from reaching
it.

---

## 13p. A required step is a step (0.85.0)

§5.4 calls the chalk finishing bath after aluminium acetate **mandatory, not
advisory**. The screen said otherwise. `chainFollowOns()` returned the follow-on
*recipes* and the chain view printed their names in a warning strip at the foot
of the page; the recipe view did the same. Nothing scaled them, so the 40 g of
calcium carbonate the bath needs appeared **nowhere in the application at all**.

A name in a footnote is advice. A quantity that is never computed cannot be
weighed. The rendering contradicted the specification, which makes it a fault
rather than an improvement, and it is the first thing fixed.

`expandChain()` replaces `chainFollowOns()`. It returns the sequence as it must
actually be worked — every planned step, and after each one, any recipe it is
not correct without, each scaled like any other step. The chain view, the recipe
view, and later the weighing list all read from it.

**Derived, never stored.** Writing the required step into the chain would be
double entry: the same fact held as `requiredFollowOn` on the recipe *and* as a
step on every chain that uses it, free to drift apart. It is expanded at open,
as with every other derived list (§4.6).

**Not numbered.** The numbers belong to the plan the owner built. Giving the
chalk bath a "4" would renumber her chain every time a mordant changed, so it
carries a turned arrow and says plainly that it is not optional. Numbering is
assigned before the async map, not inside it — a counter incremented after an
`await` hands out numbers in whatever order the promises settle.

**Not doubled.** A follow-on the owner placed in the plan herself is hers. Only
steps at or after the requiring one count as already-placed: scouring before
mordanting is not the chalk bath that follows it.

**One thing deliberately not built.** An injected step is not stored, so a
choice made on it has nowhere to live, and it falls to each role's first option.
Every follow-on modelled so far has a single option per role, so the question is
theoretical — but a follow-on with a real alternative needs the choice kept on
the requiring step before this is honest.

Four guards, each seen to fail: the required step is in the sequence; it carries
its own figures; it appears exactly once; and — separately, because logic
passing does not prove a screen shows it — the rendered record contains the
40 g.

---

## 13q. The address is the state (0.86.0)

`recipes.render(root)` took no address. `openId` was set by a click handler and
`mode` — recipes against chains — was a module variable, so `#/recipes/<id>`
opened nothing, the chains tab could not be linked, and neither survived a
reload or the back button. The fault §8.0d describes and Stage 11 fixed for the
diary was still standing in the reference half, unconverted because the diary
was the visible sufferer.

### `reset()` and `open()` were one flag doing two jobs

Fixing the addresses exposed a second fault in the router itself.
`hashchange` called `route(true)`, so **every** address change reset the module.
The comment said reset meant "entering a module from the navigation"; the code
applied it to movement *within* a module too. Making recipes addressable would
therefore have thrown away the search that led to a record every time the person
came back from it — a regression introduced by the fix.

They are now two questions with two answers:

- **`reset()`** — "I have arrived from somewhere else." Start at the list, drop
  the search, drop the filters. Called only when the module id changes.
- **`open(...args)`** — "this is what the address says to show." Called on every
  route change, **including with no arguments**, which is how a module returns
  to its list.

Calling `open()` with nothing is the part that makes the address the state
rather than a copy of it: there is no path by which the module can be showing a
record the address does not name. `tools.open()` had to be corrected to match —
it set the active tool but never cleared it, so `#/tools` after `#/tools/backup`
left backup open.

### The scheme

```
#/recipes                 the list
#/recipes/new             a new recipe
#/recipes/<id>            the record
#/recipes/<id>/edit       editing it
#/recipes/chains          the chains tab
#/recipes/chains/<id>     a chain
#/recipes/chains/new      a new chain
```

Chains sit inside the recipes address rather than forming a module of their own,
because `activeNav()` lights a navigation entry by module id: at `#/chains`
nothing would be lit, while `#/recipes/chains` keeps Recipes lit while its second
tab is open. The cost is one reserved id — a recipe cannot be called `chains` —
and ids are generated, so nothing can collide.

Back is a direction, not a stack: leaving the editor goes to the record, leaving
the record goes to the list, and a new recipe has no record to return to.

Four guards, each seen to fail: a record opens from its address; the chains tab
has one; an address naming no record shows the list; and the search survives
opening a record and coming back.

### Still to convert

`open()` exists on `trials`, `tools`, `recipes` and `chains`. It does **not**
exist on `plants`, `substances`, `techniques`, `materials`, `sources`,
`reference` or `packs` — seven modules whose records still open only by click.
The handlers are near-identical across them, so the conversion is mechanical,
but it is seven modules of mechanical and belongs in its own release rather than
riding along with this one.

---

## 13r. Attribution has one home (0.87.0)

§13.1 already argued that proportions and sequences are facts rather than
authored works, and moved credit from the record to a general Sources section.
It kept a free-text `learnedFrom` on the record as a lighter form of the same
idea. That was the part that was wrong, and the owner's own example is what
settles it:

> The same recipe is in the book; Chandra read the book and teaches it at a
> workshop; I heard it from her; but I have also read the book myself and taken
> a Maiwa course where they teach it too.

The field holds **one** answer. Whatever is written in it is incomplete, and a
field that cannot be right is worse than one that is absent, because it presents
itself as traceability. `learnedFrom` and the older `sourceRef` are both gone —
from `newRecord`, from recipes, techniques, combinations and chains, from the
forms, the read views, the recipes list column, and the strings.

**Sources carries all of it.** Seeded rather than left empty, because removing
credit in one release and adding it in the next leaves a library that thanks
nobody: Boutrup and Ellis, Chandra Rice, Maiwa, and the studio's own guide. The
list is a start and is expected to grow. A section can hold "this arrived by
three routes at once" in a sentence; a field on a record cannot.

**One exception, and it is not the same thing.** Plants keep their *Източници*
section. It answers a different question — not where the knowledge was learned
but **where the claim can be checked**. "This colour is documented there" is
verifiable and belongs on the record.

**`distributable` is an opt-out and stays.** Not as a legal instrument but as a
practical one: the owner decides what travels at the moment of publishing —
a pack with no recipes, or three as examples — and the flag marks the narrow
case where a record reproduces someone's wording verbatim or is a named authored
system. Five of the studio's seven recipes were marked *not* distributable,
including the tannin and chalk baths, which are facts many people have reached
independently; those were flipped back.

### Also in this release

`check.sh` walked `*.js` only, so a new `seed/*.json` could ship absent from the
service worker's list and simply fail to load for anyone offline — which is
everyone. `seed/sources.json` was the first file to expose it. The first layer
now checks every seed file against the cache list.

---

## 13s. Six rules for the interface (0.88.0)

An outside prototype was compared screen by screen against the application —
fourteen pairs of screenshots. Rather than redesign ten screens one at a time,
which is how a set of screens comes to disagree with itself, the differences
were reduced to six rules. Every screen is then reworked *against the rules*.

**1. Cards or a table, by what the content is.** We use tables everywhere and
the prototype uses cards everywhere; both are wrong as habits. Techniques *are*
their descriptions, and a table truncates them mid-word — "при ант…", "нароч…".
They become cards. Plants, Substances and Recipes are read by comparing values
down a column, and an aligned `Al₂(SO₄)₃·14H₂O` beats a card. They stay tables.
**Prose or an image → cards. Figures to compare → a table.**

**2. The primary action is pinned to the bottom of a long form.** Save sits top
right and scrolls away on the first long form a person meets.

**3. A short closed choice is chips, not checkboxes and not a dropdown.** All the
options visible at once, the chosen one filled. A dropdown hides the
alternatives, which is the wrong default for a reference whose job is "what
could I use instead".

**4. Colour carries state, and nothing else.** Three levels, from the palette we
already have: **madder** — something will be lost; **weld** — pay attention;
**indigo** — this is going well. No fourth. The prototype's fresher feel is
mostly this, not a wider palette, and using our own three does not touch §15.3.

**5. The icons are one family.** Consistent in Calculators and drifting
elsewhere. An audit, not a design exercise: list them, mark the strangers,
redraw them at one weight.

**6. The answer appears while the question is being asked.** Not after a button.

And a corollary of 4: **a warning says what will actually be lost, with a
number.** "Losing this device now means losing 3 trials and 5 photographs" is a
prompt; "no backup for a while" is a notice.

### Where the application already wins, and keeps its way

Plants reads more cleanly than the prototype's, whose thumbnail eats the column
and leaves "бояд…", "евка…". Calculators has more of them and is more compact.
The fabric form has a photograph field; the prototype has none. Substances at
26 rows reads better as a table.

---

## 13t. The reference screen answers while it is asked (0.88.0)

The screen the whole application exists for — "oak leaves on cotton with
aluminium acetate, what should I expect". It already returned exact and near
matches; the faults were in how they were presented.

**Results take the full width.** They sat in one half of a two-column split
while the four selects occupied the other, so every card was squeezed into
about 500 px. The question is short and the answer is long: the form is a
compact band across the top, the results run the width beneath it.

**The card leads with the source, not the colour.** It read colour-first, with
"madder, root" as a small grey line underneath. When the query does not name a
plant — the common case, and the one the near-matches exist for — the plant is
exactly what distinguishes one card from another. The swatch already carries the
colour, so the words carry what the swatch cannot.

**Conditions become chips** rather than a line joined with middots, per rule 3.

**Confidence becomes visible.** `confidence` has been on every combination since
the beginning and appeared nowhere on the search screen. A dot on the card, by
rule 4: weld for literature only, madder for contradicted, indigo for confirmed
by trials, and a quiet grey for unverified. The reference is a compilation until
the owner's own trials make it hers, and the screen should say which is which
without being asked.

**Each field says what "any" means for it** — "any plant", "any fibre class" —
rather than four identical "doesn't matter" rows.

Not adopted from the prototype: its right-hand pane holding the selected record.
Records here have their own screen, and a preview pane would be a second place
for the same thing to be shown and to drift.

The owner's intention: the library ships **already full**, from many sources, so
that a new person opens a tool rather than an empty notebook. Plants first,
substances and recipes after.

**§13.1 has to be revisited for this.** Attribution today works three ways — a
standalone Sources register that is deliberately *not* a field on every record, a
free-text `learnedFrom` on recipes and combinations, and a prose "Sources"
section on the plants. That was right while the library was hers and the sources
were two. It inverts for distribution: once a pack reaches someone who was not in
the room, the provenance of each claim is the only thing by which they can judge
whether to trust it. A structured link to `sources` is proposed, with free text
kept for the cases where the honest answer is "this is how it is done here".

**Facts are free; expression and compilation are not.** "Oak bark holds tannins"
belongs to nobody. The wording of a book does, and so — in the EU — does a
substantially extracted database. The risk is not one sentence; it is
*systematically working through a single source*. Hence a floor: **no plant ships
with fewer than two independent sources.** Own words remains absolute.

**Where the swatches come from.** Three routes, and they are not equal:

1. *The plant's own palette* — a colour, a free-text condition, no key. This is
   what the guide text supports: "yellow-green to brown; black with iron salts"
   is honest as a colour with a condition and would be a fabrication as a
   combination, which needs fibre, mordant, band and process. Forty of the fifty
   plants had no colour at all, and this is the route that lights them.
2. *Combinations* — only where a source actually names fibre, mordant and
   process. Most plants will yield none, and that is the correct answer.
3. *`resultHex` on a placement* — her own dyeing, and the only route that
   produces `confirmed` rather than `literature`.

**A hex derived from a colour name is an illustration, not a measurement**, and is
marked as such. Drafting the names, conditions and citations is compilable work;
choosing the swatch is a judgement about colour, which is her craft.

**Where the sources disagree, that is information.** "Dosing in the sources ranges
from 8% to 20%" is more useful than a number chosen by whoever was compiling.
`confidence` is per field, not per record, which the schema already supported
before anyone noticed.

**The division of labour.** A four-sheet workbook joined on `code` — plants,
parts, sections, colours — with a column naming what each record is missing. She
edits Bulgarian and fills gaps; the English columns stay empty and are translated
on the way back in. The sections sheet is **one row per plant, one column per
standard heading**: the first version was one row per section, which is how the
data is stored and not how a person reviews it. Wide also makes unification
happen by itself — moving text out of the OTHER column into a named one is
exactly the edit that retires an odd heading.

**Completed in 0.82.0.** Forty-eight plants, no gaps: 242 sections, 132 colours, 97 dosing rows,
80 parts. Confidence per field throughout — `practice` where it is hers, `literature` where it is
compiled.

**Nothing is merged without being shown first.** The load-back script reports
every change and only writes with an explicit flag. On the first return it found
2,894 characters fewer than the record held, across nine plants — some deliberate
shortening, some possibly lost in moving text between cells. The two are
indistinguishable from outside, and the consequences are not, so the difference
went back to her as a list rather than being resolved by guessing.

**A sheet is a snapshot, and merging against a moved target deletes things.** The
workbook was exported before the constituent texts existed. Rebuilding sections
purely from it would have removed twenty-one texts written in between; keeping
every absent section would have undone her editing of sixteen headings. Neither
rule is right, because absence means two different things. Told apart by the
library as it stood *at export*: present then and absent now is a removal;
absent then and present now is a later addition. Any future round trip needs the
same snapshot — §13e.5 in a second costume.

---

## 13v. Chains come out from behind their tab (0.88.2)

A chain is the more useful unit — nobody mordants without scouring first — and
it sat behind a tab, so a person who never pressed the tab did not know chains
existed. They stand at the head of the recipes list now, one card each, showing
the steps they are made of as numbered chips. The tab stays, for managing them.

Cards rather than rows, by §13s·1: the steps are the content, and a table cell
would truncate them.

**The list says the conditions, not the version.** The column read *Version*,
which is not a question anyone puts to a list. It reads `70 °C · 60 мин · +30
мин` — what the recipe will ask of you, which is what a list is scanned for.

**`appliesTo` has two shapes and both are read.** The model calls it a single
code on a chain and a list on a recipe; the studio's own chains carry a list.
Handed an array, `label()` finds no term and returns what it was given, so a
bare English "cellulose" appeared in the middle of a Bulgarian line. Rather than
correcting data to match the model or the model to match the data — a decision
that needs the owner — the renderer accepts both and the discrepancy is recorded
here.

---

## 13w. Techniques become cards (0.88.3)

The clearest case for §13s·1. A technique **is** its description — how the cloth
is folded, what the modifier does to the colour, when the wax will melt — and
the table cut it at 120 characters mid-word: "при ант…", "нароч…", "смачкани,
пасирани или като студена …". Truncating the content is not presenting it.

Cards, four to a row at desk width and one on a phone, each with the category
mark on a tinted plate, the processes it applies to, and the description. Where
a description will not fit, CSS clamps it — the whole text is in the markup and
the record has all of it, so nothing is thrown away before it reaches the page.

Guarded on the longest seeded description: the card must carry it complete, and
must not contain an ellipsis. The distinction matters, because the fix could be
undone by putting the truncation back and letting the clamp hide the evidence.

Plants, Substances and Recipes stay tables. They are read by comparing values
down a column, which is the other half of the same rule.

---

## 13x. Backup says what is at stake (0.88.4)

The screen listed what it could do; it did not say what it was for, and its
warning was a notice rather than a prompt.

**The banner names the loss, with a number** — the same sentence the home screen
uses, and now the same madder mark: "no backup has been made · losing this
device now means losing 2 trials · 1 fabric". Photographs were not counted at
all, and they are the part nobody can reconstruct.

**The channel is described by the questions a second channel would answer.**
The prototype's strength here was two columns — personal backup against
knowledge packs — with the same four rows down each, so the difference explained
itself. Packs are out of the 1.0 plan, so there is no second column to draw; but
the rows earn their place alone. *Contains · What it is for · On import · Last
backup* say plainly what the import dropdown only implies.

**Storage that is not guaranteed is a danger, not a caution.** It was weld; the
browser silently discarding everything belongs to the madder level.

**One thing, one name.** The navigation said *Резервно копие* and opened a
screen headed *Архив*; *Моята работа* opened *Тестове*. A person cannot tell
whether they are where they meant to be. Guarded in both languages, because it
is drift that arrives one screen at a time.

---

## 13y. The diary answers three questions (0.88.5)

Two were already answered: what is running, as rows with a stage rail, and what
is done, as photograph cards. The third was missing.

**What is waiting.** Mordanted cloth does not keep indefinitely, and a piece
prepared and then forgotten is the most avoidable waste in the studio. The list
of prepared pieces existed only inside the *new work* screen — reachable only by
someone who had already decided to start something. It is now a short row on the
diary itself: at most six, oldest preparation first, each one press from a new
trial through the handoff that already exists (§8.0c). Cloth already carrying
unfinished work is not offered — that belongs to the section above, and offering
it is how three half-written trials end up on one garment.

Six at most, deliberately. This is a prompt, not an inventory; the inventory is
one press away in Fabrics.

**The verdict is shown for every answer, not only for yes.** A finished card
carried a bare ↻ when the trial would be repeated and said nothing otherwise —
so *no* and *yes, with changes*, which are the more useful things to see at a
glance, were both silent. And one line of the reason goes on the card: the
verdict says what happened to this piece, the reason is what transfers to the
next.

**Not taken from the prototype: expanding the row in place.** It looks
immediate, but the record has an address and expanding gives it none — no back
button, no link, no reload. §13q settled that.

### A colour that contradicted its own rule

`success` wore madder and `failure` wore the quiet grey of a settled thing —
exactly inverted. By §13s·4 madder means something is about to be lost, and a
colour used against its own rule teaches the reader to ignore the rule. Success
is indigo, partial stays weld, failure is madder.

---

## 13z. The icon audit (0.88.6)

Asked for as a matter of style — the marks read as one family in Calculators and
drift elsewhere — the audit found something structural first.

**Three marks were serving seven places.** `i-tools` stood for both Substances
and Calculators, `i-recipe` for both Recipes and Sources, `i-packs` for Stock,
Backup and Packs. §13.4 says a mark accompanies a label and never replaces it;
a mark that does not distinguish accompanies nothing, and reads as noise beside
a label doing all the work alone.

Four new marks — `i-substance` (a flask with sediment), `i-source` (an open
book), `i-stock` (a lidded box), `i-backup` (an arrow into a tray) — all on the
same optical box, 3.5 to 20.5, at stroke 1.9 with round caps and joins. Thirteen
navigation entries, thirteen distinct marks.

Guarded by reading `app.js` rather than the DOM: the footer and the phone bar
are not always rendered, and a mark can only be shared by two entries that are
rarely on screen together — which is precisely when nobody notices.

The stylistic half of the request stands: the marks now share a weight and a
box, which was most of what read as drift.

---

## 13u. The home screen, in two halves (0.88.1)

Eleven tiles in one heap, while the navigation beside them had been in two
labelled halves since 0.72.0. The home screen now reads as the same two: the
reference is what you read, the diary is what you write.

**The diary counts states, not modules.** "Trials 3" is not a question anyone
asks; "how much have I got on the go" is. The diary half shows *in progress ·
planned · complete*, each a way into the same module, plus the fabrics count.

**The warning says what will be lost, with a number.** With no backup at all,
everything goes and the totals are exactly right: "losing this device now means
losing 2 trials · 1 fabric". With a stale backup only the work since is at risk,
and the change counter is all that is known about it, so that is all it claims.
It carries the madder mark and tint — §13s·4's "something will be lost" level,
which did not previously exist as a note kind at all: everything was weld.

**Counted nouns agree with their number.** `plural(n, one, many)` in `i18n.js`.
Bulgarian needs the counted form rather than the plural after a numeral — два
плата, never два платове — and "1 записани платове" in a warning meant to be
taken seriously reads as though nobody proofread it. Guarded, because it is the
kind of thing that returns every time a count is put into a sentence.

---

## 13aa. The phone is the whole application (stage 4)

The roadmap's note on stage 4 narrowed it to the diary, on the reasoning that
*the diary's faults are on the phone* — the reference half is read at a desk and
had been checked there. **The owner has rejected that scope, and the
specification already agreed with her.** §13o records that the first run of
`screen-check.mjs` found three faults, two of them in the reference half that was
believed checked: the plants list 561 px inside a 360 px panel, substances at
736 px, techniques at 509 px, with the last columns simply unreachable. The fix
applied then was `overflow-x:auto` below 820 px, and §13o names it as a stopgap
in the same breath: *stage 4 replaces the narrow table with stacked rows*.

So the reference was inside stage 4 from the moment the sixth layer was written.
The roadmap note was wrong, not the plan. **Stage 4 covers every address the
application has.** Opening the reference on a phone and finding it unrendered is
the same fault as opening the diary and finding it unrendered; that one is read
in the studio and the other at a desk changes when it is noticed, not whether it
is broken.

### What that is, counted

Thirteen navigation addresses, plus the tabs inside Reference (search, records)
and Recipes (recipes, chains), plus the five screens of *My work*, plus an opened
record in every module. `screen-check.mjs` walks twelve routes today: backup, the
trial screens after `new`, and every opened record are outside its reach.

Eight modules render a `table.grid`: plants, substances, materials, sources,
recipes, chains, fabrics, reference. That is the bulk of the work, and it is
mechanical and identical across all eight, as §13q is.

### The order, and why the guard comes first

1. **Extend the sixth layer before changing any layout.** All addresses,
   including an opened record in each module and the five diary screens. A
   narrow layout corrected by eye and confirmed by eye is corrected once per
   person who looks.
2. **A control shorter than 44 px fails on the phone viewport.** Today
   `screen-check.mjs` prints "a control is 19 px tall" as a *note*, at both
   viewports. On a desk a 19 px target is a small mouse target; in a wet hand in
   a garden it is not a target at all. The threshold is a failure at 390 px and
   stays a note at 1280 px. Tested in both directions before anything is
   restyled.
3. **One shared narrow-list pattern, not eight fixes.** The table becomes stacked
   rows below the breakpoint, by one rule against `.grid`, so a ninth list
   inherits it instead of repeating the fault.
4. **The diary screens**, with a pass on a real phone after each step.
5. **Home, calculators and backup.**

### §13q moves ahead of the layout work

The seven modules without `open()` are heavier on a phone than at a desk. There
is no sidebar there: the system back button *is* the navigation. A record with no
address of its own cannot be left by it — back exits the module, or the
application, instead of returning to the list. Addressing the seven is therefore
part of making the phone usable rather than a separate tidy-up, and it lands
before the stacked rows.

### The narrow list, settled

**Below 640 px, not 820 px.** Between the two — a tablet, a half-width laptop
window — a table with horizontal scrolling is tolerable and keeps the comparison
down the column, which is what a table is for. Below 640 there is no column,
only a single view, and the question changes with it: at a desk *which of these
has the most tannin*, in the hand *is this the plant I am looking for*.

**Three levels to a row and no more.** What the record is recognised by; its
second identity beneath, in the secondary colour; up to three chips, the rest
counted. Figures that read only in comparison — weights, WOF doses, dates — drop.
The swatch never drops, because the application is about colour, and neither does
a state mark (§13s rule 4).

**A plant's row carries three miniature swatches, not one.** Forty-eight plants
hold 158 swatches between them; one would assert a single answer where the
record's honest answer is a range.

**All eight lists, one rule against `.grid`.** The question was asked whether
short lists — sources, materials — should stay tables, and the measurement
answered it: the narrowest grid has four columns, sources carries a URL column
wider than the whole viewport on its own, and fabrics has eight. None is short.
Two patterns to maintain would cost more than the exception saves, and a ninth
list built later inherits the rule rather than repeating the fault. Fabrics keeps
its selection column as a touch zone at the head of the stacked row: it is the
seed of the bulk actions still outstanding, and deleting it to make a row tidy
would have to be rebuilt.

### Step 1, built (unreleased)

`screen-check.mjs` walks 23 views instead of 12: every navigation address, both
tabs of Reference and of Recipes, the backup, `#/trials/new`, and an opened
record in each of the eight modules that has one. Records with no address of
their own are reached the only way a person can reach them — by pressing the
first row — which converts to an address once §13q lands.

**Three faults in the layer itself, found while widening it.** All three had the
same shape: the layer was measuring something other than what it claimed to.

- **It waited 280 ms and then measured.** The plants list draws 48 rows from
  IndexedDB and had not finished, so a good part of what four releases of this
  layer looked at was a half-drawn screen. It now empties the view, navigates,
  and waits for content to arrive and stop growing. The rewrite alone turned up
  faults on screens that had been reported clean.
- **It printed "12 views, nothing past the edge" underneath its own failures.**
  A summary line that does not know whether it is summarising success.
- **The small-control note counted, and did not name.** "A control is 19 px tall"
  was printed at every release since the layer was written and never told anyone
  which control. It now names up to four, with sizes.

### What it found, on the first widened run

- **A plant record made the page 459 px wide in a 390 px window.** One
  sciencedirect URL in the Sources block: an address has no spaces, so it sets
  the minimum width of everything above it. The record itself read correctly —
  what broke was the **bottom bar**, which is the width of the page rather than
  the width of the window, and carried its last button off the right edge. On
  that record, on a phone, the navigation was gone. Fixed with
  `overflow-wrap:anywhere`, applied to links generally rather than to this block,
  since the next long address will not be in a plant.
- **A button on the first screen of the diary read `common.cancel`.** The key had
  no translation, in either language, for as long as the screen has existed. A
  missing key returns the key, which renders, which is precisely the fault
  described in principle 3: a fallback that produces plausible output hides what
  it is covering for. A new layer now compares every literal `t('…')` in the code
  against **each dictionary separately** — the first version read the file as a
  whole and let a key present in English and missing in Bulgarian through, which
  is the wrong way round for an application used in Bulgarian.
- **Twenty-two views have controls a finger misses**, now that they are counted
  properly: 37 px buttons throughout, 34 px tabs and selects, and the favourite
  star at 19 px in a list and 22 px in a record. This is not a list of bugs so
  much as the shape of step 2, and it is deliberately left failing rather than
  silenced.

**The suite is red on purpose.** `check.sh` will not pass until the controls are
sized, and nothing is released from a red suite. Step 2 is what turns it green.

### Fixtures before measurement

Only two of the eight could be measured at 390 px — plants at 562 px, substances
at 721 px. Materials, recipes, fabrics and reference render an empty state in a
fresh install, so the sixth layer's "nothing past the edge" on those routes is a
statement about an empty screen. A guard that passes because there is nothing to
draw is the guard that has never been seen to fail. Step 1 seeds a fixture record
per module before it measures.

**Found while measuring:** `sources` is declared in `PACKS`, with a comment
saying it is seeded deliberately rather than left to the owner, but the boot loop
in `app.js` loads only substances, plants, techniques and combinations. The four
attested sources §13r depends on are never written. The specification says four
are seeded and the application ships none. Fixed in 0.88.7, below.

---

## 13ab. The pack that was declared and never loaded (0.88.7)

Found while measuring table widths for stage 4: four of the eight lists could not
be measured because they render an empty state, and Sources should not have been
one of them. The specification says four sources are seeded (§13r), the pack
exists, and the screen said the owner had not written anything yet. An empty
state is indistinguishable from a library nobody has filled, which is why four
releases passed without anyone noticing.

**The first half: a second list of the same thing.** `PACKS` declares five packs;
`app.js` looped over four names written by hand. Now it loops over
`Object.keys(PACKS)`, so declaring a pack is what loads it. A hand-written list
beside a declaration is a second thing to keep in step and the first thing to
forget.

**The second half, and the worse one: the pack broke the contract it was seeded
by.** `seedPack` identifies a row by `code`, forms `seed:` + that, and skips rows
already in the database. `seed/sources.json` carried `id` instead. The computed id
was therefore `seed:undefined` for all four rows, never matched anything in the
database, and the row's own `id` — spread in after — silently corrected the
record on the way to storage. So the records would have looked right, and **the
skip would have been defeated on every boot**: each start of the application would
rewrite all four sources over whatever was there, resetting `editedByUser` and
`editedFields` and discarding the owner's edits to a source she had adjusted.

That is a data-loss fault, and it was hidden behind a rendering fault. Had the
missing line simply been added, the application would have started overwriting
her sources at every launch and the check suite would have said nothing. The pack
is normalised to `code`, as the other four are. Nothing referenced the old ids,
and neither the seed nor the studio's own database held any source record, so
there is nothing to migrate.

**The guard.** `deep-check.mjs` now compares every declared pack against the
database after boot, counting rows rather than asking whether the store is
non-empty. Tested in three directions before commit: a hand-written boot list
that omits a pack (*sources: 4 of 4 never arrived*), a declared pack whose file is
missing (*seed/sources.json is not there*), and a pack that fails partway through
(*2 of 4 never arrived*).

---

## 13ac. A chip names, a box is pressed (0.88.8)

The widened layer left twenty-two views with controls under 44 px, and the
question it raised was whether a chip is a control. Rule 3 of §13s says *a short
closed choice is chips*, and a row of chips at 44 px each is tall.

**The question was wrongly put, and the application had already answered it.**
There are two things wearing one word:

- **`.chip` is a `<span>`** — the conditions under a reference result, a
  technique's category, a plant's precautions. It names something and does
  nothing when pressed. It is a **label**.
- **`.box` is a `<button>`** — the role filter in Plants, the state filter in
  Fabrics. Pressing it changes what the list shows. It is a **control**, and it
  is what rule 3 means.

So the principle is not a choice between them: **what changes the screen when
pressed is a control and is sized for a finger; what only names something is a
label and must not look pressable.** A row of labels at 44 px would be setting
prose for a finger; labels are outside the threshold entirely, which is why the
row of chips under a reference result stays as it is.

They look alike, which is how they get confused, and the confusion costs in both
directions: a `.box` that is not a button escapes the finger target, and a
`.chip` that is a button invites a press it is too small to receive. `check.sh`
now refuses either — tested with a chip made into a button and a box made into a
span.

### The 44 px rule

One block below 640 px, against `.btn`, `.tab`, `.box`, `.fav`, `.moreitem`, the
bottom bar, and text inputs and selects. Two things needed care:

- **The star is square.** A 44 px-tall target 22 px wide is still missed, so it
  takes `min-width` as well.
- **A checkbox cannot be stretched**, so the label around it carries the target —
  which every checkbox in the application already had except the fabric
  selection box, the seed of the bulk actions. It has one now. The layer measures
  the label rather than the input, because pressing a label toggles its input:
  measuring the box itself would report a fault that is not there and hide the
  one that is.

Twenty-three views, both viewports, clean. What remains on the desk is a note
rather than a failure: a 37 px button is a small mouse target and a fine one.

### A guard that fails at random

One run in a dozen reported *the fixture did not land* on a list that had
forty-eight rows a moment later. It asked once. It now polls for up to three
seconds — then failed again, on a different screen, once more in a dozen. The
cause is the service worker reloading the page mid-run, so three seconds does
not cover a whole boot. The budget is nine, and the address is asked for again
halfway through in case the reload landed elsewhere. A guard that fails
intermittently is worse than no guard: it teaches whoever runs it to run it
again rather than to read it. Ten consecutive clean runs before this was
written down.

---

## 13ad. The seven modules get their address (0.88.9)

§13q converted `trials`, `tools`, `recipes` and `chains` and left seven modules
whose records opened only by click: `plants`, `substances`, `techniques`,
`materials`, `sources`, `reference` and `packs`. It is mechanical work, which is
why it waited — and why it landed before the stacked rows rather than after. On
a phone there is no sidebar: **the system back button is the navigation**, and a
record with no address of its own cannot be left by it. Back exits the module, or
the application, instead of returning to the list.

Six are converted. `packs` is out of the 1.0 plan and has no records to address.

### The scheme, identical across all six

```
#/<module>              the list
#/<module>/new          a new record
#/<module>/<id>         the record
#/<module>/<id>/edit    editing it        (plants and reference)
#/reference/records     the records tab
```

**Editing is in the address, not in a variable.** It is a different screen:
leaving the editor with Back should reach the record, and a reload in the middle
of an edit should not silently drop into the read view.

**The reference tab sits inside the reference address**, as chains sit inside
recipes and for the same reason: `activeNav()` lights a navigation entry by
module id, so a separate address would light nothing. A record keeps whichever
tab it was opened from, because the two tabs are two ways in to the same records
and Back should return the way one came.

**Filters and search stay module state, deliberately.** They are how a list is
being looked at, not what is being looked at. §13q already established that they
survive opening a record and coming back.

### Three faults found on the way

**The conversion script reported success it had not achieved.** Written as a
script rather than typed six times, because a mechanical change made by hand is a
mechanical change made six slightly different ways. It printed *converted* for
`techniques` while inserting nothing: the pattern expected a comment above
`reset()` and that module has none. It had rewritten the click handlers, so the
module was left navigating to addresses that nothing obeyed. **A script that
reports what it intended rather than what it did is worse than no script — the
fault arrives wearing a success line.** It now asserts its own result and exits
rather than writing.

**`#/reference/records` resolved to the wrong screen, and had for as long as it
existed.** The sixth layer walked that address and reported it sound; without an
`open()` the module ignored it and rendered the search tab, so what was being
measured was the search screen under the records screen's name. Once the tab
worked, the screen appeared on a phone for the first time and overflowed: the
header actions ran 13 px past the edge and the tab switch clipped, leaving
"Записи" as half a word. The header actions now wrap below 640 px.

**Saving became leaving.** Every converted module changes the address after a
successful save, and the unsaved-work guard reads an address change as a
departure — so saving asked whether the person wanted to lose their work.
`dirty.js` cannot tell the two apart from outside; it infers a successful save by
watching the form leave the screen (§13f), which is right for a click and useless
for a hash change that happens first. Inside the module the answer is known, so
after a successful `put` the work is marked saved before the address moves.

### The guards

The six modules are checked mechanically, because six near-identical edits are
six chances to convert five of them. Each is asked three questions: does the
module have an `open()` at all, does an address open the record, and does an
address naming no record return to the list.

**The first question is not redundant.** The router calls `MODULES[id].open?.()`.
A module with no `open()` therefore fails *silently* — the address is ignored and
the list appears, which looks exactly like a working list. That is how seven
modules stayed unconverted through four releases without anything failing.

Tested in the failing direction, three ways: `open()` removed (*substances has no
open() — its address is ignored, not obeyed*), an `open()` that sets an id but
never clears it (*an address with no record left the last one open*), and a save
that does not clear the unsaved mark (*saving was treated as leaving*).

### And the guard for this had a blind spot

Inserting §13ad above §14 swallowed the `## 14. Technical architecture` heading:
the replacement matched the heading and did not put it back. That is §13l's
fault exactly, in the same way, with the guard written after §13l already
installed — and it said nothing, because it watched `^## 13[a-z]+\.` and the
section lost was §14. **A guard narrower than the fault it is named for is a
guard that will one day report clean over the thing it exists to catch.** It now
watches every numbered section, sub-numbers included, and was seen to fail on
both a lost §14 and a lost §13ad.

---

## 13ae. A list below 640px is not a table (0.89.0)

The last of the geometric work in stage 4. A table exists so that values can be
compared down a column; on a phone there is no column, there is one view, and
the question changes with it — at a desk *which of these has the most tannin*, in
the hand *is this the plant I am looking for*. Plants measured 562 px inside a
390 px window and substances 721 px, and the sideways scroll allowed in §13o was
always named a stopgap. It is removed here with its cause.

Each row becomes a card. Eight lists — plants, substances, materials, sources,
recipes, chains, fabrics, reference — under one rule against `.grid`.

### The heading has to reach the cell, and CSS cannot fetch it

`attr()` reads the element's own attributes; it cannot reach across the table to
the header row. So `labelCells()` in `ui.js` copies each column heading into its
cells at render. **Once, centrally, rather than written into the markup of eight
modules**: eight copies of one fact drift apart, and a ninth list built later
would inherit nothing.

**Watched, not called.** The first version ran after `render` in the router, and
that labels the first draw only — a module redraws its own list on every
keystroke of the search and every filter press without passing through the
router. The rows would have been unlabelled at exactly the moment someone was
narrowing a list to find something. A `MutationObserver` on the view now does it,
disconnecting around its own writes so it does not trigger itself.

### Three judgements, each made from a measurement

- **The lead cell is decided by position, not by a class.** The first cell whose
  column has a heading heads the card, at reading size and with no label over it:
  a card reading "ИМЕ  дъб" is a form, not a plant. The star and the selection
  box have no heading, so they are skipped automatically and sit in the corner of
  the card, keeping their 44 px target.
- **An empty cell is dropped.** In a table the empty cell is the shape of the
  column and must stay; in a stack it is a line spent saying "МОСТРА —".
- **Prose is clamped to four lines, by length rather than by class.** `.clip`
  exists on some tables and not others: the sources note carries none and came
  out 405 px per row, one record filling half the screen. Length is the fact that
  matters, and it is the same fact in every list. 405 px became 192.

Nothing else is dropped. Which columns a phone does not need is a judgement to
make with the lists in the hand, not one to guess at here.

### The guard

Every other assertion in the sixth layer would pass on a list that had quietly
gone back to being a table — it would simply scroll sideways inside its panel,
which is the arrangement the stopgap allowed. So the layer now asserts the shape
itself: below 640 px a row is `display:block`, some cell heads it, and a
non-leading cell renders its heading; above 640 px the row is still a
`table-row`, because a phone rule that reaches the desk is the same fault
mirrored. Seen to fail in both directions — the stacking rule removed, and the
lead cell removed.

**And a fault in the harness, not the app.** `watchLists()` broke both jsdom
layers with *MutationObserver is not defined*: jsdom has it, but the harness
hands globals over one at a time, so a gap in the harness reads as a throw during
start-up. The same case as `Event` in §13e.4, and fixed the same way.

---

## 13af. The calculators did not calculate (0.89.1)

Reported by the owner: *the calculators do not work — either a recompute button
is missing or something is not thought through, because if I change the default
values nothing happens.* Both halves of that guess were wrong and the diagnosis
was right. Nothing happened.

**There was no `input` handler on the calculators at all.** The `change` handler
returned early for anything that was not a `<select>`. So every number on every
one of the seven calculators — weight of goods, percentage, litres, ratio,
vinegar strength — could be retyped and the answer would not move. Only the two
dropdowns did anything.

**The comment above it said the opposite**, and had since the calculators were
written: *recompute on every keystroke: a calculator that needs a button pressed
is a calculator that gets used once and then done on paper again.* The intention
was recorded, the code never carried it out, and the comment is why it survived
four releases — the file was read and believed. A comment is not a guard, and
this is the second time in this stage that a stated intention has stood in for a
tested one (§13ad).

It is also rule 6 of §13s, in the module the rule most obviously describes.

**A second fault underneath it.** The timer's minutes field is written as
`data-calc="timer.minutes"`, but the timer keeps its own object rather than
living in `state`, so `state['timer']` was undefined and writing to it would
have thrown. It never threw, because nothing ever called `apply()` for a number
field. Fixing the first fault would therefore have replaced silence with an
exception on the timer screen. The group is now resolved by name.

**The caret has to be put back.** Recomputing redraws the panel, which replaces
the very input being typed into: without restoring focus and selection the field
is lost on the first keystroke, which is worse than not recomputing at all.

### The guards

Driven through the events a person actually generates, not by calling `apply()`
directly, because the entire fault was in what was listened for. Three, each
seen to fail: the reading on screen changes while a number is being typed; the
field being typed into keeps its focus; and the timer face takes the minutes it
is given.

### Calculators and backup on a phone

Checked at 390 px and sound as they stand — nothing past the edge, nothing
clipped, every control at 44 px since §13ac. The picker, the seven calculators
and the backup needed no narrow layout of their own, which is the answer stage 4
wanted from them rather than a lack of one.

---

## 13ag. The diary shows the work, not the plan (0.89.2)

Four things reported by the owner after real use, three of them one fault each
and the fourth held back as its own conversation.

### The picture that stands for a piece of work

The list led with `planPhotos[0]` while work was running and `resultPhotos[0]`
once it was finished — the plan, and the *first* result rather than the last. So
the diary was illustrated with what was intended instead of what happened, which
is the opposite of what a diary is for.

Her rule: the last photograph of the finished work, or the last in the sequence
if it is not finished, and the cloth's own shot before either exists.

**No new rule was needed.** `photoTimeline()` in `fabric-logic.js` already orders
every photograph of a piece — the cloth, the plan, the placements, the steps, the
result — by date with rank breaking ties, and it was used only by the fabric
record. The cover is its **last item**, and the fallback then falls out rather
than being written: work with nothing photographed yet has only the cloth's shot
in its timeline. One function, one call, no second branch to keep in step.

### Reading how a piece developed meant opening every step

The `.lifestrip` — the whole life of a piece in pictures, in the order it
happened — was built, styled and rendered **only on the cloth**. The trial, which
is where the pictures are taken, had none: the result photographs after the first
were shown as a loose grid with no order and no captions, and everything in
between was behind a step that had to be opened one at a time.

The trial now carries the same strip, from the raw cloth to the result, each
frame captioned with the stage it belongs to. The steps stay folded for what they
carry besides a photograph.

### Finishing, from the list

Closing a piece meant going round through the cloth. There is now a **Finish**
action on the running row, and it goes to screen 4 rather than setting `status`
where it stands: the five questions are what finishing *is* — the result, the
verdict, and the cloth's change of state. A row that marked work complete on its
own would leave all three unasked, and §8.0e's rule that Fabrics owns a piece's
state would be quietly broken by the diary.

It sits beside the row, not inside it, because the row is itself a button.

### The entry form was long because one rule was applied to half the screen

§8.0e says **a step is one line, and opens in place, one at a time**. Placements
were never given the same treatment, so seven of them rendered open at once —
each with plant, part, condition, facing, print quality, local treatment, a note
and a photograph. On the owner's own screenshot that was most of the length of
the form.

A placement is now one line: the photograph where a step has its number, then the
plant, the part, and what the reference expects of it. Opening one closes the
step that was open, and a newly added placement opens itself, since a placement
added closed is a placement nobody can fill in.

**This is not a redesign; it is a decision from 0.73.0 finally applied to the
thing beside the one it was written for.** Which is worth naming as a pattern:
both this and §13ad were rules that existed, were believed, and had never been
checked on every place they claimed to cover.

### Held back, deliberately

The larger observation — that the active trial reads as **a form to fill in**
where the prototype reads as **a story to follow** — is not a fault to be patched
and is not attempted here. Two modes of one screen, entering and reviewing, is a
design conversation the owner has asked to have separately.

---

## 13ah. Three from the open list (0.89.3)

### The render race

Two renders of one module could be in flight at once, and the one that finished
last won rather than the one that was asked for last. Every `render()` is
asynchronous — it reads the database, resolves vocabulary, waits on photographs
— and writes `innerHTML` only at the end. It never bit in a browser, where a
person cannot press twice that fast; it bit in the check suite, which can.

The router now carries a **generation**, so a render that has been overtaken
abandons rather than draws, and a **chain**, so the next starts only after the
previous has finished. Without the chain, "have I been overtaken" is asked
before the overtaking request exists.

**Reported honestly: the guard fails only when both are removed.** Each half
alone survives the test, because `parseRoute()` is read inside the draw rather
than captured when the render was asked for — so a slow render that arrives late
draws the *current* address, not the stale one. That is an accidental
protection, not a designed one, and it would disappear the moment the address is
captured earlier for any reason. The pair stays.

### The ceiling, where the iron is actually poured

`recipeWarnings()` has enforced substance ceilings since the calculators were
written. A trial enforced nothing, so the application was silent at the one
moment that costs cloth. A recipe is a plan and can be reconsidered; a step is
something being done to cloth that exists.

`trialStepWarnings()` sits beside it in `calc/scale.js`, pure and DOM-free, and
does three things and no more: the step's own temperature against the ceiling of
every substance in play; the step's recipe scaled to this cloth and passed to the
existing function rather than a second implementation of the same rule; and the
medium modification, **only when its amount is written as a plain percentage**.

That last restriction is the considered part. The amount is free text — "2 г",
"около лъжица", "1%" — and a parser that guesses would raise warnings against
numbers nobody wrote. Reading "8 г" as eight per cent is the specific failure,
and it is guarded. **Silence on an unparseable amount is honest; a wrong warning
teaches the person to dismiss the right one.**

The mark shows on the shut step as well as inside it, in madder, because the
step being worked is usually the one that is closed — and a warning that appears
only after opening is silent exactly when it matters. The fibre mismatch is
dropped inside a trial: by the time the cloth is in the bath it is not news, and
a warning that cannot be acted on is noise.

### Asking the reference backwards

"Oak on cotton with alum acetate, what should I expect" has worked since 0.88.0.
"I want this colour on this cloth, how do I get it" has been in the
specification from the first day and is the other reason the library exists.

**One form, not a second screen.** Colour is another criterion that narrows like
every other, and an empty one widens. What changes is what the answer *is*: when
a colour is asked for, the conditions are the answer rather than the question.

- **The colour never makes a record exact.** It orders what the other criteria
  have already allowed and says how far off each one is. A colour matches
  everything to some degree, and fifty records sorted by distance is not an
  answer.
- **Distance is measured in Lab**, in `calc/colour.js`. Arithmetic on the sRGB
  channels is not a distance the eye agrees with, and the palette proves it: two
  wells of weld come out *further apart* (40.9) than iron is from indigo (38.8),
  which is nonsense to anyone looking at them. In Lab it is 9.9 against 21.9.
  ΔE76 rather than ΔE2000 — the newer formula is better and does not change
  which three records come back first, and this is read by one person who will
  want to know why a number is what it is.
- **A record with no swatch is left out, not put last.** A record that cannot
  answer the question must not appear to have answered it badly.
- **A colour nothing comes near returns nothing.** A list ordered by distance
  always has a first item, and offering the least bad of fifty as an answer is
  the fallback-that-hides-the-fault in another costume.
- **The difference is put in words** — lighter, darker, stronger, greyer. "14.3"
  tells the person nothing they can act on.

---

## 13ai. "About" — the smallest useful part of a larger idea (0.89.4)

A number field has two states: empty, or a number. What is actually true has
four — **measured**, **about**, **unknown**, and **not applicable** — and the
field collapses two of them into "empty" and two into the number itself. So the
application cannot tell a thermometer reading from a good guess, or "nobody
knows" from "I have not got to it yet". The seeded library shows the second half
of this plainly: `liquorRatio` and `dryingRatio` are empty on all forty-eight
plants, and nothing on screen says whether that is unknown or unfinished.

The owner chose to build **only "about"** for now, and to leave the full
proposal recorded for later (§16). That is the right cut, because "about" is the
one of the four that changes what the application *says* rather than what it
merely stores.

### Where it lives

Beside the confidence, and stored the same way: a map keyed by field path, so a
field that is not marked is simply absent from it. The principle was already
accepted and already implemented on one half — `confField` has recorded *where a
claim came from* since the plant profile was built. It never recorded *how firm
the number itself is*. A record could say "from the literature" and still present
somebody's rough eighty as a measurement.

Six numbers in a plant carry the mark, through `confField` itself rather than
one at a time, and the step temperature in a trial carries it too.

### What changes because of it

- **Reading.** `≈ 80 °C` rather than `80 °C`.
- **The ceiling warning changes its tone, not its existence.** A temperature
  marked as an estimate produces a caution in weld — *about 78 °C against a
  ceiling of 80 °C, put a thermometer in* — instead of a verdict in madder. The
  warning written in §13ah would otherwise make a flat statement about a guess,
  which is the fault the mark exists to prevent, arriving through the door of
  the fix for a different one.

### Guards

The mark survives the round trip, an estimate does not read as a measurement,
and an empty value is not marked as "about nothing". Plus the tone change in the
ceiling check. All four seen to fail.

**One fault found while building it:** a checkbox cannot go through the loop
that reads a step's fields, because `el.value` on an unticked box is still
`"on"`. Read as a value, every step would have come back marked as an estimate.

---

## 13aj. A colour search answers in a table (0.89.5)

Reported with a screenshot: twelve results, each a full result card squeezed
into a column a few characters wide, one word per line, the whole answer a page
of scrolling.

Two faults, and the second is the interesting one.

**The wrapper.** `resultCard` has its own internal layout, and §13ah wrapped it
in a two-column grid to put a swatch and a difference beside it. The card was
crushed into the second column. That is simply a mistake.

**The form was wrong to begin with.** Rule 1 of §13s: *prose or an image →
cards; numbers to compare → a table.* A colour search returns the same few
values across a dozen records, looked at against one another — which is what a
table is for. Cards were reached for because the forward search uses cards, and
the forward search is right to: there one is reading a handful of matches, each
with its variation text and its caveats. Backwards, one is scanning for the one
to open.

So the answer is a table: swatch, how it differs, the colour in words, what it
comes from, the conditions, confidence. Sixty-five pixels a row rather than
three hundred. **And it becomes stacked rows on a phone with nothing further
written**, because §13ae's rule is against `.grid` rather than against any one
list — the first list built after that rule to inherit it for free.

Guarded: a colour search returns rows and no `.refcard`.

---

## 13ak. A recipe that is computed, not remembered (0.89.6)

The owner brought three things at once: does Chandra Rice's calculator cite
sources, why does hers change the soda and vinegar when the aluminium salt
changes while ours does not, and why does a recipe attached to 55 g of cloth
give different figures from the calculator for the same 55 g.

### What her calculator rests on

One citation, for one number: the 120 g/L saturated-soak concentration, from
Boutrup and Ellis. Everything that moves when the hydration changes is not
observation and not cited — **it is stoichiometry**, the same arithmetic done
here. Her own explanation page describes the mechanism in molar terms. So the
suspicion behind the question was right: nobody has run trials across six
hydration states of aluminium sulfate.

### Why hers moves and ours did not — both are correct

The basis. §5.1 already names this and calls it the threefold trap, and
`basis_refers_to` has been in the vocabulary since then with exactly two values.

- **Finished product.** The target is a fixed number of moles of acetate. Three
  acetate groups per aluminium, so the acetate equivalents are fixed, so the
  soda and the vinegar do not move. Only the weight of the salt changes — 2.8 g
  of anhydrous aluminium sulfate carries the aluminium of 7.8 g of potassium
  alum.
- **Raw input.** The weight of the salt is fixed, so the moles of aluminium in
  it move with the hydration, and everything downstream follows.

Ours offered only the first. Hers offers both, which is why hers appeared to
know something ours did not. **The calculator was not missing chemistry; it was
missing half of a distinction the specification had already made.** The third
time in this stretch that a rule was written and applied to one side only
(§13ad, §13ai).

### Checked against the book

The standard recipe the owner quoted — 18% alum, 10% soda ash, 240% of 5%
vinegar — was run through this stoichiometry. For 100 g of cloth it needs 9.6 g
of soda ash and 218 mL of vinegar **if the alum is aluminium sulfate at about
14-hydrate**: within roughly 10% of the published figures, a sensible working
excess to drive the reaction. For potassium alum the same 18% needs 6.0 g and
137 mL, so following the recipe with potassium alum means about 65% excess soda
and vinegar — and excess carbonate is not harmless, since it raises the pH and
can precipitate aluminium hydroxide instead of leaving acetate in solution.

That cross-check now sits on the calculator screen with the citation, rather
than in a conversation.

### The two answers that disagreed

The real fault, and ours. The calculator worked from molar masses; a recipe
stored percentages. **Two copies of one piece of chemistry, and they had already
drifted apart on screen** — the owner's own phrase for this class of fault, from
§13ab, is that a second list beside the declaration is a second thing to forget.

A recipe may now declare `computedBy` with a target instead of storing
quantities. "Eight per cent aluminium acetate, made from whatever is in the
cupboard" is a target and a set of roles; the numbers appear when the recipe
meets a cloth weight, and they are the calculator's numbers because they are the
calculator's function. Everything else about a recipe — alternatives within a
role, conditional ingredients, the steps for mixing — is untouched, because the
computation overwrites quantities rather than replacing the path.

Where sodium acetate is chosen the acid line is marked not needed rather than
set to zero: an ingredient reading "0 ml" is an instruction to add none of
something, which is not the same as an ingredient that has no place in this
version of the reaction.

### Guards

Three, each seen to fail: a computed recipe returns exactly the calculator's
figures; on the finished-product basis another hydrate changes the weight of the
salt and nothing else; on the raw basis the soda follows the hydration. The
second is the one worth having, because it encodes the thing that looked like a
bug and is not.

---

## 13al. Finishing a piece of work did not finish the cloth (0.89.7)

Reported with a screenshot: a garment appearing on the same screen under
**finished work** and under **ready to work**, still marked mordanted, after the
work on it had been closed.

§8.0e question five says the finishing screen changes the state of the cloth,
and Fabrics remains the only owner of that state. Two faults meant it never
happened, and the second one made the first invisible.

### The default was to do nothing

The state chooser offered *leave the state as it is* first and selected. So a
person who finished a piece of work and answered the four questions that matter
to them left the fifth alone, and the cloth stayed where it started. **A screen
whose stated purpose is to change something must not default to changing
nothing** — and doing nothing silently is worse than asking, because it produces
a record that looks complete.

Now the state the work implies is offered already chosen: `finished`, because
screen 4 is where work on a piece ends. A piece only part-way through — dyed
now, printed next week — is the case for choosing `dyed` deliberately. Leaving
the state alone is still possible and is now a choice rather than the absence of
one.

### And underneath it, the list was being rebuilt from the screen

Even with a state chosen, nothing would have been written. `readWork()` rebuilds
`fabricIds` from the checkboxes it finds, and screen 4 renders none — so
finishing emptied the list of pieces, and the loop that writes the state event
had nothing left to write to.

The file warns about exactly this, four lines below, about steps: *a reader that
treats the screen as the whole truth is only correct by accident.* The note was
written when steps began rendering collapsed, and the same reasoning was never
applied to the three lists above it. A list is now left alone when the screen
offers no control for it.

**Third time in this stretch that a rule was written down and applied to one
side of the thing it describes** (§13ad, §13ai, §13ak). It is worth naming as a
habit rather than three coincidences: the fix is written where the fault was
found, and the same sentence is not carried to its neighbours.

### The records already written

Fixing a default does not correct what is stored. A piece whose most recent
completed work is newer than anything its own state records is marked in the
ready list — in weld, as something to attend to — with the way to settle it. It
reopens the finishing screen of the work that left it stale rather than writing
a state event from a card: the five questions are where a piece is closed, and
answering them again is how the record becomes right.

### Guards

Finishing proposes a state rather than proposing nothing, and the cloth records
what the finished work did to it, with the trial named in the event. Both seen
to fail — the chooser reordered as it was, and the list rebuilt from the screen
as it was.

---

## 13am. A finished piece is not a finished cloth (0.89.8)

A shawl printed in June, then re-mordanted with aluminium acetate and a
carbonate bath and printed over in August. Nothing supported it: `finished` read
as the end of the piece rather than the end of a run.

Three decisions, taken with the owner.

### One card per piece, the runs inside it

Two cards side by side say two things exist. The card shows the piece as it
stands now — the most recent run leads — with the earlier runs listed beneath.
Work touching several pieces is filed under the first of them rather than
repeated under each, because repeating it would make one afternoon in the studio
look like five.

### The new work starts from the last photograph of the old

Not the plan, not the raw cloth: the last frame of the previous run is literally
what is in the hand when the next begins. It comes from `photoTimeline()` again,
which means no new rule and no second definition of "most recent".

### The ground is recorded, automatically

Oak on white silk and oak on a shawl already printed rust are not the same
question. A combination matched against the second while keyed on the first
answers the wrong one. So a repeat run carries `groundFrom` — which run, when,
its last photograph, its colours — written without being asked for, because the
person starting the second print already knows what it is standing on and the
application is the one that needs telling.

Working a piece again uses **the same address as starting from a ready piece**.
It is the same act; the handoff decides for itself whether the cloth arrives raw
or already carrying a print. A second path would have been a second thing to
keep in step.

### And a real fault the guard found

The fixture entered a cloth today and its June work afterwards — which is the
ordinary way past work gets recorded — and the ground came back as the *blank
cloth*. `photoTimeline()` dated the cloth's own shot by `createdAt`, when the
**record** was made, not when the cloth was acquired. So the raw shot sorted
last and "the most recent photograph" (§13ag) returned the piece before anything
had been done to it.

The cloth as it arrived is the beginning of the piece by definition, and it is
now sorted there rather than by a date that means something else. This would
have shown up as covers quietly reverting to blank cloth for any piece entered
after the fact — silently, and looking like nothing was wrong.

### Guards

A finished piece offers to be taken up again; the new work starts from the last
photograph of the old and names the run it came from; raw cloth is not given a
ground it does not have; and the strip leads with the cloth even when its record
was created last. All seen to fail.

---

## 13an. Three doors to "complete", one of them a trapdoor (0.89.9)

The owner went to correct the garment from §13al and came out with a *second*
finished record, an empty one, while the cloth still read mordanted. Neither
half was her mistake; both were doors this application left open.

### Pressing the piece started a new piece of work

The card under "ready to work" is a button that begins new work from that cloth
— which is right for a mordanted piece waiting to be used, and wrong for the
one case where the card is displaying a contradiction. The correction was a
quiet line *underneath* the button. Pressing what looks like the piece created
work titled after the cloth, dated today, illustrated with the cloth itself
because it had nothing else yet.

**The main action must be the one the card is there to offer.** When a piece
contradicts itself, settling it is the card; starting new work steps down to a
quiet line beneath. The same two actions, the other way round.

### The status chips reached "complete" without passing anything

Three doors led to complete: the Finish action on a running row (§13ag), the
button on the working screen, and the status chips. The chips went straight
there. So work could enter the finished column with no result, no verdict and no
change to the cloth — which is exactly how the garment came to appear under
"finished work" and "ready to work" at once, twice, by two different routes.

The chips now write the status and go to screen 4. The status is written first,
so nothing is lost if the person turns back.

**Work is not finished because a control says so.** It is finished when it is
known what it gave and what became of the cloth. Any path to `complete` that
does not ask those things produces a record that looks complete and is not —
the same fault as §13al's silent default, arriving through a different door.
Two versions in a row have now been spent on this, which suggests the useful
rule is not "fix this door" but **one screen owns finishing, and every route
leads to it.**

### Guards

Marking work complete from the chips reaches the finishing screen; a piece that
contradicts itself is settled by its own card rather than starting new work.
Both seen to fail.

---

## 13ao. Work that points at no cloth (0.90.0)

The owner's backup, sent while repairing the garment: a record dated 9 August
with five steps, seven placements and `fabricIds: []`. All the history and no
piece. It is the wreckage of §13al — `readWork()` emptied the list at the moment
that work was finished — and it explains everything that followed: the state
could not be written because there was nothing to write to, the record could not
be grouped under a piece, and a second, empty record ended up carrying the cloth
instead.

Told to attach the cloth, she could not find where. **The panel is inside a
folded strip called "about this work".** Folding it is right once the cloth is
chosen; on the one record where the question is unanswered it hides the answer.

So: work with no cloth opens that strip itself, marks it in weld, and says in
words why it matters — it cannot change a state, is filed under no piece, and
takes no part in the life of one. The diary marks it too, where it is listed,
with the way back.

**Ordinary work stays folded.** A mark that appears everywhere is not a mark,
and that is guarded in the same breath as the fault.

### The shape this keeps taking

Four versions now — §13al, §13an, this — have been one fault in different
clothes: **a record that looks complete and is not.** The empty state chooser,
the status chips, the emptied cloth list, the folded panel. None of them
announced anything; each produced a plausible record. That is the principle from
§4 stated the other way round: *a fallback that produces plausible output hides
the fault it is covering for* — and a screen that quietly omits is a fallback
too.

What follows from it, and is worth applying beyond the diary: **a record that
cannot do its job should say so where it is listed, not where it is opened.**

---

## 13ap. A dye bath had nowhere to put its colour (0.90.1)

Asked by the owner, and exactly right: *do we record a colour for the plant from
dyeing, or only from eco print?* Only from eco print. She had dyed with madder
and had no swatch to show for it.

`resultHex` lives on a **placement**, and placements were offered for eco print
alone — reasoning, in a comment, that a card headed "plants and prints" asks a
question a dye bath never poses. True of the heading, and wrong in what
followed: the bath was left with nowhere to say what went into it or what came
out. No swatch on the card, nothing reaching the plant, and nothing findable by
the colour search built in §13ah.

### No new carrier

A placement already holds what the bath needs: which plant, which part, in what
condition, what colour it gave, and the link to a combination. What is
particular to printing is only **where the leaf lay** — facing, print quality,
local treatment, the photograph of it in place — and that was already behind
`isEcoPrint`.

So **a bath result is a placement without a position.** The block is shown for
immersion under its own heading, *dyestuffs and what they gave*, and the
position questions stay where they were. A second carrier for colour would have
been a second thing saying one thing, and the two would have drifted — the fault
of §13ak, invited back in.

### And it had to be reachable before anything else exists

The placements card attaches under the first colouring step, with a fallback for
leaves recorded before any step is written. That fallback required a placement
to *already be there* — fine for leaves entered from a photograph, useless for a
bath, where there was then no way to add the first one. A record's first entry
cannot require a previous entry.

### Guards

A bath can say what went into it, is not asked where the leaf was facing, and is
asked at the finish what colour it gave; eco print keeps its position questions
— because a fix for one process that quietly takes something from another is not
a fix. All four seen to fail.

---

## 13aq. Saving a recipe threw, and had for as long as it has existed (0.90.2)

The owner reported something small: doing a dyeing with no recipe for that
plant, there is no way to write one from the step. Following it found three
things stacked on each other, and the bottom one was live in the application.

### The button did half of nothing

There is a `+` beside the recipe chooser on a step. It went to the recipes
**list** rather than to a new recipe, wrote a memo of where to return, and on
save came back to the trials **list** with nothing attached. So the person wrote
the recipe, returned, and then had to find the trial, find the step, and choose
the recipe by name — most of the work the button existed to save.

Now it opens a new recipe, remembers **the step by id rather than by index** —
coming back to a record that has gained or lost a step meanwhile would otherwise
attach the recipe to the wrong one — and on save attaches it and lands on the
work.

### The memo was written and never read

`returnTo` was declared in `recipes.js` and loaded from settings **nowhere**. The
variable held `null` for as long as it has existed. Every part of the round trip
downstream of it was therefore dead code that looked alive.

### And underneath: `flash` was never imported

`recipes.js` calls `flash(t('common.saved'))` after saving, and never imported
it. In a module that is a `ReferenceError` at the moment the line runs. So
**every save of a recipe has thrown** — after `put`, so the recipe was written,
and before everything else, so the screen did not move, the version did not
bump, and nothing was reported. From the outside: press Save, and the page sits
there.

It was found only because the round trip built on top of it silently did
nothing, and I went into a real browser to see why rather than assert that the
code was right. jsdom showed a click that did nothing; Chromium showed the
`ReferenceError`.

### The guard that should have caught it

`check-scope.js` exists for exactly this class — its own comment says the
symptom is *a screen that has simply stopped responding, with nothing obviously
wrong*. It catches an **assignment** to an undeclared name. A **call** to a name
that was never imported walked past it.

It now also reports a call to a function that a shared module exports and this
module has not imported. Deliberately narrow — only names some shared module
actually exports, and a local definition of the same name shadows it — so that
it cannot cry wolf. Two corrections while writing it, both in the direction of
quieter: method shorthand (`open(first) {`) is a declaration and not a call, and
declarations are read from the raw source rather than the stripped copy, because
stripping loses some and **a declaration missed becomes a false accusation**.
For a new guard, wrong-and-quiet is the safe way to be wrong.

Seen to fail: the import removed, it names the file, the function and where the
function comes from.

---

## 13ar. The dyestuff belongs to the step (0.90.3)

§13ap gave the bath somewhere to record what it gave, and hung it on the
**trial**. That is right for a trial that is only a bath, and wrong for the case
the owner actually has: an eco print whose steps include a dye bath, and — the
one that settles it — a trial with two baths, tagetes and then madder. A list
hanging off the trial knows both were used and cannot say which was in which
pot.

**"No recipe" has never meant "no dyestuff."** A recipe carries the proportions
and the method; the dyestuff is what went in. Until now the second was reachable
only through the first, so a bath written without a recipe had nowhere to name
what was in it — which is exactly what the owner ran into.

### One list, filtered — not a list per step

A placement now carries `stepId`. The same block renders it: called with a step,
it shows that step's dyestuffs inside the step; called with nothing, it shows
the ones belonging to no step, which is what a leaf laid on cloth is. **A second
store for the same thing would drift from the first** (§13ak), and the colour,
the combination matching and the plant's swatches keep working because it is
still the same record.

One detail that would have been a silent fault: the row is addressed by its
**real index** in `r.placements`. Filtering with `.filter()` renumbers, and the
second bath would then have edited the first one's plant.

### A guard I had to correct

The check that a dyestuff added from a step belongs to it first read the `data`
attribute off the markup. It passed with the handler deliberately broken —
because the attribute proves the markup carries the step id and says nothing
about what the handler does with it. It now presses the button and reads the
record back. **A guard that inspects rather than acts is testing the scenery.**

Guards: a dye step shows its own dyestuff, two baths in one trial are told
apart, what is added from a step belongs to it, and a leaf belonging to no step
is still listed on its own — because a change made for the bath must not take
anything from eco print. All seen to fail.

---

## 13as. Four from a morning's use (0.90.4)

### A label swallowed the press

A photograph in the plan could not be removed. The × was there, it highlighted,
and nothing happened — the record kept the photograph and only the screen
pretended otherwise until the next reload.

`field()` renders a `<label>`, and **a label forwards a press anywhere inside it
to the control it labels.** The plan photographs sat in one, so their buttons
were never pressed at all. `fieldGroup()` is the same caption built from a
`<div>`, and the rule is now: `field` for a single control, `fieldGroup` for
anything holding controls of its own.

Nine other places had the same shape — groups of checkboxes nested inside a
label, which is invalid HTML and steals presses in the same way. `check-scope.js`
now reports a `field()` containing a button or a label, and found a tenth I had
missed while converting the nine.

### The strip ended at the fifth photograph

The life of a piece scrolls sideways, deliberately: the sequence is the point
and a grid that reflows breaks the reading of it. But it scrolled with nothing
to say so, so as far as the reader was concerned it ended where the panel did.
The bar is now always shown rather than on hover, and the right edge fades while
there is more to come.

### The result could not be corrected

Screen 4 was reachable only on the way to finishing. Once a piece was finished,
the five questions — and the colour that carries the result to the plant and to
the reference — could not be edited at all. §13an established that one screen
owns finishing; it follows that it must be reachable **after** finishing, not
only before.

### The cloth's name did not follow the cloth

Renaming a piece in Fabrics left the diary calling it by its old name: the title
was copied off the cloth when the work began, and a copy taken once does not
follow the original.

Derived on read now, which is the rule the data model already states — no
back-references, related things worked out when the record is opened (§3). The
cloth names the work; a title of the person's own that says something else is
shown beneath it rather than lost. No flag, and no guessing whether a stored
title was typed or copied.

### And a fault of mine, which is the reason to write this section

I broke `recipes.js` — a malformed import — and reported the suite clean.
`check.sh` had in fact stopped at an earlier layer, on a duplicated §13ao that
two versions had both written, and never reached the syntax check. It said so.
I did not see it, because I was **counting matches of a grep pattern instead of
reading the exit code**, and the pattern did not include the words that layer
prints.

A guard that reports correctly and a reader who checks for the wrong words is a
suite that passes. The exit code is the answer; everything printed above it is
commentary. Both faults it was hiding are fixed: the duplicate section is gone
and the import is repaired.

---

## 13at. The plants get their photographs (0.91.0)

Forty-six of the forty-eight chosen photographs arrived with a workbook of
sources, authors and licences. Forty are in the pack.

### Attribution is a field, not a footnote

A plant carried `photoData` and nothing else. Several of these images are
CC BY-SA, which requires the author to be named **wherever the image appears** —
and this application is meant to be given away. So `photoCredit` holds the
author, the licence, the source and the taxon of the photograph, and the credit
is rendered under the picture rather than filed on a page elsewhere.

The licence line is shown even when the licence asks for nothing, because a
reader deciding whether they may reuse a picture needs telling, and a blank
tells them nothing.

### Eight are held back, and that is the feature

Six of the forty-six have no author recorded — the owner's own workbook flags
them in a sheet called *verify before release* — and one of those six is
CC BY-SA. **A photograph whose author is unknown does not travel.** Shipping it
is not an oversight to be tidied up later; it is the breach itself. The import
script refuses them, names them, and exits cleanly, so the six can be added the
moment the names are known.

The other two: number 24, sumac, whose approved source refused automated
download and which is NoDerivatives, so it must be added by hand and uncropped;
and number 5, coreopsis, whose file did not arrive.

### Size

Each is reduced to a long side of 560 px. These are photographs for recognising
a plant, not for printing, and the whole pack travels inside the application and
is cached for offline use. One 6.9 MB original would otherwise have cost more
than the entire rest of the library; forty come to 2.6 MB.

### Guards

Every photograph that needs an author has one, every photograph records its
licence, and the author is **on the screen** and not merely in the record. That
last one matters most: the record satisfying the licence is not the same as the
licence being satisfied. Both directions tested.

**And one guard corrected rather than obeyed.** The 44 px touch target flagged
the credit line, which is a link. It is prose that happens to link out — the
licence asks for the name to be readable, not pressable, and setting it at 44 px
would give the photographer a bigger claim on the page than the plant. The
exception is written into the layer with that reasoning, next to the others.

---

## 13au. The day the work finished (0.91.1)

The owner reported that the date she chooses when finishing a piece is not the
one that gets kept — the diary shows the day she made the record. Three faults
underneath it, and the third had already damaged stored data.

### There was no such date

A trial carried one date: its own. Screen 4 offered a date field, but that field
belongs to **the cloth's state event**, not to the work — so it went into the
piece's biography and never touched the record the diary was dating. She was
choosing a date and watching a different one being displayed, which is precisely
the fault class §4 warns about: a plausible outcome hiding the real one.

`finishedOn` now exists on the work, asked before the five questions. Finished
work is **shown and ordered by it**; work in hand is still dated by `date`. Two
fields rather than one, because her own diary has a piece begun on the 9th and
finished on the 13th, and a single date would have to lose one of them. When
they coincide — which is every retrospective entry — the second is invisible.

### The state date always opened at today

`value="${today()}"` regardless of what had been recorded. It now opens at the
mark already on the piece, or at the day the work finished. Still a separate
field: a bundle opened a week after the print is a real case.

### Finishing again stamped the cloth a second time

The save pushed a state event unconditionally. Combined with the previous fault,
**editing the result of an old piece of work stamped it again with today's
date.** Three pieces in the owner's live diary claim to have been finished
twice — a tunic on 12 May 2025 and again on 13 August 2026, from one work.

One work leaves **one** mark on a piece, found by the `trialId` the event has
carried from the start. Finishing again corrects it. Choosing *leave the state
alone* after a state was recorded withdraws it rather than silently keeping the
old one.

### Repairing what was already written

`healDoubleStateEvents()` runs at boot. Where one work left several marks on a
piece it keeps **the earliest**, because the later one is always the re-visit:
the first carries the day she chose, the second the day she happened to open the
record. That date then fills `finishedOn` where the work has none — which
recovers dates that were otherwise lost, including May 2025.

Events belonging to no work are not touched. The repair is idempotent, and the
guard runs it twice and compares, because **a repair that is not idempotent is a
repair that eats data on the second boot.**

### Guards

Seven, all seen to fail: the day chosen on screen 4 is recorded; the diary dates
finished work by when it finished; finishing again corrects the mark instead of
adding one; the doubled mark heals to the day that was chosen; an event
belonging to no work is left alone; the recovered day reaches the work; and the
repair changes nothing on a second run.

One correction while writing them: the diary check first read the whole screen
as one string and passed on **another fixture's** date. It now reads the card
belonging to the record under test. A check that reads the whole page is a check
that can be satisfied by something it was not asking about.

---

## 13av. One number, one piece — and the last hidden state channel (0.93.0)

Three things closed together, because they are the three the owner was carrying.

### The paper tag

Two pieces on her shelf both wore П-04. The counter was not out of step — it stood at 35, well
ahead of both. **Both numbers were typed by hand**, and `labelFor` said *a hand-typed code always
wins* without ever asking whether someone else was already wearing it.

A number is now compared the way it is read rather than the way it is stored: `П-04` and `П-004` are
one tag written twice, because the padding changed between versions. A typed number already in use
is **refused at save, naming the piece that has it** — "that number is taken" without saying by what
leaves her searching the shelf by hand. A reserved number now steps over what is worn instead of
trusting the counter to be ahead of it.

**The duplicate that already exists is not repaired.** One of those two pieces has П-04 written on a
paper tag in the studio, and only the person holding it can decide which tag to rewrite. Renaming a
record would make the application and the shelf disagree, which is worse than a duplicate that is
visible. The list says so, once, at the top.

### The bottle reaches the calculator

The last item of §11b. A jar has carried `concentrationPercent` since Stock existed and **nothing
ever read it**: the alum acetate calculator asked for a vinegar strength and offered 9 while the
bottle in the cupboard was 5. The field is now a picker of bottles she owns — acid modifiers and
auxiliaries with a recorded strength — and choosing one writes its percentage into the field beside
it, which stays editable, because a bottle not yet recorded must not become a bottle that cannot be
used. Typing a strength by hand clears the chosen jar: the label must not keep naming a bottle it no
longer matches. A *wanted* entry is not a bottle and is not offered.

### Fabrics finally has an address

Every module was converted in §13ad except this one, and nobody noticed because nothing looked
broken. `#/fabrics/<id>` named a record the module never heard about — it had no `open()` at all,
and the piece being looked at lived in a module variable. A piece could not be reloaded, bookmarked
or sent to anyone, and Back walked out of the module instead of returning to the list.

    #/fabrics · #/fabrics/new · #/fabrics/<id> · #/fabrics/<id>/edit

Saving now returns to reading the piece through the address, with a flash, like every other module
with a read view.

### Guards

Ten: the same number written two ways is one tag; a number already worn is refused; a reserved
number steps over one in use; two pieces wearing one number are reported; choosing a bottle puts its
strength into the calculator; a wanted bottle is not offered; and Fabrics joins both address
contracts — obeying its address, and surviving an address to a deleted record. All seen to fail.

---

## 13aw. The plant audit, merged (0.94.0)

The owner had the library audited against Nicola Cliffe's dye plant table, Maiwa
and Kew, and brought back a workbook of 188 recorded changes. Most of it is
gain. Three parts of it were held back, and the reasons are the interesting part.

### What went in

**Eight photographs were unblocked.** They had been held since §13at for want of
an author. All eight now have one, with a licence — sumac's is **CC BY-ND**, so
it goes in uncropped or not at all. The credits are recorded; **the image files
themselves are not in this release**, so the count stays at 40 of 48 and the
eight are visibly credited-without-an-image rather than quietly absent.

**Two taxonomic corrections that were real faults.** The brazilwood record mixed
*Paubrasilia echinata* with *Caesalpinia sappan* — two different plants, and the
photograph and dye material were sappanwood. „Руй (рустифина)" was not a name of
*Rhus coriaria*. Cosmos was pinned to *C. sulphureus*, the dye species.

**Renamed, never replaced.** The owner asked whether the brazilwood record could
be deleted and reloaded. It could not: everything that points at a plant —
placements, combinations, swatches — points at its id, and a new record means a
new id. The code stays `paubrasilia_echinata` for a plant now named *Biancaea
sappan*, which is ugly and invisible and much cheaper than an orphaned swatch.
Recorded here so nobody later "fixes" it.

**Fifteen plants gained a part**, and one new vocabulary term: `heartwood`.
Cutch and sappanwood are made from the wood at the centre of the trunk, which
the vocabulary could not express.

### What the audit found that the model already knew

The workbook listed 48 part corrections. Mapped onto codes, **fifteen** are real
— the rest are wording (`лист` → `листа` is the same `leaf`). Worth stating
plainly: a correction that disappears at the level of the data model was a
correction to the spreadsheet, not to the library.

### What was held back

**Tannin level and tannin function.** The plant already carries chemistry **per
part**, with a class and a level: oak bark is `tannin_ellagi: dominant`,
`tannin_gallo: high`, while oak leaf is `tannin_ellagi: high`. That is finer
than "very high (especially galls/bark)". A second field for the same knowledge
would drift from the first (§13ak). The levels belong in `parts[].chemistry`.

The tannin *function* sentence is boilerplate on **37 of 49** records — a field
that says the same thing on three quarters of the library answers no question.
The twelve where it is specific are worth keeping, as prose, where they apply.

**Temperatures.** The audit turned them into prose: *special process*,
*reduction indigo vat*, *cold 20–25 (primary extraction)*, *90 (yellow); not
applicable to the pink process*. These are **more true than the numbers they
replace** — and the fields are numeric, with `softMaxTempC` feeding the warning
that stops madder being boiled brown. Text there would make the warning fail
silently. This is the roadmap's "unknown and approximate as legitimate values",
arriving on its own; it must be decided before the data is merged, not after.

**Parts the audit removes.** A part carries chemistry and dosing, so dropping
one deletes knowledge. Four are reported and kept: safflower's leaf, apple's
hull, sappanwood's and cutch's bark.

### The accumulator, and a fault in a label

The owner asked whether `mordant_accumulator` should move into chemistry, saying
**she had not known what it meant** — and she is the domain expert. That is a
fault in the label, not in her.

It does not move: chemistry says what is inside a part, a role says what the
plant is FOR, and "you may be able to skip mordanting" is a use. What was wrong
is that a term carrying knowledge in the word explained itself nowhere. The
vocabulary has had a `description` field all along, filled on **4 of 231** terms
and rendered on none of them. `describe()` now reads it, and the plant record
shows it under the role.

**Open, and flagged to the owner:** eleven plants carry `mordant_accumulator` —
alder, smoke bush, geranium, apple, medlar, pomegranate, oak, sumac, willow,
eucalyptus, hazel. The classic aluminium accumulators in the literature are
*Symplocos*, hydrangea and tea. Oak and pomegranate are known as **tannin**
plants. The suspicion is that these eleven were marked for their tannins, which
would make the label wrong from the start — and "you may skip the mordant" is
advice that wastes work if it is wrong. To be checked against the owner's own
guide and Boutrup & Ellis before it is trusted.

### Guards

`scripts/merge-plant-audit.py` is idempotent — the second run reports nothing —
and refuses to write anything it was not asked to. Seven guards: a renamed plant
keeps its id; 48 plants carry an author; the eight awaiting an image are
credited and counted rather than hidden; a part added by the audit is on the
record; a term that needs explaining carries the explanation; and the
explanation reaches the screen.

One correction while writing them: the guard keyed its map on `p.code`, which
the pack **strips** when it loads — every lookup returned undefined, and a Map
keyed on undefined answers every question with the last record loaded. It would
have passed while proving nothing.

---

## 13ay. What a plant is, and where it grows (0.95.0)

The second audit pass: 468 recorded changes, nine new plants, and the two
categories the owner proposed — growth form and habitat.

### `availability` is gone

It held values like „сам го отглеждам" — **a sentence about the owner, on a
record that ships to other people in a seed pack.** The same fault „искам го"
had in §11b, and the owner named it herself: *моята дума „сам го отглеждам" не
трябва да се смесва с хабитата.*

In its place, two facts about the plant:

**`plantType`** — `tree · shrub · subshrub · herb`, **one value, never two.**
Twenty of fifty-seven rows arrived compound („Храст / малко дърво"), and a field
that accepts a slash is prose the filter cannot read. The first word is taken;
that a hazel sometimes grows tree-tall is a sentence in „Как се държи".

**`habitat`** — `wild · garden · imported`, and it may hold several: rue really
is both wild and grown, which is two truths rather than one hesitation. **Three
rather than the four proposed:** „градинско" and „култивирано" arrived together
on fifteen rows, and two values that never separate are one value with two
names. Anything a person tends — bed, pot, greenhouse, field — is `garden`.

„Кухненска суровина" was refused. It is not where a plant grows; it is how she
comes by it — the axis just deleted, returning by the back door.

### Six sections, not seven

The audit brought three prose columns. „Защо действа" is **not** a new heading —
it is „Багрилна съставка" asked in plainer words, and it was folded into it. Two
headings for one question is how the library once had plants with four sections
and plants with ten. „Как се държи" did join, as observed behaviour beside
„Багрилни качества", which is the recipe. All six now stand on all 57.

### Nine new plants

Elder, blackberry, dahlia, dyer's greenweed, alkanet, rhubarb, ash, alder
buckthorn — and geranium, which existed in the owner's own database claiming
`origin: seed` while no such seed record existed. The pack and her database now
agree.

They arrive with names, role, type, habitat, all six sections and a photograph,
and **without colours, dosing or fastness** — recorded as gaps rather than
filled with plausible numbers.

The code is built from the botanical name with authorities and brackets
stripped: a code is an identifier, not a citation, and it must not carry
anything that might later be revised.

### Held back

**The temperatures, again — and now the reason is sharper.** Elder arrived as
*листа/кора 70–85; плодове 40–65*. Blackberry the same. That is not bad
formatting: **extraction temperature belongs to the part, not to the plant**,
exactly as WOF dosing does — a correction the owner made herself long ago. The
field is per-plant, so the knowledge escapes into prose. Together with *special
process* for woad, Japanese indigo and alkanet, this settles what the next
change must be: temperature moves onto the part, and „unknown" and
„approximate" become sayable.

**Our own library, cited as evidence for itself.** The audit's source column
carried `raw.githubusercontent.com/tskovacheva/bagra/.../plants.json` on most
rows. Stripped: a reference that quotes itself proves nothing.

**The sumac photograph.** The workbook keeps *Rhus coriaria*; the photograph
supplied is *Rhus typhina*. Different species — the Mediterranean spice and the
ornamental that grows all over Sofia. Held until the owner says which she cuts.
A photograph of the wrong plant in a reference is worse than none.

**Twenty compound growth forms** are listed for review: the first word was
taken, but for sage, lavender, thyme, rosemary and geranium the second —
`subshrub` — is probably the truer one. No plant currently carries `subshrub`.

### Guards

Six: no personal field survives on a reference record; all 57 carry exactly one
growth form from the four; every plant says where it grows in the three agreed
values; all six sections stand on all 57; 57 authors; the eight still awaiting
an image are credited and counted. Both merge scripts are idempotent.

---

## 13az. A temperature belongs to the part (0.96.0)

The audit's temperature column could not be merged while the field sat on the
plant. Elder came back as *листа/кора 70–85; плодове 40–65* and blackberry the
same — **not bad formatting, a fact the model could not hold.** One plant, one
number, and the leaf's boil would have been handed to the fruit.

`tempExtractC`, `tempDyeC` and `softMaxTempC` now live on the **part**, exactly
as WOF dosing does — a correction the owner made herself long ago and which this
field never received. The plant keeps none of them: two homes for one number is
how they drift.

The migration copies each plant's value onto every one of its parts, because
that is precisely what the old field claimed — one temperature for whatever part
you happened to use. Nothing is invented; the same claim is re-attached where it
can now be corrected part by part. `approx` and `confidence` travel with the
numbers, so a value marked as an estimate does not quietly become exact.

**On screen it repeats only where the parts disagree.** A plant whose parts all
cook alike says it once, because the same figure under four headings reads as
four separate findings.

### „No temperature" is not „temperature unknown"

Woad, Japanese indigo, alkanet and safflower have no extraction temperature —
not an unknown one, **none**. The ordinary simmer-it-in-water schema does not
apply to them, and an empty field said *nobody has measured it yet*, which is a
different and false statement.

`extractionMode` on the part says which schema it is in: `decoction · cold ·
solvent · vat`. Each carries its own explanation, shown where the temperature
would otherwise stand — the mechanism §13aw built for the accumulator, earning
its keep a second time.

### What this unlocked

The audit's temperature column merged, 97 changes across the parts, including
the madder ceiling the owner accepted at 82 °C. The seven rows that were prose
rather than numbers are exactly the seven that are modes, and they are now
sayable. **The recipe reads the temperature of the part it is using**, not of
the plant.

### And the rest of the batch

All 57 plants carry a photograph. The sumac is resolved: the record keeps *Rhus
coriaria*, and the photograph is a real *R. coriaria* supplied by the owner with
its author — the *R. typhina* image was set aside rather than used, because a
photograph of the wrong species in a reference is worse than none.

Five plants moved to `subshrub` — sage, lavender, thyme, rosemary, geranium.
Taking the first word of a compound is the rule; these are the exceptions the
rule was always going to need, and they are listed rather than guessed at.

### Guards

Six: no temperature survives on a plant; two parts of one plant can want
different heat; a plant outside the ordinary schema says which schema it is in;
madder keeps the ceiling that protects the red; both figures are readable on the
record; the vat is named where a temperature would stand.

One correction, and it is the third of its kind: the screen check first read the
whole page for „40", which also occurs in a dosing percentage — **satisfied by
another row's number.** It now reads only the blocks that carry degrees. And the
first mutation written to test it was a no-op, so it proved nothing until the
mutation itself was corrected: **a guard is only tested by a change that
actually changes something.**

---

## 13ba. Tannins, on the part and without a claim (0.96.1)

The audit's tannin column, merged — and the reason it took three passes to
decide where it goes is the reason worth recording.

**It goes on the part.** The plant already carries chemistry per part, with a
class and a level, and a second home for the same knowledge drifts from the
first (§13ak). Where the audit's note names parts — *особено гали/кора*, *в
листа/стъбла* — those parts get it; where it names none, every part does.

**A new class: `tannin`, with no subtype.** The vocabulary had gallotannins,
ellagitannins and condensed tannins, and the audit reports *high tannins* — the
level, not the kind. Choosing one on its behalf would add a claim its sources
never made. Where the subtype is known the three specific classes still say it;
oak bark keeps `tannin_ellagi: dominant`, and oak **galls** now carry
`tannin: dominant` beside it, which is the practical distinction: a nearly
non-staining tannin for pre-treating cellulose, as against a bark that colours
as it goes.

**Only from `moderate` upward.** Thirty-two rows read *ниски / не е основна
характеристика*. That is the absence of a finding, and recording it would turn
thirty-two silences into thirty-two assertions.

Sixteen entries across eleven plants. Three guards, all seen to fail.

### What the library still lacks, and why it is not filled

The nine new plants carry **no colours, no dosing, no fastness**. These could be
drafted from literature and marked `literature`, and they are not, for two
different reasons:

* **Dosing and fastness** can be sourced and will be, in the ordinary way.
* **Colours cannot.** A colour in this library is a hex value beside a
  condition, and a hex chosen from a sentence in a book is a guess wearing the
  costume of a measurement. The owner has the samples and the eye; §4 says the
  application proposes structure and observations while the person writes the
  conclusion, and a swatch is a conclusion.

**English.** The library is Bulgarian throughout: 57 plants × 6 sections, and
the `en` side empty. This is the owner's published voice under her own brand,
so it is a translation to be reviewed rather than generated and shipped.

---

## 13bb. The caption that took the screen (0.96.2)

The owner sent a photograph of her phone: the plant record's headline showing a
picture, and beside it a column about thirty pixels wide with *Crataegus* and
*monogyna* and *laevigata* each on its own line, the facts beyond it cut off at
the edge.

**The figure took its width from the caption, not from the image.** A `<figure>`
in a flex row is sized by its widest content, and the widest content was the
credit — an author, a licence and a taxon on one line (§13at). Measured at 390px:
the figure 280, the body **28**, and the page 509px wide inside a 390px window.

The figure is now held to the width of the image, the caption wraps under it,
and below 820px the headline stacks: 96px of photograph beside a name, a
botanical name and five facts leaves the facts about forty characters of room.

**The screen check already had the right rule and could not see this.** It opens
"the first row" of the plants list, and that fixture has no photograph — so the
caption that causes the fault was never on screen. It now also opens a seeded
plant by address. Verified by putting the fault back: four failures, naming the
element and the overflow in pixels.

Three copies of the same stylesheet block had accumulated, each added by a
change that did not notice the other two. Two removed.

### Names begin with a capital

Both languages, always. „дъб" sat beside „Бял равнец" because each name was
typed as whoever wrote it felt at the time, and a list where half the rows shout
looks broken before it is read. Forty-eight corrected, and the merge script no
longer lower-cases them on the way in.

### Dosing for the nine new plants

Written, and marked `literature` — which is what it is. **Not** `practice`:
nobody in this studio has dyed with elder bark yet, and in a year the confidence
marker will be the only thing that says which figures came from a book and which
from a pot.

**Their colours are still absent, and that is the point.** A colour here is a
hex beside a condition. A hex chosen from a sentence in a book is a guess
wearing the costume of a measurement, and it would then sit in the swatch
library answering reverse searches beside colours that were actually obtained. A
guard now asserts the nine have none.

The owner disagrees, and reasonably: her colours came from sources compared with
each other, not from a single sentence. Those are welcome — as data she brings,
with a source recorded, the same as every other seeded colour.

### English

342 sections, 67,000 characters, none of it translated. Too much to do well
alongside anything else, and half of it shipped silently would be worse than
none. It is the whole of the next pass.

---

## 13bc. English (0.97.0)

The library was Bulgarian throughout and the English side empty — not a
half-finished translation but an application that claims two languages and
speaks one. 342 sections, 67,000 characters. Now complete.

### Two sections needed no translator

**Источници** is a list of citations and URLs. A citation is not translated: the
author's name and the page title are what they are. Copied across verbatim.

**Използвани части** is a list of part names, and the vocabulary already holds
each one in both languages. It is now **rendered from the part codes** rather
than translated from the prose, so the section and the `parts` array cannot
drift apart — add a part tomorrow and the English text follows by itself.

That left 228 to write by hand, in nine batches.

### The batches are kept

`seed/en/batch-01.json` … `batch-09.json`, and `scripts/apply-english.py`, which
**never overwrites**: a section that already carries English is skipped. So a
batch can be re-run without consequence, batches cannot clobber one another, and
an edit the owner makes inside the application survives every later import.

They live at the top of `seed/en/` and are deliberately **not** in the service
worker's cache list — they are build input, not data the application fetches.
The cache-coverage check walks `seed/*.json` and not deeper, which is now said
out loud in `check.sh` so nobody later "fixes" it into recursion.

### Eleven plants had no English name

Lavender, rosemary, geranium and the eight added in 0.95.0. A plant with no
English name shows a Bulgarian one on an English screen, which reads as a fault
rather than as a gap.

### Guards

Three, all seen to fail: every section that says something says it twice; no
section carries the Bulgarian on both sides — a copied string is not a
translation, and Sources is exempt because a citation is not translated; and all
57 plants are named in both languages.

**This is a translation, not the owner's second voice.** She writes and publishes
in Bulgarian under her own name; the English is faithful to what she wrote and
should be read by her before the library is distributed. The batch files exist
precisely so that correcting it is editing a file, not re-doing the work.

---

## 13bd. Preparation belongs to the cloth, and a bath is one event (0.98.0)

**Status: specified, not built.** This section settles the model. The screens follow it.

The question that started it was "how does group work divide" — five pieces scoured and mordanted
together, after which one goes to eco print, one to a madder bath, and three are dyed together with
tagetes and shibori. The answer turned out not to be a splitting operation at all.

### Preparation is not a trial

Asked plainly, the owner's answer was plain: **scouring is not a trial. Mordanting is a trial only
rarely** — the recipe is repeated and well trodden, and the one time it went wrong it was a failure
to follow the recipe, recorded as a note against the result. **Dyeing and eco printing are trials.**

So preparation does not belong inside a trial. It is the biography of the cloth, and the cloth
already has a place for it: `FabricStateEvent`, with a date and a link to the recipe used.

Today it is recorded in **two** places — as state events on the fabric, and as steps in the trial's
`prep` stage (§8.0b). Two carriers for one fact is why five pieces cannot be divided: their
preparation sits inside one trial, and a trial does not divide. Remove the duplication and there is
nothing left to divide. Three trials, each pointing at its own subset, is what `fabricIds` already
does.

**Where the trial does begin** is not "at the dye bath" but at the point where a hypothesis is being
tested. Usually that is dyeing or eco print. But alum acetate against alum, 5% tannin against 10%,
soy milk against a mordant, a longer mordanting time — there the preparation *is* the experimental
variable. This costs nothing extra: preparation is always an event on the cloth, whether or not it
is being tested, and a trial may **point at** that event as its experimental step. No second store
of preparation appears.

### A bath is one event, not five copies

Five pieces in one mordant bath is one real occurrence. Recording it as five identical events loses
the fact that the bath was shared — and that fact sometimes explains the result.

It also makes the arithmetic wrong. If five pieces weigh 730 g together and go into one bath, the
historical fact is *730 g of textile, one bath, X g of mordant*. There is no such thing as each
piece's share; inventing one would be the application manufacturing a number nobody measured.

So the group execution is **a first-class record**, not a convenience on a screen. It holds
everything that is shared. The pieces hold only what is theirs, and point at it.

**Every action goes through a group execution, including a single piece.** One mechanism, no special
case, no second path to maintain and no branch in the code that decides which of two writers to use.
On screen a single piece looks exactly as it does now; underneath, its group has one member.

### What an event carries, and what it does not

The recipe holds the standard: temperature, litres, concentrations, percentages. The event holds
only **what was specific to this execution**:

- the date (defaulting to today but editable — work is often typed in later, §13au)
- the action
- the recipe used
- the real combined weight of the goods
- the deviation from the recipe, if any — *"the bath only reached 42 °C"*
- a note
- an observation, if there is one

Temperature, water volume and concentration are entered **only when they differ from the recipe**.
A form that asks for all of them every time is a form nobody fills in, and the app would then hold
a hundred copies of a number that already lives on the recipe.

### The seven actions, and the three boxes

Settled with the owner. The actions:

| code | Bulgarian | moves the box |
|---|---|---|
| `wash` | изпиране | **yes** → изпран |
| `tannin` | танин | no |
| `mordant` | мордантиране | **yes** → мордантиран |
| `neutralise` | неутрализиране | no |
| `iron` | желязна баня | no |
| `soy` | соево мляко | no |
| `bleach` | избелване | no |

Plus `other`, with text, because a closed list that cannot be escaped becomes a list people work
around.

**The boxes are physical.** The owner sorts cloth into two boxes — washed and mordanted — and a new
piece is in neither. Three states, therefore: `unwashed`, `scoured`, `mordanted`. `dyed` and
`finished` remain as states of the piece, not as boxes.

**A state is where the piece is now; the actions are what it has been through.** The state is
derived from the latest box-moving action, as it already is (§13.3). The other five actions are
carried as labels on the piece and change nothing about where it lies.

**The list of boxes lives in one place.** The prototype showed three different sets of boxes on
three screens — the home screen, the fabrics list and the group action — which in a sketch is
carelessness with mock data and in the application would be three lists drifting apart. One
vocabulary, read everywhere.

**The treatment labels travel with the piece.** A piece carrying tannin shows it wherever the
piece is shown: in the fabrics list, in the tick-list of the group action, on its own record, and
in the picker for new work. The prototype showed the labels in two of those four, which is how a
piece silently loses the thing that decides what it is good for.

**`tanned` stops being a state.** This costs nothing: the live database holds three state events in
total — two `scoured`, one `mordanted` — and not one `tanned`. In a year it would have been a
migration.

### Why tannin is not a box, which took asking three times

Tannin is not an intermediate stop on the way to alum. On cellulose it is a **route**, an
alternative to aluminium acetate. A tanned piece may go to eco print with no further treatment, may
go to a paste print, may wait for alum, or may be finished as it is if the tannin colour was the
point.

That is not a stage in a pipeline. It is a piece **carrying a preparation**, with its destination
still open. It stays in the washed box — washed it is, alum it has not had — and carries the label.

### And so "ready to work" is not a property of the cloth

This is the correction that came out of the tannin question, and it applies to something already
built. Screen 2 of the working flow (§8.0e) sorts mordanted pieces to the top under **ready to
work**. By the reasoning above that is wrong: tanned cotton *is* ready to work if the work is an eco
print, and today it sinks to the bottom beside the raw wool.

Readiness is not a property of a piece. It is a property of **the pair of piece and intention**.
Mordanted linen is ready for a madder bath and tanned cotton is not; tanned cotton is ready for an
eco print and raw cotton is not.

So the list stops dividing into *ready* and *the rest*. Every piece shows **what it carries** — its
box, plus the labels of the treatments that did not move it — ordered by how much preparation stands
behind it. The owner decides whether that is enough for what she has in mind. The application knows
what has been done; it does not know what she intends, and guessing costs more than showing.

### The entities

```
Fabric
  … as today
  state            derived from the latest box-moving action

FabricAction        (what FabricStateEvent becomes)
  id
  fabricId
  batchId           always present — a single piece is a batch of one
  actionCode        one of the eight above
  date
  recipeId | null
  chainId | null
  trialId | null    set when this preparation is itself the experiment
  note
  observation

BatchAction
  id
  actionCode
  date
  recipeId | null
  chainId | null
  fabricIds         the pieces that were in the bath
  totalWeightG      what the recipe was scaled against
  deviation         free text — what differed from the recipe
  note
```

Shared facts live once, on the batch. Nothing is copied, so nothing can fall out of step. A piece
shows *"mordanted together with four other pieces"*, which opens the shared action.

### What is not migrated

Preparation steps already sitting inside trials stay where they are and are read as before. A
migration that guesses turns a guess into a fact (§8.0b). The cost is small now — 21 pieces, one
trial, three state events — and would not have been in a year.

### What the sketch showed

A prototype of the screen was drawn before any code. Four things came out of it that the
written specification above did not have.

**A chain is not one action.** The screen asks for one action and then one recipe. But
*Cellulose preparation* is a chain of three — wash, tannin, mordant — and if it is chosen here,
a single execution would carry three recipes and three action codes, which is the opposite of
everything decided above.

So a chain is not picked as a recipe. **Choosing a chain inserts three group executions at
once**, each with the same pieces and the same combined weight, each with its own date and its
own deviation, and any of them can be removed if it did not happen. This is the same rule
already settled for a chain inside a trial (§8.0e): chains are inserted expanded, because what
follows the insert is ticking one off, photographing one, correcting the temperature of one.
That the same answer arrived twice by different routes is a reason to trust it.

**The recipe picker is filtered by the action.** Choosing *mordanting* offers mordant recipes,
not all of them.

**Quantities are ranges, and ceilings still apply.** Recipes carry ranges — 8–10% tannin,
12–15% alum on wool (§5) — so the scaled block shows a range when the recipe holds one. And the
ceiling warning that exists elsewhere in the application must appear here too. This is the one
screen where real powder is being weighed out against the number on it; a warning that is
present in the calculator and absent here is worse than no warning at all.

**The screen says what it will do before it does it.** A line under the action chips: *moves the
chosen pieces into the "mordanted" box*, or, for the five that do not move a box, that nothing
moves. This was not asked for and is kept.

### A note, not a block

Mordanting cloth that has not been scoured usually gives a poor result. The application does not
prevent it — pieces may skip states, and that rule is older than this section — but it says so
quietly, next to the summary: *one of the pieces has not been washed*.

The shape is worth naming, because it will recur: **where an action has a usual precondition that
is not met, the app notes it and proceeds.** Not a confirmation dialogue, not a disabled
checkbox, not a warning colour. A line of text that can be read and ignored. A studio has good
reasons for exceptions, and an application that argues with them stops being used.

The remaining preconditions worth a note are to be listed by the owner; only the unwashed one is
settled here.

### What the build changed

**Preparation leaves the trial.** `prep` is gone from the stages a step can be added to. What
stands in its place on the active trial is a card that **shows and does not hold**: it reads the
pieces' own actions, groups them by batch so one bath is one line however many pieces were in it,
and its *add preparation* button leaves the trial for the group action with this work's pieces
already ticked. Steps already stored under `prep` still render — `STAGE_OF_TYPE` is read and never
written back — so no old record changes and nothing is migrated.

**The handoff is the one that already existed.** Leaving the trial writes the work, records
`returnTo`, and drops the draft, exactly as the new-recipe button does (§13aq). Saving the group
action returns to the work rather than to the fabrics list. Writing a second mechanism for the same
departure would have been the second carrier all over again, one level up.

**"Ready to work" is gone from screen 2.** One list, every piece showing its box and the
treatments it carries, ordered by how much preparation stands behind it. The ordering weights every
treatment the same on purpose: an application that ranked mordanting above tannin would be making
the very guess about intention that this list stopped making.

### Three guards that fired, and were right

Worth recording because each caught a fault in this section's own implementation rather than in
old code.

**The address is parsed in one place, and the query has to be too.** `#/batch?pieces=…` was first
implemented by appending the query to the module's arguments. Every `open(first, second)` in the
application reads its arguments by position, so `#/plants` — no arguments at all — received the
`URLSearchParams` object as `first`, which is truthy, and the module went to fetch a record whose
id was a `URLSearchParams`. A blank screen on every list in the application. `check-boot` caught it
on the first run. The query now reaches only a module that declares `takesQuery`.

**A chip names, a box is pressed (§13ac).** The action row and the box filter were written as
chips and both change the screen when pressed, so both are controls and both need a finger target.
The guard from 0.88.8 refused them.

**A stage card is a run of steps.** The preparation card was given `.stagecardhead`, and the deep
check counts those to prove that dyeing before a print and again after it stays two passes rather
than one. Six where five were expected. The card is not a run — it holds nothing of this work's own
— so it has its own class, and a real guard was kept honest rather than loosened.

### Left open, deliberately

**Can a piece be finished without a trial?** The owner's third tannin case — the tannin colour as
the intended result — means a piece can reach *finished* through a group action and nothing else.
Today `finished` is only reachable by completing a piece of work (§13an: one screen owns finishing
and every route leads to it). If this route is real, the photograph and the assessment that live on
the trial need somewhere else to go. Not solved here; recorded so it is not lost.

---

## 13be. A swatch says which process produced it (0.98.0)

**Status: built.** The data for the nine plants that prompted it is not.

The owner asked for the colours of nine plants that have none, and asked in the same breath
whether a plant that is used for both dyeing and eco printing gives *one* set of colours.

It does not. A leaf may give yellow or beige in an extraction bath and leave olive, grey or
almost black where it lay against iron in a print. That is not a shade of the same answer: eco
printing puts a locally high concentration of plant matter against the cloth with its own contact
chemistry, and is not the same bath in miniature. Pelargonium is the clearest case in the nine —
soft yellow through olive in a bath, grey to near-black in a print with iron.

Under one palette the reader sees a row of circles and cannot tell which process produced which.

### One array with a field, not two arrays

The proposal on the table was `colours.dyeing[]` and `colours.ecoprint[]`, with the general
palette derived as the union of the two.

That splits the record on one dimension and breaks at the next. **Discharge printing is already
planned** (Part B2) and a swatch from it belongs to neither array; a swatch from a pigment or a
watercolour belongs to neither again. Each new process would be another array, another union to
maintain, and another place for the same colour to be written twice.

So: **one array, and two optional fields on the swatch.**

```
{ hex, name, conditions, source, confidence,
  process,    // 'immersion' | 'ecoprint' | … — the existing `process` vocabulary
  partCode }  // 'leaf' | 'fruit' | … — the existing `plant_part` vocabulary
```

Both vocabularies already exist and are already used by trials and combinations. Grouping happens
**on the way to the screen**, in `groupSwatchesByProcess`, and never in storage. The combined
palette the list shows costs nothing to maintain, because it is simply the array.

A plant used only for dyeing has only `immersion` swatches. One used only for printing has only
`ecoprint`. One used for both shows both, under headings.

**Both fields are optional and default to empty.** All 48 plants that carry swatches today have
neither, and a select defaulting to *dyeing* would put a claim on 48 records that nobody made.
Swatches with no process are shown first and without a heading, exactly as they read today;
headings appear only when there is something to tell apart.

### The part comes with it

`partCode` on the swatch is the same decision already taken for temperature and extraction mode
(§13ba), one step further. Elder leaf and elder fruit are not one answer: the leaf gives
yellow-green and olive, the fruit a pink-violet that will not last. Blackberry and rhubarb are
the same shape. The part is now legible on the swatch instead of being buried in the prose
beneath it.

### What is deliberately NOT added

**No colour per mordant.** The swatch already carries `conditions` as free text — *with iron
salts*, *aluminium mordant* — and has done in 48 records for as long as they have existed.
Process × part × mordant × fibre is unreadable to fill in and unreadable to read. The mordant
stays described in the dyeing qualities.

**No fugitive mark on the swatch.** Eight purely anthocyanin plants were removed from the library
rather than kept as warnings, and the ones that remain are marked in the plant's prose. The
owner's decision: it stays there. A third new field on the swatch is not paid for by one case.

### The guard, seen to fail twice

Grouping is where things go missing, so `deep-check.mjs` §14 asserts that the count in equals the
count out, that a swatch with no process survives ungrouped rather than being filtered away, and
that a bath swatch and a print swatch land in different groups.

Broken deliberately in both directions. Dropping the ungrouped list reported *3 in, 2 out* — and
was also caught by the older guard comparing the list column against the record, which is the
right kind of redundancy. Defaulting an absent process to `immersion` reported a swatch under the
wrong process.

### On the colours themselves, before they are entered

The hex values proposed for the nine are **inferred from descriptions, not measured**. That is
the fault §13d names: a hex read out of a sentence is a guess wearing the costume of a
measurement. They may be entered, but as `literature`, never as `own_trial`.

More pressing: the sources named for them — CAMEO, Maiwa, Natures Rainbow — **are not in the
Sources register**. Every swatch on the 48 existing plants credits *НАТУРАЛНИ БАГРИЛА, Crafty
Place*. New sources enter the register with author and title before anything cites them, or the
library breaks its own rule (§13r, Part A2).

And two of the nine need care rather than completeness. Elder fruit and blackberry fruit give an
anthocyanin pink-violet that does not last. Entered without the plant's prose saying so, a violet
circle reads as a promise.

### The data, entered (0.98.1)

**Two sources added to the register**, with author and address: CAMEO, the materials encyclopedia
of the Museum of Fine Arts in Boston, and Nature's Rainbow, a British dye-plant growing project by
Ashley Walker and Susan Dye. Maiwa was already there. Six sources now.

**44 swatches across the nine**, written by `scripts/add-swatches.py` so the work is repeatable
rather than typed once into a file. Idempotent: a plant that already carries swatches is skipped.
Every one is `literature`, every one names a part the plant actually has — the script refuses to
write a part the record does not carry — and every one cites a source by its register code.

**The existing 132 were normalised in the same pass.** They carried the register's name as prose,
`НАТУРАЛНИ БАГРИЛА, Crafty Place`, where the new ones cite `crafty-place-guide`. One value mapped
to one code is not a guess. 176 swatches in all, and **57 of 57 plants now say what colour they
give** — the first time the library has been complete in the column that matters most to someone
who dyes (§13h).

Pelargonium is the case that justified the change on its own: soft yellow, yellow-green and olive
under *dyeing*; grey-green and near-black under *eco print*. Elder carries seven swatches across
three parts and both processes, which under one flat palette would have been an unreadable row.

### Four guards, each seen to fail

Read from the **seed files**, not from the database: the claim is about what ships, and earlier
sections of `deep-check.mjs` create scratch plants and edit real ones on purpose. The first version
read the database and reported an avocado an earlier section had emptied — a failure the library
did not have.

Every shipped plant gives a colour · every citation reaches the register · every swatch says how
well it is known · every part named on a swatch is a part of that plant. Broken one at a time:
emptying a plant, citing a book nobody has, deleting a confidence marker, and putting a gall on a
safflower. All four fired.

**And one older guard was rewritten rather than deleted.** It had insisted the nine carry *no*
colours, because a hex read out of a sentence would answer reverse searches beside colours
actually obtained off cloth. That decision was reversed deliberately here. What protects the
reverse search now is not absence but the confidence marker, so the guard checks that instead:
the nine must have colours, and every one must be `literature` and never `own_trial`. A guard
whose reasoning has expired is rewritten to the new reasoning, not removed.

---

## 13bf. What real use found in 0.98.0 (0.98.2)

Feedback from the owner after working with the release. The first item is a defect that made the
whole of §13bd unusable; the rest are language, order and one panel that should not greet a buyer.

### The tick that opened the record

**Ticking a piece in the fabrics list opened the piece instead of selecting it.** The checkbox sits
inside the row, and the row's `[data-open]` swallowed its click. So the bulk bar never appeared,
a second piece could never be added, and a group action could not be gathered at all.

The fix is three lines. The gap it exposes is the thing worth recording.

`deep-check.mjs` opened every record and asserted every screen rendered, and `screen-check.mjs`
asserted every address drew at phone width with usable touch targets. Both passed on 0.98.0, and
the feature shipped with its only entry point unusable. **A screen that draws is not a screen that
works.** The checks knew how to look at a page and did not know how to walk a path.

§16 of the deep check now walks the path a person walks — tick, tick, press — and asserts the
address that comes out of it. It was seen to fail: with the fix removed it reports the reported
symptom, the record opening and the bar never appearing.

### Language and order on the group action

- **Title**: *One bath, several pieces* → *One action across several fabrics*. The old one was
  written for the model rather than for the person: a bath is what the record is, not what she is
  doing.
- **Subtitle** now says when to reach for it — one scour or one mordant bath serving several
  pieces — rather than explaining the data model.
- **Section heading**: *The action itself* → *Action*.
- **The recipe comes before the date.** The recipe is the decision; the date is nearly always
  today and is edited only when work is typed in later.

### Elsewhere

- **The reference module's subtitle** now says what the module is for — *what to expect from a
  given set of inputs* — rather than describing the behaviour of its form.
- **The plants list column** *Gives* → *What it gives*.
- **The plant profile's** *Внимавай* → *Внимание*. An instruction became a heading, which is what
  it is.
- **Saving a piece of work now says so.** The trials screen redrew and stayed silent, so pressing
  Save read as pressing nothing. Every other module confirms; this one was the exception.
- **The fabrics list gained a search.** Filtering by box answers *what is in the mordanted box*;
  it does not answer *where is П-042*, which is the question asked with a piece already in hand.
  A tick survives a search that hides the row it was made on.

### The reliability panel leaves the home screen

The home screen carried a count of claims awaiting testing, headed *Confidence*, with the line
*the library rests on a compilation; your tests make it yours*.

That is addressed to the owner of a private notebook. To someone who has paid for the library, the
first thing the application says about itself is a number of things it is not sure of. Removed
(Part A6). The count is not wrong and is not deleted as an idea: it belongs inside the reference
module as a filter for finding what to test, which is a tool rather than a greeting.

**What the home screen should carry instead is still open.** Asked by the owner, not yet answered.

### Still open from this round

Icons, and the visual hierarchy of headings in the plant profile — *Why it works* is set smaller
than *Dye constituent*, which sits inside it, so the two levels are the wrong way round. Both need
the v0 prototype's drawings in front of us rather than a guess, and the heading levels want
settling once for the whole application rather than screen by screen.

Also raised and not yet acted on: a visual indication of how much of a constituent a plant carries
(tannin high/medium/low is a code and reads as a word); icons for recipe types, temperature and
time; the fibre-class field on a chain, whose purpose is not clear from the screen; and the layout
of the trial history, where the last two columns are too narrow and the notes are not set apart.

---

## 13bg. Two heading levels, settled once (0.98.3)

Reported from real use: in the plant profile, *Защо действа* is set smaller than *Багрилна
съставка*, which sits inside it.

It was true, and it was true everywhere. A section heading was **11.5px** and a subheading inside
it was **13px**. The inner level shouted over the outer across the whole application, and nobody
could see it from the code because the two numbers sat six hundred lines apart in one stylesheet.

### The scale

Two variables in one block, `--h-section: 13px` and `--h-sub: 12.5px`, and nothing sets a heading
size by hand. The outer is larger.

They also differ on a second axis, because a pixel and a half is not a difference anyone reads as
deliberate: **the outer is uppercase, letterspaced and muted; the inner is sentence case, tight and
in ink.** Uppercase muted reads as a label over a region; sentence-case ink reads as the name of
something within it. Two axes, so the hierarchy survives being seen at a glance.

`.subhead` and `.difhead h3` were separately set at 12px and 13px and now read from the same pair.
Four heading treatments had drifted apart; there is one scale now.

### The guard

Checked as numbers in `check-scope.js`, because a screenshot cannot fail a build: the section size
must be greater than the subheading size, and no heading rule may set a pixel value directly. Seen
to fail in both directions — inverting the pair reports the inversion, and hardcoding 14px on
`.sub h3` reports the hardcoding.

This is the check that would have caught the original fault on the day it was written.

### Language taken from the prototype

The prototype names two things better than the application did, and both names are now the
application's:

- **Изчисли за тегло** → **Мащабирай тази рецепта**.
- **План за конкретно тегло плат** → **Мащабирай тази верига**. A recipe and a chain now say the
  same thing in the same words, where before the two screens named one action differently.

### A labelling fault, not a model fault

*Клас влакно* on a chain: the owner could not tell what it was for. It is not decoration — it
decides **which ingredients drop out**, because some roles apply only to protein and some only to
cellulose, and the brightener disappears for cellulose entirely.

So the field stays and the label changes: **Върху какво влакно**, with the hint saying what it
does. The distinction the owner draws herself — *I did not know what that field meant* is a
labelling fault, not a data error — and the fix belongs on the label.

### Still not done: the icons

The prototype's icons cannot be read from its pages as text, so they are still unseen and are
deliberately not guessed at. They remain in Part B5b: the left-hand menu, recipe types, single
recipes, temperature and time, material kinds, and the trial screens.

---

## 13bh. Marks, and a quantity you can see (0.99.0)

The prototype's icons, read from screenshots because they do not come through its pages as text.
They are Lucide, and twelve of them are now in the sprite.

### Redrawn, not imported

Drawn into `index.html`'s sprite at its own stroke weight rather than pulled in as a dependency:
the application has no build step, and a network request for twelve paths would be a poor trade
for an offline-first tool.

`i-flask` mordanting and preparation · `i-bath` a dye bath · `i-drops` washing · `i-layers` tannin
· `i-finish` a binding or finishing step · `i-compound` a salt with a formula · `i-vial` a solution
· `i-temp` · `i-time` · `i-again` would do again · `i-alert` · `i-then` from intention to outcome.

### Not borrowed: the colour

In the prototype the icons sit in indigo discs and the scouring mark is red. Here indigo is
navigation and active states only, and madder is an accent. An icon that is neither is ink or
muted, so a row of marks cannot compete with a swatch of dyed cloth — which is the reason the whole
palette is quiet in the first place.

### A quantity, seen rather than read

*Trace*, *moderate*, *high* and *dominant* are four words of about the same length that read at the
same weight, so a plant's chemistry has to be read one line at a time. The prototype shows them as
filled segments, and it is right: four of four is taken in at a glance, and two rows can be
compared without reading either.

`levelBar(filled, of, word)` in `ui.js`. The bar is indigo rather than a ramp from green to red —
a coloured scale beside a photograph of dyed cloth is a second opinion about colour, and no screen
here may have one. The bar carries `aria-hidden`, because the word is right beside it and saying
it twice helps nobody.

### The rule that an icon set erodes

**A mark accompanies a label and never replaces it** (§13ac). This is the rule an icon set quietly
eats: one glyph stands in for a word, then two, and a screen becomes unreadable to anyone who does
not already know what the pictures mean.

So every mark added here sits beside its word: the stage cards keep their names, the recipe types
keep theirs, a temperature keeps its °C, and the level bar keeps its word.

`deep-check.mjs` §17 asserts exactly that, and both halves were seen to fail — emptying the level
bar's word reported two bars showing a quantity and no word; removing the recipe type's name
reported two types showing an icon and no name.

**And the guard caught itself first.** It looked for madder by `p.code`, which a seeded record does
not carry — the code lives in the id as `seed:<code>`. The check passed by not running, which is
the quietest way for a guard to be useless, and is worth remembering as a failure mode of its own:
a check that finds nothing to check must say so rather than say nothing.

### Still not done from this round

The trial history layout — the last two columns too narrow, the notes not set apart, and an arrow
between *what I meant to do* and what followed. `i-then` is drawn and waiting for it. The layout
wants deciding on a wide screen with real records in front of us rather than guessed at.

---

## 13bi. The review, read against two real records (0.99.1)

Two screenshots of finished work — a cotton tunic with four short facts, and a boiler suit with
seven plants, seven colours and three paragraphs. The second is what a full record looks like, and
it is where the screen came apart.

### The four facts were sized into equal columns

`repeat(auto-fit, minmax(130px, 1fr))` gives every fact the same width whatever it holds. So *eco
print* had the same room as seven plant names, and two cells wrapped into narrow ribbons while two
sat half empty. Reported as *the last two are in such narrow columns, it does not sit well*.

Now a flex row: each fact is based on its own content and shares what is left over. A long list
gets the room it needs from a short one that does not need it.

### Three treatments for four kinds of writing

In one panel: the intention in a headed box, **what happened as loose prose with no heading at
all**, and what she would change and the notes squeezed into a two-column fact grid, where a
paragraph got half the width of the page. Reported as *the notes are not set apart*, which was the
visible half of a larger fault.

Now four blocks with one heading treatment, and an order that is the shape of the record:

**Intention and outcome sit side by side, with an arrow between them** (`i-then`, drawn in
§13bh and waiting for this). The owner asked for exactly that arrow, and she was identifying the
point of the whole screen: a trial exists to answer what was meant against what came of it, and
stacking them loses that they answer each other. On a narrow screen the arrow turns and they stack,
because side by side in 380px is two ribbons again.

Below them, **set apart by a rule**: what she would change. Then the notes, quieter still — they
are the margin of the record rather than its argument.

### The stages carry their marks

The collapsed process list — raw cloth, preparation, decoration, colouring, finished — now carries
the stage marks from §13bh beside the tick, not instead of it. The tick says whether it happened;
the mark says what kind of thing it was.

### The guard

`deep-check.mjs` §18 builds a record with all four kinds of writing and asserts four blocks, a
heading on each, the arrow, the notes set apart, and — the one that matters most — **that every
word survives**. A layout change that silently drops a paragraph is the worst kind of fault,
because the screen still looks right.

Seen to fail: putting the notes back into a fact grid and removing the arrow reported three blocks
where four were expected, and no arrow.

### A flake worth naming

`check.sh` failed once with *the view rendered nothing* and passed on an identical re-run. It was
almost certainly contention with an `npm install` running beside it, but the principle here is that
**a check that fails at random is worse than no check** — anything timed waits on a condition and
never on a duration. If it recurs, `check-boot.mjs` is where to look, and it should be made to wait
for the first render rather than for a number of milliseconds.

---

## 13bj. Working a finished piece again (0.99.2)

Reported from real use, from one attempt: mark a silk scarf finished, press *work on this piece
again*, add preparation, choose a mordant recipe — and be stopped. Two faults, and the archive
shows both.

### The handoff asked to discard work it had just saved

*Add preparation* writes the record, remembers the way back, and leaves for the group action. What
it did not do is **tell the unsaved-work guard the record had been written.** So the guard asked
whether to discard unsaved changes over work already in the database, and neither answer was any
use: leaving discarded the draft, staying went nowhere.

The guard clears itself when it sees a form leave the screen after a click on Save (`dirty.js`). A
handoff saves without that click, so it has to say so.

Both handoffs — this one and *write a recipe from this step* — were written out separately, and the
second copy is where the omission was. **They are now one function, `handOff`, so a third cannot
forget.**

The group action itself worked throughout: the archive holds a real mordant batch, 28 g against the
scarf, recipe attached, dated 11.08. The record was never the problem; getting back out was.

### *Work on this piece again* made a rival record every time

It went to `#/trials/new/<id>` without looking. Pressed twice while working around the fault above,
it left the scarf with **two pieces of work in progress** — one holding the intention and no steps,
the other a step and no intention — and no sign on any screen that the first existed.

Screen 2's picker had this right all along: it excludes cloth that is busy. The finished card's own
button did not.

**A piece can only be in one bath at a time**, so if work on it is open, that *is* the work on it,
and the button opens it. Starting genuinely separate work on the same piece is still possible —
finish the first. That matches the cloth: there is one scarf.

Derived on open, never stored: no back-references (§13.1).

### Two tests that passed against code known to be broken

Worth writing down, because both are the same mistake in different clothes and both were caught
only by deliberately breaking the fix.

**Counting calls to `confirm` missed it.** The guard's question is an *injected* function so the
check suite can drive it, so the global `confirm` is never called and the count never moved.

**Reading `isDirty` afterwards missed it too.** The guard clears itself the moment the question is
answered, and the stub answers yes — so the broken version and the correct one ended in exactly the
same state. The only difference between them is whether the question was asked at all.

So `dirty.js` now counts its own questions and exports `askCount()`. The assertion is that leaving
after a save **asks nothing**, and with `markClean` removed it fails.

The general shape: **when an assertion cannot distinguish the fault it was written for, it is not a
weak test but a false one.** Break the fix and watch, every time.

### Not repaired automatically

The two records for the scarf are left as they are. One carries *Мордантиране с алуминиев ацетат и
нов еко принт* and no steps; the other a mordant step under after-treatment and no intention.
Merging them means choosing which intention and which step belong together, and a migration that
guesses turns a guess into a fact (§8.0b). The owner deletes the one she does not want and carries
on in the other; from 0.99.2 the button will take her back to it.

---

## 13bk. The readers moved and one writer stayed (0.99.3)

The owner asked whether re-working a finished piece carries through to the end — a second eco
print, which leaves went on, and finishing again. Rather than send her back to try it, the path was
walked in the checking harness against her own archive.

**The path is whole.** Open the work, add a colouring step, record the plant, press finish, and the
step and the placement are already stored by the time the finishing screen opens. Nothing was
missing from the route.

**The cloth was never told.** After the work went complete, the scarf's biography read *washing,
mordanting* and nothing else. It stayed in the mordanted box.

### The fault

§13bd converted every **reader** of a fabric's history to `actions` and left one **writer** on
`stateEvents`. So from 0.98.0 finishing a piece of work stamped a list that nothing read.

It survived four releases because it looks like nothing. The work completes, the diary lists it,
the screen is right. Only the cloth is silently wrong, and only for someone who goes looking at a
piece's own record days later.

And it was concealed by exactly the thing that is supposed to help: `currentState` falls back to
`stateEvents` for a record that has never been migrated. After the migration none has. **A fallback
that produces plausible output hides the fault it covers for** — written into this specification
long before this, and true again.

Three writers converted: finishing a piece of work, adding a state by hand on the fabric record,
and the empty history a piece cut from a batch starts with. The hand-entered one now writes a batch
of one, like everything else, so the invariant that an action belongs to a batch or to a trial
holds for it too.

### The check that would have caught it

`check-actions.mjs` now reads the source of the four files that touch a fabric's history and fails
if anything **writes** to `stateEvents`. Reading it is allowed — records predating the migration
still hold it — and resetting it to empty is allowed. Adding to it is not.

A line that repairs old records on purpose says so with a `legacy:` marker, of which there is
exactly one: the repair for records written before §13bd.

The first version of this check used a regular expression with a negative lookahead and reported
an empty-array reset as a write. It was rewritten as four readable lines. **A check nobody can read
is a check nobody can trust**, and one that cries wolf gets switched off.

Seen to fail: putting the old push back reports the file and the line.

### Two older checks had gone quiet

Both asserted things about `stateEvents` and both went on passing after §13bd moved the readers,
because the writer was still filling the list they read. They only spoke up once the writer moved
too.

That is worth stating plainly: **for four releases, two checks were watching a list the application
had stopped using.** A check pointed at the wrong thing is not neutral — it reads as coverage.
When a store or a field is replaced, every check that names it has to be walked, not just the code.

### And the whole path is now a check

`deep-check.mjs` §20 walks it: open work in progress, add a colouring step, lay a plant on it,
finish, and assert that the work completes, that **the cloth carries the finishing**, and that
nothing was written to the old list. The middle one is the assertion that four releases needed.

---

## 13bl. The preparation card, laid out (0.99.4)

The card that shows what the cloth has been through was three spans with dots between them:
`изпиране` `5.08.2026 г.` ` · ` `Мордантиране на целулоза с алуминиев ацетат`. Reported as *the
text is stuck together*, and it was — it read as one sentence broken in the wrong places.

Now four columns: a mark, what was done, when, and what with. The dates line up down the list, so
the eye runs the column instead of reading each line. On a phone the columns fold under the mark
rather than compressing into ribbons.

The marks are the same ones the group action offers, because that is where these lines are written.

### What the card is for, since it was asked

It shows the cloth's own preparation, read from the cloth. It holds nothing: preparation is the
biography of the piece and not part of any one trial (§13bd), which is why the button on it leaves
for the group action rather than opening a form.

It shows **everything the cloth has been through**, not only what happened since the last time it
was finished. For re-worked cloth that means the first scouring stays visible under a second print,
which is true of the cloth and is the point of a biography.

### Re-working a finished piece, as it is meant to go

Recorded because the owner asked and the answer is not obvious from the screens:

- **A new mordant is preparation**, so it goes through *add preparation* and the group action. It
  is something done to the cloth, not a step of this trial.
- **The new print** is a step in *colouring and printing*, with the placements on it.
- **An iron bath after the print** is after-treatment, and that is what that stage is for.
- Then finish, with the photograph and the assessment.

### A check that took the screen from another check

The new assertion was first written inside §18, the story check, and its fixture record became the
record §18 was reading — three of that check's assertions failed on evidence that was never theirs.

**A check that builds a fixture owns the screen while it does.** Moved to its own section, and the
lesson is worth more than the fix: a false failure costs the same trust as a false pass.

---

## 13bm. A record that could be made and not unmade (0.99.5)

Reported from real use, and the owner's judgement of it was right: *this is proof the feature is
not intuitive*. A scarf ended with two mordantings, the 11th and the 18th, one of them a mistake,
and **nothing on any screen could take either of them back**.

That is not a confusing screen. It is a hole. The group action wrote onto the cloth and then
offered nothing but reading — no correction, no removal. Anything that can be created must be
correctable and removable, and this was neither.

### Correcting and unmaking

The bath's own screen — already reachable by pressing a line in the preparation card — now carries
the date, the deviation and the note as fields, with **Save** and **Delete the action**.

**Deleting the bath deletes what it wrote on every piece in it**, because they are one fact.
Leaving the pieces' actions behind would produce exactly the orphans §13bd forbids: an action
belonging to nothing.

**Correcting the date corrects it on every piece too.** The date lives in two places on purpose —
on the bath, and on each piece's action, so a piece's biography can be read without fetching every
bath it was ever in. Two places can differ, so one write fixes both.

### Not making the mistake twice

A note, in the shape §13bd established: choosing an action for a piece that has been through **that
same action within the last thirty days** says so, names the piece, and says how long ago —
suggesting the earlier record be corrected rather than a second added.

A note and not a block. Mordanting twice is a real thing to do, and an application that refuses it
is wrong more often than the person is.

### Every button on that screen was dead

Found by the new check, not by reading. The read view returned **before** the handler wiring, and
the wiring sat behind a `root.dataset.wired` flag. So opening a recorded bath from a preparation
line wired nothing: back, the pieces, and later the new buttons, all inert.

The flag was wrong twice over. It sat after an early `return`, and `root` is shared between
modules — each assigns its own `onclick` on the way past, so a flag set here stays true while the
handler belongs to somebody else. Handlers are now assigned on every render, as every other module
in the application does it. Assignment replaces rather than adds, so re-wiring cannot double one.

**A screen with no handlers looks exactly like a screen with handlers.** Nothing renders wrong;
pressing simply does nothing, and there is no way to tell that from a click that missed.

### Two faults in the check, both mine

Worth recording because both made working code look broken, which costs the same trust as the
reverse.

**A node held across a redraw.** The delete button was captured before the save, the save redrew
the screen, and the captured node was detached — clicking it did nothing and the check reported the
deletion as broken.

**`get` on a missing key.** It returns `undefined` here, and the first version wrapped it in a
`.catch()` that never fired.

---

## 13bn. The strip shows the piece, not one trial (0.99.6)

A silk scarf printed twice. Its second record showed the raw cloth and the final result and
nothing between — and from the strip there was no way to tell the piece had been printed before,
which is the one thing a second print most needs to say.

The strip was built from **this trial alone**. For a piece worked once that is the same thing as
its life; for a piece worked twice it is a lie by omission. **The earlier print is how this one
started**, and leaving it out makes a second look like a first.

It now spans every piece of work on that cloth, and the cloth's own first photograph.

### Cut off after this work

Not everything the cloth ever became. Reading a finished record should not show what happened to
it afterwards, which had not happened when the record was written. A trial is a document of a
moment, and a document that keeps growing after it is signed is not one.

So: every work on this cloth up to and including this one, in date order.

### Marked, not merged

Shots from earlier work are set back — slightly faded, with a dashed rule down the left and the
work's own name under the caption — and a line beneath says which number this work is on the piece.

Said only when there is more than one work. On a piece worked once, a label naming the work is
noise; on a piece worked twice it is the entire point.

### Both directions, seen to fail

Narrowing the strip back to one trial reported that nothing marks the earlier shots. Widening it to
every trial on the cloth reported that the first piece of work shows work that came later. A scope
has two edges and a check that only holds one of them holds none.

---

## 13bo. One icon language, four action levels, four headers (1.0.0-rc1)

A limited consistency pass, audited before anything was changed. No data model, no workflow, no
information architecture: iconography, action hierarchy, page headers.

The audit's finding was the opposite of the expectation. The application was not inconsistent for
want of a system — it has one `page()`, one `.btn`, one sprite. It had **drifted inside its own
system**, and drift is invisible by reading because every screen looks reasonable on its own.

### A · Icons

Three faults, all found by counting rather than by looking:

- **`i-bath` was defined twice.** A sprite with two symbols of one id silently serves the first, so
  every use of the dye-bath mark since 0.99.0 had been drawing the calculators' bath-volume icon.
  Renamed to `i-beaker`.
- **`s-tanned` outlived its state**, which went in 0.98.0.
- **Fifty symbols, used in seven modules of fourteen** — and not one *semantic* action marked
  anywhere. Add, edit, delete, back, search, filter, photo, favourite, duplicate, more: all text.

`ACTION_ICONS` in `ui.js` is now the one place a semantic action is bound to a mark, and
`actionBtn(kind, text, attrs, level)` is how a button is written. Ten new symbols, silhouettes
deliberately unlike one another. `save` and `cancel` map to nothing on purpose: the primary button
already carries the weight and a mark on it is noise.

**The favourite star was two glyphs**, ★ and ☆, which differ in weight as well as in fill — so a
starred row read as heavier for reasons nothing to do with being starred. One outline symbol now,
filled or not.

### B · Action hierarchy

Counted: 83 quiet, 34 primary, 11 destructive, **11 with no level at all**. The eleven are the
drift — nobody decided, so they took the default and sat between the other two. Each was given a
level one at a time; none was a mechanical rename.

Two findings worth keeping:

- **The fabrics list header had two primaries** once the group action was promoted. Two primaries
  in one header is no primary at all. Adding cloth is what the list is for; a group action acts on
  pieces already chosen and has its own primary on the bulk bar.
- **One destructive action was not quiet** — `data-batch-del`, two hours old at the time. A delete
  that shouts is a delete that gets pressed.

A fourth level was added: **contextual**. `quiet` was doing duty for the second action of a screen
*and* for add-a-row inside a list, and they do not want the same weight.

The audit was also wrong about one thing, which is worth recording: it claimed *edit* was quiet on
read screens. It was already primary in five of six. Only `fabrics` had it quiet.

### C · Page headers

Four variants over the one `page()`: `pageList`, `pageRead`, `pageForm`, `pageWork`.

**"Back" became the module's own name.** Seventeen buttons reading *Назад* are now *← Тъкани*,
*← Рецепти*, *← Растения*. Two reasons, and the second matters more: it says where it goes, and it
is an **address** rather than a step through history — the address is the state (§13q), and a
bookmarked or shared record has no history to step back through. Handled once in `app.js` through
`navigate`, so the unsaved-work guard sees it like any other move; two modules' private back
handlers were deleted as dead.

### The checks

`check-scope.js` gained both: no symbol defined twice, no icon asked for that is not in the sprite,
no `actionBtn` naming an action the map does not own; and no button without a level, no destructive
action that is not quiet, no page header with two primaries. All seen to fail.

### And the pass moved what the checks held on to

Renaming *back* broke `deep-check.mjs` in three places at once: it walks out of a record by pressing
`[data-back]` until the list reappears, and that control no longer existed. It reported *no star
rendered in the list* — a true failure with a misleading name, because the walk had stopped one
screen earlier than it thought.

Worth stating: **a UI pass moves the handles the checks grip.** A check that walks a route is
exactly the kind that a rename breaks, and that is a reason to update it rather than to stop writing
them — a check that could not notice would have been no help here either.

### Deliberate exceptions

- **`dashboard`, `materials`, `packs`** — no page actions and no records; nothing in A/B/C applies.
  `materials` is a redirect and `packs` is parked.
- **`trials`' cancel** stays a cancel rather than becoming a way up. It abandons a form; it does not
  navigate out of a record, and dressing it as one would promise something else.
- **The calculators' `i-bath`** keeps the id it had first. It was there before the collision and
  renaming it would have moved the fault rather than fixing it.

---

## 13bp. The band numbers, checked against the library (1.0.0-rc2)

The bands decide which results merge into one reference record. They shipped as data precisely so
revising them would cost nothing, and were marked provisional from the start — but until now nobody
had held them up against the library they band.

Doing so found three things, one of them serious.

### One scale was being asked to band two incompatible quantities

`concentration` ran trace <0.5% · low 0.5–1.5 · medium 1.5–2.5 · high >2.5. It served the mordant
strength in a combination key **and** nominally the dyestuff quantity on a plant part — where the
library's values run from 15% to 500%. All 250 dosings landed in *high*. The scale distinguished
nothing at all on that side.

Dyestuff now has its own dimension, `dyestuff_ratio`, with boundaries drawn where the library's own
values cluster: sparing <50% · usual 50–150 · strong 150–300 · very strong >300. Against the real
data that divides 14 / 83 / 26 / 2 — a scale rather than a label.

### The numbers were drawn around iron and the data was written for alum

The standard doses the application already holds: **alum 15%, alum acetate 6%, iron 1%, copper 2%,
titanium 2%.**

On an absolute scale, every ordinary alum mordanting is *high* and every ordinary iron mordanting is
*low*. Yet sixteen of the thirty-one seeded combinations record alum as **medium** — because
whoever wrote them meant *the usual amount*. **The definitions and the data already disagreed**, and
had since both were written.

The cause is that mordant strength is not absolute. 2% iron is a great deal; 2% alum is nothing. No
single scale can serve both, and the one that tried was built around iron.

**So the band is now a multiple of that substance's own standard dose:** trace <0.25× · low
0.25–0.75 · medium 0.75–1.25 · high >1.25×. Medium alum is 11–19%, medium iron 0.75–1.25%, medium
acetate 4.5–7.5%. The sixteen combinations become correct without being touched.

`mordantBand(percentWof, substance)` returns null when the substance carries no standard dose. A
ratio against an unknown reference is not a weak answer but an invented one, and the caller has to
be able to tell (§13d).

The reference screen shows what the chosen band means in real percent for the chosen mordant —
because *medium* says nothing until the mordant is known, and someone reading only the word would
be out by a factor of fifteen. It shows nothing when no mordant is chosen: an example would read as
the answer.

### The temperature revision is modest, and the reason is in the data

The old four put 104 of 114 recorded dye temperatures into *simmer*. Redrawn on the library's own
figures — cold <40 · warm 40–65 · hot 65–85 · simmer 85–95 · boil >95 — it is 10 / 99 / 5.

**Better, and not much better, and this is worth stating plainly rather than dressing up.** The old
scale already separated the case that matters: madder, which must stay under about 60 °C or it
loses its red, from oak bark worked at 85–95. Both scales tell them apart.

The reason no scale does better is in the data, not in the numbers: **74 of the 114 values are
exactly 75 °C** — a default written across the library rather than a measured spread. A band cannot
divide what the records do not distinguish. The fix for that is a thermometer, not an edit.

A threshold was deliberately NOT added to make the old scale fail this check. 91% of the library in
one band against 87% is not a meaningful difference, and a boundary placed between them would be
fitted to the answer rather than to the craft.

### `bandFor` was never called

The bands existed as data and nothing turned a real figure into one. Every band in the seeded
combinations was written by hand. So a trial that produced an actual number had no way to find its
combination — which is the fixed decision *combinations match on bands* not being implemented at
all, only described.

The reference screen now reads the relative scale. Wiring the trial side — a recorded temperature
or dose finding its band on save — is the next step and is listed as such.

### The guard

`deep-check.mjs` §24 holds the bands against the seeded library rather than against itself: every
band a combination names must exist on the scale it is read against; **every mordant at its own
standard dose must band as medium**; iron and alum must not band alike at the same percentage; the
temperature scale must divide the library into more than one band; madder and oak bark must be told
apart; and no band may claim a range it has not got.

The second and third were seen to fail by restoring the absolute scale, which reported ordinary
alum as *high*, ordinary iron as *low*, and 4% of each as identical — the three faults that
prompted the change, in one line.

---

## 13bq. A placement finds its reference record (1.0.0-rc3)

The other half of §13bp, and the half that makes *combinations match on bands* true rather than
merely written down.

### The matcher read three dimensions of eight

`matchCombination` compared plant, part and process. Not fibre class, not mordant, not strength. So
**oak bark with iron and oak bark with alum attached to the same reference record** — two results
that look nothing alike, filed as one answer. The library has held separate records for both since
it was seeded; nothing was reading them.

It now compares every dimension of the key the trial actually knows, and a dimension the trial does
not know is not matched against: an unrecorded mordant is not the same as no mordant, and treating
it as one files a result under a condition nobody worked in. Where more than one record survives,
the one agreeing on **more** known dimensions wins — otherwise the order of the seed file would
decide the reference.

### The mordant is usually not on the trial

Since §13bd, preparation belongs to the cloth. So an ordinary piece of work names no mordant at all,
and a matcher reading only the trial's steps sees nothing on almost every real record.

`mordantOf` reads the trial's own mordant step first — when mordanting *is* the experiment, that is
where it lives and it is the more specific answer — and otherwise the last mordanting on the cloth
**on or before the day of the work**. Later mordantings belong to work that came after and must not
be read back into it (§13bn).

### Three faults found by writing the check

**A recipe's ingredient is a role, not a substance.** The first version looked for
`ingredient.substanceId`, which exists on no real recipe: an ingredient is a role filled by one of
several options, and the quantity is on the option (§5). It found nothing, everywhere, and matched
everything to one record — a fault that produces plausible output.

**`fibreClass` takes a composition, not a piece.** Passing the piece threw on every save.

**The check itself was naive.** It mordanted both fixtures at the standard dose and read the iron
non-match as a fault. It was not: the oak iron record names *low* iron, and the standard 1% is
*medium* — a different condition, and rightly a different record. The relative scale was working
and the test was asking the wrong question.

### And a finding in the data

Four questions in the seeded library have more than one answer — two records with an identical key,
where which one a trial reaches is decided by the order of the file.

One of the four is not a duplicate at all. The two tagetes records are named *acid* and *alkaline*,
and **the key has no pH slot** — the search asks about pH and the key cannot carry it. That is a gap
in the model, not a mistake in the data, and it is the same shape as the open question about season
(§16.0): a dimension that matters for some plants and not for most.

Reported by `deep-check.mjs` §24b and deliberately **not** failed. Repairing them means either
adding pH to the key or deciding two records are one, and that is the owner's decision; inferring
it from a code string would be a migration that guesses. A hard failure over outstanding data work
is a check that gets switched off, and a check that is off protects nothing.

---

## 13br. pH was already in the key (1.0.0-rc4)

The owner's judgement was right and the reason was the right one: **pH is not a condition of the
bath but a modifier of the colour.** Tagetes on cellulose, the same mordant at the same strength,
gives pale yellow in acid and bright canary in alkali. Madder needs alkaline water for red.

So it belongs in the key. And it has been in the key since the library was seeded, inside
`medium: { phCode, whereCode }`.

### The check invented the fault it reported

§24b flattened the key with `.join('|')`. `medium` and `blanket` are objects, so both became
`[object Object]`, and **every pair that differed only by pH looked identical**. That is how it
reported that the model had no pH slot when the model had carried one all along — and it nearly
bought a change to the key, a migration over every record, to add a field that was there.

**A check that flattens a structure it does not understand invents the fault it reports.** The
comparison is `JSON.stringify` now, which is uglier and true.

With it fixed, the four questions with two answers became three, and the tagetes pair — the one
that raised the whole question — was never one of them.

### What was actually missing

Not the field. The **matcher**, which compared fibre, mordant and strength and not pH. So an acid
bath and an alkaline bath on one plant still reached one record, for want of one line.

`phOf(trial)` reads the pH from the step that names one. Null means **not recorded**, which is not
neutral: an unmeasured bath is usually near neutral and sometimes not, and filing an unmeasured
result under *neutral* would put a guess into the reference.

Seen to fail: removing the comparison reports an acid and an alkaline bath matching the same record.

### Three questions still have two answers

Genuine, and data rather than model:

- oak bark with alum — *beige, ochre, light to medium brown* and *a clean golden tone*
- madder root in alkali — *bright red* and *raspberry*
- indigo leaf — *deep indigo* and *soft blue*

Each pair is one key and two colours. Either the key is missing a dimension that separates them —
concentration of dyestuff is the obvious candidate, and `dyestuff_ratio` now exists (§13bp) — or
they are one record whose expected result should say *from beige to golden*, which is what the
`variation` field is for. Both are the owner's call; neither can be inferred from what is written.

### Resolved: one record each, not a new key dimension (1.0.0-rc6)

The owner's call: dye strength, not a new dimension in the key. Wiring `dyestuff_ratio` into the
key would need a reader like `mordantOf`/`phOf` — and there is nothing to read yet. No placement
records a dye's percent WOF against the fibre, so the dimension would have entered the key with no
way for a real trial to reach it. That is a larger and separate piece of work, listed on its own
merit if it is ever wanted; it was not needed to close these three.

**`variation` already meant something, and it was not "the other colour."** Two of the three
records were not empty: madder carried *"At 70 °C with a pinch of soda"* and indigo carried *"With
more dips"* — the condition that produces the colour named in `expected`, not a second colour at a
different one. Writing the alternate outcome into the same field would have mixed two kinds of
fact under one label. So:

- **Oak bark** — `variation` was empty. It now names the alternate, without inventing a cause: *"Under
  an unrecorded condition the result leans toward a clean golden tone rather than beige-ochre-brown."*
- **Madder** and **indigo** — `variation` keeps the condition it already had. The alternate colour
  goes in `notes`, which was empty on both.

**A mistake made and corrected in the same pass, worth naming rather than quietly fixing.** The two
duplicates being removed — `rubia_root_alum_raspberry`, `indigo_leaf_soft_blue` — were not
themselves empty on `variation`: raspberry carried *"More alkalinity and longer"* and soft blue
carried *"At a lower temperature."* Real, specific, recorded causes. The first draft of this repair
discarded both and wrote *"at a weaker bath"* into `notes` for each instead — a plausible-sounding
mechanism invented to fill the field, and wrong in one case (more alkalinity is not a weaker bath)
and unverified in the other. Caught by checking the diff before presenting it, not before writing
it — the discipline that should have applied is the one already named in this document, that a
fallback producing plausible output hides the fault it covers for; an invented cause is that same
fault with better grammar. `notes` on both now carries the real condition that was already recorded
on the record being removed.

The three shorthand-named duplicates (`quercus_bark_alum_golden`, `rubia_root_alum_raspberry`,
`indigo_leaf_soft_blue`) are removed from the pack. `rubia_root_alum_pink` is untouched — its key
carries no pH, so it was never a duplicate of the alkaline record; it is the model this repair
followed, since its own `variation` already read as a condition rather than a range.

**Known gap, not fixed here:** `pl.combinationId` is written at trial save time
(`modules/trials.js`, "resolving the reference link at save time keeps it honest") and read back
by `modules/reference.js` to list which trials attach to a record. A trial saved *before* this pack
update, whose placement had matched one of the three removed ids, keeps that stale id until the
trial is next opened and saved — until then it is simply absent from the surviving record's
attached list, silently rather than visibly. `seedPack`/`applyDiff` only add and update; nothing
in the pack machinery removes or repoints an orphaned reference, by the same "migrations only add"
rule that keeps them from guessing. Cheap to live with while the library is this size and the app
is pre-release; worth a real fix — a reconciliation pass over stored `combinationId`s against the
current pack — before combinations acquire enough churn for it to happen unnoticed at scale.

Pack bumped to `packVersion` 0.2.0. 31 records became 28.

---

## 13bs. The figures you need over a pot (1.0.0-rc5)

From a prototype of the plant profile. Three things taken, one refused.

### The working strip

The best idea in it, and it answers what the application is for. The figures somebody standing at
the stove needs — which part and in what condition, how much, how hot to draw it out, how hot to
dye, the line not to cross — were spread through *how it is used* as a two-column list of label and
value, which scans as prose. They are now a strip of marked tiles, in the order they are used.

**Extraction and dyeing are separate tiles.** They were one line, and they are two acts done at
different moments; reading them as one sentence hides that.

Every value already existed in the model, including `liquorRatio` and `dryingRatio`, which were
present and empty. The prototype invented nothing and neither does this.

### A swatch carries its own temperature

*Red, root* leaves the reader to scroll for the number, and madder above 60 °C is not red at all. A
swatch now shows the dye temperature of the part it came from.

**Derived, never stored.** The heat belongs to the part; copying it onto the swatch would let the
two drift apart. It appears only on the nine plants swatched in 0.98.1, because only those record
which part a colour came from — and that is the honest behaviour rather than a gap to paper over.

### Refused: nothing that is not in the model

The prototype's tiles are drawn whether or not there is anything to put in them. Here a tile with
no value is not rendered, and a figure nobody has recorded is absent rather than dashed.

### Kept as ours: the caution stays third

The prototype runs *what it gives → use it now → why it works*. Ours puts **Внимание** between the
figures and the explanation, and it stays there. A warning about dust or about a ceiling belongs
before the work, not after it (§8.5). This is one of the places where the prototype's order is not
better, only different.

### Two checks that had gone quiet, and one that nearly did

The temperature check for elder read `.fact` rows and the figures had become `.usetile`. It reported
*zero temperature rows* — a true failure with a misleading name, because it was asking a part of the
page that no longer held the answer.

And the new swatch-temperature check was first pointed at madder, which is one of the 48 older
plants whose swatches carry no part. It passed by not testing. Pointed at pelargonium — one of the
nine that do — it fails when the temperature is removed.

**That is now three times in this project that a check has passed by not running.** The pattern is
always the same: the fixture does not have the property the assertion is about. Worth a habit — when
a new check passes first time, break the thing it watches before believing it.

---

## 14. Technical architecture

### 14.1 The two failure modes being avoided

Глина is a single HTML file of some 7,700 lines. It works, and its one-file discipline is the reason
it still runs untouched years after it was written. But it is at the limit: every substantial change
now means navigating a file too large to hold in view, which is where quiet mistakes are made. Багра
is materially larger — seven modules, a bilingual dictionary, calculators with real chemistry,
reference packs, a seed library. A single file would not survive it.

The opposite failure is worse and more common: a modern toolchain. A project with npm, a bundler and
a framework is pleasant for six months and unmaintainable after three years, when the build no
longer runs and an application that otherwise works can no longer be changed. For a personal tool
expected to last a decade, the build step is the liability.

### 14.2 The decision: native ES modules, no build step

Multiple files, loaded directly by the browser as ES modules. What is edited is what runs. No
compilation, no dependencies, nothing to go stale.

```
index.html            shell, styles, module entry point
app.js                bootstrap, routing, shared render loop
db.js                 IndexedDB, schema, migrations
i18n.js               dictionary, language switching
vocab.js              controlled vocabularies and band definitions
modules/plants.js     one file per module
modules/fabrics.js
modules/materials.js
modules/recipes.js
modules/techniques.js
modules/combinations.js
modules/trials.js
modules/packs.js      reference pack import/export with merge preview
calc/                 calculators — pure functions, independently testable
seed/*.json           the reference library, versioned as packs
sw.js                 service worker
```

**No framework.** Vanilla JavaScript, as in Глина, for the same reason: there is nothing to break.
With seven modules, however, a single shared rendering pattern must be fixed at the outset —
otherwise each module ends up looking as though a different person wrote it.

**Calculators are pure functions in their own directory.** The aluminium acetate arithmetic, the
%WOF scaling and the reverse limiting-ingredient mode carry real chemistry and real consequences
when wrong. Isolated from the interface, they can be verified directly.

**Seed data ships as JSON, not as code.** Reference packs are already specified as JSON files
(§10), so the initial load is simply the import of a base pack — one mechanism rather than two, and
the library can be revised without touching the application.

### 14.3 The two costs, accepted knowingly

1. **The service worker caches a file list, not a file.** Every release must keep that list correct.
   This is where the first deployment mistakes will happen, and it needs a check before publishing.
2. **`file://` no longer works.** ES modules require a server, so local testing needs a one-line
   command. On GitHub Pages nothing changes.

### 14.4 Unchanged from Глина

Offline-first with IndexedDB as the sole source of truth. Backward compatibility on every release.
Migrations that only ever add. Export and import as the safety net. Deployment as static files.

---

## 15. Visual identity and naming

### 15.1 Names
- **Bulgarian:** Багра
- **English:** Rubia — after *Rubia tinctorum*, madder, one of the two oldest dyes in the world
- **Attribution:** *by Crafty Place*

A bilingual app may carry two names. Багра follows the same logic as Глина — an ordinary Bulgarian
noun naming the substance of the craft — so the two read as siblings. Rubia carries the same
register outward without being a literal translation.

### 15.2 Palette — indigo and madder

Grounded in real dyes, and deliberately away from Глина's sage and terracotta. The two apps should
look related — both earthen, muted, in a craft register — without being mistaken for each other.

| Role | Colour | Use |
|---|---|---|
| Ground | unbleached linen `#F7F4EC` | page background, working surface |
| Surface | near-white warm `#FFFDF8` | cards, panels |
| Ink | `#2A2724` | primary text |
| Muted | `#5C574E` | secondary text, labels |
| Line | `#DED8CA` | hairline borders |
| Primary — indigo | `#2C3B57` | navigation, active states, primary buttons |
| Accent — madder | `#A03D3B` | accents, emphasis, destructive actions |
| Highlight — weld | `#C9A227` | sparingly: warnings, unsaved state |
| Iron | `#3A3733` | dark neutral, chips |

**Discipline is the whole point.** Indigo is a strong colour: navigation and active states only.
Madder for accents only. The working surface stays neutral.

### 15.3 Why the interface must stay muted
This is an application about colour. Every screen carries swatches and photographs of results, and
the user judges from them whether a print came out grey-green or olive. A saturated interface
shifts that judgement — adjacent colour changes perception, which is physiology, not taste, and the
reason image-editing software is grey. The interface is the ground against which the work is read;
it must not compete.

### 15.4 Icons
Real SVG icons, not typographic glyphs. Dingbat flowers (✦ ❈ ✽ ❀ ❋) are indistinguishable from one
another at navigation size and defeat icon-based wayfinding entirely. Icons must differ in
silhouette, not only in detail.

### 15.5 Prototype review — outstanding gaps
Reviewed against the first two prototypes (July 2026). Correctly captured: sidebar plus bottom-nav
for the two form factors; partial-match reference search with an explanation of why a result is
partial; confidence indicators; the combination suggestion; the bilingual form with a 2/2 status
and collapsible translation; the pack import preview.

Still missing:

1. **Medium modification cannot be entered.** It appears as a search filter but has no field in the
   trial steps. Data that cannot be entered cannot be searched.
2. **Photographs are nearly absent.** Placements have no photo field, though the per-plant result is
   exactly what needs photographing.
3. **The fabric lifecycle is reduced to a table column.** The "what is in the mordanted box" view —
   the actual inventory — is missing.
4. **Recipe source attribution is not shown anywhere.** Seed badges exist; credit does not.
5. **Calculators are the three generic ones.** Recipe scaling to WOF and the aluminium acetate
   preparation — the two named as most useful — are absent.

---

## 16. Open questions

00. **The other three states of a number.** "About" is built (§13ai); **unknown**
   and **not applicable** are not, and "empty" still carries both of them plus
   "not got to it yet". The open question is not whether the distinction is real
   — the seeded library proves it is, with `liquorRatio` blank on all forty-eight
   plants for at least two different reasons — but whether the cost is worth it.

   Against building it: three more states on every numeric field is a form that
   asks four questions where the person wanted to type a number, and the
   application would then have to decide what an unknown means everywhere a
   number is used — the scaling calculators, the ceiling checks, the reference
   matcher. A field that can be "unknown" is a field every consumer of it must
   handle, and there are many.

   For: the application's whole claim is to say what is known and how firmly.
   "Not applicable" in particular is not a gap but a fact — cold dyeing has no
   temperature, and showing an empty temperature suggests one was never
   recorded. Export makes this sharper: a pack sent to someone else carries
   blanks with no way to read them.

   A middle path worth considering before the full four: only **"not
   applicable"** as a second mark, since it is the one that is a positive
   statement rather than an absence, and it needs no new handling downstream —
   a field that does not apply is simply not shown.

0. **Does season belong in the combination key?** Every plant profile in Chandra Rice's guides
   distinguishes spring from autumn leaves — autumn oak is loaded with tannin and prints boldly,
   spring oak is thin and prints softly. If season is not part of the key, the reference will merge
   two genuinely different results and report an unhelpfully wide "variation". If it is, the number
   of combinations roughly doubles and each fills more slowly. Provisional answer: an optional
   dimension on the key, set when it is known to matter for that plant, blank otherwise.

1. ~~Per-plant observations inside a multi-plant eco print bundle~~ — **resolved**: placements (§8.4).
2. ~~Blanket as recipe or field~~ — **resolved**: a recipe type (§5, type 8).
3. ~~Plant-chemistry granularity~~ — **resolved**: fixed vocabulary with levels (§4).
4. ~~Combination creation~~ — **resolved**: user-created, with app suggestions from accumulated
   placements; outcome always authored by the user, matching on bands (§7).
5. ~~Fabric identity~~ — **resolved**: one record is one physical piece, with a treatment lifecycle
   mirroring the storage boxes (§3, A.1).

6. **Does attribution move onto the record?** §13.1 keeps the Sources register separate on purpose:
   proportions and sequences pass from hand to hand and their origin is usually unknown, so
   pretending every record has an owner misrepresents how the craft travels. That reasoning holds
   for a private library and inverts for a distributed one (§13l). Asked of the owner, not yet
   answered.

7. **Do literature colours carry a swatch?** A hex derived from a colour name is an illustration.
   The owner has asked for them to be loaded, marked as literature-sourced — the alternative, a
   colour with text and no swatch until she has dyed it herself, is stricter and slower and leaves
   the column that makes people open the list empty. Proceeding as she asked; noted here because it
   is the one place the reference asserts something nobody has seen.

8. **Pigment extraction and watercolour.** The recipe model is a percentage of the weight of goods,
   and a pigment has no cloth: it has a binder, a filler, ratios by mass, and its output is a
   *substance* rather than a dyed textile. Neither recipes nor substances covers this today.

9. **"Unknown" and "approximate" as legitimate values.** From the review, and the most principled
   item in it: the application should not make someone invent a number because there is a number
   field. Affects the composition of recycled cloth, quantities of leaves, water hardness, the
   concentration of an old blanket. Not a field — a stance, and it would touch many.

10. **Does "Рецепта" survive as a plant section?** Fourteen plants, real content, and the only one
    of five doubtful headings with substance. The owner is still thinking about it.

---

## 13bt. The Library: glossary, pH, sources (1.0.0-rc7)

`modules/sources.js` became `modules/library.js`, and attribution became one of three tabs rather
than a place in the navigation of its own. Attribution deserves a screen but is opened rarely, to
check where something came from. What is opened often — and had nowhere to live — is the meaning of
a word met on another screen.

**Three tabs, not two.** The owner proposed Glossary and Sources. A pH scale is not a term with a
definition, it is a table, and forcing it into a glossary entry makes it a paragraph about a
picture. `#/library/glossary` (the default), `#/library/ph`, `#/library/sources`.

**The tab is in the address.** `#/library/sources/<id>` opens the record. A tab kept in a variable
the address does not mention looks like it works and breaks the back button, reload and bookmarks
at once (§13q) — the same fault a sessionStorage handoff has, in different clothes.

### The glossary does not restate the vocabulary

Five codes in `vocab.js` already carry an explanation and show it where the code is shown (§13aw):
`mordant_accumulator` and the four extraction modes. A glossary term repeating one of those is one
thing defined in two files, and the two drift at the first edit. `modules/library.js` reads those
five out of `VOCABULARY` at render time and merges them into the list, marked as explaining a term
the application uses. No copy; no stored link (§13.6).

Guard 24d fails the build if a glossary term ever names a code `vocab.js` explains. It caught one
on its first run: `vat` had been written into the glossary while `extraction_mode:vat` already
explained it. The glossary term was removed, and the two `seeAlso` entries pointing at it with it.

`seed/glossary.json`, pack `bagra-glossary` 0.1.0, thirty terms in six groups — chemistry, process,
fabric, pH, eco print, fastness. Written in our own words with a cited source, per §13r. Terms that
warranted the space and are easy to get wrong: **WOF and WOA as separate entries**, because Stopka
measures against the weight of the ALUM and everyone else against the weight of the CLOTH, and
reading one as the other is wrong by an order of magnitude; **the three tannins**, because the
library already distinguishes `tannin_gallo`, `tannin_ellagi` and `tannin_cond` and the glossary
should be at least as precise as the model; **discharge**, because true discharge destroys the dye
and a pH shift only moves it, and the two look alike.

### The pH tab is ours, not a photograph

The reference photograph offered was a test-strip colour chart. That is one maker's paper — another
maker's reads differently — and it is a page from a book. What a dyer needs is not what the paper
looks like but which jar moves the bath which way. The tab carries a five-band scale in the
application's own palette, saying only where a reading falls, and two lists: what moves pH up and
what moves it down.

### Two faults found on the way, both older than this work

**A seeded `kind` that rendered as its own key.** `cameo-mfa` shipped with `kind: 'reference'` and
`natures-rainbow` with `kind: 'website'`; neither was in `KINDS` and neither had a translation, so
the Sources screen printed the literal string `sources.kind.reference` where a word belonged, in
both languages, for as long as both records have existed. Layer 3b of `check.sh` reads literal
`t('...')` keys and this one is built at run time as `t('sources.kind.' + sx.kind)` — that layer's
own comment says a constructed key cannot be checked there. The check therefore comes from the DATA
end: guard 24c asks whether every code a seed pack actually uses resolves to a word, and whether
every kind in `KINDS` has one in both languages. `website` was `site` under another name and the
data was corrected; `reference` is a real distinct kind and was added to the vocabulary.

**A record-address check that could not fail.** The address layer asserted that a record's own
words appear on screen when its address is opened. A record's name appears in the LIST as well, so
a module that ignored the address entirely and fell back to its list still contained the marker and
still passed. Found by deliberately breaking the Library's record address and watching the layer
stay green. It now requires the marker AND a Back button, which every record screen carries and no
list does. The marker stays, because Back alone would not notice a module opening the wrong record.

`DB_VERSION` 7 → 8 for the `glossary` store. The pack loader derives its work from `PACKS`, so the
new pack needed no second list — the fault §13aa records, where `sources` was declared and never
loaded, does not repeat.

### Not done here

A term met on another screen does not yet link to its glossary entry. That is the more valuable
half and it touches every screen that shows a term; the glossary has to exist and have content
first. Recorded, not started.

---

## 13bu. The second chemistry audit (1.0.0-rc8)

A second pass over plant chemistry, prepared by the owner with ChatGPT and delivered as a workbook
whose `За merge` sheet is a replacing set. 153 entries became 171.

**It was checked before it was trusted, and it held.** Across the 134 rows the audit and the library
share it overwrites nothing and blanks nothing; all 19 entries it removes or reclasses carry an
empty level in the library. Nothing already judged was touched. That is the opposite of the usual
failure of a bulk merge and is worth recording as the reason this one was accepted.

Added 37, filled 29, removed 19, marked 5 as unknown. Every part now has either a strength or an
explicit statement that none can be given: **zero blank levels without a mark**.

### `merge-chemistry-audit-2.py`, and why it is a second script

The first audit script refuses to create an entry, remove one, or change a compound's class —
those are domain decisions and it has no standing to make them. This audit asks for all three. They
are done explicitly in a script that declares them, rather than smuggled through the old one by
loosening it.

What it still refuses, each seen to fail before it was trusted:

- overwriting a level that is already set
- blanking one
- removing an entry that is neither named in `Корекции вещества` nor already empty — a replacing
  set read literally makes a row dropped by accident indistinguishable from one dropped on purpose
- a compound name that is not a class in the vocabulary

### Three things found on the way

**`антоциани` → `антоцианини`.** The audit is right on IUPAC grounds — anthocyanins are the
glycosides, anthocyanidins their aglycones — and the application was already inconsistent with
itself: `seed/plants.json`, the glossary and the techniques all wrote „антоцианини" while `vocab.js`
alone wrote „антоциани". The code (`anthocyanin`) is unchanged; only the label. It also had a
practical edge: until the label was corrected, the six audit rows spelled „антоцианини" resolved to
no code and would have been skipped in silence.

**`levelUnknown`, not `confidence: 'unknown'`.** The first draft of the merge script wrote the mark
into `confidence`. But `confidence` is already a dimension in vocab.js with five values —
unverified, literature, practice, confirmed, contradicted — and `unknown` is not one of them. That
would have put an unknown code into a controlled vocabulary, which renders as its own key on
screen: exactly the fault guard 24c was written for, reintroduced one section later. A separate
boolean says the separate thing.

**A blank level was two statements wearing one face.** *Not recorded yet* and *no honest
quantitative estimate exists* both rendered as bare text. The second is a finding — the plant is
strongly seasonal or cultivar-dependent — and now reads „степен неизвестна". Only marked entries
say it; an ordinary blank still means simply not recorded. Guard 24e holds both halves: nothing may
claim a strength and no strength at once, and the words must exist for the screen to show.

### Open, recorded and not decided

**Should the chemistry vocabulary hold technologically important non-pigments?** Rhubarb leaf is
the case: its oxalates matter to a dyer and are not a colourant, so the dimension has no place for
them. Deciding this changes what the whole dimension means and was not settled in passing.

Eight parts now carry no chemistry, where the audit counted seven. The extra is
`prunus_domestica/bark`, whose two entries were both marked for removal — a consequence of the
audit's own instructions rather than an omission, but noted so the number is not a surprise later.

---

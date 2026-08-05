# Багра / Rubia — Functional Specification

*Natural dye and eco print notebook, by Crafty Place*

**Status:** v1.14 — trials built; corrections from real studio use
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

`unwashed → scoured → tannin-treated → mordanted → dyed / printed → finished`

Each transition is an **event with a date** and a link to the recipe used. Dates matter: mordanted
cloth benefits from curing, and knowing when it was mordanted is part of reading the result.
Pieces may skip states (a mordant is not always preceded by tannin).

Filtering by state gives a live inventory of the boxes — "what is in the mordanted box" is a query,
not a memory exercise.

#### Physical labelling
Each piece gets a short human-writable code (e.g. `П-042`) generated by the app, intended to be
written on a tag and pinned to the cloth. The tag carries only the code; composition, treatment
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
sourceRef:     { text, author, url } | null   // attribution for seeded knowledge
distributable: boolean                       // may this record travel in a published pack?
```

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
2. **A free-text `learnedFrom` on the record** — "from Boutrup's book", "from a course with
   Chandra", "from Maria at the market", or blank. No author field, no URL, no obligation. This
   matches reality: usually one does not know the origin, and when one does it is a chain of
   retellings rather than an authorship.
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
                  propagation {bg,en}, care {bg,en}, pests {bg,en},
                  invasive: boolean, invasiveNote {bg,en},
                  yearsToMaturity: number | null
                } | null
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
toxicity        { level: code, note {bg,en} }
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
State codes: `unwashed → scoured → tanned → mordanted → dyed → finished`. Pieces may skip states.
`state` is derived from the latest event, following the Глина single-owner rule: when state events
exist they own the state; otherwise the field set at creation does.

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
date, title
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
  typeCode,                     // scour|tannin|mordant|dye|bundle_steam|bundle_boil|
                                // post_iron|post_modifier|soap|rinse|dry|cure
  recipeId | null,              // null = improvised, which must stay allowed
  materials [ { materialId, quantity, unit } ],
  tempC,
  heldMinutes,                  // active, heated time
  restMinutes,                  // time left in the cooling bath — a separate figure, never merged
  mediumMod: MediumModification | null,
  note
}
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

## 13a. Versioning and installation

**One place holds the release number.** `version.js` exports `VERSION`; the sidebar shows it and the
service worker cache name is kept in step with it. Two numbers that can drift apart is one number
too many — a stale cache is invisible until it is expensive.

**Багра installs as a PWA.** Icons in the app palette, a complete manifest, standalone display. On a
phone this matters more than it sounds: the studio and the garden are exactly where a browser tab
is inconvenient, and where the app must work without a signal.

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

---

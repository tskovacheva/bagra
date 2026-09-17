# Терминология BG / EN — Багра / Rubia

**Approved standard.** The owner's decisions of 16 September 2026. The specification records how
each was reached (§13eh, §13ei, §13ej); this file is the table a translator, a reviewer or a
future session works from. Where this file and a screen disagree, the screen is wrong.

English follows **British spelling**: colour, fibre, aluminium, grey, mould.

Internal identifiers never change with the terminology: `mordanted`, `mordant`, `mordantCode`,
`mordant_bath` stay as they are. Only the words a person reads change.

---

## Mordant — закрепител

The Bulgarian interface does not use „мордант" as a name on its own, although the specialist
literature does. The application speaks natural Bulgarian.

| English | Български | Where |
|---|---|---|
| mordant | **закрепител** | every label, filter, column, category, role, type and sentence |
| mordanting | **обработка със закрепител** | the action, the process |
| mordanting with [substance] | **обработка с [вещество]** | when the substance is known: „Обработка с алуминиев ацетат", „Обработка със стипца" |
| mordanted | **със закрепител** (a state, a box) · **обработен / обработена / обработено / обработени със закрепител** (a participle that agrees with its noun) | the box reads „със закрепител" |
| mordant bath | **баня със закрепител** | |
| without mordant | **без закрепител** | |
| the mordant (as a factor) | **закрепителят** | |
| mordant strength | **сила на закрепителя** | |

**The glossary** names the term **„Закрепител (мордант)"** and explains it: a substance —
usually a metal salt, most often an aluminium one — that helps the dye bind to the fibre, and
that often changes the colour as well as holding it.

**„Мордант" is allowed only as an explanation in brackets straight after the Bulgarian term** —
„закрепител (мордант)", „обработка със закрепител (в литературата — мордантиране или
байцване)". It is also kept as a search alias, so a person who types the word finds the term.

### Forms

| | единствено | с член | пълен член | множествено | с член |
|---|---|---|---|---|---|
| закрепител | закрепител | закрепителя | закрепителят | закрепители | закрепителите |

„**със** закрепител" — the preposition takes -ъс before з/с. Where the noun a participle agrees
with is not known (a message about „{name}", which may be a cloth, a scarf or a label), use the
noun form instead: „{name}: обработка със закрепител преди {n} дни", not „обработен".

### Not used

| Не | Защо |
|---|---|
| мордант, морданта, морданти (on their own) | the owner's decision; allowed only in brackets after „закрепител" |
| мордантиране, мордантиран, мордансиран, мордантна баня | calques of the English; replaced by the table above |
| закрепващо средство | the rc68 term, replaced by „закрепител" at rc69 |
| байцване, байц | named in the glossary as a word the literature uses; not an interface term |
| фиксиране, фиксатор | other processes — fixing a dye, a fixative — and not substitutes for mordanting |
| запечатване | not a dyeing term |

---

## Other approved terms

| English | Български | Notes |
|---|---|---|
| scouring | **предварително изпиране** · **почистване на тъканта** | short label „изпиране" where it cannot be read as ordinary washing. Not „скауринг". |
| dye | **багрило** | |
| pigment | **пигмент** | |
| lake pigment | **лаков пигмент** | |
| extraction (the process) | **извличане** | not „екстракция"; „извлек" is the product |
| vat (indigo) | **вана** | the indigo vat; not „каца", and not „баня" |
| extract | **извлек** | extracting a dye, making a pigment and preparing a paint are three different things and are not mixed |
| modifier | **модификатор** in the glossary, with its explanation · **средство за промяна на цвета** in instructions | not the same as a pH regulator |
| substantive dye | **субстантивно багрило** | used only where correct; explained in plain words on screen |
| adjective dye | **адективно багрило** | as above |
| WOF — weight of fibre | **WOF — спрямо тежестта на тъканта** | |

### Plain explanations on screen

„Субстантивните багрила могат да се свържат с влакното без закрепител. Адективните се нуждаят от
закрепител, за да се свържат трайно." — *Substantive dyes can bind to the fibre without a mordant.
Adjective dyes need one to bind lastingly.* The word „трайно" / *lastingly* is a scientific claim
and is on the list for the scientific audit.

---

## Identifiers that are not language

| | | |
|---|---|---|
| **П** | the prefix on a cloth label (П-014) | printed on physical labels in the studio; the same in either language |
| codes in `vocab.js` | `mordanted`, `alum_acetate`, … | never translated, never shown |
| botanical names | *Rubia tinctorum* L. | Latin only; commentary belongs in the plant's prose, not in the name |
| titles of works | „НАТУРАЛНИ БАГРИЛА — ръководство", *Coloration Technology* | quoted as published |
| the studio's guide in English | NATURALNI BAGRILA [Natural Dyes] — guide | the title transliterated, a translation in brackets — no Cyrillic on the English screen |
| the author | Цветелина Ковачева · Tsvetelina Kovacheva | the full name, in each language's script |
| descriptive source names | „Tagetes erecta on cotton" → „Tagetes erecta върху памук" | a name written for the register is translated; a published title is not |

---

## How the standard is held

`scripts/try-language.mjs` fails on:

- **`term.mordantInInterface`** — „мордант" in any form, outside brackets after „закрепител", in
  the interface dictionary, the vocabulary, or a glossary term or definition;
- **`term.retiredInInterface`** — „закрепващо средство" or „байцване" in the same places;
- and, as a ratchet for the reference prose corrected in steps 3 to 5,
  **`seed.mordantInProse`** and **`seed.retiredTermInProse`**.

Search aliases are plain strings and are not read, so the old words still find the term.

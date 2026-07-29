# Багра / Rubia

A record-keeping and **reference** application for natural dyeing and eco printing,
by [Crafty Place](https://craftyplace.eu).

Багра in Bulgarian, Rubia in English — after *Rubia tinctorum*, madder, one of the two
oldest dyes in the world. The app is bilingual, so it carries two names rather than a
translation.

---

## What it is

Most craft apps are diaries: they store what you did. Багра is built the other way round —
it is a **reference that answers questions**, with a personal experience layer on top:

- What can I expect from oak leaves on cotton with aluminium acetate?
- What colour will a given tannin give on this fabric?
- What result should I expect from a blanket soaked in 1% iron solution?

Knowledge (from literature and practice) and experience (your own trials) are not separate
modules. A **Combination** holds the expected outcome; the **placements** of your own trials
attach to it. Over time the reference stops being someone else's book and becomes a record of
your water, your fabrics and your local plants.

## Modules

| | Module | Nature |
|---|---|---|
| A | Materials | Inventory and properties |
| B | Plants | Reference library |
| C | Recipes | Procedures with proportions |
| D | Techniques | Controlled vocabulary |
| E | Combinations | The reference engine |
| F | Trials | Activity log and gallery |
| G | Tools | Calculators, backup, packs |

## Principles

- **Offline-first.** IndexedDB is the only source of truth. No account, no server, no sync.
- **Bilingual in structure, not in obligation.** Interface labels and vocabularies are stored
  as stable codes and rendered per language. Authored reference prose is a `{bg, en}` pair
  whose second half may stay empty indefinitely. Personal notes are never translated.
- **Bands, not exact figures.** Combinations match on ranges — a 1% and a 1.5% iron blanket
  belong together. Exact numbers stay on the trial, where they belong.
- **The app never writes the conclusion.** It can notice that three trials share an input set
  and offer to create a reference record, pre-filled with the raw observations. Averaging
  "grey-green" and "grey-brown" produces nothing meaningful; the practitioner writes what it
  means.
- **Sources are credited, never claimed.** Seeded recipes are written as procedures in the
  app's own words with the source named. Records default to `distributable: false` — legitimate
  to hold locally, not automatically ours to redistribute.
- **Derived, not duplicated.** No stored back-references; related lists are computed on open.
- **Backward compatible.** Migrations only ever add.

## Architecture

Native ES modules, no build step. What is edited is what runs — no compilation, no
dependencies, nothing to go stale. Vanilla JavaScript, no framework.

```
index.html            shell and styles
app.js                bootstrap, routing, navigation
db.js                 IndexedDB, schema, migrations
i18n.js               dictionary and language switching
vocab.js              controlled vocabularies and band definitions
ui.js                 shared rendering helpers
fabric-logic.js       composition arithmetic and state lifecycle
modules/*.js          one file per module
calc/                 calculators — pure functions
seed/*.json           the reference library, shipped as packs
sw.js                 service worker
check.sh              verifies the service worker cache list is complete
```

## Running it locally

ES modules need a server; opening `index.html` by double-clicking will not work.

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Deploying

Static files on GitHub Pages. Before every deploy:

```sh
sh check.sh          # every module must be listed in sw.js
```

Then bump `CACHE` in `sw.js`. A module missing from that list is a module that silently stops
updating — the one mistake this architecture invites.

## Documents

- `FUNCTIONAL_SPEC.md` — the source of truth. Every decision lives there, not in chat history.
- `ROADMAP.md` — what is built, what is next, what is deliberately not being done yet.

## Attribution

Reference material is credited to its sources. Principal source so far:
Chandra Rice ([chandrarice.ca](https://www.chandrarice.ca)) — *Ecoprinting 101*, *The Eco
Printer's Field List*, *The Ecoprinter's Plant Guide*, and the aluminium acetate calculator.
Also drawn on: Joy Boutrup and Catharine Ellis, *The Art and Science of Natural Dyes*.

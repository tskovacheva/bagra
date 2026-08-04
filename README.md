# Багра / Rubia

A record-keeping and **reference** application for natural dyeing and eco printing,
by [Crafty Place](https://crafty.place).

**Live: [tskovacheva.github.io/bagra](https://tskovacheva.github.io/bagra)**

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

Reference and Combinations are one module: the search *is* the reference engine.

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

## Installing it

Багра is a PWA. Open the link in a browser and use *Install app* (desktop) or *Add to Home Screen*
(phone) and it runs in its own window, offline, with its own icon.

Everything stays on the device. There is no account and no server to sync with.

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
version.js            the single place a release number is written
backup.js             export, import, storage persistence
fabric-logic.js       composition arithmetic and state lifecycle
modules/*.js          one file per module
calc/basic.js         % WOF, solutions, bath volume, drying, exhaust
calc/scale.js         generic recipe scaling — roles, ranges, conditionals
calc/alum-acetate.js  stoichiometry with substitution
seed.js               loading and merging reference packs
seed-ui.js            the merge preview
seed/*.json           substances, plants, techniques, combinations
icons/                app icons
sw.js                 service worker
check.sh              verifies the service worker cache list is complete
```

## Protecting the data

Everything lives in IndexedDB in the browser. It survives deployments — code and data are
separate — but two things will destroy it, and both are avoidable:

1. **Private/incognito windows store nothing.** Anything entered there is gone when the window
   closes. Use a normal window and `Ctrl+Shift+R` to bypass the cache instead.
2. **Clearing site data** wipes the database. Necessary occasionally during development; make a
   backup first.

Tools → Backup downloads everything as a dated JSON file, and shows how many edits have happened
since the last one. The app also asks the browser for persistent storage so the database is not
evicted when space runs short.

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

Then bump `VERSION` in `version.js` and `CACHE` in `sw.js` to match.

### What the number means

`0.MINOR.PATCH` — the middle digit is the minor version.

- **Patch** — a fix, a wording change, a styling correction, **and any change to seed data**. New
  plants or corrected temperatures do not change what the app can do.
- **Minor** — a new module or a genuinely new capability: the reference engine, trials, the update
  flow.
- **1.0** — when the last planned module ships and the app is complete as specified.

The minor ran to 55 because early releases bumped it for seed-data updates as well. A version
number that increments for everything communicates nothing; from 0.55 onward the rule above holds.

Installed copies do not need to be closed and reopened: the app checks for a new worker whenever
it becomes visible, when the network returns, and every fifteen minutes, and offers a *new version
— update* bar rather than swapping code mid-edit. Tools → Backup also has a manual check. A module missing from that list is a module that silently stops
updating — the one mistake this architecture invites.

## Documents

- `FUNCTIONAL_SPEC.md` — the source of truth. Every decision lives there, not in chat history.
- `ROADMAP.md` — what is built, what is next, what is deliberately not being done yet.

## Attribution

Reference material is credited to its sources. Principal source so far:
Chandra Rice ([chandrarice.ca](https://www.chandrarice.ca)) — *Ecoprinting 101*, *The Eco
Printer's Field List*, *The Ecoprinter's Plant Guide*, and the aluminium acetate calculator.
Also drawn on: Joy Boutrup and Catharine Ellis, *The Art and Science of Natural Dyes*.

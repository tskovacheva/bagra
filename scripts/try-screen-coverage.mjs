// scripts/try-screen-coverage.mjs — every module is measured, or says why not.
//
// WHY THIS EXISTS.
//
// `#/pigments` was never in the screen layer's route list. Not disabled, not
// skipped, not reported — absent. The module has been in the application since
// rc-whatever added §13bx and has never once been rendered at 390px, 834px,
// 1280px or 1680px, and the suite said „all held" every time. A guard pointed
// at a screen where the defect cannot appear reports truthfully and means
// nothing; a guard pointed at NO screen is the same fault with nothing to read.
//
// Adding two lines to the list would fix the pigments and leave the hole. The
// hole is that the list is written by hand and nothing compares it to the
// application. So the question this asks is not „are the pigments there" but
// „which module does nobody measure", and it has to be answered again every
// time a module is added.
//
// STATIC ON PURPOSE. It reads app.js and screen-check.mjs as text and needs no
// browser and no shim, so it sits with the other static layers and runs on a
// laptop with nothing installed. The screen layer itself needs Chrome and is
// skipped on a development run — which is exactly when a new module gets
// written and forgotten.
//
// BOTH DIRECTIONS. An exemption that names a module which IS routed, or a
// module that no longer exists, is also a failure. An exemption list nobody
// prunes turns into permission: it is how a module gets measured for a while,
// stops, and keeps its excuse.

import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const screen = readFileSync(new URL('../screen-check.mjs', import.meta.url), 'utf8');

// The registry, read from the object literal rather than by importing app.js —
// importing it would boot the router in a process that has no document.
const registry = app.match(/const MODULES = \{([\s\S]*?)\n\};/);
if (!registry) {
  console.log('SCREEN COVERAGE: cannot find the MODULES registry in app.js.');
  process.exit(1);
}
const modules = registry[1]
  .replace(/\/\/[^\n]*/g, '')
  .split(/[,\n]/)
  .map(s => s.trim())
  .filter(Boolean);

// The exemption list lives in screen-check.mjs, beside the routes, so that
// adding a route and dropping an exemption is one edit in one file.
const declared = screen.match(/const UNMEASURED_MODULES = \[([\s\S]*?)\];/);
if (!declared) {
  console.log('SCREEN COVERAGE: screen-check.mjs declares no UNMEASURED_MODULES.');
  console.log('  A module with no route needs a written reason, not a silent gap.');
  process.exit(1);
}
const exempt = [...declared[1].matchAll(/'([^']+)'/g)].map(m => m[1]);

// Every `#/<id>` the route list mentions, however the entry is shaped —
// a bare string or `{ route: '#/x', open: true }`.
const routesBlock = screen.match(/const routes = \[([\s\S]*?)\n {2}\];/);
if (!routesBlock) {
  console.log('SCREEN COVERAGE: cannot find the routes list in screen-check.mjs.');
  process.exit(1);
}
const routed = new Set(
  [...routesBlock[1].matchAll(/'#\/([a-zA-Z0-9_-]+)/g)].map(m => m[1]));

let bad = 0;

for (const id of modules) {
  if (routed.has(id)) continue;
  if (exempt.includes(id)) continue;
  console.log(`UNMEASURED MODULE: ${id} — no address in the screen layer's route list.`);
  console.log(`  Add '#/${id}' to routes, or name it in UNMEASURED_MODULES with a reason.`);
  bad = 1;
}

for (const id of exempt) {
  if (!modules.includes(id)) {
    console.log(`STALE EXEMPTION: ${id} is excused from measurement and is not a module.`);
    bad = 1;
  } else if (routed.has(id)) {
    console.log(`POINTLESS EXEMPTION: ${id} is excused from measurement and is measured.`);
    console.log('  Remove it from UNMEASURED_MODULES; an unpruned excuse is permission.');
    bad = 1;
  }
}

if (bad) process.exit(1);
console.log(`screen coverage: ${modules.length - exempt.length} modules measured, ${exempt.length} excused.`);

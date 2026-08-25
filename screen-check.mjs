// screen-check.mjs — the layer that has eyes.
//
// `deep-check.mjs` renders in jsdom, which has no layout engine: every element
// is zero by zero, nothing overflows, nothing overlaps, and a stylesheet that
// failed to apply looks exactly like one that did. Every fault of *shape* has
// therefore had to be found by hand on a real phone, which is why the diary's
// faults are all phone faults.
//
// This drives real Chromium at two widths and asserts things that only exist
// once boxes have sizes:
//
//   · nothing extends past the right edge of the viewport
//   · rules are actually in force — a chunk of CSS lost to a stray brace has
//     shipped before, and reads as "unstyled" rather than as an error
//   · tap targets reach 44px, below which a finger misses
//   · content is not buried under the fixed bottom bar
//
// What it does NOT cover, and must not be trusted for: the camera, the photo
// gallery, real touch gestures, and how any of this feels in the hand. The
// `capture` fault would have passed here. A real phone is still the last word.

import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import fs from 'node:fs';

// `BAGRA_CHROME` names one browser and overrides the search — the same variable
// check-deps.mjs reads, so the gate and the layer it gates cannot disagree about
// which browser they are talking about (§13cy). CI sets it explicitly rather
// than hoping a path happens to exist on the runner image.
const CHROME = (process.env.BAGRA_CHROME
  ? [process.env.BAGRA_CHROME]
  : ['/opt/google/chrome/chrome', '/usr/bin/chromium',
     '/usr/bin/chromium-browser', '/usr/bin/google-chrome']).find(p => fs.existsSync(p));
if (!CHROME) {
  // A development run may skip this. A release run may not, and check-deps.mjs
  // has already refused before reaching here — so this exit is only ever the
  // convenience path, never the release one.
  console.log('screen check skipped (no chromium found)');
  if (process.env.BAGRA_CHROME) {
    console.log(`  BAGRA_CHROME is set to ${process.env.BAGRA_CHROME} and there is nothing there.`);
  }
  process.exit(0);
}
console.log(`  screen: driving ${CHROME}`);

const PORT = 8749;
const PHONE = { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
const DESK = { width: 1280, height: 900, deviceScaleFactor: 1 };

let failed = false;
const fail = (what, why) => { failed = true; console.log(`FAIL ${what}: ${why}`); };

const server = spawn('python3', ['-m', 'http.server', String(PORT)],
  { cwd: process.cwd(), stdio: 'ignore' });
const stop = () => { try { server.kill(); } catch {} };
process.on('exit', stop);

await new Promise(r => setTimeout(r, 900));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));

  await page.setViewport(PHONE);
  await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'networkidle0' });
  // The seed runs on first boot; wait for the library rather than for a clock.
  await page.waitForFunction(() => document.querySelector('#view')?.textContent?.length > 50,
    { timeout: 20000 });

  if (errors.length) fail('boot', errors[0]);
  else console.log('  screen: boots in a real browser with no page errors');

  // A stylesheet that silently failed to apply is the fault this catches. Three
  // rules from three distant parts of the sheet: if any reads as its unstyled
  // default, the sheet is broken somewhere above it.
  const applied = await page.evaluate(() => {
    const probe = (html, sel, prop) => {
      const box = document.createElement('div');
      box.innerHTML = html;
      document.querySelector('#view').append(box);
      const v = getComputedStyle(box.querySelector(sel))[prop];
      box.remove();
      return v;
    };
    return {
      tile: probe('<div class="tiles"><button class="tile">x</button></div>', '.tile', 'display'),
      weigh: probe('<div class="weighbox">x</div>', '.weighbox', 'borderRadius'),
      place: probe('<div class="placemain">x</div>', '.placemain', 'display'),
    };
  });
  const dead = Object.entries(applied)
    .filter(([, v]) => !v || v === 'inline' || v === 'block' || v === '0px')
    .map(([k]) => k);
  if (dead.length) fail('css', `rules not in force: ${dead.join(', ')} — a brace is probably wrong`);
  else console.log('  screen: rules from three parts of the sheet are all in force');

  // Fixtures, before anything is measured.
  //
  // Four of the eight lists — materials, recipes, chains, fabrics — and the
  // trials gallery hold nothing in a fresh install, so every assertion below
  // was passing on an empty state. "Nothing runs past the edge" is true of a
  // screen that says *nothing here yet*, and says nothing at all about the
  // screen once it has rows. A guard that passes because there is nothing to
  // draw has never been seen to fail (§13aa).
  //
  // One record each, with the fields the list actually prints, and deliberately
  // long ones: a phone is broken by the longest name, not the average.
  await page.evaluate(async () => {
    const db = await import('./db.js');
    const seeded = async (store, record) => {
      if ((await db.all(store)).some(r => r.id?.startsWith?.('fixture:'))) return;
      await db.put(store, db.newRecord({ id: 'fixture:' + store, ...record }));
    };
    await seeded('fabrics', {
      label: 'ПЛ-014', name: 'коприна хабутай, втора употреба',
      composition: [{ fibre: 'silk', percent: 100 }], fibreClass: 'protein',
      structure: 'plain', weightGsm: 8, dimensions: '90x300', weightG: 24,
      quantity: { value: 1, unit: 'pcs' }, baseColour: 'natural', state: 'ready',
    });
    await seeded('stock', {
      substanceId: 'seed:alum', form: 'powder', supplier: 'Кемо-Трейд ООД, София',
      acquiredDate: '2026-03-14', quantity: { value: 500, unit: 'g' },
      used: { value: 380, unit: 'g' }, concentrationPercent: null,
    });
    await seeded('recipes', {
      name: { bg: 'мордансване с алуминиев ацетат за целулоза', en: 'aluminium acetate' },
      type: 'mordant', appliesTo: ['cellulose'], basis: 'goods',
      ingredients: [{ role: 'mordant', percentWof: 5 }], steps: [],
    });
    await seeded('chains', {
      name: { bg: 'подготовка на памук от суров плат до готов за печат', en: 'cotton' },
      appliesTo: ['cellulose'], steps: [{ recipeId: 'fixture:recipes' }],
    });
    await seeded('trials', {
      status: 'planned', title: 'дъб и клен върху коприна, къс сноп',
      intent: 'проба за роклята', date: '2026-08-10', processCode: 'ecoprint',
      placements: [], steps: [], resultPhotos: [],
    });
  });
  await new Promise(r => setTimeout(r, 400));

  // Every address the application has, not the twelve that were listed by hand.
  // `open` names a module whose records have no address of their own yet
  // (§13q): until they do, the record is reached the only way a person can
  // reach it — by pressing the first row.
  const routes = [
    '#/dashboard',
    '#/reference', '#/reference/records',
    '#/plants', { route: '#/plants', open: true },
    // A seeded plant by name, because the fixture the list opens has no
    // photograph and the overflow this catches came from the photo CREDIT — a
    // name, a licence and a taxon on one line, which took the whole width on a
    // phone and pushed the facts beside it off the screen (§13bb). A check that
    // only ever opens a record without a picture cannot see it.
    '#/plants/seed:crataegus_monogyna',
    '#/recipes', '#/recipes/chains', { route: '#/recipes', open: true },
    '#/substances', { route: '#/substances', open: true },
    '#/materials', { route: '#/materials', open: true },
    '#/techniques', { route: '#/techniques', open: true },
    '#/tools', '#/tools/backup',
    // `#/sources` for as long as this list has existed, and there has been no
    // module of that name since attribution folded into the Library (§13bt).
    // An unknown id falls back to the dashboard (app.js), so the layer rendered
    // the HOME SCREEN three times and reported its faults under the name of
    // Sources — including „there is no record to open", which was true of the
    // dashboard and said nothing whatever about the Sources table. Four of the
    // six failures on the first release run were this one line.
    //
    // The Library's tab is in the address (§13q), which is what makes the
    // correction a route rather than a click.
    '#/library', '#/library/ph',
    '#/library/sources', { route: '#/library/sources', open: true },
    '#/fabrics', { route: '#/fabrics', open: true },
    '#/trials', '#/trials/new', { route: '#/trials', open: true },
  ];

  // A fixed delay is a guess, and the guess was 280ms. The plants list renders
  // 48 rows from IndexedDB and had not finished when the measurement was taken,
  // so half of what the layer looked at was a half-drawn screen. Wait for the
  // view to stop changing instead.
  // Two consecutive equal readings are not enough on their own: taken before
  // the new render has started, they are two readings of the *previous* screen,
  // and the layer then measures the wrong page. The view is emptied first, so
  // "settled" means content arrived and then stopped growing.
  const settled = async (limit = 4000) => {
    let last = -1;
    for (let waited = 0; waited < limit; waited += 100) {
      await new Promise(r => setTimeout(r, 100));
      const now = await page.evaluate(() => document.getElementById('view')?.innerHTML.length ?? -1)
        .catch(() => -1);
      if (now > 200 && now === last) return true;
      last = now;
    }
    return false;
  };

  for (const [name, viewport] of [['phone', PHONE], ['desk', DESK]]) {
    await page.setViewport(viewport);
    let worst = null;

    for (const entry of routes) {
      const address = typeof entry === 'string' ? entry : entry.route;
      const route = typeof entry === 'string' ? address : address + ' (opened)';
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          // Away and back, so that asking for the address already shown still
          // re-renders, and with the view emptied so a stale screen cannot be
          // mistaken for the new one.
          await page.evaluate(() => { location.hash = '#/blank'; });
          await new Promise(r => setTimeout(r, 120));
          await page.evaluate(() => { document.getElementById('view').innerHTML = ''; });
          await page.evaluate(h => { location.hash = h; }, address);
          break;
        } catch {
          // The service worker can reload the page mid-run, which destroys the
          // execution context. Wait for the new one and ask again.
          await page.waitForFunction(() => document.querySelector('#view'), { timeout: 10000 })
            .catch(() => {});
        }
      }
      await settled();

      if (typeof entry !== 'string' && entry.open) {
        // Poll rather than ask once. One run in a dozen reported "the fixture
        // did not land" on a list that had 48 rows a moment later, and a guard
        // that fails at random is worse than no guard: it teaches you to run it
        // again instead of reading it. The cause is the service worker
        // reloading the page mid-run, so the budget has to cover a whole boot,
        // and the address is asked for again halfway through in case the reload
        // landed somewhere else.
        let opened = false;
        for (let waited = 0; waited < 9000 && !opened; waited += 150) {
          opened = await page.evaluate(() => {
            const row = document.querySelector('#view tbody tr, #view [data-open]');
            if (!row) return false;
            row.click();
            return true;
          }).catch(() => false);
          if (!opened) {
            if (waited === 4500) await page.evaluate(h => { location.hash = h; }, address).catch(() => {});
            await new Promise(r => setTimeout(r, 150));
          }
        }
        if (!opened) { fail(`${name} ${route}`, 'there is no record to open — the fixture did not land'); continue; }
        await settled();
      }

      const seen = await page.evaluate(() => {
        const W = document.documentElement.clientWidth;
        // An element wider than the window is only a fault if nothing above it
        // scrolls. Inside a pane that scrolls sideways on purpose, being wide
        // is the arrangement, not the problem.
        const scrolls = (el) => {
          for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
            const ox = getComputedStyle(n).overflowX;
            if (ox === 'auto' || ox === 'scroll') return true;
          }
          return false;
        };
        const over = [];
        for (const el of document.querySelectorAll('#view *')) {
          const b = el.getBoundingClientRect();
          if (!b.width) continue;
          // Only the outermost offender is worth naming: a wide table drags
          // every cell past the edge and the cells are not the fault.
          if (b.right > W + 1 && !(el.parentElement?.getBoundingClientRect().right > W + 1)
              && !scrolls(el)) {
            over.push({ sel: el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className
              ? '.' + el.className.trim().split(/\s+/)[0] : ''), by: Math.round(b.right - W) });
          }
        }
        // A control smaller than 44px is a control a finger misses. At a desk a
        // 19px target is a small mouse target; in a wet hand in a garden it is
        // not a target at all, so this fails on the phone and stays a note on
        // the desk. Named, not just counted — "a control is 19px tall" was
        // printed for four releases and found nobody the control.
        const small = [];
        for (const el of document.querySelectorAll('#view button, #view a, #view input, #view select, .bottomnav button')) {
          // A checkbox cannot be resized, and it is not the target: the label
          // around it is, because pressing a label toggles its input. Measure
          // what a finger actually has to hit.
          const box = (el.type === 'checkbox' || el.type === 'radio')
            ? (el.closest('label') || el) : el;
          const b = box.getBoundingClientRect();
          if (!b.width || !b.height || b.height >= 44) continue;
          if (getComputedStyle(el).display === 'none') continue;
          // A link inside a sentence is text, not a control: making it 44px
          // tall would mean setting prose in 44px lines.
          // A credit line is prose that happens to link out — the licence
          // requires the author's name to be readable, not pressable. Setting
          // it at 44px would be a bigger claim on the page than the plant.
          if (el.tagName === 'A' && el.parentElement?.closest('p, td, .note, .desc, .credit')) continue;
          small.push({
            h: Math.round(b.height),
            what: el.tagName.toLowerCase()
              + (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/)[0] : '')
              + (el.textContent.trim() ? ` "${el.textContent.trim().slice(0, 16)}"` : ''),
          });
        }
        // Text wider than the box it sits in. The plate on the dashboard tiles
        // pushed the name into the count — "Справо31ик" — and no off-screen
        // measurement can see it, because the collision happens in the middle
        // of the window. Only elements that hold text directly, and only where
        // nothing has been asked to clip or ellipsise.
        const collided = [];
        for (const el of document.querySelectorAll('#view *')) {
          if (el.children.length || !el.textContent.trim()) continue;
          const cs = getComputedStyle(el);
          if (cs.overflow !== 'visible' || cs.textOverflow === 'ellipsis') continue;
          if (cs.whiteSpace === 'nowrap' && el.scrollWidth > el.clientWidth + 1 && el.clientWidth)
            collided.push(`${el.className || el.tagName}: "${el.textContent.trim().slice(0, 18)}"`);
        }

        // Not "is a button below the bar" — most of a scrolling page is. The
        // question is whether the view reserves room for the bar at the end of
        // its scroll, which is the only place content can actually be trapped.
        const bar = document.querySelector('.bottomnav');
        const shown = bar && getComputedStyle(bar).display !== 'none';
        const barH = shown ? bar.getBoundingClientRect().height : 0;
        const pad = parseFloat(getComputedStyle(document.querySelector('.view')).paddingBottom);
        const buried = shown && pad < barH;

        // A pane that clips rather than scrolls loses data with no sign at all:
        // the plants list was 561px inside a 360px panel with overflow hidden,
        // and the last two columns were simply unreachable on a phone.
        const clipped = [];
        for (const el of document.querySelectorAll('#view *')) {
          const cs = getComputedStyle(el);
          if (cs.overflowX === 'hidden' && el.scrollWidth > el.clientWidth + 1 && el.clientWidth)
            clipped.push((el.className || el.tagName).toString().split(' ')[0]
              + ` (${el.scrollWidth} in ${el.clientWidth})`);
        }
        // A list below 640px is stacked rows, above it a table (§13ae). Checked
        // because every other assertion here would pass on a table that had
        // quietly gone back to being a table: it would simply scroll sideways
        // inside its panel, which is the arrangement the stopgap allowed.
        let table = null;
        const grid = document.querySelector('#view table.grid tbody tr');
        if (grid) {
          const cells = [...grid.children];
          const labelled = cells.find(c => c.hasAttribute('data-label') && !c.classList.contains('leadcell'));
          table = {
            rowDisplay: getComputedStyle(grid).display,
            lead: !!cells.find(c => c.classList.contains('leadcell')),
            labelShown: labelled ? getComputedStyle(labelled, '::before').content !== 'none' : null,
          };
        }
        return { over, small, buried, clipped, collided, table, docW: document.documentElement.scrollWidth, W };
      });

      if (seen.docW > seen.W + 1)
        fail(`${name} ${route}`, `the page is ${seen.docW}px wide in a ${seen.W}px window`);
      for (const o of seen.over)
        fail(`${name} ${route}`, `${o.sel} runs ${o.by}px past the edge`);
      if (seen.buried) fail(`${name} ${route}`, 'the view leaves no room for the bottom bar');
      for (const c of (seen.collided || []))
        fail(`${name} ${route}`, `text overruns its box: ${c}`);
      for (const c of seen.clipped)
        fail(`${name} ${route}`, `content is clipped, not scrollable: ${c}`);
      if (seen.table) {
        if (name === 'phone') {
          if (seen.table.rowDisplay !== 'block')
            fail(`${name} ${route}`, `the list is still a table (tr is ${seen.table.rowDisplay})`);
          if (!seen.table.lead)
            fail(`${name} ${route}`, 'no cell heads the stacked row');
          if (seen.table.labelShown === false)
            fail(`${name} ${route}`, 'a stacked cell carries no column heading');
        } else if (seen.table.rowDisplay !== 'table-row') {
          fail(`${name} ${route}`, `the list stopped being a table on the desk (tr is ${seen.table.rowDisplay})`);
        }
      }

      if (seen.small.length) {
        const named = [...new Map(seen.small.map(s => [s.what, s])).values()]
          .sort((a, b) => a.h - b.h).slice(0, 4)
          .map(s => `${s.what} ${s.h}px`).join(', ');
        if (name === 'phone') fail(`${name} ${route}`, `a finger misses these: ${named}`);
        else if (!worst) worst = `${route}: ${named}`;
      }
    }

    if (worst) console.log(`  screen (${name}): note — ${worst}`);
    // Printed only when the sweep was actually clean. "23 views, nothing past
    // the edge" appeared underneath a column of failures and read as a summary
    // of them.
    if (!failed) console.log(`  screen (${name}): ${routes.length} views, all sound`);
  }
} finally {
  await browser.close();
  stop();
}

console.log(failed ? 'SCREEN CHECK FAILED' : 'screen check passed');
process.exit(failed ? 1 : 0);

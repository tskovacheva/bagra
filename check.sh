#!/bin/sh
# Two things that only fail after deployment, checked before it.

# 1. Every module on disk must be listed in the service worker cache list.
#    A file missing there is a file that silently stops updating.
#
#    This layer had no exit. It printed fourteen NOT CACHED lines for fourteen
#    dead root-level copies of modules that had moved into modules/ and calc/,
#    and every release walked past them because the script carried on and left
#    with status 0. A guard that reports and does not stop is not a guard: the
#    fifteenth line, the one naming a live module, would have looked exactly
#    like the fourteen that were always there. The dead files are gone and this
#    now stops the run.
#
#    The prototype/ directory is excluded on purpose: it holds layout sketches
#    that are never loaded by the application and must not be cached.
missing=0
for f in $(find . -name node_modules -prune -o -name prototype -prune -o \
             -name scripts -prune -o -name '*.js' ! -name 'sw.js' \
             ! -name 'check-scope.js' ! -name 'check-boot.mjs' -print | sed 's|^\./||'); do
  grep -q "'\./$f'" sw.js || { echo "NOT CACHED: $f"; missing=1; }
done
if [ $missing -ne 0 ]; then
  echo "A file on disk is absent from the worker's list; it would stop updating."
  exit 1
fi
echo "sw.js cache list is complete."

# 1a. Seed data is cached like code, and was not being checked like code. The
#     first layer walked *.js only, so a new seed/*.json could ship absent from
#     the worker's list and simply fail to load for anyone offline — which is
#     everyone, since the application is offline-first.
#     Top level only, deliberately: seed/en/*.json are the translation batches
#     the build reads (§13bc), not data the application loads, and requiring
#     them in the worker's list would cache files nobody fetches.
missing_seed=""
for f in seed/*.json; do
  grep -q "'\./$f'" sw.js || missing_seed="$missing_seed $f"
done
if [ -n "$missing_seed" ]; then
  echo "SEED NOT CACHED:$missing_seed"
  exit 1
fi
echo "every seed file is in the cache list."

# 1b. The cache name must carry the current version. It sat at v0.70.0 while the
#     app was at v0.82.1 — twelve releases during which sw.js never changed, so
#     the browser had no reason to install a new worker and devices kept serving
#     the old files. Silent, and invisible on a desktop that hard-reloads.
ver=$(sed -n "s/.*VERSION = '\(.*\)'.*/\1/p" version.js)
if grep -q "bagra-v$ver'" sw.js; then
  echo "sw.js cache name matches version.js ($ver)."
else
  echo "CACHE NAME STALE: version.js is $ver, sw.js says $(sed -n "s/.*CACHE = '\(.*\)'.*/\1/p" sw.js)"
  exit 1
fi

# 1c. Specification sections must not vanish. Editing the document by replacing
#     an anchor heading deleted §13l outright — the replacement simply did not
#     put the heading back, and nothing noticed. Decisions live in this file, so
#     a lost section is a lost decision.
#
#     The pattern was `13[a-z]\.`, then `13[a-z]+\.` when the log ran past §13z.
#     Both watched §13 alone. Inserting §13ad immediately above §14 swallowed the
#     `## 14. Technical architecture` heading — the same fault as §13l, in the
#     same way, with the guard for it already installed and looking elsewhere. It
#     now watches every numbered section in the document.
SECTIONS='^## [0-9][0-9a-z.]*'
dupes=$(grep -oE "$SECTIONS" FUNCTIONAL_SPEC.md | sort | uniq -d)
if [ -n "$dupes" ]; then
  echo "DUPLICATE SPEC SECTIONS: $dupes"
  exit 1
fi
if [ -f .spec-sections ]; then
  grep -oE "$SECTIONS" FUNCTIONAL_SPEC.md | sort > /tmp/.spec-now
  missing=$(comm -23 .spec-sections /tmp/.spec-now)
  if [ -n "$missing" ]; then
    echo "SPEC SECTIONS LOST:$missing"
    exit 1
  fi
fi
grep -oE "$SECTIONS" FUNCTIONAL_SPEC.md | sort > .spec-sections
echo "no specification section has been lost."

# 2. A variable assigned but never declared throws only when the line runs —
#    usually on a click — and the symptom is a screen that quietly stops
#    responding. See check-scope.js.
node check-scope.js modules || exit 1

# 2a. The invariants of §13bd: the action vocabulary and the code agree, tannin
#     and an afterbath do not move a piece between boxes, and every action
#     belongs to a batch or to a trial. Pass a backup file to check real data
#     too; without one it checks the code alone.
node check-actions.mjs || exit 1

# 3. `capture="environment"` on a file input does not prefer the camera — it
#    removes the gallery and the file system as options. It shipped on the three
#    photo inputs in the diary and made an already-taken photograph impossible
#    to attach. Cheap to reintroduce by copying a nearby input, so guarded here.
if grep -rn 'capture=' --include='*.js' --include='*.html' . \
     | grep -v node_modules | grep -v '^\./check' \
     | grep -vE '^[^:]+:[0-9]+: *(//|\*|<!--)'; then
  echo "CAPTURE ATTRIBUTE: a file input forces the camera and hides the gallery."
  exit 1
else
  echo "no file input forces the camera."
fi

# 3b. A key with no translation renders as the key. `t('common.cancel')` was on
#     the *new work* screen — the first screen of the diary — and the button
#     read "common.cancel" for as long as it has existed. Nothing failed: a
#     missing key returns something, and something plausible is exactly what
#     hides the fault (§4 principle). Literal keys only; `t('nav.' + id)` is
#     built at run time and cannot be checked here.
#     Each language is read separately. Read as one file, a key present in
#     English and missing in Bulgarian passes — and Bulgarian is the language
#     the application is used in.
missing=$(node -e "
const fs=require('fs');
const dict=fs.readFileSync('i18n.js','utf8');
const cut=dict.indexOf('  en: {');
const keys=(s)=>new Set([...s.matchAll(/^\s*'([a-zA-Z0-9_.\-]+)':/gm)].map(m=>m[1]));
const has={bg:keys(dict.slice(dict.indexOf('  bg: {'),cut)), en:keys(dict.slice(cut))};
const out=new Set();
for (const f of fs.readdirSync('modules').map(f=>'modules/'+f).concat(['app.js','ui.js','backup.js','seed-ui.js','photo.js','fabric-logic.js']))
  for (const m of fs.readFileSync(f,'utf8').matchAll(/\bt\(\s*'([a-zA-Z0-9_.\-]+)'\s*[,)]/g))
    for (const l of ['bg','en'])
      if (!has[l].has(m[1])) out.add(m[1]+'  — no '+l+'  ('+f+')');
console.log([...out].join('\n'));
")
if [ -n "$missing" ]; then
  echo "TRANSLATION KEYS WITH NO TRANSLATION:"
  echo "$missing"
  exit 1
fi
echo "every translation key used has a translation."

# 3c. A chip names, a box is pressed. `.chip` is a span — the conditions under a
#     reference result, a technique's category, a plant's precautions — and does
#     nothing when pressed. `.box` is a button that changes what the list shows,
#     and is what rule 3 (§13s) means by a chip. They look alike, which is how
#     they get confused, and the confusion has a cost in both directions: a
#     `.box` that is not a button escapes the 44px finger target, and a `.chip`
#     that is a button invites a press and is too small to receive one.
if grep -rnE '<button[^>]*class="chip[ "$]|<span[^>]*class="box[ "$]' \
     --include='*.js' modules ui.js 2>/dev/null; then
  echo "CHIP AND BOX CONFUSED: a chip names and a box is pressed (§13ac)."
  exit 1
fi
echo "chips name, boxes are pressed."

# 4. Boot the real module graph. `node --check` passes on a name imported
#    twice, an import of a missing export, or a throw during start-up — each of
#    which gives a blank page. Skipped when the shim is not installed.
if node -e "require.resolve('jsdom')" 2>/dev/null; then
  node check-boot.mjs || exit 1
  # 5. Booting proves the app starts; it stops at each module's list. Read
  #    views and forms are where the imports actually get used, so they are
  #    opened too. See deep-check.mjs.
  node deep-check.mjs || exit 1
  # 5b. A pack update runs against an INSTALLED copy, and no layer above sees
  #     one: they all read the shipped files, where a record that has left the
  #     pack simply is not there. On a real installation it is, and until rc13 it
  #     stayed for ever — an updated copy and a fresh one drifting apart with
  #     nothing to say so. This seeds the previous pack into a database, applies
  #     this one, and checks what actually left (§13cb).
  node scripts/try-pack-withdrawal.mjs || exit 1
  # 6. jsdom has no layout engine: nothing has a size, so nothing can overflow,
  #    overlap, or be clipped, and a stylesheet that failed to apply looks
  #    exactly like one that did. Every fault of *shape* has had to be found by
  #    hand on a phone. `screen-check.mjs` drives real Chromium at 390px and
  #    1280px. It does not replace a phone — no camera, no gallery, no touch —
  #    but it catches the geometric faults before the phone has to.
  if node -e "require.resolve('puppeteer-core')" 2>/dev/null; then
    node screen-check.mjs || exit 1
  else
    echo "screen check skipped (npm install --no-save puppeteer-core)"
  fi
else
  echo "boot check skipped (npm install --no-save jsdom fake-indexeddb)"
fi

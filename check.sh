#!/bin/sh
# Two things that only fail after deployment, checked before it.

# 1. Every module on disk must be listed in the service worker cache list.
#    A file missing there is a file that silently stops updating.
missing=0
for f in $(find . -name node_modules -prune -o -name '*.js' ! -name 'sw.js' \
             ! -name 'check-scope.js' ! -name 'check-boot.mjs' -print | sed 's|^\./||'); do
  grep -q "'\./$f'" sw.js || { echo "NOT CACHED: $f"; missing=1; }
done
[ $missing -eq 0 ] && echo "sw.js cache list is complete."

# 2. A variable assigned but never declared throws only when the line runs —
#    usually on a click — and the symptom is a screen that quietly stops
#    responding. See check-scope.js.
node check-scope.js modules || exit 1

# 3. Boot the real module graph. `node --check` passes on a name imported
#    twice, an import of a missing export, or a throw during start-up — each of
#    which gives a blank page. Skipped when the shim is not installed.
if node -e "require.resolve('jsdom')" 2>/dev/null; then
  node check-boot.mjs || exit 1
  # 4. Booting proves the app starts; it stops at each module's list. Read
  #    views and forms are where the imports actually get used, so they are
  #    opened too. See deep-check.mjs.
  node deep-check.mjs || exit 1
else
  echo "boot check skipped (npm install --no-save jsdom fake-indexeddb)"
fi

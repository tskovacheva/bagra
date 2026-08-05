#!/bin/sh
# Two things that only fail after deployment, checked before it.

# 1. Every module on disk must be listed in the service worker cache list.
#    A file missing there is a file that silently stops updating.
missing=0
for f in $(find . -name '*.js' ! -name 'sw.js' ! -name 'check-scope.js' | sed 's|^\./||'); do
  grep -q "'\./$f'" sw.js || { echo "NOT CACHED: $f"; missing=1; }
done
[ $missing -eq 0 ] && echo "sw.js cache list is complete."

# 2. A variable assigned but never declared throws only when the line runs —
#    usually on a click — and the symptom is a screen that quietly stops
#    responding. See check-scope.js.
node check-scope.js modules || exit 1

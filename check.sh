#!/bin/sh
# Verifies that every module file on disk is listed in the service worker
# cache list. The one deployment mistake this architecture invites (§14.3).
missing=0
for f in $(find . -name '*.js' ! -name 'sw.js' | sed 's|^\./||'); do
  grep -q "'\./$f'" sw.js || { echo "NOT CACHED: $f"; missing=1; }
done
[ $missing -eq 0 ] && echo "sw.js cache list is complete."

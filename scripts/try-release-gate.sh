#!/bin/sh
# scripts/try-release-gate.sh — does a missing test dependency stop a release?
#
# The fault this guards: a run of 1.0.0-rc25 in an environment without jsdom
# printed one line about skipping and then „all held", and left with status 0.
# Three of the six layers had not started and the pipeline reported success.
#
# The gate itself therefore needs a guard, and it needs one in BOTH directions,
# because the failure mode is asymmetric and quiet. A gate stuck open lets an
# unchecked candidate through, which is the fault we came for. A gate stuck shut
# stops every development run and would be pulled out within a week, which is
# how the suite loses a layer permanently. So all three cases are asserted:
#
#   present + release       → 0   the layer runs
#   missing + development   → 2   the caller skips it and says so
#   missing + release       → 1   the run stops
#
# A module name nobody will ever install stands in for the missing dependency,
# so the test does not have to move node_modules around to create the condition.

cd "$(dirname "$0")/.." || exit 1

fail=0
expect() {
  want=$1; shift
  "$@" >/dev/null 2>&1
  got=$?
  if [ "$got" = "$want" ]; then
    echo "  ok   exit $want — $LABEL"
  else
    echo "  FAIL expected exit $want, got $got — $LABEL"
    fail=1
  fi
}

ABSENT=bagra-no-such-module-ever

LABEL="a dependency that is present does not stop a release run"
expect 0 node check-deps.mjs --release node:fs

LABEL="a missing dependency on a development run says so and lets it continue"
expect 2 node check-deps.mjs $ABSENT

LABEL="a missing dependency on a release run stops it"
expect 1 node check-deps.mjs --release $ABSENT

LABEL="a missing browser stops a release run even when the driver is installed"
expect 1 env BAGRA_CHROME=/nonexistent/chromium node check-deps.mjs --release --chromium node:fs

LABEL="a browser that IS there does not stop one"
expect 0 env BAGRA_CHROME=/bin/sh node check-deps.mjs --release --chromium node:fs

# The message has to name what is missing. A release that stops without saying
# what to install is a release that stops twice.
if node check-deps.mjs --release $ABSENT 2>&1 | grep -q "$ABSENT"; then
  echo "  ok   the failure names the missing module"
else
  echo "  FAIL the failure does not say what is missing"
  fail=1
fi


# The CI workflow is only useful if it runs the same command this file guards,
# with a browser it has actually found. Two things worth a static check, and no
# more: a workflow asserting its own YAML indentation would be a test written to
# raise a number.
WF=.github/workflows/release-check.yml
if [ -f "$WF" ]; then
  grep -q "check.sh --release" "$WF" \
    && echo "  ok   CI runs the release command, not the development one" \
    || { echo "  FAIL CI does not run check.sh --release"; fail=1; }
  grep -q "BAGRA_CHROME" "$WF" \
    && echo "  ok   CI names the browser it drives" \
    || { echo "  FAIL CI leaves the browser to chance"; fail=1; }
  grep -q "npm ci" "$WF" \
    && echo "  ok   CI installs from the lockfile" \
    || { echo "  FAIL CI does not install from the lockfile"; fail=1; }
  # A permanent allow-failure would turn the gate into decoration. Matched on
  # `continue-on-error` alone: `|| true` appears legitimately on a line that
  # prints a browser version and means nothing about whether the job may fail.
  if grep -q "continue-on-error" "$WF"; then
    echo "  FAIL CI is allowed to fail — the gate would be decoration"; fail=1
  else
    echo "  ok   CI is not allowed to pass a failing run"
  fi
else
  echo "  FAIL no CI workflow"; fail=1
fi

[ $fail = 0 ] && echo "release gate holds" || echo "RELEASE GATE FAILED"
exit $fail

#!/bin/sh
# One-time cleanup, 1.0.0-rc6. See FUNCTIONAL_SPEC.md and ROADMAP.md for why.
#
# Fourteen .js files and three .json files sat in the repo root under the same
# names as real modules that had moved into modules/ and calc/. They were not
# stale copies with old-but-readable content — their content was shifted by
# one position alphabetically across the whole root, through every file type
# (seed/combinations.json's old root copy held removed-sections.md's text;
# packs.js and recipes.js held PNG bytes). Nothing loaded them: sw.js's cache
# list, index.html and manifest.json never named them. Confirmed dead by
# reading modules/ and calc/ and every seed/*.json pack, all of which name
# themselves correctly in their own first line or packId.
#
# _reviews/ held working documents (docx review notes), not code or shipped
# data. It does not belong in the repository and must not travel with every
# future clone; removed from git's index, not just off disk, so it does not
# return on the next commit.
#
# gitignore (no leading dot) was never read by git as an ignore file, which is
# why _reviews/ and node_modules/ had nothing keeping them out in the first
# place. Renamed to .gitignore and given real content.
#
# Re-runnable: every step is idempotent, and the layer-1 check in check.sh
# would immediately flag it if any of these names turned out to still matter.
set -e

DEAD_JS="alum-acetate.js chains.js dashboard.js fabrics.js materials.js \
  packs.js plants.js recipes.js reference.js scale.js sources.js \
  substances.js techniques.js trials.js"
DEAD_JSON="combinations.json techniques.json sources.json"
DEAD_MISC="removed-sections.md trim-library.py fix-studio-backup.py \
  icon-192.png icon-512.png icon-192-maskable.png icon-512-maskable.png"

for f in $DEAD_JS $DEAD_JSON $DEAD_MISC; do
  if [ -f "$f" ]; then
    rm -f "$f"
    echo "removed: $f"
  fi
done

if [ -d _reviews ]; then
  git rm -q --cached -r _reviews > /dev/null 2>&1 || true
  rm -rf _reviews
  echo "removed: _reviews/ (and un-tracked it)"
fi

if [ -f gitignore ] && [ ! -f .gitignore ]; then
  git mv gitignore .gitignore 2>/dev/null || mv gitignore .gitignore
  echo "renamed: gitignore -> .gitignore"
fi

cat > .gitignore <<'EOF'
node_modules/
package-lock.json
package.json
_reviews/
__pycache__/
.spec-sections
EOF
echo "written: .gitignore"

rm -rf scripts/__pycache__
echo "removed: scripts/__pycache__"

echo "cleanup complete."

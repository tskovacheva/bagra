# archive/

Records taken out of a shipped pack, kept whole so they can come back. Nothing here is loaded by the
application, cached by the service worker or checked as part of a pack.

- `withdrawn/recipes-madder-lake-fermentation.json` — withdrawn at 1.0.0-rc74 until the fermentation process
  and its safety are checked (DECISIONS §23, spec §13eo). To restore it: put `record` back into
  `seed/recipes.json`, bump the pack version, and restore the line excused in
  `scripts/try-recipe-lines-named.mjs`.
- `withdrawn/plant-parts-rc76.json` — four plant parts with no source as dye parts (§13eq).
- `withdrawn/rc77-paubrasilia_echinata.json` — sappanwood's plant and combination under the old id (§13es); also the
  fixture of `scripts/try-plant-id-change.mjs`, so it is not to be removed.
- `withdrawn/recipes-madder-lake-hot.json` — withdrawn at 1.0.0-rc79 as incomplete (§13et, DECISIONS §26); also the
  fixture two deep-check blocks load, so it is not to be removed.
- `withdrawn/recipes-pastel-binder-gum.json` — not approved for publication at 1.0.0-rc84 (§13ey, DECISIONS §31); its
  option in `pastels-from-pigment` removed with it. The file says how to restore both.

# archive/

Records taken out of a shipped pack, kept whole so they can come back. Nothing here is loaded by the
application, cached by the service worker or checked as part of a pack.

- `withdrawn/recipes-madder-lake-fermentation.json` — withdrawn at 1.0.0-rc74 until the fermentation process
  and its safety are checked (DECISIONS §23, spec §13eo). To restore it: put `record` back into
  `seed/recipes.json`, bump the pack version, and restore the line excused in
  `scripts/try-recipe-lines-named.mjs`.
- `withdrawn/plant-parts-rc76.json` — four plant parts with no source as dye parts (§13eq).
- `withdrawn/images/paubrasilia_echinata.jpg` — that plant's photograph, moved out of `seed/images/plants/` at
  1.0.0-rc122: it was cached and shipped while no screen showed it or its credit (§13fx).
- `withdrawn/images/rhus_coriaria.jpg` — the sumac photograph, withdrawn at 1.0.0-rc123 (§13fy): CC BY-ND 2.0,
  added by hand outside the import scripts, so a crop could not be ruled out, and ND allows none. Its credit
  was: {"author": "wynjym", "licence": "CC BY-ND 2.0", "source": "https://www.flickr.com/photos/wynjym/1076737816", "taxon": "Rhus coriaria", "note": "Rhus coriaria — the spice sumac, not the ornamental R. typhina."}. A CC0, CC BY or CC BY-SA photograph of *Rhus coriaria*
  can take its place through `scripts/import-photos-by-name.py`. **Replaced at rc124** by Lazaregagnidze's
  CC BY-SA 3.0 photograph, cropped (§13fz); this file stays here as history.
- `withdrawn/rc77-paubrasilia_echinata.json` — sappanwood's plant and combination under the old id (§13es); also the
  fixture of `scripts/try-plant-id-change.mjs`, so it is not to be removed.
- `withdrawn/recipes-madder-lake-hot.json` — withdrawn at 1.0.0-rc79 as incomplete (§13et, DECISIONS §26); also the
  fixture two deep-check blocks load, so it is not to be removed.
- `withdrawn/recipes-pastel-binder-gum.json` — not approved for publication at 1.0.0-rc84 (§13ey, DECISIONS §31); its
  option in `pastels-from-pigment` removed with it. The file says how to restore both.

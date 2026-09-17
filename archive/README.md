# archive/

Records taken out of a shipped pack, kept whole so they can come back. Nothing here is loaded by the
application, cached by the service worker or checked as part of a pack.

- `withdrawn/recipes-madder-lake-fermentation.json` — withdrawn at 1.0.0-rc74 until the fermentation process
  and its safety are checked (DECISIONS §23, spec §13eo). To restore it: put `record` back into
  `seed/recipes.json`, bump the pack version, and restore the line excused in
  `scripts/try-recipe-lines-named.mjs`.

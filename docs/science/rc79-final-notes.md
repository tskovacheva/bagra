# Scientific audit — last three refinements (rc79)

| what | rc78 | rc79 | source |
|---|---|---|---|
| `titanium_oxalate.safetyNote` bg/en | no dose context | „2% WOF в записа е препоръка по конкретен източник (Natural Dye Store, „Mordants: an overview“), а не универсална стандартна доза: други доставчици дават 1–5% (Blotz), 8–10% (Maiwa) и 5–15% (Wild Colours)." / the same in English | Natural Dye Store, *Mordants: an overview* (already registered as `natural-dye-store-mordants`); Blotz; Maiwa; Wild Colours |
| `standardPercentWof` | 2 | 2 — unchanged, and no calculator touched | |
| recipe `madder-lake-hot` | in the pack | **withdrawn**, kept whole in `archive/withdrawn/recipes-madder-lake-hot.json` (recipes 0.18.0) | DECISIONS §26 |
| `biancaea_sappan` Sources | a Kew link that could not be resolved to this species | `https://powo.science.kew.org/taxon/482900-1` — POWO's record for *Caesalpinia sappan* L., a synonym of *Biancaea sappan* | POWO 482900-1 |

The second Kew link in the rc77 record and the one left at rc78 were checked: POWO gives *Caesalpinia sappan* under
482900-1, so neither of the old identifiers could be shown to belong to this species. They are out, and the verified
one is in. Botanical identity, id and migration are untouched.

**Found while retargeting the checks, not changed:** `compound-mordant-dark` also asks for iron above the library's
2% ceiling, and the calculator flags it, as it does `iron-bath-dark`.

# Scientific audit — closing package (rc78)

Numbers unchanged except where stated. Every structural change was checked against an installed rc77.

## 1–2. Sappanwood — botanical identity and chemistry

| what | rc77 | rc78 |
|---|---|---|
| plant id | `seed:paubrasilia_echinata` | `seed:biancaea_sappan` |
| name | Сапаново дърво / Brazilwood | Сапаново дърво (източно бразилско дърво) / Sappanwood (Eastern Brazilwood) |
| botanical | Biancaea sappan (syn. Caesalpinia sappan) | unchanged |
| photograph | sappanwood (J.M.Garg, GFDL) under the old path | the same photograph under `biancaea_sappan.jpg`; the old file stays for kept records |
| heartwood chemistry | tannin: high | tannin: **level unknown** (`levelUnknown`, the existing marking); plant `confidence.chemistry` = `unverified` |
| combination id | `…paubrasilia_echinata_heartwood_alum_potassium_immersion` | `…biancaea_sappan_heartwood_alum_potassium_immersion`, confidence `literature` → `unverified`, with a note that the source says “brazilwood” without naming the species |

The rc77 record already described sappanwood in every text, photograph and name except the English common name and the id; nothing in it was specific to *Paubrasilia echinata* beyond the id and the ambiguous source of the combination.

**Compatibility, no silent reclassification.** No user record is rewritten. The old seeded records go through the withdrawal path (§13eo): an installed copy keeps them while her trials, batches, recipes or combinations point at them, and is offered their removal when nothing does. Archives from rc77 restore with the old records and gain the new one. The rc77 records are kept whole in `archive/withdrawn/rc77-paubrasilia_echinata.json`, which is also the fixture of `scripts/try-plant-id-change.mjs`.

**Limitation.** The vocabulary has no class for brazilin (a homoisoflavonoid); `flavonoid` was not added by analogy. Brazilin and brazilein stay in the plant's prose, where the source is.

## 3. `madder-lake-hot`

- Chalk is described as stirred into water — a suspension — not „dissolved": calcium carbonate is practically insoluble in water (PubChem CID 10112).
- The alum is „a solution" whose concentration the recipe does not give; the chalk suspension's amounts are not given either.
- The recipe now opens its notes with: **incomplete — the quantities cannot be reproduced exactly.** No volume was converted to a mass.
- **Proposed:** withdraw it from the pack until the source (Joanne Green, *Natural Watercolor Paint Making*) is checked. Not done (DECISIONS §26).

## 4. Titanium oxalate

„Never above 70 °C" became a conservative limit, not a chemical boundary. Maiwa describes cooking the fibre with titanium oxalate at 75–90 °C (maiwa.com, Titanium Oxalate). `maxTempC` stays 70.
**Found:** the record's `standardPercentWof` is 2; Maiwa gives 8–10% WOF and Wild Colours 5–15 g per 100 g of fibre (wildcolours.co.uk, Titanium). Not changed (DECISIONS §27).

## 5. Watercolour binder

Removed: clove oil as „the only thing that actually preserves", „without it the binder and every paint will spoil", and „lasts about two months". Now: clove oil has antifungal and antibacterial activity and in practice reduces the risk of mould, without guaranteeing that nothing spoils; no storage life has been tested — discard at mould, a change of smell or texture.

## Sources

| source | supports |
|---|---|
| Dapson R.W., Bain C.L. 2015, *Brazilwood, sappanwood, brazilin and the red dye brazilein*, Biotech Histochem 90(6):401–23, doi 10.3109/10520295.2015.1021381 (via Wikipedia, *Brazilin*) | brazilin comes from both *Paubrasilia echinata* and *Biancaea sappan* |
| Wikipedia, *Paubrasilia*, with IUCN and Kew references | „brazilwood" is used for both species; *P. echinata* is endangered |
| PubChem, *Calcium carbonate*, CID 10112 | practically insoluble in water |
| Maiwa, *Titanium oxalate* | 8–10% WOF; 75–90 °C |
| Wild Colours, *Titanium oxalate* | 5–15 g per 100 g fibre as a post-mordant |
| Rodabaugh K. 2017, *Slow Fashion Citizen: India Flint* | India Flint is best known for creating the ecoprint technique — supports the source note flagged at rc72 |

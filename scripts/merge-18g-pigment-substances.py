"""Item 18g (§13dw): the seven substances the pigment recipes name in prose.

Gum arabic, gum tragacanth, methylcellulose, kaolin, glycerine, honey, clove
oil. (Item 18g says „six, not seven" after subtracting chalk from a list that
never held it — the arithmetic is wrong, the list is seven.)

Schema, checked rather than remembered: three fields are required — code,
category, name. `typicalUse` is on 8 records of 26, `safetyNote` on 3. Empty
safety fields are the normal state here, not a gap.

Fills only. A code already in the pack is held and printed. Idempotent.

Run from the repository root:  python3 scripts/merge-18g-pigment-substances.py
"""
import json, sys

PATH = 'seed/substances.json'

# category: `binder` and `filler` are the two categories rc47 added (§13dn).
# Glycerine, honey and clove oil earn no category of their own — they neither
# bind nor fill; they improve how the paint handles and keeps, which is what
# `auxiliary` already holds (vocab.js, the note above material_category).
#
# `typicalUse` is where the source is named, in words. The substance schema has
# NO source field — see §13dw; this is the reading the register cannot hold yet.
NEW = [
 {"code": "gum_arabic", "category": "binder",
  "name": {"bg": "Гума арабика", "en": "Gum arabic"},
  "typicalUse": {
   "bg": "Основното свързващо за акварел. На прах, не разтвор — прахът се разтваря напълно, а повече прах сгъстява боята. Стопка го посочва като най-разпространеното свързващо.",
   "en": "The main binder for watercolour. Powdered, not liquid — the powder dissolves completely, and more powder thickens the paint. Stopka gives it as the commonest binder."}},
 {"code": "gum_tragacanth", "category": "binder",
  "name": {"bg": "Гум трагакант", "en": "Gum tragacanth"},
  "typicalUse": {
   "bg": "Свързващо за пастели, в слаб разтвор. Стопка го нарича по-традиционното свързващо и сама го заменя с овесена вода.",
   "en": "A binder for pastels, in a weak solution. Stopka calls it the more traditional binder and replaces it herself with oat water."}},
 {"code": "methylcellulose", "category": "binder",
  "name": {"bg": "Метилцелулоза", "en": "Methylcellulose"},
  "typicalUse": {
   "bg": "Свързващо за пастели — заместител на гум трагаканта. От рецептата за пастели на Crafty Place.",
   "en": "A binder for pastels, the alternative to gum tragacanth. From the Crafty Place pastel recipe."}},
 {"code": "kaolin", "category": "filler",
  "name": {"bg": "Каолин", "en": "Kaolin"},
  "typicalUse": {
   "bg": "Пълнител за пастели, редом с кредата. Повече пълнител — по-мек и по-блед пастел. От рецептата за пастели на Crafty Place.",
   "en": "A filler for pastels, alongside chalk. More filler, a softer and paler pastel. From the Crafty Place pastel recipe."}},
 {"code": "glycerine", "category": "auxiliary",
  "name": {"bg": "Глицерин", "en": "Glycerine"},
  "typicalUse": {
   "bg": "Омекотител в акварелното свързващо — държи блокчето да не изсъхне на камък. От рецептата на Crafty Place и §13dn; Стопка не го използва.",
   "en": "A plasticiser in the watercolour binder, keeping the cake from drying hard. From the Crafty Place recipe and §13dn; Stopka does not use it."}},
 {"code": "honey", "category": "auxiliary",
  "name": {"bg": "Мед", "en": "Honey"},
  "typicalUse": {
   "bg": "Задържа влага в акварелното свързващо: привлича влага, за да се намокря боята отново. Стопка, със същите думи. Непастьоризиран.",
   "en": "A humectant in the watercolour binder: it attracts moisture so the paint rewets. Stopka, in those words. Unpasteurized."}},
 {"code": "clove_oil", "category": "auxiliary",
  "name": {"bg": "Карамфилово масло", "en": "Clove oil"},
  "typicalUse": {
   "bg": "Консервант в акварелното свързващо — няколко капки. Не се пропуска: свързващото е захар и вода и мухлясва. Стопка.",
   "en": "A preservative in the watercolour binder, a few drops. Not optional: the binder is sugar and water and it moulds. Stopka."}},
]

# NOT WRITTEN, and this is a decision rather than an omission: a `safetyNote`
# for clove oil as a skin sensitiser, and `handling` for kaolin dust. Both are
# true and neither is on a page in hand. They go in when a source in the
# owner's books says so, with the citation.

raw = open(PATH, encoding='utf8').read()
pack = json.loads(raw)
have = {s['code'] for s in pack['substances']}
allowed = {'binder', 'filler', 'auxiliary', 'mordant', 'tannin', 'modifier'}
added = held = 0
for rec in NEW:
    if rec['category'] not in allowed:
        sys.exit(f"{rec['code']}: category {rec['category']} is not in the vocabulary — stop.")
    if rec['code'] in have:
        print(f"held  {rec['code']} already in the pack")
        held += 1
        continue
    pack['substances'].append(rec)
    print(f"add   {rec['code']} ({rec['category']})")
    added += 1

if added:
    open(PATH, 'w', encoding='utf8').write(json.dumps(pack, ensure_ascii=False, indent=1) + '\n')
print(f'{added} added, {held} held.')

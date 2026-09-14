"""§13dy: the pastel binder becomes a recipe of its own, in variants, and the
pastel recipe names it instead of naming a substance.

The owner, 11 September 2026, reading Stopka: the pastel is two operations.
First a binder SOLUTION — hers is 7.5 g of oats in 240 ml of water — and then
3.5 ml of that solution dripped onto about two spoons of pigment. The
tragacanth and methylcellulose solutions are variants of the same thing, which
is why they are options on one line rather than three recipes.

What this writes:
  - `pastel-binder-oat`, Stopka's, with her two figures and a real ratio;
  - `pastel-binder-gum`, tragacanth OR methylcellulose, Crafty Place, figures
    NOT invented — see below;
  - the pastel's binder line points at both recipes;
  - the pastel's own figures: 3.5 ml of solution, absolute.

WHAT IS NOT WRITTEN, and why:
  - a weight in grams for „two spoons of pigment". A spoon is a volume of
    powder and a madder lake and an ochre do not weigh the same. So the pastel
    stays absolute: 3.5 ml to about two spoons, as the book says, and it does
    not scale.
  - quantities for the tragacanth and methylcellulose solution. „A weak
    solution" is what the recipe says and it is all it says.

Run from the repository root:  python3 scripts/merge-18j-pastel-binders.py
"""
import json, sys

PATH = 'seed/recipes.json'
raw = open(PATH, encoding='utf8').read()
pack = json.loads(raw)
by_code = {r['code']: r for r in pack['recipes']}

NEW = [
 {"code": "pastel-binder-oat", "type": "paste", "output": "none", "scaleBy": "raw",
  "sourceCode": "natalie-stopka-pigment",
  "name": {"bg": "Свързващ разтвор за пастели — овес", "en": "Pastel binder — oat water"},
  "notes": {"bg": "Разтворът на Стопка за пастели, вместо гум трагакант. Прави се предварително и се използва студен.",
            "en": "Stopka's pastel binder in place of gum tragacanth. Made in advance and used cold."},
  "ingredients": [
   {"id": "pbo-1", "roleCode": "binder", "basis": "ratio_to_dyestuff", "quantity": 1, "unit": "g",
    "note": {"bg": "Овесени ядки. При Стопка 7.5 г на 240 мл вода.",
             "en": "Oat groats. Stopka gives 7.5 g to 240 ml of water."},
    "options": [{"id": "pbo-o1", "substanceId": "seed:oats"}]},
   {"id": "pbo-2", "roleCode": "solvent", "basis": "ratio_to_dyestuff", "quantity": 32, "unit": "ml",
    "note": {"bg": "Вода, 240 мл на 7.5 г овес.", "en": "Water, 240 ml to 7.5 g of oats."}},
  ],
  "steps": [
   {"id": "pbo-s1", "text": {"bg": "Накисни овесените ядки във водата и остави да стоят, докато водата стане хлъзгава.",
                             "en": "Soak the oats in the water and leave until the water turns slippery."}},
   {"id": "pbo-s2", "text": {"bg": "Прецеди. Ядките се изхвърлят, разтворът се пази.",
                             "en": "Strain. The groats are discarded, the liquid is kept."}},
   {"id": "pbo-s3", "text": {"bg": "Използвай студен. Не се пази дълго — прави се за деня.",
                             "en": "Use cold. It does not keep — make it for the day."}},
  ]},
 {"code": "pastel-binder-gum", "type": "paste", "output": "none", "scaleBy": "raw",
  "sourceCode": "crafty-place-practice",
  "name": {"bg": "Свързващ разтвор за пастели — гума", "en": "Pastel binder — gum solution"},
  "notes": {"bg": "Слаб разтвор на гум трагакант или метилцелулоза. Количествата не са записани — рецептата казва „слаб разтвор“ и толкова.",
            "en": "A weak solution of gum tragacanth or methylcellulose. No quantities are recorded — the recipe says „a weak solution“ and no more."},
  "ingredients": [
   {"id": "pbg-1", "roleCode": "binder", "basis": "absolute", "quantity": None, "unit": "g",
    "note": {"bg": "Гум трагакант или метилцелулоза, в слаб разтвор.",
             "en": "Gum tragacanth or methylcellulose, in a weak solution."},
    "options": [{"id": "pbg-o1", "substanceId": "seed:gum_tragacanth"},
                {"id": "pbg-o2", "substanceId": "seed:methylcellulose"}]},
   {"id": "pbg-2", "roleCode": "solvent", "basis": "absolute", "quantity": None, "unit": "ml",
    "note": {"bg": "Вода.", "en": "Water."}},
  ],
  "steps": [
   {"id": "pbg-s1", "text": {"bg": "Разбъркай гумата във вода до слаб, леко плъзгав разтвор без бучки.",
                             "en": "Stir the gum into water to a weak, slightly slippery solution without lumps."}},
  ]},
]

added = held = 0
for rec in NEW:
    if rec['code'] in by_code:
        print(f"held  {rec['code']} already in the pack")
        held += 1
        continue
    pack['recipes'].append(rec)
    print(f"add   {rec['code']}")
    added += 1

# The pastel's binder line: it is filled by a recipe, in two variants.
past = by_code['pastels-from-pigment']
line = past['ingredients'][2]
if line['roleCode'] != 'binder':
    sys.exit('pastels-from-pigment#2 is not the binder line — stop.')
if any(o.get('recipeId') for o in line.get('options') or []):
    print('held  pastels-from-pigment#2 already names a recipe')
else:
    line['basis'] = 'absolute'
    line['quantity'] = 3.5
    line['unit'] = 'ml'
    line['note'] = {
      "bg": "Свързващ разтвор, накапван малко по малко. При Стопка 3.5 мл на около две лъжици пигмент.",
      "en": "Binder solution, dripped in a little at a time. Stopka gives 3.5 ml to about two spoons of pigment."}
    line['options'] = [{"id": "past-b-oat", "recipeId": "seed:pastel-binder-oat"},
                       {"id": "past-b-gum", "recipeId": "seed:pastel-binder-gum"}]
    print('link  pastels-from-pigment#2 (binder) → the two binder recipes')
    added += 1

# The watercolour's binder line names gum arabic, and that was wrong: the line
# is the SOLUTION the binder recipe makes, not the powder in it (rc56, §13dw).
wc = by_code['watercolour-from-pigment']
wline = wc['ingredients'][1]
if wline['roleCode'] != 'binder':
    sys.exit('watercolour-from-pigment#1 is not the binder line — stop.')
if any(o.get('recipeId') for o in wline.get('options') or []):
    print('held  watercolour-from-pigment#1 already names a recipe')
else:
    wline['options'] = [{"id": "wc-b-recipe", "recipeId": "seed:watercolour-binder"}]
    print('link  watercolour-from-pigment#1 (binder) → seed:watercolour-binder (was: gum arabic)')
    added += 1

if added:
    open(PATH, 'w', encoding='utf8').write(json.dumps(pack, ensure_ascii=False, indent=1) + '\n')
print(f'{added} written, {held} held.')

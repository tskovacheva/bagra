"""Item 18g (§13dw), second half: the recipe lines that named their substance
in prose now point at the records added by merge-18g-pigment-substances.py.

Fills only; idempotent; stops if a line's role is not the expected one.

Two lines get TWO options, because the recipe genuinely offers a choice —
chalk or kaolin as pastel filler, tragacanth or methylcellulose as pastel
binder. Neither carries a quantity: the figures are on the line, and for the
pastels there are none at all (the note says the ratio is deliberately left to
the maker).

NOT linked, and each for its own reason:
  - the two `pigment` lines: the pigment comes out of a batch, not the library;
  - the water and the sauerkraut juice: not substances (§13dv).

Run from the repository root:  python3 scripts/merge-18g-recipe-links.py
"""
import json, sys

PATH = 'seed/recipes.json'
LINKS = {
 ('watercolour-from-pigment', 1, 'binder'):       [('opt-wc-binder-solution', 'seed:gum_arabic')],
 ('pastels-from-pigment',     1, 'filler'):       [('opt-past-chalk',  'seed:calcium_carbonate'),
                                                   ('opt-past-kaolin', 'seed:kaolin')],
 ('pastels-from-pigment',     2, 'binder'):       [('opt-past-tragacanth', 'seed:gum_tragacanth'),
                                                   ('opt-past-methylcell', 'seed:methylcellulose')],
 ('watercolour-binder',       0, 'binder'):       [('opt-binder-gum',      'seed:gum_arabic')],
 ('watercolour-binder',       2, 'humectant'):    [('opt-binder-glycerine','seed:glycerine')],
 ('watercolour-binder',       3, 'humectant'):    [('opt-binder-honey',    'seed:honey')],
 ('watercolour-binder',       4, 'preservative'): [('opt-binder-clove',    'seed:clove_oil')],
}

raw = open(PATH, encoding='utf8').read()
pack = json.loads(raw)
by_code = {r['code']: r for r in pack['recipes']}
done = held = 0
for (code, i, role), opts in LINKS.items():
    line = by_code[code]['ingredients'][i]
    if line['roleCode'] != role:
        sys.exit(f'{code}#{i} is {line["roleCode"]}, expected {role} — the recipe has changed; stop.')
    existing = line.get('options') or []
    if any(o.get('substanceId') or o.get('plantId') for o in existing):
        print(f'held  {code}#{i} ({role}) already names something')
        held += 1
        continue
    line['options'] = [{'id': oid, 'substanceId': sid} for oid, sid in opts]
    print(f'link  {code}#{i} ({role}) → {", ".join(s for _, s in opts)}')
    done += 1

if done:
    open(PATH, 'w', encoding='utf8').write(json.dumps(pack, ensure_ascii=False, indent=1) + '\n')
print(f'{done} linked, {held} held.')

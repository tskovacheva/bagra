"""Item 18f (§13dv): point the carrier and alkali lines of the three pigment
recipes at the substances the library already has.

Written at rc50 with the substance in a prose note and no `substanceId`, so the
work view showed the ROLE — the same thing it shows for a missing substance.

Fills only: a line that already names something is left alone and printed.
Idempotent: a second run changes nothing. The notes are NOT touched — they
carry what the link cannot: Stopka accepts aluminium sulphate as well, and
Green's figures are per jar, of a dissolved solution.

Deliberately NOT added: an aluminium sulphate option on the Stopka line. The
library has four hydrates, they differ in aluminium by weight, and the book
does not say which. Choosing one would be inventing a figure. The note keeps
the alternative in words.

Run from the repository root:  python3 scripts/merge-18f-substance-links.py
"""
import json, sys

PATH = 'seed/recipes.json'
LINKS = {
    # (recipe code, line index, role)            option id           substance
    ('pigment-lake-master',      1, 'carrier'): ('opt-lake-alum',  'seed:alum_potassium_12'),
    ('pigment-lake-master',      2, 'alkali'):  ('opt-lake-soda',  'seed:soda_ash'),
    ('madder-lake-hot',          2, 'carrier'): ('opt-hot-alum',   'seed:alum_potassium_12'),
    ('madder-lake-hot',          3, 'alkali'):  ('opt-hot-chalk',  'seed:calcium_carbonate'),
    ('madder-lake-fermentation', 1, 'carrier'): ('opt-ferm-alum',  'seed:alum_potassium_12'),
    ('madder-lake-fermentation', 2, 'alkali'):  ('opt-ferm-soda',  'seed:soda_ash'),
}

raw = open(PATH, encoding='utf8').read()
pack = json.loads(raw)
by_code = {r['code']: r for r in pack['recipes']}
done = held = 0
for (code, i, role), (opt_id, sub) in LINKS.items():
    line = by_code[code]['ingredients'][i]
    if line['roleCode'] != role:
        sys.exit(f'{code}#{i} is {line["roleCode"]}, expected {role} — the recipe has changed; stop.')
    opts = line.get('options') or []
    if any(o.get('substanceId') or o.get('plantId') for o in opts):
        print(f'held  {code}#{i} ({role}) already names {[o.get("substanceId") or o.get("plantId") for o in opts]}')
        held += 1
        continue
    # No qty on the option: `quantityRange` falls back to the line's own
    # `quantity`, which is where the figure has always been.
    line['options'] = [{'id': opt_id, 'substanceId': sub}]
    print(f'link  {code}#{i} ({role}) → {sub}')
    done += 1

if done:
    open(PATH, 'w', encoding='utf8').write(json.dumps(pack, ensure_ascii=False, indent=1) + '\n')
print(f'{done} linked, {held} held.')

#!/usr/bin/env python3
"""Put the owner's chosen plant photographs into the seed pack, with attribution.

Rerunnable: it takes whatever files are present and leaves the rest alone, so
the remaining batches can be added by running it again.

Matching is by the number prefix of the filename against the row number in the
workbook, then from the workbook's botanical name to the plant. The number is
the owner's own ordering and is the only thing both sides agree on; matching on
names alone would have to guess at "Crataegus" against "Crataegus monogyna".

Size: these are photographs of a plant for recognition, not for printing. The
whole pack travels inside the application and is cached for offline use, so
each is reduced to a long side of 560px. A 6.9MB original would otherwise cost
more than the entire rest of the library.
"""
import base64, io, json, os, re, sys, unicodedata
import openpyxl
from PIL import Image

UPLOADS = '/mnt/user-data/uploads'
BOOK = os.path.join(UPLOADS, 'bagra_plant_photos_48.xlsx')
SEED = 'seed/plants.json'
LONG_SIDE = 560
QUALITY = 72


def one(v):
    """Botanical names are plain strings in the pack and pairs elsewhere."""
    if isinstance(v, dict):
        return v.get('bg') or v.get('en') or ''
    return v or ''


def norm(s):
    s = unicodedata.normalize('NFKD', (s or '').lower())
    return re.sub(r'[^a-zа-я]+', ' ', s).strip()


# --- the workbook, by row number -------------------------------------------
sheet = openpyxl.load_workbook(BOOK)['Bagra photos']
head = [c.value for c in sheet[1]]
rows = {}
for r in sheet.iter_rows(min_row=2, values_only=True):
    rec = dict(zip(head, r))
    try:
        rows[int(rec['№'])] = rec
    except (TypeError, ValueError):
        continue

# --- the files, by the same number -----------------------------------------
files = {}
for name in sorted(os.listdir(UPLOADS)):
    m = re.match(r'^(\d{2})_(.+)\.(jpe?g|png|JPG|JPEG|PNG)$', name)
    if m:
        files[int(m.group(1))] = os.path.join(UPLOADS, name)

pack = json.load(open(SEED, encoding='utf-8'))
plants = pack['plants']
by_botanical = {}
for p in plants:
    bot = norm(one(p.get('nameBotanical')))
    if bot:
        by_botanical.setdefault(bot, p)
by_common = {norm(one(p.get('nameCommon'))): p for p in plants}


def find_plant(rec):
    bot = norm(rec.get('Ботанически запис'))
    if bot in by_botanical:
        return by_botanical[bot]
    # A genus record against a species photograph, or the reverse. Only when
    # the genus is unambiguous among the seeded plants.
    genus = bot.split(' ')[0] if bot else ''
    if genus:
        hits = [p for k, p in by_botanical.items() if k.split(' ')[0] == genus]
        if len(hits) == 1:
            return hits[0]
    return by_common.get(norm(rec.get('Растение (BG)')))


def shrink(path):
    img = Image.open(path)
    img = img.convert('RGB')
    w, h = img.size
    scale = LONG_SIDE / max(w, h)
    if scale < 1:
        img = img.resize((round(w * scale), round(h * scale)), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, 'JPEG', quality=QUALITY, optimize=True, progressive=True)
    return 'data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode()


added, skipped, unmatched, held = 0, 0, [], []
for n, path in sorted(files.items()):
    rec = rows.get(n)
    if not rec:
        unmatched.append(f'{n}: no row {n} in the workbook')
        continue
    plant = find_plant(rec)
    if not plant:
        unmatched.append(f"{n}: {rec.get('Растение (BG)')} / {rec.get('Ботанически запис')} — no such plant")
        continue
    if plant.get('photoData'):
        skipped += 1
        continue

    # A photograph whose author is unknown does not travel.
    #
    # Six of the forty-eight are marked in the workbook's own "verify before
    # release" sheet, and one of those is CC BY-SA — a licence that requires
    # the author to be named wherever the image appears. Shipping it without
    # the name is not an oversight to fix later; it is the breach itself, in
    # an application meant to be given away. Only the licences that ask for
    # nothing may go unattributed.
    author = (rec.get('Автор') or '').strip()
    licence = (rec.get('Лиценз') or '').strip()
    if not author and licence.lower().replace(' ', '') not in ('cc0', 'publicdomain'):
        held.append(f"{n}: {rec.get('Растение (BG)')} — {licence or 'no licence recorded'}, no author")
        continue
    plant['photoData'] = shrink(path)
    # Attribution travels with the photograph, always. Several of these are
    # CC BY-SA, which requires the author to be named wherever the image is
    # shown, and this application is meant to be given away (§13at).
    plant['photoCredit'] = {
        'author': (rec.get('Автор') or '').strip(),
        'licence': (rec.get('Лиценз') or '').strip(),
        'source': (rec.get('Източник') or '').strip(),
        'taxon': (rec.get('Таксон на снимката') or '').strip(),
        'note': (rec.get('Бележка / attribution') or '').strip() or None,
    }
    added += 1

if held:
    print('HELD BACK, attribution incomplete:')
    for h in held:
        print(' ', h)

if unmatched:
    print('UNMATCHED:')
    for u in unmatched:
        print(' ', u)

json.dump(pack, open(SEED, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
open(SEED, 'a', encoding='utf-8').write('\n')

with_photo = sum(1 for p in plants if p.get('photoData'))
no_author = [p['code'] for p in plants
             if p.get('photoData') and not (p.get('photoCredit') or {}).get('author')
             and (p.get('photoCredit') or {}).get('licence', '').lower().replace(' ', '')
             not in ('cc0', 'publicdomain')]
print(f'added {added}, already had {skipped}, now {with_photo} of {len(plants)} plants have a photograph')
print('seed/plants.json:', round(os.path.getsize(SEED) / 1e6, 2), 'MB')
if no_author:
    print('NO AUTHOR NAMED:', ', '.join(no_author))
    sys.exit(1)

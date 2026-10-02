#!/usr/bin/env python3
"""Add or replace ONE plant's shipped photograph, in the current model (§13fz).

The import scripts of §13at and §13ay wrote photographs as data URLs into the
record; since §13bw a shipped photograph is a file in seed/images/plants/, named
by the record's photoSrc, with its hash in seed/plant-photos.json (SHA-256 of the
file as a JPEG data URL — what migrate-photos.js compares). This does that for
one plant, with the import scripts' own size and quality, and an optional crop.

A crop is an adaptation. It is refused for a licence that does not allow one
(ND), and it is recorded: `modified` becomes 'cropped-resized', which the plant
screen shows as „Изрязано и преоразмерено за Багра".

  python3 scripts/add-plant-photo.py CODE FILE --author A --licence 'CC BY-SA 3.0' \\
      --source URL [--crop x0,y0,x1,y1] [--note TEXT] [--apply]
"""
import argparse, base64, hashlib, io, json, re, sys
from PIL import Image

LONG_SIDE, QUALITY = 560, 72            # the import scripts' figures, unchanged

def deed(lic):
    if lic == 'CC0': return 'https://creativecommons.org/publicdomain/zero/1.0/'
    if lic == 'Public Domain': return 'https://creativecommons.org/publicdomain/mark/1.0/'
    m = re.fullmatch(r'CC (BY(?:-SA|-ND)?) (\d\.\d)( US)?', lic)
    if not m: sys.exit('licence not recognised: ' + lic)
    return f'https://creativecommons.org/licenses/{m[1].lower()}/{m[2]}/' + ('us/' if m[3] else '')

ap = argparse.ArgumentParser()
for a in ('code', 'file'): ap.add_argument(a)
ap.add_argument('--author', required=True); ap.add_argument('--licence', required=True)
ap.add_argument('--source', required=True); ap.add_argument('--crop'); ap.add_argument('--note')
ap.add_argument('--preview'); ap.add_argument('--apply', action='store_true')
a = ap.parse_args()
if a.crop and '-ND' in a.licence: sys.exit('refused: a crop is an adaptation, and ' + a.licence + ' allows none')

img = Image.open(a.file)
if img.mode not in ('RGB', 'L'): img = img.convert('RGB')
if a.crop:
    box = tuple(int(v) for v in a.crop.split(','))
    img = img.crop(box)
w, h = img.size
if max(w, h) > LONG_SIDE:
    s = LONG_SIDE / max(w, h)
    img = img.resize((round(w * s), round(h * s)), Image.LANCZOS)
buf = io.BytesIO(); img.save(buf, 'JPEG', quality=QUALITY, optimize=True, progressive=True)
data = buf.getvalue()
digest = hashlib.sha256(('data:image/jpeg;base64,' + base64.b64encode(data).decode()).encode()).hexdigest()
print(f'{a.code}: {img.size[0]}x{img.size[1]}, {len(data)} bytes, hash {digest[:16]}…')
if a.preview: open(a.preview, 'wb').write(data)
if not a.apply: sys.exit(0)

src = f'seed/images/plants/{a.code}.jpg'
open(src, 'wb').write(data)
pack = json.load(open('seed/plants.json', encoding='utf8'))
p = next(x for x in pack['plants'] if x['code'] == a.code)
p['photoSrc'], p['photoHash'] = src, digest
p['photoCredit'] = {k: v for k, v in {
    'author': a.author, 'licence': a.licence, 'source': a.source, 'taxon': p.get('nameBotanical'),
    'note': a.note, 'licenceUrl': deed(a.licence),
    'modified': 'cropped-resized' if a.crop else 'resized'}.items() if v}
open('seed/plants.json', 'w', encoding='utf8').write(json.dumps(pack, ensure_ascii=False, indent=1) + '\n')
pp = json.load(open('seed/plant-photos.json', encoding='utf8'))
pp['photos']['seed:' + a.code] = {'hash': digest, 'src': src}
open('seed/plant-photos.json', 'w', encoding='utf8').write(json.dumps(pp, ensure_ascii=False, indent=1) + '\n')
print('written:', src, '— now add it to sw.js FILES and bump the plants pack')

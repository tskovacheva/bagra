#!/usr/bin/env python3
"""Put photographs into the seed pack, matched by the audit workbook (§13ay).

The earlier script matched a numbered filename against a numbered row. This
batch arrives named after the file on Wikimedia instead, and the workbook names
the file it expects in the „Снимка (файл)" column — so that column is the match,
not a number both sides had to agree on.

Rerunnable: it takes whatever files are present and leaves the rest alone.
A plant already carrying a photograph is not overwritten; pass --replace to
change one deliberately.

Size: the same 560px long side and quality 72 as the first batch. These are
photographs for recognising a plant, not for printing, and the whole pack
travels inside the application and is cached for offline use.
"""
import argparse
import base64
import io
import json
import os
import re
import sys

import openpyxl
from PIL import Image

UPLOADS = '/mnt/user-data/uploads'
SEED = 'seed/plants.json'
LONG_SIDE = 560
QUALITY = 72


def norm(s):
    return re.sub(r'[^a-z0-9]+', '', str(s or '').lower())


def shrink(path):
    img = Image.open(path)
    if img.mode not in ('RGB', 'L'):
        img = img.convert('RGB')
    w, h = img.size
    if max(w, h) > LONG_SIDE:
        scale = LONG_SIDE / max(w, h)
        img = img.resize((round(w * scale), round(h * scale)), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, 'JPEG', quality=QUALITY, optimize=True, progressive=True)
    return 'data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode(), img.size


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('workbook')
    ap.add_argument('--apply', action='store_true')
    ap.add_argument('--replace', action='store_true',
                    help='overwrite a photograph a plant already has')
    ap.add_argument('--skip', default='',
                    help='comma-separated plant codes to leave alone')
    args = ap.parse_args()

    skip = {s.strip() for s in args.skip.split(',') if s.strip()}

    sheet = openpyxl.load_workbook(args.workbook)['Растения']
    head = [c.value for c in sheet[1]]
    rows = [dict(zip(head, r)) for r in sheet.iter_rows(min_row=2, values_only=True)]

    # The files actually on disk, keyed loosely: the workbook may say
    # `Frangula_alnus.jpg` while the file arrived as
    # `Rosales_-_Frangula_alnus_-_3.jpg`. A name that contains the other's stem
    # is the same photograph.
    on_disk = {}
    for name in sorted(os.listdir(UPLOADS)):
        if re.search(r'\.(jpe?g|png)$', name, re.I):
            on_disk[norm(name)] = os.path.join(UPLOADS, name)

    def find_file(wanted):
        key = norm(wanted)
        if not key:
            return None
        if key in on_disk:
            return on_disk[key]
        stem = norm(os.path.splitext(str(wanted))[0])
        for k, path in on_disk.items():
            if stem and (stem in k or k in stem):
                return path
        return None

    pack = json.load(open(SEED, encoding='utf-8'))
    by_bot = {norm(p.get('nameBotanical')): p for p in pack['plants']}
    by_common = {norm((p.get('nameCommon') or {}).get('bg')): p for p in pack['plants']}

    added, missing, held = [], [], []

    for row in rows:
        wanted = row.get('Снимка (файл)')
        if not wanted:
            continue
        plant = by_bot.get(norm(row['Ботанически'])) or by_common.get(norm(row['Растение']))
        if not plant:
            held.append(f"{row['Растение']}: no such plant in the pack")
            continue
        code = plant['code']
        if code in skip:
            held.append(f'{code}: skipped by request')
            continue
        if plant.get('photoData') and not args.replace:
            continue

        path = find_file(wanted)
        if not path:
            missing.append(f'{code}: {wanted}')
            continue

        author = str(row.get('Автор') or '').strip()
        licence = str(row.get('Лиценз') or '').strip()
        if not author or not licence:
            held.append(f'{code}: has a file but no author or licence — not imported')
            continue

        data, size = shrink(path)
        added.append((code, os.path.basename(path), size, len(data) // 1024, author, licence))
        if args.apply:
            plant['photoData'] = data
            credit = plant.get('photoCredit') or {}
            plant['photoCredit'] = {**credit, 'author': author, 'licence': licence,
                                    'source': str(row.get('Източник') or '').strip() or credit.get('source', ''),
                                    'taxon': plant.get('nameBotanical')}

    print(f'photographs to add: {len(added)}')
    for code, name, size, kb, author, licence in added:
        print(f'  {code:<24} {name[:34]:<34} {size[0]}x{size[1]}  {kb}KB  {author} · {licence}')
    if missing:
        print(f'\nnamed in the workbook, not on disk: {len(missing)}')
        for m in missing:
            print(f'  {m}')
    if held:
        print(f'\nheld: {len(held)}')
        for h in held:
            print(f'  {h}')

    if args.apply:
        json.dump(pack, open(SEED, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
        open(SEED, 'a', encoding='utf-8').write('\n')
        with_photo = sum(1 for p in pack['plants'] if p.get('photoData'))
        print(f'\nwritten: {SEED} — {with_photo} of {len(pack["plants"])} carry a photograph')
    else:
        print('\ndry run — pass --apply to write')


if __name__ == '__main__':
    main()

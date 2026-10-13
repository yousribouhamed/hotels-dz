# Writes Resources/reviews/<id>.json (one file per stay) from a Google Maps review collection.
# Each input file holds ONE stay's reviews, read from that stay's own review list and keyed by
# Google's review ID. Reviewer names are never stored.
#
# Usage: python3 scripts/import_reviews.py <collection dir with <id>.json files> [--scraped YYYY-MM-DD]
# Refuses to write if a review ID or a long review text shows up under two different stays.
import datetime as dt, glob, json, os, re, sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'BoumerdesStays', 'Resources')
OUT = os.path.join(ROOT, 'reviews')
UNITS = {'minute': 0, 'heure': 0, 'jour': 1, 'semaine': 7, 'mois': 30, 'an': 365}


def to_date(when, scraped):
    """'il y a 3 mois' / 'Modifié il y a une semaine' → approximate ISO date counted back from the scrape day."""
    w = when.replace('\xa0', ' ').lower()
    m = re.search(r'(un|une|\d+)\s+(minute|heure|jour|semaine|mois|an)', w)
    if not m:
        return scraped.isoformat()
    n = 1 if m.group(1) in ('un', 'une') else int(m.group(1))
    return (scraped - dt.timedelta(days=n * UNITS[m.group(2)])).isoformat()


def main():
    src = sys.argv[1]
    scraped = dt.date.fromisoformat(sys.argv[sys.argv.index('--scraped') + 1]) if '--scraped' in sys.argv else dt.date.today()
    hotels = {h['id'] for h in json.load(open(os.path.join(ROOT, 'hotels.json')))}
    owner_of_rid, owner_of_text, problems, files = {}, {}, [], {}
    for f in sorted(glob.glob(os.path.join(src, '*.json'))):
        r = json.load(open(f))
        sid = int(r['id'])
        if sid not in hotels or not r.get('ok') or r.get('err'):
            continue
        out = []
        for x in r['reviews']:
            if x['rid'] in owner_of_rid and owner_of_rid[x['rid']] != sid:
                problems.append(f"review {x['rid'][:12]} under {owner_of_rid[x['rid']]} and {sid}")
            owner_of_rid[x['rid']] = sid
            t = x['t'].strip()
            # Google shows a stray " …" after reviews that end in an emoji or symbol, even when nothing is cut.
            t = re.sub(r'(?<=[^\w\s])\s+…$', '', t)
            if len(t) >= 80:
                if t in owner_of_text and owner_of_text[t] != sid:
                    problems.append(f"same text under {owner_of_text[t]} and {sid}: {t[:50]!r}")
                owner_of_text[t] = sid
            out.append({'s': x['s'], 't': t[:3000], 'd': to_date(x.get('when', ''), scraped)})
        if out:
            files[sid] = out
    if problems:
        print('NOT WRITTEN — reviews appear under two stays:', *problems[:20], sep='\n  ')
        sys.exit(1)
    os.makedirs(OUT, exist_ok=True)
    for sid, out in files.items():
        with open(os.path.join(OUT, f'{sid}.json'), 'w') as fh:
            json.dump(out, fh, ensure_ascii=False, separators=(',', ':'))
    # Files for stays that are no longer in the app are removed.
    stale = [f for f in glob.glob(os.path.join(OUT, '*.json')) if int(os.path.basename(f)[:-5]) not in hotels]
    for f in stale:
        os.remove(f)
    print(f'{len(files)} stays, {sum(len(v) for v in files.values())} reviews written to Resources/reviews/'
          + (f'; {len(stale)} files of removed stays deleted' if stale else ''))


if __name__ == '__main__':
    main()

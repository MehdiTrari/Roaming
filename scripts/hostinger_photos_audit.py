"""Compare read-only SQL exports before/after the approved photo synchronization."""
import csv
import hashlib
import io
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent.parent
AUDIT = ROOT / 'var/backups/hostinger-photos-20261024'


def tables(filename):
    text = filename.read_text(encoding='utf8')
    result = {}
    for name, columns, values in re.findall(r'INSERT INTO `([^`]+)` \((.*?)\) VALUES\s*(.*?);\s*\n', text, re.S):
        names = re.findall(r'`([^`]+)`', columns)
        rows = result.setdefault(name, [])
        for row in values.strip().splitlines():
            if not row.startswith('('): raise ValueError('Unsupported SQL export row layout')
            cells = next(csv.reader(io.StringIO(row.rstrip(',')[1:-1]), quotechar="'", escapechar='\\', skipinitialspace=True))
            if len(cells) != len(names): raise ValueError('Unexpected SQL column count')
            rows.append(dict(zip(names, cells)))
    return result


def main():
    before = tables(AUDIT / 'database-before-photos.sql')
    after = tables(AUDIT / 'database-after-photos.sql')
    changed_ids = {'4': 2474, '6': 2467, '7': 2630}
    preserved = lambda data: [row for row in data['property_image'] if row['property_id'] not in changed_ids]
    assert preserved(before) == preserved(after), 'Lambersart and archived photo rows changed'
    report = {'preservedImageRows': len(preserved(before)), 'lambersartImagesUnchanged': True, 'galleries': []}
    for local_id, provider_id in changed_ids.items():
        rows = sorted([row for row in after['property_image'] if row['property_id'] == local_id], key=lambda r: int(r['position']))
        expected = json.loads((ROOT / f'var/guestlucky/photo-discovery/gallery-{provider_id}.json').read_text())['photos']
        assert [row['filename'] for row in rows] == expected
        assert [int(row['position']) for row in rows] == list(range(len(rows)))
        assert [int(row['is_cover']) for row in rows] == [1] + [0] * (len(rows) - 1)
        report['galleries'].append({'providerId': provider_id, 'count': len(rows), 'orderedAndCoverVerified': True})
    for name in sorted(before):
        if name == 'property_image': continue
        old, new = before[name], after[name]
        if name == 'property':
            for rows in [old, new]:
                for row in rows:
                    if row['id'] in changed_ids: row.pop('updated_at')
        assert old == new, 'Unexpected business data change in ' + name
    report['otherBusinessDataUnchanged'] = True
    report['totalImageRows'] = len(after['property_image'])
    report['backupBeforeSha256'] = hashlib.sha256((AUDIT / 'database-before-photos.sql').read_bytes()).hexdigest()
    report['backupAfterSha256'] = hashlib.sha256((AUDIT / 'database-after-photos.sql').read_bytes()).hexdigest()
    (AUDIT / 'DATABASE-PHOTOS-VERIFIED.json').write_text(json.dumps(report, indent=2))
    print(json.dumps(report))


if __name__ == '__main__': main()

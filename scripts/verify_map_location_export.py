"""Verify only Lille coordinates changed between private phpMyAdmin exports."""
import hashlib
import json
from pathlib import Path
import re
import sys

SLUG = 'la-petite-cour-calme-charme-au-coeur-de-lille-2650'
ROOT = Path(__file__).resolve().parent.parent
AUDIT = ROOT / 'var/backups/hostinger-map-lille-20261028'


def read_rows(filename):
    sql = filename.read_text(encoding='utf-8-sig')
    rows = {}
    for match in re.finditer(r'^INSERT INTO `([^`]+)`\s*\(([^)]+)\) VALUES\s*', sql, re.M):
        table, columns = match[1], re.findall(r'`([^`]+)`', match[2])
        position = match.end()
        while sql[position] == '(':
            position += 1
            values, start, quoted = [], position, False
            while True:
                char = sql[position]
                if char == '\\' and quoted:
                    position += 2
                    continue
                if char == "'":
                    if quoted and sql[position:position+2] == "''":
                        position += 2
                        continue
                    quoted = not quoted
                elif not quoted and char in ',)':
                    values.append(sql[start:position].strip())
                    start = position + 1
                    if char == ')':
                        position += 1
                        break
                position += 1
            if len(columns) != len(values):
                raise ValueError('SQL row length mismatch')
            rows.setdefault(table, []).append(dict(zip(columns, values)))
            while sql[position].isspace(): position += 1
            if sql[position] != ',': break
            position += 1
            while sql[position].isspace(): position += 1
    return rows


def target(rows):
    matches = [row for row in rows['property'] if row.get('guest_lucky_id') == '2650' and row['slug'] == repr(SLUG)]
    if len(matches) != 1: raise ValueError('Expected exactly one Lille property')
    row = matches[0]
    if row['address'] != "'144 Rue de Wazemmes 59000 Lille'" or row['city'] != "'Lille'" or row['active'] != '1':
        raise ValueError('Lille identity/address mismatch')
    return row


before = read_rows(AUDIT / 'database-before.sql')
row = target(before)
if row['latitude'] != 'NULL' or row['longitude'] != 'NULL':
    raise ValueError('Coordinates already populated; inspect before changing')
if len(sys.argv) > 1 and sys.argv[1] == 'after':
    after = read_rows(AUDIT / 'database-after.sql')
    updated = target(after)
    if float(updated['latitude']) != 50.623037 or float(updated['longitude']) != 3.056473:
        raise ValueError('Unexpected saved coordinates')
    updated['latitude'] = updated['longitude'] = 'NULL'
    normalize = lambda tables: {table: sorted(json.dumps(row, sort_keys=True) for row in data) for table, data in tables.items()}
    if normalize(before) != normalize(after):
        raise ValueError('Other database data changed; inspect private exports')
    print(json.dumps({'verified': True, 'onlyChangedColumns': ['property.latitude', 'property.longitude'], 'providerId': 2650, 'tablesCompared': len(before)}))
else:
    print(json.dumps({'beforeVerified': True, 'providerId': 2650, 'latitude': None, 'longitude': None, 'properties': len(before['property']), 'tables': len(before), 'backupSHA256': hashlib.sha256((AUDIT / 'database-before.sql').read_bytes()).hexdigest()}))

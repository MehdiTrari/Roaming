"""Stage/snapshot/apply the cookie banner through FTPS, keeping maintenance and old assets."""
import argparse
import ftplib
import getpass
import json
from pathlib import Path, PurePosixPath
import time
from hostinger_ftps_deploy import Connection, ROOT, upload, digest, make_directory
from hostinger_team_access import probe
from hostinger_photos_deploy import GUARDS

SOURCES = ['templates/legal/_cookie_dialog.html.twig', 'translations/legal.fr.yaml', 'translations/legal.en.yaml', 'assets/privacy.js', 'assets/styles/legal.css']


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['snapshot', 'apply'])
    action = parser.parse_args().action
    workspace = Path(__file__).resolve().parent.parent
    audit = workspace / 'var/backups/hostinger-cookies-20261024'
    stage = workspace / 'var/deployment/cookie-banner-20261024'
    audit.mkdir(parents=True, exist_ok=True)
    connection = Connection(getpass.getpass('FTPS password (not saved): '))
    try:
        if action == 'snapshot':
            if (audit / 'PATCH-PLAN.json').exists(): raise ValueError('Rollback snapshot already exists')
            # New hashed public assets go first. Symfony's private metadata switches last.
            mapping = [(path, 'public_html/build/' + path.relative_to(workspace / 'public/build').as_posix())
                       for path in sorted((workspace / 'public/build').rglob('*')) if path.is_file()]
            mapping += [(workspace / path, 'smogii/' + path) for path in SOURCES]
            mapping += [(workspace / 'public/build' / path, 'smogii/public/build/' + path) for path in ['manifest.json', 'entrypoints.json']]
            plan = {'domain': 'roaminglille.com', 'account': 'u587053106', 'time': time.time(), 'guards': {}, 'files': []}
            for name in GUARDS:
                data = connection.read(ROOT + '/' + name)
                saved = audit / 'files' / name; saved.parent.mkdir(parents=True, exist_ok=True); saved.write_bytes(data)
                plan['guards'][name] = digest(data)
            for source, destination in mapping:
                if source.suffix.lower() in ['.php', '.sql'] and destination.startswith('public_html/'): raise ValueError('Sensitive public file forbidden')
                try:
                    before = connection.read(ROOT + '/' + destination)
                    saved = audit / 'files' / destination; saved.parent.mkdir(parents=True, exist_ok=True); saved.write_bytes(before)
                except ftplib.error_perm as error:
                    if not str(error).startswith('550'): raise
                    before = None
                data = source.read_bytes()
                staged = stage / destination; staged.parent.mkdir(parents=True, exist_ok=True); staged.write_bytes(data)
                plan['files'].append({'path': destination, 'before': digest(before) if before is not None else None, 'after': digest(data)})
            (audit / 'PATCH-PLAN.json').write_text(json.dumps(plan, indent=2))
            print(json.dumps({'snapshot': 'PASS', 'files': len(mapping), 'changed': sum(row['before'] != row['after'] for row in plan['files']), 'remoteWrites': False}), flush=True)
            return
        plan = json.loads((audit / 'PATCH-PLAN.json').read_text())
        if time.time() - plan['time'] > 3600: raise ValueError('Expired preflight')
        for name, expected in plan['guards'].items():
            if digest(connection.read(ROOT + '/' + name)) != expected: raise ValueError('Configuration/maintenance changed since snapshot')
        status, body, _ = probe('/')
        if status != 200 or b'team-maintenance' not in body: raise ValueError('Public maintenance required')
        for row in plan['files']:
            data = (stage / row['path']).read_bytes()
            if digest(data) != row['after']: raise ValueError('Staged source changed')
            try: old = connection.read(ROOT + '/' + row['path'])
            except ftplib.error_perm as error:
                if not str(error).startswith('550'): raise
                old = None
            if (digest(old) if old is not None else None) not in [row['before'], row['after']]: raise ValueError('Unexpected production source change')
        journal = {'uploaded': [], 'oldAssetsPreserved': True, 'noDatabaseOrConfigurationWrite': True}
        for row in plan['files']:
            if row['before'] == row['after']: continue
            destination = ROOT + '/' + row['path']
            make_directory(connection, str(PurePosixPath(destination).parent))
            upload(connection, destination, (stage / row['path']).read_bytes())
            journal['uploaded'].append(row['path'])
            (audit / 'PATCH-APPLIED.json').write_text(json.dumps(journal, indent=2))
        old_cache = ROOT + '/smogii/var/cache/prod-before-cookies-20261024'
        connection.call(lambda ftp: ftp.rename(ROOT + '/smogii/var/cache/prod', old_cache))
        journal['previousCache'] = old_cache
        for name, expected in plan['guards'].items():
            if digest(connection.read(ROOT + '/' + name)) != expected: raise ValueError('Configuration/maintenance guard changed')
        status, body, _ = probe('/')
        if status != 200 or b'team-maintenance' not in body: raise ValueError('Public maintenance verification failed')
        journal['publicMaintenanceVerified'] = True
        (audit / 'PATCH-APPLIED.json').write_text(json.dumps(journal, indent=2))
        print(json.dumps({'deployment': 'PASS', 'uploads': len(journal['uploaded']), 'maintenanceActive': True, 'oldAssetsPreserved': True, 'databaseUnchanged': True}), flush=True)
    finally:
        connection.close()


if __name__ == '__main__': main()

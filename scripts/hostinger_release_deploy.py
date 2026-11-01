"""Stage and deploy the October 28 release without changing secrets or the database.

stage is entirely local. deploy prompts privately for FTPS, snapshots every replaced
file, checks maintenance, enables the existing upload shield during writes, and
keeps rollback files and old assets. No FTP password is saved.
"""
import argparse
import ftplib
import getpass
import io
import json
from pathlib import Path, PurePosixPath
import subprocess
from datetime import datetime, timezone
from hostinger_ftps_deploy import Connection, ROOT, digest, make_directory
from hostinger_team_access import probe
from hostinger_photos_deploy import GUARDS

WORKSPACE = Path(__file__).resolve().parent.parent
STAGE = WORKSPACE / 'var/deployment/release-20261028'


def allowed(path):
    parts = PurePosixPath(path).parts
    if any(part in ('..', '.') or part.startswith('.env') for part in parts):
        return False
    if path in ('public_html/.htaccess', 'public_html/robots.txt'):
        return True
    if path.startswith('public_html/build/'):
        return PurePosixPath(path).suffix.lower() in ('.js', '.css', '.json', '.woff', '.woff2', '.ttf', '.svg', '.png', '.jpg', '.webp', '.txt')
    if path.startswith('smogii/public/build/'):
        return parts[-1] in ('manifest.json', 'entrypoints.json')
    return len(parts) > 2 and parts[0] == 'smogii' and parts[1] in ('src', 'config', 'templates', 'translations', 'assets') and 'secrets' not in parts


def stage():
    names = subprocess.check_output(['git', 'ls-files', '--cached', '--others', '--exclude-standard', '-z'], cwd=WORKSPACE).decode().split('\0')
    mapping = [(WORKSPACE / name, 'smogii/' + name) for name in sorted(set(names))
               if name and name.split('/')[0] in ('src', 'config', 'templates', 'translations', 'assets')]
    mapping += [(p, 'public_html/build/' + p.relative_to(WORKSPACE / 'public/build').as_posix())
                for p in sorted((WORKSPACE / 'public/build').rglob('*')) if p.is_file()]
    mapping += [(WORKSPACE / 'public' / name, 'public_html/' + name) for name in ('.htaccess', 'robots.txt')]
    mapping += [(WORKSPACE / 'public/build' / name, 'smogii/public/build/' + name) for name in ('manifest.json', 'entrypoints.json')]
    rows = []
    for source, target in mapping:
        if not allowed(target):
            raise ValueError('Unreviewed destination: ' + target)
        data = source.read_bytes()
        destination = STAGE / 'files' / target
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(data)
        rows.append({'path': target, 'sha256': digest(data), 'bytes': len(data)})
    plan = {'domain': 'roaminglille.com', 'created': datetime.now(timezone.utc).isoformat(),
            'reviewsVisible': False, 'databaseWrites': False, 'environmentWrites': False, 'files': rows}
    (STAGE / 'manifest.json').write_text(json.dumps(plan, indent=2), encoding='utf-8')
    print(json.dumps({'staged': len(rows), 'bytes': sum(row['bytes'] for row in rows), 'remoteWrites': False}))


def optional_read(connection, name):
    try:
        return connection.read(ROOT + '/' + name)
    except ftplib.error_perm as error:
        if not str(error).startswith('550'):
            raise
        # Distinguish missing files from inaccessible existing files/directories.
        parent, leaf = name.rsplit('/', 1)
        entries = list_optional_directory(connection, parent)
        if any(filename == leaf for filename, _ in entries):
            raise ValueError('Existing remote target cannot be read: ' + name) from error
        return None


def list_optional_directory(connection, name):
    try:
        return connection.call(lambda ftp: list(ftp.mlsd(ROOT + '/' + name)))
    except ftplib.error_perm as error:
        if not str(error).startswith('550') or '/' not in name:
            raise
        parent, leaf = name.rsplit('/', 1)
        if any(filename == leaf for filename, _ in list_optional_directory(connection, parent)):
            raise ValueError('Existing remote directory cannot be listed: ' + name) from error
        return []


def write_atomic(connection, name, data, tag):
    if not allowed(name):
        raise ValueError('Forbidden destination: ' + name)
    target = ROOT + '/' + name
    make_directory(connection, str(PurePosixPath(target).parent))
    temporary = target + '.upload-' + tag
    connection.call(lambda ftp: ftp.storbinary('STOR ' + temporary, io.BytesIO(data), blocksize=262144))
    if digest(connection.read(temporary)) != digest(data):
        raise ValueError('Transfer checksum mismatch: ' + name)
    try:
        connection.call(lambda ftp: ftp.rename(temporary, target))
    except (OSError, EOFError, ftplib.error_perm):
        if digest(connection.read(target)) != digest(data):
            raise


def deploy():
    plan = json.loads((STAGE / 'manifest.json').read_text(encoding='utf-8'))
    for row in plan['files']:
        if not allowed(row['path']) or digest((STAGE / 'files' / row['path']).read_bytes()) != row['sha256']:
            raise ValueError('Staged file changed or unsafe')
    tag = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    audit = WORKSPACE / 'var/backups' / ('hostinger-release-' + tag)
    audit.mkdir(parents=True, exist_ok=False)
    connection = Connection(getpass.getpass('Mot de passe FTPS Hostinger (saisie masquee, non enregistre) : '))
    journal = {'domain': plan['domain'], 'uploaded': [], 'databaseWrites': False, 'environmentWrites': False}
    try:
        status, body, _ = probe('/')
        if status != 200 or b'team-maintenance' not in body:
            raise ValueError('Expected application maintenance is not active')
        guards = {name: digest(connection.read(ROOT + '/' + name)) for name in GUARDS}
        shield = 'public_html/.maintenance'
        archived = 'public_html/.maintenance-upload-complete-20261024'
        if optional_read(connection, shield) is not None:
            raise ValueError('Upload shield already active; inspect before deploying')
        rows = []
        for index, row in enumerate(plan['files']):
            before = optional_read(connection, row['path'])
            before_hash = digest(before) if before is not None else None
            if before_hash == row['sha256']:
                continue
            if before is not None:
                saved = audit / 'files' / row['path']
                saved.parent.mkdir(parents=True, exist_ok=True)
                saved.write_bytes(before)
            rows.append({**row, 'before': before_hash})
            if index % 25 == 0:
                print('Sauvegarde et comparaison :', index + 1, '/', len(plan['files']), flush=True)
        (audit / 'snapshot.json').write_text(json.dumps({'guards': guards, 'files': rows}, indent=2))
        for name, expected in guards.items():
            if digest(connection.read(ROOT + '/' + name)) != expected:
                raise ValueError('Production configuration changed during snapshot')
        # This pre-existing static shield protects visitors and team from partial writes.
        connection.call(lambda ftp: ftp.rename(ROOT + '/' + archived, ROOT + '/' + shield))
        journal['uploadShieldActive'] = True
        (audit / 'journal.json').write_text(json.dumps(journal, indent=2))
        # Hashed assets first, then application sources; manifests and rewrites last.
        rows.sort(key=lambda row: (2 if row['path'].endswith(('manifest.json', 'entrypoints.json', '.htaccess')) else 0 if row['path'].startswith('public_html/build/') else 1, row['path']))
        for row in rows:
            before = optional_read(connection, row['path'])
            if (digest(before) if before is not None else None) != row['before']:
                raise ValueError('Unexpected production change: ' + row['path'])
            write_atomic(connection, row['path'], (STAGE / 'files' / row['path']).read_bytes(), tag)
            journal['uploaded'].append(row['path'])
            (audit / 'journal.json').write_text(json.dumps(journal, indent=2))
        cache = ROOT + '/smogii/var/cache/prod'
        try:
            connection.call(lambda ftp: ftp.cwd(cache))
        except ftplib.error_perm:
            raise ValueError('Cannot inspect production cache; shield retained')
        connection.call(lambda ftp: ftp.rename(cache, cache + '-before-release-' + tag))
        journal['previousCache'] = cache + '-before-release-' + tag
        for name, expected in guards.items():
            if name in (archived, 'public_html/.htaccess'):
                continue
            if digest(connection.read(ROOT + '/' + name)) != expected:
                raise ValueError('Protected configuration changed; shield retained')
        for row in rows:
            if digest(connection.read(ROOT + '/' + row['path'])) != row['sha256']:
                raise ValueError('Post-transfer checksum mismatch; shield retained')
        connection.call(lambda ftp: ftp.rename(ROOT + '/' + shield, ROOT + '/' + archived))
        journal['uploadShieldActive'] = False
        status, body, _ = probe('/')
        if status != 200 or b'team-maintenance' not in body:
            connection.call(lambda ftp: ftp.rename(ROOT + '/' + archived, ROOT + '/' + shield))
            journal['uploadShieldActive'] = True
            raise ValueError('Application health check failed; static shield restored')
        journal['maintenanceVerified'] = True
        journal['status'] = 'deployed-awaiting-authenticated-verification'
        print(json.dumps({'uploaded': len(rows), 'maintenanceVerified': True, 'audit': str(audit)}))
    finally:
        (audit / 'journal.json').write_text(json.dumps(journal, indent=2))
        connection.close()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=('stage', 'deploy'))
    {'stage': stage, 'deploy': deploy}[parser.parse_args().action]()

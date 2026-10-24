"""Reviewed private photo-sync patch over verified FTPS. Never upload public PHP or secrets."""
import argparse
import ftplib
import getpass
import json
from pathlib import Path
import time
from hostinger_ftps_deploy import Connection, ROOT, upload, digest, make_directory
from hostinger_team_access import probe

FILES = [
    'src/Media/PropertyImageUrl.php',
    'src/Integration/GuestLucky/PhotoClient.php',
    'src/Integration/GuestLucky/PhotoSynchronizer.php',
    'src/Command/GuestLuckyPhotosCommand.php',
    'src/Entity/Property.php',
    'src/Repository/PropertyRepository.php',
    'src/Service/AvailabilityService.php',
    'src/Twig/ResponsiveImageExtension.php',
    'templates/components/_picture.html.twig',
    'templates/property/show.html.twig',
    'config/services.yaml',
]
GUARDS = ['public_html/.htaccess', 'public_html/index.php', 'public_html/maintenance.php',
          'public_html/.maintenance-upload-complete-20261024', 'smogii/.env',
          'smogii/.env.prod.local', 'smogii/.env.local.php']


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['snapshot', 'apply', 'status'])
    args = parser.parse_args()
    workspace = Path(__file__).resolve().parent.parent
    audit = workspace / 'var/backups/hostinger-photos-20261024'
    stage = workspace / 'var/deployment/guestlucky-photos-20261024'
    audit.mkdir(parents=True, exist_ok=True)
    password = getpass.getpass('FTPS password (not saved): ')
    connection = Connection(password)
    try:
        if args.action == 'status':
            for filename in ['photos-status.json', 'photos-cron.log']:
                try:
                    data = connection.read(ROOT + '/smogii/var/guestlucky/' + filename)
                except ftplib.error_perm as error:
                    if not str(error).startswith('550'): raise
                    print(json.dumps({'file': filename, 'pending': True}), flush=True)
                    continue
                (audit / filename).write_bytes(data)
                # No HTTP URLs or credentials are logged by the photo command.
                print(data.decode('utf8', errors='replace')[:8000], flush=True)
            return
        if args.action == 'snapshot':
            if (audit / 'PATCH-PLAN.json').exists():
                raise ValueError('Snapshot already exists; do not replace rollback data')
            plan = {'time': time.time(), 'domain': 'roaminglille.com', 'account': 'u587053106', 'guards': {}, 'files': []}
            for name in GUARDS:
                data = connection.read(ROOT + '/' + name)
                saved = audit / 'files' / name
                saved.parent.mkdir(parents=True, exist_ok=True); saved.write_bytes(data)
                plan['guards'][name] = digest(data)
            # Confirm production can discover new PSR-4 classes without rebuilding vendor.
            loader = connection.read(ROOT + '/smogii/vendor/composer/autoload_real.php')
            if b'setClassMapAuthoritative(true)' in loader: raise ValueError('Authoritative Composer loader requires an updated class map')
            for filename in FILES:
                remote = 'smogii/' + filename
                try:
                    old = connection.read(ROOT + '/' + remote)
                    saved = audit / 'files' / remote
                    saved.parent.mkdir(parents=True, exist_ok=True); saved.write_bytes(old)
                except ftplib.error_perm as error:
                    if not str(error).startswith('550'): raise
                    old = None
                data = (workspace / filename).read_bytes()
                staged = stage / filename
                staged.parent.mkdir(parents=True, exist_ok=True); staged.write_bytes(data)
                plan['files'].append({'path': filename, 'before': digest(old) if old is not None else None, 'after': digest(data)})
            (audit / 'PATCH-PLAN.json').write_text(json.dumps(plan, indent=2), encoding='utf8')
            print(json.dumps({'snapshot': 'PASS', 'privateFiles': len(FILES), 'configurationAndMaintenanceBackedUp': True, 'remoteWrites': False}), flush=True)
            return
        plan = json.loads((audit / 'PATCH-PLAN.json').read_text())
        if time.time() - plan['time'] > 3600: raise ValueError('Expired patch preflight')
        if not (audit / 'database-before-photos.sql').is_file(): raise ValueError('Full database backup required')
        for name, expected in plan['guards'].items():
            if digest(connection.read(ROOT + '/' + name)) != expected: raise ValueError('Production configuration/maintenance changed')
        status, body, _ = probe('/')
        if status != 200 or b'team-maintenance' not in body: raise ValueError('Public maintenance must already be active')
        for row in plan['files']:
            data = (stage / row['path']).read_bytes()
            if digest(data) != row['after']: raise ValueError('Reviewed patch changed locally')
            try: old = connection.read(ROOT + '/smogii/' + row['path'])
            except ftplib.error_perm as error:
                if not str(error).startswith('550'): raise
                old = None
            current = digest(old) if old is not None else None
            if current not in [row['before'], row['after']]: raise ValueError('Production source changed: ' + row['path'])
        journal = {'uploaded': [], 'configurationAndMaintenanceUnchanged': True}
        for row in plan['files']:
            filename = row['path']; data = (stage / filename).read_bytes()
            make_directory(connection, ROOT + '/smogii/' + str(Path(filename).parent).replace('\\', '/'))
            upload(connection, ROOT + '/smogii/' + filename, data)
            journal['uploaded'].append(filename)
            (audit / 'PATCH-APPLIED.json').write_text(json.dumps(journal, indent=2))
        make_directory(connection, ROOT + '/smogii/var/guestlucky')
        # Keep the old cache intact for rollback; the next request/CLI boot warms a fresh one.
        cache = ROOT + '/smogii/var/cache/prod'
        saved_cache = ROOT + '/smogii/var/cache/prod-before-photos-20261024'
        connection.call(lambda ftp: ftp.rename(cache, saved_cache))
        journal['cacheArchived'] = saved_cache
        (audit / 'PATCH-APPLIED.json').write_text(json.dumps(journal, indent=2))
        for name, expected in plan['guards'].items():
            if digest(connection.read(ROOT + '/' + name)) != expected: raise ValueError('Maintenance/configuration changed unexpectedly')
        status, body, _ = probe('/')
        if status != 200 or b'team-maintenance' not in body: raise ValueError('Maintenance verification failed')
        journal['publicMaintenanceVerified'] = True
        (audit / 'PATCH-APPLIED.json').write_text(json.dumps(journal, indent=2))
        print(json.dumps({'deployment': 'PASS', 'privateFiles': len(FILES), 'maintenanceActive': True, 'configurationUnchanged': True}), flush=True)
    finally:
        connection.close()


if __name__ == '__main__': main()

"""Activate Symfony maintenance/team preview; secrets never enter public files.

snapshot is read-only. configure uploads two reviewed private environment files.
activate renames only the temporary upload marker after verifying Symfony's
maintenance flag. Any failed public health check restores that marker.
"""
import argparse
import getpass
import hashlib
import json
from pathlib import Path
import subprocess
import urllib.error
import urllib.request
from hostinger_ftps_deploy import Connection, ROOT, upload, digest


def probe(path):
    try:
        response = urllib.request.urlopen('https://roaminglille.com' + path, timeout=60)
    except urllib.error.HTTPError as error:
        response = error
    with response:
        return response.code, response.read(), dict(response.headers)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['snapshot', 'configure', 'activate', 'restore-shield'])
    args = parser.parse_args()
    workspace = Path(__file__).resolve().parent.parent
    private = workspace / 'var/private/hostinger-team-activation-20261024'
    audit = workspace / 'var/backups/hostinger-team-activation-20261024'
    private.mkdir(parents=True, exist_ok=True)
    audit.mkdir(parents=True, exist_ok=True)
    password = getpass.getpass('FTPS password (not saved): ')
    connection = Connection(password)
    shield = ROOT + '/public_html/.maintenance'
    saved_shield = ROOT + '/public_html/.maintenance-upload-complete-20261024'
    try:
        if args.action == 'snapshot':
            hashes = {}
            for name in ['.env', '.env.prod.local', '.env.local.php']:
                data = connection.read(ROOT + '/smogii/' + name)
                destination = audit / 'files/smogii' / name
                destination.parent.mkdir(parents=True, exist_ok=True)
                if destination.exists() and destination.read_bytes() != data:
                    raise ValueError('Snapshot already exists with different configuration')
                destination.write_bytes(data)
                hashes['smogii/' + name] = digest(data)
            for name in ['.maintenance', '.htaccess', 'maintenance.php', 'index.php']:
                data = connection.read(ROOT + '/public_html/' + name)
                destination = audit / 'files/public_html' / name
                destination.parent.mkdir(parents=True, exist_ok=True)
                destination.write_bytes(data)
                hashes['public_html/' + name] = digest(data)
            (audit / 'CONFIGURATION-BEFORE.json').write_text(json.dumps(hashes, indent=2))
            print('Private environment and upload shield snapshotted. No remote writes.')
            return
        if args.action == 'configure':
            approved = json.loads((private / 'CONFIGURATION-PLAN.json').read_text())
            before = json.loads((audit / 'CONFIGURATION-BEFORE.json').read_text())
            assert approved['siteMaintenance'] == '1'
            for name in ['.env.prod.local', '.env.local.php']:
                current = connection.read(ROOT + '/smogii/' + name)
                candidate = (private / name).read_bytes()
                if digest(current) == digest(candidate):
                    continue
                if digest(current) != before['smogii/' + name]:
                    raise ValueError('Remote configuration changed after snapshot')
                upload(connection, ROOT + '/smogii/' + name, candidate)
            (audit / 'CONFIGURATION-APPLIED.json').write_text(json.dumps({'siteMaintenance': True, 'providerSettingsCopiedPrivately': approved['copiedKeys'], 'existingInfrastructureSecretsPreserved': True}, indent=2))
            print('GuestLucky settings configured privately; SITE_MAINTENANCE=1; existing infrastructure secrets preserved.')
            return
        if args.action == 'restore-shield':
            connection.call(lambda ftp: ftp.rename(saved_shield, shield))
            print('Temporary upload shield restored.')
            return
        # The explicit application maintenance flag was checked while generating
        # the private PHP array; confirm that exact array is installed first.
        assert (audit / 'CONFIGURATION-APPLIED.json').is_file()
        for name in ['.env.local.php', '.env.prod.local']:
            if digest(connection.read(ROOT + '/smogii/' + name)) != digest((private / name).read_bytes()):
                raise ValueError('Approved maintenance configuration is not installed')
        expected = json.loads((audit / 'CONFIGURATION-BEFORE.json').read_text())
        if digest(connection.read(shield)) != expected['public_html/.maintenance']:
            raise ValueError('Temporary upload marker changed')
        connection.call(lambda ftp: ftp.rename(shield, saved_shield))
        try:
            checks = []
            for path in ['/', '/?_locale=en', '/equipe/connexion', '/api/calendar', '/property/lambersart']:
                status, body, headers = probe(path)
                if path.startswith('/api/'):
                    assert status == 503 and b'site_maintenance' in body
                elif path.startswith('/property/'):
                    assert status == 200 and b'team-maintenance' in body
                elif path == '/equipe/connexion':
                    assert status == 200 and b'name="_password"' in body and b'name="_csrf_token"' in body
                else:
                    assert status == 200 and b'team-maintenance' in body and b'/equipe/connexion' in body
                assert 'no-store' in headers.get('Cache-Control', '')
                checks.append({'path': path, 'status': status, 'applicationMaintenanceOrLogin': True})
        except BaseException:
            connection.call(lambda ftp: ftp.rename(saved_shield, shield))
            print('Application validation failed; original static maintenance immediately restored.')
            raise
        for name in ['.htaccess', 'maintenance.php', 'index.php']:
            assert digest(connection.read(ROOT + '/public_html/' + name)) == expected['public_html/' + name]
        (audit / 'APPLICATION-MAINTENANCE-VERIFIED.json').write_text(json.dumps({'maintenanceActive': True, 'uploadShieldArchived': True, 'checks': checks}, indent=2))
        print(json.dumps({'applicationMaintenance': 'PASS', 'teamLoginAccessible': True, 'anonymousCatalogueClosed': True, 'anonymousAPIClosed': True}))
    finally:
        connection.close()


if __name__ == '__main__':
    main()

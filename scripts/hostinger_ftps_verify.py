"""Read-only final verification of the approved FTPS deployment."""
from concurrent.futures import ThreadPoolExecutor
import getpass
import hashlib
import json
from pathlib import Path
import threading
from hostinger_ftps_deploy import Connection, ROOT, PUBLIC_GUARD, digest

workspace = Path(__file__).resolve().parent.parent
release = workspace / 'var/deployment/roaminglille-20261023'
audit = workspace / 'var/backups/hostinger-predeploy-20261024'
preflight = json.loads((audit / 'FTPS-PREFLIGHT.json').read_text())
journal = json.loads((audit / 'FTPS-DEPLOYMENT.json').read_text())
assert journal['complete']
password = getpass.getpass('FTPS password (not saved): ')
connections = []
thread = threading.local()
lock = threading.Lock()

def verify(row):
    if not hasattr(thread, 'connection'):
        thread.connection = Connection(password)
        with lock:
            connections.append(thread.connection)
    if digest(thread.connection.read(ROOT + '/' + row['path'])) != row['sha256']:
        raise ValueError('Final file checksum mismatch: ' + row['path'])

try:
    with ThreadPoolExecutor(max_workers=3) as pool:
        list(pool.map(verify, preflight['changedUploads']))
finally:
    for connection in connections:
        connection.close()

connection = Connection(password)
try:
    for name in PUBLIC_GUARD:
        assert digest(connection.read(ROOT + '/' + name)) == preflight['guards'][name], name
    private = workspace / 'var/private/hostinger-deployment-20261023'
    for name, local in [('smogii/.env.local.php', private / '.env.local.php'), ('smogii/.env.prod.local', private / '.env.prod.local.proposed')]:
        assert digest(connection.read(ROOT + '/' + name)) == digest(local.read_bytes())
    baseline = json.loads((workspace / 'var/backups/hostinger-predeploy-20261023/manifest.json').read_text())['files']
    env = next(row for row in baseline if row['path'] == ROOT + '/smogii/.env')
    assert digest(connection.read(ROOT + '/smogii/.env')) == env['sha256']
    installed = json.loads(connection.read(ROOT + '/smogii/vendor/composer/installed.json'))
    assert installed['dev'] is False
    directories = [name for name, facts in connection.call(lambda ftp: list(ftp.mlsd(ROOT + '/smogii/var/cache'))) if facts.get('type') == 'dir']
    assert 'prod' in directories and 'prod-before-20261024' in directories
    report = {'verifiedFinalSHA256Files': len(preflight['changedUploads']),
        'unchangedFilesVerifiedAgainstBackupAtPreflight': preflight['unchangedFiles'],
        'maintenanceAndBootstrapByteIdentical': True,
        'privateConfigurationMatchesApprovedCandidate': True,
        'baseEnvironmentUnchanged': True,
        'productionComposerPackages': len(installed['packages']),
        'developmentPackagesLoaded': False,
        'cacheRotationVerified': True}
    (audit / 'FTPS-VERIFIED.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps(report), flush=True)
finally:
    connection.close()

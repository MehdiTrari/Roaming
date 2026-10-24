"""Deploy the reviewed ROAMING release through verified FTPS; preserve maintenance.

Credentials are prompted and never written. preflight is read-only. apply only
writes reviewed manifest files, two approved private env files, and private
rollback/cache directories. Existing uploads and maintenance files are forbidden.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import ftplib
import getpass
import hashlib
import io
import json
from pathlib import Path, PurePosixPath
import queue
import socket
import ssl
import threading
import time
from hostinger_ftps import entries, retry

ROOT = '/domains/roaminglille.com'
PUBLIC_GUARD = ['public_html/.maintenance', 'public_html/maintenance.php', 'public_html/.htaccess', 'public_html/index.php']
ENV_FILES = ['smogii/.env', 'smogii/.env.prod.local', 'smogii/.env.local.php']


class Connection:
    def __init__(self, password):
        self.password = password
        self.ftp = None
        self.reconnect()

    def reconnect(self):
        if self.ftp:
            self.ftp.close()
        self.ftp = ftplib.FTP_TLS(context=ssl.create_default_context(), timeout=45)
        self.ftp.connect('ftp.roaminglille.com', 21)
        self.ftp.host = 'hstgr.io'
        self.ftp.auth()
        self.ftp.login('u587053106', self.password)
        self.ftp.prot_p()

    def call(self, operation):
        return retry(lambda: operation(self.ftp), self.reconnect)

    def read(self, path):
        def download(ftp):
            result = io.BytesIO()
            ftp.retrbinary('RETR ' + path, result.write, blocksize=262144)
            return result.getvalue()
        return self.call(download)

    def close(self):
        self.ftp.close()


def inventory(password):
    folders = queue.Queue()
    folders.put(ROOT)
    files = {}
    directories = set()
    errors = []
    lock = threading.Lock()

    def worker():
        connection = Connection(password)
        try:
            while True:
                folder = folders.get()
                if folder is None:
                    folders.task_done()
                    return
                try:
                    if errors:
                        continue
                    for name, facts in connection.call(lambda ftp: entries(ftp, folder)):
                        path = str(PurePosixPath(folder) / name)
                        relative = path.removeprefix(ROOT + '/')
                        if facts.get('type') == 'dir':
                            with lock:
                                directories.add(relative)
                            folders.put(path)
                        elif facts.get('type') == 'file':
                            with lock:
                                files[relative] = {'bytes': int(facts['size']), 'modified': facts.get('modify')}
                        else:
                            raise ValueError('Unreviewed remote entry: ' + relative)
                except Exception as error:
                    with lock:
                        errors.append(error)
                finally:
                    folders.task_done()
        finally:
            connection.close()

    threads = [threading.Thread(target=worker) for _ in range(3)]
    for thread in threads:
        thread.start()
    folders.join()
    for thread in threads:
        folders.put(None)
    for thread in threads:
        thread.join()
    if errors:
        raise errors[0]
    return files, sorted(directories)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def make_directory(connection, path):
    # Each path is constructed under this exact private/public domain root.
    if not path.startswith(ROOT + '/') or '/..' in path or '\\' in path:
        raise ValueError('Unsafe remote directory')
    parts = PurePosixPath(path).parts
    for index in range(len(PurePosixPath(ROOT).parts) + 1, len(parts) + 1):
        folder = str(PurePosixPath(*parts[:index]))
        try:
            connection.call(lambda ftp: ftp.mkd(folder))
        except ftplib.error_perm:
            # Refuse silently continuing after a permission failure on a missing path.
            connection.call(lambda ftp: ftp.cwd(folder))


def upload(connection, path, data):
    if path.startswith(ROOT + '/public_html/'):
        suffix = path.removeprefix(ROOT + '/public_html/')
        if suffix.split('/')[0] not in ['build', 'images', 'fonts', 'styles'] or any(part.startswith('.env') for part in suffix.split('/')) or PurePosixPath(path).suffix.lower() in ['.php', '.sql', '.key', '.pem']:
            raise ValueError('Forbidden public upload: ' + path)
    if any(path == ROOT + '/' + name for name in PUBLIC_GUARD):
        raise ValueError('Maintenance/bootstrap upload forbidden')
    temporary = path + '.roaming-upload-20261024'
    def send(ftp):
        ftp.storbinary('STOR ' + temporary, io.BytesIO(data), blocksize=262144)
    connection.call(send)
    if digest(connection.read(temporary)) != digest(data):
        raise ValueError('Uploaded file checksum mismatch: ' + path)
    try:
        connection.call(lambda ftp: ftp.rename(temporary, path))
    except (OSError, EOFError, ftplib.error_perm):
        # A completed RNTO can lose its response. Never blindly delete its target.
        if digest(connection.read(path)) != digest(data):
            raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['preflight', 'apply'])
    args = parser.parse_args()
    workspace = Path(__file__).resolve().parent.parent
    release = workspace / 'var/deployment/roaminglille-20261023'
    backup = workspace / 'var/backups/hostinger-predeploy-20261023'
    audit = workspace / 'var/backups/hostinger-predeploy-20261024'
    audit.mkdir(parents=True, exist_ok=True)
    baseline = {row['path'].removeprefix(ROOT + '/'): row for row in json.loads((backup / 'manifest.json').read_text())['files']}
    manifest = json.loads((release / 'TRANSFER-MANIFEST.json').read_text())
    for row in manifest:
        local = release / row['path']
        if not local.resolve().is_relative_to(release) or digest(local.read_bytes()) != row['sha256']:
            raise ValueError('Reviewed local file changed: ' + row['path'])
    if '147.93.93.183' not in socket.gethostbyname_ex('ftp.roaminglille.com')[2]:
        raise ValueError('Unexpected FTP server IP')
    password = getpass.getpass('FTPS password (not saved): ')
    connection = Connection(password)
    try:
        guards = {}
        for name in PUBLIC_GUARD:
            guards[name] = digest(connection.read(ROOT + '/' + name))
            if guards[name] != baseline[name]['sha256']:
                raise ValueError('Production maintenance/bootstrap changed: ' + name)
        if args.action == 'preflight':
            for name in ENV_FILES:
                if digest(connection.read(ROOT + '/' + name)) != baseline[name]['sha256']:
                    raise ValueError('Production configuration changed since backup: ' + name)
            current, directories = inventory(password)
            changed = [name for name, row in current.items() if name not in baseline or row['bytes'] != baseline[name]['bytes'] or row['modified'] != baseline[name]['modified']]
            removed = sorted(set(baseline) - set(current))
            if changed or removed:
                (audit / 'preflight-differences.json').write_text(json.dumps({'changed': changed, 'removed': removed}, indent=2))
                raise ValueError('Remote tree changed since full backup; inspect preflight-differences.json before deployment')
            plan = [row for row in manifest if row['path'] not in baseline or row['sha256'] != baseline[row['path']]['sha256']]
            result = {'domain': 'roaminglille.com', 'account': 'u587053106', 'time': time.time(), 'guards': guards, 'remoteFiles': current, 'directories': directories, 'changedUploads': plan, 'unchangedFiles': len(manifest) - len(plan), 'fullBackupStillCurrent': True}
            (audit / 'FTPS-PREFLIGHT.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
            print(json.dumps({'preflight': 'PASS', 'remoteFiles': len(current), 'uploads': len(plan), 'unchanged': result['unchangedFiles'], 'maintenanceUnchanged': True}), flush=True)
            return

        preflight = json.loads((audit / 'FTPS-PREFLIGHT.json').read_text())
        if preflight['domain'] != 'roaminglille.com' or time.time() - preflight['time'] > 3600:
            raise ValueError('Missing or expired preflight')
        journal_path = audit / 'FTPS-DEPLOYMENT.json'
        journal = json.loads(journal_path.read_text()) if journal_path.exists() else {'domain': 'roaminglille.com', 'uploaded': [], 'renamed': [], 'maintenanceUnchanged': True, 'complete': False}
        def checkpoint():
            journal_path.write_text(json.dumps(journal, indent=2), encoding='utf-8')
        directories = set(preflight['directories'])
        for row in preflight['changedUploads']:
            parent = str(PurePosixPath(row['path']).parent)
            if parent not in directories:
                make_directory(connection, ROOT + '/' + parent)
                directories.add(parent)
        done = {row['path']: row for row in journal['uploaded']}
        jobs = [row for row in preflight['changedUploads'] if row['path'] not in done]
        thread = threading.local()
        workers = []
        lock = threading.Lock()
        def transfer(row):
            if not hasattr(thread, 'connection'):
                thread.connection = Connection(password)
                with lock:
                    workers.append(thread.connection)
            upload(thread.connection, ROOT + '/' + row['path'], (release / row['path']).read_bytes())
            return row
        try:
            with ThreadPoolExecutor(max_workers=3) as pool:
                futures = [pool.submit(transfer, row) for row in jobs]
                for future in as_completed(futures):
                    row = future.result()
                    journal['uploaded'].append(row)
                    checkpoint()
                    if len(journal['uploaded']) % 25 == 0:
                        print('Uploaded and SHA-256 verified:', len(journal['uploaded']), '/', len(preflight['changedUploads']), flush=True)
        finally:
            for worker in workers:
                worker.close()
        # Preserve original secrets and append only the reviewed missing defaults.
        private = workspace / 'var/private/hostinger-deployment-20261023'
        for relative, local in [('smogii/.env.local.php', private / '.env.local.php'), ('smogii/.env.prod.local', private / '.env.prod.local.proposed')]:
            data = local.read_bytes()
            if relative not in journal.get('privateConfiguration', []):
                if digest(connection.read(ROOT + '/' + relative)) != baseline[relative]['sha256']:
                    raise ValueError('Private config changed before approved update')
                upload(connection, ROOT + '/' + relative, data)
                journal.setdefault('privateConfiguration', []).append(relative)
                checkpoint()
        # Move unused development packages outside vendor, with recoverable copies.
        old = json.loads((backup / 'files/smogii/vendor/composer/installed.json').read_text())
        new = json.loads((release / 'smogii/vendor/composer/installed.json').read_text())
        unused = sorted({p['name'] for p in old['packages']} - {p['name'] for p in new['packages']})
        moves = [('smogii/vendor/' + name, 'smogii/var/backups/vendor-development-20261024/' + name) for name in unused]
        # Old CLI proxies must not point into the removed development packages.
        for name in preflight['remoteFiles']:
            if name.startswith('smogii/vendor/bin/') and not (release / name).is_file():
                moves.append((name, 'smogii/var/backups/vendor-development-20261024/bin/' + PurePosixPath(name).name))
        if 'smogii/var/cache/prod' in directories:
            moves.append(('smogii/var/cache/prod', 'smogii/var/cache/prod-before-20261024'))
        for source, target in moves:
            if source in journal['renamed']:
                continue
            make_directory(connection, ROOT + '/' + str(PurePosixPath(target).parent))
            connection.call(lambda ftp: ftp.rename(ROOT + '/' + source, ROOT + '/' + target))
            journal['renamed'].append(source)
            checkpoint()
        for directory in ['smogii/var/cache/prod', 'smogii/var/log', 'smogii/var/private/ticket-captures']:
            make_directory(connection, ROOT + '/' + directory)
        for name in PUBLIC_GUARD:
            if digest(connection.read(ROOT + '/' + name)) != guards[name]:
                raise ValueError('Production maintenance changed during deployment')
        journal['complete'] = True
        journal['unusedDevelopmentPackagesArchived'] = unused
        journal['completedAt'] = time.time()
        checkpoint()
        print(json.dumps({'deployment': 'PASS', 'uploadedVerified': len(journal['uploaded']), 'unchangedReviewedFiles': preflight['unchangedFiles'], 'archivedDevelopmentPackages': len(unused), 'maintenanceUnchanged': True}), flush=True)
    finally:
        connection.close()


if __name__ == '__main__':
    main()

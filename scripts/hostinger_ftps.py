#!/usr/bin/env python3
"""Read-only Hostinger FTPS inspection/backup. Passwords are prompted, never saved.

Only explicit TLS with certificate verification and encrypted data is supported.
This program has no upload, deletion or remote-command functionality.
"""
import argparse
import ftplib
import getpass
import hashlib
import json
from pathlib import Path, PurePosixPath
import socket
import ssl
import sys
import time
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed


def entries(ftp, remote):
    result = []
    for name, facts in ftp.mlsd(remote):
        if name in ('.', '..') or facts.get('type') in ('cdir', 'pdir'):
            continue
        if '/' in name or '\\' in name:
            raise ValueError('Unsafe remote filename')
        result.append((name, facts))
    return sorted(result)


def retry(operation, reconnect):
    for attempt in range(4):
        try:
            return operation()
        except (EOFError, OSError, ftplib.error_temp):
            if attempt == 3:
                raise
            print('Reconnecting encrypted FTPS channel...', flush=True)
            time.sleep(1)
            reconnect()


def backup(ftp, remote, local, manifest, completed, reconnect):
    local.mkdir(parents=True, exist_ok=True)
    for name, facts in retry(lambda: entries(ftp, remote), reconnect):
        source = str(PurePosixPath(remote) / name)
        destination = local / name
        kind = facts.get('type', '')
        if kind == 'dir':
            backup(ftp, source, destination, manifest, completed, reconnect)
        elif kind == 'file':
            old = completed.get(source)
            if old and destination.is_file() and old['modified'] == facts.get('modify') and old['bytes'] == int(facts.get('size', -1)) and hashlib.sha256(destination.read_bytes()).hexdigest() == old['sha256']:
                manifest.append(old)
                continue
            def download():
                digest = hashlib.sha256()
                size = 0
                with destination.open('wb') as output:
                    def write(chunk):
                        nonlocal size
                        output.write(chunk)
                        digest.update(chunk)
                        size += len(chunk)
                    ftp.retrbinary('RETR ' + source, write, blocksize=262144)
                return size, digest.hexdigest()
            size, checksum = retry(download, reconnect)
            if facts.get('size') and size != int(facts['size']):
                raise ValueError('Incomplete download: ' + source)
            manifest.append({'path': source, 'bytes': size, 'sha256': checksum, 'modified': facts.get('modify')})
            if len(manifest) % 250 == 0:
                print('Downloaded files:', len(manifest), flush=True)
        else:
            # Never silently claim a complete backup when symlinks were omitted.
            raise ValueError('Unsupported remote entry type: ' + source + ' (' + kind + ')')


def parallel_backup(ftp, remote, local, manifest, completed, reconnect, connect, workers, checkpoint):
    pending = []
    def inventory(folder, destination):
        destination.mkdir(parents=True, exist_ok=True)
        for name, facts in retry(lambda: entries(ftp, folder), reconnect):
            source = str(PurePosixPath(folder) / name)
            target = destination / name
            if facts.get('type') == 'dir':
                inventory(source, target)
            elif facts.get('type') == 'file':
                old = completed.get(source)
                if old and target.is_file() and old['modified'] == facts.get('modify') and old['bytes'] == int(facts.get('size', -1)) and hashlib.sha256(target.read_bytes()).hexdigest() == old['sha256']:
                    manifest.append(old)
                else:
                    pending.append((source, target, facts))
            else:
                raise ValueError('Unsupported remote entry type: ' + source)
    inventory(remote, local)
    print('Inventory complete:', len(manifest), 'verified files;', len(pending), 'remaining.', flush=True)
    checkpoint()
    thread = threading.local()
    connections = []
    lock = threading.Lock()
    def download(job):
        source, target, facts = job
        if not hasattr(thread, 'ftp'):
            thread.ftp = connect()
            with lock:
                connections.append(thread.ftp)
        def reconnect_worker():
            thread.ftp.close()
            thread.ftp = connect()
            with lock:
                connections.append(thread.ftp)
        def transfer():
            digest = hashlib.sha256()
            size = 0
            with target.open('wb') as output:
                def write(chunk):
                    nonlocal size
                    output.write(chunk); digest.update(chunk); size += len(chunk)
                thread.ftp.retrbinary('RETR ' + source, write, blocksize=262144)
            if size != int(facts.get('size', size)):
                raise OSError('Incomplete download: ' + source)
            return {'path': source, 'bytes': size, 'sha256': digest.hexdigest(), 'modified': facts.get('modify')}
        return retry(transfer, reconnect_worker)
    try:
        with ThreadPoolExecutor(max_workers=workers) as pool:
            futures = [pool.submit(download, job) for job in pending]
            for future in as_completed(futures):
                manifest.append(future.result())
                if len(manifest) % 100 == 0:
                    checkpoint()
                if len(manifest) % 500 == 0:
                    print('Downloaded/verified files:', len(manifest), flush=True)
    finally:
        for connection in connections:
            connection.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['inspect', 'backup'])
    parser.add_argument('--host', default='ftp.roaminglille.com')
    parser.add_argument('--tls-name', default='hstgr.io', help='Verified service identity in the Hostinger TLS certificate SAN')
    parser.add_argument('--expected-ip', default='147.93.93.183')
    parser.add_argument('--user', default='u587053106')
    parser.add_argument('--remote', default='.')
    parser.add_argument('--output', type=Path)
    parser.add_argument('--resume', action='store_true', help='Resume a partial backup, verifying completed files')
    parser.add_argument('--workers', type=int, choices=[1, 2, 3], default=3)
    args = parser.parse_args()
    if args.expected_ip not in socket.gethostbyname_ex(args.host)[2]:
        raise ValueError('Verified FTPS hostname does not resolve to expected server')
    password = getpass.getpass('FTPS password (not saved): ')
    ftp = ftplib.FTP_TLS(context=ssl.create_default_context(), timeout=45)
    def connect():
        connection = ftplib.FTP_TLS(context=ssl.create_default_context(), timeout=45)
        connection.connect(args.host, 21)
        connection.host = args.tls_name
        connection.auth(); connection.login(args.user, password); connection.prot_p()
        return connection
    def reconnect():
        ftp.close()
        ftp.connect(args.host, 21)
        ftp.host = args.tls_name
        ftp.auth()
        ftp.login(args.user, password)
        ftp.prot_p()
    try:
        # Verify the service identity as well as the certificate chain.
        reconnect()
        print('FTPS verified; encrypted control and data channels.', flush=True)
        print('Remote working directory:', ftp.pwd(), flush=True)
        if args.action == 'inspect':
            listing = [{'name': n, 'type': f.get('type'), 'size': f.get('size')} for n, f in entries(ftp, args.remote)]
            print(json.dumps(listing, ensure_ascii=True, indent=2), flush=True)
        else:
            if not args.output or (args.output.exists() and not args.resume):
                raise ValueError('Backup output must be a new local directory')
            manifest = []
            completed = {}
            if args.resume:
                old = json.loads((args.output / 'manifest.json').read_text(encoding='utf-8'))
                if old['remote'] != args.remote:
                    raise ValueError('Cannot resume a different remote tree')
                completed = {row['path']: row for row in old['files']}
            args.output.mkdir(parents=True, exist_ok=args.resume)
            def checkpoint():
                (args.output / 'manifest.json').write_text(json.dumps({'remote': args.remote, 'files': manifest}, indent=2), encoding='utf-8')
            try:
                parallel_backup(ftp, args.remote, args.output / 'files', manifest, completed, reconnect, connect, args.workers, checkpoint)
            finally:
                checkpoint()
            print('Backup completed:', len(manifest), 'files;', sum(x['bytes'] for x in manifest), 'bytes.', flush=True)
            (args.output / 'FILES_COMPLETE').write_text('All regular files downloaded and size-checked. Symlinks are refused.\n', encoding='utf-8')
        try:
            ftp.quit()
        except (EOFError, OSError, ftplib.error_temp):
            # The listing connection can expire while worker downloads finish.
            # A completed, verified backup does not depend on a successful QUIT.
            pass
    finally:
        ftp.close()


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(type(error).__name__ + ': ' + str(error), file=sys.stderr)
        sys.exit(1)

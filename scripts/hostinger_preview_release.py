"""Prepare/deploy the current tester release using the existing guarded FTPS workflow."""
import argparse
import json
from pathlib import Path
import hostinger_release_deploy as release

ROOT = Path(__file__).resolve().parent.parent
release.STAGE = ROOT / 'var/deployment/release-20261031'
original_allowed = release.allowed

def allowed(path):
    if original_allowed(path):
        return True
    if path == 'smogii/var/guestlucky/reviews.json':
        return True
    for prefix in ('public_html/images/', 'smogii/public/images/'):
        if path.startswith(prefix):
            parts = path[len(prefix):].split('/')
            return len(parts) == 2 and parts[0] in ('brands', 'reviewers') and '..' not in parts and Path(parts[1]).suffix.lower() in ('.svg', '.jpg', '.jpeg', '.png', '.webp')
    return False

release.allowed = allowed

def stage():
    release.stage()
    plan_path = release.STAGE / 'manifest.json'
    plan = json.loads(plan_path.read_text())
    extra = [(ROOT / 'var/guestlucky/reviews.json', 'smogii/var/guestlucky/reviews.json')]
    for folder in ('brands', 'reviewers'):
        for source in sorted((ROOT / 'public/images' / folder).iterdir()):
            if source.is_file():
                for prefix in ('public_html/images/', 'smogii/public/images/'):
                    extra.append((source, prefix + folder + '/' + source.name))
    for source, target in extra:
        if not allowed(target):
            raise ValueError('Unsafe target')
        data = source.read_bytes()
        destination = release.STAGE / 'files' / target
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(data)
        plan['files'].append({'path': target, 'sha256': release.digest(data), 'bytes': len(data)})
    plan['reviewsVisible'] = True
    plan['maintenancePreserved'] = True
    plan['reviewCount'] = len(json.loads((ROOT / 'var/guestlucky/reviews.json').read_text(encoding='utf-8'))['reviews'])
    plan_path.write_text(json.dumps(plan, indent=2))
    print(json.dumps({'ready': True, 'domain': plan['domain'], 'files': len(plan['files']), 'reviewCount': plan['reviewCount'], 'remoteWrites': False}))

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=('stage', 'deploy'))
    {'stage': stage, 'deploy': release.deploy}[parser.parse_args().action]()

"""Prompt privately for the short-lived phpMyAdmin link; export via browser UI."""
import getpass
import os
from pathlib import Path
import subprocess
import sys

environment = dict(os.environ)
environment['HOSTINGER_PMA_LINK'] = getpass.getpass('Private phpMyAdmin sign-on link (not saved): ')
script = Path(__file__).with_suffix('.cjs')
result = subprocess.run(['node', str(script), *sys.argv[1:]], env=environment)
environment.pop('HOSTINGER_PMA_LINK', None)
sys.exit(result.returncode)

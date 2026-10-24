"""Pass a temporary Hostinger sign-on link to the reviewed SQL deploy browser."""
import getpass
import os
from pathlib import Path
import subprocess
import sys

environment = dict(os.environ)
environment['HOSTINGER_PMA_LINK'] = getpass.getpass('Private phpMyAdmin sign-on link (not saved): ')
result = subprocess.run(['node', str(Path(__file__).with_suffix('.cjs')), *sys.argv[1:]], env=environment)
environment.pop('HOSTINGER_PMA_LINK', None)
sys.exit(result.returncode)

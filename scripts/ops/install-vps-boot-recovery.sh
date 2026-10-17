#!/bin/sh
# Run from a reviewed source bundle as the install base owner, without sudo.
# Does not run the recovery job.
set -eu
if [ "$#" -ne 1 ] || [ "$1" != "--apply" ]; then
  echo 'usage: install-vps-boot-recovery.sh --apply (installs files and only its cron block)' >&2
  exit 2
fi
SOURCE_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
export SOURCE_DIR
exec /usr/bin/python3 - <<'PY'
import datetime
import fcntl
import os
from pathlib import Path
import pwd
import runpy
import shutil
import subprocess

def installer_user(base):
    uid = os.getuid()
    if uid == 0 or os.geteuid() != uid or any(key in os.environ for key in ('SUDO_USER', 'SUDO_UID', 'SUDO_GID', 'SUDO_COMMAND')):
        raise SystemExit('Run as the install base owner, without root or sudo.')
    try:
        owner = base.stat().st_uid
        user = pwd.getpwuid(owner).pw_name
    except (OSError, KeyError):
        raise SystemExit('Cannot identify the install base owner; leaving files and crontab unchanged.')
    if uid != owner:
        raise SystemExit('Run as ' + user + ', the install base owner, without sudo.')
    return user

base = Path('/home/ravitejaknts/bloxodes-supabase')
user = installer_user(base)
os.umask(0o077)
source = Path(os.environ['SOURCE_DIR'])

def crontab():
    result = subprocess.run(['crontab', '-l'], capture_output=True, text=True, timeout=10)
    if result.returncode == 0:
        return result.stdout
    if result.returncode == 1 and result.stderr.strip() == 'no crontab for ' + user:
        return ''
    raise SystemExit('Cannot read crontab; leaving it unchanged.')

# Validate all inputs and the existing block before changing installed files.
script = source / 'vps-boot-recovery.py'
compile(script.read_text(), str(script), 'exec')
replace_block = runpy.run_path(str(script))['managed_crontab']
manifest = (source / 'vps-boot-recovery.crontab').read_text()
base.joinpath('bin').mkdir(parents=True, exist_ok=True)
with base.joinpath('boot-recovery.lock').open('a') as lock:
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        raise SystemExit('Recovery is active; retry installation after it finishes.')
    previous = crontab()
    updated = replace_block(previous, manifest)
    temporary = base / 'bin/.boot-recovery.py.new'
    shutil.copyfile(script, temporary)
    temporary.chmod(0o700)
    temporary.replace(base / 'bin/boot-recovery.py')
    shutil.copyfile(source / 'vps-boot-recovery.crontab', base / 'boot-recovery.crontab')
    if previous != updated:
        if crontab() != previous:
            raise SystemExit('Crontab changed during installation; retry. Installed files are ready.')
        stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
        backup = base / ('crontab-before-boot-recovery-' + stamp + '.txt')
        backup.write_text(previous)
        subprocess.run(['crontab', '-'], input=updated, text=True, check=True, timeout=10)
        print('Installed recovery block; original crontab saved at ' + str(backup))
    else:
        print('Recovery block already matches; refreshed installed files.')
    if crontab() != updated:
        raise SystemExit('Crontab readback mismatch; review before continuing.')
print('Installed boot recovery. No containers or services were changed.')
PY

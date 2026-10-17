#!/bin/sh
# Run from a reviewed source bundle as codex-admin. Does not run the recovery job.
set -eu
if [ "$#" -ne 1 ] || [ "$1" != "--apply" ]; then
  echo 'usage: install-vps-boot-recovery.sh --apply (installs files and only its cron block)' >&2
  exit 2
fi
if [ "$(id -un)" != "codex-admin" ]; then
  echo 'Run as codex-admin, without sudo.' >&2
  exit 1
fi
SOURCE_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
export SOURCE_DIR
exec /usr/bin/python3 - <<'PY'
import datetime
import fcntl
import os
from pathlib import Path
import runpy
import shutil
import subprocess

os.umask(0o077)
source = Path(os.environ['SOURCE_DIR'])
base = Path('/home/codex-admin/bloxodes-supabase')

def crontab():
    result = subprocess.run(['crontab', '-l'], capture_output=True, text=True, timeout=10)
    if result.returncode == 0:
        return result.stdout
    if result.returncode == 1 and result.stderr.strip() == 'no crontab for codex-admin':
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

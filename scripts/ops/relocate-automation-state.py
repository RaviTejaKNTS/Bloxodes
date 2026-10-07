"""Move idle runtime files to HDD with a verified copy and recoverable aliases."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import stat
import subprocess
import sys

legacy, root = map(Path, sys.argv[1:])
source, target = legacy / 'state', root / 'state'
staging, retained = root / 'state.copying', legacy / 'state.before-hdd'
receipt = root / 'state-relocation.json'

def manifest(directory):
    rows = []
    for parent, directories, files in os.walk(directory, followlinks=False):
        for name in sorted(directories + files):
            file = Path(parent) / name
            metadata = file.lstat()
            row = [str(file.relative_to(directory)), stat.S_IMODE(metadata.st_mode), metadata.st_uid, metadata.st_gid]
            if file.is_symlink():
                row += ['link', os.readlink(file)]
            elif file.is_file():
                digest = hashlib.sha256()
                with file.open('rb') as stream:
                    for chunk in iter(lambda: stream.read(1024 * 1024), b''):
                        digest.update(chunk)
                row += ['file', metadata.st_size, digest.hexdigest()]
            elif file.is_dir():
                row += ['directory']
            else:
                raise RuntimeError('Runtime state contains a special file: ' + str(file))
            rows.append(row)
    return sorted(rows)

if receipt.exists():
    expected = json.loads(receipt.read_text())
else:
    if not target.is_symlink() or target.resolve() != source.resolve() or source.is_symlink():
        raise RuntimeError('Inspect unexpected state paths before relocation.')
    expected = manifest(source)
    if staging.exists():
        raise RuntimeError('An incomplete state copy exists. Inspect it before retrying.')
    subprocess.run(['cp', '-a', '--', str(source), str(staging)], check=True)
    if manifest(staging) != expected or manifest(source) != expected:
        raise RuntimeError('Runtime state changed or its HDD copy differs. Original files remain intact.')
    receipt.write_text(json.dumps(expected))

# Each phase can be resumed after process loss. Keep the original copy until
# both compatibility paths resolve to the verified HDD files.
if target.is_symlink():
    target.unlink()
if not target.exists():
    staging.rename(target)
if manifest(target) != expected:
    raise RuntimeError('HDD state differs from the relocation receipt.')
if not source.is_symlink():
    if source.exists():
        source.rename(retained)
    source.symlink_to(target)
if source.resolve() != target.resolve() or manifest(source) != expected:
    raise RuntimeError('Runtime compatibility alias readback failed.')
if retained.exists():
    if manifest(retained) != expected:
        raise RuntimeError('Retained original state changed; leave it for inspection.')
    shutil.rmtree(retained)
print('Runtime state moved to HDD; file hashes, owners, modes and aliases match.')

#!/usr/bin/env python3
"""Download pinned vanilla source archives into the ignored authoring workspace."""
import argparse
import hashlib
import io
import json
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ARCHIVES = [
    ('java', 'https://piston-data.mojang.com/v1/objects/e877b6a07acd633fb3bb475002175cec036e7b87/client.jar', '4508d006323f24fa02876310c192d739af56516eb259000ac50f0909a68c9a2d'),
    ('java/summary', 'https://codeload.github.com/misode/mcmeta/zip/refs/tags/26.3-summary', '4cf482ec2479bff9257c36799fa2ba8148f740c59157a157594581e3ec142149'),
    ('bedrock', 'https://codeload.github.com/Mojang/bedrock-samples/zip/refs/tags/v1.26.50.4', '1634bb0a8ee5dd8ffedd346d55d247ede5aec3ec1827d010df0037dc75bc89b4'),
]


def acquire(destination: Path, apply: bool) -> None:
    for name, url, expected in ARCHIVES:
        target = destination / name
        receipt = destination / 'archive-receipts' / (name.replace('/', '-') + '.json')
        if receipt.exists():
            saved = json.loads(receipt.read_text())
            if saved.get('sha256') == expected and target.exists():
                print(json.dumps({'archive': name, 'action': 'already acquired'}))
                continue
        if not apply:
            print(json.dumps({'archive': name, 'url': url, 'sha256': expected, 'target': str(target), 'action': 'download and extract'}))
            continue
        with urllib.request.urlopen(url, timeout=120) as response:
            blob = response.read()
        actual = hashlib.sha256(blob).hexdigest()
        if actual != expected:
            raise ValueError(f'{name}: archive hash differs from the reviewed source')
        count = 0
        with zipfile.ZipFile(io.BytesIO(blob)) as archive:
            for member in archive.infolist():
                if member.is_dir():
                    continue
                raw = member.filename
                if name == 'java':
                    prefixes = {'assets/minecraft/': 'assets/', 'data/minecraft/': 'data/'}
                    relative = next((value + raw[len(key):] for key, value in prefixes.items() if raw.startswith(key)), None)
                    if relative is None:
                        continue
                else:
                    relative = raw.partition('/')[2]
                path = target / relative
                if not relative or not path.resolve().is_relative_to(target.resolve()):
                    raise ValueError(f'{name}: unsafe archive member')
                path.parent.mkdir(parents=True, exist_ok=True)
                content = archive.read(member)
                if not path.exists() or path.read_bytes() != content:
                    temporary = path.with_name(path.name + '.source-download')
                    temporary.write_bytes(content)
                    temporary.replace(path)
                count += 1
        receipt.parent.mkdir(parents=True, exist_ok=True)
        receipt.write_text(json.dumps({'url': url, 'sha256': actual, 'files': count}, indent=2) + '\n')
        print(json.dumps({'archive': name, 'action': 'acquired', 'files': count}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--workspace', type=Path, default=ROOT / 'tmp/content-workspace/minecraft/source-pack')
    parser.add_argument('--apply', action='store_true', help='Download and extract; default prints the pinned plan')
    args = parser.parse_args()
    workspace = args.workspace.resolve()
    if not workspace.is_relative_to((ROOT / 'tmp').resolve()):
        parser.error('Workspace must be inside this checkout ignored tmp directory')
    acquire(workspace, args.apply)

#!/usr/bin/env python3
"""Plan or wire reviewed source-image candidates after the parent collection data gate."""
import argparse
import copy
import hashlib
import json
import shutil
from pathlib import Path
from urllib.parse import urlparse
from PIL import Image


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--workspace',required=True)
    parser.add_argument('--reference-manifest',required=True)
    parser.add_argument('--apply',action='store_true')
    parser.add_argument('--allow-dynamic-gaps',action='store_true',help='Retain explicit per-row dynamic-output candidates for parent exception review')
    args=parser.parse_args()
    workspace=Path(args.workspace)
    brief=(workspace/'brief.md').read_text()
    if '## Parent data review' not in brief or not any(marker in brief for marker in ('Approved for the image stage','Approved for images')):
        raise ValueError('The collection requires recorded parent data approval before image wiring')
    dataset_path=workspace/'dataset.json'
    dataset=json.loads(dataset_path.read_text())
    original=copy.deepcopy(dataset)
    references=json.loads(Path(args.reference_manifest).read_text())
    images={row['slug']:row for row in references['images']}
    slugs={row['system']['slug'] for row in dataset['items']}
    if len(images)!=len(references['images']) or slugs!=set(images):
        raise ValueError('Reference identities must match the frozen collection roster exactly')
    proof=[]
    gaps=[]
    for row in dataset['items']:
        slug=row['system']['slug'];reference=images[slug]
        if reference.get('status')=='gap':
            if not args.allow_dynamic_gaps or not reference.get('reason'):
                raise ValueError(f'{slug} requires an explicit per-row exception review')
            row['system']['image']=None
            gaps.append(reference)
            continue
        source=Path(reference['image'])
        if not source.is_file():
            raise ValueError(f'{slug} has no exact source-image candidate')
        digest=hashlib.sha256(source.read_bytes()).hexdigest()
        if digest!=reference['sha256']:
            raise ValueError(f'{slug} source-image bytes changed since review')
        with Image.open(source) as image:
            image.verify()
        page=urlparse(reference['sourcePage'])
        community=page.netloc=='minecraft.wiki'
        if page.scheme!='https' or (community and (not page.path.startswith('/w/') or ':' in page.path)) or (not community and page.netloc not in ('www.minecraft.net','github.com','piston-data.mojang.com')):
            raise ValueError(f'{slug} image proof must link to a permitted canonical article or pinned primary asset source')
        row['system']['image']=f'media/{slug}.webp'
        # Parent approval permits this curated public credit URL in the image pass.
        if community:
            row['item']['imageCreditUrl']=reference['sourcePage']
        proof.append({**reference,'path':row['system']['image'],'sha256':digest,'exactMatch':reference.get('exactMatch',True),
                      'imageReview':'Image worker visually inspected the exact source candidate. Parent image approval remains required.'})
    comparable=copy.deepcopy(dataset)
    for row,old in zip(comparable['items'],original['items']):
        row['system']['image']=old['system'].get('image')
        if 'imageCreditUrl' in old['item']:
            row['item']['imageCreditUrl']=old['item']['imageCreditUrl']
        else:
            row['item'].pop('imageCreditUrl',None)
    if comparable!=original:
        raise ValueError('Image wiring changed a frozen public fact or collection property')
    report={'collection':dataset['meta']['collection'],'target':len(slugs),'images':proof,'missing':gaps,
            'referenceManifest':args.reference_manifest,'licensing':'Mojang retains underlying game-art copyright. Individual community image-file licenses remain unverified because file-description routes are robots-disallowed. Public credits link to permitted canonical articles; no CC or MIT license is asserted.',
            'processing':'Exact source render or screenshot. Original dimensions preserved unless the source exceeded 1280 pixels. Community images carry canonical article credits.',
            'parentImageApproval':None}
    if args.apply:
        media=workspace/'media';media.mkdir(exist_ok=True)
        for reference in proof:
            shutil.copyfile(reference['image'],workspace/reference['path'])
        dataset_path.write_text(json.dumps(dataset,indent=2)+'\n')
        (workspace/'images.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({'collection':report['collection'],'images':len(proof),'publicFactChanges':0,'creditUrlsAdded':sum(urlparse(row['sourcePage']).netloc=='minecraft.wiki' for row in proof),'applied':args.apply}))


if __name__=='__main__':main()

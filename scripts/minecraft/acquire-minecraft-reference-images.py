#!/usr/bin/env python3
"""Cache exact reference images for parent review without changing collection datasets."""
import argparse
import hashlib
import functools
import io
import json
import urllib.parse
import urllib.request
import urllib.robotparser
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from bs4 import BeautifulSoup
from PIL import Image

BASE='https://minecraft.wiki'
USER_AGENT='BloxodesContentReview/1.0 (+https://bloxodes.com)'
ROBOTS=None


@functools.lru_cache(maxsize=512)
def fetch(url):
    parsed=urllib.parse.urlparse(url)
    if parsed.scheme!='https' or parsed.netloc!='minecraft.wiki' or not (parsed.path=='/robots.txt' or parsed.path.startswith('/w/') or parsed.path.startswith('/images/')):
        raise ValueError('Only canonical HTTPS article, image and robots routes are allowed')
    if ROBOTS is not None and not ROBOTS.can_fetch(USER_AGENT,url):
        raise ValueError(f'Robots rules disallow automated access to {url}')
    request=urllib.request.Request(url,headers={'User-Agent':USER_AGENT})
    with urllib.request.urlopen(request,timeout=35) as response:
        if ROBOTS is not None and not ROBOTS.can_fetch(USER_AGENT,response.geturl()):
            raise ValueError('Redirect target is robots-disallowed')
        return response.read(),response.geturl(),response.status


def acquire(row,output):
    slug=row['slug'];page_name=row['page']
    page_url=f'{BASE}/w/{urllib.parse.quote(page_name.replace(" ","_"),safe="_:()")}'
    try:
        page,actual_page_url,page_status=fetch(page_url)
        (output/f'{slug}-source.html').write_bytes(page)
        soup=BeautifulSoup(page,'html.parser')
        area=soup.select_one('.infobox-imagearea')
        if row.get('imageSelector'):
            area=soup
        if area is None:
            raise ValueError('No infobox image area; exact manual image selection required')
        candidates=[]
        for image in area.select(row.get('imageSelector','img')):
            if int(image.get('width',0))>=row.get('minimumWidth',100):
                anchor=image.find_parent('a')
                source=image.get('src','')
                if row.get('preferExposedSrcset') and image.get('srcset'):
                    # Use only an image URL explicitly exposed by the permitted article.
                    variants=[part.strip().split() for part in image['srcset'].split(',')]
                    variants=[part for part in variants if len(part)==2 and part[1].endswith('x')]
                    if variants:
                        source=max(variants,key=lambda part:float(part[1][:-1]))[0]
                candidates.append({'alt':image.get('alt',''),'src':urllib.parse.urljoin(actual_page_url,source),'filePage':urllib.parse.urljoin(actual_page_url,anchor.get('href','')) if anchor else None,'declaredWidth':image.get('data-file-width'),'declaredHeight':image.get('data-file-height')})
        if not candidates:
            raise ValueError('No useful identifying infobox image')
        # The first source-defined variant is a candidate, never automatic exact-match approval.
        if row.get('matchText'):
            matching=[candidate for candidate in candidates if row['matchText'] in candidate['alt']]
            if not matching:
                raise ValueError(f'No exact source image identity {row["matchText"]}')
            chosen=matching[0]
        elif row.get('matchPrefix'):
            matching=[candidate for candidate in candidates if candidate['alt'].startswith(row['matchPrefix'])]
            if not matching:
                raise ValueError(f'No exact source-defined variant with alt prefix {row["matchPrefix"]}')
            chosen=matching[0]
        else:
            chosen=candidates[0]
        # File-description routes are excluded by robots. Fetch only the image exposed by the permitted article.
        image_url=chosen['src']
        data,actual_image_url,image_status=fetch(image_url)
        image=Image.open(io.BytesIO(data)).convert('RGBA')
        minimum_pixels=row.get('minimumPixels',32)
        if not isinstance(minimum_pixels,int) or minimum_pixels<16:
            raise ValueError('Explicit inventory or HUD sprite minimum must be at least 16 pixels')
        if min(image.size)<minimum_pixels:
            raise ValueError('Reference image is too small or a placeholder')
        original_size=image.size
        image.thumbnail((1280,1280),Image.Resampling.LANCZOS)
        image_path=output/f'{slug}.webp';image.save(image_path,quality=90,method=6,lossless=min(original_size)<=32)
        (output/f'{slug}-source.html').write_bytes(page)
        return {'slug':slug,'status':'candidate pending visual identity, version and usage review','sourcePage':actual_page_url,'filePage':chosen['filePage'],'directImageUrl':actual_image_url,'httpStatuses':{'article':page_status,'image':image_status},'accessMethod':'Ordinary direct HTTPS urllib requests; no proxy, challenge solving or alternate access endpoint','image':str(image_path),'sha256':hashlib.sha256(image_path.read_bytes()).hexdigest(),'sourceSha256':hashlib.sha256(data).hexdigest(),'originalSize':original_size,'outputSize':image.size,'alt':chosen['alt'],'visualAlias':row.get('visualAlias'),'candidates':candidates,'licenseText':'Article footer links to the site content license. Individual image-file descriptions are robots-disallowed and were not fetched; image usage requires separate parent review. Mojang retains game-art copyright.','processing':'Source-identical screenshot/render resized only when larger than 1280 pixels, converted to WebP. No invented content.'}
    except Exception as error:
        return {'slug':slug,'status':'gap','sourcePage':page_url,'reason':str(error)}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--roster',required=True,help='JSON array of {slug,page} exact reference identities')
    parser.add_argument('--output',required=True)
    args=parser.parse_args()
    global ROBOTS
    robots_data,robots_url,robots_status=fetch(BASE+'/robots.txt')
    ROBOTS=urllib.robotparser.RobotFileParser()
    ROBOTS.parse(robots_data.decode().splitlines())
    rows=json.loads(Path(args.roster).read_text())
    if not rows or len({row['slug'] for row in rows})!=len(rows):raise ValueError('Unique explicit image candidate roster required')
    output=Path(args.output);output.mkdir(parents=True,exist_ok=True)
    (output/'robots.txt').write_bytes(robots_data)
    with ThreadPoolExecutor(max_workers=4) as workers:
        images=list(workers.map(lambda row:acquire(row,output),rows))
    (output/'reference-images.json').write_text(json.dumps({'approved':False,'robots':{'url':robots_url,'status':robots_status},'images':images},indent=2)+'\n')
    print(json.dumps({'candidates':sum(row['status'].startswith('candidate') for row in images),'gaps':[row for row in images if row['status']=='gap'],'manifest':str(output/'reference-images.json')}))

if __name__=='__main__':main()

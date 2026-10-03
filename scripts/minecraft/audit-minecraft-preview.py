#!/usr/bin/env python3
"""Read-only HTTP checks for the independent Minecraft edition inventories."""
import argparse, datetime, hashlib, json, re, urllib.error, urllib.request
from pathlib import Path
from urllib.parse import urlparse
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[2]
CANONICAL = 'https://bloxodes.com'
TOOLS = ['anvil-enchantment-planner','beacon-materials-calculator','brewing-planner','building-materials-estimator','command-generator','crafting-materials-planner','furnace-fuel-calculator','gear-comparison','nether-coordinate-converter','pixel-circle-generator','stack-and-storage-calculator','stronghold-triangulation','xp-calculator']

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl): return None

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--base', default='http://127.0.0.1:3307')
    parser.add_argument('--workspace', default=str(ROOT/'tmp/content-workspace/minecraft-editions'))
    parser.add_argument('--output')
    parser.add_argument('--only', default='', help='Comma-separated paths for a targeted follow-up check')
    parser.add_argument('--workers', type=int, default=1)
    parser.add_argument('--timeout', type=int, default=300)
    args = parser.parse_args()
    host = urlparse(args.base).hostname
    if host not in ['localhost','127.0.0.1','100.86.117.125','teja-homelab.tail13b5bd.ts.net']:
        parser.error('Use an existing managed-development homelab preview.')
    workspace = Path(args.workspace)
    inventories = {}
    for edition in ['java','bedrock']:
        inventories[edition] = {}
        for file in (workspace/f'minecraft-{edition}'/'collections').glob('*/dataset.json'):
            data = json.loads(file.read_text()); final = json.loads((file.parent/'final.json').read_text())
            inventories[edition][file.parent.name] = {'count':len(data['items']), 'title':final['title'].replace('{count}',f"{len(data['items']):,}"), 'seo_title':final['seo_title'].replace('{count}',f"{len(data['items']):,}")}
        if len(inventories[edition]) != 24: parser.error(f'{edition} must have 24 reviewed collections.')
    output = Path(args.output) if args.output else workspace/'qa/preview-review.json'
    only = set(filter(None,args.only.split(',')))
    results = []; opener = urllib.request.build_opener(NoRedirect())
    def request(path, expected=200, cookie='', agent='BloxodesManagedDevelopmentQA/2.0'):
        try:
            req = urllib.request.Request(args.base.rstrip('/')+path,headers={'User-Agent':agent,'Cookie':cookie})
            with opener.open(req,timeout=args.timeout) as res: status,body,headers=res.status,res.read(),res.headers
        except urllib.error.HTTPError as error: status,body,headers=error.code,error.read(),error.headers
        soup = BeautifulSoup(body,'html.parser'); issues=[]
        if status != expected: issues.append(f'HTTP {status}, expected {expected}')
        canonical=soup.find('link',rel='canonical'); canonical=canonical.get('href') if canonical else None
        record={'path':path,'status':status,'canonical':canonical,'bytes':len(body),'sha256':hashlib.sha256(body).hexdigest(),'issues':issues}
        if expected == 200:
            h1=soup.find_all('h1'); record['title']=soup.title.get_text() if soup.title else ''; record['h1']=[node.get_text(' ',strip=True) for node in h1]
            if len(h1)!=1: issues.append('Expected one H1')
            if canonical != CANONICAL+path: issues.append('Incorrect canonical')
            if len(body)>4_000_000: issues.append('HTML exceeds 4 MB')
            if soup.select('nav[aria-label="Minecraft edition"]') or any('edition=' in a['href'] for a in soup.select('a[href]')): issues.append('Obsolete edition switch')
            match=re.fullmatch(r'/minecraft/(java|bedrock)/wiki(?:/([^/]+))?(?:/page/(\d+))?',path)
            if match:
                edition,slug,page=match.groups()
                robots=soup.find('meta',attrs={'name':'robots'}); noindex=bool(robots and 'noindex' in robots.get('content',''))
                if page and not noindex: issues.append('Pagination must be noindex')
                if not page and noindex: issues.append('Base page must be indexable')
                if slug:
                    expected_title=inventories[edition][slug]['title'] + (f' - Page {page}' if page else '')
                    if not h1 or h1[0].get_text(' ',strip=True)!=expected_title: issues.append('Collection title/count mismatch')
                    expected_seo=inventories[edition][slug]['seo_title'] + (f' - Page {page}' if page else '')
                    if not record['title'].startswith(expected_seo): issues.append('Metadata title mismatch')
                else:
                    cards={a['href'].split('/')[-1]:a.get_text(' ',strip=True) for a in soup.select('#article-body a[href]') if a['href'].startswith(f'/minecraft/{edition}/wiki/')}
                    if set(cards)!=set(inventories[edition]): issues.append('Hub inventory mismatch')
                    for name,entry in inventories[edition].items():
                        if entry['title'] not in cards.get(name,''): issues.append(f'Card title/count mismatch: {name}')
                    graphs=[json.loads(node.get_text()) for node in soup.select('script[type="application/ld+json"]')]
                    directory=next((n for g in graphs for n in g.get('@graph',[g]) if n.get('@type')=='CollectionPage'),{})
                    links={x['url'] for x in directory.get('mainEntity',{}).get('itemListElement',[])}
                    if links!={f'{CANONICAL}/minecraft/{edition}/wiki/{name}' for name in inventories[edition]}: issues.append('Hub JSON-LD inventory mismatch')
        elif expected == 308: record['location']=headers.get('location')
        results.append(record);output.parent.mkdir(parents=True,exist_ok=True);output.write_text(json.dumps({'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'results':results},indent=2)+'\n')
        print(path,status,'PASS' if not issues else issues,flush=True)
        return soup,record
    named=['/minecraft','/minecraft/wiki','/minecraft/tools']
    for edition,entries in inventories.items():
        named += [f'/minecraft/{edition}/wiki']+[f'/minecraft/{edition}/wiki/{slug}' for slug in entries]
    named += [f'/minecraft/tools/{slug}' for slug in TOOLS]
    for path in named:
        if not only or path in only: request(path)
    for edition in inventories:
        if not only or f'/minecraft/{edition}/wiki/recipes/page/2' in only: request(f'/minecraft/{edition}/wiki/recipes/page/2')
        if not only or f'/minecraft/{edition}/wiki/fuels' in only: request(f'/minecraft/{edition}/wiki/fuels',cookie='minecraft-edition='+('bedrock' if edition=='java' else 'java'),agent='Googlebot')
        if not only or f'/minecraft/{edition}/wiki' in only: request(f'/minecraft/{edition}/wiki',agent='GPTBot')
    for path in ['/minecraft/java/wiki/achievements','/minecraft/bedrock/wiki/advancements','/minecraft/other/wiki','/minecraft/java/wiki/fuels/item/coal','/minecraft/java/wiki/fuels/page/1']:
        if not only or path in only: request(path,404)
    for path,target in [('/minecraft/wiki/fuels','/minecraft/java/wiki/fuels'),('/minecraft/wiki/achievements','/minecraft/bedrock/wiki/achievements'),('/minecraft/wiki/recipes/page/2?edition=bedrock','/minecraft/bedrock/wiki/recipes/page/2')]:
        if only and path not in only: continue
        _,record=request(path,308,cookie='minecraft-edition=bedrock')
        if not record.get('location','').endswith(target): record['issues'].append('Incorrect legacy destination')
    for path,expected in [('/sitemaps/minecraft.xml',66),('/feed.xml',None)]:
        if only and path not in only: continue
        req=urllib.request.Request(args.base.rstrip('/')+path)
        with opener.open(req,timeout=args.timeout) as res:body=res.read()
        soup=BeautifulSoup(body,'xml');links=[n.get_text() for n in soup.find_all('loc' if expected else 'link')]
        needed={CANONICAL+p for p in (named if expected else named[3:])}
        # The feed carries content pages, not directory pages.
        if not expected:needed-={CANONICAL+'/minecraft/tools'}
        issues=[]
        if not needed<=set(links):issues.append('Missing published URLs')
        if expected and len(links)!=expected:issues.append('Incorrect sitemap inventory')
        if any('/minecraft/wiki/' in p or 'edition=' in p or '/page/' in p for p in links):issues.append('Legacy or paginated URLs in distribution')
        results.append({'path':path,'count':len(links),'issues':issues});print(path,'PASS' if not issues else issues,flush=True)
    output.write_text(json.dumps({'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'results':results},indent=2)+'\n')
    if any(x['issues'] for x in results):raise SystemExit(1)
    print(f'Passed {len(results)} checks across {len(named)} named pages.')
if __name__=='__main__':main()

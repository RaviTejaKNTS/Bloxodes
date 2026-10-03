#!/usr/bin/env python3
"""Read-only HTTP review of the fixed Minecraft page inventory and editions."""
import argparse, concurrent.futures, datetime, hashlib, json, re, time, urllib.error, urllib.request
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from bs4 import BeautifulSoup

ROOT=Path(__file__).resolve().parents[2]
WORK=ROOT/'tmp/content-workspace/minecraft'
COLLECTIONS=['achievements','advancements','armor','armor-trims','biomes','blocks','commands','crops-and-plants','enchantments','food','fuels','items','mobs','music-discs','ores','potions','pottery-sherds','recipes','redstone-components','status-effects','structures','tools','villager-professions','villager-trades','weapons']
TOOLS=['anvil-enchantment-planner','beacon-materials-calculator','brewing-planner','building-materials-estimator','command-generator','crafting-materials-planner','furnace-fuel-calculator','gear-comparison','nether-coordinate-converter','pixel-circle-generator','stack-and-storage-calculator','stronghold-triangulation','xp-calculator']
CANONICAL='https://bloxodes.com'
REQUEST_TIMEOUT_SECONDS=300

def get(base,path,cookie=None):
 headers={'User-Agent':'BloxodesManagedDevelopmentQA/1.0','Accept':'text/html,application/xml,application/json'}
 if cookie:headers['Cookie']=cookie
 request=urllib.request.Request(base+path,headers=headers)
 try:
  with urllib.request.urlopen(request,timeout=REQUEST_TIMEOUT_SECONDS) as response:return response.status,response.read(),dict(response.headers),response.geturl()
 except urllib.error.HTTPError as error:return error.code,error.read(),dict(error.headers),error.geturl()
 except Exception as error:return 0,str(error).encode(),{},base+path

def count(slug,edition):
 file=WORK/'minecraft/collections'/slug/'dataset.json'
 if not file.exists():return None
 data=json.loads(file.read_text());return sum(not isinstance(row['item'].get('editions'),list) or edition in row['item']['editions'] for row in data['items'])

def audit(base,path,edition=None,expected=200,cookie=None):
 query=path+('?edition='+edition if edition else '')
 started=time.perf_counter();status,body,headers,final=get(base,query,cookie);request_seconds=time.perf_counter()-started;soup=BeautifulSoup(body,'html.parser');issues=[]
 canonical=soup.find('link',rel='canonical');canonical=canonical.get('href') if canonical else None
 robots=[node.get('content','') for node in soup.find_all('meta') if node.get('name','').lower() in ['robots','googlebot']];noindex=any('noindex' in value.lower() for value in robots)
 headings=[node.get_text(' ',strip=True) for node in soup.find_all('h1')];wanted=CANONICAL+path
 if status!=expected:issues.append({'check':'http','expected':expected,'actual':status})
 selected=None;overview_cards=[]
 if expected==200 and status==200:
  if canonical!=wanted:issues.append({'check':'canonical','expected':wanted,'actual':canonical})
  if len(headings)!=1:issues.append({'check':'h1','actual':headings})
  slug=path.removeprefix('/minecraft/wiki/').split('/')[0]
  if path=='/minecraft/wiki':
   selected_edition=edition or 'java'
   expected_cards={slug:count(slug,selected_edition) for slug in COLLECTIONS if count(slug,selected_edition)}
   actual_cards={}
   for link in soup.select('#article-body a[href]'):
    parsed=urlparse(link['href']);card_slug=parsed.path.removeprefix('/minecraft/wiki/')
    if card_slug not in COLLECTIONS:continue
    text=link.get_text(' ',strip=True);match=re.search(r'([\d,]+) entries',text);actual_count=int(match.group(1).replace(',','')) if match else None
    actual_cards[card_slug]=actual_count;overview_cards.append({'slug':card_slug,'href':link['href'],'itemCount':actual_count})
    if parse_qs(parsed.query).get('edition')!=[selected_edition]:issues.append({'check':'overview-link-edition','href':link['href']})
    if ('Java Edition' if selected_edition=='java' else 'Bedrock Edition') not in text:issues.append({'check':'overview-card-edition-label','slug':card_slug})
    if re.search(r'\bAll [\d,]+\b',text):issues.append({'check':'overview-combined-title','slug':card_slug})
   if actual_cards!=expected_cards:issues.append({'check':'overview-edition-counts','expected':expected_cards,'actual':actual_cards})
   edition_links=soup.select('nav[aria-label="Minecraft edition"] a[href]')
   if len(edition_links)!=2 or sum(link.get('aria-current')=='page' for link in edition_links)!=1:issues.append({'check':'overview-crawlable-edition-navigation'})
   for target in ['java','bedrock']:
    if not any(urlparse(link['href']).path==path and parse_qs(urlparse(link['href']).query).get('edition')==[target] for link in edition_links):issues.append({'check':'overview-edition-link','edition':target})
   graphs=[json.loads(node.string or node.get_text()) for node in soup.select('script[type="application/ld+json"]')]
   entities=[node for graph in graphs for node in graph.get('@graph',[graph])]
   directory=next((node for node in entities if node.get('@type')=='CollectionPage'),None)
   listing=directory.get('mainEntity',{}) if directory else {}
   if listing.get('numberOfItems')!=len(expected_cards) or [entry.get('url') for entry in listing.get('itemListElement',[])]!=[CANONICAL+card['href'] for card in overview_cards]:issues.append({'check':'overview-item-list-jsonld'})
  elif slug in COLLECTIONS:
   selected=count(slug,edition or 'java')
   if selected==0:
    if not noindex:issues.append({'check':'empty-edition-noindex','expected':True})
    if 'no entries' not in soup.get_text(' ',strip=True).lower():issues.append({'check':'empty-edition-explanation'})
   elif selected is not None:
    values=[int(value.replace(',','')) for heading in headings for value in re.findall(r'\b[\d,]+\b',heading)]
    if selected not in values:issues.append({'check':'heading-item-count','expected':selected,'actual':headings})
   if '/page/' in path and not noindex:issues.append({'check':'pagination-noindex','expected':True})
  elif noindex:issues.append({'check':'unexpected-noindex','actual':robots})
  if path=='/minecraft/wiki' or path.startswith('/minecraft/wiki/') or path.startswith('/minecraft/tools/'):
   edition_links=soup.select('nav[aria-label="Minecraft edition"] a[href]');edition_base=re.sub(r'/page/\d+$','',path)
   if len(edition_links)!=2 or sum(link.get('aria-current')=='page' for link in edition_links)!=1:issues.append({'check':'crawlable-edition-navigation'})
   for target in ['java','bedrock']:
    if not any(urlparse(link['href']).path==edition_base and parse_qs(urlparse(link['href']).query).get('edition')==[target] for link in edition_links):issues.append({'check':'edition-navigation-destination','edition':target})
  if len(body)>4_000_000:issues.append({'check':'html-size','threshold':4_000_000,'actual':len(body)})
 else:
  if status==200 and not noindex:issues.append({'check':'unexpected-indexable-item-route'})
 navigation=[]
 if cookie and status==200:
  for link in soup.find_all('a',href=True):
   if link.find_parent('nav',attrs={'aria-label':'Minecraft edition'}):continue
   href=link['href'];parsed=urlparse(href)
   if parsed.path.startswith('/minecraft/wiki/'):
    navigation.append(href)
    if parse_qs(parsed.query).get('edition')!=[edition]:issues.append({'check':'navigation-edition','href':href,'expected':edition})
 return {'path':path,'edition':edition,'cookie':cookie,'status':status,'transportError':body.decode(errors='replace') if status==0 else None,'finalUrl':final,'canonical':canonical,'robots':robots,'h1':headings,'expectedItemCount':selected,'overviewCards':overview_cards,'htmlBytes':len(body),'requestSeconds':round(request_seconds,3),'bodySha256':hashlib.sha256(body).hexdigest(),'navigationLinks':navigation,'issues':issues}

def main():
 global REQUEST_TIMEOUT_SECONDS
 parser=argparse.ArgumentParser();parser.add_argument('--base',default='http://127.0.0.1:3307');parser.add_argument('--output',default=str(WORK/'qa/preview-review.json'));parser.add_argument('--workers',type=int,default=1);parser.add_argument('--pending-collections',default='');parser.add_argument('--timeout',type=int,default=300,help='HTTP request timeout in seconds; allow cold preview compilation');args=parser.parse_args()
 if args.timeout<=0:parser.error('Timeout must be positive.')
 REQUEST_TIMEOUT_SECONDS=args.timeout
 target=urlparse(args.base)
 if target.scheme!='http' or target.hostname not in ['127.0.0.1','localhost','100.86.117.125','teja-homelab.tail13b5bd.ts.net']:raise ValueError('This audit only targets the managed-development homelab preview.')
 paths=['/minecraft','/minecraft/wiki','/minecraft/tools']+['/minecraft/wiki/'+slug for slug in COLLECTIONS]+['/minecraft/tools/'+slug for slug in TOOLS]
 pending=set(filter(None,args.pending_collections.split(',')))
 if not pending.issubset(COLLECTIONS):raise ValueError('Pending collections must belong to the planned inventory.')
 published_paths=[path for path in paths if path.removeprefix('/minecraft/wiki/').split('/')[0] not in pending]
 tasks=[(path,edition,200) for path in paths for edition in ['java','bedrock']]
 tasks+=[('/minecraft/wiki/items/page/2',edition,200) for edition in ['java','bedrock']]
 tasks+=[(path,None,404) for path in ['/minecraft/wiki/items/diamond','/minecraft/wiki/enchantments/mending','/minecraft/wiki/java','/minecraft/wiki/bedrock','/minecraft/java/wiki','/minecraft/wiki/items/page/99999']]
 results=[]
 output=Path(args.output);output.parent.mkdir(parents=True,exist_ok=True)
 def checkpoint():
  output.write_text(json.dumps({'generatedAt':datetime.datetime.now(datetime.UTC).isoformat(),'base':args.base,'expectedPages':len(paths),'state':'in-progress','checks':results},indent=2)+'\n')
 with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
  futures={pool.submit(audit,args.base,*task):task for task in tasks}
  for future in concurrent.futures.as_completed(futures):
   result=future.result()
   if result['path'].removeprefix('/minecraft/wiki/').split('/')[0] in pending and result['status']==404 and futures[future][2]==200:
    result['pendingPublication']=True;result['issues']=[]
   results.append(result);checkpoint();print(json.dumps({'path':result['path'],'edition':result['edition'],'status':result['status'],'pendingPublication':result.get('pendingPublication',False),'issues':result['issues']}),flush=True)
 for path in ['/minecraft/wiki/items','/minecraft/wiki/enchantments','/minecraft/wiki/items/page/2']:
  result=audit(args.base,path,'java',200,'minecraft-edition=bedrock')
  if path.removeprefix('/minecraft/wiki/').split('/')[0] in pending and result['status']==404:result['pendingPublication']=True;result['issues']=[]
  results.append(result);checkpoint()
 inventory={}
 for endpoint in ['/sitemaps/minecraft.xml','/sitemap.xml','/feed.xml','/api/search/all?q=minecraft&scope=minecraft&limit=200']:
  status,body,_,_=get(args.base,endpoint);urls=[]
  try:
   if '/api/search/' in endpoint:urls=[entry['url'] for entry in json.loads(body).get('items',[])]
   else:
    soup=BeautifulSoup(body,'xml');urls=[node.get_text(strip=True) for node in soup.find_all('loc' if 'sitemap' in endpoint else 'link')]
  except Exception as error:urls=['PARSE ERROR: '+str(error)]
  found={urlparse(value).path for value in urls};expected_paths=published_paths if endpoint.startswith('/sitemaps/') else [path for path in published_paths if path not in ['/minecraft','/minecraft/tools']] if endpoint.startswith(('/feed','/api/search')) else ['/sitemaps/minecraft.xml']
  inventory[endpoint]={'status':status,'minecraftUrls':sorted(value for value in found if '/minecraft' in value),'missing':sorted(set(expected_paths)-found),'unexpectedItemUrls':sorted(value for value in found if value.startswith('/minecraft/wiki/') and value not in paths)}
 report={'generatedAt':datetime.datetime.now(datetime.UTC).isoformat(),'base':args.base,'requestTimeoutSeconds':args.timeout,'state':'complete','expectedPages':len(paths),'pendingCollections':sorted(pending),'editionPageRequests':len(paths)*2,'checks':sorted(results,key=lambda x:(x['path'],x['edition'] or '')),'inventory':inventory,'failureCount':sum(bool(x['issues']) for x in results)+sum(x['status']!=200 or bool(x['missing']) or bool(x['unexpectedItemUrls']) for x in inventory.values()),'limits':'HTTP and server-rendered HTML only. Browser interaction and visual QA remain separate. Pending unpublished collections require another sweep after publication.'}
 output.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({'receipt':str(output),'expectedPages':len(paths),'checks':len(results),'failureCount':report['failureCount'],'inventory':inventory}),flush=True)
if __name__=='__main__':main()

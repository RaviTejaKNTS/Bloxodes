import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { internalArticleLinks, stripArticleLinkMarkup, assertArticleLinksOnlyChange, checkArticleLinks } from "../article-links";
import { verifyArticleLive } from "../article-publish";
import { directProductionStatus, orderRelatedPages, relatedArticlePages } from "../../articles/article-related";
import { assertLinkRepair, liveArticleFinal, prepareArticleLinkRepair, publishArticleLinkRepair } from "../article-link-repair";
import { acquireAgentWorkLock } from "../../shared/agent-work-lock";
import { articleLinkRepairBundleSchema } from "../../../contracts/article-links/v1/schema";

test("extracts inline and reference links but excludes images, code and escaped markup",()=>{
 const md='# Heading [wiki](/wiki/fisch)\n\n- [codes](https://bloxodes.com/codes/fisch)\n\n![image](/media/image.webp) ` [code](/code) ` \\[escaped](/no)\n\n[reference][r]\n\n[r]: /articles/another\n\n```\n[code](/code)\n```';
 assert.deepEqual(internalArticleLinks(md).map(l=>new URL(l.url).pathname),['/wiki/fisch','/codes/fisch','/articles/another']);
 assert.equal(internalArticleLinks('[external](https://example.com) ![x](/image)').length,0);
});

for(const field of ['body','faq'])for(const kind of ['HTML','relative'])test(`${kind} anchors fail in ${field}`,async()=>{
 for(const markup of kind==='HTML'?['<a href="/missing">Broken</a>','<A HREF="https://example.com">External</A>','<div><a\nhref="/missing">Broken</a></div>']:
  [...['missing','./missing','../missing','?page=2','#missing','','//bloxodes.com/missing','//example.com/missing'].map(href=>`[Broken](${href})`),'[Broken][ref]\n\n[ref]: missing']) {
  const final={slug:'self',content_md:'[Hub](/wiki/game)'+(field==='body'?'\n\n'+markup:''),faq_json:field==='faq'?[{q:'Help?',a:markup}]:[]};
  const result=await checkArticleLinks(final,{universeId:1},{status:async()=>({status:200,location:null}),related:async()=>[]});
  assert.ok(result.errors.some(error=>/root-relative \/path/.test(error)),markup);
  if(/<a\b/i.test(markup))assert.ok(result.errors.some(error=>/HTML.*<a>/.test(error)),markup);
 }
 const safe=await checkArticleLinks({slug:'self',content_md:'[Hub](/wiki/game)\n\n`<a href="missing">example</a>`\n\n```html\n<a href="missing">example</a>\n```\n\n&lt;a href="missing"&gt;example&lt;/a&gt;'}, {universeId:1},{status:async()=>({status:200,location:null})});
 assert.deepEqual(safe.errors,[]);
});

for(const field of ['body','faq'])test(`live check validates every rendered internal ${field} anchor`,async()=>{
 const originalFetch=globalThis.fetch;const url='https://bloxodes.com/articles/rendered-links';
 const cover='https://example.com/cover.png';const requests:string[]=[];
 const image=await sharp({create:{width:8,height:8,channels:3,background:'red'}}).png().toBuffer();
 let broken=true;
 globalThis.fetch=async(input,init)=>{
  const href=String(input);requests.push(href);
  if(href===cover)return new Response(image,{headers:{'content-type':'image/png'}});
  if(href===url) {
   const extra='<a href="/unexpected-missing">Unexpected</a>';
   const html=`<html><head><title>Guide</title><link rel="canonical" href="${url}"/><meta name="description" content="Guide"/><meta property="og:image" content="${cover}"/></head><body><h1>Guide</h1><nav><a href="/nav-missing">Navigation</a></nav><div id="article-body"><a href="/wiki/game">Hub</a>${field==='body'?extra:''}</div><div class="content-faq-answer">${field==='faq'?extra:''}</div></body></html>`;
   const response=new Response(html);Object.defineProperty(response,'url',{value:href});return response;
  }
  assert.equal(init?.redirect,'manual');
  if(href==='https://bloxodes.com/wiki/game')return new Response(null,{status:200});
  if(href==='https://bloxodes.com/unexpected-missing')return new Response(null,{status:broken?404:200});
  throw new Error(`Unexpected fetch: ${href}`);
 };
 try {
  const final={slug:'rendered-links',title:'Guide',content_md:'[Hub](/wiki/game)'};
  await assert.rejects(verifyArticleLive(final,cover),/unexpected-missing.*HTTP 404/);
  assert.ok(requests.includes('https://bloxodes.com/wiki/game'));
  assert.ok(requests.includes('https://bloxodes.com/unexpected-missing'));
  assert.ok(!requests.includes('https://bloxodes.com/nav-missing'));
  broken=false;await verifyArticleLive(final,cover);
 }finally{globalThis.fetch=originalFetch;}
});
test("internal links on HTTP, www and other protocols fail with the root-relative replacement",async()=>{
 for(const href of ['http://bloxodes.com/wiki/game?tab=items#part','http://www.bloxodes.com/wiki/game','https://www.bloxodes.com/wiki/game','ftp://bloxodes.com/wiki/game','//www.bloxodes.com/wiki/game']) {
  const markdown=`[Hub](${href})`;assert.equal(internalArticleLinks(markdown).length,1,href);
  const result=await checkArticleLinks({slug:'self',content_md:markdown},{universeId:1},{status:async()=>{throw new Error('Non-canonical URLs must fail before fetching.');}});
  assert.equal(result.errors.length,1,href);assert.match(result.errors[0],/Non-canonical.*Use the root-relative path \/wiki\/game/);
 }
 for(const href of ['/wiki/game','https://bloxodes.com/wiki/game']) {
  const result=await checkArticleLinks({slug:'self',content_md:`[Hub](${href})`},{universeId:1},{status:async()=>({status:200,location:null})});
  assert.deepEqual(result.errors,[]);
 }
});
test("strips only inline link markup, preserving text bytes, formatting and images",()=>{
 for(const text of ['plain words','## Header **bold words**','- plain words','A [bracket] word','row | words']) {
 const linked=text.replace('words','[words](/wiki/example)');assert.equal(stripArticleLinkMarkup(linked),text);
 }
 const image='![cover](/image.webp)';assert.equal(stripArticleLinkMarkup(image),image);
 assert.equal(stripArticleLinkMarkup('[**bold words**](https://example.com/a_(b))'),'**bold words**');
});
test("verify unchanged compares every field including whitespace, arrays, FAQ and absent values",()=>{
 const before={content_md:'Read these words.\n',faq_json:[{q:'A?',a:'Read words.'}],tags:['x'],author:null};
 const after={...before,content_md:'Read [these words](/wiki/game).\n',faq_json:[{q:'A?',a:'Read [words.](/wiki/game)'}]};
 assert.doesNotThrow(()=>assertArticleLinksOnlyChange(before,after));
 for(const changed of [{...after,content_md:after.content_md+' '},{...after,tags:['y']},{...after,author:'new'},{...after,newField:null}])assert.throws(()=>assertArticleLinksOnlyChange(before,changed));
 assert.throws(()=>assertArticleLinksOnlyChange({content_md:'plain'},{content_md:'![plain](/image)'}));
});
test("link check rejects redirects, missing pages, self links and zero links with related pages",async()=>{
 const scope={universeId:1};const status=async(url:string)=>({status:url.endsWith('/redirect')?301:url.endsWith('/missing')?404:200,location:url.endsWith('/redirect')?'/target':null});
 const related=async()=>[{title:'Hub',page_type:'wiki',url:'https://bloxodes.com/wiki/game'}];
 const failed=await checkArticleLinks({slug:'self',content_md:'[redirect](/redirect) [missing](/missing) [self](/articles/self#part)'},scope,{status,related});
 assert.equal(failed.errors.length,3);assert.ok(failed.errors.some(e=>e.includes('301')&&e.includes('Location: /target')));
 assert.equal((await checkArticleLinks({slug:'self',content_md:'Text'},scope,{status,related})).errors.length,1);
 assert.equal((await checkArticleLinks({slug:'self',content_md:'Text'},scope,{status,related:async()=>[]})).errors.length,0);
 const good=await checkArticleLinks({slug:'self',content_md:Array.from({length:6},(_,i)=>`[page](/page-${i})`).join(' ')},scope,{status,related});
 assert.equal(good.errors.length,0);assert.equal(good.warnings.length,1);
});
test("link repairs require exact live baseline and preserve metadata",()=>{
 const live={id:'id',slug:'game-guide',title:'Game guide',content_md:'Read the guide.',meta_description:null,cover_image:'https://example.com/cover.webp',author_id:'735b1448-9cd8-4d92-96b3-1081ae5bdfcc',published_at:'2026-11-01',universe_id:1,tags:[],sources:[],faq_json:[],is_published:true};
 const before=liveArticleFinal(live);const after={...before,content_md:'Read the [guide](/wiki/game).'};
 assert.doesNotThrow(()=>assertLinkRepair(live,before,after));
 assert.throws(()=>assertLinkRepair({...live,content_md:'Owner edit.'},before,after));
 assert.throws(()=>assertLinkRepair(live,before,{...after,cover_image:'https://example.com/new.webp'}));
});

test("source URLs and image captions do not satisfy the body link requirement",async()=>{
 const r=await checkArticleLinks({slug:'self',content_md:'![Image](/images/game.webp)',sources:['https://bloxodes.com/codes/game']},{universeId:1},{related:async()=>[{title:'Hub',page_type:'wiki',url:'https://bloxodes.com/wiki/game'}]});
 assert.equal(r.count,0);assert.equal(r.errors.length,1);
});

test("production status requests never follow redirects",async()=>{
 let redirect:RequestRedirect|undefined;
 const request:typeof fetch=async(_input,init)=>{redirect=init?.redirect;return new Response(null,{status:301,headers:{location:'/new'}});};
 const result=await directProductionStatus('https://bloxodes.com/old',request);
 assert.equal(redirect,'manual');assert.deepEqual(result,{status:301,location:'/new'});
});
test("related pages order hubs, codes, collections and at most 15 newest articles",()=>{
 const pages=Array.from({length:20},(_,i)=>({title:`Article ${i}`,page_type:'article',url:`https://bloxodes.com/articles/slug-${i}`,published_at:`2026-11-${String(i+1).padStart(2,'0')}`}));
 pages.push(...['collection','codes','wiki'].map(t=>({title:t,page_type:t,url:`https://bloxodes.com/${t}/game`,published_at:''})));
 const sorted=orderRelatedPages(pages,'slug-19');assert.deepEqual(sorted.slice(0,3).map(p=>p.page_type),['wiki','codes','collection']);assert.equal(sorted.length,18);assert.equal(sorted[3].url,'https://bloxodes.com/articles/slug-18');
});
test("repeated links in table cells count separately",()=>{
 const md='| A | B |\n|---|---|\n'+Array.from({length:3},()=> '| [Hub](/wiki/game) | [Hub](/wiki/game) |').join('\n');
 assert.equal(internalArticleLinks(md).length,6);
});

test("production link requests keep redirects visible",async()=>{
 let init:RequestInit|undefined;
 const status=await directProductionStatus('https://bloxodes.com/old',async(_url,options)=>{init=options;return new Response('',{status:308,headers:{location:'/new'}});});
 assert.equal(init?.redirect,'manual');assert.equal(status.status,308);assert.equal(status.location,'/new');
});

test("multiline lists and quotes validate all links and preserve exact repair bytes",async()=>{
 for(const before of [
  '- First line\n  Read the guide.\n  Keep this line.\n',
  '> First line\n> Read the guide.\n> Keep this line.\n',
  '> - First line\n>   Read the guide.\n>   Keep this line.\n',
  '1. First line\n   Read the guide.\n\n   - Read the guide.\n     Keep this line.\n',
  '> Read these\n> words here.\n',
  '> Read these\r\n> words here.\r\n',
  '- First line\n  Read the guide.\n\n- First line\nRead the guide.\n',
 ]) {
  const after=before.replaceAll('the guide','[the guide](/missing)').replace('these','[these').replace('words here','words here](/missing)');
  assert.equal(stripArticleLinkMarkup(after),before,after);
  assert.doesNotThrow(()=>assertArticleLinksOnlyChange({content_md:before},{content_md:after}));
  const result=await checkArticleLinks({slug:'self',content_md:'[Hub](/wiki/game)\n\n'+after},{universeId:1},{status:async url=>({status:url.endsWith('/missing')?404:200,location:null})});
  assert.ok(result.errors.some(e=>e.includes('/missing')&&e.includes('404')),after);
 }
 const repeated='> words\n> [words](/wiki/game)\n> words\n';
 assert.equal(stripArticleLinkMarkup(repeated),'> words\n> words\n> words\n');
 assert.throws(()=>assertArticleLinksOnlyChange({content_md:'> words\n> words\n'},{content_md:'> words\n [words](/wiki/game)\n'}));
});

test("FAQ questions are immutable plain text and cannot satisfy the link requirement",async()=>{
 const before={slug:'self',content_md:'Text.',faq_json:[{q:'Where is the guide?',a:'Read the guide.'}]};
 const question={...before,faq_json:[{q:'Where is [the guide](/wiki/game)?',a:'Read the guide.'}]};
 assert.throws(()=>assertArticleLinksOnlyChange(before,question),/faq_json\[0\].q/);
 const result=await checkArticleLinks(question,{universeId:1},{related:async()=>[{title:'Hub',page_type:'wiki',url:'https://bloxodes.com/wiki/game'}]});
 assert.equal(result.count,0);assert.equal(result.errors.length,1);
 assert.doesNotThrow(()=>assertArticleLinksOnlyChange(before,{...before,faq_json:[{q:before.faq_json[0].q,a:'Read [the guide](/wiki/game).'}]}));
});

test("transient status and transport failures retry, while redirects and missing pages stay definitive",async()=>{
 for(const failures of [[503,429],[0,502]]) {
  let calls=0;
  const result=await directProductionStatus('https://bloxodes.com/wiki/game',async()=>{
   const status=failures[calls++]??200;if(!status)throw new Error('socket reset');return new Response(null,{status});
  },{backoffMs:0});
  assert.equal(result.status,200);assert.equal(calls,3);
 }
 for(const status of [301,308,404,410]) {
  let calls=0;assert.equal((await directProductionStatus('https://bloxodes.com/wiki/game',async()=>{calls++;return new Response(null,{status});},{backoffMs:0})).status,status);assert.equal(calls,1);
 }
});

test("uncertain related and direct link status fail as availability errors",async()=>{
 const url='https://bloxodes.com/wiki/game';let calls=0;
 const status=()=>directProductionStatus(url,async()=>{calls++;return new Response(null,{status:503});},{backoffMs:0});
 const related=()=>relatedArticlePages({universeId:1},undefined,{candidates:[{title:'Hub',page_type:'wiki',url}],status});
 await assert.rejects(checkArticleLinks({slug:'self',content_md:'No links.'},{universeId:1},{related}),/Couldn't verify.*503.*try again.*availability/);
 assert.equal(calls,3);calls=0;
 await assert.rejects(checkArticleLinks({slug:'self',content_md:'[Hub](/wiki/game)'},{universeId:1},{status}),/Couldn't verify.*try again.*availability/);
 assert.equal(calls,3);
});

function repairFixture(kind:'game'|'roblox'='game') {
 const owner={id:'game-id',namespace:'gta',slug:'gta-6',kind:'game',parent_id:null,is_published:true};
 const row:any={id:'article-id',slug:'gta-6-test',title:'GTA 6 test',content_md:'Read the GTA 6 guide.',meta_description:'A guide.',
  author_id:'735b1448-9cd8-4d92-96b3-1081ae5bdfcc',published_at:'2026-11-05T00:00:00Z',cover_image:'https://example.com/cover.webp',
  tags:[],faq_json:[{q:'Where to start?',a:'Read the guide.'}],is_published:true,updated_at:'2026-11-06T00:00:00Z',
  ...(kind==='game'?{namespace:'gta',game_id:owner.id,seo_title:null,sources_json:[]}:{universe_id:1,sources:[]})};
 const writes:any[]=[];let race=false;
 const db:any={from(table:string){
  let patch:any;const filters:Record<string,any>={};
  const result=(optional=false)=>{
   const data=table==='games'?owner:table===(kind==='game'?'game_article_pages':'articles')?row:null;
   if(patch&&race)row.updated_at='2026-11-07T00:00:00Z';
   const match=data&&Object.entries(filters).every(([k,v])=>(data as any)[k]===v);
   if(!match)return {data:null,error:optional?null:new Error('Optimistic condition no longer matches')};
   if(patch){writes.push({table,patch:structuredClone(patch),filters:{...filters}});Object.assign(row,patch,{updated_at:'2026-11-08T00:00:00Z'});}
   return {data:structuredClone(data),error:null};
  };
  const q:any={select(){return q;},eq(k:string,v:any){filters[k]=v;return q;},update(value:any){patch=value;return q;},maybeSingle:async()=>result(true),single:async()=>result()};return q;
 }};
 const events:any[]=[],verified:any[]=[];
 const dependencies={db,guard:async()=>'',checkLinks:async(final:any,scope:any)=>{
  assert.deepEqual(scope,kind==='game'?{namespace:'gta',gameSlug:'gta-6',kind:'game'}:{universeId:1});
  return checkArticleLinks(final,scope,{status:async()=>({status:200,location:null}),related:async()=>[]});
 },revalidate:async(_env:any,batch:any)=>{events.push(...batch);},verify:async(final:any,bundle:any)=>{verified.push({final,bundle});}};
 return {row,owner,db,writes,events,verified,dependencies,race:()=>{race=true;}};
}
async function repairWorkspace(kind:'game'|'roblox'='game',paginated=false) {
 await fs.mkdir('tmp/article-links-tests',{recursive:true});
 const root=await fs.mkdtemp(path.resolve('tmp/article-links-tests/run-'));const folder=path.join(root,'repair');
 const f=repairFixture(kind);
 if(paginated)f.row.content_md+='\n\n```article-page-break\nschema: 1\nid: second-page\n```\n\nRead the second guide.';
 const bundle=await prepareArticleLinkRepair(f.row.slug,folder,f.db);
 const before=JSON.parse(await fs.readFile(path.join(folder,'before.json'),'utf8'));
 const final={...before,content_md:before.content_md.replace('GTA 6','[GTA 6](/wiki/gta/gta-6)')};
 await fs.writeFile(path.join(folder,'final.json'),JSON.stringify(final));
 const options={command:'publish' as const,target:'production' as const,bundle:folder,updatePublished:true,apply:true,allowProd:true};
 return {...f,root,folder,bundle,before,final,options};
}

for(const kind of ['roblox','game'] as const)test(`repair prepares, applies and verifies ${kind} articles with exact identity and write conditions`,async()=>{
 const f=await repairWorkspace(kind);const secret=process.env.REVALIDATE_SECRET;process.env.REVALIDATE_SECRET='test-only';
 try {
  assert.equal(f.bundle.articleKind,kind);
  assert.equal(f.bundle.beforeSha256,createHash('sha256').update(await fs.readFile(path.join(f.folder,'before.json'))).digest('hex'));
  if(f.bundle.articleKind==='game')assert.deepEqual(f.bundle.game,{slug:'gta-6',kind:'game'});
  await assert.rejects(prepareArticleLinkRepair(f.row.slug,f.folder,f.db),/EEXIST/);
  await publishArticleLinkRepair({...f.options,apply:false,allowProd:false},f.dependencies);assert.equal(f.writes.length,0);
  await publishArticleLinkRepair(f.options,f.dependencies);
  assert.equal(f.writes.length,1);const write=f.writes[0];
  assert.equal(write.table,kind==='game'?'game_article_pages':'articles');
  assert.deepEqual(Object.keys(write.patch).sort(),['content_md','faq_json']);
  assert.equal(write.filters.updated_at,'2026-11-06T00:00:00Z');
  assert.equal(write.filters.id,'article-id');
  if(kind==='game'){assert.equal(write.filters.namespace,'gta');assert.equal(write.filters.game_id,'game-id');}
  for(const field of ['id','namespace','game_id','author_id','published_at','cover_image'])assert.equal(f.row[field],f.before[field]);
  assert.deepEqual(f.events,[{type:kind==='game'?'game_content':'article',slug:kind==='game'?`articles/${f.row.slug}`:f.row.slug}]);
  assert.equal(f.verified.length,1);
  await publishArticleLinkRepair(f.options,f.dependencies);assert.equal(f.writes.length,1);assert.equal(f.verified.length,2);
 }finally{if(secret===undefined)delete process.env.REVALIDATE_SECRET;else process.env.REVALIDATE_SECRET=secret;await fs.rm(f.root,{recursive:true,force:true});}
});

for(const kind of ['roblox','game'] as const)for(const scenario of ['stale-then-fresh','missing-body','wrong-text','wrong-destination','missing-second-page','missing-faq'] as const)
test(`repair ${kind} requires rendered body and FAQ anchors on every page: ${scenario}`,async()=>{
 const f=await repairWorkspace(kind,true);const originalFetch=globalThis.fetch;
 const secret=process.env.REVALIDATE_SECRET;process.env.REVALIDATE_SECRET='test-only';
 const requests=new Map<number,number>();
 const image=await sharp({create:{width:8,height:8,channels:3,background:'red'}}).png().toBuffer();
 try {
  const final={...f.final,content_md:f.final.content_md.replace('second guide','[second guide](/articles/gta-6-second)'),faq_json:[{q:f.before.faq_json[0].q,a:'Read [the guide](/codes/gta-6).'}]};
  await fs.writeFile(path.join(f.folder,'final.json'),JSON.stringify(final));
  globalThis.fetch=async(input,init)=>{
   const url=new URL(String(input));
   if(url.href===f.row.cover_image)return new Response(image,{headers:{'content-type':'image/png'}});
   if(['/wiki/gta/gta-6','/articles/gta-6-second','/codes/gta-6'].includes(url.pathname)) {
    assert.equal(init?.redirect,'manual');return new Response(null,{status:200});
   }
   assert.ok(url.pathname===`/articles/${f.row.slug}`||url.pathname===`/articles/${f.row.slug}/page/2`,url.href);
   assert.equal(init?.cache,'no-store');
   const page=url.pathname.endsWith('/2')?2:1;const count=(requests.get(page)??0)+1;requests.set(page,count);
   assert.equal(f.events.length,1,'Live page fetch must follow revalidation.');
   const stale=scenario==='stale-then-fresh'&&count<3;
   const bodyLink=page===1?'<a href="/wiki/gta/gta-6">GTA 6</a>':'<a href="/articles/gta-6-second">second guide</a>';
   let body=`<p>Read the ${bodyLink} guide.</p>`;
   if(stale||scenario==='missing-body'&&page===1||scenario==='missing-second-page'&&page===2)body='<p>Old body without links.</p>';
   if(scenario==='wrong-text'&&page===1)body=body.replace('>GTA 6<','>Another title<');
   if(scenario==='wrong-destination'&&page===1)body=body.replace('/wiki/gta/gta-6','/wiki/wrong-game');
   const faq=page===2?`<div class="content-faq-answer">Read ${stale||scenario==='missing-faq'?'the guide':'<a href="/codes/gta-6">the guide</a>'}.</div>`:'';
   const html=`<html><head><title>${f.row.title}</title><link rel="canonical" href="${url.href}"/><meta name="description" content="Guide"/><meta property="og:image" content="${f.row.cover_image}"/></head><body><h1>${f.row.title}</h1><nav>${bodyLink}<a href="/codes/gta-6">the guide</a></nav><section id="article-body">${body}</section>${faq}</body></html>`;
   const response=new Response(html,{headers:{'content-type':'text/html'}});Object.defineProperty(response,'url',{value:url.href});return response;
  };
  const {verify:_stub,...dependencies}=f.dependencies;
  const publish=()=>publishArticleLinkRepair(f.options,dependencies);
  if(scenario==='stale-then-fresh') {
   await publish();assert.deepEqual([...requests],[[1,3],[2,3]]);
  }else {
   await assert.rejects(publish,/missing rendered internal links.*Still missing after 3 cache-refresh attempts/);
   assert.equal(requests.get(scenario==='missing-second-page'||scenario==='missing-faq'?2:1),3);
  }
  assert.equal(f.writes.length,1);
 }finally{globalThis.fetch=originalFetch;if(secret===undefined)delete process.env.REVALIDATE_SECRET;else process.env.REVALIDATE_SECRET=secret;await fs.rm(f.root,{recursive:true,force:true});}
});

test('repair rejects modified baseline, metadata, game identity and FAQ questions',async()=>{
 const f=await repairWorkspace();
 try {
  for(const change of [{author_id:'11111111-1111-4111-8111-111111111111'},{namespace:'other'},{game_id:'other'},{published_at:'2025-01-01'},{cover_image:'https://example.com/new.webp'},{faq_json:[{q:'[Where](/wiki/gta/gta-6) to start?',a:'Read the guide.'}]}]) {
   await fs.writeFile(path.join(f.folder,'final.json'),JSON.stringify({...f.final,...change}));
   await assert.rejects(publishArticleLinkRepair(f.options,f.dependencies),/Non-link change/);
  }
  await fs.writeFile(path.join(f.folder,'final.json'),JSON.stringify(f.final));
  for(const field of ['author_id','published_at','cover_image']){
   const original=f.row[field];f.row[field]=field==='author_id'?'11111111-1111-4111-8111-111111111111':field==='cover_image'?'https://example.com/new.webp':'2025-01-01';
   await assert.rejects(publishArticleLinkRepair(f.options,f.dependencies),/Non-link change/);f.row[field]=original;
  }
  const original=f.owner.slug;f.owner.slug='wrong-game';
  await assert.rejects(publishArticleLinkRepair(f.options,f.dependencies),/Optimistic condition/);f.owner.slug=original;
  await fs.appendFile(path.join(f.folder,'before.json'),' ');
  await assert.rejects(publishArticleLinkRepair(f.options,f.dependencies),/baseline hash differs/);
  assert.equal(f.writes.length,0);
 }finally{await fs.rm(f.root,{recursive:true,force:true});}
});

test('repair rejects an occupied publication lock and concurrent updated_at changes',async()=>{
 const f=await repairWorkspace();const secret=process.env.REVALIDATE_SECRET;process.env.REVALIDATE_SECRET='test-only';
 try {
  const unlock=await acquireAgentWorkLock(path.resolve('tmp/content-publish/article'),'repair-test');assert.ok(unlock);
  try{await assert.rejects(publishArticleLinkRepair(f.options,f.dependencies),/publication is busy/);}finally{await unlock();}
  f.race();await assert.rejects(publishArticleLinkRepair(f.options,f.dependencies),/Optimistic condition/);
  assert.equal(f.writes.length,0);assert.equal(f.events.length,0);assert.equal(f.verified.length,0);
 }finally{if(secret===undefined)delete process.env.REVALIDATE_SECRET;else process.env.REVALIDATE_SECRET=secret;await fs.rm(f.root,{recursive:true,force:true});}
});

test('game repair contracts require explicit kind and complete game identity',()=>{
 const base={contract:'article-links@1',slug:'test',finalJson:'final.json',beforeJson:'before.json',beforeSha256:'a'.repeat(64)};
 assert.equal(articleLinkRepairBundleSchema.safeParse(base).success,false);
 assert.equal(articleLinkRepairBundleSchema.safeParse({...base,articleKind:'game'}).success,false);
 assert.ok(articleLinkRepairBundleSchema.parse({...base,articleKind:'roblox'}));
 assert.ok(articleLinkRepairBundleSchema.parse({...base,articleKind:'game',namespace:'gta',game:{slug:'gta-6',kind:'game'}}));
});

test('repair baselines preserve FAQ question and answer whitespace exactly',()=>{
 const f=repairFixture();f.row.faq_json=[{q:'  Where to start?  ',a:'  Read the guide.  '}];
 const before=liveArticleFinal(f.row,'game');assert.deepEqual(before.faq_json,f.row.faq_json);
 assert.throws(()=>assertLinkRepair(f.row,before,{...before,faq_json:[{q:'Where to start?',a:'  Read the guide.  '}]},'game'),/Non-link change/);
 assert.doesNotThrow(()=>assertLinkRepair(f.row,before,{...before,faq_json:[{q:'  Where to start?  ',a:'  Read [the guide](/wiki/gta/gta-6).  '}]},'game'));
});

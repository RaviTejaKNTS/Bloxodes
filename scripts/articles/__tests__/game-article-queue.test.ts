import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { articleQueueProperties, articleQueueBody, articleQueueBodyData, articleQueueFromPage, GAME_ARTICLE_QUEUE as config, ROBLOX_ARTICLE_QUEUE, NotionArticleQueue, duplicateQueueRow, queueBodyNotes } from "../notion-article-queue";
import { runQueueUpdate } from "../update-article-queue-item";
import { setTimeout as delay } from "node:timers/promises";
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { withArticleQueueClaimLock } from "../article-queue-claim";
import { parseGameQueueAdd, selectGameQueueRows } from "../game-article-queue";
const page=(row:any={},blocks:any[]=[],queueConfig=config)=>({id:randomUUID(),properties:articleQueueProperties(row,queueConfig),created_time:"2026-11-15T00:00:00.000Z",last_edited_time:"2026-11-15T00:00:00.000Z",in_trash:false,parent:{data_source_id:queueConfig.source},blocks});
function fixture(queueConfig=config){
 const config=queueConfig;
 const pages=new Map<string,any>();
 const api={async call(route:string,method="GET",body?:any):Promise<any>{
  if(route===`data_sources/${config.source}`){const properties:any=Object.fromEntries(Object.entries(articleQueueProperties({article_title:"",status:"pending",article_type:"guide",...Object.fromEntries([...Object.keys(config.textFields),...Object.keys(config.dateFields),...Object.keys(config.numberFields),...Object.keys(config.urlFields),...Object.keys(config.selectFields)].map(k=>[k,null]))},config)).map(([k,v]:any)=>[k,{type:Object.keys(v)[0]}]));properties.Status.select={options:config.statuses.map(name=>({name:name[0].toUpperCase()+name.slice(1)}))};properties.Type.select={options:config.types.map(name=>({name}))};return {parent:{database_id:config.database},properties};}
  if(route.endsWith('/query'))return {results:[...pages.values()],has_more:false};
  const id=route.split('/')[1];const p=pages.get(id);
  if(route.startsWith('pages/')){if(method==='PATCH')Object.assign(p.properties,body.properties);return p;}
  if(route.includes('/children')){if(method==='PATCH')p.blocks.push(...body.children.map((b:any)=>({...b,id:randomUUID()})));return {results:p.blocks.filter((b:any)=>!b.in_trash),has_more:false};}
  if(route.startsWith('blocks/')){for(const p of pages.values())for(const b of p.blocks)if(b.id===id)b.in_trash=true;return {};}
  throw new Error(route);
 },async callCreate(body:any){const p=page({},[],config);p.properties=body.properties;p.blocks=body.children.map((b:any)=>({...b,id:randomUUID()}));pages.set(p.id,p);return p;}};
 return {queue:new NotionArticleQueue(api,config.source,config.database,config),pages,api};
}
test("game schema has only its own columns, statuses, types and marker",async()=>{
 const f=fixture();await f.queue.validate();
 const props=articleQueueProperties({article_title:'GTA 6',status:'pending',article_type:'news',universe_id:2,event_id:'e',game:'GTA 6',added_by:'owner',game_kind:'game'},config);
 assert.equal(props['Universe ID'],undefined);assert.equal(props['Event ID'],undefined);assert.equal(props['Added by'].select.name,'Owner');
 assert.throws(()=>articleQueueProperties({status:'failed'},config));
 assert.throws(()=>articleQueueProperties({article_type:'listicle'},config));
 const blocks=articleQueueBody({article_title:'GTA 6'},'g',config);
 assert.deepEqual(articleQueueBodyData(blocks,null,config),{article_title:'GTA 6'});assert.deepEqual(articleQueueBodyData(blocks,null,ROBLOX_ARTICLE_QUEUE),{});
});
test("manual owner row with empty status, Added by, Type and no JSON returns notes",async()=>{
 const f=fixture();const blocks=[{id:randomUUID(),type:'paragraph',paragraph:{rich_text:[{plain_text:'Write about frame rates.'}]}}];const p=page({article_title:'GTA 6 frame rate',game:'GTA 6'},blocks);f.pages.set(p.id,p);
 const row=await f.queue.get(p.id);assert.equal(row.status,'pending');assert.equal(row.added_by,'owner');assert.equal(row.article_type,null);assert.equal(row.notes,'Write about frame rates.');
 const claimed=await f.queue.update(p.id,{status:'processing',namespace:'gta',game_slug:'gta-6',game_kind:'game',last_attempted_at:'2026-11-16',locked_at:'2026-11-15T00:00:00.000Z'},{status:'pending'});
 assert.equal(claimed.notes,'Write about frame rates.');assert.equal(claimed.namespace,'gta');assert.equal(await f.queue.recoverClaims([claimed],Date.parse('2026-11-16')),1);assert.equal((await f.queue.get(p.id)).status,'pending');
});
test("game duplicate races reconcile and different games stay separate",async()=>{
 const f=fixture();const payload={article_title:'How to Farm Pearls',game:'Game A',namespace:'test',game_slug:'game-a',game_kind:'game',status:'pending'};
 const a=await f.queue.create(payload);await f.queue.create({...payload,article_title:'How to Obtain Pearls'});const rows=await f.queue.list();assert.equal(await f.queue.reconcileDuplicates(rows),1);
 assert.equal(duplicateQueueRow([a],{...payload,namespace:'other',game_slug:'game-b'}),null);
 const manual=articleQueueFromPage(page({article_title:'How to Farm Pearls',game:'Game A'}),{},config);assert.equal(duplicateQueueRow([manual],payload)?.id,manual.id);
});
test("game queue add parses claims and news without Roblox-only fields",()=>{
 const options=parseGameQueueAdd(['--title','GTA 6 transport tips','--game','GTA 6','--namespace','gta','--game-slug','gta-6','--kind','game','--type','news','--source-url','https://example.com','--reason','A topic','--claim','--worker','test']);
 assert.match(options.row.locked_by!,/^test#[a-f0-9-]{36}$/);assert.equal(options.row.status,'processing');assert.equal(options.row.added_by,'agent');assert.equal('universe_id' in options.row,false);
});
test("game queue listing selects owner rows before limiting and sorts each group oldest first",async()=>{
 const f=fixture();
 for(let day=1;day<=11;day++) {
  const p=page({article_title:`Topic ${day}`,added_by:day===11?'owner':'agent',status:'pending'});
  p.created_time=`2026-11-${String(day).padStart(2,'0')}T00:00:00.000Z`;f.pages.set(p.id,p);
 }
 const rows=await f.queue.list();
 const selected=selectGameQueueRows([...rows].reverse(),'pending',10);
 assert.equal(selected.length,10);assert.equal(selected[0].added_by,'owner');assert.equal(selected[0].article_title,'Topic 11');
 assert.deepEqual(selected.slice(1).map(r=>r.article_title),Array.from({length:9},(_,i)=>`Topic ${i+1}`));
 const olderOwner={...selected[0],id:'older-owner',created_at:'2026-11-10T00:00:00.000Z',notion_created_at:'2026-11-10T00:00:00.000Z'};
 assert.deepEqual(selectGameQueueRows([...rows,olderOwner],'pending',2).map(r=>r.id),['older-owner',selected[0].id]);
});

test("Notion minute date precision passes exact property readback",async()=>{
 const f=fixture();const p=page({article_title:'Test',game:'Game'});f.pages.set(p.id,p);
 const saved=await f.queue.update(p.id,{status:'skipped',completed_at:'2026-11-16T11:25:19.345Z'});
 assert.equal(saved.completed_at,'2026-11-16T11:25:00.000Z');
});
test("a failed first snapshot on an owner row does not replace owner notes or expose evidence",async()=>{
 const f=fixture();const p=page({article_title:'Test',game:'Game'},[{id:randomUUID(),type:'paragraph',paragraph:{rich_text:[{plain_text:'Keep these owner notes.'}]}}]);f.pages.set(p.id,p);
 const call=f.api.call.bind(f.api);let patches=0;
 f.api.call=async(route:string,method='GET',body?:any)=>{if(route===`pages/${p.id}`&&method==='PATCH'&&++patches===2)throw new Error('failed');return call(route,method,body);};
 await assert.rejects(f.queue.update(p.id,{status:'processing',source_metadata:{never:'committed'}}),/failed/);
 const row=await f.queue.get(p.id);assert.equal(row.status,'pending');assert.deepEqual(row.source_metadata,{});assert.equal(row.notes,'Keep these owner notes.');
});

for(const gameQueue of [false,true]) test(`concurrent ${gameQueue?'game':'Roblox'} claims serialize against an API with interleaved writes`,async()=>{
 const f=fixture();const p=page({article_title:'Claim race',game:'GTA 6',namespace:'gta',game_slug:'gta-6',game_kind:'game',status:'pending'});f.pages.set(p.id,p);
 const call=f.api.call.bind(f.api);const writes:string[]=[];
 f.api.call=async(route,method='GET',body)=>{
  if(route===`pages/${p.id}`&&method==='PATCH'&&body.properties.Worker) {
   const token=body.properties.Worker.rich_text.map((t:any)=>t.text.content).join('');
   writes.push(token);await delay(25);
  }
  return call(route,method,body);
 };
 const claim=(worker:string)=>runQueueUpdate(['--queue-id',p.id,'--status','processing','--worker',worker,'--apply'],gameQueue,{queue:f.queue});
 const results=await Promise.allSettled([claim('worker-a'),claim('worker-b')]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 assert.equal(results.filter(r=>r.status==='rejected').length,1);
 assert.equal(writes.length,1);
 const row=await f.queue.get(p.id);assert.match(row.locked_by!,/^worker-[ab]#[a-f0-9-]{36}$/);assert.equal(row.attempts,1);
 // Even another process using the same worker name cannot reuse an active claim.
 await assert.rejects(claim(row.locked_by!.split('#')[0]),/active claim/);
 const folder=await fs.mkdtemp(path.resolve('tmp/claim-output-'));
 try {
  const file=path.join(folder,'final.json');await fs.writeFile(file,JSON.stringify({slug:'claim-race'}));
  const complete=['--queue-id',p.id,'--status','completed','--result-path',file,'--apply'];
  await assert.rejects(runQueueUpdate(complete,gameQueue,{queue:f.queue}),/requires --claim-token/);
  await assert.rejects(runQueueUpdate([...complete,'--claim-token','worker-wrong#token'],gameQueue,{queue:f.queue}),/Claim ownership differs/);
  await runQueueUpdate([...complete,'--claim-token',row.locked_by!],gameQueue,{queue:f.queue});
  await runQueueUpdate([...complete,'--claim-token',row.locked_by!],gameQueue,{queue:f.queue});
  assert.equal((await f.queue.get(p.id)).status,'completed');
 }finally{await fs.rm(folder,{recursive:true,force:true});}
});

test('expired claims can be reclaimed, and remote claim replacement fails confirmation',async()=>{
 const f=fixture();const p=page({article_title:'Old claim',namespace:'gta',game_slug:'gta-6',game_kind:'game',status:'processing',locked_by:'expired#old',locked_at:'2000-01-01'});f.pages.set(p.id,p);
 const argv=['--queue-id',p.id,'--status','processing','--worker','new-worker','--apply'];
 await runQueueUpdate(argv,true,{queue:f.queue,settle:async()=>{}});
 const row=await f.queue.get(p.id);assert.match(row.locked_by!,/^new-worker#/);
 await f.queue.update(p.id,{status:'pending',locked_at:null,locked_by:null});
 await assert.rejects(runQueueUpdate(argv,true,{queue:f.queue,settle:async()=>{await f.queue.update(p.id,{locked_by:'remote#replacement'});}}),/Claim ownership differs/);
 await f.queue.update(p.id,{status:'pending',locked_at:null,locked_by:null});
 await assert.rejects(runQueueUpdate(argv,true,{queue:f.queue,settle:async()=>{await f.queue.update(p.id,{locked_at:'2000-01-01'});}}),/Claim was replaced/);
});

test('the kernel releases a queue lock when its owner process is killed',async()=>{
 const child=spawn(process.execPath,['--import','tsx','-e',`require('./scripts/articles/article-queue-claim.ts').withArticleQueueClaimLock(async()=>{console.log('LOCKED');setInterval(()=>{},1000);await new Promise(()=>{});}).catch(error=>{console.error(error.message);process.exit(1);})`],{stdio:['ignore','pipe','pipe']});
 const exited=new Promise<void>((resolve,reject)=>{child.once('exit',()=>resolve());child.once('error',reject);});
 try {
  await Promise.race([new Promise<void>(resolve=>child.stdout.once('data',()=>resolve())),exited.then(()=>{throw new Error('Lock owner exited before acquiring');})]);
  child.kill('SIGKILL');await exited;
  assert.equal(await withArticleQueueClaimLock(async()=>'released'),'released');
 }finally{child.kill('SIGKILL');await exited;}
});

for(const gameQueue of [false,true]) for(const status of ['blocked','skipped',...(!gameQueue?['failed']:[])])
test(`${gameQueue?'game':'Roblox'} processing -> ${status} requires the current claim token`,async()=>{
 const queueConfig=gameQueue?config:ROBLOX_ARTICLE_QUEUE;
 const f=fixture(queueConfig);
 const p=page({article_title:'Claim ownership',status:'processing',locked_by:'new-worker#new-token',locked_at:new Date().toISOString()},[],queueConfig);f.pages.set(p.id,p);
 const before=await f.queue.get(p.id);
 const argv=['--queue-id',p.id,'--status',status,'--reason','Worker stopped','--apply'];
 for(const token of [undefined,'old-worker#old-token']) {
  await assert.rejects(runQueueUpdate([...argv,...(token?['--claim-token',token]:[])],gameQueue,{queue:f.queue}),/Claim ownership differs|requires --claim-token/);
  assert.deepEqual(await f.queue.get(p.id),before);
 }
 // Expiry permits a fresh processing claim, never an unowned cancellation.
 await f.queue.update(p.id,{locked_at:'2000-01-01'});
 await assert.rejects(runQueueUpdate(argv,gameQueue,{queue:f.queue}),/Claim ownership differs|requires --claim-token/);
 await runQueueUpdate([...argv,'--claim-token',before.locked_by!],gameQueue,{queue:f.queue});
 const saved=await f.queue.get(p.id);assert.equal(saved.status,status);assert.equal(saved.locked_by,null);
});

for(const gameQueue of [false,true])test(`${gameQueue?'game':'Roblox'} pending skips and curation recovery need no token`,async()=>{
 const queueConfig=gameQueue?config:ROBLOX_ARTICLE_QUEUE;const f=fixture(queueConfig);
 const pending=await f.queue.create({article_title:'Unneeded topic',status:'pending'});
 await runQueueUpdate(['--queue-id',pending.id,'--status','skipped','--reason','No longer needed','--apply'],gameQueue,{queue:f.queue});
 assert.equal((await f.queue.get(pending.id)).status,'skipped');
 const active=await f.queue.create({article_title:'How to Get Pearls',status:'processing',locked_by:'active#token',locked_at:new Date().toISOString()});
 const expired=await f.queue.create({article_title:'How to Obtain Pearls',status:'processing',locked_by:'old#token',locked_at:'2000-01-01'});
 const rejected=gameQueue?null:await f.queue.create({article_title:'Rejected separate topic',status:'rejected',result_slug:'keep-rejected'});
 const rows=await f.queue.list();assert.equal(await f.queue.recoverClaims(rows),1);
 assert.equal((await f.queue.get(expired.id)).status,'pending');
 assert.equal(await f.queue.reconcileDuplicates(rows),1);
 assert.equal((await f.queue.get(expired.id)).status,'skipped');
 assert.equal((await f.queue.get(active.id)).locked_by,'active#token');
 if(rejected) {
  const duplicate=await f.queue.create({article_title:'Rejected separate topic guide',status:'pending'});
  assert.equal(await f.queue.reconcileDuplicates(await f.queue.list()),1);
  assert.equal((await f.queue.get(duplicate.id)).status,'skipped');
  const kept=await f.queue.get(rejected.id);assert.equal(kept.status,'rejected');assert.equal(kept.result_slug,'keep-rejected');
 }
});

test('a rejected Roblox draft is reclaimed with a new token and completed under the same row and slug',async()=>{
 const f=fixture(ROBLOX_ARTICLE_QUEUE);
 const saved=await f.queue.create({article_title:'Revision',status:'completed',result_path:'tmp/original/final.json',result_slug:'revision',attempts:3,locked_by:'first#token',locked_at:new Date().toISOString()});
 await runQueueUpdate(['--queue-id',saved.id,'--status','rejected','--reason','Fix the instructions','--apply'],false,{queue:f.queue});
 const rejected=await f.queue.get(saved.id);assert.equal(rejected.locked_by,null);assert.equal(rejected.attempts,3);
 const claim=['--queue-id',saved.id,'--status','processing','--worker','revision-worker','--apply'];
 await assert.rejects(runQueueUpdate(claim,false,{queue:f.queue,settle:async()=>{}}),/requires --reason/);
 await runQueueUpdate([...claim,'--reason','Corrected the instructions and re-checked them'],false,{queue:f.queue,settle:async()=>{}});
 const claimed=await f.queue.get(saved.id);assert.match(claimed.locked_by!,/^revision-worker#/);assert.notEqual(claimed.locked_by,saved.locked_by);
 assert.equal(claimed.outcome_reason,'Corrected the instructions and re-checked them');
 assert.equal(claimed.attempts,4);assert.equal(claimed.result_slug,'revision');assert.equal(claimed.result_path,saved.result_path);
 await assert.rejects(runQueueUpdate(claim,false,{queue:f.queue}),/active claim/);
 const folder=await fs.mkdtemp(path.resolve('tmp/revision-output-'));
 try {
  const file=path.join(folder,'final.json');await fs.writeFile(file,JSON.stringify({slug:'revision'}));
  const complete=['--queue-id',saved.id,'--status','completed','--result-path',file,'--apply'];
  await assert.rejects(runQueueUpdate([...complete,'--claim-token','first#token'],false,{queue:f.queue}),/Claim ownership differs/);
  await fs.writeFile(file,JSON.stringify({slug:'different-slug'}));
  await assert.rejects(runQueueUpdate([...complete,'--claim-token',claimed.locked_by!],false,{queue:f.queue}),/preserve its existing slug/);
  await fs.writeFile(file,JSON.stringify({slug:'revision'}));
  await runQueueUpdate([...complete,'--claim-token',claimed.locked_by!],false,{queue:f.queue});
  const completed=await f.queue.get(saved.id);assert.equal(completed.status,'completed');assert.equal(completed.id,saved.id);assert.equal(completed.result_slug,'revision');assert.equal(completed.attempts,4);
  assert.equal(f.pages.size,1);
 }finally{await fs.rm(folder,{recursive:true,force:true});}
});

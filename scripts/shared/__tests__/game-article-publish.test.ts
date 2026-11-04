import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import sharp from "sharp";
import { bundleSchema, gameArticleFinalSchema } from "../../../contracts/game-article/v1/schema";
import { readWikiContract } from "../wiki-publish-contract";

const id="11111111-1111-4111-8111-111111111111";
const dev="https://bbtcaurrtyoukvjbxbbj.supabase.co";
const bundle={contract:"game-article@1",namespace:"example",game:{slug:"example-game",kind:"game"},slug:"example-guide",finalJson:"final.json",mediaJson:"media.json"};
const final={slug:bundle.slug,title:"Example Guide",content_md:"Complete the first task.",cover_image:`${dev}/storage/v1/object/public/media/cover.webp`,author_id:id};
test("game article contract rejects queues, Roblox IDs, unknown keys and escaping paths",async()=>{
  assert.equal(bundleSchema.parse(bundle).contract,"game-article@1");
  for(const bad of [{...bundle,queueId:id},{...bundle,namespace:"roblox"},{...bundle,game:{slug:"example-game"}},{...bundle,finalJson:"../final.json"},{...bundle,mediaJson:"/media.json"},{...bundle,contract:"game-article@2"}]) assert.equal(bundleSchema.safeParse(bad).success,false);
  for(const bad of [{...final,universe_id:123},{...final,sources:["https://example.com"]},{...final,is_published:false},{...final,author_id:null}]) assert.equal(gameArticleFinalSchema.safeParse(bad).success,false);
  assert.equal(gameArticleFinalSchema.safeParse({...final,tags:["news"],sources_json:[{title:"Official",url:"https://example.com"}]}).success,true);
});

for(const scenario of ["dry-run","apply","hidden-game","roblox-clash","foreign-owner","reserved-route","archive-clash","duplicate-slug","bad-readback"]) test(`game article ${scenario}`,async()=>{
  const root=path.resolve("tmp",`game-article-${randomUUID()}`);await fs.mkdir(root,{recursive:true});
  try {
    await fs.writeFile(path.join(root,"bundle.json"),JSON.stringify(bundle));
    assert.equal(await readWikiContract(root),"game-article@1");
    await fs.writeFile(path.join(root,"final.json"),JSON.stringify(final));
    // An inspected unavailable target is an accepted text-only article image pass.
    await fs.writeFile(path.join(root,"media.json"),JSON.stringify({schema:1,article_slug:bundle.slug,required:true,visual_type:"steps",expected_count:1,entries:[{id:"step",label:"First task",placement_heading:"First task",required:true,status:"missing",availability_failure:"inspection",missing_reason:"Screenshot does not show the requested task.",acceptance_note:"Reviewer accepted the clear text instructions."}]}));
    await fs.writeFile(path.join(root,"image.webp"),await sharp({create:{width:320,height:180,channels:3,background:"red"}}).webp().toBuffer());
    const preload=`import fs from 'node:fs';
      const root=${JSON.stringify(root)},scenario=${JSON.stringify(scenario)},id=${JSON.stringify(id)};
      const calls=[];let stored=null;
      process.on('exit',()=>fs.writeFileSync(root+'/report.json',JSON.stringify({calls,stored})));
      globalThis.fetch=async(input,init)=>{
        const url=new URL(typeof input==='string'?input:input.url??input.href),method=init?.method??'GET';calls.push({path:url.pathname,method});
        const json=data=>new Response(JSON.stringify(data),{headers:{'content-type':'application/json'}});
        if(url.pathname.includes('/storage/')) return method==='GET'?new Response(fs.readFileSync(root+'/image.webp'),{headers:{'content-type':'image/webp'}}):json({Key:'cover'});
        if(url.pathname.endsWith('/games')&&url.searchParams.get('id')?.startsWith('neq.')) return json(scenario==='duplicate-slug'?[{id:'other'}]:[]);
        if(url.pathname.endsWith('/games')) return json({id,namespace:'example',slug:'example-game',kind:'game',parent_id:null,is_published:scenario!=='hidden-game'});
        if(url.pathname.endsWith('/authors')) return json({id});
        if(url.pathname.endsWith('/articles')) return json(url.searchParams.has('slug')?(scenario==='roblox-clash'?{id}:null):(scenario==='archive-clash'?[{universe:{universe_id:1,slug:'example-game-1',display_name:'Example Game',name:'Example Game'}}]:[]));
        if(url.pathname.endsWith('/site_routes')) return json(scenario==='reserved-route'?{source:'roblox',page_type:'article',page_id:'reserved',status:'gone'}:null);
        if(url.pathname.endsWith('/expected_game_page_path')) return json('/articles/example-guide');
        if(url.pathname.endsWith('/game_article_pages_view')) return json({id});
        if(url.pathname.endsWith('/game_article_pages')) {
          if(method==='GET'&&url.searchParams.has('game_id')) return json(scenario==='duplicate-slug'?[{id:'other-article'}]:[]);
          if(method==='GET') return json(scenario==='foreign-owner'?{id,namespace:'other',game_id:'other'}:stored);
          stored={...JSON.parse(init.body),id,published_at:'2026-01-01'};
          if(scenario==='bad-readback') stored.title='Wrong title';
          return json(stored);
        }
        throw new Error('Unexpected request '+method+' '+url.pathname);
      };`;
    const apply=["apply","bad-readback"].includes(scenario);
    const result=spawnSync(process.execPath,["--import","tsx","--import",`data:text/javascript,${encodeURIComponent(preload)}`,"scripts/content/roblox-wiki-cli.ts","publish",root,...(apply?["--apply"]:[])],{encoding:"utf8",timeout:30000,env:{...process.env,BLOXODES_ENV_PROFILE:"process-only",SUPABASE_URL:dev,SUPABASE_SERVICE_ROLE:"test-role",SUPABASE_MEDIA_BUCKET:"media",SUPABASE_MEDIA_PUBLIC_URL:dev}});
    assert.equal(result.status,["apply","dry-run"].includes(scenario)?0:1,result.stderr);
    if(scenario==='archive-clash') assert.match(result.stderr+result.stdout,/already belongs to a Roblox game/);
    if(scenario==='duplicate-slug') assert.match(result.stderr+result.stdout,/another game with this slug/);
    const report=JSON.parse(await fs.readFile(path.join(root,"report.json"),"utf8"));
    assert.ok(report.calls.every((call:{path:string})=>!call.path.includes('article_generation_queue')&&!call.path.includes('roblox_universes')));
    if(!apply) assert.ok(report.calls.every((call:{method:string;path:string})=>call.method==='GET'||call.path.endsWith('/expected_game_page_path')));
    if(scenario==='apply') {assert.equal(report.stored.game_id,id);assert.equal(report.stored.namespace,'example');assert.equal(report.stored.canonical_path,'/articles/example-guide');}
  } finally {await fs.rm(root,{recursive:true,force:true});}
});

test("live verification separates images and video on numbered article pages",async()=>{
 const {gameArticleVerificationPages}=await import("../../content/game-article-publish");
 const pages=gameArticleVerificationPages('First page\n\n![First image](https://example.com/first.webp)\n\n```article-page-break\nschema: 1\nid: second-page\n```\n\nSecond page\n\n{{ youtube: dQw4w9WgXcQ }}');
 assert.equal(pages.length,2);
 assert.match(pages[0],/first.webp/); assert.doesNotMatch(pages[0],/youtube/);
 assert.match(pages[1],/youtube/); assert.doesNotMatch(pages[1],/first.webp/);
});

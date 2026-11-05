import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
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
  for(const bad of [{...final,universe_id:123},{...final,sources:["https://example.com"]},{...final,is_published:false}]) assert.equal(gameArticleFinalSchema.safeParse(bad).success,false);
  for (const cover_image of [undefined,null,""]) for (const author_id of [undefined,null,id])
    assert.equal(gameArticleFinalSchema.safeParse({...final,cover_image,author_id}).success,true);
  assert.equal(gameArticleFinalSchema.safeParse({...final,cover_image:"http://example.com/image.webp"}).success,false);
  assert.equal(gameArticleFinalSchema.safeParse({...final,tags:["news"],sources_json:[{title:"Official",url:"https://example.com"}]}).success,true);
});

for(const scenario of ["dry-run","apply","hidden-game","roblox-clash","foreign-owner","reserved-route","archive-clash","duplicate-slug","bad-readback","author-absent","author-null","author-existing","author-ineligible","author-preferred","no-authors","body-cover","game-cover","missing-cover","repeated-cover"]) test(`game article ${scenario}`,async()=>{
  const root=path.resolve("tmp",`game-article-${randomUUID()}`);await fs.mkdir(root,{recursive:true});
  try {
    await fs.writeFile(path.join(root,"bundle.json"),JSON.stringify(bundle));
    assert.equal(await readWikiContract(root),"game-article@1");
    const bodyScenario=["body-cover","repeated-cover"].includes(scenario);
    const bodyPath=`articles/${bundle.slug}/sources/first.webp`;
    const bodyUrl=`${dev}/storage/v1/object/public/media/${bodyPath}`;
    const secondUrl=bodyUrl.replace("first.webp","second.webp");
    const inputFinal={...final} as Record<string,unknown>;
    if(scenario==='author-absent') delete inputFinal.author_id;
    if(scenario==='author-preferred') inputFinal.author_id='22222222-2222-4222-8222-222222222222';
    if(scenario==='author-null') inputFinal.author_id=null;
    if(scenario==='author-ineligible') inputFinal.author_id='33333333-3333-4333-8333-333333333333';
    if(["body-cover","game-cover","missing-cover"].includes(scenario)) delete inputFinal.cover_image;
    if(bodyScenario) inputFinal.content_md=`Complete the first task.\n\n## First task\n\n![First task screenshot](${bodyUrl})\n\n![Second task screenshot](${secondUrl})`;
    if(scenario==='repeated-cover') inputFinal.cover_image=bodyUrl;
    await fs.writeFile(path.join(root,"final.json"),JSON.stringify(inputFinal));
    // An inspected unavailable target is an accepted text-only article image pass.
    await fs.writeFile(path.join(root,"media.json"),JSON.stringify({schema:1,article_slug:bundle.slug,required:true,visual_type:"steps",expected_count:1,entries:[{id:"step",label:"First task",placement_heading:"First task",required:true,status:"missing",availability_failure:"inspection",missing_reason:"Screenshot does not show the requested task.",acceptance_note:"Reviewer accepted the clear text instructions."}]}));
    if(bodyScenario) await fs.writeFile(path.join(root,"media.json"),JSON.stringify({schema:1,article_slug:bundle.slug,required:true,visual_type:"steps",expected_count:2,entries:["first","second"].map((name,i)=>({id:name,label:`${name} task`,placement_heading:"First task",required:true,status:"verified",source_page_url:"https://example.com/tasks",original_image_url:`https://example.com/${name}.webp`,public_url:i?secondUrl:bodyUrl,uploaded_path:bodyPath.replace("first",name),width:320,height:180,alt:i?"Second task screenshot":"First task screenshot",match_evidence:"The screenshot shows this exact task.",rights_note:"Official gameplay screenshot."}))}));
    await fs.writeFile(path.join(root,"body.webp"),await sharp({create:{width:320,height:180,channels:3,background:"blue"}}).webp().toBuffer());
    await fs.writeFile(path.join(root,"game.webp"),await sharp({create:{width:320,height:180,channels:3,background:"green"}}).webp().toBuffer());
    await fs.writeFile(path.join(root,"image.webp"),await sharp({create:{width:320,height:180,channels:3,background:"red"}}).webp().toBuffer());
    const preload=`import fs from 'node:fs';
      const root=${JSON.stringify(root)},scenario=${JSON.stringify(scenario)},id=${JSON.stringify(id)};
      const previous=fs.existsSync(root+'/report.json')?JSON.parse(fs.readFileSync(root+'/report.json','utf8')):null;
      const calls=[],uploads=previous?.uploads??[];let stored=previous?.stored??null;
      const existingAuthor='22222222-2222-4222-8222-222222222222';
      if(scenario==='author-existing'&&!stored) stored={id,namespace:'example',game_id:id,author_id:existingAuthor};
      process.on('exit',()=>fs.writeFileSync(root+'/report.json',JSON.stringify({calls,stored,uploads})));
      globalThis.fetch=async(input,init)=>{
        const url=new URL(typeof input==='string'?input:input.url??input.href),method=init?.method??'GET';calls.push({path:url.pathname,method,url:url.href});
        const json=data=>new Response(JSON.stringify(data),{headers:{'content-type':'application/json'}});
        if(url.pathname.includes('/storage/')) {
          if(method!=='GET') { uploads.push(url.pathname.replace('/storage/v1/object/','/storage/v1/object/public/')); return json({Key:'image'}); }
          const source=url.origin===${JSON.stringify(dev)};
          const isBody=url.pathname.endsWith('/first.webp')||url.pathname.endsWith('/second.webp');
          const known=source&&(isBody||url.pathname.endsWith('/cover.webp')||url.pathname.endsWith('/game.webp'));
          if(!known&&!uploads.includes(url.pathname)) throw new Error('Image was fetched before upload: '+url.href);
          const file=url.pathname.endsWith('/second.webp')?'game.webp':isBody?'body.webp':url.pathname.endsWith('/game.webp')?'game.webp':'image.webp';
          return new Response(fs.readFileSync(root+'/'+file),{headers:{'content-type':'image/webp'}});
        }
        if(url.pathname.endsWith('/games')&&url.searchParams.get('id')?.startsWith('neq.')) return json(scenario==='duplicate-slug'?[{id:'other'}]:[]);
        if(url.pathname.endsWith('/games')) return json({id,namespace:'example',slug:'example-game',kind:'game',parent_id:null,is_published:scenario!=='hidden-game',cover_image:scenario==='missing-cover'?null:${JSON.stringify(dev)}+'/storage/v1/object/public/media/game.webp'});
        if(url.pathname.endsWith('/authors')) return json(scenario==='no-authors'?[]:[...(scenario==='author-preferred'?[{id:existingAuthor,name:'Preferred Writer',slug:'preferred-writer'}]:[]),{id,name:'Eligible Writer',slug:'eligible-writer'},{id:'33333333-3333-4333-8333-333333333333',name:'Ravi Teja KNTS',slug:'ravi-teja-knts'}]);
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
    const apply=["apply","bad-readback","author-absent","author-null","author-existing","author-ineligible","author-preferred","body-cover","game-cover"].includes(scenario);
    const mediaOrigin=scenario==='body-cover'?"https://media.example.com":dev;
    for(let attempt=0;attempt<(scenario==='body-cover'||scenario==='game-cover'||scenario==='author-absent'?2:1);attempt++) {
    const result=spawnSync(process.execPath,["--import","tsx","--import",`data:text/javascript,${encodeURIComponent(preload)}`,"scripts/content/roblox-wiki-cli.ts","publish",root,...(apply?["--apply"]:[])],{encoding:"utf8",timeout:30000,env:{...process.env,BLOXODES_ENV_PROFILE:"process-only",SUPABASE_URL:dev,SUPABASE_SERVICE_ROLE:"test-role",SUPABASE_MEDIA_BUCKET:"media",SUPABASE_MEDIA_PUBLIC_URL:`${mediaOrigin}/storage/v1/object/public/media`}});
    assert.equal(result.status,(apply&&scenario!=="bad-readback")||scenario==="dry-run"?0:1,result.stderr);
    if(scenario==='no-authors') assert.match(result.stderr,/No eligible article authors/);
    if(scenario==='missing-cover') assert.match(result.stderr,/provide cover_image, a body image, or the owning game cover_image/);
    if(scenario==='repeated-cover') assert.match(result.stderr,/cover must not repeat a body image/);
    if(scenario==='archive-clash') assert.match(result.stderr+result.stdout,/already belongs to a Roblox game/);
    if(scenario==='duplicate-slug') assert.match(result.stderr+result.stdout,/another game with this slug/);
    const report=JSON.parse(await fs.readFile(path.join(root,"report.json"),"utf8"));
    assert.ok(report.calls.every((call:{path:string})=>!call.path.includes('article_generation_queue')&&!call.path.includes('roblox_universes')));
    if(!apply) assert.ok(report.calls.every((call:{method:string;path:string})=>call.method==='GET'||call.path.endsWith('/expected_game_page_path')));
    if(apply&&scenario!=='bad-readback') {
      assert.equal(report.stored.author_id,['author-existing','author-preferred'].includes(scenario)?'22222222-2222-4222-8222-222222222222':id);
      const sourceFile=scenario==='body-cover'?'body.webp':scenario==='game-cover'?'game.webp':'image.webp';
      const expectedHash=createHash("sha256").update(await sharp(await fs.readFile(path.join(root,sourceFile))).webp().toBuffer()).digest("hex");
      assert.equal(report.stored.cover_image,`${mediaOrigin}/storage/v1/object/public/media/articles/${bundle.slug}/cover-${expectedHash}.webp`);
      if(scenario==='body-cover') {
        assert.ok(report.stored.content_md.includes(`${mediaOrigin}/storage/v1/object/public/media/${bodyPath}`));
        assert.ok(!report.stored.content_md.includes(dev));
        assert.ok(report.calls.some((call:{url:string;method:string})=>call.method==='GET'&&call.url===bodyUrl));
      }
    }
    if(scenario==='apply') {assert.equal(report.stored.game_id,id);assert.equal(report.stored.namespace,'example');assert.equal(report.stored.canonical_path,'/articles/example-guide');assert.match(report.stored.cover_image,new RegExp(`^${dev}/storage/v1/object/public/media/articles/example-guide/cover-[0-9a-f]+\\.webp$`));}
    }
    assert.deepEqual(JSON.parse(await fs.readFile(path.join(root,"final.json"),"utf8")),inputFinal);
  } finally {await fs.rm(root,{recursive:true,force:true});}
});

test("live verification separates images and video on numbered article pages",async()=>{
 const {gameArticleVerificationPages}=await import("../../content/game-article-publish");
 const pages=gameArticleVerificationPages('First page\n\n![First image](https://example.com/first.webp)\n\n```article-page-break\nschema: 1\nid: second-page\n```\n\nSecond page\n\n{{ youtube: dQw4w9WgXcQ }}');
 assert.equal(pages.length,2);
 assert.match(pages[0],/first.webp/); assert.doesNotMatch(pages[0],/youtube/);
 assert.match(pages[1],/youtube/); assert.doesNotMatch(pages[1],/first.webp/);
});

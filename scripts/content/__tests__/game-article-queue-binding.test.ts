import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { bundleSchema } from "../../../contracts/game-article/v1/schema";
import { assertGameArticleQueueBinding } from "../game-article-publish";
import { acknowledgeArticleQueue } from "../article-publish";

test("game contract queue ID is optional and bound results preserve published updates",async()=>{
 const bundle={contract:'game-article@1',slug:'game-topic',namespace:'gta',game:{slug:'gta-6',kind:'game'},finalJson:'final.json',mediaJson:'media.json'};
 assert.ok(bundleSchema.parse(bundle));assert.ok(bundleSchema.parse({...bundle,queueId:randomUUID()}));assert.throws(()=>bundleSchema.parse({...bundle,queueId:'bad'}));
 await fs.mkdir('tmp/game-article-binding-test',{recursive:true});const root=await fs.mkdtemp('tmp/game-article-binding-test/run-');
 try{
 const finalPath=path.resolve(root,'final.json');const bytes=Buffer.from(JSON.stringify({slug:bundle.slug,content_md:'New [links](/wiki/gta-6)'}));await fs.writeFile(finalPath,bytes);
 const binding={slug:bundle.slug,resultPath:finalPath,finalPath,sha256:createHash('sha256').update(bytes).digest('hex')};
 const row={id:randomUUID(),workflow_mode:'agent_runner',status:'completed',namespace:'gta',game_slug:'gta-6',game_kind:'game',result_path:finalPath,result_slug:bundle.slug,production_url:null};
 await assertGameArticleQueueBinding(row,bundle,binding);
 for(const changed of [{status:'processing'},{result_slug:'wrong'},{game_slug:'wrong'},{result_path:'wrong'}])await assert.rejects(assertGameArticleQueueBinding({...row,...changed},bundle,binding));
 let saved:any=row;const queue:any={update:async(_id:string,patch:any)=>saved={...saved,...patch},get:async()=>saved};
 await acknowledgeArticleQueue(queue,row,binding);assert.equal(saved.status,'published');assert.ok(saved.published_at);assert.equal(saved.production_url,'https://bloxodes.com/articles/game-topic');
 // A revised final at the bound path can update a Published row without reopening it.
 await fs.writeFile(finalPath,Buffer.from(JSON.stringify({slug:bundle.slug,content_md:'Changed [links](/wiki/gta-6)'})));
 const revised={...binding,sha256:createHash('sha256').update(await fs.readFile(finalPath)).digest('hex')};
 await assertGameArticleQueueBinding(saved,bundle,revised);const date=saved.published_at;await acknowledgeArticleQueue(queue,saved,revised);assert.equal(saved.published_at,date);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});

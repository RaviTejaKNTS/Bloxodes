import fs from 'node:fs';
import path from 'node:path';
import {randomUUID,createHmac} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {assertChecklistItems, assertPageFields, fingerprint} from './checklist-proof.mjs';

const statePath = () => path.join(process.env.RUNNER_TEMP!, 'managed-checklists.json');
function database() {
  if (process.env.GITHUB_ACTIONS !== 'true' || process.env.SUPABASE_URL !== 'https://bbtcaurrtyoukvjbxbbj.supabase.co') throw new Error('Checklist QA uses only GitHub and managed development.');
  return createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE!,{auth:{persistSession:false}});
}
function records(): any[] {return fs.existsSync(statePath()) ? JSON.parse(fs.readFileSync(statePath(),'utf8')) : [];}
function save(entries: any[]) {fs.writeFileSync(statePath(),JSON.stringify(entries));}
export async function prepareChecklistAccount() {
  if(!records().length) return;
  const file=path.join(process.env.RUNNER_TEMP!,'checklist-auth.json');
  if(fs.existsSync(file)) return;
  const db=database(), accounts:any[]=[];
  for(const project of ['desktop-chromium','mobile-chromium']) {
    const userId=randomUUID(),sessionId=randomUUID();
    const now=Math.floor(Date.now()/1000),expires=now+3600;
    const payload=Buffer.from(JSON.stringify({v:1,sid:sessionId,uid:userId,iat:now,exp:expires})).toString('base64url');
    const signature=createHmac('sha256',process.env.AUTH_SESSION_SECRET!).update(payload).digest('base64url');
    accounts.push({project,userId,sessionId,token:`${payload}.${signature}`});
    fs.writeFileSync(file,JSON.stringify(accounts),{mode:0o600});
    const user=await db.from('app_users').insert({user_id:userId,display_name:'Checklist QA',role:'user'});if(user.error) throw user.error;
    const session=await db.from('app_sessions').insert({id:sessionId,user_id:userId,expires_at:new Date(expires*1000).toISOString()});if(session.error)throw session.error;
  }
}
export async function stageChecklist(operation: any, file: string): Promise<string | null> {
  const db = database();
  const bytes = fs.readFileSync(file);
  const input = JSON.parse(bytes.toString());
  const final = input.checklist_pages ? {page:input.checklist_pages,items:input.checklist_items} : input;
  const roblox = operation.publisher === 'content-final' && final.page?.slug && Array.isArray(final.items);
  const shared = operation.publisher === 'game-pages' && (input.checklists || input.checklistItems);
  if (!roblox && !shared) return null;
  const entries = records();
  const output = structuredClone(roblox ? final : input);
  const suffix = `${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT}-${randomUUID().slice(0,8)}`;
  const temporary = path.join(process.env.RUNNER_TEMP!,`checklist-${randomUUID()}.json`);
  if (roblox) {
    const slug = `qa-${suffix}-${final.page.slug.trim().toLowerCase()}`;
    const page = {...final.page,slug,is_public:true};
    output.page = page;
    const expected = {universe_id:Number(page.universe_id),slug,title:page.title.trim(),seo_title:page.seo_title??null,seo_description:page.seo_description??null,description_md:page.description_md??null,is_public:true};
    entries.push({kind:'roblox',source:file,sourceHash:fingerprint(bytes),slug,universeId:expected.universe_id,expected,items:final.items,path:`/checklists/${slug}`,originalPath:`/checklists/${final.page.slug.trim().toLowerCase()}`,title:expected.title});
  } else {
    if (!Array.isArray(input.checklists) || !input.checklists.length || !Array.isArray(input.checklistItems)) throw new Error('Shared checklist QA requires page rows and a complete reviewed task inventory.');
    const namespace=operation.namespace;
    const ids = new Map(input.checklists.map((page: any)=>[page.id,randomUUID()]));
    if (input.checklistItems.some((item: any)=>!ids.has(item.page_id))) throw new Error('Every edited checklist needs its reviewed page and full task set.');
    output.checklists=[]; output.checklistItems=[];
    for (const original of input.checklists) {
      if (!original.id) throw new Error('Shared checklists need an explicit stable page UUID.');
      const items=input.checklistItems.filter((item: any)=>item.page_id===original.id);
      const id=ids.get(original.id);
      const slug=`qa-${suffix}-${original.slug}`;
      const page={...original,id,namespace,slug,is_public:true,published_at:'2020-01-01T00:00:00Z'};
      delete page.canonical_path; delete page.created_at; delete page.updated_at;
      const copied=items.map((item:any)=>({...item,id:randomUUID(),page_id:id,namespace}));
      output.checklists.push(page); output.checklistItems.push(...copied);
      const expected={id,namespace,game_id:page.game_id,slug,title:page.title,seo_title:page.seo_title??null,seo_description:page.seo_description??null,description_md:page.description_md??null,is_public:true};
      entries.push({kind:'shared',source:file,sourceHash:fingerprint(bytes),id,namespace,slug,expected,items:copied,path:`/${namespace}/checklists/${slug}`,originalPath:`/${namespace}/checklists/${original.slug}`,title:page.title});
    }
  }
  // Record cleanup ownership before any publisher can write a QA row.
  save(entries);
  fs.writeFileSync(temporary,JSON.stringify(output));
  return temporary;
}
export async function verifyChecklists() {
  const db=database();
  const entries=records();
  for(const entry of entries) {
    if(fingerprint(fs.readFileSync(entry.source))!==entry.sourceHash) throw new Error('Reviewed checklist input changed during QA.');
    const shared=entry.kind==='shared';
    let query=db.from(shared?'game_checklist_pages':'checklist_pages').select('*').eq('slug',entry.slug);
    query=shared?query.eq('namespace',entry.namespace).eq('id',entry.id):query.eq('universe_id',entry.universeId);
    const {data:page,error}=await query.single(); if(error) throw error;
    assertPageFields(entry.expected,page);
    entry.savedId=page.id;
    const items:any[]=[];
    for(let start=0;;start+=500) {
      const result=await db.from(shared?'game_checklist_items':'checklist_items').select('*').eq('page_id',page.id).order('id').range(start,start+499);
      if(result.error) throw result.error; items.push(...result.data); if(result.data.length<500) break;
    }
    assertChecklistItems(entry.items,items,shared);
    entry.savedItems=items;
  }
  save(entries);
  const destination='tmp/test-reports/managed-checklists.json';
  fs.mkdirSync(path.dirname(destination),{recursive:true}); fs.copyFileSync(statePath(),destination);
}
export async function cleanupChecklists() {
  const db=database(),failures:string[]=[];
  for(const entry of records()) {
    try {
      if(entry.kind==='shared') {
        const items=await db.from('game_checklist_items').delete().eq('page_id',entry.id).eq('namespace',entry.namespace);if(items.error)throw items.error;
      }
      let query=db.from(entry.kind==='shared'?'game_checklist_pages':'checklist_pages').delete().eq('slug',entry.slug);
      query=entry.kind==='shared'?query.eq('namespace',entry.namespace).eq('id',entry.id):query.eq('universe_id',entry.universeId);
      const result=await query.select('id');if(result.error)throw result.error;
      const remaining=await db.from(entry.kind==='shared'?'game_checklist_pages':'checklist_pages').select('id').eq('slug',entry.slug);
      if(remaining.error || remaining.data.length) throw new Error('QA page cleanup readback failed.');
    } catch(error:any) {failures.push(error.message);}
  }
  const auth=path.join(process.env.RUNNER_TEMP!,'checklist-auth.json');
  if(fs.existsSync(auth)) for(const {userId,sessionId} of JSON.parse(fs.readFileSync(auth,'utf8'))) {
    try {
      const revoke=await db.from('app_sessions').update({revoked_at:new Date().toISOString()}).eq('id',sessionId).eq('user_id',userId);if(revoke.error)throw revoke.error;
      const remove=await db.from('app_users').delete().eq('user_id',userId);if(remove.error)throw remove.error;
      const remaining=await db.from('app_users').select('user_id').eq('user_id',userId);if(remaining.error||remaining.data.length)throw new Error('QA account cleanup readback failed.');
    } catch(error:any) {failures.push(error.message);}
  }
  if(failures.length)throw new Error(failures.join('\n'));
}
if(process.argv[1]?.endsWith('/managed-checklists.ts')) {
  const mode=process.argv[2];
  (mode==='cleanup'?cleanupChecklists():mode==='account'?prepareChecklistAccount():verifyChecklists()).catch(error=>{console.error(error.message);process.exitCode=1;});
}

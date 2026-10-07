import fs from 'node:fs';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
if(process.env.GITHUB_ACTIONS!=='true'||process.env.BLOXODES_MANAGED_QA!=='true'||process.env.SUPABASE_URL!=='https://bbtcaurrtyoukvjbxbbj.supabase.co') throw new Error('Fixtures use only managed-development CI.');
async function main() {
  const db=createClient(process.env.SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE!,{auth:{persistSession:false}});
  const universe=await db.from('roblox_universes').select('universe_id').limit(1).single(); if(universe.error) throw universe.error;
  const game=await db.from('games').select('id,namespace').eq('namespace','gta').eq('kind','game').eq('is_published',true).limit(1).single();if(game.error) throw game.error;
  const id=randomUUID();
  const files={
    'roblox.json':{page:{universe_id:universe.data.universe_id,slug:'qa-fixture-roblox',title:'Checklist QA fixture',seo_description:'Temporary development checklist verification.',description_md:'Development-only checklist verification.'},items:[{section_code:'1',title:'Section'},{section_code:'1.1',title:'Objectives'},{section_code:'1.1.1',title:'Check the task',description:'Verify the board.'},{section_code:'1.1.2',title:'Reload the board',is_required:false}]},
    'shared.json':{checklists:[{id,game_id:game.data.id,slug:'qa-fixture-shared',title:'Shared checklist QA fixture',seo_description:'Temporary development checklist verification.',description_md:'Development-only checklist verification.',is_public:true,published_at:'2020-01-01T00:00:00Z'}],checklistItems:[{page_id:id,item_key:'section',section_code:'1',title:'Section',is_required:false},{page_id:id,item_key:'objectives',section_code:'1.1',title:'Objectives',is_required:false},{page_id:id,item_key:'check-task',section_code:'1.1.1',title:'Check the task'},{page_id:id,item_key:'reload',section_code:'1.1.2',title:'Reload the board',is_required:false}]}
  };
  const hash=createHash('sha256').update(JSON.stringify(files)).digest('hex');
  const base=`content/releases/${hash}`;fs.mkdirSync(base,{recursive:true});
  for(const [name,value] of Object.entries(files))fs.writeFileSync(path.join(base,name),JSON.stringify(value));
  const batch={version:1,operations:[{publisher:'content-final',file:'roblox.json'},{publisher:'game-pages',namespace:game.data.namespace,file:'shared.json'}],urls:[{path:'/checklists/qa-fixture-roblox',contains:'Checklist QA fixture'},{path:`/${game.data.namespace}/checklists/qa-fixture-shared`,contains:'Shared checklist QA fixture'}],events:[{type:'checklist',slug:'qa-fixture-roblox'},{type:'game_content',slug:game.data.namespace}]};
  fs.writeFileSync(path.join(base,'batch.json'),JSON.stringify(batch));
  fs.appendFileSync(process.env.GITHUB_ENV!,`BATCH=${base}/batch.json\nBLOXODES_VERIFIED_BUNDLE=${hash}\n`);
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});

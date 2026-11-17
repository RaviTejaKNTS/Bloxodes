import "./load-notion-article-env";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { withArticleQueueClaimLock, newArticleClaimToken, confirmArticleQueueClaim } from "./article-queue-claim";
import { slugify } from "@/lib/slug";
import { createNotionGameArticleQueue, articleQueueClaimExpired, duplicateQueueRow, queueRowOrder, type ArticleQueueRow } from "./notion-article-queue";
import { fetchProductionEditorialInventory } from "./production-editorial-inventory";
import { similarArticleTopics } from "./article-topic-similarity";
import { runQueueUpdate } from "./update-article-queue-item";

export function parseGameQueueAdd(argv: string[]) {
  const values: Record<string,string> = {}, urls: string[] = [], switches = new Set<string>();
  for(let i=0;i<argv.length;i++) {
    if(["--claim","--json","--apply"].includes(argv[i])) {switches.add(argv[i]);continue;}
    const [flag,inline] = argv[i].split(/=(.*)/s,2);
    if(!["--title","--game","--namespace","--game-slug","--kind","--type","--source-url","--reason","--added-by","--worker"].includes(flag)) throw new Error(`Unknown option: ${flag}`);
    const value = (inline ?? argv[++i])?.trim(); if(!value || value.startsWith("--")) throw new Error(`${flag} requires a value.`);
    if(flag === "--source-url") {const url=new URL(value);if(url.protocol!=="https:")throw new Error("--source-url requires HTTPS.");urls.push(url.href);}else values[flag]=value;
  }
  if(!values["--title"] || !slugify(values["--title"]) || !values["--game"]) throw new Error("--title and --game are required.");
  if(!["guide","tier_list","explainer","news"].includes(values["--type"])) throw new Error("--type must be guide, tier_list, explainer or news.");
  if(!["game","franchise"].includes(values["--kind"])) throw new Error("--kind must be game or franchise.");
  for(const flag of ["--namespace","--game-slug"]) if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(values[flag]??"") || values["--namespace"] === "roblox") throw new Error(`${flag} requires a non-Roblox slug.`);
  const addedBy=values["--added-by"]??"agent";if(!["agent","owner"].includes(addedBy))throw new Error("--added-by must be agent or owner.");
  if(!values["--reason"] || !urls.length) throw new Error("--reason and at least one --source-url are required.");
  const now=new Date().toISOString();
  return {apply:switches.has("--apply"),json:switches.has("--json"),row:{
    article_title:values["--title"],game:values["--game"],namespace:values["--namespace"],game_slug:values["--game-slug"],game_kind:values["--kind"],article_type:values["--type"],added_by:addedBy,
    topic_key:`${values["--namespace"]}:${values["--game-slug"]}:${slugify(values["--title"])}`,
    idempotency_key:`${values["--namespace"]}:${values["--game-slug"]}:${values["--kind"]}:${slugify(values["--title"])}`,
    source_urls:[...new Set(urls)],source_url:urls[0],curation_reason:values["--reason"],source_name:"Bloxodes Content Factory",curation_model:"content-factory-main-agent",curated_at:now,
    status:switches.has("--claim")?"processing":"pending",attempts:switches.has("--claim")?1:0,
    locked_at:switches.has("--claim")?now:null,locked_by:switches.has("--claim")?newArticleClaimToken(values["--worker"]??"t3-content-factory"):null,
  }};
}
export function selectGameQueueRows(rows: ArticleQueueRow[], status: string, limit: number) {
  return rows.filter(r => r.status === status || status === "pending" && articleQueueClaimExpired(r))
    .sort((a,b) => Number(b.added_by === "owner") - Number(a.added_by === "owner") || queueRowOrder(a,b)).slice(0,limit);
}
async function main() {
  const [command,...argv]=process.argv.slice(2);
  if(argv.includes("--help")) {
    console.log(command === "add" ? 'Usage: npm run game-articles:queue:add -- --title TEXT --game "NAME" --namespace X --game-slug Y --kind game|franchise --type guide|tier_list|explainer|news --source-url URL [--source-url URL] --reason TEXT [--added-by agent|owner] [--claim] [--worker NAME] [--json] [--apply]' : command === "list" ? 'Usage: npm run game-articles:queue:list -- [--limit N] [--status STATUS] [--json]' : 'Usage: npm run game-articles:queue:update -- --queue-id UUID --status processing|blocked|completed|skipped --apply [--namespace X --game-slug Y --kind game|franchise] [--worker NAME] [--claim-token TOKEN] [--reason TEXT] [--retry-after-minutes N | --retry-after ISO] [--result-path final.json] [--result-slug SLUG]');return;
  }
  if(command === "update") {await runQueueUpdate(argv,true);return;}
  const queue=createNotionGameArticleQueue();await queue.validate();
  if(command === "list") {
    let limit=50,status="pending";
    for(let i=0;i<argv.length;i++) {
      if(argv[i]==="--json")continue;
      const [flag,inline]=argv[i].split(/=(.*)/s,2);
      const value=inline??argv[++i];
      if(flag==="--limit")limit=Number(value);else if(flag==="--status")status=value;else throw new Error(`Unknown option: ${flag}`);
    }
    if(!Number.isSafeInteger(limit)||limit<1||limit>500)throw new Error("--limit must be from 1 to 500.");
    if(!queue.config.statuses.includes(status))throw new Error("Invalid status.");
    const rows=selectGameQueueRows(await queue.list(),status,limit);
    const data=[];for(const r of rows)data.push(await queue.get(r.id));console.log(JSON.stringify(data,null,2));
  }else if(command === "add") {
    const options=parseGameQueueAdd(argv),row=options.row;
    const work=async()=>{
      const inventory=(await fetchProductionEditorialInventory({includeGames:true})).items;
      const {articleRelatedCandidates}=await import("./article-related");
      const scope={namespace:row.namespace,gameSlug:row.game_slug,kind:row.game_kind,game:row.game};
      for(const p of await articleRelatedCandidates(scope,undefined,inventory)) inventory.push({family:p.page_type,title:p.title,key:new URL(p.url).pathname.split("/").pop()!,universe_id:null,namespace:row.namespace,slug:row.game_slug,kind:row.game_kind as "game",public_path:new URL(p.url).pathname});
      const rows=await queue.list();const matches=similarArticleTopics(row.article_title,scope,inventory,rows);
      const duplicate=duplicateQueueRow(rows,row)??matches.find(m=>m.duplicate);
      if(duplicate) {console.log(JSON.stringify({duplicate,near_matches:matches.slice(0,10)}));process.exitCode=3;return;}
      if(!options.apply) {console.log(JSON.stringify({dry_run:true,row,near_matches:matches.slice(0,10)},null,2));return;}
      const saved=await queue.put(row);
      if(saved.created && row.locked_by) await confirmArticleQueueClaim(queue,saved.row.id,row.locked_by,row.locked_at!);
      console.log(JSON.stringify({...saved.row,...(saved.created && row.locked_by ? {claim_token:row.locked_by} : {}),near_matches:matches.slice(0,10)},null,2));if(!saved.created)process.exitCode=3;
    };
    if(options.apply && row.locked_by) await withArticleQueueClaimLock(work); else await work();
  }else throw new Error("Expected list, add or update.");
}
if(process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main().catch(e=>{console.error(e.message);process.exitCode=1;});

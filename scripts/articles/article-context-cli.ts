import "./load-notion-article-env";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { fetchProductionEditorialInventory } from "./production-editorial-inventory";
import { createNotionArticleQueue, createNotionGameArticleQueue } from "./notion-article-queue";
import { similarArticleTopics, type ArticleScope } from "./article-topic-similarity";
import { relatedArticlePages } from "./article-related";

export function parseArticleContextArgs(argv: string[]) {
  const values: Record<string,string> = {};
  let json = false;
  for (let i=0;i<argv.length;i++) {
    if (argv[i] === "--json") {json=true;continue;}
    const [flag,inline] = argv[i].split(/=(.*)/s,2);
    if (!["--title","--universe-id","--namespace","--game-slug","--kind","--exclude-slug","--file"].includes(flag)) throw new Error(`Unknown option: ${flag}`);
    const value = inline ?? argv[++i]; if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value.`);
    values[flag]=value;
  }
  const universeId = values["--universe-id"] ? Number(values["--universe-id"]) : null;
  if (values["--universe-id"] && (!/^\d+$/.test(values["--universe-id"]) || !Number.isSafeInteger(universeId) || universeId! < 1)) throw new Error("--universe-id requires a positive safe integer.");
  if (Boolean(universeId) === Boolean(values["--namespace"]) || (!universeId && !values["--game-slug"])) throw new Error("Supply --universe-id N or --namespace X --game-slug Y.");
  if (universeId && (values["--game-slug"] || values["--kind"])) throw new Error("Game options cannot be combined with --universe-id.");
  for (const flag of ["--namespace","--game-slug","--exclude-slug"]) if (values[flag] && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(values[flag])) throw new Error(`${flag} must be a slug.`);
  if (values["--namespace"] === "roblox") throw new Error("Use --universe-id for Roblox.");
  if (values["--kind"] && !["game","franchise"].includes(values["--kind"])) throw new Error("--kind must be game or franchise.");
  const scope: ArticleScope = universeId ? {universeId} : {namespace:values["--namespace"],gameSlug:values["--game-slug"],kind:values["--kind"]};
  return {scope, title:values["--title"], file:values["--file"], excludeSlug:values["--exclude-slug"], json};
}
async function main() {
  const [command,...argv] = process.argv.slice(2);
  if (argv.includes("--help")) {console.log(`Usage: npm run articles:${command} -- ${command === "similar" ? '--title "TEXT" ' : ''}(--universe-id N | --namespace X --game-slug Y [--kind game|franchise]) [--exclude-slug S] [--json]`);return;}
  const options = parseArticleContextArgs(argv);
  if (command === "related") {
    const pages = await relatedArticlePages(options.scope,options.excludeSlug);
    if(options.json) console.log(JSON.stringify(pages,null,2)); else console.table(pages);
  } else if (command === "similar") {
    if (!options.title) throw new Error("--title is required.");
    const inventory = (await fetchProductionEditorialInventory({includeGames:Boolean(options.scope.namespace)})).items;
    // Include collection pages absent from the public API's game projection.
    const { articleRelatedCandidates } = await import("./article-related");
    const pages = await articleRelatedCandidates(options.scope,undefined,inventory);
    const seen = new Set(inventory.map(i => i.public_path));
    for(const p of pages) if(!seen.has(new URL(p.url).pathname)) inventory.push({family:p.page_type,title:p.title,key:new URL(p.url).pathname.split("/").pop()!,universe_id:options.scope.universeId??null, ...(options.scope.namespace?{namespace:options.scope.namespace,slug:options.scope.gameSlug,kind:(options.scope.kind??"game") as "game",public_path:new URL(p.url).pathname}:{})});
    const queue = options.scope.namespace ? createNotionGameArticleQueue() : createNotionArticleQueue();
    const matches = similarArticleTopics(options.title,options.scope,inventory,await queue.list()).slice(0,25);
    console.log(JSON.stringify(matches,null,2));
  } else throw new Error("Expected related or similar.");
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main().catch(e => {console.error(e.message);process.exitCode=1;});

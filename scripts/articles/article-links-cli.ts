import "./load-notion-article-env";
import fs from "node:fs/promises";
import { productionArticleDb, productionRows } from "./article-production";
import { internalArticleLinks, articleLinkTexts, assertArticleLinksOnlyChange } from "../content/article-links";
export async function articlesMissingLinks(sinceRoblox="2026-11-01",sinceGame="2026-11-04") {
  const db=productionArticleDb();
  const [articles,gameArticles,games]=await Promise.all([
    productionRows(db,"articles","id,title,slug,universe_id,content_md,published_at,faq_json",q=>q.eq("is_published",true).gte("published_at",sinceRoblox).lte("published_at",new Date().toISOString())),
    productionRows(db,"game_article_pages_view","id,title,slug,namespace,game_id,content_md,published_at,faq_json",q=>q.gte("published_at",sinceGame)),
    productionRows(db,"games","id,namespace,slug,kind"),
  ]);
  const owners=new Map(games.map(g=>[g.id,g]));
  const zero=(r:any)=>!articleLinkTexts(r).flatMap(internalArticleLinks).length;
  return [...articles.filter(zero).map(r=>({kind:"roblox",slug:r.slug,universe_id:r.universe_id,url:`https://bloxodes.com/articles/${r.slug}`})),
    ...gameArticles.filter(zero).map(r=>({kind:"game",slug:r.slug,namespace:r.namespace,game_slug:owners.get(r.game_id)?.slug,game_kind:owners.get(r.game_id)?.kind,url:`https://bloxodes.com/articles/${r.slug}`}))];
}
async function main(){
 const [command,...argv]=process.argv.slice(2);const values:Record<string,string>={};
 if(argv.includes("--help")){console.log(command==="missing"?"Usage: npm run articles:links:missing -- [--since-roblox 2026-11-01] [--since-game 2026-11-04] [--json]":command==="prepare"?"Usage: npm run articles:links:prepare -- --slug S --out NEW_FOLDER":"Usage: npm run articles:links:verify-unchanged -- --before old.json --after new.json");return;}
 for(let i=0;i<argv.length;i++){if(argv[i]==="--json")continue;const flag=argv[i];if(!["--since-roblox","--since-game","--before","--after","--slug","--out"].includes(flag))throw new Error(`Unknown option: ${flag}`);const value=argv[++i];if(!value||value.startsWith("--"))throw new Error(`${flag} needs a value.`);values[flag]=value;}
 if(command==="missing")console.log(JSON.stringify(await articlesMissingLinks(values["--since-roblox"],values["--since-game"]),null,2));
 else if(command==="verify-unchanged"){if(!values["--before"]||!values["--after"])throw new Error("--before and --after are required.");assertArticleLinksOnlyChange(JSON.parse(await fs.readFile(values["--before"],"utf8")),JSON.parse(await fs.readFile(values["--after"],"utf8")));console.log("PASS only markdown link markup changed.");}
 else if(command==="prepare"){if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(values["--slug"]??"")||!values["--out"])throw new Error("--slug and --out are required.");const {prepareArticleLinkRepair}=await import("../content/article-link-repair");const bundle=await prepareArticleLinkRepair(values["--slug"],values["--out"]);console.log(`Prepared article-links@1 ${bundle.articleKind} bundle: ${values["--out"]}`);if(bundle.articleKind==="game")console.log(`Game: ${bundle.namespace}/${bundle.game.slug} (${bundle.game.kind})`);}
 else throw new Error("Expected missing, verify-unchanged or prepare.");
}main().catch(e=>{console.error(e.message);process.exitCode=1;});

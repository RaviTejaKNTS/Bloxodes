import "../articles/load-notion-article-env";
import fs from "node:fs/promises";
import { parseArticleContextArgs } from "../articles/article-context-cli";
import { assertArticleLinks } from "./article-links";
async function main(){
  if(process.argv.includes("--help")){console.log("Usage: npm run content:check-article-links -- --file final.json (--universe-id N | --namespace X --game-slug Y [--kind game|franchise])");return;}
  const options=parseArticleContextArgs(process.argv.slice(2));if(!options.file)throw new Error("--file is required.");
  const final=JSON.parse(await fs.readFile(options.file,"utf8"));
  const result=await assertArticleLinks(final,options.scope);console.log(`PASS ${result.count} internal article links.`);
}main().catch(e=>{console.error(e.message);process.exitCode=1;});

import "../shared/load-env";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { publicationSitemap, verifyPublicText } from "./public-readback.mjs";
import { wikiPublicationReceipt, wikiPublicationFailure } from "./wiki-publication-receipt";
import { createHash } from "node:crypto";
import { batchPath, ownedPath, parseBatch } from "./content-contract.mjs";
import { assertProductionPublication } from "./publication-guard";
import { revalidatePublishedContent } from "../shared/revalidate-published-content";
import { resolveArticleDevCredentials } from "../articles/article-queue-env";
import { stageChecklist, verifyChecklists } from "./managed-checklists";
import { ensureArticleGameIdentity } from "../articles/article-game-identity";
import { contentDigest } from "./managed-content-receipt.mjs";

const args = process.argv.slice(2);
const file = batchPath(args[args.indexOf("--batch") + 1]);
const apply = args.includes("--apply");
const managed = args.includes("--managed");
const stage = args.includes("--stage");
const root = process.cwd();
const base = path.dirname(file);
const batch = parseBatch(JSON.parse(fs.readFileSync(file, "utf8")));
const realBase = fs.realpathSync(base);
let wikiRequestValidated = false;
process.env.BLOXODES_ARTIFACT_ROOT = path.resolve(base);
// Every input in the bundle must be a regular committed file inside this batch.
function inspect(directory: string) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const name = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error("Content bundles cannot contain symlinks.");
    if (entry.isDirectory()) inspect(name);
    else {
      if (process.env.BLOXODES_VERIFIED_BUNDLE !== path.basename(base)) execFileSync("git", ["ls-files", "--error-unmatch", "--", name], { stdio: "pipe" });
      if (!fs.realpathSync(name).startsWith(`${realBase}${path.sep}`)) throw new Error("Input escapes the approved bundle.");
    }
  }
}
inspect(base);
if (managed) {
  if (process.env.SUPABASE_URL !== "https://bbtcaurrtyoukvjbxbbj.supabase.co" || apply) throw new Error("Managed QA requires the intended development target and cannot apply a production release.");
  if (stage && (process.env.GITHUB_ACTIONS !== "true" || process.env.BLOXODES_MANAGED_QA !== "true")) throw new Error("Managed staging runs only in the selected GitHub QA job.");
} else if (apply) {
  assertProductionPublication();
  if (!batch.operations.length) throw new Error("A verification-only batch cannot publish content.");
  const receipt=JSON.parse(fs.readFileSync(process.env.BLOXODES_MANAGED_RECEIPT!,"utf8"));
  if(receipt.status!=="passed" || receipt.sha!==process.env.BLOXODES_APPROVED_SHA || receipt.runId!==process.env.GITHUB_RUN_ID || receipt.digest!==contentDigest(base)) throw new Error("The exact selected inputs have no successful development QA receipt.");
}
let executionBase=base;
const inputPath = (input: string) => ownedPath(executionBase, input);
function command(operation: any, write: boolean): string[] {
  const file = operation.file ? inputPath(operation.file) : "";
  const prod = write && !managed ? ["--allow-prod"] : [];
  switch (operation.publisher) {
    case "events-final": return ["ci:events:publish", "--file", file, ...(write ? ["--apply"] : [])];
    case "roblox-codes-page": return ["upsert:code-page", "--file", file, ...(write ? [] : ["--dry-run"])];
    case "article-queue": return managed ? ["import:content-final", "--file", file, ...(write ? [] : ["--dry-run"])] : ["articles:release", "--queue-id", operation.queueId, ...(write ? ["--apply", "--allow-prod"] : [])];
    case "game-pages": return ["publish:game-pages", "--namespace", operation.namespace, "--file", file, ...(write ? ["--apply", ...prod] : [])];
    case "content-final": return ["import:content-final", "--file", file, ...(write ? prod : ["--dry-run", ...(!managed ? ["--allow-prod"] : [])])];
    case "roblox-wiki": return ["sync:game-wiki-runtime", "--final-json", file, ...(write ? ["--apply", ...prod] : [])];
    case "roblox-collection": return ["sync:game-collection-runtime", "--normalize-legacy-media", "--manifest", file, ...(write ? ["--apply", "--upload-media", "--publish", ...prod] : [])];
    case "franchise-wiki": return ["publish:franchise-wiki-hubs", "--namespace", operation.namespace, "--workspace", inputPath(operation.workspace), ...operation.games.flatMap((slug: string) => ["--game", slug]), ...(write ? ["--apply", ...prod] : [])];
    case "franchise-collection": return ["sync:franchise-collection-runtime", "--namespace", operation.namespace, "--manifest", file, ...(write ? ["--apply", "--upload-media", "--publish", ...prod] : [])];
    case "minecraft-tools": return ["publish:minecraft-tools", "--final", file, ...(write ? ["--apply", ...prod] : [])];
    case "catalog": return ["seed:catalog-pages", "--file", file, ...(write ? prod : ["--dry-run"])];
    case "tool-finals": return ["import:tool-finals", "--file", file, ...(write ? prod : ["--dry-run"])];
    default: throw new Error("Unsupported publisher.");
  }
}
async function run(operation: any, write: boolean) {
  if (operation.publisher === "roblox-codes-page" && !write) {
    const payload = JSON.parse(fs.readFileSync(inputPath(operation.file), "utf8"));
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(payload.slug ?? "")) throw new Error("Codes setup requires an exact reviewed editorial slug.");
  }
  if (operation.publisher === "article-queue" && !write) {
    execFileSync(process.execPath, ["--import", "tsx", "scripts/ci/verify-article-bundle.ts", operation.queueId, operation.file, file], { env: process.env, stdio: "inherit" });
    return;
  }
  let selected=operation;
  let stagedFile: string | null=null;
  if(managed && write && operation.file) {
    if(operation.publisher==='article-queue') {
      const final=inputPath(operation.file);
      await ensureArticleGameIdentity(JSON.parse(fs.readFileSync(final,'utf8')).universe_id,process.env);
      execFileSync('npm',['run','content:check-copy','--',final],{env:process.env,stdio:'inherit'});
      execFileSync('npm',['run','check:article-image-readiness','--','--manifest',path.join(path.dirname(final),'media.json'),'--file',final],{env:process.env,stdio:'inherit'});
    }
    stagedFile=await stageChecklist(operation,inputPath(operation.file));
  }
  const [script, ...options] = command(selected, write);
  if(stagedFile) options[options.indexOf('--file')+1]=stagedFile;
  execFileSync("npm", ["run", script!, "--", ...options], { cwd: root, env: { ...process.env, BLOXODES_DEFER_ARTICLE_ACK: "true" }, stdio: "inherit" });
  if (write && operation.publisher === "roblox-codes-page") {
    const payload = JSON.parse(fs.readFileSync(inputPath(operation.file), "utf8"));
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(payload.slug ?? "")) throw new Error("Codes refresh needs an exact reviewed editorial slug.");
    execFileSync("npm", ["run", "refresh:codes", "--", "--slug", payload.slug, ...(!managed ? ["--allow-prod"] : [])], { env: process.env, stdio: "inherit" });
  }
}
async function main() {
  console.log(`Selected batch ${file}; SHA-256 ${createHash("sha256").update(fs.readFileSync(file)).digest("hex")}; ${batch.operations.length} operations.`);
  if (apply) {
    await wikiPublicationReceipt(batch.wikiReceipt,batch,base);
    wikiRequestValidated = Boolean(batch.wikiReceipt);
  }
  // Prove every selected publisher before the first production write.
  for (const operation of batch.operations) await run(operation, false);
  if (managed) {
    if(stage) {
      executionBase=path.join(process.env.RUNNER_TEMP!,'managed-selected-inputs');
      fs.cpSync(base,executionBase,{recursive:true});
      process.env.BLOXODES_ARTIFACT_ROOT=executionBase;
      for(const operation of batch.operations) await run(operation,true);
      await verifyChecklists();
      const entries=fs.existsSync(path.join(process.env.RUNNER_TEMP!,'managed-checklists.json')) ? JSON.parse(fs.readFileSync(path.join(process.env.RUNNER_TEMP!,'managed-checklists.json'),'utf8')) : [];
      const urls=batch.urls.map((url:any)=>({...url,path:entries.find((entry:any)=>entry.originalPath===url.path)?.path??url.path}));
      for(const entry of entries) if(!batch.urls.some((url:any)=>url.path===entry.originalPath)) throw new Error('Every checklist requires its selected canonical URL.');
      fs.writeFileSync(path.join(process.env.RUNNER_TEMP!,'managed-smoke.json'),JSON.stringify({...batch,urls}));
    }
    return;
  }
  if (apply) {
    for (const operation of batch.operations) await run(operation, true);
    await revalidatePublishedContent(process.env, batch.events);
  }
  for (const url of batch.urls) {
    await verifyPublicText(url.path, url.contains);
    console.log(`Verified https://bloxodes.com${url.path}`);
    execFileSync("npm", ["run", "verify:published-url", "--", "--path", url.path, "--sitemap", publicationSitemap(url.path), "--base-url", "https://bloxodes.com"], { env: process.env, stdio: "inherit" });
  }
  // Queue acknowledgement follows the selected desktop/mobile browser checks.
  execFileSync("npx", ["playwright", "test", "apps/web/e2e/release-smoke.spec.ts"], {
    env: { ...process.env, TEST_BASE_URL: "https://bloxodes.com", PLAYWRIGHT_SKIP_WEBSERVER: "1", RELEASE_SMOKE_BATCH: path.resolve(file) },
    stdio: "inherit",
  });
  if (apply) for (const operation of batch.operations) {
    if (operation.publisher !== "article-queue") continue;
    const final = JSON.parse(fs.readFileSync(inputPath(operation.file), "utf8"));
    const productionUrl = `https://bloxodes.com/articles/${final.slug}`;
    if (!batch.urls.some((url: {path: string}) => `https://bloxodes.com${url.path}` === productionUrl)) throw new Error("Article acknowledgement requires its selected verified URL.");
    const dev = resolveArticleDevCredentials();
    execFileSync("npm", ["run", "articles:queue:update", "--", "--queue-id", operation.queueId, "--status", "published", "--production-url", productionUrl, "--apply"], {
      env: { ...process.env, SUPABASE_URL: dev.url, SUPABASE_SERVICE_ROLE: dev.serviceRole }, stdio: "inherit",
    });
  }
  if (apply) await wikiPublicationReceipt(batch.wikiReceipt,batch,base,batch.urls.map((url: { path: string }) => `https://bloxodes.com${url.path}`));
}
main().catch(async error => {
  console.error(error.message);
  process.exitCode = 1;
  if (apply && wikiRequestValidated) await wikiPublicationFailure(batch.wikiReceipt).catch(() => console.error("Could not record the failed wiki CI publication."));
});

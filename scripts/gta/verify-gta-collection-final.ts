import "../shared/load-env";

import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { isManagedDevelopmentSupabaseUrl } from "../shared/supabase-target";

type Options = { baseUrl: string; game: string; collection: string; workspace: string; allowMissingImages: boolean };

function parseArgs(argv: string[]): Options {
  const values = new Map<string, string>();
  let allowMissingImages = false;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (["--base-url", "--game", "--collection", "--workspace"].includes(arg)) values.set(arg, argv[++index] ?? "");
    else if (arg === "--allow-missing-images") allowMissingImages = true;
    else if (arg === "--help" || arg === "-h") {
      console.log("Usage: npm run verify:gta-collection-final -- --base-url http://localhost:3000 --game gta-5 --collection weapons --workspace tmp/content-workspace/gta/gta-5/collections/weapons [--allow-missing-images]");
      process.exit(0);
    } else throw new Error(`Unknown option: ${arg}`);
  }
  const baseUrl = values.get("--base-url") ?? "";
  const game = (values.get("--game") ?? "").trim().toLowerCase();
  const collection = (values.get("--collection") ?? "").trim().toLowerCase();
  const workspace = values.get("--workspace") ?? "";
  if (!baseUrl || !game || !collection || !workspace) throw new Error("--base-url, --game, --collection, and --workspace are required.");
  return { baseUrl: new URL(baseUrl).toString().replace(/\/$/, ""), game, collection, workspace: path.resolve(workspace), allowMissingImages };
}

async function run(command: string, args: string[], extraEnv?: Record<string, string>) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { cwd: process.cwd(), env: { ...process.env, ...extraEnv }, shell: false, stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`${command} exited with ${code}`)));
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!isManagedDevelopmentSupabaseUrl(process.env.SUPABASE_URL)) throw new Error("GTA collection verification writes only to managed development.");
  const manifest = path.join(options.workspace, "runtime-manifest.json");
  const dataset = path.join(options.workspace, "dataset.json");
  const finalJson = path.join(options.workspace, "final.json");
  const final = JSON.parse(await readFile(finalJson, "utf8")) as { title?: string; display_name?: string };
  const manifestDocument = JSON.parse(await readFile(manifest, "utf8")) as { collection?: { pageType?: string } };
  const expectedPageType = manifestDocument.collection?.pageType === "checklist" ? "checklist" : "database";
  await run("npm", ["run", "content:check-copy", "--", finalJson]);
  await run("npm", ["run", "audit:game-collection-datasets:v2", "--", "--game", options.game, "--collection", options.collection, "--file", dataset]);
  const checkArgs = ["run", "check:game-collection-data", "--", "--game", options.game, "--collection", options.collection, "--file", dataset, "--final-json", finalJson];
  if (!options.allowMissingImages) checkArgs.push("--require-images");
  await run("npm", checkArgs);
  await run("npm", ["run", "sync:gta-collection-runtime", "--", "--manifest", manifest]);
  await run(
    "npm",
    ["run", "sync:gta-collection-runtime", "--", "--manifest", manifest, "--apply", "--upload-media", "--publish"],
    { BLOXODES_ENV_OVERLAYS: "cloudflare" }
  );
  const sb = supabaseAdmin();
  const page = await sb.from("gta_wiki_collection_pages").select("id, title, display_name, item_count, published_dataset_id, is_published, page_type").eq("wiki_slug", options.game).eq("collection_slug", options.collection).single();
  if (page.error) throw page.error;
  if (!page.data.is_published || !page.data.published_dataset_id || page.data.item_count < 1) throw new Error("GTA collection page readback failed.");
  if (page.data.page_type !== expectedPageType) throw new Error(`GTA collection page type mismatch: ${page.data.page_type ?? "missing"} != ${expectedPageType}.`);
  const items = await sb.from("gta_wiki_collection_items").select("id", { count: "exact", head: true }).eq("dataset_id", page.data.published_dataset_id);
  if (items.error) throw items.error;
  if (items.count !== page.data.item_count) throw new Error("GTA collection item readback count does not match the page.");
  const expectedTitle = final.title?.replaceAll("{count}", page.data.item_count.toLocaleString("en-US"));
  if (expectedTitle && page.data.title !== expectedTitle) throw new Error("GTA collection title token was not resolved correctly.");
  if (final.display_name && page.data.display_name !== final.display_name) throw new Error("GTA collection display name mismatch.");
  const url = `${options.baseUrl}/gta/wiki/${options.game}/${options.collection}`;
  const response = await fetch(url, { redirect: "follow" });
  const html = await response.text();
  if (response.status !== 200 || (expectedTitle && !html.includes(expectedTitle))) throw new Error(`${url} failed route verification (HTTP ${response.status}).`);
  if (expectedPageType === "checklist") {
    const pageTwo = await fetch(`${url}/page/2`, { redirect: "manual" });
    if (pageTwo.status !== 404) throw new Error(`${url}/page/2 should return 404 for a checklist.`);
  }
  console.log(`Verified GTA collection: ${url}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

import "../shared/load-env";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { isManagedDevelopmentSupabaseUrl } from "../shared/supabase-target";

type Namespace = "gta" | "red-dead";
type Config = { label: string; routePrefix: string; tablePrefix: string };
const CONFIGS: Record<Namespace, Config> = {
  gta: { label: "GTA", routePrefix: "/gta/wiki", tablePrefix: "gta" },
  "red-dead": { label: "Red Dead", routePrefix: "/red-dead/wiki", tablePrefix: "red_dead" }
};

type Manifest = { schemaVersion?: number; namespace?: Namespace; game?: { slug?: string }; collection?: { slug?: string; pageType?: "database" | "collectible" } };
type FinalJson = { code?: string; display_name?: string; title?: string };

const argv = process.argv.slice(2);
function flag(name: string): string {
  const index = argv.indexOf(name);
  return index === -1 ? "" : (argv[index + 1] ?? "").trim();
}
function required(name: string): string {
  const result = flag(name);
  if (!result) throw new Error(`${name} is required.`);
  return result;
}
if (argv.includes("--help") || argv.includes("-h")) {
  console.log("Usage: npm run verify:franchise-collection-final -- --namespace <gta|red-dead> --base-url <url> --game <slug> --collection <slug> --workspace <dir> [--allow-missing-images]");
  process.exit(0);
}
const namespace = required("--namespace") as Namespace;
if (!(namespace in CONFIGS)) throw new Error("--namespace must be gta or red-dead.");
const config = CONFIGS[namespace];
const baseUrl = new URL(required("--base-url")).toString().replace(/\/$/, "");
const gameSlug = required("--game").toLowerCase();
const collectionSlug = required("--collection").toLowerCase();
const workspace = path.resolve(required("--workspace"));
const allowMissingImages = argv.includes("--allow-missing-images");

function tableName(suffix: string): string {
  return `${config.tablePrefix}_${suffix}`;
}
function resolveCountTokens(value: string, count: number): string {
  return value.replace(/\{\{\s*(?:count|item_count)\s*\}\}|\{\s*(?:count|item_count)\s*\}/gi, count.toLocaleString("en-US"));
}
async function main() {
  if (!isManagedDevelopmentSupabaseUrl(process.env.SUPABASE_URL)) throw new Error(`${config.label} collection verification writes only to managed development.`);
  const manifestPath = path.join(workspace, "runtime-manifest.json");
  const datasetPath = path.join(workspace, "dataset.json");
  const finalPath = path.join(workspace, "final.json");
  const [manifest, final] = await Promise.all([
    readFile(manifestPath, "utf8").then((value) => JSON.parse(value) as Manifest),
    readFile(finalPath, "utf8").then((value) => JSON.parse(value) as FinalJson)
  ]);
  if (manifest.schemaVersion !== 1 || manifest.namespace && manifest.namespace !== namespace || manifest.game?.slug !== gameSlug || manifest.collection?.slug !== collectionSlug) {
    throw new Error("runtime-manifest.json identity does not match the requested collection.");
  }
  const dataset = JSON.parse(await readFile(datasetPath, "utf8")) as { meta?: Record<string, unknown>; items?: Array<{ item?: Record<string, unknown>; system?: { image?: string | null } }> };
  if (dataset.meta?.schemaVersion !== 2 || !Array.isArray(dataset.items) || !dataset.items.length) throw new Error("dataset.json must be a non-empty schemaVersion 2 dataset.");
  if (!allowMissingImages) {
    const missing = dataset.items.filter((row) => !row.system?.image).length;
    if (missing) throw new Error(`${missing} collection rows do not have an image; pass --allow-missing-images only for an explicitly accepted gap.`);
  }
  if (final.code !== `${gameSlug}-${collectionSlug}` || !final.display_name?.trim() || !final.title?.trim()) throw new Error("final.json identity, display_name, and title are required.");

  const sb = supabaseAdmin();
  const page = await sb.from(tableName("wiki_collection_pages")).select("id, title, display_name, item_count, published_dataset_id, is_published, page_type").eq("wiki_slug", gameSlug).eq("collection_slug", collectionSlug).single();
  if (page.error) throw page.error;
  if (!page.data.is_published || !page.data.published_dataset_id || page.data.item_count < 1) throw new Error("Published collection page readback failed.");
  const expectedPageType = ["collectible", "checklist"].includes(String(manifest.collection?.pageType)) ? "collectible" : "database";
  if (page.data.page_type !== expectedPageType) throw new Error(`Collection page type mismatch: ${page.data.page_type ?? "missing"} != ${expectedPageType}.`);
  const items = await sb.from(tableName("wiki_collection_items")).select("id", { count: "exact", head: true }).eq("dataset_id", page.data.published_dataset_id);
  if (items.error) throw items.error;
  if (items.count !== page.data.item_count || items.count !== dataset.items.length) throw new Error("Published collection item count does not match the authoring dataset.");
  const expectedTitle = resolveCountTokens(final.title, page.data.item_count);
  if (page.data.title !== expectedTitle || page.data.display_name !== final.display_name) throw new Error("Published collection copy readback failed.");

  const url = `${baseUrl}${config.routePrefix}/${gameSlug}/${collectionSlug}`;
  const response = await fetch(url, { redirect: "follow" });
  const html = await response.text();
  if (response.status !== 200 || !html.includes(expectedTitle)) throw new Error(`${url} failed route verification (HTTP ${response.status}).`);
  if (expectedPageType === "collectible") {
    const pageTwo = await fetch(`${url}/page/2`, { redirect: "manual" });
    if (pageTwo.status !== 404) throw new Error(`${url}/page/2 should return 404 for a collectible collection.`);
  }
  console.log(`Verified ${config.label} collection: ${url}`);
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

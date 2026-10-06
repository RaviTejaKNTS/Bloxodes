import { gameDatabase, type gameTables } from "@/lib/game-content-db";
import "../shared/load-env";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { isManagedDevelopmentSupabaseUrl } from "../shared/supabase-target";
import { minecraftCollectionTitleForCount } from "../../apps/web/src/lib/minecraft-edition";

type Namespace = string;
type Config = { label: string; routePrefix: string };
const CONFIGS: Record<Namespace, Config> = {
  gta: { label: "GTA", routePrefix: "/gta/wiki" },
  minecraft: { label: "Minecraft", routePrefix: "/minecraft/wiki" },
  "red-dead": { label: "Red Dead", routePrefix: "/red-dead/wiki" }
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
  console.log("Usage: npm run verify:franchise-collection-final -- --namespace <game-namespace> --base-url <url> --game <slug> --collection <slug> --workspace <dir> [--allow-missing-images]");
  process.exit(0);
}
const namespace = required("--namespace") as Namespace;
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(namespace) || namespace === "roblox") throw new Error("Invalid non-Roblox namespace");
const config = CONFIGS[namespace] ?? {label: namespace, routePrefix: `/${namespace}/wiki`};
const baseUrl = new URL(required("--base-url")).toString().replace(/\/$/, "");
const gameSlug = required("--game").toLowerCase();
const collectionSlug = required("--collection").toLowerCase();
const workspace = path.resolve(required("--workspace"));
const allowMissingImages = argv.includes("--allow-missing-images");

function tableName(suffix: string): keyof typeof gameTables {
  return suffix as keyof typeof gameTables;
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

  const sb = gameDatabase(supabaseAdmin(), namespace);
  const page = await sb.from(tableName("wiki_collection_pages")).select("id, title, display_name, item_count, published_dataset_id, is_published, page_type, canonical_path").eq("wiki_slug", gameSlug).eq("collection_slug", collectionSlug).single();
  if (page.error) throw page.error;
  if (!page.data.is_published || !page.data.published_dataset_id || page.data.item_count < 1) throw new Error("Published collection page readback failed.");
  const expectedPageType = ["collectible", "checklist"].includes(String(manifest.collection?.pageType)) ? "collectible" : "database";
  if (page.data.page_type !== expectedPageType) throw new Error(`Collection page type mismatch: ${page.data.page_type ?? "missing"} != ${expectedPageType}.`);
  const items = await sb.from(tableName("wiki_collection_items")).select("id", { count: "exact", head: true }).eq("dataset_id", page.data.published_dataset_id);
  if (items.error) throw items.error;
  if (items.count !== page.data.item_count || items.count !== dataset.items.length) throw new Error("Published collection item count does not match the authoring dataset.");
  const expectedTitle = resolveCountTokens(final.title, page.data.item_count);
  if (page.data.title !== expectedTitle || page.data.display_name !== final.display_name) throw new Error("Published collection copy readback failed.");

  const url = `${baseUrl}${page.data.canonical_path}`;
  const response = await fetch(url, { redirect: "follow" });
  const html = await response.text();
  const javaCount = dataset.items.filter(row => !Array.isArray(row.item?.editions) || row.item.editions.includes("java")).length;
  const renderedTitle = namespace === "minecraft" && gameSlug === "minecraft" ? minecraftCollectionTitleForCount(expectedTitle, dataset.items.length, javaCount || dataset.items.length) : expectedTitle;
  if (response.status !== 200 || !html.includes(renderedTitle)) throw new Error(`${url} failed route verification (HTTP ${response.status}).`);
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

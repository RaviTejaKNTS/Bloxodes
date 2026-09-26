import "../shared/load-env";

import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { isManagedDevelopmentSupabaseUrl } from "../shared/supabase-target";

type Planned = { code: string; items: number; contentHash: string };
type Final = Record<string, unknown>;
async function main() {
const argv = process.argv.slice(2);
const mapIndex = argv.indexOf("--map");
if (mapIndex < 0 || !argv[mapIndex + 1]) throw new Error("Usage: npm run verify:gta-collection-runtime -- --map <authoritative-map.json>");
if (!isManagedDevelopmentSupabaseUrl(process.env.SUPABASE_URL)) throw new Error("This readback is limited to managed development.");
const mapping = JSON.parse(await fs.readFile(path.resolve(argv[mapIndex + 1]), "utf8")) as Record<string, string>;
const manifests = Object.entries(mapping).map(([code, dataset]) => ({ code, path: path.resolve(path.dirname(dataset), "runtime-manifest.json"), final: path.resolve(path.dirname(dataset), "final.json") }));
const planned = new Map<string, Planned>();
// Planning prepares image bytes. Bound each child process so a catalog-wide
// readback does not retain all of its media in memory at once.
for (let start = 0; start < manifests.length; start += 20) {
  const batch = manifests.slice(start, start + 20);
  const output = execFileSync(process.execPath, ["--import", "tsx", "scripts/gta/sync-gta-collection-runtime.ts", ...batch.flatMap((m) => ["--manifest", m.path])], { encoding: "utf8", maxBuffer: 10_000_000 });
  for (const line of output.split("\n")) {
    const match = line.match(/│\s*\d+\s*│\s*'([^']+)'\s*│\s*(\d+)\s*│\s*\d+\s*│\s*'([a-f0-9]{64})'\s*│/);
    if (match) planned.set(match[1], { code: match[1], items: Number(match[2]), contentHash: match[3] });
  }
  console.log(`Planned ${planned.size}/${manifests.length} authoritative GTA collections.`);
}
if (planned.size !== manifests.length) throw new Error(`Parsed ${planned.size}/${manifests.length} plans.`);
const sb = supabaseAdmin();
const pageResult = await sb.from("gta_wiki_collection_pages").select("id, code, page_type, is_published, item_count, published_dataset_id, title, display_name, seo_title, meta_description, intro_md, description_md, how_it_works_md, description_json, faq_json, wiki_md").eq("is_published", true).range(0, 999);
if (pageResult.error) throw pageResult.error;
const pages = new Map((pageResult.data ?? []).map((page) => [page.code, page]));
const datasetIds = [...pages.values()].map((page) => page.published_dataset_id).filter(Boolean);
const datasets = new Map<string, { id: string; content_hash: string; item_count: number }>();
for (let start = 0; start < datasetIds.length; start += 100) {
  const result = await sb.from("gta_wiki_collection_datasets").select("id, content_hash, item_count").in("id", datasetIds.slice(start, start + 100));
  if (result.error) throw result.error;
  for (const row of result.data ?? []) datasets.set(row.id, row);
}
function withCount(value: unknown, count: number): unknown {
  if (typeof value === "string") return value.replaceAll("{count}", count.toLocaleString("en-US"));
  if (Array.isArray(value)) return value.map((v) => withCount(v, count));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, withCount(v, count)]));
  return value;
}
function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, stable(v)]));
  return value;
}
const mismatches: string[] = [];
for (const manifest of manifests) {
  const plan = planned.get(manifest.code)!;
  const page = pages.get(manifest.code);
  if (!page) { mismatches.push(`${manifest.code}: no published page`); continue; }
  const localManifest = JSON.parse(await fs.readFile(manifest.path, "utf8")) as { collection?: { pageType?: string } };
  const expectedPageType = localManifest.collection?.pageType ?? "database";
  if (page.page_type !== expectedPageType) mismatches.push(`${manifest.code}: page type local ${expectedPageType}, published ${page.page_type}`);
  const dataset = datasets.get(page.published_dataset_id);
  if (!dataset) { mismatches.push(`${manifest.code}: no pointed dataset`); continue; }
  if (page.item_count !== plan.items || dataset.item_count !== plan.items) mismatches.push(`${manifest.code}: item count local ${plan.items}, page ${page.item_count}, dataset ${dataset.item_count}`);
  if (dataset.content_hash !== plan.contentHash) mismatches.push(`${manifest.code}: content hash local ${plan.contentHash}, published ${dataset.content_hash}`);
  const final = withCount(JSON.parse(await fs.readFile(manifest.final, "utf8")) as Final, plan.items) as Final;
  for (const key of ["title", "display_name", "seo_title", "meta_description", "intro_md", "description_md", "how_it_works_md", "description_json", "faq_json", "wiki_md"]) {
    if (JSON.stringify(stable(page[key])) !== JSON.stringify(stable(final[key] ?? null))) mismatches.push(`${manifest.code}: ${key} differs from final.json`);
  }
}
for (const code of pages.keys()) if (!planned.has(code)) mismatches.push(`${code}: published without authoritative workspace`);
const report = { planned: planned.size, published: pages.size, pointedDatasets: datasets.size, items: [...planned.values()].reduce((sum, p) => sum + p.items, 0), mismatches };
console.log(JSON.stringify(report, null, 2));
if (mismatches.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

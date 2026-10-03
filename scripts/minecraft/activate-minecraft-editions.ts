import "../shared/load-env";
import { readFile } from "node:fs/promises";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { isManagedDevelopmentSupabaseUrl, isProductionSupabaseUrl } from "../shared/supabase-target";

async function main() {
  const args = process.argv.slice(2), marker = args.indexOf("--allowlist");
  if (marker < 0 || !args[marker + 1]) throw new Error("Pass the exact reviewed --allowlist <json>. Planning is the default.");
  const expected = JSON.parse(await readFile(args[marker + 1], "utf8")) as Array<{ code: string; content_hash: string; item_count: number }>;
  if (!Array.isArray(expected) || expected.length !== 48 || new Set(expected.map(row => row.code)).size !== 48 || expected.some(row => !/^minecraft-(java|bedrock)-[a-z0-9-]+$/.test(row.code) || !/^[a-f0-9]{64}$/.test(row.content_hash) || !Number.isSafeInteger(row.item_count) || row.item_count < 1)) throw new Error("Invalid edition revision allowlist.");
  const production = isProductionSupabaseUrl(process.env.SUPABASE_URL);
  if (!production && !isManagedDevelopmentSupabaseUrl(process.env.SUPABASE_URL)) throw new Error("Unknown database target.");
  if (production && args.includes("--apply") && !args.includes("--allow-prod")) throw new Error("Production apply requires --allow-prod.");
  if (!production && args.includes("--allow-prod")) throw new Error("Production guard requires the production target.");
  const db = supabaseAdmin();
  const pages = await db.from("minecraft_wiki_collection_pages").select("id, code, item_count").in("code", expected.map(row => row.code));
  if (pages.error) throw pages.error;
  if (pages.data.length !== 48) throw new Error("Stage every reviewed collection before activation.");
  const datasets = await db.from("minecraft_wiki_collection_datasets").select("id, collection_page_id, content_hash, item_count").in("collection_page_id", pages.data.map(row => row.id));
  if (datasets.error) throw datasets.error;
  for (const row of expected) {
    const page = pages.data.find(page => page.code === row.code);
    if (!page || page.item_count !== row.item_count || !datasets.data.some(dataset => dataset.collection_page_id === page.id && dataset.content_hash === row.content_hash && dataset.item_count === row.item_count)) throw new Error(`Staged revision mismatch for ${row.code}.`);
  }
  console.log(`${args.includes("--apply") ? "Apply" : "Plan"}: activate 2 hubs and 48 exact revisions; archive the legacy parent in one transaction.`);
  if (!args.includes("--apply")) return;
  const activated = await db.rpc("activate_minecraft_edition_migration", { expected });
  if (activated.error) throw activated.error;
  console.log(JSON.stringify(activated.data));
}
void main().catch(error => { console.error(error); process.exitCode = 1; });

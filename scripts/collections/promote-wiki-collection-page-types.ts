import "../shared/load-env";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { isManagedDevelopmentSupabaseUrl, isProductionSupabaseUrl } from "../shared/supabase-target";

const CHECKLIST_CODES = [
  "1-speed-keyboard-escape-stages",
  "1-speed-monkey-escape-sunken-shards",
  "anime-expeditions-achievements",
  "anime-vanguards-achievements",
  "bee-swarm-simulator-bees",
  "blox-fruits-quest-items",
  "brookhaven-rp-secrets",
  "build-a-ring-farm-skill-tree",
  "catch-and-tame-island-keys",
  "catch-and-tame-pets",
  "evomon-monsters",
  "fish-it-fish",
  "forsaken-milestones",
  "grow-a-garden-2-plot-expansions",
  "grow-a-garden-plot-expansions",
  "jujutsu-shenanigans-achievements",
  "pet-simulator-99-shiny-relics",
  "sell-lemons-secret-unlocks",
  "storage-hunters-open-world-lost-items"
] as const;

const EXPECTED_ITEM_COUNT = 1_134;
const argv = new Set(process.argv.slice(2));
const apply = argv.has("--apply");
const allowProd = argv.has("--allow-prod");

if (argv.has("--help") || argv.has("-h")) {
  console.log("Usage: npm run promote:wiki-collection-page-types [--apply] [--allow-prod]");
  process.exit(0);
}
for (const arg of argv) {
  if (!["--apply", "--allow-prod", "--help", "-h"].includes(arg)) throw new Error(`Unknown option: ${arg}`);
}

type PageRow = {
  code: string;
  page_type: "database" | "checklist";
  item_count: number;
  is_published: boolean;
  published_dataset_id: string | null;
};

async function readRows(): Promise<PageRow[]> {
  const result = await supabaseAdmin()
    .from("wiki_collection_pages")
    .select("code,page_type,item_count,is_published,published_dataset_id")
    .in("code", [...CHECKLIST_CODES]);
  if (result.error) throw result.error;
  return (result.data ?? []) as PageRow[];
}

function verifyRows(rows: PageRow[], expectedType?: "checklist") {
  const byCode = new Map(rows.map((row) => [row.code, row]));
  const missing = CHECKLIST_CODES.filter((code) => !byCode.has(code));
  if (missing.length) throw new Error(`Missing checklist page rows: ${missing.join(", ")}`);
  const invalid = rows.filter((row) => !row.is_published || !row.published_dataset_id || row.item_count <= 0);
  if (invalid.length) throw new Error(`Checklist rows are not publication-ready: ${invalid.map((row) => row.code).join(", ")}`);
  const itemCount = rows.reduce((sum, row) => sum + row.item_count, 0);
  if (itemCount !== EXPECTED_ITEM_COUNT) {
    throw new Error(`Checklist item total changed: expected ${EXPECTED_ITEM_COUNT}, found ${itemCount}.`);
  }
  if (expectedType) {
    const wrongType = rows.filter((row) => row.page_type !== expectedType);
    if (wrongType.length) throw new Error(`Checklist readback failed: ${wrongType.map((row) => row.code).join(", ")}`);
  }
}

async function main() {
  const managed = isManagedDevelopmentSupabaseUrl(process.env.SUPABASE_URL);
  const production = isProductionSupabaseUrl(process.env.SUPABASE_URL);
  if (!managed && !production) throw new Error("Unrecognized Supabase target.");
  if (allowProd && (!apply || !production)) throw new Error("--allow-prod requires --apply and the recognized production target.");
  if (apply && production && !allowProd) throw new Error("Production checklist writes require --allow-prod.");

  const before = await readRows();
  verifyRows(before);
  const counts = before.reduce<Record<string, number>>((result, row) => {
    result[row.page_type] = (result[row.page_type] ?? 0) + 1;
    return result;
  }, {});
  console.log(`Planned ${CHECKLIST_CODES.length} Roblox checklist page-type updates for ${production ? "production" : "managed development"}.`);
  console.log(`Current types: ${JSON.stringify(counts)}; tracked items: ${EXPECTED_ITEM_COUNT}.`);
  if (!apply) {
    console.log("Dry run complete; no rows were changed.");
    return;
  }

  const updated = await supabaseAdmin()
    .from("wiki_collection_pages")
    .update({ page_type: "checklist" })
    .in("code", [...CHECKLIST_CODES])
    .eq("is_published", true)
    .select("code");
  if (updated.error) throw updated.error;
  if ((updated.data ?? []).length !== CHECKLIST_CODES.length) throw new Error("Checklist update count mismatch.");

  const after = await readRows();
  verifyRows(after, "checklist");
  console.log(`Applied and verified ${after.length} Roblox checklist page-type updates.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

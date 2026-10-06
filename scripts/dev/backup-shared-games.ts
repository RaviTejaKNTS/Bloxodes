import "../shared/load-env";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { assertManagedDevelopmentSupabaseUrl } from "../shared/supabase-target";

const url = process.env.SUPABASE_URL;
assertManagedDevelopmentSupabaseUrl(url, "shared games backup");
if (new URL(url).hostname !== "bbtcaurrtyoukvjbxbbj.supabase.co") throw new Error("Unexpected development project");
const sb = createClient(url, process.env.SUPABASE_SERVICE_ROLE!, { auth: { persistSession: false } });
const legacyTables = ["gta_games", "red_dead_games", "minecraft_games", ...["gta", "red_dead", "minecraft"].flatMap(prefix => ["wiki_pages", "wiki_collection_pages", "wiki_collection_datasets", "wiki_collection_items"].map(suffix => `${prefix}_${suffix}`)), "gta_checklist_pages", "gta_checklist_items", "minecraft_tools", "minecraft_releases", "user_gta_collection_progress", "user_red_dead_collection_progress", "comments", "user_checklist_progress"];
const legacy = process.argv.includes("--legacy-before-migration");
const tables = legacy ? legacyTables : ["games", "game_wiki_pages", "game_collection_pages", "game_collection_datasets", "game_collection_items", "game_checklist_pages", "game_checklist_items", "game_tool_pages", "game_releases", "game_collection_progress", "game_code_pages", "game_codes", "comments", "user_checklist_progress"];
async function main() {
const root = path.resolve(legacy ? "tmp/shared-games/before/data" : `tmp/shared-games/backups/${new Date().toISOString().replaceAll(":", "-")}`);
await fs.mkdir(root, { recursive: true, mode: 0o700 });
const receipts = [];
for (const table of tables) {
  const rows: unknown[] = [];
  const { count, error: countError } = await sb.from(table).select("*", { count: "exact", head: true });
  if (countError) throw countError;
  const order = table.endsWith("releases") ? "edition" : table.includes("progress") ? "user_id" : "id";
  for (let offset = 0; offset < (count ?? 0); offset += 1000) {
    let query = sb.from(table).select("*");
    if (table === "game_releases" || table === "game_collection_progress") query = query.order("namespace");
    query = query.order(order);
    if (table.endsWith("releases")) query = query.order("release_order");
    if (table.includes("progress")) query = query.order(table === "user_checklist_progress" ? "checklist_slug" : "collection_code");
    const { data, error } = await query.range(offset, offset + 999);
    if (error) throw error;
    rows.push(...data);
  }
  if (rows.length !== count) throw new Error(`Incomplete backup of ${table}`);
  const bytes = JSON.stringify(rows);
  const file = path.join(root, `${table}.json`);
  try { await fs.writeFile(file, bytes, { flag: "wx", mode: 0o600 }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || await fs.readFile(file, "utf8") !== bytes) throw error; }
  const readback = await fs.readFile(file, "utf8");
  if (readback !== bytes) throw new Error(`Backup readback failed for ${table}`);
  receipts.push({ table, count, sha256: createHash("sha256").update(bytes).digest("hex") });
  console.log(`${table}: ${count} rows backed up and verified`);
}
await fs.writeFile(path.join(root, "receipt.json"), JSON.stringify({ project: new URL(url).hostname, createdAt: new Date().toISOString(), tables: receipts }, null, 2), { mode: 0o600 });

}
main().catch(error => { console.error(error); process.exitCode = 1; });

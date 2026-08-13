import { createClient } from "@supabase/supabase-js";
import { readBloxodesEnvFile } from "../shared/env-files";
import {
  assertManagedDevelopmentSupabaseUrl,
  isProductionSupabaseUrl
} from "../shared/supabase-target";

async function main() {
  const uid = Number(process.argv[2]);
  const managedDevCols = (process.argv[3] || "").split(",").filter(Boolean);
  const apply = process.argv.includes("--apply");
  if (!uid) throw new Error("usage: tsx import-universe-to-managed-dev.ts <universeId> <managedDevCols>");

  const prodEnv = readBloxodesEnvFile("targets/production.env");
  const managedDevEnv = readBloxodesEnvFile("targets/managed-dev.env");
  const prodUrl = prodEnv.SUPABASE_URL!, prodKey = prodEnv.SUPABASE_SERVICE_ROLE!;
  const managedDevUrl = managedDevEnv.SUPABASE_URL!, managedDevKey = managedDevEnv.SUPABASE_SERVICE_ROLE!;
  if (!isProductionSupabaseUrl(prodUrl)) throw new Error("Production source is not the production host; refusing");
  assertManagedDevelopmentSupabaseUrl(managedDevUrl, "universe import");

  const prod = createClient(prodUrl, prodKey);
  const managedDev = createClient(managedDevUrl, managedDevKey);

  const { data, error } = await prod.from("roblox_universes").select("*").eq("universe_id", uid);
  if (error) throw error;
  if (!data || !data.length) throw new Error("universe not found in prod");
  const row = data[0] as Record<string, unknown>;
  const filtered: Record<string, unknown> = {};
  for (const k of Object.keys(row)) if (!managedDevCols.length || managedDevCols.includes(k)) filtered[k] = row[k];
  console.log(`${apply ? "Importing" : "Would import"} universe:`, row.universe_id, row.name, "| cols:", Object.keys(filtered).length);
  if (!apply) {
    console.log("Dry run only. Re-run with --apply to write managed development.");
    return;
  }
  const { error: upErr } = await managedDev.from("roblox_universes").upsert(filtered, { onConflict: "universe_id" });
  if (upErr) throw upErr;
  const { data: check } = await managedDev.from("roblox_universes").select("universe_id,name,slug").eq("universe_id", uid);
  console.log("Managed dev now has:", JSON.stringify(check));
}
main().catch((e) => { console.error(e); process.exit(1); });

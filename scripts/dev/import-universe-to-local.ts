import fs from "node:fs";
import path from "node:path";
import { parse as parseDotenv } from "dotenv";
import { createClient } from "@supabase/supabase-js";

async function main() {
  const repoRoot = process.cwd();
  const uid = Number(process.argv[2]);
  const localCols = (process.argv[3] || "").split(",").filter(Boolean);
  if (!uid) throw new Error("usage: tsx import-universe-to-local.ts <universeId> <localCols>");

  const prodEnv = parseDotenv(
    fs.readFileSync(path.join(repoRoot, ".envs/targets/production.env"))
  );
  const localEnv = parseDotenv(fs.readFileSync(path.join(repoRoot, ".envs/targets/local.env")));
  const prodUrl = prodEnv.SUPABASE_URL!, prodKey = prodEnv.SUPABASE_SERVICE_ROLE!;
  const localUrl = localEnv.SUPABASE_URL!, localKey = localEnv.SUPABASE_SERVICE_ROLE!;
  if (/127\.0\.0\.1|localhost/.test(prodUrl)) {
    throw new Error("Production target is local; refusing");
  }
  if (!/127\.0\.0\.1|localhost/.test(localUrl)) throw new Error("Local target is not local; refusing");

  const prod = createClient(prodUrl, prodKey);
  const local = createClient(localUrl, localKey);

  const { data, error } = await prod.from("roblox_universes").select("*").eq("universe_id", uid);
  if (error) throw error;
  if (!data || !data.length) throw new Error("universe not found in prod");
  const row = data[0] as Record<string, unknown>;
  const filtered: Record<string, unknown> = {};
  for (const k of Object.keys(row)) if (!localCols.length || localCols.includes(k)) filtered[k] = row[k];
  console.log("Importing universe:", row.universe_id, row.name, "| cols:", Object.keys(filtered).length);
  const { error: upErr } = await local.from("roblox_universes").upsert(filtered, { onConflict: "universe_id" });
  if (upErr) throw upErr;
  const { data: check } = await local.from("roblox_universes").select("universe_id,name,slug").eq("universe_id", uid);
  console.log("Local now has:", JSON.stringify(check));
}
main().catch((e) => { console.error(e); process.exit(1); });

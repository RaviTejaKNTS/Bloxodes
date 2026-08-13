import "../shared/load-env";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { isManagedDevelopmentSupabaseUrl } from "../shared/supabase-target";

type Options = { file: string; dryRun: boolean; allowProd: boolean; replaceSourceRows: boolean };

function parseArgs(argv: string[]): Options {
  const options: Options = {
    file: "data/game-specific-ids/source-backed.json",
    dryRun: false,
    allowProd: false,
    replaceSourceRows: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--file") options.file = argv[++index] || options.file;
    else if (argv[index] === "--dry-run") options.dryRun = true;
    else if (argv[index] === "--allow-prod") options.allowProd = true;
    else if (argv[index] === "--replace-source-rows") options.replaceSourceRows = true;
    else throw new Error(`Unknown option: ${argv[index]}`);
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const raw = await readFile(path.resolve(process.cwd(), options.file), "utf8");
  const payload = JSON.parse(raw) as { music?: unknown[]; decals?: unknown[] };
  const music = Array.isArray(payload.music) ? payload.music : [];
  const decals = Array.isArray(payload.decals) ? payload.decals : [];
  console.log(`Prepared ${music.length} music and ${decals.length} decal usage rows.`);
  if (options.dryRun) return;
  if (!options.allowProd && !isManagedDevelopmentSupabaseUrl(process.env.SUPABASE_URL)) {
    throw new Error("Refusing to write outside managed development without --allow-prod.");
  }
  const client = supabaseAdmin();
  if (options.replaceSourceRows) {
    const scopes = new Map<string, { table: "roblox_music_id_game_usage" | "roblox_decal_id_game_usage"; gameSlug: string; sourceUrl: string }>();
    for (const [table, rows] of [
      ["roblox_music_id_game_usage", music],
      ["roblox_decal_id_game_usage", decals]
    ] as const) {
      for (const rawRow of rows) {
        const row = rawRow as { game_slug?: unknown; source_url?: unknown };
        if (typeof row.game_slug !== "string" || typeof row.source_url !== "string") continue;
        const key = `${table}:${row.game_slug}:${row.source_url}`;
        scopes.set(key, { table, gameSlug: row.game_slug, sourceUrl: row.source_url });
      }
    }
    for (const scope of scopes.values()) {
      const { error } = await client
        .from(scope.table)
        .delete()
        .eq("game_slug", scope.gameSlug)
        .eq("source_url", scope.sourceUrl);
      if (error) throw error;
    }
  }
  for (let index = 0; index < music.length; index += 500) {
    const { error } = await client.from("roblox_music_id_game_usage").upsert(music.slice(index, index + 500), {
      onConflict: "game_slug,asset_id,use_type"
    });
    if (error) throw error;
  }
  for (let index = 0; index < decals.length; index += 500) {
    const { error } = await client.from("roblox_decal_id_game_usage").upsert(decals.slice(index, index + 500), {
      onConflict: "game_slug,asset_id,use_type"
    });
    if (error) throw error;
  }
  console.log("Seeded game-specific ID usage rows.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

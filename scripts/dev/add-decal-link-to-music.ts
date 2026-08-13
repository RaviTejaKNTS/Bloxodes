/**
 * Add a reciprocal "Roblox decal IDs" cross-link to the music IDs page intro.
 * Idempotent. Target explicit local or production profiles via --target.
 * Prod runs also enqueue a revalidation event.
 *   tsx scripts/dev/add-decal-link-to-music.ts --target=local
 *   tsx scripts/dev/add-decal-link-to-music.ts --target=prod
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseDotenv } from "dotenv";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const target = (process.argv.find((a) => a.startsWith("--target="))?.split("=")[1] ?? "").trim();
if (target !== "local" && target !== "prod") {
  throw new Error('Pass --target=local or --target=prod');
}

const env = parseDotenv(
  fs.readFileSync(
    path.join(repoRoot, target === "prod" ? ".envs/targets/production.env" : ".envs/targets/local.env")
  )
);
const CODE = "roblox-music-ids";
const base = env.SUPABASE_URL!;
const key = env.SUPABASE_SERVICE_ROLE!;
const isLocal = ["localhost", "127.0.0.1", "::1"].includes(new URL(base).hostname);

if (target === "prod" && isLocal) throw new Error(`--target=prod but SUPABASE_URL is local: ${base}`);
if (target === "local" && !isLocal) throw new Error(`--target=local but SUPABASE_URL is not local: ${base}`);

const FIND = "so you are not relying on outdated codes.";
const ADDED =
  "\n\nLooking for images instead of audio? Browse our [Roblox decal IDs](https://bloxodes.com/catalog/roblox-decal-ids) catalog.";

async function rest(pathAndQuery: string, init?: RequestInit) {
  const res = await fetch(`${base}/rest/v1/${pathAndQuery}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${await res.text()}`);
  return res;
}

async function main() {
  console.log(`Target=${target} (${base})`);
  const rows = (await (
    await rest(`catalog_pages?code=eq.${CODE}&select=id,intro_md`)
  ).json()) as Array<{ id: string; intro_md: string }>;
  if (!rows.length) throw new Error(`No row for ${CODE}`);
  const row = rows[0];

  if (row.intro_md.includes("/catalog/roblox-decal-ids")) {
    console.log("Decal link already present in intro_md; skipping content update.");
  } else {
    const count = row.intro_md.split(FIND).length - 1;
    if (count !== 1) throw new Error(`Expected exactly 1 anchor match, found ${count}`);
    const intro_md = row.intro_md.replace(FIND, FIND + ADDED);
    await rest(`catalog_pages?id=eq.${row.id}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ intro_md })
    });
    console.log("Added decal cross-link to intro_md.");
  }

  if (target === "prod") {
    await rest(`revalidation_events?on_conflict=entity_type,slug`, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        entity_type: "catalog",
        slug: CODE,
        source: "manual_music_decal_crosslink",
        created_at: new Date().toISOString()
      })
    });
    console.log(`Enqueued revalidation_events: catalog:${CODE}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

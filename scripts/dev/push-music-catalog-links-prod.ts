/**
 * Push the three internal links into the PROD `catalog_pages` row for
 * `roblox-music-ids`, then enqueue a revalidation event so the live page
 * refreshes. Idempotent: skips edits already present. Refuses to run against a
 * local Supabase URL. Run with: tsx scripts/dev/push-music-catalog-links-prod.ts
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseDotenv } from "dotenv";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const prodEnv = parseDotenv(fs.readFileSync(path.join(repoRoot, ".env")));

const CODE = "roblox-music-ids";
const base = prodEnv.SUPABASE_URL!;
const key = prodEnv.SUPABASE_SERVICE_ROLE!;

if (["localhost", "127.0.0.1", "::1"].includes(new URL(base).hostname)) {
  throw new Error(`Refusing to run prod push against local Supabase: ${base}`);
}

// Same minimal, contextual edits applied locally. Each `find` must appear once.
const EDITS: Array<[string, string]> = [
  [
    "- **Brookhaven RP**",
    "- **[Brookhaven RP](https://bloxodes.com/wiki/brookhaven-rp)**"
  ],
  [
    "- **Music ID** – The numeric Roblox audio asset ID a.k.a Music Code",
    "- **Music ID** – The numeric Roblox audio asset ID a.k.a Music Code. Paste any Roblox link or ID into the [Roblox ID Extractor](https://bloxodes.com/tools/roblox-id-extractor) to confirm what type it is."
  ],
  [
    "This structure makes it useful for casual players as well as creators and power users.",
    "This structure makes it useful for casual players as well as creators and power users.\n\nIf you also like collecting free avatar gear, browse our [free Roblox items](https://bloxodes.com/catalog/free-roblox-items) catalog."
  ]
];

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
  console.log(`Target (prod): ${base}`);
  const rows = (await (
    await rest(`catalog_pages?code=eq.${CODE}&select=id,how_it_works_md`)
  ).json()) as Array<{ id: string; how_it_works_md: string }>;
  if (!rows.length) throw new Error(`No prod row for code=${CODE}`);
  const row = rows[0];

  let md = row.how_it_works_md;
  let changed = false;
  for (const [find, replace] of EDITS) {
    if (md.includes(replace)) {
      console.log(`Already present, skipping: ${find.slice(0, 40)}...`);
      continue;
    }
    const count = md.split(find).length - 1;
    if (count !== 1) throw new Error(`Expected exactly 1 match for "${find.slice(0, 40)}..." but found ${count}`);
    md = md.replace(find, replace);
    changed = true;
    console.log(`Applied: ${find.slice(0, 40)}...`);
  }

  if (changed) {
    await rest(`catalog_pages?id=eq.${row.id}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ how_it_works_md: md })
    });
    console.log(`PATCHed prod catalog_pages.how_it_works_md (id=${row.id}).`);
  } else {
    console.log("No content changes needed; content already up to date.");
  }

  // Enqueue revalidation so the VPS edge function refreshes the live page.
  await rest(`revalidation_events?on_conflict=entity_type,slug`, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      entity_type: "catalog",
      slug: CODE,
      source: "manual_music_internal_links",
      created_at: new Date().toISOString()
    })
  });
  console.log(`Enqueued revalidation_events: catalog:${CODE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

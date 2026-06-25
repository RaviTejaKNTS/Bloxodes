/**
 * One-off LOCAL-ONLY edit: add three internal links into the local
 * `catalog_pages` row for `roblox-music-ids`. Minimal, contextual edits to
 * how_it_works_md only. Refuses to run against a non-local Supabase URL.
 * Run with: tsx scripts/dev/add-music-catalog-links.ts
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseDotenv } from "dotenv";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const localEnv = parseDotenv(fs.readFileSync(path.join(repoRoot, ".env.local")));

const CODE = "roblox-music-ids";
const base = localEnv.SUPABASE_URL!;
const key = localEnv.SUPABASE_SERVICE_ROLE!;

if (!["localhost", "127.0.0.1", "::1"].includes(new URL(base).hostname)) {
  throw new Error(`Refusing to edit non-local Supabase: ${base}`);
}

// [find, replace] pairs. Each `find` must appear exactly once.
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
  const rows = (await (
    await rest(`catalog_pages?code=eq.${CODE}&select=id,how_it_works_md`)
  ).json()) as Array<{ id: string; how_it_works_md: string }>;
  if (!rows.length) throw new Error(`No local row for code=${CODE}`);
  const row = rows[0];

  let md = row.how_it_works_md;
  for (const [find, replace] of EDITS) {
    if (md.includes(replace)) {
      console.log(`Already applied, skipping: ${find.slice(0, 40)}...`);
      continue;
    }
    const count = md.split(find).length - 1;
    if (count !== 1) throw new Error(`Expected exactly 1 match for "${find.slice(0, 40)}..." but found ${count}`);
    md = md.replace(find, replace);
    console.log(`Applied: ${find.slice(0, 40)}...`);
  }

  await rest(`catalog_pages?id=eq.${row.id}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ how_it_works_md: md })
  });
  console.log(`Updated local catalog_pages.how_it_works_md (id=${row.id}).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

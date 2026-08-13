/**
 * One-off: pull the `catalog_pages` row for `roblox-music-ids` from PROD and
 * upsert it into managed Supabase development so the page can be previewed/edited
 * locally. Read-only on prod. Run with: tsx scripts/dev/pull-music-catalog-row.ts
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseDotenv } from "dotenv";
import {
  assertManagedDevelopmentSupabaseUrl,
  isProductionSupabaseUrl
} from "../shared/supabase-target";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const prodEnv = parseDotenv(
  fs.readFileSync(path.join(repoRoot, ".envs/targets/production.env"))
);
const localEnv = parseDotenv(fs.readFileSync(path.join(repoRoot, ".envs/targets/managed-dev.env")));

const CODE = "roblox-music-ids";

function assertLocal(url: string) {
  assertManagedDevelopmentSupabaseUrl(url, "production sample import");
}
function assertProd(url: string) {
  if (!isProductionSupabaseUrl(url)) throw new Error(`Source is not production: ${new URL(url).hostname}`);
}

async function rest(base: string, key: string, pathAndQuery: string, init?: RequestInit) {
  const res = await fetch(`${base}/rest/v1/${pathAndQuery}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}: ${await res.text()}`);
  }
  return res;
}

async function main() {
  const prodUrl = prodEnv.SUPABASE_URL!;
  const prodKey = prodEnv.SUPABASE_SERVICE_ROLE!;
  const localUrl = localEnv.SUPABASE_URL!;
  const localKey = localEnv.SUPABASE_SERVICE_ROLE!;
  assertProd(prodUrl);
  assertLocal(localUrl);

  const res = await rest(
    prodUrl,
    prodKey,
    `catalog_pages?code=eq.${CODE}&select=*`
  );
  const rows = (await res.json()) as Record<string, unknown>[];
  if (!rows.length) throw new Error(`No prod catalog_pages row for code=${CODE}`);
  const row = rows[0];
  console.log(`Pulled prod row id=${row.id} code=${row.code} title=${row.title as string}`);

  await rest(localUrl, localKey, `catalog_pages?on_conflict=id`, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(row)
  });
  console.log(`Upserted into managed-dev catalog_pages (id=${row.id}).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

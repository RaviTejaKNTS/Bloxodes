import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const releaseRoot = "scripts/releases/wiki-collections-2026-08-09";
const manifest = JSON.parse(await readFile(new URL("./manifest.json", import.meta.url), "utf8"));
const supabaseUrl = process.env.SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE;
const siteUrl = "https://bloxodes.com";

if (!supabaseUrl || !serviceRole) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE are required.");
}

const productionHost = new URL(supabaseUrl).hostname;
if (productionHost !== "database.bloxodes.com") {
  throw new Error(`Refusing release against unexpected Supabase host: ${productionHost}`);
}

const expected = manifest.games.flatMap((game) =>
  game.collections.map((collection) => ({
    game: game.slug,
    collection,
    code: `${game.slug}-${collection}`,
    path: `/wiki/${game.slug}/${collection}`
  }))
);

if (expected.length !== 50 || new Set(expected.map((entry) => entry.code)).size !== 50) {
  throw new Error(`Expected 50 unique release rows, received ${expected.length}.`);
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: { ...process.env, NODE_ENV: "production" },
    stdio: "inherit"
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with status ${result.status ?? "unknown"}.`);
  }
}

function seedGame(game, dryRun) {
  const args = [
    "run",
    "seed:game-collection-pages",
    "--",
    "--game",
    game.slug,
    ...game.collections.flatMap((collection) => ["--collection", collection]),
    "--final-json-root",
    `${releaseRoot}/${game.slug}`,
    ...(dryRun ? ["--dry-run"] : ["--allow-prod"])
  ];
  run("npm", args);
}

console.log("Running production release dry-runs for 50 collection rows.");
for (const game of manifest.games) seedGame(game, true);

console.log("Applying the explicit 50-row idempotent production release.");
for (const game of manifest.games) seedGame(game, false);

const supabase = createClient(supabaseUrl, serviceRole, {
  auth: { persistSession: false, autoRefreshToken: false }
});
const { data, error } = await supabase
  .from("wiki_collection_pages")
  .select("code, wiki_slug, collection_slug, item_count, is_published, wiki_page_id, universe_id")
  .in("code", expected.map((entry) => entry.code));

if (error) throw error;
if ((data ?? []).length !== expected.length) {
  throw new Error(`Production readback returned ${data?.length ?? 0} of ${expected.length} rows.`);
}

const rowsByCode = new Map(data.map((row) => [row.code, row]));
for (const entry of expected) {
  const row = rowsByCode.get(entry.code);
  if (!row) throw new Error(`Missing production row: ${entry.code}`);
  if (row.wiki_slug !== entry.game || row.collection_slug !== entry.collection) {
    throw new Error(`Slug mismatch for production row: ${entry.code}`);
  }
  if (!row.is_published || !row.wiki_page_id || !row.universe_id || row.item_count < 1) {
    throw new Error(`Incomplete production row: ${entry.code}`);
  }
}
console.log(`Production readback passed for ${data.length} published collection rows.`);

console.log("Waiting for database-triggered route and sitemap revalidation.");
await new Promise((resolve) => setTimeout(resolve, 45_000));

for (const entry of expected) {
  run("npm", [
    "run",
    "verify:published-url",
    "--",
    "--base-url",
    siteUrl,
    "--sitemap",
    "/sitemaps/wiki.xml",
    "--path",
    entry.path,
    "--attempts",
    "12",
    "--delay-ms",
    "5000",
    "--timeout-ms",
    "20000"
  ]);
}

console.log("Verified all 50 production collection URLs.");

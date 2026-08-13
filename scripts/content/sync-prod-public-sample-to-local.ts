import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseDotenv } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  assertManagedDevelopmentSupabaseUrl,
  isProductionSupabaseUrl
} from "../shared/supabase-target";

type Row = Record<string, unknown>;
type AwaitableQuery = PromiseLike<{
  data: Row[] | null;
  error: { message?: string } | null;
}>;

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");

const preferredCodePageHints = [
  "adopt-me",
  "grow-a-garden",
  "blox-fruits",
  "the-forge",
  "forge",
  "brookhaven-rp",
  "steal-a-brainrot",
  "dress-to-impress"
];

const pageSize = 1000;
const writeBatchSize = 250;

function readEnvFile(filename: string): Record<string, string> {
  const envPath = path.join(repoRoot, filename);
  if (!fs.existsSync(envPath)) throw new Error(`Missing ${filename}`);
  return parseDotenv(fs.readFileSync(envPath));
}

function required(env: Record<string, string>, key: string, filename: string): string {
  const value = env[key]?.trim();
  if (!value) throw new Error(`Missing ${key} in ${filename}`);
  return value;
}

const prodEnv = readEnvFile(".envs/targets/production.env");
const localEnv = readEnvFile(".envs/targets/managed-dev.env");

const prodUrl = required(prodEnv, "SUPABASE_URL", ".envs/targets/production.env");
const prodKey = required(prodEnv, "SUPABASE_SERVICE_ROLE", ".envs/targets/production.env");
const localUrl = required(localEnv, "SUPABASE_URL", ".envs/targets/managed-dev.env");
const localKey = required(localEnv, "SUPABASE_SERVICE_ROLE", ".envs/targets/managed-dev.env");

if (!isProductionSupabaseUrl(prodUrl)) throw new Error("Production source is not the production Supabase host.");
assertManagedDevelopmentSupabaseUrl(localUrl, "production sample sync");

const source = createClient(prodUrl, prodKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});
const target = createClient(localUrl, localKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

function uniq<T>(values: Array<T | null | undefined>): T[] {
  return [...new Set(values.filter((value): value is T => value !== null && value !== undefined))];
}

function chunk<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function getString(row: Row, key: string): string | null {
  const value = row[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function getNumber(row: Row, key: string): number | null {
  const value = row[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

async function fetchAll(
  client: SupabaseClient,
  table: string,
  build: (query: any) => AwaitableQuery
): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const query = build(client.from(table).select("*").range(from, to));
    const { data, error } = await query;
    if (error) throw new Error(`${table}: ${error.message ?? "query failed"}`);
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

async function fetchByValues(table: string, column: string, values: Array<string | number>): Promise<Row[]> {
  const rows: Row[] = [];
  for (const part of chunk(uniq(values), 200)) {
    if (!part.length) continue;
    const { data, error } = await source.from(table).select("*").in(column, part);
    if (error) throw new Error(`${table}.${column}: ${error.message}`);
    rows.push(...((data ?? []) as Row[]));
  }
  return rows;
}

async function fetchLatestByUniverses(
  table: string,
  universeIds: number[],
  orderColumn: string,
  limitPerUniverse: number
): Promise<Row[]> {
  const rows: Row[] = [];
  for (const universeId of universeIds) {
    const { data, error } = await source
      .from(table)
      .select("*")
      .eq("universe_id", universeId)
      .order(orderColumn, { ascending: false })
      .limit(limitPerUniverse);
    if (error) throw new Error(`${table} for universe ${universeId}: ${error.message}`);
    rows.push(...((data ?? []) as Row[]));
  }
  return rows;
}

async function upsertRows(table: string, rows: Row[], onConflict: string): Promise<void> {
  const conflictColumns = onConflict.split(",").map((column) => column.trim()).filter(Boolean);
  const uniqueRows = [...new Map(rows.map((row) => {
    const key = conflictColumns.map((column) => String(row[column] ?? "")).join("\u0000");
    return [key, row] as const;
  })).values()];
  if (!uniqueRows.length) {
    console.log(`${table}: 0 rows`);
    return;
  }

  console.log(`${table}: ${dryRun ? "would upsert" : "upserting"} ${uniqueRows.length} rows`);
  if (dryRun) return;

  for (const part of chunk(uniqueRows, writeBatchSize)) {
    const { error } = await target.from(table).upsert(part, { onConflict });
    if (error) throw new Error(`${table} upsert failed: ${error.message}`);
  }
}

async function optionalUpsert(table: string, rows: Row[], onConflict: string): Promise<void> {
  try {
    await upsertRows(table, rows, onConflict);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`${table}: skipped (${message})`);
  }
}

async function fetchPreferredCodePages(): Promise<Row[]> {
  const bySlug = await fetchByValues("code_pages", "slug", preferredCodePageHints);
  const foundSlugs = new Set(bySlug.map((row) => getString(row, "slug")).filter(Boolean));
  const rows = [...bySlug];

  for (const hint of preferredCodePageHints) {
    if (foundSlugs.has(hint)) continue;
    const search = hint.replace(/-/g, " ");
    const { data, error } = await source
      .from("code_pages")
      .select("*")
      .or(`slug.ilike.%${hint}%,name.ilike.%${search}%`)
      .eq("is_published", true)
      .limit(3);
    if (error) throw new Error(`code pages search ${hint}: ${error.message}`);
    rows.push(...((data ?? []) as Row[]));
  }

  const { data: recentCodePages, error: recentError } = await source
    .from("code_pages")
    .select("*")
    .eq("is_published", true)
    .order("updated_at", { ascending: false })
    .limit(12);
  if (recentError) throw new Error(`recent code pages: ${recentError.message}`);
  rows.push(...((recentCodePages ?? []) as Row[]));

  const byId = new Map<string, Row>();
  for (const row of rows) {
    const id = getString(row, "id");
    if (id) byId.set(id, row);
  }
  return [...byId.values()].filter((row) => row.is_published === true).slice(0, 20);
}

function addUniverseIds(targetSet: Set<number>, rows: Row[]): void {
  for (const row of rows) {
    const universeId = getNumber(row, "universe_id");
    if (universeId) targetSet.add(universeId);
  }
}

async function main() {
  console.log(`Source: production Supabase`);
  console.log(`Target: ${localUrl}`);
  console.log(`Mode: ${dryRun ? "dry run" : "write local"}`);

  const universeIds = new Set<number>();

  const [tools, catalogPages, wikiCollectionPages, quizPages, checklistPages, eventsPages] = await Promise.all([
    fetchAll(source, "tools", (query) => query.order("updated_at", { ascending: false })),
    fetchAll(source, "catalog_pages", (query) => query.order("updated_at", { ascending: false })),
    fetchAll(source, "wiki_collection_pages", (query) => query.order("updated_at", { ascending: false })),
    fetchAll(source, "quiz_pages", (query) => query.eq("is_published", true).order("updated_at", { ascending: false }).limit(50)),
    fetchAll(source, "checklist_pages", (query) => query.eq("is_public", true).order("updated_at", { ascending: false }).limit(50)),
    fetchAll(source, "events_pages", (query) => query.eq("is_published", true).order("updated_at", { ascending: false }).limit(50))
  ]);

  [tools, catalogPages, wikiCollectionPages, quizPages, checklistPages, eventsPages].forEach((rows) => addUniverseIds(universeIds, rows));

  const codePages = await fetchPreferredCodePages();
  addUniverseIds(universeIds, codePages);

  const wikiPageIds = uniq(wikiCollectionPages.map((row) => getString(row, "wiki_page_id")));
  const wikiSlugs = uniq(wikiCollectionPages.map((row) => getString(row, "wiki_slug")));
  const wikiPagesById = await fetchByValues("wiki_pages", "id", wikiPageIds);
  const wikiPagesBySlug = await fetchByValues("wiki_pages", "slug", wikiSlugs);
  const wikiPagesByUniverse = await fetchByValues("wiki_pages", "universe_id", [...universeIds]);
  const wikiPages = uniq([...wikiPagesById, ...wikiPagesBySlug, ...wikiPagesByUniverse].map((row) => getString(row, "id")))
    .map((id) => [...wikiPagesById, ...wikiPagesBySlug, ...wikiPagesByUniverse].find((row) => getString(row, "id") === id))
    .filter((row): row is Row => Boolean(row));
  addUniverseIds(universeIds, wikiPages);

  const codePageIds = uniq(codePages.map((row) => getString(row, "id")));
  const codes = await fetchByValues("codes", "code_page_id", codePageIds);

  const checklistItems = await fetchByValues("checklist_items", "page_id", uniq(checklistPages.map((row) => getString(row, "id"))));

  const articlesByUniverse = await fetchByValues("articles", "universe_id", [...universeIds]);
  const latestArticles = await fetchAll(source, "articles", (query) =>
    query.eq("is_published", true).order("published_at", { ascending: false, nullsFirst: false }).limit(30)
  );
  const articles = uniq([...articlesByUniverse, ...latestArticles].map((row) => getString(row, "id")))
    .map((id) => [...articlesByUniverse, ...latestArticles].find((row) => getString(row, "id") === id))
    .filter((row): row is Row => Boolean(row));
  addUniverseIds(universeIds, articles);

  const authorIds = uniq(articles.map((row) => getString(row, "author_id")));
  const authors = await fetchByValues("authors", "id", authorIds);

  const universes = await fetchByValues("roblox_universes", "universe_id", [...universeIds]);
  const finalUniverseIds = uniq(universes.map((row) => getNumber(row, "universe_id")));
  const richUniverseIds = finalUniverseIds.slice(0, 40);

  const [media, badges, gamepasses, servers, virtualEvents, hourlyStats, dailyStats] = await Promise.all([
    fetchByValues("roblox_universe_media", "universe_id", richUniverseIds),
    fetchLatestByUniverses("roblox_universe_badges", richUniverseIds, "awarded_count", 12),
    fetchLatestByUniverses("roblox_universe_gamepasses", richUniverseIds, "sales", 12),
    fetchLatestByUniverses("roblox_universe_place_servers", richUniverseIds, "fetched_at", 8),
    fetchByValues("roblox_virtual_events", "universe_id", richUniverseIds),
    fetchLatestByUniverses("roblox_universe_stats_hourly", richUniverseIds, "hour_start", 24),
    fetchLatestByUniverses("roblox_universe_stats_daily", richUniverseIds, "stat_date", 7)
  ]);

  await upsertRows("roblox_universes", universes, "universe_id");
  await upsertRows("authors", authors, "id");
  await upsertRows("code_pages", codePages, "id");
  await upsertRows("wiki_pages", wikiPages, "id");
  await upsertRows("catalog_pages", catalogPages, "code");
  await upsertRows("wiki_collection_pages", wikiCollectionPages, "code");
  await upsertRows("tools", tools, "code");
  await upsertRows("quiz_pages", quizPages, "code");
  await upsertRows("checklist_pages", checklistPages, "id");
  await upsertRows("checklist_items", checklistItems, "id");
  await upsertRows("events_pages", eventsPages, "id");
  await upsertRows("articles", articles, "id");
  await upsertRows("codes", codes, "id");
  await optionalUpsert("roblox_universe_media", media, "id");
  await optionalUpsert("roblox_universe_badges", badges, "badge_id");
  await optionalUpsert("roblox_universe_gamepasses", gamepasses, "pass_id");
  await optionalUpsert("roblox_universe_place_servers", servers, "id");
  await optionalUpsert("roblox_virtual_events", virtualEvents, "event_id");
  await optionalUpsert("roblox_universe_stats_hourly", hourlyStats, "universe_id,hour_start");
  await optionalUpsert("roblox_universe_stats_daily", dailyStats, "universe_id,stat_date");

  console.log("Done.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

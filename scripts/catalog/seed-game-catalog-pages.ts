import "../shared/load-env";
import fs from "node:fs/promises";
import path from "node:path";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { repoPath } from "@/lib/paths";
import {
  buildGameDatasetCatalogCopy,
  GAME_DATASET_CATALOG_GROUPS,
  GAME_DATASET_CATALOGS,
  type GameDatasetCatalogConfig
} from "@/lib/game-dataset-catalogs";

type DatasetMeta = {
  columns?: string[] | null;
};

type DatasetFile = {
  meta?: DatasetMeta | null;
  items?: Record<string, unknown>[] | null;
  data?: Record<string, unknown>[] | null;
};

type WikiCatalogPageUpsert = {
  wiki_page_id: string | null;
  universe_id: number | null;
  wiki_slug: string;
  collection_slug: string;
  code: string;
  title: string;
  seo_title: string;
  meta_description: string;
  intro_md: string;
  description_md: string;
  how_it_works_md: string;
  description_json: Record<string, string>;
  faq_json: Array<{ q: string; a: string }>;
  wiki_md: string;
  wiki_sort_order: number;
  thumb_url: string | null;
  is_published: boolean;
  published_at: string | null;
};

const rawArgs = process.argv.slice(2);
const args = new Set(rawArgs);
const dryRun = args.has("--dry-run");
const draft = args.has("--draft");
const allowProd = args.has("--allow-prod");
const targetGameSlugs = collectArgValues(rawArgs, ["--game", "--game-slug", "--wiki-slug"]);
const targetCollections = collectArgValues(rawArgs, ["--collection", "--collection-slug"]);
const finalJsonRoot = collectSingleArgValue(rawArgs, ["--final-json-root", "--final-json-dir"]);
const UNIVERSE_LOOKUP_PAGE_SIZE = 1000;

function collectArgValues(argv: string[], names: string[]): string[] {
  const values: string[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const inlineName = names.find((name) => arg.startsWith(`${name}=`));
    if (inlineName) {
      const value = arg.slice(inlineName.length + 1).trim().toLowerCase();
      if (value) values.push(value);
      continue;
    }
    if (names.includes(arg)) {
      const value = argv[i + 1]?.trim().toLowerCase();
      if (!value) throw new Error(`Missing value for ${arg}`);
      values.push(value);
      i += 1;
    }
  }
  return Array.from(new Set(values));
}

function collectSingleArgValue(argv: string[], names: string[]): string | null {
  const values: string[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const inlineName = names.find((name) => arg.startsWith(`${name}=`));
    if (inlineName) {
      const value = arg.slice(inlineName.length + 1).trim();
      if (value) values.push(value);
      continue;
    }
    if (names.includes(arg)) {
      const value = argv[i + 1]?.trim();
      if (!value) throw new Error(`Missing value for ${arg}`);
      values.push(value);
      i += 1;
    }
  }
  if (values.length > 1) throw new Error(`Expected one value for ${names.join(" / ")}, received ${values.length}.`);
  return values[0] ?? null;
}

function getTargetCatalogs() {
  return GAME_DATASET_CATALOGS.filter((config) => {
    const matchesGame = !targetGameSlugs.length || targetGameSlugs.includes(config.gameSlug);
    const matchesCollection = !targetCollections.length || targetCollections.includes(config.slug);
    return matchesGame && matchesCollection;
  });
}

async function readFinalJsonOverride(config: GameDatasetCatalogConfig) {
  if (!finalJsonRoot) return null;

  const root = path.isAbsolute(finalJsonRoot) ? finalJsonRoot : repoPath(finalJsonRoot);
  const finalJsonPath = path.join(root, config.code, "final.json");
  try {
    const parsed = JSON.parse(await fs.readFile(finalJsonPath, "utf8")) as Partial<
      Pick<
        WikiCatalogPageUpsert,
        | "code"
        | "title"
        | "seo_title"
        | "meta_description"
        | "intro_md"
        | "description_md"
        | "how_it_works_md"
        | "description_json"
        | "faq_json"
        | "wiki_md"
        | "wiki_sort_order"
      >
    >;
    if (parsed.code !== config.code) {
      throw new Error(`Expected code ${config.code}, found ${parsed.code ?? "(missing)"}`);
    }
    return parsed;
  } catch (error) {
    throw new Error(`Failed to read final JSON override for ${config.code} at ${finalJsonPath}: ${String(error)}`);
  }
}

function getTargetGroups(targetCatalogs: GameDatasetCatalogConfig[]) {
  const gameSlugs = new Set(targetCatalogs.map((config) => config.gameSlug));
  return GAME_DATASET_CATALOG_GROUPS.filter((group) => gameSlugs.has(group.gameSlug));
}

async function readDataset(config: GameDatasetCatalogConfig) {
  const datasetPath = repoPath("data", config.dataDir, config.file);
  const raw = await fs.readFile(datasetPath, "utf8");
  const parsed = JSON.parse(raw) as DatasetFile | Record<string, unknown>[];
  const rows = Array.isArray(parsed) ? parsed : parsed.items ?? parsed.data ?? [];
  const columns = Array.isArray(parsed) ? inferColumns(rows) : parsed.meta?.columns ?? inferColumns(rows);
  const imageUrls = Array.from(
    new Set(
      rows
        .map((row) => normalizeImage(row.image) ?? normalizeImage(row.imageCandidate))
        .filter((image): image is string => Boolean(image))
    )
  );

  return {
    rows,
    columns,
    imageUrls
  };
}

function inferColumns(rows: Record<string, unknown>[]): string[] {
  const seen = new Set<string>();
  for (const row of rows.slice(0, 30)) {
    Object.keys(row).forEach((key) => seen.add(key));
    const fields = row.fields;
    if (fields && typeof fields === "object" && !Array.isArray(fields)) {
      Object.keys(fields as Record<string, unknown>).forEach((key) => seen.add(key));
    }
  }
  return Array.from(seen);
}

function normalizeImage(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith("data:image")) return null;
  return trimmed;
}

async function buildRows(
  existingPublishedAt: Map<string, string | null>,
  universeIdsByGameSlug: Map<string, number | null>,
  wikiPageIdsBySlug: Map<string, string | null>,
  targetCatalogs: GameDatasetCatalogConfig[]
) {
  const now = new Date().toISOString();
  const rows: WikiCatalogPageUpsert[] = [];

  for (const config of targetCatalogs) {
    const dataset = await readDataset(config);
    const copy = buildGameDatasetCatalogCopy({
      config,
      itemCount: dataset.rows.length,
      columns: dataset.columns,
      imageUrls: dataset.imageUrls
    });
    const finalJson = await readFinalJsonOverride(config);
    const pageCopy = finalJson ? { ...copy, ...finalJson } : copy;

    rows.push({
      wiki_page_id: wikiPageIdsBySlug.get(config.gameSlug) ?? null,
      universe_id: universeIdsByGameSlug.get(config.gameSlug) ?? null,
      wiki_slug: config.gameSlug,
      collection_slug: config.slug,
      code: pageCopy.code,
      title: pageCopy.title,
      seo_title: pageCopy.seo_title,
      meta_description: pageCopy.meta_description,
      intro_md: pageCopy.intro_md,
      description_md: pageCopy.description_md,
      how_it_works_md: pageCopy.how_it_works_md,
      description_json: pageCopy.description_json,
      faq_json: pageCopy.faq_json,
      wiki_md: pageCopy.wiki_md,
      wiki_sort_order: pageCopy.wiki_sort_order,
      thumb_url: copy.thumb_url,
      is_published: !draft,
      published_at: draft ? existingPublishedAt.get(pageCopy.code) ?? null : existingPublishedAt.get(pageCopy.code) ?? now
    });
  }

  return rows;
}

async function loadExistingPublishedAt() {
  if (dryRun) return new Map<string, string | null>();
  const sb = supabaseAdmin();
  const codes = getTargetCatalogs().map((config) => config.code);
  const { data, error } = await sb.from("wiki_catalog_pages").select("code, published_at").in("code", codes);
  if (error) throw error;
  return new Map(
    (data ?? []).map((row) => [
      (row as { code: string }).code,
      (row as { published_at?: string | null }).published_at ?? null
    ])
  );
}

async function loadWikiPageIdsBySlug() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE) return new Map<string, string | null>();
  const sb = supabaseAdmin();
  const targetGroups = getTargetGroups(getTargetCatalogs());
  const slugs = targetGroups.map((group) => group.gameSlug);
  const { data, error } = await sb.from("wiki_pages").select("id, slug").in("slug", slugs);
  if (error) throw error;
  return new Map(
    (data ?? []).map((row) => [
      (row as { slug: string }).slug,
      (row as { id?: string | null }).id ?? null
    ])
  );
}

async function loadUniverseIdsByGameSlug() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE) return new Map<string, number | null>();
  const rows = await loadRobloxUniverseLookupRows();

  return new Map(
    getTargetGroups(getTargetCatalogs()).map((group) => {
      const candidates = new Set([group.gameSlug, group.gameName, ...group.universeNames].map(normalizeLookup));
      const match = rows.find((row) =>
        [row.slug, row.name, row.display_name].some((value) => candidates.has(normalizeLookup(value)))
      );
      return [group.gameSlug, match?.universe_id ?? null];
    })
  );
}

async function loadRobloxUniverseLookupRows() {
  const sb = supabaseAdmin();
  const rows: Array<{
    universe_id: number;
    slug?: string | null;
    name?: string | null;
    display_name?: string | null;
  }> = [];

  for (let from = 0; ; from += UNIVERSE_LOOKUP_PAGE_SIZE) {
    const to = from + UNIVERSE_LOOKUP_PAGE_SIZE - 1;
    const { data, error } = await sb
      .from("roblox_universes")
      .select("universe_id, slug, name, display_name")
      .order("universe_id", { ascending: true })
      .range(from, to);

    if (error) throw error;
    rows.push(...((data ?? []) as typeof rows));
    if (!data || data.length < UNIVERSE_LOOKUP_PAGE_SIZE) break;
  }

  return rows;
}

function normalizeLookup(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s*\[[^\]]+\]\s*$/g, "")
    .trim()
    .replace(/!+$/g, "");
}

async function main() {
  if (!dryRun && (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE)) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE. Use --dry-run to preview without writing.");
  }
  if (!dryRun && !allowProd && !isLocalSupabaseUrl(process.env.SUPABASE_URL)) {
    throw new Error("Refusing to write to a non-local Supabase URL. Use --allow-prod only after local review is clean.");
  }

  const [existingPublishedAt, universeIdsByGameSlug, wikiPageIdsBySlug] = await Promise.all([
    loadExistingPublishedAt(),
    loadUniverseIdsByGameSlug(),
    loadWikiPageIdsBySlug()
  ]);
  const targetCatalogs = getTargetCatalogs();
  const rows = await buildRows(existingPublishedAt, universeIdsByGameSlug, wikiPageIdsBySlug, targetCatalogs);

  if (targetCatalogs.length === 0) {
    throw new Error("No game catalog pages matched the provided filters.");
  }

  if (dryRun) {
    console.log(`Prepared ${rows.length} wiki catalog page rows.`);
    for (const [index, row] of rows.entries()) {
      const config = targetCatalogs[index];
      const dataset = config ? await readDataset(config) : null;
      console.log(`${row.wiki_slug}/${row.collection_slug} | ${row.code} | ${row.title} | items=${dataset?.rows.length ?? "unknown"}`);
    }
    return;
  }

  const sb = supabaseAdmin();
  const { error } = await sb.from("wiki_catalog_pages").upsert(rows, { onConflict: "wiki_slug,collection_slug" });
  if (error) throw error;

  console.log(`Upserted ${rows.length} ${draft ? "draft" : "published"} wiki catalog pages.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

function isLocalSupabaseUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  } catch {
    return false;
  }
}

import "../shared/load-env";
import fs from "node:fs/promises";
import path from "node:path";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { repoPath } from "@/lib/paths";
import {
  buildGameCollectionCopy,
  GAME_COLLECTION_GROUPS,
  GAME_COLLECTIONS,
  type GameCollectionConfig
} from "@/lib/game-collections";

type DatasetMeta = {
  columns?: string[] | null;
};

type DatasetFile = {
  meta?: DatasetMeta | null;
  items?: Record<string, unknown>[] | null;
  data?: Record<string, unknown>[] | null;
};

type WikiCollectionPageUpsert = {
  wiki_page_id: string | null;
  universe_id: number | null;
  wiki_slug: string;
  collection_slug: string;
  code: string;
  title: string;
  display_name: string;
  item_count: number;
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
const allowGeneratedCopy = args.has("--allow-generated-copy");
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

function getTargetCollections() {
  return GAME_COLLECTIONS.filter((config) => {
    const matchesGame = !targetGameSlugs.length || targetGameSlugs.includes(config.gameSlug);
    const matchesCollection = !targetCollections.length || targetCollections.includes(config.slug);
    return matchesGame && matchesCollection;
  });
}

async function readFinalJsonOverride(config: GameCollectionConfig) {
  if (!finalJsonRoot) return null;

  const root = path.isAbsolute(finalJsonRoot) ? finalJsonRoot : repoPath(finalJsonRoot);
  const candidatePaths = [
    path.join(root, config.code, "final.json"),
    path.join(root, config.slug, "final.json"),
    path.join(root, "final.json")
  ];
  const finalJsonPath = await findExistingFile(candidatePaths);
  if (!finalJsonPath) {
    throw new Error(
      `Failed to find final JSON override for ${config.code}. Checked: ${candidatePaths.join(", ")}`
    );
  }

  try {
    const parsed = JSON.parse(await fs.readFile(finalJsonPath, "utf8")) as Partial<
      Pick<
        WikiCollectionPageUpsert,
        | "code"
        | "display_name"
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
    if (typeof parsed.display_name !== "string" || !parsed.display_name.trim()) {
      throw new Error(`Missing display_name for ${config.code}. Use the short reusable collection name, such as "Units".`);
    }
    return parsed;
  } catch (error) {
    throw new Error(`Failed to read final JSON override for ${config.code} at ${finalJsonPath}: ${String(error)}`);
  }
}

async function findExistingFile(candidatePaths: string[]) {
  for (const candidatePath of candidatePaths) {
    try {
      const stat = await fs.stat(candidatePath);
      if (stat.isFile()) return candidatePath;
    } catch {
      // Keep trying the next supported workspace shape.
    }
  }
  return null;
}

function getTargetGroups(targetCollections: GameCollectionConfig[]) {
  const gameSlugs = new Set(targetCollections.map((config) => config.gameSlug));
  return GAME_COLLECTION_GROUPS.filter((group) => gameSlugs.has(group.gameSlug));
}

async function readDataset(config: GameCollectionConfig) {
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

function resolveDisplayName(config: GameCollectionConfig, finalJson: Awaited<ReturnType<typeof readFinalJsonOverride>>): string {
  if (!finalJson) return config.label;
  return finalJson.display_name.trim();
}

async function buildRows(
  existingPublishedAt: Map<string, string | null>,
  universeIdsByGameSlug: Map<string, number | null>,
  wikiPageIdsBySlug: Map<string, string | null>,
  targetCollections: GameCollectionConfig[]
) {
  const now = new Date().toISOString();
  const rows: WikiCollectionPageUpsert[] = [];

  for (const config of targetCollections) {
    const dataset = await readDataset(config);
    const copy = buildGameCollectionCopy({
      config,
      itemCount: dataset.rows.length,
      columns: dataset.columns,
      imageUrls: dataset.imageUrls
    });
    const finalJson = await readFinalJsonOverride(config);
    if (!finalJson && !allowGeneratedCopy) {
      throw new Error(
        `Refusing to generate public copy for ${config.code}. Pass --final-json-root with an approved final.json, or use --allow-generated-copy only for an intentional one-off.`
      );
    }
    const pageCopy = resolveItemCountTokens(finalJson ? { ...copy, ...finalJson } : copy, dataset.rows.length);
    const displayName = resolveDisplayName(config, finalJson);

    rows.push({
      wiki_page_id: wikiPageIdsBySlug.get(config.gameSlug) ?? null,
      universe_id: universeIdsByGameSlug.get(config.gameSlug) ?? null,
      wiki_slug: config.gameSlug,
      collection_slug: config.slug,
      code: pageCopy.code,
      title: pageCopy.title,
      display_name: displayName,
      item_count: dataset.rows.length,
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

function resolveItemCountTokens<T extends { title: string; seo_title: string }>(pageCopy: T, itemCount: number): T {
  return {
    ...pageCopy,
    title: resolveItemCountToken(pageCopy.title, itemCount),
    seo_title: resolveItemCountToken(pageCopy.seo_title, itemCount)
  };
}

function resolveItemCountToken(value: string, itemCount: number): string {
  const countLabel = itemCount.toLocaleString("en-US");
  return value.replace(/\{\{\s*(?:count|item_count)\s*\}\}|\{\s*(?:count|item_count)\s*\}/gi, countLabel);
}

async function loadExistingPublishedAt() {
  if (dryRun) return new Map<string, string | null>();
  const sb = supabaseAdmin();
  const codes = getTargetCollections().map((config) => config.code);
  const { data, error } = await sb.from("wiki_collection_pages").select("code, published_at").in("code", codes);
  if (error) throw error;
  return new Map(
    (data ?? []).map((row) => [
      (row as { code: string }).code,
      (row as { published_at?: string | null }).published_at ?? null
    ])
  );
}

async function loadWikiPageIdsBySlug() {
  if (dryRun) {
    return new Map(getTargetGroups(getTargetCollections()).map((group) => [group.gameSlug, null]));
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE) return new Map<string, string | null>();
  const sb = supabaseAdmin();
  const targetGroups = getTargetGroups(getTargetCollections());
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
  if (dryRun) {
    return new Map(getTargetGroups(getTargetCollections()).map((group) => [group.gameSlug, group.universeId ?? null]));
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE) return new Map<string, number | null>();
  const rows = await loadRobloxUniverseLookupRows();

  return new Map(
    getTargetGroups(getTargetCollections()).map((group) => {
      if (group.universeId) return [group.gameSlug, group.universeId];
      const candidates = new Set([group.gameSlug, group.gameName, ...group.universeNames].map(normalizeLookup));
      const match = rows.find((row) =>
        [row.name, row.display_name].some((value) => candidates.has(normalizeLookup(value)))
      );
      return [group.gameSlug, match?.universe_id ?? null];
    })
  );
}

async function loadRobloxUniverseLookupRows() {
  const sb = supabaseAdmin();
  const rows: Array<{
    universe_id: number;
    name?: string | null;
    display_name?: string | null;
  }> = [];

  for (let from = 0; ; from += UNIVERSE_LOOKUP_PAGE_SIZE) {
    const to = from + UNIVERSE_LOOKUP_PAGE_SIZE - 1;
    const { data, error } = await sb
      .from("roblox_universes")
      .select("universe_id, name, display_name")
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
  const targetCollections = getTargetCollections();
  const rows = await buildRows(existingPublishedAt, universeIdsByGameSlug, wikiPageIdsBySlug, targetCollections);

  if (targetCollections.length === 0) {
    throw new Error("No game collection pages matched the provided filters.");
  }

  if (dryRun) {
    console.log(`Prepared ${rows.length} wiki collection page rows.`);
    for (const [index, row] of rows.entries()) {
      const config = targetCollections[index];
      const dataset = config ? await readDataset(config) : null;
      console.log(`${row.wiki_slug}/${row.collection_slug} | ${row.code} | ${row.title} | items=${dataset?.rows.length ?? "unknown"}`);
    }
    return;
  }

  const sb = supabaseAdmin();
  const { error } = await sb.from("wiki_collection_pages").upsert(rows, { onConflict: "wiki_slug,collection_slug" });
  if (error) throw error;

  console.log(`Upserted ${rows.length} ${draft ? "draft" : "published"} wiki collection pages.`);
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

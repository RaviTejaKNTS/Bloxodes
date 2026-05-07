import "../shared/load-env";
import fs from "node:fs/promises";
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

type CatalogPageUpsert = {
  universe_id: number | null;
  code: string;
  title: string;
  seo_title: string;
  meta_description: string;
  intro_md: string;
  how_it_works_md: string;
  description_json: Record<string, string>;
  faq_json: Array<{ q: string; a: string }>;
  cta_label: string;
  cta_url: string;
  wiki_md: string;
  wiki_sort_order: number;
  wiki_item_count: number;
  wiki_image_urls: string[];
  thumb_url: string | null;
  is_published: boolean;
  published_at: string | null;
};

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const draft = args.has("--draft");
const allowProd = args.has("--allow-prod");

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

async function buildRows(existingPublishedAt: Map<string, string | null>, universeIdsByGameSlug: Map<string, number | null>) {
  const now = new Date().toISOString();
  const rows: CatalogPageUpsert[] = [];

  for (const config of GAME_DATASET_CATALOGS) {
    const dataset = await readDataset(config);
    const copy = buildGameDatasetCatalogCopy({
      config,
      itemCount: dataset.rows.length,
      columns: dataset.columns,
      imageUrls: dataset.imageUrls
    });

    rows.push({
      universe_id: universeIdsByGameSlug.get(config.gameSlug) ?? null,
      code: copy.code,
      title: copy.title,
      seo_title: copy.seo_title,
      meta_description: copy.meta_description,
      intro_md: copy.intro_md,
      how_it_works_md: copy.how_it_works_md,
      description_json: copy.description_json,
      faq_json: copy.faq_json,
      cta_label: copy.cta_label,
      cta_url: copy.cta_url,
      wiki_md: copy.wiki_md,
      wiki_sort_order: copy.wiki_sort_order,
      wiki_item_count: copy.wiki_item_count,
      wiki_image_urls: copy.wiki_image_urls,
      thumb_url: copy.thumb_url,
      is_published: !draft,
      published_at: draft ? existingPublishedAt.get(copy.code) ?? null : existingPublishedAt.get(copy.code) ?? now
    });
  }

  return rows;
}

async function loadExistingPublishedAt() {
  if (dryRun) return new Map<string, string | null>();
  const sb = supabaseAdmin();
  const codes = GAME_DATASET_CATALOGS.map((config) => config.code);
  const { data, error } = await sb.from("catalog_pages").select("code, published_at").in("code", codes);
  if (error) throw error;
  return new Map(
    (data ?? []).map((row) => [
      (row as { code: string }).code,
      (row as { published_at?: string | null }).published_at ?? null
    ])
  );
}

async function loadUniverseIdsByGameSlug() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE) return new Map<string, number | null>();
  const sb = supabaseAdmin();
  const { data, error } = await sb.from("roblox_universes").select("universe_id, slug, name, display_name");
  if (error) throw error;

  const rows = (data ?? []) as Array<{
    universe_id: number;
    slug?: string | null;
    name?: string | null;
    display_name?: string | null;
  }>;

  return new Map(
    GAME_DATASET_CATALOG_GROUPS.map((group) => {
      const candidates = new Set([group.gameSlug, group.gameName, ...group.universeNames].map(normalizeLookup));
      const match = rows.find((row) =>
        [row.slug, row.name, row.display_name].some((value) => candidates.has(normalizeLookup(value)))
      );
      return [group.gameSlug, match?.universe_id ?? null];
    })
  );
}

function normalizeLookup(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/!+$/g, "");
}

async function main() {
  if (!dryRun && (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE)) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE. Use --dry-run to preview without writing.");
  }
  if (!dryRun && !allowProd && !isLocalSupabaseUrl(process.env.SUPABASE_URL)) {
    throw new Error("Refusing to write to a non-local Supabase URL. Use --allow-prod only after local review is clean.");
  }

  const [existingPublishedAt, universeIdsByGameSlug] = await Promise.all([
    loadExistingPublishedAt(),
    loadUniverseIdsByGameSlug()
  ]);
  const rows = await buildRows(existingPublishedAt, universeIdsByGameSlug);

  if (dryRun) {
    console.log(`Prepared ${rows.length} catalog page rows.`);
    for (const row of rows) {
      console.log(`${row.code} | ${row.title} | items=${row.wiki_item_count}`);
    }
    return;
  }

  const sb = supabaseAdmin();
  const { error } = await sb.from("catalog_pages").upsert(rows, { onConflict: "code" });
  if (error) throw error;

  console.log(`Upserted ${rows.length} ${draft ? "draft" : "published"} catalog pages.`);
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

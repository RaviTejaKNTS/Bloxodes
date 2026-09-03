import "server-only";

import { cache } from "react";
import { publicContentCache } from "@/lib/public-content-cache";
import { resolveWikiMediaUrl } from "@/lib/wiki-media";
import { supabaseAdmin } from "@/lib/supabase";
import type { GameCollectionRenderConfig } from "@/lib/game-collections";

const REVALIDATE_SECONDS = 3600;
const BYPASS_CACHE = process.env.NODE_ENV === "development";

function normalizeSlug(value: string): string {
  return value.trim().toLowerCase().replace(/^\/+|\/+$/g, "");
}

function humanizeSlug(value: string): string {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export type GtaGame = {
  id: string;
  slug: string;
  title: string;
  short_title: string | null;
  installment: string | null;
  developer: string | null;
  publisher: string | null;
  description_md: string | null;
  cover_image: string | null;
  hero_image: string | null;
  official_url: string | null;
  release_dates_json: Record<string, unknown> | null;
  platforms_json: unknown[] | null;
  status: "announced" | "upcoming" | "released";
  is_published: boolean;
  published_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type GtaWikiPage = {
  id: string;
  game_id: string;
  slug: string;
  title: string;
  seo_title: string | null;
  meta_description: string | null;
  description_md: string | null;
  cover_image: string | null;
  controls_json: unknown;
  tips_md: string | null;
  is_published: boolean;
  published_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  content_updated_at: string | null;
  game_title: string;
  game_short_title: string | null;
  game_installment: string | null;
  game_developer: string | null;
  game_publisher: string | null;
  game_description_md: string | null;
  game_cover_image: string | null;
  game_hero_image: string | null;
  game_official_url: string | null;
  game_release_dates_json: Record<string, unknown> | null;
  game_platforms_json: unknown[] | null;
  game_status: GtaGame["status"];
};

export type GtaWikiListEntry = Pick<
  GtaWikiPage,
  | "id"
  | "slug"
  | "title"
  | "meta_description"
  | "cover_image"
  | "game_cover_image"
  | "game_hero_image"
  | "published_at"
  | "created_at"
  | "updated_at"
  | "content_updated_at"
>;

export type GtaWikiCollectionPage = {
  id: string;
  wiki_page_id: string;
  game_id: string;
  wiki_slug: string;
  collection_slug: string;
  code: string;
  title: string;
  display_name: string;
  item_count: number;
  seo_title: string;
  meta_description: string;
  intro_md: string | null;
  how_it_works_md: string | null;
  description_md: string | null;
  description_json: Record<string, string> | null;
  faq_json: Array<{ q: string; a: string }> | null;
  schema_ld_json: Record<string, unknown> | null;
  thumb_url: string | null;
  wiki_md: string | null;
  wiki_sort_order: number | null;
  is_published: boolean;
  published_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  content_updated_at: string | null;
  published_dataset_id: string | null;
  game_title: string;
  game_short_title: string | null;
  game_cover_image: string | null;
  game_hero_image: string | null;
};

export type GtaCollectionDatasetDocument = {
  meta: Record<string, unknown>;
  items: Array<{
    item: Record<string, unknown>;
    system: { slug: string; section: string; sortOrder: number; image: string | null };
  }>;
};

export type PublishedGtaCollectionRuntime = {
  datasetId: string;
  contentHash: string;
  itemCount: number;
  config: GameCollectionRenderConfig;
  document: GtaCollectionDatasetDocument;
  meta: Record<string, unknown>;
};

async function withCache<T>(key: string[], tags: string[], loader: () => Promise<T>): Promise<T> {
  if (BYPASS_CACHE) return loader();
  return publicContentCache(loader, key, { revalidate: REVALIDATE_SECONDS, tags })();
}

export function buildGtaWikiPath(slug: string): string {
  return `/gta/wiki/${normalizeSlug(slug)}`;
}

export function buildGtaCollectionPath(wikiSlug: string, collectionSlug: string): string {
  return `${buildGtaWikiPath(wikiSlug)}/${normalizeSlug(collectionSlug)}`;
}

export async function listPublishedGtaGames(): Promise<GtaGame[]> {
  return withCache(["gta-games-index-v1"], ["gta-games-index"], async () => {
    const { data, error } = await supabaseAdmin()
      .from("gta_games")
      .select("*")
      .eq("is_published", true)
      .order("title", { ascending: true });
    if (error) {
      console.error("Error fetching GTA games", error);
      return [];
    }
    return (data ?? []) as GtaGame[];
  });
}

export async function getGtaGameBySlug(slug: string): Promise<GtaGame | null> {
  const normalized = normalizeSlug(slug);
  if (!normalized) return null;
  return withCache(["gta-game-v1", normalized], ["gta-games-index", `gta-game:${normalized}`], async () => {
    const { data, error } = await supabaseAdmin()
      .from("gta_games")
      .select("*")
      .eq("slug", normalized)
      .eq("is_published", true)
      .maybeSingle();
    if (error) {
      console.error("Error fetching GTA game", error);
      return null;
    }
    return (data as GtaGame | null) ?? null;
  });
}

export async function listPublishedGtaWikiPages(): Promise<GtaWikiListEntry[]> {
  return withCache(["gta-wiki-index-v1"], ["gta-wiki-index"], async () => {
    const { data, error } = await supabaseAdmin()
      .from("gta_wiki_pages_view")
      .select("id, slug, title, meta_description, cover_image, game_cover_image, game_hero_image, published_at, created_at, updated_at, content_updated_at")
      .eq("is_published", true)
      .order("content_updated_at", { ascending: false });
    if (error) {
      console.error("Error fetching GTA wiki index", error);
      return [];
    }
    return (data ?? []) as GtaWikiListEntry[];
  });
}

export async function getGtaWikiPageBySlug(slug: string): Promise<GtaWikiPage | null> {
  const normalized = normalizeSlug(slug);
  if (!normalized) return null;
  return withCache(["gta-wiki-page-v1", normalized], ["gta-wiki-index", `gta-wiki:${normalized}`], async () => {
    const { data, error } = await supabaseAdmin()
      .from("gta_wiki_pages_view")
      .select("*")
      .eq("slug", normalized)
      .eq("is_published", true)
      .maybeSingle();
    if (error) {
      console.error("Error fetching GTA wiki page", error);
      return null;
    }
    return (data as GtaWikiPage | null) ?? null;
  });
}

export async function getGtaWikiCollectionPageByPath(
  wikiSlug: string,
  collectionSlug: string
): Promise<GtaWikiCollectionPage | null> {
  const wiki = normalizeSlug(wikiSlug);
  const collection = normalizeSlug(collectionSlug);
  if (!wiki || !collection) return null;
  return withCache(
    ["gta-wiki-collection-v1", wiki, collection],
    ["gta-wiki-collection-index", `gta-wiki:${wiki}`, `gta-wiki-collection:${wiki}/${collection}`],
    async () => {
      const { data, error } = await supabaseAdmin()
        .from("gta_wiki_collection_pages_view")
        .select("*")
        .eq("wiki_slug", wiki)
        .eq("collection_slug", collection)
        .eq("is_published", true)
        .not("published_dataset_id", "is", null)
        .maybeSingle();
      if (error) {
        console.error("Error fetching GTA wiki collection", error);
        return null;
      }
      return (data as GtaWikiCollectionPage | null) ?? null;
    }
  );
}

export async function listPublishedGtaWikiCollectionsByWikiSlug(
  wikiSlug: string
): Promise<GtaWikiCollectionPage[]> {
  const normalized = normalizeSlug(wikiSlug);
  if (!normalized) return [];
  return withCache(
    ["gta-wiki-collections-by-wiki-v1", normalized],
    ["gta-wiki-collection-index", `gta-wiki:${normalized}`],
    async () => {
      const { data, error } = await supabaseAdmin()
        .from("gta_wiki_collection_pages_view")
        .select("*")
        .eq("wiki_slug", normalized)
        .eq("is_published", true)
        .not("published_dataset_id", "is", null)
        .order("wiki_sort_order", { ascending: true, nullsFirst: false })
        .order("title", { ascending: true });
      if (error) {
        console.error("Error fetching GTA wiki collections", error);
        return [];
      }
      return (data ?? []) as GtaWikiCollectionPage[];
    }
  );
}

export async function listPublishedGtaWikiCollections(): Promise<GtaWikiCollectionPage[]> {
  return withCache(["gta-wiki-collections-index-v1"], ["gta-wiki-collection-index"], async () => {
    const { data, error } = await supabaseAdmin()
      .from("gta_wiki_collection_pages_view")
      .select("*")
      .eq("is_published", true)
      .not("published_dataset_id", "is", null)
      .order("content_updated_at", { ascending: false });
    if (error) {
      console.error("Error fetching GTA wiki collections index", error);
      return [];
    }
    return (data ?? []) as GtaWikiCollectionPage[];
  });
}

export async function listPublishedGtaWikiCollectionImageUrls(
  page: GtaWikiCollectionPage,
  limit = 6
): Promise<string[]> {
  if (!page.published_dataset_id) return [];
  const safeLimit = Math.max(1, Math.min(12, Math.floor(limit)));
  return withCache(
    ["gta-wiki-collection-images-v1", page.code, page.published_dataset_id, String(safeLimit)],
    ["gta-wiki-collection-index", `gta-wiki:${page.wiki_slug}`, `gta-wiki-collection:${page.wiki_slug}/${page.collection_slug}`],
    async () => {
      const { data, error } = await supabaseAdmin()
        .from("gta_wiki_collection_items")
        .select("image_key")
        .eq("dataset_id", page.published_dataset_id)
        .not("image_key", "is", null)
        .order("sort_order", { ascending: true })
        .limit(safeLimit);
      if (error) {
        console.error("Error fetching GTA collection images", error);
        return [];
      }
      return (data ?? [])
        .map((row) => resolveWikiMediaUrl(row.image_key))
        .filter((url): url is string => Boolean(url));
    }
  );
}

async function loadPublishedGtaWikiCollectionRuntime(
  page: GtaWikiCollectionPage
): Promise<PublishedGtaCollectionRuntime | null> {
  if (!page.published_dataset_id) return null;
  const supabase = supabaseAdmin();
  const { data: datasetData, error: datasetError } = await supabase
    .from("gta_wiki_collection_datasets")
    .select("id, schema_version, content_hash, item_count, meta_json")
    .eq("id", page.published_dataset_id)
    .eq("collection_page_id", page.id)
    .maybeSingle();
  if (datasetError || !datasetData) {
    if (datasetError) console.error("Error fetching GTA collection dataset", datasetError);
    return null;
  }

  const rows: Array<{
    item_slug: string;
    item_name: string;
    section: string;
    sort_order: number;
    image_key: string | null;
    fields_json: Record<string, unknown> | null;
  }> = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("gta_wiki_collection_items")
      .select("item_slug, item_name, section, sort_order, image_key, fields_json")
      .eq("dataset_id", datasetData.id)
      .order("sort_order", { ascending: true })
      .order("item_slug", { ascending: true })
      .range(from, from + 999);
    if (error) {
      console.error("Error fetching GTA collection items", error);
      return null;
    }
    const chunk = (data ?? []) as typeof rows;
    rows.push(...chunk);
    if (chunk.length < 1000) break;
  }

  if (rows.length !== datasetData.item_count) {
    throw new Error(`GTA collection ${page.code} expected ${datasetData.item_count} items and loaded ${rows.length}.`);
  }

  const meta: Record<string, unknown> = {
    ...((datasetData.meta_json && typeof datasetData.meta_json === "object" && !Array.isArray(datasetData.meta_json)
      ? datasetData.meta_json
      : {}) as Record<string, unknown>),
    schemaVersion: datasetData.schema_version
  };
  const runtimeMeta = meta.runtime && typeof meta.runtime === "object" && !Array.isArray(meta.runtime)
    ? (meta.runtime as Record<string, unknown>)
    : {};
  const config: GameCollectionRenderConfig = {
    code: page.code,
    gameSlug: page.wiki_slug,
    gameName: typeof runtimeMeta.gameName === "string" && runtimeMeta.gameName.trim()
      ? runtimeMeta.gameName.trim()
      : page.game_short_title || page.game_title || humanizeSlug(page.wiki_slug),
    slug: page.collection_slug,
    label: page.display_name || humanizeSlug(page.collection_slug),
    sortOrder: page.wiki_sort_order ?? 0
  };
  return {
    datasetId: datasetData.id,
    contentHash: datasetData.content_hash,
    itemCount: datasetData.item_count,
    config,
    meta,
    document: {
      meta,
      items: rows.map((row) => ({
        item: { ...(row.fields_json ?? {}), name: row.item_name },
        system: {
          slug: row.item_slug,
          section: row.section,
          sortOrder: row.sort_order,
          image: resolveWikiMediaUrl(row.image_key)
        }
      }))
    }
  };
}

export const getPublishedGtaWikiCollectionRuntime = cache(loadPublishedGtaWikiCollectionRuntime);

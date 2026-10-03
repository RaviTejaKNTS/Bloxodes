import { normalizeCollectionPageType } from "./wiki-collection-page-type";
import "server-only";

import { cache } from "react";
import { publicContentCache } from "@/lib/public-content-cache";
import { resolveWikiMediaUrl } from "@/lib/wiki-media";
import { supabaseAdmin } from "@/lib/supabase";
import type { GameCollectionRenderConfig } from "@/lib/game-collections";
import { validateMinecraftToolRules } from "@/lib/minecraft-tools/validate";
import { summarizeMinecraftCollectionEditions, type MinecraftCollectionEditionSummary } from "@/lib/minecraft-edition";

const REVALIDATE_SECONDS = 3600;
const BYPASS_CACHE = process.env.NODE_ENV === "development";

function normalizeSlug(value: string): string {
  return value.trim().toLowerCase();
}

function humanizeSlug(value: string): string {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export type MinecraftGame = {
  id: string;
  slug: string;
  title: string;
  short_title: string | null;
  installment: string | null;
  content_kind: "game" | "expansion" | "online";
  parent_game_id: string | null;
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

export type MinecraftWikiPage = {
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
  game_content_kind: MinecraftGame["content_kind"];
  game_parent_game_id: string | null;
  game_developer: string | null;
  game_publisher: string | null;
  game_description_md: string | null;
  game_cover_image: string | null;
  game_hero_image: string | null;
  game_official_url: string | null;
  game_release_dates_json: Record<string, unknown> | null;
  game_platforms_json: unknown[] | null;
  game_status: MinecraftGame["status"];
};

export type MinecraftWikiListEntry = Pick<
  MinecraftWikiPage,
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

export type MinecraftWikiCollectionPage = {
  id: string;
  wiki_page_id: string;
  game_id: string;
  wiki_slug: string;
  collection_slug: string;
  code: string;
  page_type: "database" | "collectible";
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
  game_content_kind: MinecraftGame["content_kind"];
  game_parent_game_id: string | null;
  game_cover_image: string | null;
  game_hero_image: string | null;
};

export type MinecraftCollectionDatasetDocument = {
  meta: Record<string, unknown>;
  items: Array<{
    item: Record<string, unknown>;
    system: { slug: string; section: string; sortOrder: number; image: string | null };
  }>;
};

export type PublishedMinecraftCollectionRuntime = {
  datasetId: string;
  contentHash: string;
  itemCount: number;
  config: GameCollectionRenderConfig;
  document: MinecraftCollectionDatasetDocument;
  meta: Record<string, unknown>;
};

async function withCache<T>(key: string[], tags: string[], loader: () => Promise<T>): Promise<T> {
  if (BYPASS_CACHE) return loader();
  return publicContentCache(loader, key, { revalidate: REVALIDATE_SECONDS, tags })();
}

export function buildMinecraftWikiPath(slug: string): string {
  return "/minecraft/wiki";
}

export function buildMinecraftCollectionPath(wikiSlug: string, collectionSlug: string): string {
  return `/minecraft/wiki/${normalizeSlug(collectionSlug)}`;
}

type MinecraftWikiImageFields = {
  cover_image?: string | null;
  game_cover_image?: string | null;
  game_hero_image?: string | null;
};

/** The wide artwork used for Minecraft cards, metadata, and structured data. */
export function resolveMinecraftWikiCoverImage(page: MinecraftWikiImageFields): string {
  return page.cover_image?.trim() || page.game_cover_image?.trim() || page.game_hero_image?.trim() || "/Bloxodes.png";
}

/** The separate square-friendly artwork shown beside a Minecraft wiki title. */
export function resolveMinecraftWikiThumbnailImage(page: MinecraftWikiImageFields): string {
  return page.game_hero_image?.trim() || page.cover_image?.trim() || page.game_cover_image?.trim() || "/Bloxodes.png";
}

export async function listPublishedMinecraftGames(): Promise<MinecraftGame[]> {
  return withCache(["minecraft-games-index-v1"], ["minecraft-games-index"], async () => {
    const { data, error } = await supabaseAdmin()
      .from("minecraft_games")
      .select("*")
      .eq("is_published", true)
      .order("title", { ascending: true });
    if (error) {
      console.error("Error fetching Minecraft games", error);
      return [];
    }
    return (data ?? []) as MinecraftGame[];
  });
}

export async function getMinecraftGameBySlug(slug: string): Promise<MinecraftGame | null> {
  const normalized = normalizeSlug(slug);
  if (!normalized) return null;
  return withCache(
    ["minecraft-game-v1", normalized],
    ["minecraft-games-index", `minecraft-game:${normalized}`],
    async () => {
      const { data, error } = await supabaseAdmin()
        .from("minecraft_games")
        .select("*")
        .eq("slug", normalized)
        .eq("is_published", true)
        .maybeSingle();
      if (error) {
        console.error("Error fetching Minecraft game", error);
        return null;
      }
      return (data as MinecraftGame | null) ?? null;
    }
  );
}

export async function listPublishedMinecraftWikiPages(): Promise<MinecraftWikiListEntry[]> {
  return withCache(["minecraft-wiki-index-v1"], ["minecraft-wiki-index"], async () => {
    const { data, error } = await supabaseAdmin()
      .from("minecraft_wiki_pages_view")
      .select("id, slug, title, meta_description, cover_image, game_cover_image, game_hero_image, published_at, created_at, updated_at, content_updated_at")
      .eq("is_published", true)
      .order("content_updated_at", { ascending: false });
    if (error) {
      console.error("Error fetching Minecraft wiki index", error);
      return [];
    }
    return (data ?? []) as MinecraftWikiListEntry[];
  });
}

export async function getMinecraftWikiPageBySlug(slug: string): Promise<MinecraftWikiPage | null> {
  const normalized = normalizeSlug(slug);
  if (!normalized) return null;
  return withCache(
    ["minecraft-wiki-page-v1", normalized],
    ["minecraft-wiki-index", `minecraft-wiki:${normalized}`],
    async () => {
      const { data, error } = await supabaseAdmin()
        .from("minecraft_wiki_pages_view")
        .select("*")
        .eq("slug", normalized)
        .eq("is_published", true)
        .maybeSingle();
      if (error) {
        console.error("Error fetching Minecraft wiki page", error);
        return null;
      }
      return (data as MinecraftWikiPage | null) ?? null;
    }
  );
}

export async function getMinecraftWikiCollectionPageByPath(
  wikiSlug: string,
  collectionSlug: string
): Promise<MinecraftWikiCollectionPage | null> {
  const wiki = normalizeSlug(wikiSlug);
  const collection = normalizeSlug(collectionSlug);
  if (!wiki || !collection) return null;
  return withCache(
    ["minecraft-wiki-collection-v1", wiki, collection],
    [
      "minecraft-wiki-collection-index",
      `minecraft-wiki:${wiki}`,
      `minecraft-wiki-collection:${collection}`
    ],
    async () => {
      const { data, error } = await supabaseAdmin()
        .from("minecraft_wiki_collection_pages_view")
        .select("*")
        .eq("wiki_slug", wiki)
        .eq("collection_slug", collection)
        .eq("is_published", true)
        .not("published_dataset_id", "is", null)
        .maybeSingle();
      if (error) {
        console.error("Error fetching Minecraft wiki collection", error);
        return null;
      }
      return data ? { ...data, page_type: normalizeCollectionPageType(data.page_type) } as MinecraftWikiCollectionPage : null;
    }
  );
}

export async function listPublishedMinecraftWikiCollectionsByWikiSlug(
  wikiSlug: string
): Promise<MinecraftWikiCollectionPage[]> {
  const normalized = normalizeSlug(wikiSlug);
  if (!normalized) return [];
  return withCache(
    ["minecraft-wiki-collections-by-wiki-v1", normalized],
    ["minecraft-wiki-collection-index", `minecraft-wiki:${normalized}`],
    async () => {
      const { data, error } = await supabaseAdmin()
        .from("minecraft_wiki_collection_pages_view")
        .select("*")
        .eq("wiki_slug", normalized)
        .eq("is_published", true)
        .not("published_dataset_id", "is", null)
        .order("wiki_sort_order", { ascending: true, nullsFirst: false })
        .order("title", { ascending: true });
      if (error) {
        console.error("Error fetching Minecraft wiki collections", error);
        return [];
      }
      return (data ?? []).map((row) => ({ ...row, page_type: normalizeCollectionPageType(row.page_type) })) as MinecraftWikiCollectionPage[];
    }
  );
}

export async function listPublishedMinecraftWikiCollections(): Promise<MinecraftWikiCollectionPage[]> {
  return withCache(["minecraft-wiki-collections-index-v1"], ["minecraft-wiki-collection-index"], async () => {
    const { data, error } = await supabaseAdmin()
      .from("minecraft_wiki_collection_pages_view")
      .select("*")
      .eq("is_published", true)
      .not("published_dataset_id", "is", null)
      .order("content_updated_at", { ascending: false });
    if (error) {
      console.error("Error fetching Minecraft wiki collections index", error);
      return [];
    }
    return (data ?? []).map((row) => ({ ...row, page_type: normalizeCollectionPageType(row.page_type) })) as MinecraftWikiCollectionPage[];
  });
}

export async function listPublishedMinecraftWikiCollectionImageUrls(
  page: MinecraftWikiCollectionPage,
  limit = 6
): Promise<string[]> {
  if (!page.published_dataset_id) return [];
  const safeLimit = Math.max(1, Math.min(12, Math.floor(limit)));
  return withCache(
    ["minecraft-wiki-collection-images-v1", page.code, page.published_dataset_id, String(safeLimit)],
    [
      "minecraft-wiki-collection-index",
      `minecraft-wiki:${page.wiki_slug}`,
      `minecraft-wiki-collection:${page.collection_slug}`
    ],
    async () => {
      const { data, error } = await supabaseAdmin()
        .from("minecraft_wiki_collection_items")
        .select("image_key")
        .eq("dataset_id", page.published_dataset_id)
        .not("image_key", "is", null)
        .order("sort_order", { ascending: true })
        .limit(safeLimit);
      if (error) {
        console.error("Error fetching Minecraft collection images", error);
        return [];
      }
      return (data ?? [])
        .map((row) => resolveWikiMediaUrl(row.image_key))
        .filter((url): url is string => Boolean(url));
    }
  );
}

/** Read only edition membership and images from the same immutable revision as the collection page. */
export async function getPublishedMinecraftWikiCollectionEditionSummary(
  page: MinecraftWikiCollectionPage
): Promise<MinecraftCollectionEditionSummary> {
  if (!page.published_dataset_id) throw new Error(`Minecraft collection ${page.code} has no published revision.`);
  return withCache(
    ["minecraft-wiki-collection-edition-summary-v1", page.code, page.published_dataset_id],
    ["minecraft-wiki-collection-index", `minecraft-wiki:${page.wiki_slug}`, `minecraft-wiki-collection:${page.collection_slug}`],
    async () => {
      const rows: Array<{ editions: unknown; image_key: string | null }> = [];
      const supabase = supabaseAdmin();
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase
          .from("minecraft_wiki_collection_items")
          .select("editions:fields_json->editions, image_key")
          .eq("dataset_id", page.published_dataset_id)
          .order("sort_order", { ascending: true })
          .order("item_slug", { ascending: true })
          .range(from, from + 999);
        if (error) throw new Error(`Could not load edition counts for ${page.code}: ${error.message}`);
        const chunk = (data ?? []) as typeof rows;
        rows.push(...chunk);
        if (chunk.length < 1000) break;
      }
      if (rows.length !== page.item_count) throw new Error(`Minecraft collection ${page.code} expected ${page.item_count} summary rows and loaded ${rows.length}.`);
      return summarizeMinecraftCollectionEditions(rows.map(row => ({ editions: row.editions, image: resolveWikiMediaUrl(row.image_key) })));
    }
  );
}

async function loadPublishedMinecraftWikiCollectionRuntime(
  page: MinecraftWikiCollectionPage
): Promise<PublishedMinecraftCollectionRuntime | null> {
  if (!page.published_dataset_id) return null;
  const supabase = supabaseAdmin();
  const { data: datasetData, error: datasetError } = await supabase
    .from("minecraft_wiki_collection_datasets")
    .select("id, schema_version, content_hash, item_count, meta_json")
    .eq("id", page.published_dataset_id)
    .eq("collection_page_id", page.id)
    .maybeSingle();
  if (datasetError || !datasetData) {
    if (datasetError) console.error("Error fetching Minecraft collection dataset", datasetError);
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
      .from("minecraft_wiki_collection_items")
      .select("item_slug, item_name, section, sort_order, image_key, fields_json")
      .eq("dataset_id", datasetData.id)
      .order("sort_order", { ascending: true })
      .order("item_slug", { ascending: true })
      .range(from, from + 999);
    if (error) {
      console.error("Error fetching Minecraft collection items", error);
      return null;
    }
    const chunk = (data ?? []) as typeof rows;
    rows.push(...chunk);
    if (chunk.length < 1000) break;
  }

  if (rows.length !== datasetData.item_count) {
    throw new Error(`Minecraft collection ${page.code} expected ${datasetData.item_count} items and loaded ${rows.length}.`);
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

export const getPublishedMinecraftWikiCollectionRuntime = cache(loadPublishedMinecraftWikiCollectionRuntime);

export type MinecraftEdition = "java" | "bedrock";
export type MinecraftToolPage = import("@/lib/tools").ToolContent & {
  id: string;
  slug: string;
  tool_key: string;
  rules_json: Record<string, unknown>;
  description_md?: string | null;
};

export async function getMinecraftTool(slug: string): Promise<MinecraftToolPage | null> {
  const normalized = normalizeSlug(slug);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized)) return null;
  return withCache(["minecraft-tool-v1", normalized], ["minecraft-tools-index", `minecraft-tool:${normalized}`], async () => {
    const { data, error } = await supabaseAdmin().from("minecraft_tools_view").select("*").eq("slug", normalized).eq("is_published", true).maybeSingle();
    if (error) throw new Error(`Minecraft tool read failed: ${error.message}`);
    if (data) {
      if (data.tool_key !== normalized) throw new Error("Minecraft tool ownership does not match its route.");
      validateMinecraftToolRules(data.tool_key, data.rules_json);
    }
    return data as MinecraftToolPage | null;
  });
}

export async function listMinecraftTools(): Promise<MinecraftToolPage[]> {
  return withCache(["minecraft-tools-index-v1"], ["minecraft-tools-index"], async () => {
    const { data, error } = await supabaseAdmin().from("minecraft_tools_view").select("*").eq("is_published", true).order("title");
    if (error) throw new Error(`Minecraft tool directory read failed: ${error.message}`);
    return (data ?? []) as MinecraftToolPage[];
  });
}

export const getMinecraftToolBySlug = getMinecraftTool;
export const listPublishedMinecraftTools = listMinecraftTools;
export function getMinecraftWiki() { return getMinecraftWikiPageBySlug("minecraft"); }
export function listPublishedMinecraftCollections() { return listPublishedMinecraftWikiCollectionsByWikiSlug("minecraft"); }
export function getMinecraftCollectionBySlug(slug: string) { return getMinecraftWikiCollectionPageByPath("minecraft", slug); }
export const getPublishedMinecraftCollectionRuntime = getPublishedMinecraftWikiCollectionRuntime;
export type MinecraftCollectionPage = MinecraftWikiCollectionPage;

export async function getMinecraftToolData(collectionSlugs: string[]): Promise<Record<string, PublishedMinecraftCollectionRuntime>> {
  const pairs = await Promise.all([...new Set(collectionSlugs)].map(async (slug) => {
    const page = await getMinecraftCollectionBySlug(slug);
    if (!page) throw new Error(`Required Minecraft collection ${slug} is not published.`);
    const runtime = await getPublishedMinecraftCollectionRuntime(page);
    if (!runtime) throw new Error(`Required Minecraft collection ${slug} has no published runtime.`);
    return [slug, runtime] as const;
  }));
  return Object.fromEntries(pairs);
}

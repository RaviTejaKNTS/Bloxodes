import "server-only";
import { publicContentCache } from "@/lib/public-content-cache";
import { supabaseAdmin } from "@/lib/supabase";

export type WikiCatalogFaqEntry = { q: string; a: string };

export type WikiCatalogPageContent = {
  id?: string;
  wiki_page_id?: string | null;
  universe_id?: number | null;
  wiki_slug: string;
  collection_slug: string;
  code: string;
  title: string;
  display_name?: string | null;
  item_count?: number | null;
  seo_title: string;
  meta_description: string;
  intro_md: string | null;
  how_it_works_md: string | null;
  description_md?: string | null;
  description_json: Record<string, string>;
  faq_json: WikiCatalogFaqEntry[];
  schema_ld_json?: unknown;
  thumb_url?: string | null;
  wiki_md?: string | null;
  wiki_sort_order?: number | null;
  is_published: boolean;
  published_at?: string | null;
  created_at?: string;
  updated_at?: string;
  content_updated_at?: string | null;
};

export type WikiCatalogListEntry = Pick<
  WikiCatalogPageContent,
  | "id"
  | "wiki_page_id"
  | "universe_id"
  | "wiki_slug"
  | "collection_slug"
  | "code"
  | "title"
  | "display_name"
  | "item_count"
  | "meta_description"
  | "thumb_url"
  | "wiki_md"
  | "wiki_sort_order"
  | "published_at"
  | "created_at"
  | "updated_at"
  | "content_updated_at"
>;

const WIKI_CATALOG_REVALIDATE_SECONDS = 86400;
const WIKI_CATALOG_SELECT_FIELDS =
  "id, wiki_page_id, universe_id, wiki_slug, collection_slug, code, title, display_name, item_count, seo_title, meta_description, intro_md, how_it_works_md, description_md, description_json, faq_json, schema_ld_json, thumb_url, wiki_md, wiki_sort_order, is_published, published_at, created_at, updated_at, content_updated_at";
const BYPASS_WIKI_CATALOG_CACHE = process.env.NODE_ENV === "development";

function normalizeSlug(value: string): string {
  return value.trim().toLowerCase().replace(/^\/+|\/+$/g, "");
}

function normalizeCode(value: string): string {
  return value.trim().toLowerCase();
}

function buildWikiCatalogTags(wikiSlug: string, collectionSlug?: string | null): string[] {
  const tags = ["wiki-catalog-index", "wiki-index", `wiki:${wikiSlug}`];
  if (collectionSlug) tags.push(`wiki-catalog:${wikiSlug}/${collectionSlug}`);
  return tags;
}

export function buildWikiCatalogPath(wikiSlug: string, collectionSlug: string): string {
  return `/wiki/${normalizeSlug(wikiSlug)}/${normalizeSlug(collectionSlug)}`;
}

export async function getWikiCatalogPageByPath(
  wikiSlug: string,
  collectionSlug: string
): Promise<WikiCatalogPageContent | null> {
  const normalizedWikiSlug = normalizeSlug(wikiSlug);
  const normalizedCollectionSlug = normalizeSlug(collectionSlug);
  if (!normalizedWikiSlug || !normalizedCollectionSlug) return null;

  const fetchPage = async () => {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("wiki_catalog_pages_view")
      .select(WIKI_CATALOG_SELECT_FIELDS)
      .eq("wiki_slug", normalizedWikiSlug)
      .eq("collection_slug", normalizedCollectionSlug)
      .eq("is_published", true)
      .maybeSingle();

    if (error) {
      console.error("Error fetching wiki catalog page", error);
      return null;
    }

    return (data as WikiCatalogPageContent | null) ?? null;
  };

  if (BYPASS_WIKI_CATALOG_CACHE) return fetchPage();

  const cached = publicContentCache(
    fetchPage,
    ["wiki-catalog-page-by-path-v1", normalizedWikiSlug, normalizedCollectionSlug],
    {
      revalidate: WIKI_CATALOG_REVALIDATE_SECONDS,
      tags: buildWikiCatalogTags(normalizedWikiSlug, normalizedCollectionSlug)
    }
  );

  return cached();
}

export async function getWikiCatalogPageByCode(code: string): Promise<WikiCatalogPageContent | null> {
  const normalizedCode = normalizeCode(code);
  if (!normalizedCode) return null;

  const fetchPage = async () => {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("wiki_catalog_pages_view")
      .select(WIKI_CATALOG_SELECT_FIELDS)
      .eq("code", normalizedCode)
      .eq("is_published", true)
      .maybeSingle();

    if (error) {
      console.error("Error fetching wiki catalog page by code", error);
      return null;
    }

    return (data as WikiCatalogPageContent | null) ?? null;
  };

  if (BYPASS_WIKI_CATALOG_CACHE) return fetchPage();

  const cached = publicContentCache(
    fetchPage,
    ["wiki-catalog-page-by-code-v1", normalizedCode],
    {
      revalidate: WIKI_CATALOG_REVALIDATE_SECONDS,
      tags: ["wiki-catalog-index", `wiki-catalog-code:${normalizedCode}`]
    }
  );

  return cached();
}

export async function listPublishedWikiCatalogPaths(): Promise<Array<{ wiki_slug: string; collection_slug: string }>> {
  const fetchPaths = async () => {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("wiki_catalog_pages")
      .select("wiki_slug, collection_slug")
      .eq("is_published", true)
      .not("wiki_slug", "is", null)
      .not("collection_slug", "is", null);

    if (error) throw error;
    return (data ?? []) as Array<{ wiki_slug: string; collection_slug: string }>;
  };

  if (BYPASS_WIKI_CATALOG_CACHE) return fetchPaths();

  const cached = publicContentCache(
    fetchPaths,
    ["wiki-catalog-paths-v1"],
    {
      revalidate: WIKI_CATALOG_REVALIDATE_SECONDS,
      tags: ["wiki-catalog-index"]
    }
  );

  return cached();
}

export async function listPublishedWikiCatalogPagesByUniverseId(
  universeId: number,
  limit?: number | null
): Promise<WikiCatalogListEntry[]> {
  const safeLimit = typeof limit === "number" && Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : null;
  const supabase = supabaseAdmin();
  let query = supabase
    .from("wiki_catalog_pages_view")
    .select("id, wiki_page_id, universe_id, wiki_slug, collection_slug, code, title, display_name, item_count, meta_description, thumb_url, wiki_md, wiki_sort_order, published_at, created_at, updated_at, content_updated_at")
    .eq("is_published", true)
    .eq("universe_id", universeId)
    .order("wiki_sort_order", { ascending: true, nullsFirst: false })
    .order("title", { ascending: true });

  if (safeLimit) query = query.limit(safeLimit);

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching wiki catalog pages by universe", error);
    return [];
  }

  return (data ?? []) as WikiCatalogListEntry[];
}

export async function listPublishedWikiCatalogPagesByWikiSlug(
  wikiSlug: string,
  limit?: number | null
): Promise<WikiCatalogListEntry[]> {
  const normalizedWikiSlug = normalizeSlug(wikiSlug);
  if (!normalizedWikiSlug) return [];

  const safeLimit = typeof limit === "number" && Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : null;
  const supabase = supabaseAdmin();
  let query = supabase
    .from("wiki_catalog_pages_view")
    .select("id, wiki_page_id, universe_id, wiki_slug, collection_slug, code, title, display_name, item_count, meta_description, thumb_url, wiki_md, wiki_sort_order, published_at, created_at, updated_at, content_updated_at")
    .eq("is_published", true)
    .eq("wiki_slug", normalizedWikiSlug)
    .order("wiki_sort_order", { ascending: true, nullsFirst: false })
    .order("title", { ascending: true });

  if (safeLimit) query = query.limit(safeLimit);

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching wiki catalog pages by wiki slug", error);
    return [];
  }

  return (data ?? []) as WikiCatalogListEntry[];
}

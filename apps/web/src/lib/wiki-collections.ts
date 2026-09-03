import "server-only";
import { publicContentCache } from "@/lib/public-content-cache";
import { supabaseAdmin } from "@/lib/supabase";

export type WikiCollectionFaqEntry = { q: string; a: string };
export type WikiCollectionPageType = "database" | "checklist";

export type WikiCollectionPageContent = {
  id?: string;
  wiki_page_id?: string | null;
  universe_id?: number | null;
  wiki_slug: string;
  collection_slug: string;
  code: string;
  page_type: WikiCollectionPageType;
  title: string;
  display_name?: string | null;
  item_count?: number | null;
  seo_title: string;
  meta_description: string;
  intro_md: string | null;
  how_it_works_md: string | null;
  description_md?: string | null;
  description_json: Record<string, string>;
  faq_json: WikiCollectionFaqEntry[];
  schema_ld_json?: unknown;
  thumb_url?: string | null;
  wiki_md?: string | null;
  wiki_sort_order?: number | null;
  is_published: boolean;
  published_at?: string | null;
  created_at?: string;
  updated_at?: string;
  content_updated_at?: string | null;
  published_dataset_id?: string | null;
};

export type WikiCollectionListEntry = Pick<
  WikiCollectionPageContent,
  | "id"
  | "wiki_page_id"
  | "universe_id"
  | "wiki_slug"
  | "collection_slug"
  | "code"
  | "page_type"
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
  | "published_dataset_id"
>;

const WIKI_COLLECTION_REVALIDATE_SECONDS = 86400;
const WIKI_COLLECTION_SELECT_FIELDS =
  "id, wiki_page_id, universe_id, wiki_slug, collection_slug, code, page_type, title, display_name, item_count, seo_title, meta_description, intro_md, how_it_works_md, description_md, description_json, faq_json, schema_ld_json, thumb_url, wiki_md, wiki_sort_order, is_published, published_at, created_at, updated_at, content_updated_at, published_dataset_id";
const WIKI_COLLECTION_SELECT_FIELDS_COMPAT =
  "id, wiki_page_id, universe_id, wiki_slug, collection_slug, code, title, display_name, item_count, seo_title, meta_description, intro_md, how_it_works_md, description_md, description_json, faq_json, schema_ld_json, thumb_url, wiki_md, wiki_sort_order, is_published, published_at, created_at, updated_at, content_updated_at, published_dataset_id";
const WIKI_COLLECTION_SELECT_FIELDS_LEGACY =
  "id, wiki_page_id, universe_id, wiki_slug, collection_slug, code, title, display_name, item_count, seo_title, meta_description, intro_md, how_it_works_md, description_md, description_json, faq_json, schema_ld_json, thumb_url, wiki_md, wiki_sort_order, is_published, published_at, created_at, updated_at, content_updated_at";
const WIKI_COLLECTION_LIST_FIELDS =
  "id, wiki_page_id, universe_id, wiki_slug, collection_slug, code, page_type, title, display_name, item_count, meta_description, thumb_url, wiki_md, wiki_sort_order, published_at, created_at, updated_at, content_updated_at, published_dataset_id";
const WIKI_COLLECTION_LIST_FIELDS_COMPAT =
  "id, wiki_page_id, universe_id, wiki_slug, collection_slug, code, title, display_name, item_count, meta_description, thumb_url, wiki_md, wiki_sort_order, published_at, created_at, updated_at, content_updated_at, published_dataset_id";
const WIKI_COLLECTION_LIST_FIELDS_LEGACY =
  "id, wiki_page_id, universe_id, wiki_slug, collection_slug, code, title, display_name, item_count, meta_description, thumb_url, wiki_md, wiki_sort_order, published_at, created_at, updated_at, content_updated_at";
const WIKI_COLLECTION_PAGE_TABLE = "wiki_collection_pages";
const WIKI_COLLECTION_PAGE_VIEW = "wiki_collection_pages_view";
const LEGACY_WIKI_COLLECTION_PAGE_TABLE = "wiki_catalog_pages";
const LEGACY_WIKI_COLLECTION_PAGE_VIEW = "wiki_catalog_pages_view";
const BYPASS_WIKI_COLLECTION_CACHE = process.env.NODE_ENV === "development";

type SupabaseClient = ReturnType<typeof supabaseAdmin>;
type SupabaseErrorLike = {
  code?: string;
  message?: string;
};

function normalizeSlug(value: string): string {
  return value.trim().toLowerCase().replace(/^\/+|\/+$/g, "");
}

function normalizeCode(value: string): string {
  return value.trim().toLowerCase();
}

function buildWikiCollectionTags(wikiSlug: string, collectionSlug?: string | null): string[] {
  const tags = ["wiki-collection-index", "wiki-index", `wiki:${wikiSlug}`];
  if (collectionSlug) tags.push(`wiki-collection:${wikiSlug}/${collectionSlug}`);
  return tags;
}

function isMissingRelationError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const { code, message } = error as SupabaseErrorLike;
  return code === "PGRST205" || message?.includes("Could not find the table") === true;
}

function isMissingPublishedDatasetColumnError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const { code, message } = error as SupabaseErrorLike;
  return code === "42703" || code === "PGRST204" || message?.includes("published_dataset_id") === true;
}

function isMissingPageTypeColumnError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const { code, message } = error as SupabaseErrorLike;
  return code === "42703" || code === "PGRST204" || message?.includes("page_type") === true;
}

function normalizePageType(value: unknown): WikiCollectionPageType {
  return value === "checklist" ? "checklist" : "database";
}

function normalizePage(value: unknown): WikiCollectionPageContent | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return {
    ...(value as WikiCollectionPageContent),
    page_type: normalizePageType((value as { page_type?: unknown }).page_type)
  };
}

function normalizeList(values: unknown): WikiCollectionListEntry[] {
  if (!Array.isArray(values)) return [];
  return values
    .filter((value) => value && typeof value === "object" && !Array.isArray(value))
    .map((value) => ({
      ...(value as WikiCollectionListEntry),
      page_type: normalizePageType((value as { page_type?: unknown }).page_type)
    }));
}

async function fetchWikiCollectionPageByPath(
  supabase: SupabaseClient,
  viewName: string,
  wikiSlug: string,
  collectionSlug: string,
  fields = WIKI_COLLECTION_SELECT_FIELDS
) {
  return supabase
    .from(viewName)
    .select(fields)
    .eq("wiki_slug", wikiSlug)
    .eq("collection_slug", collectionSlug)
    .eq("is_published", true)
    .maybeSingle();
}

async function fetchWikiCollectionPageByCode(
  supabase: SupabaseClient,
  viewName: string,
  code: string,
  fields = WIKI_COLLECTION_SELECT_FIELDS
) {
  return supabase
    .from(viewName)
    .select(fields)
    .eq("code", code)
    .eq("is_published", true)
    .maybeSingle();
}

async function fetchPublishedWikiCollectionPaths(supabase: SupabaseClient, tableName: string) {
  return supabase
    .from(tableName)
    .select("wiki_slug, collection_slug")
    .eq("is_published", true)
    .not("published_dataset_id", "is", null)
    .not("wiki_slug", "is", null)
    .not("collection_slug", "is", null);
}

function buildWikiCollectionListQuery(
  supabase: SupabaseClient,
  viewName: string,
  fields = WIKI_COLLECTION_LIST_FIELDS
) {
  return supabase
    .from(viewName)
    .select(fields)
    .eq("is_published", true)
    .not("published_dataset_id", "is", null);
}

function buildLegacyWikiCollectionListQuery(supabase: SupabaseClient, viewName: string) {
  return supabase
    .from(viewName)
    .select(WIKI_COLLECTION_LIST_FIELDS_LEGACY)
    .eq("is_published", true);
}

export function buildWikiCollectionPath(wikiSlug: string, collectionSlug: string): string {
  return `/wiki/${normalizeSlug(wikiSlug)}/${normalizeSlug(collectionSlug)}`;
}

export async function getWikiCollectionPageByPath(
  wikiSlug: string,
  collectionSlug: string
): Promise<WikiCollectionPageContent | null> {
  const normalizedWikiSlug = normalizeSlug(wikiSlug);
  const normalizedCollectionSlug = normalizeSlug(collectionSlug);
  if (!normalizedWikiSlug || !normalizedCollectionSlug) return null;

  const fetchPage = async () => {
    const supabase = supabaseAdmin();
    let { data, error } = await fetchWikiCollectionPageByPath(
      supabase,
      WIKI_COLLECTION_PAGE_VIEW,
      normalizedWikiSlug,
      normalizedCollectionSlug
    );

    if (isMissingPublishedDatasetColumnError(error) || isMissingPageTypeColumnError(error)) {
      const compatible = await fetchWikiCollectionPageByPath(
        supabase,
        WIKI_COLLECTION_PAGE_VIEW,
        normalizedWikiSlug,
        normalizedCollectionSlug,
        WIKI_COLLECTION_SELECT_FIELDS_COMPAT
      );
      data = compatible.data;
      error = compatible.error;
    }

    if (isMissingRelationError(error)) {
      const fallback = await fetchWikiCollectionPageByPath(
        supabase,
        LEGACY_WIKI_COLLECTION_PAGE_VIEW,
        normalizedWikiSlug,
        normalizedCollectionSlug,
        WIKI_COLLECTION_SELECT_FIELDS_LEGACY
      );
      data = fallback.data;
      error = fallback.error;
    }

    if (error) {
      console.error("Error fetching wiki collection page", error);
      return null;
    }

    return normalizePage(data);
  };

  if (BYPASS_WIKI_COLLECTION_CACHE) return fetchPage();

  const cached = publicContentCache(
    fetchPage,
    ["wiki-collection-page-by-path-v1", normalizedWikiSlug, normalizedCollectionSlug],
    {
      revalidate: WIKI_COLLECTION_REVALIDATE_SECONDS,
      tags: buildWikiCollectionTags(normalizedWikiSlug, normalizedCollectionSlug)
    }
  );

  return cached();
}

export async function getWikiCollectionPageByCode(code: string): Promise<WikiCollectionPageContent | null> {
  const normalizedCode = normalizeCode(code);
  if (!normalizedCode) return null;

  const fetchPage = async () => {
    const supabase = supabaseAdmin();
    let { data, error } = await fetchWikiCollectionPageByCode(supabase, WIKI_COLLECTION_PAGE_VIEW, normalizedCode);

    if (isMissingPublishedDatasetColumnError(error) || isMissingPageTypeColumnError(error)) {
      const compatible = await fetchWikiCollectionPageByCode(
        supabase,
        WIKI_COLLECTION_PAGE_VIEW,
        normalizedCode,
        WIKI_COLLECTION_SELECT_FIELDS_COMPAT
      );
      data = compatible.data;
      error = compatible.error;
    }

    if (isMissingRelationError(error)) {
      const fallback = await fetchWikiCollectionPageByCode(
        supabase,
        LEGACY_WIKI_COLLECTION_PAGE_VIEW,
        normalizedCode,
        WIKI_COLLECTION_SELECT_FIELDS_LEGACY
      );
      data = fallback.data;
      error = fallback.error;
    }

    if (error) {
      console.error("Error fetching wiki collection page by code", error);
      return null;
    }

    return normalizePage(data);
  };

  if (BYPASS_WIKI_COLLECTION_CACHE) return fetchPage();

  const cached = publicContentCache(
    fetchPage,
    ["wiki-collection-page-by-code-v1", normalizedCode],
    {
      revalidate: WIKI_COLLECTION_REVALIDATE_SECONDS,
      tags: ["wiki-collection-index", `wiki-collection-code:${normalizedCode}`]
    }
  );

  return cached();
}

export async function listPublishedWikiCollectionPaths(): Promise<Array<{ wiki_slug: string; collection_slug: string }>> {
  const fetchPaths = async () => {
    const supabase = supabaseAdmin();
    const { data, error } = await fetchPublishedWikiCollectionPaths(supabase, WIKI_COLLECTION_PAGE_TABLE);

    if (error) throw error;
    return (data ?? []) as Array<{ wiki_slug: string; collection_slug: string }>;
  };

  if (BYPASS_WIKI_COLLECTION_CACHE) return fetchPaths();

  const cached = publicContentCache(
    fetchPaths,
    ["wiki-collection-paths-v1"],
    {
      revalidate: WIKI_COLLECTION_REVALIDATE_SECONDS,
      tags: ["wiki-collection-index"]
    }
  );

  return cached();
}

export async function listPublishedWikiCollectionPagesByUniverseId(
  universeId: number,
  limit?: number | null
): Promise<WikiCollectionListEntry[]> {
  const safeLimit = typeof limit === "number" && Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : null;
  const supabase = supabaseAdmin();
  let query = buildWikiCollectionListQuery(supabase, WIKI_COLLECTION_PAGE_VIEW)
    .eq("universe_id", universeId)
    .order("wiki_sort_order", { ascending: true, nullsFirst: false })
    .order("title", { ascending: true });

  if (safeLimit) query = query.limit(safeLimit);

  let { data, error } = await query;
  if (isMissingPublishedDatasetColumnError(error) || isMissingPageTypeColumnError(error)) {
    let compatibleQuery = buildWikiCollectionListQuery(supabase, WIKI_COLLECTION_PAGE_VIEW, WIKI_COLLECTION_LIST_FIELDS_COMPAT)
      .eq("universe_id", universeId)
      .order("wiki_sort_order", { ascending: true, nullsFirst: false })
      .order("title", { ascending: true });
    if (safeLimit) compatibleQuery = compatibleQuery.limit(safeLimit);
    const compatible = await compatibleQuery;
    data = compatible.data;
    error = compatible.error;
  }
  if (isMissingRelationError(error)) {
    let fallbackQuery = buildLegacyWikiCollectionListQuery(supabase, LEGACY_WIKI_COLLECTION_PAGE_VIEW)
      .eq("universe_id", universeId)
      .order("wiki_sort_order", { ascending: true, nullsFirst: false })
      .order("title", { ascending: true });
    if (safeLimit) fallbackQuery = fallbackQuery.limit(safeLimit);
    const fallback = await fallbackQuery;
    data = fallback.data as typeof data;
    error = fallback.error;
  }

  if (error) {
    console.error("Error fetching wiki collection pages by universe", error);
    return [];
  }

  return normalizeList(data);
}

export async function listPublishedWikiCollectionPages(): Promise<WikiCollectionListEntry[]> {
  const fetchPages = async () => {
    let { data, error } = await buildWikiCollectionListQuery(supabaseAdmin(), WIKI_COLLECTION_PAGE_VIEW)
      .order("wiki_slug", { ascending: true })
      .order("wiki_sort_order", { ascending: true, nullsFirst: false })
      .order("title", { ascending: true });
    if (isMissingPublishedDatasetColumnError(error) || isMissingPageTypeColumnError(error)) {
      const compatible = await buildWikiCollectionListQuery(supabaseAdmin(), WIKI_COLLECTION_PAGE_VIEW, WIKI_COLLECTION_LIST_FIELDS_COMPAT)
        .order("wiki_slug", { ascending: true })
        .order("wiki_sort_order", { ascending: true, nullsFirst: false })
        .order("title", { ascending: true });
      data = compatible.data;
      error = compatible.error;
    }
    if (isMissingRelationError(error)) {
      const fallback = await buildLegacyWikiCollectionListQuery(supabaseAdmin(), LEGACY_WIKI_COLLECTION_PAGE_VIEW)
        .order("wiki_slug", { ascending: true })
        .order("wiki_sort_order", { ascending: true, nullsFirst: false })
        .order("title", { ascending: true });
      data = fallback.data as typeof data;
      error = fallback.error;
    }
    if (error) throw error;
    return normalizeList(data);
  };

  if (BYPASS_WIKI_COLLECTION_CACHE) return fetchPages();

  const cached = publicContentCache(fetchPages, ["published-wiki-collection-pages-v1"], {
    revalidate: WIKI_COLLECTION_REVALIDATE_SECONDS,
    tags: ["wiki-collection-index"]
  });
  return cached();
}

export async function listPublishedWikiCollectionPagesByWikiSlug(
  wikiSlug: string,
  limit?: number | null
): Promise<WikiCollectionListEntry[]> {
  const normalizedWikiSlug = normalizeSlug(wikiSlug);
  if (!normalizedWikiSlug) return [];

  const safeLimit = typeof limit === "number" && Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : null;
  const supabase = supabaseAdmin();
  let query = buildWikiCollectionListQuery(supabase, WIKI_COLLECTION_PAGE_VIEW)
    .eq("wiki_slug", normalizedWikiSlug)
    .order("wiki_sort_order", { ascending: true, nullsFirst: false })
    .order("title", { ascending: true });

  if (safeLimit) query = query.limit(safeLimit);

  let { data, error } = await query;
  if (isMissingPublishedDatasetColumnError(error) || isMissingPageTypeColumnError(error)) {
    let compatibleQuery = buildWikiCollectionListQuery(supabase, WIKI_COLLECTION_PAGE_VIEW, WIKI_COLLECTION_LIST_FIELDS_COMPAT)
      .eq("wiki_slug", normalizedWikiSlug)
      .order("wiki_sort_order", { ascending: true, nullsFirst: false })
      .order("title", { ascending: true });
    if (safeLimit) compatibleQuery = compatibleQuery.limit(safeLimit);
    const compatible = await compatibleQuery;
    data = compatible.data;
    error = compatible.error;
  }
  if (isMissingRelationError(error)) {
    let fallbackQuery = buildLegacyWikiCollectionListQuery(supabase, LEGACY_WIKI_COLLECTION_PAGE_VIEW)
      .eq("wiki_slug", normalizedWikiSlug)
      .order("wiki_sort_order", { ascending: true, nullsFirst: false })
      .order("title", { ascending: true });
    if (safeLimit) fallbackQuery = fallbackQuery.limit(safeLimit);
    const fallback = await fallbackQuery;
    data = fallback.data as typeof data;
    error = fallback.error;
  }

  if (error) {
    console.error("Error fetching wiki collection pages by wiki slug", error);
    return [];
  }

  return normalizeList(data);
}

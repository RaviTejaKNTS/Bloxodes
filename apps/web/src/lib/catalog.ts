import { publicContentCache } from "@/lib/public-content-cache";
import { supabaseAdmin } from "@/lib/supabase";

export type CatalogFaqEntry = { q: string; a: string };

export type CatalogPageContent = {
  id?: string;
  universe_id?: number | null;
  code: string;
  title: string;
  seo_title: string;
  meta_description: string;
  intro_md: string | null;
  how_it_works_md: string | null;
  description_md?: string | null;
  description_json: Record<string, string>;
  faq_json: CatalogFaqEntry[];
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

export type CatalogListEntry = Pick<
  CatalogPageContent,
  | "id"
  | "code"
  | "title"
  | "meta_description"
  | "thumb_url"
  | "wiki_md"
  | "wiki_sort_order"
  | "universe_id"
  | "published_at"
  | "created_at"
  | "updated_at"
  | "content_updated_at"
>;

export type CatalogIndexEntry = Pick<
  CatalogPageContent,
  | "id"
  | "code"
  | "title"
  | "meta_description"
  | "intro_md"
  | "thumb_url"
  | "universe_id"
  | "published_at"
  | "created_at"
  | "updated_at"
  | "content_updated_at"
> & {
  universe_name?: string | null;
};

const CATALOG_SELECT_FIELDS_VIEW =
  "id, universe_id, code, title, seo_title, meta_description, intro_md, how_it_works_md, description_md, description_json, faq_json, schema_ld_json, thumb_url, wiki_md, wiki_sort_order, is_published, published_at, created_at, updated_at, content_updated_at";
const CATALOG_SELECT_FIELDS_BASE =
  "id, universe_id, code, title, seo_title, meta_description, intro_md, how_it_works_md, description_md, description_json, faq_json, schema_ld_json, thumb_url, wiki_md, wiki_sort_order, is_published, published_at, created_at, updated_at";
const CATALOG_REVALIDATE_SECONDS = 86400;

function normalizeCatalogCodes(codes: string[]): string[] {
  return Array.from(
    new Set(
      codes
        .map((code) => code.trim())
        .filter(Boolean)
    )
  );
}

function buildCatalogTags(codes: string[]): string[] {
  const normalized = Array.from(new Set(codes.map((code) => code.toLowerCase())));
  return ["catalog-index", ...normalized.map((code) => `catalog:${code}`)];
}

function getCatalogIndexEntryTimestamp(entry: CatalogIndexEntry): number {
  const candidate = entry.content_updated_at ?? entry.updated_at ?? entry.published_at ?? entry.created_at ?? null;
  if (!candidate) return 0;
  const timestamp = Date.parse(candidate);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function sortCatalogIndexEntries(entries: CatalogIndexEntry[]): CatalogIndexEntry[] {
  return [...entries].sort((a, b) => {
    const timestampDelta = getCatalogIndexEntryTimestamp(b) - getCatalogIndexEntryTimestamp(a);
    if (timestampDelta !== 0) return timestampDelta;
    return (a.id ?? a.code).localeCompare(b.id ?? b.code);
  });
}

function pickFirstByCodeOrder<T extends { code: string }>(rows: T[], codes: string[]): T | null {
  for (const code of codes) {
    const match = rows.find((row) => row.code === code);
    if (match) return match;
  }
  return rows[0] ?? null;
}

async function fetchCatalogContent(
  codes: string[],
  options?: { includeUnpublished?: boolean }
): Promise<CatalogPageContent | null> {
  if (!codes.length) return null;
  const includeUnpublished = options?.includeUnpublished === true;
  const supabase = supabaseAdmin();
  let viewQuery = supabase
    .from("catalog_pages_view")
    .select(CATALOG_SELECT_FIELDS_VIEW)
    .in("code", codes);

  if (!includeUnpublished) {
    viewQuery = viewQuery.eq("is_published", true);
  }

  const { data, error } = await viewQuery;

  if (!error && data?.length) {
    return pickFirstByCodeOrder(data as CatalogPageContent[], codes);
  }

  let fallbackQuery = supabase
    .from("catalog_pages")
    .select(CATALOG_SELECT_FIELDS_BASE)
    .in("code", codes);

  if (!includeUnpublished) {
    fallbackQuery = fallbackQuery.eq("is_published", true);
  }

  const { data: fallback, error: fallbackError } = await fallbackQuery;

  if (fallbackError) {
    console.error("Error fetching catalog page content", fallbackError);
    return null;
  }

  if (!fallback?.length) return null;
  return pickFirstByCodeOrder(fallback as CatalogPageContent[], codes);
}

export async function getCatalogPageContentByCodes(codes: string[]): Promise<CatalogPageContent | null> {
  const normalizedCodes = normalizeCatalogCodes(codes);
  if (!normalizedCodes.length) return null;

  const cachedCatalogContent = publicContentCache(
    async (requestedCodes: string[]) => fetchCatalogContent(requestedCodes),
    ["catalog-page-content-v6", ...normalizedCodes],
    {
      revalidate: CATALOG_REVALIDATE_SECONDS,
      tags: buildCatalogTags(normalizedCodes)
    }
  );

  return cachedCatalogContent(normalizedCodes);
}

export async function getCatalogPageContentByCodesIncludingDrafts(
  codes: string[]
): Promise<CatalogPageContent | null> {
  const normalizedCodes = normalizeCatalogCodes(codes);
  if (!normalizedCodes.length) return null;

  const cachedCatalogContent = publicContentCache(
    async (requestedCodes: string[]) => fetchCatalogContent(requestedCodes, { includeUnpublished: true }),
    ["catalog-page-content-drafts-v4", ...normalizedCodes],
    {
      revalidate: CATALOG_REVALIDATE_SECONDS,
      tags: buildCatalogTags(normalizedCodes)
    }
  );

  return cachedCatalogContent(normalizedCodes);
}

export async function listPublishedCatalogCodes(): Promise<string[]> {
  const cached = publicContentCache(
    async () => {
      const supabase = supabaseAdmin();
      const { data, error } = await supabase
        .from("catalog_pages")
        .select("code")
        .eq("is_published", true)
        .not("code", "is", null);

      if (error) throw error;
      return (data ?? [])
        .map((row) => (row as { code: string | null }).code)
        .filter((code): code is string => typeof code === "string" && code.length > 0);
    },
    ["listPublishedCatalogCodes"],
    {
      revalidate: CATALOG_REVALIDATE_SECONDS,
      tags: ["catalog-index"]
    }
  );

  return cached();
}

export async function listPublishedTopLevelCatalogPages(): Promise<CatalogIndexEntry[]> {
  const cached = publicContentCache(
    async () => {
      const supabase = supabaseAdmin();
      async function attachUniverseNames(rows: CatalogIndexEntry[]): Promise<CatalogIndexEntry[]> {
        const universeIds = Array.from(
          new Set(
            rows
              .map((row) => row.universe_id)
              .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
          )
        );

        if (!universeIds.length) {
          return rows;
        }

        const { data: universes, error: universeError } = await supabase
          .from("roblox_universes")
          .select("universe_id, display_name, name")
          .in("universe_id", universeIds);

        if (universeError) {
          console.error("Error fetching catalog universe names", universeError);
          return rows;
        }

        const universeNameById = new Map<number, string | null>();
        for (const row of universes ?? []) {
          const universeId = (row as { universe_id?: number | null }).universe_id;
          if (typeof universeId !== "number") continue;
          const displayName = (row as { display_name?: string | null }).display_name?.trim() ?? null;
          const name = (row as { name?: string | null }).name?.trim() ?? null;
          universeNameById.set(universeId, displayName || name || null);
        }

        return rows.map((row) => ({
          ...row,
          universe_name: typeof row.universe_id === "number" ? (universeNameById.get(row.universe_id) ?? null) : null
        }));
      }

      const { data, error } = await supabase
        .from("catalog_pages_view")
        .select("id, code, title, meta_description, intro_md, thumb_url, universe_id, published_at, created_at, updated_at, content_updated_at")
        .eq("is_published", true)
        .order("content_updated_at", { ascending: false })
        .order("id", { ascending: true });

      if (!error && data) {
        const rows = sortCatalogIndexEntries(
          ((data ?? [])
            .filter((row) => {
              const code = (row as { code?: string | null }).code;
              return typeof code === "string" && code.length > 0 && !code.includes("/");
            }) as CatalogIndexEntry[])
        );
        return attachUniverseNames(rows);
      }

      const { data: fallback, error: fallbackError } = await supabase
        .from("catalog_pages")
        .select("id, code, title, meta_description, intro_md, thumb_url, universe_id, published_at, created_at, updated_at")
        .eq("is_published", true)
        .order("updated_at", { ascending: false })
        .order("id", { ascending: true });

      if (fallbackError) {
        console.error("Error fetching top-level catalog pages", fallbackError);
        return [];
      }

      const rows = sortCatalogIndexEntries(
        ((fallback ?? [])
          .filter((row) => {
            const code = (row as { code?: string | null }).code;
            return typeof code === "string" && code.length > 0 && !code.includes("/");
          }) as CatalogIndexEntry[])
      );
      return attachUniverseNames(rows);
    },
    ["listPublishedTopLevelCatalogPages"],
    {
      revalidate: CATALOG_REVALIDATE_SECONDS,
      tags: ["catalog-index"]
    }
  );

  return cached();
}

export async function listPublishedCatalogPagesByUniverseId(
  universeId: number,
  limit?: number | null
): Promise<CatalogListEntry[]> {
  const safeLimit = typeof limit === "number" && Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : null;
  const supabase = supabaseAdmin();

  let viewQuery = supabase
    .from("catalog_pages_view")
    .select("id, code, title, meta_description, thumb_url, wiki_md, wiki_sort_order, universe_id, published_at, created_at, updated_at, content_updated_at")
    .eq("is_published", true)
    .eq("universe_id", universeId)
    .order("wiki_sort_order", { ascending: true, nullsFirst: false })
    .order("title", { ascending: true });

  if (safeLimit) {
    viewQuery = viewQuery.limit(safeLimit);
  }

  const { data, error } = await viewQuery;

  if (!error && data) {
    return (data ?? []) as CatalogListEntry[];
  }

  let fallbackQuery = supabase
    .from("catalog_pages")
    .select("id, code, title, meta_description, thumb_url, wiki_md, wiki_sort_order, universe_id, published_at, created_at, updated_at")
    .eq("is_published", true)
    .eq("universe_id", universeId)
    .order("wiki_sort_order", { ascending: true, nullsFirst: false })
    .order("title", { ascending: true });

  if (safeLimit) {
    fallbackQuery = fallbackQuery.limit(safeLimit);
  }

  const { data: fallback, error: fallbackError } = await fallbackQuery;

  if (fallbackError) {
    console.error("Error fetching catalog pages by universe", fallbackError);
    return [];
  }

  return (fallback ?? []) as CatalogListEntry[];
}

export async function listPublishedCatalogPagesByCodePrefix(
  codePrefix: string,
  limit?: number | null
): Promise<CatalogListEntry[]> {
  const normalizedPrefix = codePrefix.trim().toLowerCase().replace(/-+$/g, "");
  if (!normalizedPrefix) return [];

  const safeLimit = typeof limit === "number" && Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : null;
  const supabase = supabaseAdmin();
  const likePattern = `${normalizedPrefix}-%`;

  let viewQuery = supabase
    .from("catalog_pages_view")
    .select("id, code, title, meta_description, thumb_url, wiki_md, wiki_sort_order, universe_id, published_at, created_at, updated_at, content_updated_at")
    .eq("is_published", true)
    .like("code", likePattern)
    .order("wiki_sort_order", { ascending: true, nullsFirst: false })
    .order("title", { ascending: true });

  if (safeLimit) {
    viewQuery = viewQuery.limit(safeLimit);
  }

  const { data, error } = await viewQuery;

  if (!error && data) {
    return (data ?? []) as CatalogListEntry[];
  }

  let fallbackQuery = supabase
    .from("catalog_pages")
    .select("id, code, title, meta_description, thumb_url, wiki_md, wiki_sort_order, universe_id, published_at, created_at, updated_at")
    .eq("is_published", true)
    .like("code", likePattern)
    .order("wiki_sort_order", { ascending: true, nullsFirst: false })
    .order("title", { ascending: true });

  if (safeLimit) {
    fallbackQuery = fallbackQuery.limit(safeLimit);
  }

  const { data: fallback, error: fallbackError } = await fallbackQuery;

  if (fallbackError) {
    console.error("Error fetching catalog pages by code prefix", fallbackError);
    return [];
  }

  return (fallback ?? []) as CatalogListEntry[];
}

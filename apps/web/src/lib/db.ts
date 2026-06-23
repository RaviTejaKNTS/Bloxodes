import { publicContentCache } from "@/lib/public-content-cache";
import { ROBLOX_ARTICLE_GAME_SLUG, articleGameSlugFromUniverse } from "@/lib/slug";
import { supabaseAdmin } from "@/lib/supabase";

export type Author = {
  id: string;
  name: string;
  slug: string;
  gravatar_email: string | null;
  avatar_url: string | null;
  bio_md: string | null;
  twitter: string | null;
  youtube: string | null;
  website: string | null;
  facebook: string | null;
  linkedin: string | null;
  instagram: string | null;
  roblox: string | null;
  discord: string | null;
  created_at: string;
  updated_at: string;
};

export type CodePage = {
  id: string;
  name: string;
  slug: string;
  source_url: string | null;
  source_url_2: string | null;
  source_url_3: string | null;
  source_url_4: string | null;
  source_url_5: string | null;
  source_url_6: string | null;
  source_url_7: string | null;
  source_url_8: string | null;
  source_url_9: string | null;
  source_url_10: string | null;
  roblox_link?: string | null;
  community_link?: string | null;
  discord_link?: string | null;
  twitter_link?: string | null;
  youtube_link?: string | null;
  expired_codes: string[] | null;
  cover_image: string | null;
  seo_title: string | null;
  seo_description: string | null;
  intro_md: string | null;
  redeem_md: string | null;
  find_codes_md: string | null;
  troubleshoot_md: string | null;
  rewards_md: string | null;
  universe_id: number | null;
  interlinking_ai_copy_md: string | null;
  is_published: boolean;
  published_at: string | null;
  re_rewritten_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type RobloxUniverseInfo = {
  universe_id: number;
  name: string | null;
  display_name: string | null;
  creator_name: string | null;
  creator_id: number | null;
  creator_type: string | null;
  social_links: Record<string, unknown> | null;
  created_at_api?: string | null;
};

export type Article = {
  id: string;
  title: string;
  seo_title?: string | null;
  slug: string;
  content_md: string;
  cover_image: string | null;
  author_id: string | null;
  universe_id: number | null;
  is_published: boolean;
  published_at: string;
  created_at: string;
  updated_at: string;
  word_count: number | null;
  meta_description: string | null;
  sources: string[];
  tags: string[];
  faq_json: ArticleFaqEntry[];
};

export type ArticleFaqEntry = {
  q: string;
  a: string;
};

export type UniverseSummary = {
  universe_id: number;
  slug: string | null;
  display_name: string | null;
  name: string | null;
  icon_url?: string | null;
  genre_l1?: string | null;
  genre_l2?: string | null;
};

export type ArticleWithRelations = Article & {
  author: Author | null;
  universe: UniverseSummary | null;
};

export type ArticleGameSummary = {
  slug: string;
  title: string;
  universeId: number | null;
  articleCount: number;
  latestUpdatedAt: string | null;
  iconUrl: string | null;
  universe: UniverseSummary | null;
};

function normalizePositivePage(page: number): number {
  if (!Number.isFinite(page) || page < 1) return 1;
  const floored = Math.floor(page);
  return Number.isSafeInteger(floored) ? floored : 1;
}

function isOutOfRangePaginationError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const candidate = error as {
    code?: unknown;
    status?: unknown;
    message?: unknown;
    details?: unknown;
    hint?: unknown;
  };
  const code = typeof candidate.code === "string" ? candidate.code : "";
  if (code === "PGRST103") return true;

  const status =
    typeof candidate.status === "number"
      ? candidate.status
      : typeof candidate.status === "string"
      ? Number(candidate.status)
      : Number.NaN;
  if (status === 416) return true;

  const message = [candidate.message, candidate.details, candidate.hint]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();
  return message.includes("range not satisfiable") || (message.includes("invalid") && message.includes("range"));
}

function isOutOfRangePaginationFailure(status: unknown, error: unknown): boolean {
  if (status === 416 || status === "416") return true;
  return isOutOfRangePaginationError(error);
}

function latestTimestamp(left: string | null, right: string | null): string | null {
  if (!left) return right;
  if (!right) return left;
  return new Date(right).getTime() > new Date(left).getTime() ? right : left;
}

const ARTICLE_INDEX_FIELDS =
  `id,title,slug,cover_image,meta_description,published_at,created_at,updated_at,is_published,` +
  `universe_id,author_id,` +
  `author:authors(id,name,slug,avatar_url,gravatar_email),` +
  `universe:roblox_universes(universe_id,slug,display_name,name,icon_url)`;
const ARTICLE_DETAIL_FIELDS =
  `*, author:authors(id,name,slug,avatar_url,gravatar_email,bio_md,twitter,youtube,website,facebook,linkedin,instagram,roblox,discord,created_at,updated_at), universe:roblox_universes(universe_id,slug,display_name,name,icon_url,genre_l1,genre_l2)`;
const BYPASS_ARTICLE_CACHE = process.env.NODE_ENV === "development";

export type ChecklistPage = {
  id: string;
  universe_id: number;
  slug: string;
  title: string;
  description_md: string | null;
  seo_title: string | null;
  seo_description: string | null;
  published_at: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  item_count?: number;
  content_updated_at?: string | null;
  universe?: UniverseSummary | null;
};

export type ChecklistItem = {
  id: string;
  page_id: string;
  section_code: string;
  title: string;
  description: string | null;
  is_required: boolean;
  created_at: string;
  updated_at: string;
};

function compareChecklistSectionCodes(a: string, b: string): number {
  const aParts = a
    .split(".")
    .map((part) => Number.parseInt(part, 10))
    .filter((part) => Number.isFinite(part));
  const bParts = b
    .split(".")
    .map((part) => Number.parseInt(part, 10))
    .filter((part) => Number.isFinite(part));
  const maxLength = Math.max(aParts.length, bParts.length);

  for (let index = 0; index < maxLength; index += 1) {
    const aPart = aParts[index] ?? -1;
    const bPart = bParts[index] ?? -1;
    if (aPart !== bPart) return aPart - bPart;
  }

  return a.localeCompare(b);
}

function sortChecklistItems(items: ChecklistItem[]): ChecklistItem[] {
  return [...items].sort((a, b) => {
    const sectionComparison = compareChecklistSectionCodes(a.section_code, b.section_code);
    if (sectionComparison !== 0) return sectionComparison;
    return a.title.localeCompare(b.title);
  });
}

export type Code = {
  id: string;
  code_page_id: string;
  code: string;
  status: "active"|"expired"|"check";
  rewards_text: string | null;
  level_requirement: number | null;
  is_new: boolean | null;
  posted_online: boolean;
  first_seen_at: string;
  last_seen_at: string;
};

export async function listPublishedCodePages(): Promise<CodePage[]> {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("code_pages")
    .select("*")
    .eq("is_published", true)
    .order("name", { ascending: true });
  if (error) throw error;
  return data as CodePage[];
}

export async function listAuthors(): Promise<Author[]> {
  const cached = publicContentCache(
    async () => {
      const sb = supabaseAdmin();
      const { data, error } = await sb
        .from("authors")
        .select("id, name, slug, avatar_url, gravatar_email, bio_md, twitter, youtube, website, facebook, linkedin, instagram, roblox, discord, created_at, updated_at")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Author[];
    },
    ["listAuthors"],
    {
      revalidate: 2592000, // 30 days
      tags: ["authors-index"]
    }
  );

  return cached();
}

export async function listAuthorSlugs(): Promise<string[]> {
  const cached = publicContentCache(
    async () => {
      const sb = supabaseAdmin();
      const { data, error } = await sb
        .from("authors")
        .select("slug")
        .not("slug", "is", null);
      if (error) throw error;
      return (data ?? [])
        .map((row) => (row as { slug: string | null }).slug)
        .filter((slug): slug is string => typeof slug === "string" && slug.length > 0);
    },
    ["listAuthorSlugs"],
    {
      revalidate: 2592000, // 30 days
      tags: ["authors-index"]
    }
  );

  return cached();
}

function articleSelectFields() {
  return `*, author:authors(id,name,slug,avatar_url,gravatar_email,bio_md,twitter,youtube,website,facebook,linkedin,instagram,roblox,discord,created_at,updated_at), universe:roblox_universes(universe_id,slug,display_name,name)`;
}

export async function getAuthorBySlug(slug: string): Promise<Author | null> {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("authors")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return (data as Author) || null;
}

type CodePageSummaryFields = Pick<CodePage, "id" | "name" | "slug" | "cover_image" | "created_at" | "updated_at" | "universe_id">;

export type CodePageWithCounts = CodePageSummaryFields & {
  active_count: number;
  latest_code_first_seen_at: string | null;
  content_updated_at: string | null;
  genre_l1?: string | null;
  genre_l2?: string | null;
};


export async function listAllCodePages(): Promise<CodePage[]> {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("code_pages")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw error;
  return data as CodePage[];
}

type CodePageSummary = CodePageSummaryFields & {
  active_code_count?: number | null;
  latest_code_first_seen_at?: string | null;
  content_updated_at?: string | null;
  genre_l1?: string | null;
  genre_l2?: string | null;
  universe?: { genre_l1?: string | null; genre_l2?: string | null } | null;
};

function mapCodePageRowToCounts(row: CodePageSummary): CodePageWithCounts {
  return {
    ...row,
    active_count: row.active_code_count ?? 0,
    latest_code_first_seen_at: row.latest_code_first_seen_at ?? null,
    content_updated_at: row.content_updated_at ?? row.updated_at ?? null,
    genre_l1: row.genre_l1 ?? row.universe?.genre_l1 ?? null,
    genre_l2: row.genre_l2 ?? row.universe?.genre_l2 ?? null
  };
}

async function fetchCodePagesWithActiveCounts(): Promise<CodePageWithCounts[]> {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("code_pages_index_view")
    .select("id,name,slug,cover_image,created_at,updated_at,universe_id,genre_l1,genre_l2,active_code_count,latest_code_first_seen_at,content_updated_at")
    .eq("is_published", true)
    .order("content_updated_at", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((row) => mapCodePageRowToCounts(row as CodePageSummary));
}

const cachedListCodePagesWithActiveCounts = publicContentCache(
  fetchCodePagesWithActiveCounts,
  ["listCodePagesWithActiveCounts"],
  {
    revalidate: 21600, // 6 hours
    tags: ["codes-index", "home"]
  }
);

export async function listCodePagesWithActiveCounts(): Promise<CodePageWithCounts[]> {
  return cachedListCodePagesWithActiveCounts();
}

export async function listPublishedCodeSlugs(): Promise<string[]> {
  const cached = publicContentCache(
    async () => {
      const sb = supabaseAdmin();
      const { data, error } = await sb
        .from("code_pages_index_view")
        .select("slug")
        .eq("is_published", true)
        .not("slug", "is", null)
        .order("content_updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? [])
        .map((row) => (row as { slug: string | null }).slug)
        .filter((slug): slug is string => typeof slug === "string" && slug.length > 0);
    },
    ["listPublishedCodeSlugs"],
    {
      revalidate: 21600, // 6 hours
      tags: ["codes-index", "home"]
    }
  );

  return cached();
}

export async function listCodePagesWithActiveCountsPage(page: number, pageSize: number): Promise<{ games: CodePageWithCounts[]; total: number }> {
  const safePage = normalizePositivePage(page);
  const safePageSize = Math.max(1, pageSize);
  const offset = (safePage - 1) * safePageSize;

  const cached = publicContentCache(
    async () => {
      const sb = supabaseAdmin();
      try {
        const { data, count, error, status } = await sb
          .from("code_pages_index_view")
          .select(
            "id,name,slug,cover_image,created_at,updated_at,universe_id,genre_l1,genre_l2,active_code_count,latest_code_first_seen_at,content_updated_at",
            { count: "exact" }
          )
          .eq("is_published", true)
          .order("content_updated_at", { ascending: false })
          .order("id", { ascending: true })
          .range(offset, offset + safePageSize - 1);

        if (error) {
          if (!isOutOfRangePaginationFailure(status, error)) throw error;
          const { count, error: countError } = await sb
            .from("code_pages_index_view")
            .select("id", { count: "exact", head: true })
            .eq("is_published", true);
          if (countError) throw countError;
          return { games: [], total: count ?? 0 };
        }
        const games = (data ?? []).map((row) => mapCodePageRowToCounts(row as CodePageSummary));
        return { games, total: count ?? games.length };
      } catch (error) {
        if (!isOutOfRangePaginationError(error)) throw error;
        const { count, error: countError } = await sb
          .from("code_pages_index_view")
          .select("id", { count: "exact", head: true })
          .eq("is_published", true);
        if (countError) throw countError;
        return { games: [], total: count ?? 0 };
      }
    },
    [`listCodePagesWithActiveCountsPage:${safePage}:${safePageSize}`],
    {
      revalidate: 21600, // 6 hours
      tags: ["codes-index", "home"]
    }
  );

  return cached();
}

export async function listCodePagesWithActiveCountsForIds(codePageIds: string[]): Promise<CodePageWithCounts[]> {
  if (!codePageIds.length) {
    return [];
  }

  const uniqueIds = Array.from(new Set(codePageIds));
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("code_pages_index_view")
    .select("id,name,slug,cover_image,created_at,updated_at,universe_id,genre_l1,genre_l2,active_code_count,latest_code_first_seen_at,content_updated_at")
    .eq("is_published", true)
    .in("id", uniqueIds);
  if (error) throw error;

  const codePageList = (data ?? []) as CodePageSummary[];
  if (!codePageList.length) {
    return [];
  }

  const withCounts = codePageList.map((row) => mapCodePageRowToCounts(row));
  const map = new Map(withCounts.map((codePage) => [codePage.id, codePage]));

  return codePageIds.map((id) => map.get(id)).filter((codePage): codePage is CodePageWithCounts => Boolean(codePage));
}

export async function listCodePagesWithActiveCountsByUniverseId(universeId: number, limit = 1): Promise<CodePageWithCounts[]> {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("code_pages_index_view")
    .select(
      "id,name,slug,cover_image,created_at,updated_at,universe_id,genre_l1,genre_l2,active_code_count,latest_code_first_seen_at,content_updated_at"
    )
    .eq("is_published", true)
    .eq("universe_id", universeId)
    .order("content_updated_at", { ascending: false })
    .order("id", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row) => mapCodePageRowToCounts(row as CodePageSummary));
}

function mapArticleIndexRows(rows: unknown[] | null | undefined): ArticleWithRelations[] {
  return ((rows ?? []) as Array<Record<string, unknown>>).map((row) => ({
    ...row,
    content_md: "",
    tags: [],
    sources: [],
    faq_json: [],
    word_count: null,
    author: (row as any).author ?? null,
    universe: (row as any).universe ?? null
  })) as unknown as ArticleWithRelations[];
}

async function fetchPublishedArticles(limit: number, offset: number): Promise<ArticleWithRelations[]> {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("articles")
    .select(ARTICLE_INDEX_FIELDS)
    .eq("is_published", true)
    .order("published_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return mapArticleIndexRows(data);
}

async function fetchPublishedArticleSlugs(): Promise<string[]> {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("articles")
    .select("slug")
    .eq("is_published", true)
    .not("slug", "is", null)
    .order("published_at", { ascending: false });
  if (error) throw error;
  return (data ?? [])
    .map((row) => (row as { slug: string | null }).slug)
    .filter((slug): slug is string => typeof slug === "string" && slug.length > 0);
}

async function fetchPublishedArticlesPage(
  safePage: number,
  safePageSize: number
): Promise<{ articles: ArticleWithRelations[]; total: number }> {
  const offset = (safePage - 1) * safePageSize;
  const sb = supabaseAdmin();
  try {
    const { data, count, error, status } = await sb
      .from("articles")
      .select(ARTICLE_INDEX_FIELDS, { count: "exact" })
      .eq("is_published", true)
      .order("published_at", { ascending: false })
      .order("id", { ascending: true })
      .range(offset, offset + safePageSize - 1);

    if (error) {
      if (!isOutOfRangePaginationFailure(status, error)) throw error;
      const { count, error: countError } = await sb
        .from("articles")
        .select("id", { count: "exact", head: true })
        .eq("is_published", true);
      if (countError) throw countError;
      return { articles: [], total: count ?? 0 };
    }
    const articles = mapArticleIndexRows(data);
    return { articles, total: count ?? articles.length };
  } catch (error) {
    if (!isOutOfRangePaginationError(error)) throw error;
    const { count, error: countError } = await sb
      .from("articles")
      .select("id", { count: "exact", head: true })
      .eq("is_published", true);
    if (countError) throw countError;
    return { articles: [], total: count ?? 0 };
  }
}

async function fetchPublishedArticlesByUniverseId(
  universeId: number,
  limit: number,
  offset: number
): Promise<ArticleWithRelations[]> {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("articles")
    .select(ARTICLE_INDEX_FIELDS)
    .eq("is_published", true)
    .eq("universe_id", universeId)
    .order("published_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return mapArticleIndexRows(data);
}

async function fetchArticleGameSummaries(): Promise<ArticleGameSummary[]> {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("articles")
    .select(
      "id,universe_id,published_at,created_at,updated_at,universe:roblox_universes(universe_id,slug,display_name,name,icon_url)"
    )
    .eq("is_published", true)
    .order("published_at", { ascending: false })
    .limit(10000);

  if (error) throw error;

  const groups = new Map<string, ArticleGameSummary>();
  for (const row of (data ?? []) as unknown as Array<{
    universe_id: number | null;
    published_at: string | null;
    created_at: string | null;
    updated_at: string | null;
    universe?: UniverseSummary | UniverseSummary[] | null;
  }>) {
    const universe = Array.isArray(row.universe) ? row.universe[0] ?? null : row.universe ?? null;
    const slug = universe ? articleGameSlugFromUniverse(universe) : ROBLOX_ARTICLE_GAME_SLUG;
    const title = universe?.display_name ?? universe?.name ?? "Roblox";
    const existing = groups.get(slug);
    const latest = row.updated_at ?? row.published_at ?? row.created_at ?? null;

    if (existing) {
      existing.articleCount += 1;
      existing.latestUpdatedAt = latestTimestamp(existing.latestUpdatedAt, latest);
      continue;
    }

    groups.set(slug, {
      slug,
      title,
      universeId: row.universe_id ?? null,
      articleCount: 1,
      latestUpdatedAt: latest,
      iconUrl: universe?.icon_url ?? null,
      universe
    });
  }

  return Array.from(groups.values()).sort(
    (left, right) =>
      right.articleCount - left.articleCount ||
      (right.latestUpdatedAt ? new Date(right.latestUpdatedAt).getTime() : 0) -
        (left.latestUpdatedAt ? new Date(left.latestUpdatedAt).getTime() : 0) ||
      left.title.localeCompare(right.title)
  );
}

async function fetchArticleGameSummaryBySlug(slug: string): Promise<ArticleGameSummary | null> {
  const normalizedSlug = slug.trim().toLowerCase();
  if (!normalizedSlug) return null;
  const groups = await fetchArticleGameSummaries();
  return groups.find((group) => group.slug === normalizedSlug) ?? null;
}

async function fetchPublishedArticlesByArticleGameSlugPage(
  slug: string,
  safePage: number,
  safePageSize: number
): Promise<{ game: ArticleGameSummary; articles: ArticleWithRelations[]; total: number; totalPages: number } | null> {
  const game = await fetchArticleGameSummaryBySlug(slug);
  if (!game) return null;

  const offset = (safePage - 1) * safePageSize;
  const sb = supabaseAdmin();
  let query = sb
    .from("articles")
    .select(ARTICLE_INDEX_FIELDS, { count: "exact" })
    .eq("is_published", true);
  query = game.universeId == null ? query.is("universe_id", null) : query.eq("universe_id", game.universeId);
  const scopedQuery = query
    .order("published_at", { ascending: false })
    .order("id", { ascending: true })
    .range(offset, offset + safePageSize - 1);

  try {
    const { data, count, error, status } = await scopedQuery;
    if (error) {
      if (!isOutOfRangePaginationFailure(status, error)) throw error;
      return {
        game,
        articles: [],
        total: game.articleCount,
        totalPages: Math.max(1, Math.ceil(game.articleCount / safePageSize))
      };
    }
    const total = count ?? game.articleCount;
    return {
      game: { ...game, articleCount: total },
      articles: mapArticleIndexRows(data),
      total,
      totalPages: Math.max(1, Math.ceil(total / safePageSize))
    };
  } catch (error) {
    if (!isOutOfRangePaginationError(error)) throw error;
    return {
      game,
      articles: [],
      total: game.articleCount,
      totalPages: Math.max(1, Math.ceil(game.articleCount / safePageSize))
    };
  }
}

async function fetchArticleBySlug(normalizedSlug: string): Promise<ArticleWithRelations | null> {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("articles")
    .select(ARTICLE_DETAIL_FIELDS)
    .eq("slug", normalizedSlug)
    .eq("is_published", true)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return data as unknown as ArticleWithRelations;
}

async function fetchPublishedArticlesByAuthor(
  authorId: string,
  limit: number,
  offset: number
): Promise<ArticleWithRelations[]> {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("articles")
    .select(ARTICLE_INDEX_FIELDS)
    .eq("is_published", true)
    .eq("author_id", authorId)
    .order("published_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return mapArticleIndexRows(data);
}

const cachedListPublishedArticles = publicContentCache(
  async (limit: number, offset: number) => {
    return fetchPublishedArticles(limit, offset);
  },
  ["listPublishedArticles"],
  {
    revalidate: 21600, // 6 hours
    tags: ["articles-index", "home"]
  }
);

export async function listPublishedArticles(limit = 20, offset = 0): Promise<ArticleWithRelations[]> {
  if (BYPASS_ARTICLE_CACHE) {
    return fetchPublishedArticles(limit, offset);
  }
  return cachedListPublishedArticles(limit, offset);
}

export async function listPublishedArticleSlugs(): Promise<string[]> {
  if (BYPASS_ARTICLE_CACHE) {
    return fetchPublishedArticleSlugs();
  }
  const cached = publicContentCache(
    fetchPublishedArticleSlugs,
    ["listPublishedArticleSlugs"],
    {
      revalidate: 21600, // 6 hours
      tags: ["articles-index"]
    }
  );

  return cached();
}

export async function listPublishedArticlesPage(
  page: number,
  pageSize: number
): Promise<{ articles: ArticleWithRelations[]; total: number }> {
  const safePage = normalizePositivePage(page);
  const safePageSize = Math.max(1, pageSize);
  if (BYPASS_ARTICLE_CACHE) {
    return fetchPublishedArticlesPage(safePage, safePageSize);
  }

  const cached = publicContentCache(
    () => fetchPublishedArticlesPage(safePage, safePageSize),
    [`listPublishedArticlesPage:${safePage}:${safePageSize}`],
    {
      revalidate: 21600, // 6 hours
      tags: ["articles-index"]
    }
  );

  return cached();
}

export async function listPublishedArticlesByUniverseId(
  universeId: number,
  limit = 3,
  offset = 0
): Promise<ArticleWithRelations[]> {
  const cacheKey = `listPublishedArticlesByUniverseId:${universeId}:${limit}:${offset}`;
  if (BYPASS_ARTICLE_CACHE) {
    return fetchPublishedArticlesByUniverseId(universeId, limit, offset);
  }
  const cached = publicContentCache(
    () => fetchPublishedArticlesByUniverseId(universeId, limit, offset),
    [cacheKey],
    {
      revalidate: 21600, // 6 hours
      tags: ["articles-index"]
    }
  );

  return cached();
}

export async function listArticleGameSummaries(): Promise<ArticleGameSummary[]> {
  if (BYPASS_ARTICLE_CACHE) {
    return fetchArticleGameSummaries();
  }
  const cached = publicContentCache(fetchArticleGameSummaries, ["listArticleGameSummaries"], {
    revalidate: 21600,
    tags: ["articles-index"]
  });
  return cached();
}

export async function getArticleGameSummaryBySlug(slug: string): Promise<ArticleGameSummary | null> {
  const normalizedSlug = slug.trim().toLowerCase();
  if (!normalizedSlug) return null;
  if (BYPASS_ARTICLE_CACHE) {
    return fetchArticleGameSummaryBySlug(normalizedSlug);
  }
  const cached = publicContentCache(
    () => fetchArticleGameSummaryBySlug(normalizedSlug),
    [`getArticleGameSummary:${normalizedSlug}`],
    {
      revalidate: 21600,
      tags: ["articles-index", `article-game:${normalizedSlug}`]
    }
  );
  return cached();
}

export async function listPublishedArticlesByArticleGameSlugPage(
  slug: string,
  page: number,
  pageSize: number
): Promise<{ game: ArticleGameSummary; articles: ArticleWithRelations[]; total: number; totalPages: number } | null> {
  const normalizedSlug = slug.trim().toLowerCase();
  const safePage = normalizePositivePage(page);
  const safePageSize = Math.max(1, pageSize);
  if (!normalizedSlug) return null;
  if (BYPASS_ARTICLE_CACHE) {
    return fetchPublishedArticlesByArticleGameSlugPage(normalizedSlug, safePage, safePageSize);
  }
  const cached = publicContentCache(
    () => fetchPublishedArticlesByArticleGameSlugPage(normalizedSlug, safePage, safePageSize),
    [`listPublishedArticlesByArticleGameSlugPage:${normalizedSlug}:${safePage}:${safePageSize}`],
    {
      revalidate: 21600,
      tags: ["articles-index", `article-game:${normalizedSlug}`]
    }
  );
  return cached();
}

export async function getArticleBySlug(slug: string): Promise<ArticleWithRelations | null> {
  const normalizedSlug = slug.trim().toLowerCase();
  if (BYPASS_ARTICLE_CACHE) {
    return fetchArticleBySlug(normalizedSlug);
  }
  const cached = publicContentCache(
    () => fetchArticleBySlug(normalizedSlug),
    [`getArticleBySlug:${normalizedSlug}`],
    {
      revalidate: 604800, // 7 days to align with article ISR
      tags: ["articles-index", `article:${normalizedSlug}`]
    }
  );

  return cached();
}

export async function listRecentArticlesForSitemap(): Promise<ArticleWithRelations[]> {
  return listPublishedArticles(200, 0);
}

export async function listPublishedArticlesByAuthor(
  authorId: string,
  limit = 12,
  offset = 0,
  authorSlug?: string | null
): Promise<ArticleWithRelations[]> {
  const tagSlug = authorSlug?.trim().toLowerCase() ?? null;
  const cacheKey = `listPublishedArticlesByAuthor:${authorId}:${limit}:${offset}`;
  if (BYPASS_ARTICLE_CACHE) {
    return fetchPublishedArticlesByAuthor(authorId, limit, offset);
  }
  const cached = publicContentCache(
    () => fetchPublishedArticlesByAuthor(authorId, limit, offset),
    [cacheKey],
    {
      revalidate: 21600, // 6 hours
      tags: ["articles-index", tagSlug ? `author:${tagSlug}` : null].filter(Boolean) as string[]
    }
  );

  return cached();
}

const cachedGetChecklistPageBySlug = publicContentCache(
  async (slug: string) => {
    const normalizedSlug = slug.trim().toLowerCase();
    const sb = supabaseAdmin();

    let page: ChecklistPage | null = null;

    // Prefer the view; fall back to the base table if needed
    const { data: viewPage, error: viewError } = await sb
      .from("checklist_pages_view")
      .select("*")
      .eq("slug", normalizedSlug)
      .eq("is_public", true)
      .maybeSingle();

    if (!viewError && viewPage) {
      page = viewPage as ChecklistPage;
    } else {
      const { data: tablePage, error: tableError } = await sb
        .from("checklist_pages")
        .select("*")
        .eq("slug", normalizedSlug)
        .eq("is_public", true)
        .maybeSingle();
      if (tableError) throw tableError;
      page = (tablePage as ChecklistPage) ?? null;
    }

    if (!page) return null;

    const { data: items, error: itemsError } = await sb
      .from("checklist_items")
      .select("*")
      .eq("page_id", (page as any).id)
      .order("section_code", { ascending: true });

    if (itemsError) throw itemsError;

    return {
      page,
      items: sortChecklistItems((items ?? []) as ChecklistItem[])
    };
  },
  ["getChecklistPageBySlug"],
  {
    revalidate: 1800,
    tags: ["checklists-index"]
  }
);

export async function getChecklistPageBySlug(
  slug: string
): Promise<{ page: ChecklistPage; items: ChecklistItem[] } | null> {
  return cachedGetChecklistPageBySlug(slug.trim().toLowerCase());
}

export async function listPublishedChecklistSlugs(): Promise<string[]> {
  const cached = publicContentCache(
    async () => {
      const sb = supabaseAdmin();
      const { data, error } = await sb
        .from("checklist_pages")
        .select("slug")
        .eq("is_public", true);
      if (error) throw error;
      return (data ?? []).map((row) => (row as { slug: string }).slug);
    },
    ["listPublishedChecklistSlugs"],
    {
      revalidate: 1800,
      tags: ["checklists-index"]
    }
  );

  return cached();
}

export type ChecklistSummaryRow = {
  id: string;
  slug: string;
  title: string;
  description_md?: string | null;
  seo_description?: string | null;
  published_at?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
  content_updated_at?: string | null;
  universe_id?: number | null;
  item_count?: number;
  leaf_item_count?: number;
  universe?: {
    display_name?: string | null;
    name?: string | null;
    icon_url?: string | null;
    thumbnail_urls?: unknown;
  } | null;
  items?: Array<{ count?: number }>;
};

export type EventsPageSummary = {
  id: string;
  universe_id: number;
  slug: string;
  title: string;
  meta_description?: string | null;
  published_at?: string | null;
  created_at: string;
  updated_at: string;
  universe?: {
    display_name?: string | null;
    name?: string | null;
    icon_url?: string | null;
  } | null;
};

const cachedListPublishedChecklists = publicContentCache(
  async (limit: number, offset: number) => {
    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from("checklist_pages_view")
      .select(
        "id, slug, title, description_md, seo_description, published_at, updated_at, created_at, content_updated_at, item_count, leaf_item_count, universe, universe_id"
      )
      .eq("is_public", true)
      .order("content_updated_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (!error && data) {
      return (data ?? []) as ChecklistSummaryRow[];
    }

    const { data: fallback, error: fallbackError } = await sb
      .from("checklist_pages")
      .select(
        `
          id,
          slug,
          title,
          description_md,
          seo_description,
          published_at,
          updated_at,
          created_at
        `
      )
      .eq("is_public", true)
      .order("updated_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (fallbackError) throw fallbackError;

    return (fallback ?? []) as ChecklistSummaryRow[];
  },
  ["listPublishedChecklists"],
  {
    revalidate: 1800,
    tags: ["checklists-index"]
  }
);

export async function listPublishedChecklists(limit = 120, offset = 0): Promise<ChecklistSummaryRow[]> {
  const safeLimit = Math.max(1, limit);
  const safeOffset = Math.max(0, offset);
  return cachedListPublishedChecklists(safeLimit, safeOffset);
}

export async function listPublishedChecklistsPage(
  page: number,
  pageSize: number
): Promise<{ checklists: ChecklistSummaryRow[]; total: number }> {
  const safePage = normalizePositivePage(page);
  const safePageSize = Math.max(1, pageSize);
  const offset = (safePage - 1) * safePageSize;

  const cached = publicContentCache(
    async () => {
      const sb = supabaseAdmin();
      try {
        const { data, count, error, status } = await sb
          .from("checklist_pages_view")
          .select(
            "id, slug, title, description_md, seo_description, cover_image, published_at, updated_at, created_at, item_count, leaf_item_count, universe, universe_id",
            { count: "exact" }
          )
          .eq("is_public", true)
          .order("updated_at", { ascending: false })
          .order("id", { ascending: true })
          .range(offset, offset + safePageSize - 1);

        if (error) {
          if (!isOutOfRangePaginationFailure(status, error)) throw error;
          const { count, error: countError } = await sb
            .from("checklist_pages_view")
            .select("id", { count: "exact", head: true })
            .eq("is_public", true);
          if (countError) throw countError;
          return { checklists: [], total: count ?? 0 };
        }
        const rows = (data ?? []) as ChecklistSummaryRow[];
        return { checklists: rows, total: count ?? rows.length };
      } catch (error: any) {
        if (isOutOfRangePaginationError(error)) {
          const { count, error: countError } = await sb
            .from("checklist_pages_view")
            .select("id", { count: "exact", head: true })
            .eq("is_public", true);
          if (countError) throw countError;
          return { checklists: [], total: count ?? 0 };
        }

        if (error?.code !== "42703") throw error;
        const { data: viewData, count: viewCount, error: viewError, status: viewStatus } = await sb
          .from("checklist_pages_view")
          .select(
            "id, slug, title, description_md, seo_description, published_at, updated_at, created_at, item_count, leaf_item_count, universe, universe_id",
            { count: "exact" }
          )
          .eq("is_public", true)
          .order("updated_at", { ascending: false })
          .order("id", { ascending: true })
          .range(offset, offset + safePageSize - 1);

        if (!viewError) {
          const rows = (viewData ?? []) as ChecklistSummaryRow[];
          return { checklists: rows, total: viewCount ?? rows.length };
        }

        if (isOutOfRangePaginationFailure(viewStatus, viewError)) {
          const { count, error: countError } = await sb
            .from("checklist_pages_view")
            .select("id", { count: "exact", head: true })
            .eq("is_public", true);
          if (countError) throw countError;
          return { checklists: [], total: count ?? 0 };
        }

        if (viewError?.code !== "42703") throw viewError;
        // Fallback for schemas missing view columns: include universe icon via join
        const { data, count, error: fallbackError, status: fallbackStatus } = await sb
          .from("checklist_pages")
          .select(
            `
              id,
              slug,
              title,
              published_at,
              updated_at,
              created_at,
              universe:roblox_universes(icon_url, thumbnail_urls, display_name, name),
              universe_id
            `,
            { count: "exact" }
          )
          .eq("is_public", true)
          .order("updated_at", { ascending: false })
          .order("id", { ascending: true })
          .range(offset, offset + safePageSize - 1);

        if (fallbackError) {
          if (!isOutOfRangePaginationFailure(fallbackStatus, fallbackError)) throw fallbackError;
          const { count: fallbackCount, error: countError } = await sb
            .from("checklist_pages")
            .select("id", { count: "exact", head: true })
            .eq("is_public", true);
          if (countError) throw countError;
          return { checklists: [], total: fallbackCount ?? 0 };
        }
        const rows = (data ?? []) as ChecklistSummaryRow[];
        return { checklists: rows, total: count ?? rows.length };
      }
    },
    [`listPublishedChecklistsPage:${safePage}:${safePageSize}`],
    {
      revalidate: 1800,
      tags: ["checklists-index"]
    }
  );

  return cached();
}

export async function listPublishedChecklistsByUniverseId(universeId: number, limit = 1): Promise<ChecklistSummaryRow[]> {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("checklist_pages_view")
    .select("id, slug, title, description_md, seo_description, published_at, updated_at, created_at, content_updated_at, item_count, leaf_item_count, universe, universe_id")
    .eq("is_public", true)
    .eq("universe_id", universeId)
    .order("content_updated_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as ChecklistSummaryRow[];
}

export async function getEventsPageByUniverseId(universeId: number): Promise<EventsPageSummary | null> {
  const cached = publicContentCache(
    async () => {
      const sb = supabaseAdmin();
      const { data, error } = await sb
        .from("events_pages")
        .select(
          "id, universe_id, slug, title, meta_description, published_at, created_at, updated_at, universe:roblox_universes(universe_id, display_name, name, icon_url)"
        )
        .eq("is_published", true)
        .eq("universe_id", universeId)
        .not("slug", "is", null)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (!data || !(data as { slug?: string | null }).slug) return null;
      const raw = data as EventsPageSummary & { universe?: EventsPageSummary["universe"] | EventsPageSummary["universe"][] };
      const universe = Array.isArray(raw.universe) ? raw.universe[0] ?? null : raw.universe ?? null;
      return { ...raw, universe };
    },
    [`eventsPageByUniverse:${universeId}`],
    {
      revalidate: 3600,
      tags: ["events-pages"]
    }
  );

  return cached();
}

export async function listPublishedEventsPageSlugs(): Promise<string[]> {
  const cached = publicContentCache(
    async () => {
      const sb = supabaseAdmin();
      const { data, error } = await sb
        .from("events_pages")
        .select("slug")
        .eq("is_published", true)
        .not("slug", "is", null);
      if (error) throw error;
      return (data ?? [])
        .map((row) => (row as { slug: string | null }).slug)
        .filter((slug): slug is string => typeof slug === "string" && slug.length > 0);
    },
    ["listPublishedEventsPageSlugs"],
    {
      revalidate: 3600,
      tags: ["events-pages"]
    }
  );

  return cached();
}

export async function getCodePageBySlug(slug: string): Promise<CodePage | null> {
  const normalizedSlug = slug.trim().toLowerCase();
  const cached = publicContentCache(
    async () => {
      const sb = supabaseAdmin();
      const { data, error } = await sb
        .from("code_pages_view")
        .select("*")
        .eq("slug", normalizedSlug)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;

      return data as CodePage;
    },
    [`getCodePageBySlug:${normalizedSlug}`],
    {
      revalidate: 21600, // 6 hours
      tags: ["codes-index", `code:${normalizedSlug}`]
    }
  );

  return cached();
}

const cachedGetRobloxUniverseById = publicContentCache(
  async (universeId: number) => {
    const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("roblox_universes")
    .select("universe_id, name, display_name, creator_name, creator_id, creator_type, social_links, created_at_api")
    .eq("universe_id", universeId)
    .maybeSingle();

    if (error) throw error;
    return (data as RobloxUniverseInfo) || null;
  },
  ["getRobloxUniverseById"],
  {
    revalidate: 21600, // 6 hours
    tags: ["codes-index"]
  }
);

export async function getRobloxUniverseById(universeId: number): Promise<RobloxUniverseInfo | null> {
  return cachedGetRobloxUniverseById(universeId);
}

const cachedListCodesForCodePage = publicContentCache(
  async (codePageId: string) => {
    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from("code_pages_view")
      .select("codes")
      .eq("id", codePageId)
      .maybeSingle();
    if (error) throw error;
    const codes = (data as { codes?: unknown })?.codes;
    if (!Array.isArray(codes)) return [];
    return codes as Code[];
  },
  ["listCodesForCodePage"],
  {
    revalidate: 21600, // 6 hours
    tags: ["codes-index"]
  }
);

export async function listCodesForCodePage(codePageId: string): Promise<Code[]> {
  return cachedListCodesForCodePage(codePageId);
}
// ========================================
// Free Roblox Items Catalog
// ========================================

export type FreeItem = {
  asset_id: number;
  item_type: string;
  name: string;
  description: string | null;
  category: string;
  subcategory: string;
  creator_name: string;
  creator_id: number | null;
  creator_type: string | null;
  asset_type_id: number | null;
  favorite_count: number;
  price_robux: number;
  last_seen_at: string;
  created_at: string;
  roblox_url: string;
  thumbnail_url: string | null;
};

export type FreeItemsFilters = {
  category?: string;
  subcategory?: string;
  search?: string;
  sort?: 'featured' | 'newest' | 'popular' | 'updated';
};

function buildFreeItemsSearchPattern(value: string): string {
  const cleaned = value.replace(/[%_]/g, " ").trim();
  const pattern = cleaned.replace(/[^a-z0-9]+/gi, "%").replace(/%{2,}/g, "%");
  return `%${pattern}%`;
}

type FreeItemRow = Omit<FreeItem, "thumbnail_url" | "roblox_url"> & {
  raw_economy_json: Record<string, unknown> | null;
};
type FeaturedFreeItemBucket = "accessories" | "clothing" | "body" | "animations" | "other";

type FreeItemThumbnailRow = {
  asset_id: number;
  size: string | null;
  format: string | null;
  state: string | null;
  image_url: string | null;
};

const FREE_ITEM_THUMBNAIL_SIZE = "420x420";
const FREE_ITEM_THUMBNAIL_FORMAT = "Png";
const FREE_ITEMS_SELECT_FIELDS =
  'asset_id, item_type, name, description, category, subcategory, creator_name, creator_id, creator_type, asset_type_id, favorite_count, price_robux, last_seen_at, created_at, raw_economy_json';
const FEATURED_FREE_ITEMS_BATCH_SIZE = 1000;
const FEATURED_FREE_ITEM_PATTERN: FeaturedFreeItemBucket[] = [
  "accessories",
  "accessories",
  "clothing",
  "body",
  "accessories",
  "clothing",
  "body",
  "animations",
  "other"
];
const FEATURED_FREE_ITEM_BUCKET_ORDER: FeaturedFreeItemBucket[] = [
  "accessories",
  "clothing",
  "body",
  "animations",
  "other"
];

function getFreeItemThumbnailPriority(row: FreeItemThumbnailRow): number {
  let score = 0;
  if (row.image_url) score += 100;
  if (row.state === "Completed") score += 40;
  if (row.size === FREE_ITEM_THUMBNAIL_SIZE) score += 20;
  if (row.format === FREE_ITEM_THUMBNAIL_FORMAT) score += 10;
  return score;
}

function extractFreeItemRobloxUrl(row: { asset_id: number; item_type?: string | null; raw_economy_json?: Record<string, unknown> | null }) {
  const explicitUrl = row.raw_economy_json?.roblox_url;
  if (typeof explicitUrl === "string" && explicitUrl.length > 0) {
    return explicitUrl;
  }

  if (row.item_type === "Bundle" && Number.isFinite(row.asset_id)) {
    const bundleId = Math.abs(Math.trunc(row.asset_id));
    return `https://www.roblox.com/bundles/${bundleId}`;
  }

  return `https://www.roblox.com/catalog/${row.asset_id}`;
}

function applyFreeItemLibraryFilters<TQuery extends { eq: Function; not: Function; contains: Function }>(query: TQuery): TQuery {
  return query
    .eq('price_robux', 0)
    .eq('is_deleted', false)
    .contains('raw_economy_json', { free_item_source: 'robloxden' })
    .eq('has_resellers', false)
    .eq('lowest_resale_price_robux', 0)
    .not('name', 'is', null)
    .not('category', 'is', null)
    .not('subcategory', 'is', null)
    .not('favorite_count', 'is', null);
}

function createFreeItemsBaseQuery(sb: ReturnType<typeof supabaseAdmin>, includeCount = false) {
  const query = includeCount
    ? sb.from('roblox_catalog_items').select(FREE_ITEMS_SELECT_FIELDS, { count: 'exact' })
    : sb.from('roblox_catalog_items').select(FREE_ITEMS_SELECT_FIELDS);

  return applyFreeItemLibraryFilters(query);
}

function applyFreeItemsFilters(query: any, filters: FreeItemsFilters = {}) {
  let nextQuery = query;

  if (filters.category) {
    nextQuery = nextQuery.eq('category', filters.category);
  }

  if (filters.subcategory) {
    nextQuery = nextQuery.eq('subcategory', filters.subcategory);
  }

  const searchTerm = (filters.search ?? "").trim();
  if (searchTerm) {
    const pattern = buildFreeItemsSearchPattern(searchTerm);
    const orParts = [
      `name.ilike.${pattern}`,
      `description.ilike.${pattern}`,
      `creator_name.ilike.${pattern}`
    ];
    if (/^\d+$/.test(searchTerm)) {
      orParts.unshift(`asset_id.eq.${searchTerm}`);
    }
    nextQuery = nextQuery.or(orParts.join(","));
  }

  return nextQuery;
}

function resolveFeaturedFreeItemBucket(category: string | null | undefined): FeaturedFreeItemBucket {
  const normalizedCategory = (category ?? "").trim().toLowerCase();
  if (normalizedCategory === "accessories") return "accessories";
  if (normalizedCategory === "clothing") return "clothing";
  if (normalizedCategory === "body") return "body";
  if (normalizedCategory === "avataranimations" || normalizedCategory === "animations") return "animations";
  return "other";
}

function wouldCreateFeaturedTriple(items: FreeItemRow[], candidate: FreeItemRow): boolean {
  if (items.length < 2) return false;

  const candidateBucket = resolveFeaturedFreeItemBucket(candidate.category);
  const lastBucket = resolveFeaturedFreeItemBucket(items[items.length - 1]?.category);
  const previousBucket = resolveFeaturedFreeItemBucket(items[items.length - 2]?.category);

  return candidateBucket === lastBucket && candidateBucket === previousBucket;
}

function pickFeaturedFallbackBucket(
  queues: Map<FeaturedFreeItemBucket, FreeItemRow[]>,
  items: FreeItemRow[]
): FeaturedFreeItemBucket | null {
  const availableBuckets = FEATURED_FREE_ITEM_BUCKET_ORDER.filter((bucket) => (queues.get(bucket)?.length ?? 0) > 0);
  if (!availableBuckets.length) return null;

  const validBuckets = availableBuckets.filter((bucket) => {
    const queue = queues.get(bucket);
    return queue?.[0] ? !wouldCreateFeaturedTriple(items, queue[0]) : false;
  });

  const candidateBuckets = validBuckets.length ? validBuckets : availableBuckets;
  return candidateBuckets.sort((left, right) => {
    const leftTopFavorite = queues.get(left)?.[0]?.favorite_count ?? 0;
    const rightTopFavorite = queues.get(right)?.[0]?.favorite_count ?? 0;
    if (leftTopFavorite !== rightTopFavorite) {
      return rightTopFavorite - leftTopFavorite;
    }
    return FEATURED_FREE_ITEM_BUCKET_ORDER.indexOf(left) - FEATURED_FREE_ITEM_BUCKET_ORDER.indexOf(right);
  })[0] ?? null;
}

function mixFeaturedFreeItems(items: FreeItemRow[]): FreeItemRow[] {
  const queues = new Map<FeaturedFreeItemBucket, FreeItemRow[]>(
    FEATURED_FREE_ITEM_BUCKET_ORDER.map((bucket) => [bucket, []])
  );

  for (const item of items) {
    const bucket = resolveFeaturedFreeItemBucket(item.category);
    queues.get(bucket)?.push(item);
  }

  const mixedItems: FreeItemRow[] = [];
  let patternIndex = 0;

  while (mixedItems.length < items.length) {
    let selectedBucket: FeaturedFreeItemBucket | null = null;

    for (let offset = 0; offset < FEATURED_FREE_ITEM_PATTERN.length; offset += 1) {
      const bucket = FEATURED_FREE_ITEM_PATTERN[(patternIndex + offset) % FEATURED_FREE_ITEM_PATTERN.length];
      const candidate = queues.get(bucket)?.[0];
      if (!candidate || wouldCreateFeaturedTriple(mixedItems, candidate)) {
        continue;
      }
      selectedBucket = bucket;
      patternIndex = (patternIndex + offset + 1) % FEATURED_FREE_ITEM_PATTERN.length;
      break;
    }

    if (!selectedBucket) {
      selectedBucket = pickFeaturedFallbackBucket(queues, mixedItems);
      if (!selectedBucket) break;
    }

    const nextItem = queues.get(selectedBucket)?.shift();
    if (!nextItem) break;
    mixedItems.push(nextItem);
  }

  return mixedItems;
}

async function fetchFeaturedFreeItemRows(filters: FreeItemsFilters = {}): Promise<FreeItemRow[]> {
  const sb = supabaseAdmin();
  const rows: FreeItemRow[] = [];

  for (let offset = 0; ; offset += FEATURED_FREE_ITEMS_BATCH_SIZE) {
    let query = createFreeItemsBaseQuery(sb);
    query = applyFreeItemsFilters(query, filters);
    query = query
      .order('favorite_count', { ascending: false, nullsFirst: false })
      .order('asset_id', { ascending: true })
      .range(offset, offset + FEATURED_FREE_ITEMS_BATCH_SIZE - 1);

    const { data, error } = await query;
    if (error) throw error;

    const batchRows = (data ?? []) as FreeItemRow[];
    if (!batchRows.length) break;

    rows.push(...batchRows);
    if (batchRows.length < FEATURED_FREE_ITEMS_BATCH_SIZE) break;
  }

  return rows;
}

async function loadFreeItemThumbnailUrls(assetIds: number[]): Promise<Map<number, string>> {
  const normalizedAssetIds = Array.from(
    new Set(
      assetIds
        .filter((assetId) => Number.isFinite(assetId))
        .filter((assetId) => assetId !== 0)
        .map((assetId) => Math.trunc(assetId))
    )
  );

  if (!normalizedAssetIds.length) {
    return new Map();
  }

  const sb = supabaseAdmin();
  const bestThumbnailRows = new Map<number, FreeItemThumbnailRow>();
  const { data, error } = await sb
    .from("roblox_catalog_item_images")
    .select("asset_id, size, format, state, image_url")
    .in("asset_id", normalizedAssetIds)
    .not("image_url", "is", null);

  if (error) {
    console.error("Failed to load cached free item thumbnails", error);
  } else {
    for (const row of (data ?? []) as FreeItemThumbnailRow[]) {
      if (typeof row.asset_id !== "number" || typeof row.image_url !== "string" || row.image_url.length === 0) {
        continue;
      }

      const existingRow = bestThumbnailRows.get(row.asset_id);
      if (!existingRow || getFreeItemThumbnailPriority(row) > getFreeItemThumbnailPriority(existingRow)) {
        bestThumbnailRows.set(row.asset_id, row);
      }
    }
  }

  const thumbnailMap = new Map<number, string>();
  for (const [assetId, row] of bestThumbnailRows.entries()) {
    if (row.image_url) {
      thumbnailMap.set(assetId, row.image_url);
    }
  }

  return thumbnailMap;
}

async function fetchFreeItems(
  page: number,
  limit: number,
  filters: FreeItemsFilters = {}
): Promise<{ items: FreeItem[]; total: number }> {
  const offset = Math.max(0, (page - 1) * limit);
  const effectiveSort = filters.sort ?? 'featured';

  if (effectiveSort === 'featured') {
    const featuredRows = mixFeaturedFreeItems(await fetchFeaturedFreeItemRows(filters));
    const pageRows = featuredRows.slice(offset, offset + limit);
    const thumbnailMap = await loadFreeItemThumbnailUrls(pageRows.map((item) => item.asset_id));

    return {
      items: pageRows.map(({ raw_economy_json, ...item }) => ({
        ...item,
        roblox_url: extractFreeItemRobloxUrl({ ...item, raw_economy_json }),
        thumbnail_url: thumbnailMap.get(item.asset_id) ?? null
      })),
      total: featuredRows.length
    };
  }

  const sb = supabaseAdmin();
  let query = createFreeItemsBaseQuery(sb, true);
  query = applyFreeItemsFilters(query, filters);

  // Apply sorting
  switch (effectiveSort) {
    case 'updated':
      query = query.order('last_seen_at', { ascending: false }).order('asset_id', { ascending: true });
      break;
    case 'newest':
      query = query.order('created_at', { ascending: false }).order('asset_id', { ascending: true });
      break;
    case 'popular':
    default:
      query = query.order('favorite_count', { ascending: false, nullsFirst: false }).order('asset_id', { ascending: true });
      break;
  }

  query = query.range(offset, offset + limit - 1);

  const { data, count, error } = await query;

  if (error) throw error;

  const items = (data ?? []) as FreeItemRow[];
  const thumbnailMap = await loadFreeItemThumbnailUrls(items.map((item) => item.asset_id));

  return {
    items: items.map(({ raw_economy_json, ...item }) => ({
      ...item,
      roblox_url: extractFreeItemRobloxUrl({ ...item, raw_economy_json }),
      thumbnail_url: thumbnailMap.get(item.asset_id) ?? null
    })),
    total: count ?? 0
  };
}

export async function listFreeItems(
  page: number = 1,
  limit: number = 24,
  filters: FreeItemsFilters = {}
): Promise<{ items: FreeItem[]; total: number }> {
  const safePage = Math.max(1, page);
  const safeLimit = Math.max(1, Math.min(100, limit));

  const cached = publicContentCache(
    () => fetchFreeItems(safePage, safeLimit, filters),
    [`listFreeItems:v6:${safePage}:${safeLimit}:${JSON.stringify(filters)}`],
    {
      revalidate: 3600, // 1 hour
      tags: ['free-items-catalog']
    }
  );

  return cached();
}

export async function getFreeItemsCount(filters: FreeItemsFilters = {}): Promise<number> {
  const cached = publicContentCache(
    async () => {
      const sb = supabaseAdmin();
      let query = applyFreeItemLibraryFilters(
        sb
        .from('roblox_catalog_items')
        .select('asset_id', { count: 'exact', head: true })
      );

      if (filters.category) {
        query = query.eq('category', filters.category);
      }

      if (filters.subcategory) {
        query = query.eq('subcategory', filters.subcategory);
      }

      const searchTerm = (filters.search ?? "").trim();
      if (searchTerm) {
        const pattern = buildFreeItemsSearchPattern(searchTerm);
        const orParts = [
          `name.ilike.${pattern}`,
          `description.ilike.${pattern}`,
          `creator_name.ilike.${pattern}`
        ];
        if (/^\d+$/.test(searchTerm)) {
          orParts.unshift(`asset_id.eq.${searchTerm}`);
        }
        query = query.or(orParts.join(","));
      }

      const { count, error } = await query;
      if (error) throw error;
      return count ?? 0;
    },
    [`getFreeItemsCount:v3:${JSON.stringify(filters)}`],
    {
      revalidate: 3600, // 1 hour
      tags: ['free-items-catalog']
    }
  );

  return cached();
}

const FREE_ITEM_FACET_BATCH_SIZE = 1000;

async function fetchAllFreeItemFacetRows(
  field: 'category' | 'subcategory',
  category?: string
): Promise<Array<{ category?: string | null; subcategory?: string | null }>> {
  const sb = supabaseAdmin();
  const rows: Array<{ category?: string | null; subcategory?: string | null }> = [];

  for (let offset = 0; ; offset += FREE_ITEM_FACET_BATCH_SIZE) {
    let query = applyFreeItemLibraryFilters(
      sb
      .from('roblox_catalog_items')
      .select(field)
      .range(offset, offset + FREE_ITEM_FACET_BATCH_SIZE - 1)
    );

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query;
    if (error) throw error;

    const batchRows = (data ?? []) as Array<{ category?: string | null; subcategory?: string | null }>;
    if (!batchRows.length) break;

    rows.push(...batchRows);
    if (batchRows.length < FREE_ITEM_FACET_BATCH_SIZE) break;
  }

  return rows;
}

export async function getFreeItemCategories(): Promise<Array<{ category: string; count: number }>> {
  const cached = publicContentCache(
    async () => {
      const data = await fetchAllFreeItemFacetRows('category');

      // Count occurrences
      const counts = new Map<string, number>();
      for (const item of data ?? []) {
        if (item.category) {
          counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
        }
      }

      return Array.from(counts.entries())
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count);
    },
    ['getFreeItemCategories:v4'],
    {
      revalidate: 7200, // 2 hours
      tags: ['free-items-catalog']
    }
  );

  return cached();
}

export async function getFreeItemSubcategories(category?: string): Promise<Array<{ subcategory: string; count: number }>> {
  const cached = publicContentCache(
    async () => {
      const data = await fetchAllFreeItemFacetRows('subcategory', category);

      // Count occurrences
      const counts = new Map<string, number>();
      for (const item of data ?? []) {
        if (item.subcategory) {
          counts.set(item.subcategory, (counts.get(item.subcategory) ?? 0) + 1);
        }
      }

      return Array.from(counts.entries())
        .map(([subcategory, count]) => ({ subcategory, count }))
        .sort((a, b) => b.count - a.count);
    },
    [`getFreeItemSubcategories:v4:${category ?? 'all'}`],
    {
      revalidate: 7200, // 2 hours
      tags: ['free-items-catalog']
    }
  );

  return cached();
}

import "server-only";
import { unstable_cache } from "next/cache";
import {
  getEventsPageByUniverseId,
  listCodesForGame,
  listGamesWithActiveCountsByUniverseId,
  listPublishedArticlesByUniverseId,
  listPublishedChecklistsByUniverseId,
  listRanksForUniverses,
  type ArticleWithRelations,
  type ChecklistSummaryRow,
  type EventsPageSummary,
  type GameWithCounts,
  type Code,
  type UniverseListBadge
} from "@/lib/db";
import { getUniverseEventSummary, listUniverseEventTimeline, type UniverseEventSummary, type UniverseTimelineEvent } from "@/lib/events-summary";
import {
  listPublishedCatalogPagesByCodePrefix,
  listPublishedCatalogPagesByUniverseId,
  type CatalogListEntry
} from "@/lib/catalog";
import { supabaseAdmin } from "@/lib/supabase";
import { listPublishedToolsByUniverseId, type ToolListEntry } from "@/lib/tools";
import type { QuizListEntry } from "@/lib/quizzes";
import { sortCodesByFirstSeenDesc } from "@/lib/code-utils";

const WIKI_REVALIDATE_SECONDS = 3600;
const WIKI_SELECT_FIELDS =
  "id, slug, title, seo_title, meta_description, universe_id, controls_json, tips_md, is_published, published_at, created_at, updated_at, content_updated_at, universe_root_place_id, universe_name, universe_display_name, universe_slug, universe_description, universe_game_description_md, universe_creator_id, universe_creator_name, universe_creator_type, universe_creator_has_verified_badge, universe_group_id, universe_group_name, universe_group_has_verified_badge, universe_genre, universe_genre_l1, universe_genre_l2, universe_age_rating, universe_avatar_type, desktop_enabled, mobile_enabled, tablet_enabled, console_enabled, vr_enabled, voice_chat_enabled, price, private_server_price_robux, create_vip_servers_allowed, max_players, server_size, playing, visits, favorites, likes, dislikes, icon_url, thumbnail_urls, social_links, created_at_api, updated_at_api, universe_updated_at";
const WIKI_FALLBACK_FIELDS =
  "id, slug, title, seo_title, meta_description, universe_id, controls_json, tips_md, is_published, published_at, created_at, updated_at";

export type WikiPageContent = {
  id: string;
  slug: string;
  title: string;
  seo_title?: string | null;
  meta_description?: string | null;
  cover_image?: string | null;
  universe_id?: number | null;
  controls_json?: unknown;
  tips_md?: string | null;
  is_published: boolean;
  published_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  content_updated_at?: string | null;
  universe_root_place_id?: number | null;
  universe_name?: string | null;
  universe_display_name?: string | null;
  universe_slug?: string | null;
  universe_description?: string | null;
  universe_game_description_md?: string | null;
  universe_creator_id?: number | null;
  universe_creator_name?: string | null;
  universe_creator_type?: string | null;
  universe_creator_has_verified_badge?: boolean | null;
  universe_group_id?: number | null;
  universe_group_name?: string | null;
  universe_group_has_verified_badge?: boolean | null;
  universe_genre?: string | null;
  universe_genre_l1?: string | null;
  universe_genre_l2?: string | null;
  universe_age_rating?: string | null;
  universe_avatar_type?: string | null;
  desktop_enabled?: boolean | null;
  mobile_enabled?: boolean | null;
  tablet_enabled?: boolean | null;
  console_enabled?: boolean | null;
  vr_enabled?: boolean | null;
  voice_chat_enabled?: boolean | null;
  price?: number | null;
  private_server_price_robux?: number | null;
  create_vip_servers_allowed?: boolean | null;
  max_players?: number | null;
  server_size?: number | null;
  playing?: number | null;
  visits?: number | null;
  favorites?: number | null;
  likes?: number | null;
  dislikes?: number | null;
  icon_url?: string | null;
  thumbnail_urls?: unknown;
  social_links?: unknown;
  created_at_api?: string | null;
  updated_at_api?: string | null;
  universe_updated_at?: string | null;
};

export type WikiListEntry = Pick<
  WikiPageContent,
  | "id"
  | "slug"
  | "title"
  | "meta_description"
  | "cover_image"
  | "universe_id"
  | "icon_url"
  | "thumbnail_urls"
  | "published_at"
  | "created_at"
  | "updated_at"
  | "content_updated_at"
>;

export type WikiMediaItem = {
  id: string;
  media_type: "icon" | "screenshot" | "video" | string;
  image_url: string | null;
  video_url: string | null;
  alt_text: string | null;
  is_primary: boolean | null;
  fetched_at: string | null;
};

export type WikiBadgeItem = {
  badge_id: number;
  name: string;
  description: string | null;
  icon_image_url: string | null;
  enabled: boolean | null;
  awarded_count: number | null;
  awarded_past_day: number | null;
  awarded_past_week: number | null;
  rarity_percent: number | null;
};

export type WikiGamePassItem = {
  pass_id: number;
  name: string;
  description: string | null;
  price: number | null;
  is_for_sale: boolean | null;
  sales: number | null;
  icon_image_url: string | null;
};

export type WikiServerItem = {
  id: string;
  server_id: string;
  region: string | null;
  ping_ms: number | null;
  fps: number | null;
  player_count: number | null;
  max_players: number | null;
  fetched_at: string | null;
};

export type WikiDeveloperGame = {
  universe_id: number;
  root_place_id: number | null;
  name: string | null;
  display_name: string | null;
  slug: string | null;
  icon_url: string | null;
  playing: number | null;
  visits: number | null;
};

export type WikiRelatedData = {
  codes: GameWithCounts[];
  activeCodes: Code[];
  tools: ToolListEntry[];
  articles: ArticleWithRelations[];
  checklists: ChecklistSummaryRow[];
  catalogPages: CatalogListEntry[];
  quizzes: QuizListEntry[];
  eventsPage: EventsPageSummary | null;
  eventSummary: UniverseEventSummary | null;
  eventTimeline: UniverseTimelineEvent[];
  rankingBadges: UniverseListBadge[];
  media: WikiMediaItem[];
  badges: WikiBadgeItem[];
  gamePasses: WikiGamePassItem[];
  servers: WikiServerItem[];
  developerGames: WikiDeveloperGame[];
};

export const EMPTY_WIKI_RELATED_DATA: WikiRelatedData = {
  codes: [],
  activeCodes: [],
  tools: [],
  articles: [],
  checklists: [],
  catalogPages: [],
  quizzes: [],
  eventsPage: null,
  eventSummary: null,
  eventTimeline: [],
  rankingBadges: [],
  media: [],
  badges: [],
  gamePasses: [],
  servers: [],
  developerGames: []
};

function normalizeSlug(value: string): string {
  return value.trim().toLowerCase().replace(/^\/+|\/+$/g, "");
}

function buildWikiTags(slug?: string | null): string[] {
  const normalized = slug ? normalizeSlug(slug) : "";
  return ["wiki-index", normalized ? `wiki:${normalized}` : ""].filter(Boolean);
}

async function fetchWikiPage(slug: string): Promise<WikiPageContent | null> {
  const normalized = normalizeSlug(slug);
  if (!normalized) return null;

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("wiki_pages_view")
    .select(WIKI_SELECT_FIELDS)
    .eq("slug", normalized)
    .eq("is_published", true)
    .maybeSingle();

  if (!error && data) {
    return data as WikiPageContent;
  }

  const { data: fallback, error: fallbackError } = await supabase
    .from("wiki_pages")
    .select(WIKI_FALLBACK_FIELDS)
    .eq("slug", normalized)
    .eq("is_published", true)
    .maybeSingle();

  if (fallbackError) {
    console.error("Error fetching wiki page", fallbackError);
    return null;
  }

  return (fallback as WikiPageContent) ?? null;
}

export async function getWikiPageBySlug(slug: string): Promise<WikiPageContent | null> {
  const normalized = normalizeSlug(slug);
  if (!normalized) return null;

  const cached = unstable_cache(async () => fetchWikiPage(normalized), [`wiki-page-v2:${normalized}`], {
    revalidate: WIKI_REVALIDATE_SECONDS,
    tags: buildWikiTags(normalized)
  });

  return cached();
}

export async function listPublishedWikiPages(): Promise<WikiListEntry[]> {
  const cached = unstable_cache(
    async () => {
      const supabase = supabaseAdmin();
      const { data, error } = await supabase
        .from("wiki_pages_view")
        .select("id, slug, title, meta_description, universe_id, icon_url, thumbnail_urls, published_at, created_at, updated_at, content_updated_at")
        .eq("is_published", true)
        .order("content_updated_at", { ascending: false })
        .order("id", { ascending: true });

      if (!error && data) {
        return (data ?? []) as WikiListEntry[];
      }

      const { data: fallback, error: fallbackError } = await supabase
        .from("wiki_pages")
        .select("id, slug, title, meta_description, universe_id, published_at, created_at, updated_at")
        .eq("is_published", true)
        .order("updated_at", { ascending: false })
        .order("id", { ascending: true });

      if (fallbackError) {
        console.error("Error fetching wiki index", fallbackError);
        return [];
      }

      return (fallback ?? []) as WikiListEntry[];
    },
    ["wiki-index-pages-v2"],
    {
      revalidate: WIKI_REVALIDATE_SECONDS,
      tags: ["wiki-index"]
    }
  );

  return cached();
}

export async function listPublishedWikiSlugs(): Promise<string[]> {
  const cached = unstable_cache(
    async () => {
      const supabase = supabaseAdmin();
      const { data, error } = await supabase
        .from("wiki_pages")
        .select("slug")
        .eq("is_published", true)
        .not("slug", "is", null);

      if (error) throw error;
      return (data ?? [])
        .map((row) => (row as { slug?: string | null }).slug)
        .filter((slug): slug is string => typeof slug === "string" && slug.trim().length > 0);
    },
    ["wiki-index-slugs-v2"],
    {
      revalidate: WIKI_REVALIDATE_SECONDS,
      tags: ["wiki-index"]
    }
  );

  return cached();
}

async function safeList<T>(label: string, loader: () => Promise<T[]>): Promise<T[]> {
  try {
    return await loader();
  } catch (error) {
    console.warn(`Failed to load wiki ${label}`, error);
    return [];
  }
}

async function safeValue<T>(label: string, loader: () => Promise<T | null>): Promise<T | null> {
  try {
    return await loader();
  } catch (error) {
    console.warn(`Failed to load wiki ${label}`, error);
    return null;
  }
}

async function listWikiQuizzesByUniverseId(universeId: number, limit = 4): Promise<QuizListEntry[]> {
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 4;
  const cached = unstable_cache(
    async () => {
      const supabase = supabaseAdmin();
      const { data, error } = await supabase
        .from("quiz_pages_view")
        .select("id, universe_id, code, title, description_md, seo_description, published_at, created_at, updated_at, content_updated_at, universe")
        .eq("is_published", true)
        .eq("universe_id", universeId)
        .order("content_updated_at", { ascending: false })
        .limit(safeLimit);

      if (!error && data) {
        return (data ?? []) as QuizListEntry[];
      }

      const { data: fallback, error: fallbackError } = await supabase
        .from("quiz_pages")
        .select("id, universe_id, code, title, description_md, seo_description, published_at, created_at, updated_at")
        .eq("is_published", true)
        .eq("universe_id", universeId)
        .order("updated_at", { ascending: false })
        .limit(safeLimit);

      if (fallbackError) throw fallbackError;
      return (fallback ?? []) as QuizListEntry[];
    },
    [`wiki-quizzes:${universeId}:${safeLimit}`],
    {
      revalidate: WIKI_REVALIDATE_SECONDS,
      tags: ["quizzes-index"]
    }
  );

  return cached();
}

async function listWikiMediaByUniverseId(universeId: number, limit = 8): Promise<WikiMediaItem[]> {
  const cached = unstable_cache(
    async () => {
      const supabase = supabaseAdmin();
      const { data, error } = await supabase
        .from("roblox_universe_media")
        .select("id, media_type, image_url, video_url, alt_text, is_primary, fetched_at")
        .eq("universe_id", universeId)
        .or("approved.is.null,approved.eq.true")
        .order("is_primary", { ascending: false })
        .order("fetched_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data ?? []) as WikiMediaItem[];
    },
    [`wiki-media:${universeId}:${limit}`],
    {
      revalidate: WIKI_REVALIDATE_SECONDS,
      tags: ["wiki-index"]
    }
  );

  return cached();
}

async function listWikiBadgesByUniverseId(universeId: number, limit = 8): Promise<WikiBadgeItem[]> {
  const cached = unstable_cache(
    async () => {
      const supabase = supabaseAdmin();
      const { data, error } = await supabase
        .from("roblox_universe_badges")
        .select("badge_id, name, description, icon_image_url, enabled, awarded_count, awarded_past_day, awarded_past_week, rarity_percent")
        .eq("universe_id", universeId)
        .order("awarded_count", { ascending: false, nullsFirst: false })
        .limit(limit);

      if (error) throw error;
      return (data ?? []) as WikiBadgeItem[];
    },
    [`wiki-badges:${universeId}:${limit}`],
    {
      revalidate: WIKI_REVALIDATE_SECONDS,
      tags: ["wiki-index"]
    }
  );

  return cached();
}

async function listWikiGamePassesByUniverseId(universeId: number, limit = 8): Promise<WikiGamePassItem[]> {
  const cached = unstable_cache(
    async () => {
      const supabase = supabaseAdmin();
      const { data, error } = await supabase
        .from("roblox_universe_gamepasses")
        .select("pass_id, name, description, price, is_for_sale, sales, icon_image_url")
        .eq("universe_id", universeId)
        .order("is_for_sale", { ascending: false, nullsFirst: false })
        .order("price", { ascending: true, nullsFirst: false })
        .limit(limit);

      if (error) throw error;
      return (data ?? []) as WikiGamePassItem[];
    },
    [`wiki-game-passes:${universeId}:${limit}`],
    {
      revalidate: WIKI_REVALIDATE_SECONDS,
      tags: ["wiki-index"]
    }
  );

  return cached();
}

async function listWikiServersByUniverseId(universeId: number, limit = 12): Promise<WikiServerItem[]> {
  const cached = unstable_cache(
    async () => {
      const supabase = supabaseAdmin();
      const { data, error } = await supabase
        .from("roblox_universe_place_servers")
        .select("id, server_id, region, ping_ms, fps, player_count, max_players, fetched_at")
        .eq("universe_id", universeId)
        .order("fetched_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data ?? []) as WikiServerItem[];
    },
    [`wiki-servers:${universeId}:${limit}`],
    {
      revalidate: 900,
      tags: ["wiki-index"]
    }
  );

  return cached();
}

async function listOtherWikiDeveloperGames(
  universeId: number,
  creatorId?: number | null,
  limit = 6
): Promise<WikiDeveloperGame[]> {
  if (!creatorId) return [];
  const cached = unstable_cache(
    async () => {
      const supabase = supabaseAdmin();
      const { data, error } = await supabase
        .from("roblox_universes")
        .select("universe_id, root_place_id, name, display_name, slug, icon_url, playing, visits")
        .eq("creator_id", creatorId)
        .neq("universe_id", universeId)
        .order("visits", { ascending: false, nullsFirst: false })
        .limit(limit);

      if (error) throw error;
      return (data ?? []) as WikiDeveloperGame[];
    },
    [`wiki-developer-games:${universeId}:${creatorId}:${limit}`],
    {
      revalidate: WIKI_REVALIDATE_SECONDS,
      tags: ["wiki-index"]
    }
  );

  return cached();
}

export async function loadWikiRelatedData(page: WikiPageContent): Promise<WikiRelatedData> {
  const universeId = page.universe_id ?? null;
  const slug = page.slug?.trim().toLowerCase() ?? "";
  const catalogPagesByPrefixPromise = slug
    ? safeList("catalog pages by slug", () => listPublishedCatalogPagesByCodePrefix(slug))
    : Promise.resolve([]);

  if (!universeId) {
    return {
      ...EMPTY_WIKI_RELATED_DATA,
      catalogPages: await catalogPagesByPrefixPromise
    };
  }

  const [
    codes,
    tools,
    articles,
    checklists,
    catalogPages,
    catalogPagesByPrefix,
    quizzes,
    eventsPage,
    eventSummary,
    eventTimeline,
    rankMap,
    media,
    badges,
    gamePasses,
    servers,
    developerGames
  ] = await Promise.all([
    safeList("codes", () => listGamesWithActiveCountsByUniverseId(universeId, 1)),
    safeList("tools", () => listPublishedToolsByUniverseId(universeId, 6)),
    safeList("articles", () => listPublishedArticlesByUniverseId(universeId, 8, 0)),
    safeList("checklists", () => listPublishedChecklistsByUniverseId(universeId, 4)),
    safeList("catalog pages", () => listPublishedCatalogPagesByUniverseId(universeId)),
    catalogPagesByPrefixPromise,
    safeList("quizzes", () => listWikiQuizzesByUniverseId(universeId, 4)),
    safeValue("events page", () => getEventsPageByUniverseId(universeId)),
    safeValue("event summary", () => getUniverseEventSummary(universeId)),
    safeList("event timeline", () => listUniverseEventTimeline(universeId, 7)),
    safeValue("rankings", () => listRanksForUniverses([universeId])),
    safeList("media", () => listWikiMediaByUniverseId(universeId, 8)),
    safeList("badges", () => listWikiBadgesByUniverseId(universeId, 8)),
    safeList("game passes", () => listWikiGamePassesByUniverseId(universeId, 8)),
    safeList("servers", () => listWikiServersByUniverseId(universeId, 12)),
    safeList("developer games", () => listOtherWikiDeveloperGames(universeId, page.universe_creator_id, 6))
  ]);
  const codePages = codes.filter((game) => (game.active_count ?? 0) > 0);
  const primaryCodePage = codePages[0] ?? null;
  const activeCodes = primaryCodePage
    ? sortCodesByFirstSeenDesc(
        (await safeList("active codes", () => listCodesForGame(primaryCodePage.id))).filter((code) => code.status === "active")
      ).slice(0, 3)
    : [];

  return {
    codes: codePages,
    activeCodes,
    tools,
    articles,
    checklists,
    catalogPages: mergeCatalogPages(catalogPages, catalogPagesByPrefix),
    quizzes,
    eventsPage,
    eventSummary,
    eventTimeline,
    rankingBadges: rankMap?.get(universeId) ?? [],
    media,
    badges,
    gamePasses,
    servers,
    developerGames
  };
}

function mergeCatalogPages(left: CatalogListEntry[], right: CatalogListEntry[]): CatalogListEntry[] {
  const seen = new Set<string>();
  const merged: CatalogListEntry[] = [];
  for (const entry of [...left, ...right]) {
    if (seen.has(entry.code)) continue;
    seen.add(entry.code);
    merged.push(entry);
  }
  return merged.sort((a, b) => {
    const leftOrder = typeof a.wiki_sort_order === "number" ? a.wiki_sort_order : Number.MAX_SAFE_INTEGER;
    const rightOrder = typeof b.wiki_sort_order === "number" ? b.wiki_sort_order : Number.MAX_SAFE_INTEGER;
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    return a.title.localeCompare(b.title);
  });
}

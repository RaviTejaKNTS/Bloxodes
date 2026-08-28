import Link from "next/link";
import { CopyCodeButton } from "@/components/CopyCodeButton";
import { MusicCoverImage } from "@/components/MusicCoverImage";
import { PagePagination } from "@/components/PagePagination";
import { CommentsSection } from "@/components/comments/CommentsSection";
import { MoreCatalogs } from "@/components/more-content";
import type { CatalogPageContent } from "@/lib/catalog";
import { supabaseAdmin } from "@/lib/supabase";
import { breadcrumbJsonLd, CATALOG_DESCRIPTION, SITE_URL, webPageJsonLd } from "@/lib/seo";
import {
  DEFAULT_SORT,
  normalizeSearchQuery,
  normalizeSortKey,
  type MusicSortKey
} from "@/lib/music-ids-search";
import { PageBreadcrumb, type PageBreadcrumbItem } from "@/components/PageBreadcrumb";
import { UpdatedTimestamp } from "@/components/UpdatedTimestamp";
import { ContentFaq } from "@/components/ContentFaq";
import { formatRelativeDate } from "@/lib/content-dates";
import { buildPageContentHtml, renderPageContentNodes, type PageContentHtml } from "@/lib/page-content";
import { MusicIdsBrowser } from "./MusicIdsBrowser";
import type { MusicGameDatasetPreset } from "@/lib/game-specific-id-pages";

const PAGE_SIZE = 24;
const OPTION_PAGE_SIZE = 24;
const IS_BUILD = process.env.NEXT_PHASE === "phase-production-build";
const TOP_SONGS_TRENDING_LIMIT = 500;

export const BASE_PATH = "/catalog/roblox-music-ids";
export const CANONICAL = `${SITE_URL.replace(/\/$/, "")}${BASE_PATH}`;

export type MusicRow = {
  asset_id: number;
  title: string;
  artist: string;
  album: string | null;
  genre: string | null;
  duration_seconds: number | null;
  album_art_asset_id: number | null;
  thumbnail_url: string | null;
  rank: number | null;
  source: string | null;
  last_seen_at: string | null;
  popularity_score?: number | null;
};

export type CatalogContentHtml = PageContentHtml;

type PageData = {
  songs: MusicRow[];
  total: number;
  totalPages: number;
};

export type SearchParamsInput =
  | Promise<Record<string, string | string[] | undefined>>
  | Record<string, string | string[] | undefined>
  | undefined;

export type MusicResolvedSearch = {
  search: string;
  sort: MusicSortKey;
};

export type MusicNavKey = "all" | "trending" | "charts" | "genres" | "artists" | "games";
export type MusicChartKey = "trending" | "weekly" | "monthly" | "yearly";

type MusicNavItem = {
  id: MusicNavKey;
  title: string;
  description: string;
  href: string;
};

type ValueOption = {
  slug: string;
  label: string;
  count: number;
};

export type BreadcrumbItem = PageBreadcrumbItem;

export async function buildRobloxMusicCatalogContentHtml(
  catalog: CatalogPageContent | null
): Promise<CatalogContentHtml | null> {
  return buildPageContentHtml(catalog);
}

const MUSIC_NAV_ITEMS: MusicNavItem[] = [
  {
    id: "all",
    title: "All Music Codes",
    description: "Broad music ID discovery beyond the daily top list.",
    href: BASE_PATH
  },
  {
    id: "trending",
    title: "Trending",
    description: "Daily Roblox top songs, capped at 500 music IDs.",
    href: `${BASE_PATH}/trending`
  },
  {
    id: "charts",
    title: "Charts",
    description: "Weekly, monthly, and yearly Creator Store music charts.",
    href: `${BASE_PATH}/charts`
  },
  {
    id: "games",
    title: "Game Specific",
    description: "Music, radio, and sound IDs organized around supported Roblox games.",
    href: `${BASE_PATH}/games`
  }
];

const MUSIC_CHARTS: Record<MusicChartKey, {
  activeNav: MusicNavKey;
  path: string;
  title: string;
  heading: string;
  description: string;
  breadcrumbLabel: string;
  statLabel: string;
  source: string | null;
}> = {
  trending: {
    activeNav: "trending",
    path: `${BASE_PATH}/trending`,
    title: "Trending Roblox music IDs",
    heading: "Trending Roblox music IDs",
    description: "The daily Roblox top songs list, capped to the first 500 music IDs.",
    breadcrumbLabel: "Trending",
    statLabel: "ranked songs",
    source: null
  },
  weekly: {
    activeNav: "charts",
    path: `${BASE_PATH}/charts`,
    title: "Weekly Roblox music ID chart",
    heading: "Weekly Roblox music ID chart",
    description: "Roblox Creator Store music IDs from the weekly chart.",
    breadcrumbLabel: "Weekly Chart",
    statLabel: "weekly chart songs",
    source: "creator_store_top_week"
  },
  monthly: {
    activeNav: "charts",
    path: `${BASE_PATH}/charts`,
    title: "Monthly Roblox music ID chart",
    heading: "Monthly Roblox music ID chart",
    description: "Roblox Creator Store music IDs from the monthly chart.",
    breadcrumbLabel: "Monthly Chart",
    statLabel: "monthly chart songs",
    source: "creator_store_top_month"
  },
  yearly: {
    activeNav: "charts",
    path: `${BASE_PATH}/charts`,
    title: "Yearly Roblox music ID chart",
    heading: "Yearly Roblox music ID chart",
    description: "Roblox Creator Store music IDs from the yearly chart.",
    breadcrumbLabel: "Yearly Chart",
    statLabel: "yearly chart songs",
    source: "creator_store_top_year"
  }
};

function formatLoadError(error: unknown) {
  if (!error) return "Unknown error";
  if (typeof error === "string") return error;
  if (typeof (error as { message?: unknown }).message === "string") {
    const message = (error as { message: string }).message;
    return message.length > 240 ? `${message.slice(0, 240)}…` : message;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown error";
  }
}

function reportLoadError(context: string, error: unknown) {
  if (IS_BUILD) return;
  console.error(context, formatLoadError(error));
}


function formatDuration(seconds: number | null): string | null {
  if (!seconds || seconds <= 0) return null;
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
}

function buildThumbnailUrl(song: MusicRow): string {
  if (song.thumbnail_url) return song.thumbnail_url;
  if (!song.album_art_asset_id) return "";
  return `https://www.roblox.com/asset-thumbnail/image?assetId=${song.album_art_asset_id}&width=420&height=420&format=png`;
}

function buildRobloxUrl(assetId: number): string {
  return `https://www.roblox.com/library/${assetId}`;
}

function formatCount(value: number): string {
  return value.toLocaleString("en-US");
}

function normalizeKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function slugify(value: string): string {
  const normalized = normalizeKey(value);
  return normalized.replace(/\s+/g, "-");
}

function buildArtistPath(artist: string): string {
  return `${BASE_PATH}/artists/${slugify(artist)}`;
}

function buildGenrePath(genre: string): string {
  return `${BASE_PATH}/genres/${slugify(genre)}`;
}

function buildLoosePattern(value: string): string {
  const cleaned = value.replace(/[%_]/g, " ").trim();
  const pattern = cleaned.replace(/[^a-z0-9]+/gi, "%").replace(/%{2,}/g, "%");
  return `%${pattern}%`;
}

async function loadOptionPage(
  view: "roblox_music_genres_view" | "roblox_music_artists_view",
  pageNumber: number,
  pageSize: number
) {
  try {
    const safePage = Number.isFinite(pageNumber) && pageNumber > 0 ? pageNumber : 1;
    const offset = (safePage - 1) * pageSize;
    const supabase = supabaseAdmin();
    const { data, error, count } = await supabase
      .from(view)
      .select("slug,label,item_count", { count: "exact" })
      .order("label", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) {
      reportLoadError(`Failed to load ${view} options`, error);
      return { options: [], total: 0, totalPages: 1 };
    }

    const options = (data ?? []).map((row) => ({
      slug: row.slug,
      label: row.label,
      count: row.item_count ?? 0
    }));
    const total = count ?? options.length ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    return { options, total, totalPages };
  } catch (error) {
    reportLoadError(`Failed to load ${view} options`, error);
    return { options: [], total: 0, totalPages: 1 };
  }
}

async function loadOptionBySlug(
  view: "roblox_music_genres_view" | "roblox_music_artists_view",
  slug: string
): Promise<ValueOption | null> {
  const normalized = slugify(slug);
  if (!normalized) return null;
  try {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from(view)
      .select("slug,label,item_count")
      .eq("slug", normalized)
      .maybeSingle();

    if (error) {
      reportLoadError(`Failed to load ${view} option`, error);
      return null;
    }

    if (!data) return null;
    return {
      slug: data.slug,
      label: data.label,
      count: data.item_count ?? 0
    };
  } catch (error) {
    reportLoadError(`Failed to load ${view} option`, error);
    return null;
  }
}

const MUSIC_SOURCE_VIEW = "roblox_music_ids_ranked_view";
const MUSIC_SELECT_FIELDS =
  "asset_id, title, artist, album, genre, duration_seconds, album_art_asset_id, thumbnail_url, rank, source, last_seen_at, popularity_score";

async function loadMusicIdsPage(
  pageNumber: number,
  options?: {
    genre?: string;
    artist?: string;
    trending?: boolean;
    search?: string;
    sort?: MusicSortKey;
    preset?: MusicGameDatasetPreset;
  }
) {
  try {
    const safePage = Number.isFinite(pageNumber) && pageNumber > 0 ? pageNumber : 1;
    const offset = (safePage - 1) * PAGE_SIZE;
    const supabase = supabaseAdmin();
    let query = supabase
      .from(MUSIC_SOURCE_VIEW)
      .select(MUSIC_SELECT_FIELDS, { count: "exact" });

    // Filter out songs without duration
    query = query.not("duration_seconds", "is", null).gt("duration_seconds", 0);

    if (options?.preset === "short-sounds") {
      query = query.lte("duration_seconds", 20);
    } else if (options?.preset === "music") {
      query = query.gte("duration_seconds", 30).lte("duration_seconds", 600);
    }

    if (options?.genre) {
      query = query.ilike("genre", buildLoosePattern(options.genre));
    }

    if (options?.artist) {
      query = query.ilike("artist", buildLoosePattern(options.artist));
    }

    const searchTerm = normalizeSearchQuery(options?.search);
    if (searchTerm) {
      const pattern = buildLoosePattern(searchTerm);
      const orParts = [
        `title.ilike.${pattern}`,
        `artist.ilike.${pattern}`,
        `album.ilike.${pattern}`,
        `genre.ilike.${pattern}`
      ];
      if (/^\d+$/.test(searchTerm)) {
        orParts.unshift(`asset_id.eq.${searchTerm}`);
      }
      query = query.or(orParts.join(","));
    }

    if (options?.trending) {
      query = query.not("rank", "is", null).order("rank", { ascending: true, nullsFirst: false });
    } else {
      const sort = options?.sort ?? DEFAULT_SORT;
      switch (sort) {
        case "popular":
          query = query
            .order("popularity_score", { ascending: false, nullsFirst: false })
            .order("last_seen_at", { ascending: false, nullsFirst: false });
          break;
        case "newest":
          query = query.order("last_seen_at", { ascending: false, nullsFirst: false });
          break;
        case "duration_desc":
          query = query
            .order("duration_seconds", { ascending: false, nullsFirst: false })
            .order("popularity_score", { ascending: false, nullsFirst: false });
          break;
        case "duration_asc":
          query = query
            .order("duration_seconds", { ascending: true, nullsFirst: false })
            .order("popularity_score", { ascending: false, nullsFirst: false });
          break;
        case "title_asc":
          query = query.order("title", { ascending: true, nullsFirst: false });
          break;
        case "artist_asc":
          query = query.order("artist", { ascending: true, nullsFirst: false });
          break;
        case "recommended":
        default:
          query = query
            .order("popularity_score", { ascending: false, nullsFirst: false })
            .order("last_seen_at", { ascending: false, nullsFirst: false })
            .order("duration_bucket", { ascending: true, nullsFirst: false })
            .order("duration_seconds", { ascending: false, nullsFirst: false })
            .order("rank", { ascending: true, nullsFirst: false });
      }
    }

    query = query.order("asset_id", { ascending: true });

    const { data, error, count } = await query.range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      reportLoadError("Failed to load Roblox music IDs", error);
      return { songs: [], total: 0, totalPages: 1 };
    }

    const total = count ?? data?.length ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    return { songs: (data ?? []) as MusicRow[], total, totalPages };
  } catch (error) {
    reportLoadError("Failed to load Roblox music IDs", error);
    return { songs: [], total: 0, totalPages: 1 };
  }
}

async function loadDailyTop500MusicIdsPage(pageNumber: number): Promise<PageData> {
  try {
    const safePage = Number.isFinite(pageNumber) && pageNumber > 0 ? pageNumber : 1;
    const offset = (safePage - 1) * PAGE_SIZE;
    const supabase = supabaseAdmin();

    const { data, error, count } = await supabase
      .from(MUSIC_SOURCE_VIEW)
      .select(MUSIC_SELECT_FIELDS, { count: "exact" })
      .not("duration_seconds", "is", null)
      .gt("duration_seconds", 0)
      .not("rank", "is", null)
      .lte("rank", TOP_SONGS_TRENDING_LIMIT)
      .order("rank", { ascending: true, nullsFirst: false })
      .order("asset_id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      reportLoadError("Failed to load daily top Roblox music IDs", error);
      return { songs: [], total: 0, totalPages: 1 };
    }

    const total = Math.min(count ?? data?.length ?? 0, TOP_SONGS_TRENDING_LIMIT);
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    return { songs: (data ?? []) as MusicRow[], total, totalPages };
  } catch (error) {
    reportLoadError("Failed to load daily top Roblox music IDs", error);
    return { songs: [], total: 0, totalPages: 1 };
  }
}

async function loadSourceChartMusicIdsPage(pageNumber: number, source: string): Promise<PageData> {
  try {
    const safePage = Number.isFinite(pageNumber) && pageNumber > 0 ? pageNumber : 1;
    const offset = (safePage - 1) * PAGE_SIZE;
    const supabase = supabaseAdmin();

    const { data, error, count } = await supabase
      .from(MUSIC_SOURCE_VIEW)
      .select(MUSIC_SELECT_FIELDS, { count: "exact" })
      .not("duration_seconds", "is", null)
      .gt("duration_seconds", 0)
      .eq("source", source)
      .order("last_seen_at", { ascending: false, nullsFirst: false })
      .order("popularity_score", { ascending: false, nullsFirst: false })
      .order("asset_id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      reportLoadError(`Failed to load ${source} Roblox music IDs`, error);
      return { songs: [], total: 0, totalPages: 1 };
    }

    const total = count ?? data?.length ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    return { songs: (data ?? []) as MusicRow[], total, totalPages };
  } catch (error) {
    reportLoadError(`Failed to load ${source} Roblox music IDs`, error);
    return { songs: [], total: 0, totalPages: 1 };
  }
}

export async function loadRobloxMusicIdsPageData(
  page: number,
  options?: { search?: string; sort?: MusicSortKey }
): Promise<PageData> {
  return loadMusicIdsPage(page, { search: options?.search, sort: options?.sort });
}

export async function loadGameMusicIdsPageData(
  page: number,
  gameSlug: string,
  preset: MusicGameDatasetPreset,
  options?: { search?: string; sort?: MusicSortKey }
): Promise<PageData> {
  try {
    const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
    const offset = (safePage - 1) * PAGE_SIZE;
    const supabase = supabaseAdmin();
    let query = supabase
      .from("roblox_music_ids_game_view")
      .select(MUSIC_SELECT_FIELDS, { count: "exact" })
      .eq("game_slug", gameSlug);

    const searchTerm = normalizeSearchQuery(options?.search);
    if (searchTerm) {
      const pattern = buildLoosePattern(searchTerm);
      const orParts = [
        `title.ilike.${pattern}`,
        `artist.ilike.${pattern}`,
        `album.ilike.${pattern}`,
        `genre.ilike.${pattern}`
      ];
      if (/^\d+$/.test(searchTerm)) orParts.unshift(`asset_id.eq.${searchTerm}`);
      query = query.or(orParts.join(","));
    }

    const sort = options?.sort ?? DEFAULT_SORT;
    if (sort === "newest") query = query.order("last_seen_at", { ascending: false, nullsFirst: false });
    else if (sort === "duration_desc") query = query.order("duration_seconds", { ascending: false, nullsFirst: false });
    else if (sort === "duration_asc") query = query.order("duration_seconds", { ascending: true, nullsFirst: false });
    else if (sort === "title_asc") query = query.order("title", { ascending: true, nullsFirst: false });
    else if (sort === "artist_asc") query = query.order("artist", { ascending: true, nullsFirst: false });
    else query = query.order("game_sort_order", { ascending: true }).order("popularity_score", { ascending: false, nullsFirst: false });

    const { data, error, count } = await query.order("asset_id", { ascending: true }).range(offset, offset + PAGE_SIZE - 1);
    if (!error && (count ?? 0) > 0) {
      const total = count ?? data?.length ?? 0;
      return { songs: (data ?? []) as MusicRow[], total, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
    }
    if (error) reportLoadError(`Failed to load mapped music IDs for ${gameSlug}`, error);
  } catch (error) {
    reportLoadError(`Failed to load mapped music IDs for ${gameSlug}`, error);
  }

  return loadMusicIdsPage(page, { preset, search: options?.search, sort: options?.sort });
}

export async function loadTrendingMusicIdsPageData(page: number): Promise<PageData> {
  return loadDailyTop500MusicIdsPage(page);
}

export function getMusicChartConfig(key: MusicChartKey) {
  return MUSIC_CHARTS[key];
}

export async function loadMusicChartPageData(key: MusicChartKey, page: number): Promise<PageData> {
  const config = getMusicChartConfig(key);
  if (!config.source) {
    return loadDailyTop500MusicIdsPage(page);
  }
  return loadSourceChartMusicIdsPage(page, config.source);
}

export async function loadGenreMusicIdsPageData(page: number, genre: string): Promise<PageData> {
  return loadMusicIdsPage(page, { genre });
}

export async function loadArtistMusicIdsPageData(page: number, artist: string): Promise<PageData> {
  return loadMusicIdsPage(page, { artist });
}

export async function loadPagedGenreOptions(page: number, pageSize = OPTION_PAGE_SIZE) {
  return loadOptionPage("roblox_music_genres_view", page, pageSize);
}

export async function loadPagedArtistOptions(page: number, pageSize = OPTION_PAGE_SIZE) {
  return loadOptionPage("roblox_music_artists_view", page, pageSize);
}

export async function loadGenreOptionBySlug(slug: string) {
  return loadOptionBySlug("roblox_music_genres_view", slug);
}

export async function loadArtistOptionBySlug(slug: string) {
  return loadOptionBySlug("roblox_music_artists_view", slug);
}

export function MusicCatalogNav({ active }: { active: MusicNavKey }) {
  return (
    <section className="catalog-surface grid gap-4 md:grid-cols-2 xl:grid-cols-4" aria-label="Roblox music ID sections">
      {MUSIC_NAV_ITEMS.map((item) => {
        const isActive = item.id === active;
        const cardClasses = `group relative h-full overflow-hidden rounded-lg border px-5 py-4 transition ${isActive
            ? "border-accent/60 bg-accent/10"
            : "border-border/70 bg-surface/80 hover:border-accent/55"
          }`;
        const card = (
          <article className={cardClasses} aria-current={isActive ? "page" : undefined}>
            <span
              aria-hidden
              className={`absolute inset-x-0 top-0 h-1 ${isActive ? "bg-accent" : "bg-accent/30 group-hover:bg-accent/60"
                }`}
            />
            <div className="flex h-full flex-col gap-3">
              <p className="text-lg font-semibold text-foreground">{item.title}</p>
              <p className="text-sm text-muted">{item.description}</p>
            </div>
          </article>
        );

        if (isActive) {
          return (
            <div key={item.id} className="h-full" aria-current="page">
              {card}
            </div>
          );
        }

        return (
          <Link key={item.id} href={item.href} className="block h-full">
            {card}
          </Link>
        );
      })}
    </section>
  );
}

export function MusicBreadcrumb({ items, className }: { items: BreadcrumbItem[]; className?: string }) {
  return <PageBreadcrumb items={items} className={className} />;
}

export function buildMusicItemListSchema({
  title,
  description,
  url,
  songs,
  total,
  startIndex
}: {
  title: string;
  description: string;
  url: string;
  songs: MusicRow[];
  total: number;
  startIndex: number;
}) {
  const itemListElement = songs.map((song, index) => {
    const item: Record<string, unknown> = {
      "@type": "MusicRecording",
      name: song.title,
      url: buildRobloxUrl(song.asset_id)
    };
    if (song.artist) {
      item.byArtist = { "@type": "MusicGroup", name: song.artist };
    }
    if (song.genre) {
      item.genre = song.genre;
    }
    return {
      "@type": "ListItem",
      position: startIndex + index + 1,
      item
    };
  });

  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: title,
    description,
    url,
    numberOfItems: total,
    itemListElement
  });
}

export function buildSimpleItemListSchema({
  title,
  description,
  url,
  items,
  itemType = "Thing"
}: {
  title: string;
  description: string;
  url: string;
  items: Array<{ name: string; url: string }>;
  itemType?: string;
}) {
  const itemListElement = items.map((item, index) => ({
    "@type": "ListItem",
    position: index + 1,
    item: {
      "@type": itemType,
      name: item.name,
      url: item.url
    }
  }));

  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: title,
    description,
    url,
    numberOfItems: items.length,
    itemListElement
  });
}

function MusicIdEmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-border/60 bg-surface/60 p-8 text-center text-muted">
      No music IDs have been collected yet. Check back soon.
    </div>
  );
}

function MusicIdCard({ song }: { song: MusicRow }) {
  const durationLabel = formatDuration(song.duration_seconds);

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-lg border border-border/70 bg-surface transition duration-200 hover:border-accent/55">
      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="flex items-start gap-4">
          <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-md border border-border/60 bg-background/60">
            <MusicCoverImage
              src={buildThumbnailUrl(song)}
              alt={`${song.title} Roblox music`}
              sizes="80px"
              className="object-cover transition duration-500 group-hover:scale-105"
            />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <h2 className="text-lg font-semibold leading-snug text-foreground line-clamp-2">{song.title}</h2>
            <div className="space-y-1 text-xs text-muted">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">Artist</span>
                <Link
                  href={buildArtistPath(song.artist)}
                  className="font-semibold text-foreground transition hover:text-accent"
                >
                  {song.artist}
                </Link>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">Album</span>
                <span className="text-foreground">{song.album ?? "Single / Unknown"}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-md border border-border/50 bg-surface px-2.5 py-0.5 text-[11px] font-semibold text-foreground">
            <span>Music ID</span>
            <span className="font-mono text-[0.82rem]">{song.asset_id}</span>
            <CopyCodeButton
              code={String(song.asset_id)}
              tone="surface"
              size="sm"
              analytics={{
                event: "music_id_copy",
                params: {
                  asset_id: song.asset_id,
                  artist: song.artist,
                  genre: song.genre ?? ""
                }
              }}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <span className="inline-flex items-center gap-2 rounded-md border border-border/60 bg-background/60 px-3 py-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">Duration</span>
            <span className="font-semibold text-foreground">{durationLabel ?? "—"}</span>
          </span>
          <span className="inline-flex items-center gap-2 rounded-md border border-border/60 bg-background/60 px-3 py-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">Genre</span>
            {song.genre ? (
              <Link href={buildGenrePath(song.genre)} className="font-semibold text-foreground transition hover:text-accent">
                {song.genre}
              </Link>
            ) : (
              <span className="font-semibold text-foreground">—</span>
            )}
          </span>
        </div>

        <div className="mt-auto flex flex-wrap items-center justify-between gap-3">
          <a
            href={buildRobloxUrl(song.asset_id)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-accent px-5 py-2 text-sm font-semibold text-white transition hover:bg-accent-dark dark:bg-accent-dark dark:hover:bg-accent"
          >
            Play on Roblox
          </a>
        </div>
      </div>
    </article>
  );
}

export function MusicIdItems({ songs }: { songs: MusicRow[] }) {
  if (!songs.length) {
    return <MusicIdEmptyState />;
  }

  return (
    <>
      {songs.map((song) => (
        <div key={song.asset_id} data-journey-item className="h-full">
          <MusicIdCard song={song} />
        </div>
      ))}
    </>
  );
}

export function TrendingMusicList({ songs, startIndex = 0 }: { songs: MusicRow[]; startIndex?: number }) {
  if (!songs.length) {
    return (
      <section id="article-body" itemProp="articleBody" className="journey-content-stream journey-content-stream--music rounded-lg border border-dashed border-border/60 bg-surface/60 p-8 text-center text-muted">
        No trending music IDs are available yet. Check back soon.
      </section>
    );
  }

  return (
    <section id="article-body" itemProp="articleBody" role="list" className="journey-content-stream journey-content-stream--music">
      {songs.map((song, index) => {
        const durationLabel = formatDuration(song.duration_seconds);
        const rank = song.rank ?? startIndex + index + 1;
        return (
          <article
            key={song.asset_id}
            data-journey-item
            role="listitem"
            className="block"
          >
            <div className="group flex flex-col gap-4 rounded-lg border border-border/70 bg-surface p-4 transition hover:border-accent/55 sm:p-5">
              <div className="space-y-4">
                <div className="flex min-w-0 items-start gap-3 sm:gap-4">
                  <div className="flex h-11 w-12 flex-shrink-0 items-center justify-center rounded-md border border-accent/20 bg-accent/10 px-2 text-base font-semibold text-accent sm:h-12 sm:w-14 sm:text-xl">
                    #{rank}
                  </div>
                  <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-md border border-border/60 bg-background/60 sm:h-14 sm:w-14">
                    <MusicCoverImage
                      src={buildThumbnailUrl(song)}
                      alt={`${song.title} Roblox music`}
                      sizes="56px"
                      className="object-cover transition duration-500 group-hover:scale-105"
                    />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="break-words text-base font-semibold leading-snug text-foreground line-clamp-2 sm:text-lg">
                      {song.title}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                      <Link
                        href={buildArtistPath(song.artist)}
                        className="font-semibold text-foreground transition hover:text-accent"
                      >
                        {song.artist}
                      </Link>
                      <span className="min-w-0 truncate">{song.album ?? "Single / Unknown"}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-md border border-border/60 bg-background/60 px-3 py-1 text-xs text-muted">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">Duration</span>
                    <span className="font-semibold text-foreground">{durationLabel ?? "—"}</span>
                  </span>
                  {song.genre ? (
                    <span className="inline-flex items-center gap-2 rounded-md border border-border/60 bg-background/60 px-3 py-1 text-xs text-muted">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">Genre</span>
                      <Link href={buildGenrePath(song.genre)} className="font-semibold text-foreground transition hover:text-accent">
                        {song.genre}
                      </Link>
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 rounded-md border border-border/50 bg-surface px-3 py-1 text-xs font-semibold text-foreground">
                  <span>Music ID</span>
                  <span className="font-mono text-[0.85rem]">{song.asset_id}</span>
                  <CopyCodeButton
                    code={String(song.asset_id)}
                    tone="surface"
                    size="sm"
                    analytics={{
                      event: "music_id_copy",
                      params: {
                        asset_id: song.asset_id,
                        artist: song.artist,
                        genre: song.genre ?? ""
                      }
                    }}
                  />
                </div>
                <a
                  href={buildRobloxUrl(song.asset_id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center rounded-md bg-accent px-4 py-2 text-xs font-semibold text-white transition hover:bg-accent-dark dark:bg-accent-dark dark:hover:bg-accent"
                >
                  Play on Roblox
                </a>
              </div>
            </div>
          </article>
        );
      })}
    </section>
  );
}

export function renderRobloxMusicIdsPage({
  songs,
  total,
  totalPages,
  currentPage,
  showHero,
  contentHtml,
  activeNav = "all"
}: {
  songs: MusicRow[];
  total: number;
  totalPages: number;
  currentPage: number;
  showHero: boolean;
  contentHtml?: CatalogContentHtml | null;
  activeNav?: MusicNavKey;
}) {
  const latest = songs.reduce<Date | null>((latestDate, song) => {
    if (!song.last_seen_at) return latestDate;
    const candidate = new Date(song.last_seen_at);
    if (!latestDate || candidate > latestDate) return candidate;
    return latestDate;
  }, null);
  const introHtml = contentHtml?.introHtml?.trim() ? contentHtml?.introHtml : "";
  const descriptionHtml = contentHtml?.descriptionHtml ?? [];
  const howHtml = contentHtml?.howHtml?.trim() ? contentHtml?.howHtml : "";
  const faqHtml = contentHtml?.faqHtml ?? [];
  const baseTitle = contentHtml?.title?.trim() ? contentHtml.title.trim() : "Roblox music IDs";
  const publishedDate = contentHtml?.publishedAt ? new Date(contentHtml.publishedAt) : null;
  const updatedDate = contentHtml?.updatedAt ? new Date(contentHtml.updatedAt) : latest;
  const formattedUpdated = updatedDate
    ? updatedDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : null;
  const updatedRelativeLabel = formatRelativeDate(updatedDate);
  const canonicalPath = currentPage > 1 ? `${BASE_PATH}/page/${currentPage}` : BASE_PATH;
  const canonicalUrl = `${SITE_URL.replace(/\/$/, "")}${canonicalPath}`;
  const pageTitle = currentPage > 1 ? `${baseTitle} - Page ${currentPage}` : baseTitle;
  const description = CATALOG_DESCRIPTION;
  const image = `${SITE_URL}/Bloxodes.png`;
  const publishedIso = publishedDate && !Number.isNaN(publishedDate.getTime()) ? publishedDate.toISOString() : null;
  const updatedIso = updatedDate?.toISOString() ?? null;
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const breadcrumbNavItems: BreadcrumbItem[] = [
    { label: "Home", href: "/" },
    { label: "Catalog", href: "/catalog" },
    { label: "Roblox music IDs", href: currentPage > 1 ? BASE_PATH : null }
  ];
  if (currentPage > 1) {
    breadcrumbNavItems.push({ label: `Page ${currentPage}`, href: null });
  }
  const breadcrumbSchemaItems =
    currentPage > 1
      ? [
        { name: "Home", url: SITE_URL },
        { name: "Catalog", url: `${SITE_URL.replace(/\/$/, "")}/catalog` },
        { name: "Roblox music IDs", url: `${SITE_URL.replace(/\/$/, "")}${BASE_PATH}` },
        { name: `Page ${currentPage}`, url: canonicalUrl }
      ]
      : [
        { name: "Home", url: SITE_URL },
        { name: "Catalog", url: `${SITE_URL.replace(/\/$/, "")}/catalog` },
        { name: "Roblox music IDs", url: canonicalUrl }
      ];
  const hasDetails =
    Boolean(descriptionHtml.length) || Boolean(howHtml) || Boolean(faqHtml.length);
  const listSchema = buildMusicItemListSchema({
    title: pageTitle,
    description,
    url: canonicalUrl,
    songs,
    total,
    startIndex
  });
  const pageSchema = JSON.stringify(
    webPageJsonLd({
      siteUrl: SITE_URL,
      slug: canonicalPath.replace(/^\//, ""),
      title: pageTitle,
      description,
      image,
      author: null,
      publishedAt: publishedIso,
      updatedAt: updatedIso
    })
  );
  const breadcrumbSchema = JSON.stringify(breadcrumbJsonLd(breadcrumbSchemaItems));
  const introNodes = showHero && introHtml ? renderPageContentNodes(introHtml, "music-intro") : null;
  const descriptionNodes = showHero
    ? descriptionHtml.flatMap((entry) => renderPageContentNodes(entry.html, `music-description-${entry.key}`))
    : [];
  const howNodes = showHero && howHtml ? renderPageContentNodes(howHtml, "music-how") : null;
  const faqNodes = showHero
    ? faqHtml.map((faq, idx) => ({
      ...faq,
      nodes: renderPageContentNodes(faq.a, `music-faq-${idx}`)
    }))
    : [];

  return (
    <div className="catalog-surface space-y-10">
      {showHero ? (
        <header className="space-y-4">
          <MusicBreadcrumb items={breadcrumbNavItems} />
          <h1 className="text-4xl font-semibold leading-tight text-foreground md:text-5xl">{baseTitle}</h1>
          <UpdatedTimestamp value={updatedDate} />
        </header>
      ) : (
        <header className="space-y-2">
          <MusicBreadcrumb items={breadcrumbNavItems} />
          <h1 className="text-3xl font-semibold text-foreground">{baseTitle}</h1>
          <p className="text-sm text-muted">Page {currentPage} of {totalPages}</p>
        </header>
      )}

      <section id="article-body" itemProp="articleBody" className="article-content md-copy-scope copy-with-sidebar-space journey-content-stream journey-content-stream--music">
        {introNodes ? introNodes : null}

        <MusicCatalogNav active={activeNav} />

        <MusicIdsBrowser
          initialSongs={songs}
          initialTotalPages={totalPages}
          currentPage={currentPage}
          basePath={BASE_PATH}
        />

        {showHero && hasDetails ? (
          <>
            {descriptionNodes.length ? descriptionNodes : null}

            {howNodes ? howNodes : null}

            <ContentFaq
              items={faqNodes.map((faq, idx) => ({
                id: `${faq.q}-${idx}`,
                question: faq.q,
                answer: faq.nodes
              }))}
            />
          </>
        ) : null}
      </section>

      {contentHtml?.id ? (
        <div className="mt-10">
          <CommentsSection entityType="catalog" entityId={contentHtml.id} />
        </div>
      ) : null}
      <MoreCatalogs excludeCode="roblox-music-ids" />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: pageSchema }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: listSchema }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbSchema }} />
    </div>
  );
}

export function buildGenreCards(genres: ValueOption[]) {
  if (!genres.length) {
    return (
      <div className="rounded-lg border border-dashed border-border/60 bg-surface/60 p-8 text-center text-muted">
        No genre data is available yet. Check back soon.
      </div>
    );
  }

  return (
    <>
      {genres.map((genre) => (
        <div key={genre.slug} data-journey-item className="h-full">
          <Link href={`${BASE_PATH}/genres/${genre.slug}`} className="group block h-full">
            <article className="h-full rounded-lg border border-border/70 bg-surface p-5 transition hover:border-border hover:bg-muted/20">
              <div className="space-y-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Genre</div>
                <h2 className="text-lg font-semibold leading-snug text-foreground">{genre.label}</h2>
                <div className="flex items-center justify-between gap-4 text-sm text-muted">
                  <span>{formatCount(genre.count)} songs</span>
                  <span className="text-xs font-semibold text-accent transition group-hover:text-accent">Explore</span>
                </div>
              </div>
            </article>
          </Link>
        </div>
      ))}
    </>
  );
}

export function buildArtistCards(artists: ValueOption[]) {
  if (!artists.length) {
    return (
      <div className="rounded-lg border border-dashed border-border/60 bg-surface/60 p-8 text-center text-muted">
        No artist data is available yet. Check back soon.
      </div>
    );
  }

  return (
    <>
      {artists.map((artist) => (
        <div key={artist.slug} data-journey-item className="h-full">
          <Link href={`${BASE_PATH}/artists/${artist.slug}`} className="group block h-full">
            <article className="h-full rounded-lg border border-border/70 bg-surface p-5 transition hover:border-border hover:bg-muted/20">
              <div className="space-y-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Artist</div>
                <h2 className="text-lg font-semibold leading-snug text-foreground">{artist.label}</h2>
                <div className="flex items-center justify-between gap-4 text-sm text-muted">
                  <span>{formatCount(artist.count)} songs</span>
                  <span className="text-xs font-semibold text-accent transition group-hover:text-accent">Browse</span>
                </div>
              </div>
            </article>
          </Link>
        </div>
      ))}
    </>
  );
}

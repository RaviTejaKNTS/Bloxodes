import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type SearchItemType =
  | "codes"
  | "article"
  | "checklist"
  | "quiz"
  | "list"
  | "stats"
  | "tool"
  | "catalog"
  | "event"
  | "author"
  | "music"
  | "wiki";

type SearchRow = {
  entity_type: string;
  entity_id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  url: string;
  updated_at: string | null;
  active_code_count: number | null;
  search_text?: string | null;
};

type SearchItem = {
  id: string;
  title: string;
  subtitle: string | null;
  url: string;
  type: SearchItemType;
  updatedAt: string | null;
  badge: string | null;
};

const TYPE_MAP: Record<string, SearchItemType> = {
  code: "codes",
  article: "article",
  checklist: "checklist",
  quiz: "quiz",
  list: "list",
  tool: "tool",
  catalog: "catalog",
  event: "event",
  author: "author",
  music_hub: "music",
  music_genre: "music",
  music_artist: "music",
  wiki: "wiki",
  wiki_catalog: "wiki",
  stats_game: "stats"
};

const SCOPE_ENTITY_TYPES: Record<string, string[]> = {
  codes: ["code"],
  articles: ["article"],
  checklists: ["checklist"],
  quizzes: ["quiz"],
  lists: ["list"],
  stats: ["stats_game"],
  tools: ["tool"],
  catalog: ["catalog"],
  events: ["event"],
  authors: ["author"],
  music: ["music_hub", "music_genre", "music_artist"],
  wiki: ["wiki", "wiki_catalog"]
};

const DEFAULT_LIMIT = 120;
const MAX_LIMIT = 200;
const MIN_QUERY_LENGTH = 2;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function normalizeQuery(value: string | null): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

async function searchSiteFallback(query: string, limit: number, entityTypes: string[] | null): Promise<SearchRow[]> {
  const sb = supabaseAdmin();
  const pattern = `%${escapeLike(query)}%`;
  let request = sb
    .from("search_index")
    .select("entity_type,entity_id,slug,title,subtitle,url,updated_at,search_text")
    .eq("is_published", true)
    .ilike("search_text", pattern)
    .order("updated_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (entityTypes?.length) {
    request = request.in("entity_type", entityTypes);
  }

  const { data, error } = await request;

  if (error) throw error;

  return ((data ?? []) as Omit<SearchRow, "active_code_count">[]).map((row) => ({
    ...row,
    active_code_count: null
  }));
}

async function searchStatsGames(query: string, limit: number, entityTypes: string[] | null): Promise<SearchRow[]> {
  if (entityTypes?.length && !entityTypes.includes("stats_game")) return [];
  const sb = supabaseAdmin();
  const pattern = `%${escapeLike(query)}%`;
  const { data, error } = await sb
    .from("roblox_universes")
    .select("universe_id, slug, name, display_name, creator_name, genre_l1, genre, updated_at, last_stats_refreshed_at, playing")
    .not("slug", "is", null)
    .not("icon_url", "is", null)
    .or(`name.ilike.${pattern},display_name.ilike.${pattern},creator_name.ilike.${pattern}`)
    .order("playing", { ascending: false, nullsFirst: false })
    .limit(Math.min(limit, 30));

  if (error) {
    console.warn("stats game search failed", error.message);
    return [];
  }

  return ((data ?? []) as Array<{
    universe_id: number;
    slug: string | null;
    name: string | null;
    display_name: string | null;
    creator_name: string | null;
    genre_l1: string | null;
    genre: string | null;
    updated_at: string | null;
    last_stats_refreshed_at: string | null;
    playing: number | null;
  }>)
    .filter((row) => row.slug && (row.display_name || row.name))
    .map((row) => ({
      entity_type: "stats_game",
      entity_id: String(row.universe_id),
      slug: row.slug ?? "",
      title: `${row.display_name ?? row.name} Stats`,
      subtitle: [row.creator_name, row.genre_l1 ?? row.genre].filter(Boolean).join(" · ") || "Roblox game stats",
      url: `/stats/games/${row.slug}`,
      updated_at: row.last_stats_refreshed_at ?? row.updated_at,
      active_code_count: null,
      search_text: [row.display_name, row.name, row.creator_name, row.genre_l1, row.genre].filter(Boolean).join(" ")
    }));
}

function rowKey(row: SearchRow): string {
  return `${row.entity_type}:${row.entity_id}`;
}

function rankSearchRow(row: SearchRow, query: string): number {
  const normalizedQuery = query.toLowerCase();
  const title = row.title.toLowerCase();
  const searchable = (row.search_text ?? "").toLowerCase();
  const words = title.split(/[\s()[\]{}:;,.!?'"`~|/\\_+\-=]+/).filter(Boolean);

  if (title === normalizedQuery) return 0;
  if (title.startsWith(normalizedQuery)) return 1;
  if (words.some((word) => word.startsWith(normalizedQuery))) return 2;
  if (title.includes(normalizedQuery)) return 3;
  if (searchable.includes(normalizedQuery)) return 4;

  return 20;
}

function mergeAndRankRows(query: string, rows: SearchRow[], entityTypes: string[] | null): SearchRow[] {
  const merged = new Map<string, SearchRow>();

  for (const row of rows) {
    if (entityTypes?.length && !entityTypes.includes(row.entity_type)) continue;
    const key = rowKey(row);
    const current = merged.get(key);
    if (!current || rankSearchRow(row, query) < rankSearchRow(current, query)) {
      merged.set(key, row);
    }
  }

  return [...merged.values()].sort((a, b) => {
    const rankDelta = rankSearchRow(a, query) - rankSearchRow(b, query);
    if (rankDelta !== 0) return rankDelta;
    return Date.parse(b.updated_at ?? "0") - Date.parse(a.updated_at ?? "0");
  });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawQuery = normalizeQuery(searchParams.get("q"));
    const rawScope = normalizeQuery(searchParams.get("scope")).toLowerCase();
    const entityTypes = rawScope && rawScope !== "global" ? SCOPE_ENTITY_TYPES[rawScope] ?? null : null;
    const requestedLimit = Number.parseInt(searchParams.get("limit") ?? "", 10);
    const safeLimit = clamp(Number.isFinite(requestedLimit) ? requestedLimit : DEFAULT_LIMIT, 1, MAX_LIMIT);

    if (!rawQuery || rawQuery.length < MIN_QUERY_LENGTH) {
      return NextResponse.json({ items: [] });
    }

    const sb = supabaseAdmin();
    const { data, error } = await sb.rpc("search_site", {
      p_query: rawQuery,
      p_limit: entityTypes?.length ? MAX_LIMIT : safeLimit,
      p_offset: 0
    });

    if (error) {
      console.warn("search_site RPC failed, using search_index fallback", error);
    }

    const [substringRows, statsRows] = await Promise.all([
      searchSiteFallback(rawQuery, entityTypes?.length ? MAX_LIMIT : safeLimit, entityTypes),
      searchStatsGames(rawQuery, safeLimit, entityTypes)
    ]);
    const rpcRows = error ? [] : ((data ?? []) as SearchRow[]);
    const rows = mergeAndRankRows(rawQuery, [...substringRows, ...rpcRows, ...statsRows], entityTypes).slice(0, safeLimit);

    const items: SearchItem[] = rows.map((row) => {
      const type = TYPE_MAP[row.entity_type] ?? "article";
      const badge = row.entity_type === "code" && row.active_code_count != null ? `${row.active_code_count} active` : null;
      return {
        id: `${row.entity_type}-${row.entity_id}`,
        title: row.title,
        subtitle: row.subtitle ?? null,
        url: row.url,
        type,
        updatedAt: row.updated_at ?? null,
        badge
      };
    });

    return NextResponse.json({ items });
  } catch (error) {
    console.error("Failed to load search data", error);
    return NextResponse.json({ error: "Failed to load search data" }, { status: 500 });
  }
}

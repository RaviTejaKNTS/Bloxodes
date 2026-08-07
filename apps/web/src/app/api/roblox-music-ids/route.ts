import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { normalizeSearchQuery, normalizeSortKey, type MusicSortKey } from "@/lib/music-ids-search";
import { getMusicGameIdPage, type MusicGameDatasetPreset } from "@/lib/game-specific-id-pages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 24;
const MUSIC_SOURCE_VIEW = "roblox_music_ids_ranked_view";
const SELECT_FIELDS =
  "asset_id, title, artist, album, genre, duration_seconds, album_art_asset_id, thumbnail_url, rank, source, last_seen_at, popularity_score";

type OrderableQuery<T> = {
  order: (...args: any[]) => T;
};

function buildLoosePattern(value: string): string {
  const cleaned = value.replace(/[%_]/g, " ").trim();
  const pattern = cleaned.replace(/[^a-z0-9]+/gi, "%").replace(/%{2,}/g, "%");
  return `%${pattern}%`;
}

function normalizePage(value: string | null): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return Math.floor(parsed);
}

function normalizePreset(value: string | null): MusicGameDatasetPreset | null {
  return value === "short-sounds" || value === "music" ? value : null;
}

function applySort<T extends OrderableQuery<T>>(query: T, sort: MusicSortKey): T {
  switch (sort) {
    case "popular":
      return query
        .order("popularity_score", { ascending: false, nullsFirst: false })
        .order("last_seen_at", { ascending: false, nullsFirst: false });
    case "newest":
      return query.order("last_seen_at", { ascending: false, nullsFirst: false });
    case "duration_desc":
      return query
        .order("duration_seconds", { ascending: false, nullsFirst: false })
        .order("popularity_score", { ascending: false, nullsFirst: false });
    case "duration_asc":
      return query
        .order("duration_seconds", { ascending: true, nullsFirst: false })
        .order("popularity_score", { ascending: false, nullsFirst: false });
    case "title_asc":
      return query.order("title", { ascending: true, nullsFirst: false });
    case "artist_asc":
      return query.order("artist", { ascending: true, nullsFirst: false });
    case "recommended":
    default:
      return query
        .order("popularity_score", { ascending: false, nullsFirst: false })
        .order("last_seen_at", { ascending: false, nullsFirst: false })
        .order("duration_bucket", { ascending: true, nullsFirst: false })
        .order("duration_seconds", { ascending: false, nullsFirst: false })
        .order("rank", { ascending: true, nullsFirst: false });
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = normalizePage(searchParams.get("page"));
  const search = normalizeSearchQuery(searchParams.get("q"));
  const sort = normalizeSortKey(searchParams.get("sort"));
  const game = getMusicGameIdPage(searchParams.get("game") ?? "");
  const preset = normalizePreset(searchParams.get("preset")) ?? game?.datasetPreset ?? null;
  const offset = (page - 1) * PAGE_SIZE;

  const supabase = supabaseAdmin();
  let query = supabase
    .from(game ? "roblox_music_ids_game_view" : MUSIC_SOURCE_VIEW)
    .select(SELECT_FIELDS, { count: "exact" });

  if (game) query = query.eq("game_slug", game.slug);

  // Filter out songs without duration
  if (!game) query = query.not("duration_seconds", "is", null).gt("duration_seconds", 0);

  if (!game && preset === "short-sounds") {
    query = query.lte("duration_seconds", 20);
  } else if (!game && preset === "music") {
    query = query.gte("duration_seconds", 30).lte("duration_seconds", 600);
  }

  if (search) {
    const pattern = buildLoosePattern(search);
    const orParts = [
      `title.ilike.${pattern}`,
      `artist.ilike.${pattern}`,
      `album.ilike.${pattern}`,
      `genre.ilike.${pattern}`
    ];
    if (/^\d+$/.test(search)) {
      orParts.unshift(`asset_id.eq.${search}`);
    }
    query = query.or(orParts.join(","));
  }

  query = game && sort === "recommended"
    ? query.order("game_sort_order", { ascending: true }).order("popularity_score", { ascending: false, nullsFirst: false })
    : applySort(query, sort);

  let { data, error, count } = await query.range(offset, offset + PAGE_SIZE - 1);

  // Keep newly configured game pages usable before their association rows are
  // imported. Once mappings exist, the game view remains the authoritative set.
  if (game && (error || (count ?? data?.length ?? 0) === 0)) {
    let fallback = supabase
      .from(MUSIC_SOURCE_VIEW)
      .select(SELECT_FIELDS, { count: "exact" })
      .not("duration_seconds", "is", null)
      .gt("duration_seconds", 0);
    if (preset === "short-sounds") {
      fallback = fallback.lte("duration_seconds", 20);
    } else if (preset === "music") {
      fallback = fallback.gte("duration_seconds", 30).lte("duration_seconds", 600);
    }
    if (search) {
      const pattern = buildLoosePattern(search);
      const orParts = [
        `title.ilike.${pattern}`,
        `artist.ilike.${pattern}`,
        `album.ilike.${pattern}`,
        `genre.ilike.${pattern}`
      ];
      if (/^\d+$/.test(search)) orParts.unshift(`asset_id.eq.${search}`);
      fallback = fallback.or(orParts.join(","));
    }
    const fallbackResult = await applySort(fallback, sort).range(offset, offset + PAGE_SIZE - 1);
    data = fallbackResult.data;
    error = fallbackResult.error;
    count = fallbackResult.count;
  }

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const total = count ?? data?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return NextResponse.json({
    ok: true,
    songs: data ?? [],
    total,
    totalPages
  });
}

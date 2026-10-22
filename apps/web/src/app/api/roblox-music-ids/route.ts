import { applyMusicSort } from "@/lib/catalog-id-sorts";
import { hasCatalogGameMappings } from "@/lib/catalog-game-source";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { normalizeSearchQuery, normalizeSortKey } from "@/lib/music-ids-search";
import { getMusicGameIdPage, type MusicGameDatasetPreset } from "@/lib/game-specific-id-pages";
import { MUSIC_IDS_PAGE_SIZE } from "@/lib/catalog-page-sizes";
import { catalogRangeTotal } from "@/lib/catalog-pagination";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = MUSIC_IDS_PAGE_SIZE;
const MUSIC_SOURCE_VIEW = "roblox_music_ids_ranked_view";
const SELECT_FIELDS =
  "asset_id, title, artist, album, genre, duration_seconds, album_art_asset_id, thumbnail_url, rank, source, last_seen_at, popularity_score";

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

async function loadResponse(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = normalizePage(searchParams.get("page"));
  const search = normalizeSearchQuery(searchParams.get("q"));
  const sort = normalizeSortKey(searchParams.get("sort"));
  const game = getMusicGameIdPage(searchParams.get("game") ?? "");
  const preset = normalizePreset(searchParams.get("preset")) ?? game?.datasetPreset ?? null;
  const offset = (page - 1) * PAGE_SIZE;

  const mapped = game ? await hasCatalogGameMappings("roblox_music_ids_game_view", game.slug) : false;
  const supabase = supabaseAdmin();
  let query = supabase
    .from(mapped ? "roblox_music_ids_game_view" : MUSIC_SOURCE_VIEW)
    .select(SELECT_FIELDS, { count: "exact" });

  if (mapped && game) query = query.eq("game_slug", game.slug);

  // Filter out songs without duration
  if (!mapped) query = query.not("duration_seconds", "is", null).gt("duration_seconds", 0);

  if (!mapped && preset === "short-sounds") {
    query = query.lte("duration_seconds", 20);
  } else if (!mapped && preset === "music") {
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

  query = applyMusicSort(query, sort, mapped);
  const { data, error, count } = await query.range(offset, offset + PAGE_SIZE - 1);

  const rangeTotal = catalogRangeTotal(error, offset, count);
  if (rangeTotal !== null) {
    return NextResponse.json({ ok: true, songs: [], total: rangeTotal, totalPages: Math.max(1, Math.ceil(rangeTotal / PAGE_SIZE)) });
  }
  if (error) throw error;

  const total = count ?? data?.length ?? 0;
  if (!search && !game && !preset &&
      (total === 0 || (!data?.length && offset < total))) {
    throw new Error("Roblox music catalog unexpectedly empty");
  }
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return NextResponse.json({
    ok: true,
    songs: data ?? [],
    total,
    totalPages
  });
}

export async function GET(request: Request) {
  try {
    return await loadResponse(request);
  } catch (error) {
    console.error("Failed to load Roblox music IDs API", error);
    return NextResponse.json(
      { ok: false, error: "Unable to load music IDs right now." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}

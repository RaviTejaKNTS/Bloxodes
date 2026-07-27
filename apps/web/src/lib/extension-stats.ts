import { normalizeRobloxPlaceId } from "@/lib/extension-codes-utils";
import {
  compactExtensionStatsPoints,
  hasMeaningfulExtensionHistory,
  type ExtensionStatsPoint
} from "@/lib/extension-stats-utils";
import { ensureUniverseForRobloxLink } from "@/lib/roblox/universe";
import { SITE_URL } from "@/lib/site-config";
import { getStatsGameChart, getStatsGameSummaryByUniverseId } from "@/lib/stats";
import { supabaseAdmin } from "@/lib/supabase";

const EXTENSION_STATS_RANGE = "7d" as const;
const EXTENSION_STATS_RESOLUTION = "hourly" as const;

type ExtensionStatsGame = {
  universeId: number;
  name: string;
};

type ExtensionStatsBase = {
  ok: true;
  game: ExtensionStatsGame;
  range: typeof EXTENSION_STATS_RANGE;
  points: ExtensionStatsPoint[];
  lastUpdatedAt: string | null;
  fullStatsUrl: string;
};

export type ExtensionGameStatsPayload =
  | (ExtensionStatsBase & {
      state: "ready";
    })
  | (ExtensionStatsBase & {
      state: "pending";
      reason: "collecting-history";
    })
  | {
      ok: true;
      state: "untracked";
      reason: "not-tracked";
    }
  | {
      ok: true;
      state: "unavailable";
      reason: "not-found";
    };

async function findUniverseIdByRootPlaceId(placeId: number): Promise<number | null> {
  const { data, error } = await supabaseAdmin()
    .from("roblox_universes")
    .select("universe_id")
    .eq("root_place_id", placeId)
    .order("universe_id", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  const universeId = (data as { universe_id?: number | null } | null)?.universe_id;
  return typeof universeId === "number" ? universeId : null;
}

async function discoverUniverse(placeId: number): Promise<number | null> {
  const result = await ensureUniverseForRobloxLink(
    supabaseAdmin(),
    `https://www.roblox.com/games/${placeId}`
  );
  return result.universeId;
}

function fullStatsUrl(slug: string): string {
  return `${SITE_URL.replace(/\/$/, "")}/stats/games/${slug}`;
}

async function buildTrackedPayload(universeId: number): Promise<ExtensionGameStatsPayload> {
  const [game, chart] = await Promise.all([
    getStatsGameSummaryByUniverseId(universeId),
    getStatsGameChart(universeId, EXTENSION_STATS_RANGE, EXTENSION_STATS_RESOLUTION)
  ]);

  if (!game) {
    return {
      ok: true,
      state: "unavailable",
      reason: "not-found"
    };
  }

  const points = compactExtensionStatsPoints(chart.points);
  const lastUpdatedAt =
    points[points.length - 1]?.sampledAt ??
    game.lastPlayingRefreshedAt ??
    game.lastStatsRefreshedAt ??
    null;
  const base: ExtensionStatsBase = {
    ok: true,
    game: {
      universeId: game.universeId,
      name: game.name
    },
    range: EXTENSION_STATS_RANGE,
    points,
    lastUpdatedAt,
    fullStatsUrl: fullStatsUrl(game.slug)
  };

  if (!hasMeaningfulExtensionHistory(points)) {
    return {
      ...base,
      state: "pending",
      reason: "collecting-history"
    };
  }

  return {
    ...base,
    state: "ready"
  };
}

export async function getExtensionGameStats(
  input: string | number | null | undefined,
  options: { discover?: boolean } = {}
): Promise<ExtensionGameStatsPayload> {
  const placeId = normalizeRobloxPlaceId(input);
  if (!placeId) {
    return {
      ok: true,
      state: "unavailable",
      reason: "not-found"
    };
  }

  let universeId = await findUniverseIdByRootPlaceId(placeId);
  if (!universeId && !options.discover) {
    return {
      ok: true,
      state: "untracked",
      reason: "not-tracked"
    };
  }

  if (!universeId) {
    universeId = await discoverUniverse(placeId);
  }
  if (!universeId) {
    return {
      ok: true,
      state: "unavailable",
      reason: "not-found"
    };
  }

  return buildTrackedPayload(universeId);
}

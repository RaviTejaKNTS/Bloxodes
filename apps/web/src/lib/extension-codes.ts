import { unstable_cache } from "next/cache";
import { cleanRewardsText, isCodeNew, sortCodesByFirstSeenDesc } from "@/lib/code-utils";
import type { Code, Game } from "@/lib/db";
import {
  extractPlaceIdFromRobloxUrl,
  normalizeExtensionLimit,
  normalizeGameNameSlug,
  normalizeRobloxGameName,
  normalizeRobloxGameUrl,
  normalizeRobloxPlaceId
} from "@/lib/extension-codes-utils";
import { SITE_URL } from "@/lib/site-config";
import { slugify } from "@/lib/slug";
import { supabaseAdmin } from "@/lib/supabase";

type MatchSource = "place-id" | "roblox-link" | "game-name";

type CodePageRow = Game & {
  codes?: Code[] | null;
  active_code_count?: number | null;
  latest_code_first_seen_at?: string | null;
  content_updated_at?: string | null;
};

export type ExtensionCode = {
  code: string;
  rewardText: string | null;
  isNew: boolean;
  levelRequirement: number | null;
  addedAt: string | null;
};

export type ExtensionCodesPayload =
  | {
      ok: true;
      matched: true;
      source: MatchSource;
      game: {
        name: string;
        slug: string;
        url: string;
        robloxUrl: string | null;
        coverImage: string | null;
      };
      codes: ExtensionCode[];
      totalActive: number;
      shown: number;
      hasMore: boolean;
      lastCheckedAt: string | null;
      fullListUrl: string;
      codesHubUrl: string;
    }
  | {
      ok: true;
      matched: false;
      codes: [];
      totalActive: 0;
      shown: 0;
      hasMore: false;
      codesHubUrl: string;
      reason: "missing-input" | "not-found";
    };

function getCodesHubUrl() {
  return `${SITE_URL.replace(/\/$/, "")}/codes`;
}

function getFullListUrl(slug: string) {
  return `${getCodesHubUrl()}/${slug}`;
}

function getActiveCodes(row: CodePageRow): Code[] {
  const codes = Array.isArray(row.codes) ? row.codes : [];
  return sortCodesByFirstSeenDesc(codes.filter((code) => code.status === "active"));
}

function formatExtensionCode(code: Code, referenceMs: number): ExtensionCode {
  return {
    code: code.code,
    rewardText: cleanRewardsText(code.rewards_text),
    isNew: isCodeNew(code, referenceMs),
    levelRequirement: code.level_requirement,
    addedAt: code.first_seen_at ?? null
  };
}

async function fetchCodePageByUniverseId(universeId: number): Promise<CodePageRow | null> {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("code_pages_view")
    .select("id,name,slug,roblox_link,cover_image,universe_id,updated_at,content_updated_at,codes,active_code_count,latest_code_first_seen_at")
    .eq("is_published", true)
    .eq("universe_id", universeId)
    .maybeSingle();

  if (error) throw error;
  return (data as CodePageRow | null) ?? null;
}

async function fetchUniverseIdByRootPlaceId(placeId: number): Promise<number | null> {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("roblox_universes")
    .select("universe_id")
    .eq("root_place_id", placeId)
    .maybeSingle();

  if (error) throw error;
  const universeId = (data as { universe_id?: number | null } | null)?.universe_id;
  return typeof universeId === "number" ? universeId : null;
}

async function fetchCodePageByRobloxLink(placeId: number): Promise<CodePageRow | null> {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("code_pages_view")
    .select("id,name,slug,roblox_link,cover_image,universe_id,updated_at,content_updated_at,codes,active_code_count,latest_code_first_seen_at")
    .eq("is_published", true)
    .ilike("roblox_link", `%${placeId}%`)
    .limit(1);

  if (error) throw error;
  return ((data ?? [])[0] as CodePageRow | undefined) ?? null;
}

async function fetchCodePageByGameName(gameName: string): Promise<CodePageRow | null> {
  const normalizedName = normalizeRobloxGameName(gameName);
  if (!normalizedName) return null;

  const nameSlug = slugify(normalizedName);
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("code_pages_view")
    .select("id,name,slug,roblox_link,cover_image,universe_id,updated_at,content_updated_at,codes,active_code_count,latest_code_first_seen_at")
    .eq("is_published", true)
    .ilike("name", normalizedName)
    .limit(5);

  if (error) throw error;

  const rows = (data ?? []) as CodePageRow[];
  return (
    rows.find((row) => slugify(row.name) === nameSlug) ??
    rows.find((row) => slugify(row.slug.replace(/-codes$/i, "")) === nameSlug) ??
    rows[0] ??
    null
  );
}

async function resolveCodePage(params: {
  placeId: number | null;
  gameName: string | null;
}): Promise<{ row: CodePageRow; source: MatchSource } | null> {
  if (params.placeId) {
    const universeId = await fetchUniverseIdByRootPlaceId(params.placeId);
    if (universeId) {
      const row = await fetchCodePageByUniverseId(universeId);
      if (row) return { row, source: "place-id" };
    }

    const row = await fetchCodePageByRobloxLink(params.placeId);
    if (row) return { row, source: "roblox-link" };
  }

  if (params.gameName) {
    const row = await fetchCodePageByGameName(params.gameName);
    if (row) return { row, source: "game-name" };
  }

  return null;
}

async function uncachedGetExtensionCodes(params: {
  placeId: number | null;
  robloxUrl: string | null;
  gameName: string | null;
  limit: number;
}): Promise<ExtensionCodesPayload> {
  const codesHubUrl = getCodesHubUrl();
  const placeId = params.placeId ?? extractPlaceIdFromRobloxUrl(params.robloxUrl);
  const gameName = normalizeRobloxGameName(params.gameName);

  if (!placeId && !gameName) {
    return {
      ok: true,
      matched: false,
      codes: [],
      totalActive: 0,
      shown: 0,
      hasMore: false,
      codesHubUrl,
      reason: "missing-input"
    };
  }

  const resolved = await resolveCodePage({ placeId, gameName });
  if (!resolved) {
    return {
      ok: true,
      matched: false,
      codes: [],
      totalActive: 0,
      shown: 0,
      hasMore: false,
      codesHubUrl,
      reason: "not-found"
    };
  }

  const activeCodes = getActiveCodes(resolved.row);
  const nowMs = Date.now();
  const codes = activeCodes.slice(0, params.limit).map((code) => formatExtensionCode(code, nowMs));
  const totalActive = activeCodes.length || Number(resolved.row.active_code_count ?? 0);
  const fullListUrl = getFullListUrl(resolved.row.slug);

  return {
    ok: true,
    matched: true,
    source: resolved.source,
    game: {
      name: resolved.row.name,
      slug: resolved.row.slug,
      url: fullListUrl,
      robloxUrl: resolved.row.roblox_link ?? params.robloxUrl,
      coverImage: resolved.row.cover_image
    },
    codes,
    totalActive,
    shown: codes.length,
    hasMore: totalActive > codes.length,
    lastCheckedAt: activeCodes.reduce<string | null>((latest, code) => {
      if (!latest) return code.last_seen_at;
      return latest > code.last_seen_at ? latest : code.last_seen_at;
    }, resolved.row.content_updated_at ?? resolved.row.updated_at ?? null),
    fullListUrl,
    codesHubUrl
  };
}

export async function getExtensionCodes(params: {
  placeId?: string | number | null;
  robloxUrl?: string | null;
  gameName?: string | null;
  limit?: string | number | null;
}): Promise<ExtensionCodesPayload> {
  const placeId = normalizeRobloxPlaceId(params.placeId) ?? extractPlaceIdFromRobloxUrl(params.robloxUrl);
  const robloxUrl = normalizeRobloxGameUrl(params.robloxUrl);
  const gameName = normalizeRobloxGameName(params.gameName);
  const limit = normalizeExtensionLimit(params.limit);

  const cached = unstable_cache(
    () => uncachedGetExtensionCodes({ placeId, robloxUrl, gameName, limit }),
    [`extension-codes:${placeId ?? "none"}:${normalizeGameNameSlug(gameName)}:${limit}`],
    {
      revalidate: 300,
      tags: ["codes-index", "extension-codes"]
    }
  );

  return cached();
}

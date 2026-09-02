import type { SupabaseClient } from "@supabase/supabase-js";

const GAME_ICONS_API = "https://thumbnails.roblox.com/v1/games/icons";
const GAME_THUMBNAILS_API = "https://thumbnails.roblox.com/v1/games/multiget/thumbnails";
const USER_AGENT = "BloxodesUniverseMedia/1.0 (+https://bloxodes.com; contact@bloxodes.com)";

type RobloxIconPayload = {
  data?: Array<{
    targetId?: number;
    universeId?: number;
    state?: string;
    imageUrl?: string;
    [key: string]: unknown;
  }>;
};

type RobloxThumbnailPayload = {
  data?: Array<{
    universeId?: number;
    thumbnails?: Array<{
      state?: string;
      imageUrl?: string;
      thumbnailType?: string;
      [key: string]: unknown;
    }>;
  }>;
};

export type OfficialUniverseThumbnail = {
  url: string;
  state: string | null;
  type: string | null;
  raw?: Record<string, unknown>;
};

export type OfficialUniverseMedia = {
  iconUrl: string;
  iconRaw?: Record<string, unknown>;
  thumbnails: OfficialUniverseThumbnail[];
};

export type EnsureOfficialUniverseMediaResult = {
  status: "existing" | "fetched" | "stored" | "unavailable";
  media: OfficialUniverseMedia | null;
  error: string | null;
};

function normalizeUrl(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function isOfficialRobloxImageUrl(value: unknown): value is string {
  const url = normalizeUrl(value);
  if (!url) return false;
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname === "rbxcdn.com" || hostname.endsWith(".rbxcdn.com");
  } catch {
    return false;
  }
}

function isOfficialRobloxRoleImageUrl(value: unknown, width: number, height: number): value is string {
  if (!isOfficialRobloxImageUrl(value)) return false;
  return new URL(value).pathname.includes(`/${width}/${height}/`);
}

function isCompletedThumbnailState(value: unknown): boolean {
  return typeof value !== "string" || value.trim().toLowerCase() === "completed";
}

export function normalizeOfficialUniverseThumbnails(value: unknown): OfficialUniverseThumbnail[] {
  if (!Array.isArray(value)) return [];
  const normalized: OfficialUniverseThumbnail[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    const record = typeof entry === "string" ? { url: entry } : entry;
    if (!record || typeof record !== "object") continue;
    const fields = record as Record<string, unknown>;
    const url = normalizeUrl(fields.url ?? fields.imageUrl ?? fields.image_url);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    normalized.push({
      url,
      state: typeof fields.state === "string" ? fields.state : null,
      type:
        typeof fields.type === "string"
          ? fields.type
          : typeof fields.thumbnailType === "string"
            ? fields.thumbnailType
            : null
    });
  }
  return normalized;
}

export function hasOfficialUniverseMedia(value: { icon_url?: unknown; thumbnail_urls?: unknown }): boolean {
  return (
    isOfficialRobloxRoleImageUrl(value.icon_url, 512, 512) &&
    normalizeOfficialUniverseThumbnails(value.thumbnail_urls).some((thumbnail) =>
      isOfficialRobloxRoleImageUrl(thumbnail.url, 768, 432)
    )
  );
}

export function selectOfficialUniverseMedia(
  universeId: number,
  iconPayload: RobloxIconPayload,
  thumbnailPayload: RobloxThumbnailPayload
): OfficialUniverseMedia | null {
  const iconEntry = (iconPayload.data ?? []).find((entry) => {
    const targetId = entry.universeId ?? entry.targetId;
    return (
      targetId === universeId &&
      isCompletedThumbnailState(entry.state) &&
      isOfficialRobloxRoleImageUrl(entry.imageUrl, 512, 512)
    );
  });
  const iconUrl = normalizeUrl(iconEntry?.imageUrl);
  const thumbnailEntry = (thumbnailPayload.data ?? []).find((entry) => entry.universeId === universeId);
  const thumbnails = normalizeOfficialUniverseThumbnails(
    (thumbnailEntry?.thumbnails ?? []).map((entry) => ({
      url: entry.imageUrl,
      state: entry.state ?? null,
      type: entry.thumbnailType ?? null
    }))
  ).filter(
    (thumbnail) =>
      isCompletedThumbnailState(thumbnail.state) && isOfficialRobloxRoleImageUrl(thumbnail.url, 768, 432)
  );

  if (!iconUrl || !thumbnails.length) return null;
  return {
    iconUrl,
    iconRaw: iconEntry as Record<string, unknown>,
    thumbnails
  };
}

async function fetchJson(url: string, fetchImpl: typeof fetch): Promise<unknown> {
  const response = await fetchImpl(url, {
    headers: {
      accept: "application/json",
      "user-agent": USER_AGENT
    }
  });
  if (!response.ok) throw new Error(`Roblox thumbnails request failed (${response.status}).`);
  return response.json();
}

export async function fetchOfficialUniverseMedia(
  universeId: number,
  fetchImpl: typeof fetch = fetch
): Promise<OfficialUniverseMedia | null> {
  if (!Number.isSafeInteger(universeId) || universeId <= 0) {
    throw new Error(`Invalid Roblox universe ID: ${universeId}`);
  }
  const iconParams = new URLSearchParams({
    universeIds: String(universeId),
    size: "512x512",
    format: "Png",
    isCircular: "false"
  });
  const thumbnailParams = new URLSearchParams({
    universeIds: String(universeId),
    size: "768x432",
    format: "Png"
  });
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const [iconPayload, thumbnailPayload] = await Promise.all([
        fetchJson(`${GAME_ICONS_API}?${iconParams}`, fetchImpl),
        fetchJson(`${GAME_THUMBNAILS_API}?${thumbnailParams}`, fetchImpl)
      ]);
      const selected = selectOfficialUniverseMedia(
        universeId,
        iconPayload as RobloxIconPayload,
        thumbnailPayload as RobloxThumbnailPayload
      );
      if (selected) return selected;
    } catch (error) {
      lastError = error;
    }
    if (attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, 750 * 2 ** attempt));
    }
  }
  if (lastError) throw lastError;
  return null;
}

export async function persistOfficialUniverseMedia(
  supabase: SupabaseClient,
  universeId: number,
  media: OfficialUniverseMedia
): Promise<void> {
  const fetchedAt = new Date().toISOString();
  const thumbnailUrls = media.thumbnails.map(({ url, state, type }) => ({ url, state, type }));
  const { error: universeError } = await supabase
    .from("roblox_universes")
    .update({ icon_url: media.iconUrl, thumbnail_urls: thumbnailUrls })
    .eq("universe_id", universeId);
  if (universeError) throw new Error(`Universe media fields update failed: ${universeError.message}`);

  const desiredRows = [
    {
      universe_id: universeId,
      media_type: "icon" as const,
      image_url: media.iconUrl,
      is_primary: true,
      approved: true,
      extra: media.iconRaw ?? {},
      source: "roblox_thumbnails",
      first_seen_at: fetchedAt,
      last_seen_at: fetchedAt,
      fetched_at: fetchedAt
    },
    ...media.thumbnails.map((thumbnail, index) => ({
      universe_id: universeId,
      media_type: "screenshot" as const,
      image_url: thumbnail.url,
      is_primary: index === 0,
      approved: true,
      extra: {
        state: thumbnail.state,
        type: thumbnail.type,
        ...(thumbnail.raw ?? {})
      },
      source: "roblox_thumbnails",
      first_seen_at: fetchedAt,
      last_seen_at: fetchedAt,
      fetched_at: fetchedAt
    }))
  ];

  const { error: primaryError } = await supabase
    .from("roblox_universe_media")
    .update({ is_primary: false })
    .eq("universe_id", universeId)
    .in("media_type", ["icon", "screenshot"])
    .eq("is_primary", true);
  if (primaryError) throw new Error(`Universe media primary reset failed: ${primaryError.message}`);

  const { data: existingRows, error: existingError } = await supabase
    .from("roblox_universe_media")
    .select("media_type,image_url")
    .eq("universe_id", universeId)
    .in("media_type", ["icon", "screenshot"])
    .not("image_url", "is", null);
  if (existingError) throw new Error(`Universe media history read failed: ${existingError.message}`);
  const existingKeys = new Set(
    (existingRows ?? []).map((row) => `${row.media_type}:${row.image_url}`)
  );
  const newRows = desiredRows.filter((row) => !existingKeys.has(`${row.media_type}:${row.image_url}`));
  if (newRows.length) {
    const { error } = await supabase.from("roblox_universe_media").insert(newRows);
    if (error) throw new Error(`Universe media history insert failed: ${error.message}`);
  }
  for (const row of desiredRows.filter((entry) => existingKeys.has(`${entry.media_type}:${entry.image_url}`))) {
    const { error } = await supabase
      .from("roblox_universe_media")
      .update({
        is_primary: row.is_primary,
        approved: true,
        extra: row.extra,
        source: row.source,
        last_seen_at: fetchedAt,
        fetched_at: fetchedAt
      })
      .eq("universe_id", universeId)
      .eq("media_type", row.media_type)
      .eq("image_url", row.image_url);
    if (error) throw new Error(`Universe media history update failed: ${error.message}`);
  }
}

export async function ensureOfficialUniverseMedia(
  supabase: SupabaseClient,
  universeId: number,
  options: { apply?: boolean; force?: boolean; required?: boolean; fetchImpl?: typeof fetch } = {}
): Promise<EnsureOfficialUniverseMediaResult> {
  const { data: existing, error: readError } = await supabase
    .from("roblox_universes")
    .select("icon_url,thumbnail_urls")
    .eq("universe_id", universeId)
    .maybeSingle();
  if (readError) throw new Error(`Universe media readiness read failed: ${readError.message}`);
  if (!existing) throw new Error(`Universe ${universeId} is missing.`);

  if (!options.force && hasOfficialUniverseMedia(existing)) {
    return {
      status: "existing",
      media: {
        iconUrl: existing.icon_url as string,
        thumbnails: normalizeOfficialUniverseThumbnails(existing.thumbnail_urls)
      },
      error: null
    };
  }

  try {
    const media = await fetchOfficialUniverseMedia(universeId, options.fetchImpl);
    if (!media) {
      const message = `Roblox returned no completed square icon and landscape thumbnail for universe ${universeId}.`;
      if (options.required) throw new Error(message);
      return { status: "unavailable", media: null, error: message };
    }
    if (options.apply !== false) {
      await persistOfficialUniverseMedia(supabase, universeId, media);
      return { status: "stored", media, error: null };
    }
    return { status: "fetched", media, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (options.required) throw error;
    return { status: "unavailable", media: null, error: message };
  }
}

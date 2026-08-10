import { publicContentCache } from "@/lib/public-content-cache";
import { supabaseAdmin } from "@/lib/supabase";
import { getFreeItemsCount } from "@/lib/db";
import {
  getAvatarCatalogCount,
  resolveAvatarCatalogTopLevelConfig
} from "@/lib/roblox-avatar-catalog";

/** Icon hint for a catalog card; the card maps this to a concrete icon. */
export type CatalogIconKey =
  | "music"
  | "gift"
  | "package"
  | "shirt"
  | "image"
  | "palette"
  | "terminal"
  | "type"
  | "smile"
  | "sparkles"
  | "wrench";

export type CatalogCardMeta = {
  /** Clean, short display name for the card (full title still used on the page). */
  shortLabel: string | null;
  /** Live item count when a source is wired, else null. */
  count: number | null;
  /** Plural noun shown next to the count, e.g. "song IDs". */
  unit: string | null;
  icon: CatalogIconKey | null;
};

type CountSource =
  | { kind: "avatar"; code: string }
  | { kind: "free" }
  | { kind: "music" }
  | { kind: "decal" }
  | { kind: "font" }
  | { kind: "mesh" }
  | { kind: "promo" }
  | null;

type CatalogConfig = {
  shortLabel: string;
  unit: string;
  icon: CatalogIconKey;
  source: CountSource;
};

const CATALOG_CONFIG: Record<string, CatalogConfig> = {
  "roblox-music-ids": { shortLabel: "Roblox Music IDs", unit: "song IDs", icon: "music", source: { kind: "music" } },
  "roblox-items-and-bundles": {
    shortLabel: "Items & Bundles",
    unit: "marketplace items",
    icon: "package",
    source: { kind: "avatar", code: "roblox-items-and-bundles" }
  },
  "roblox-avatar-items": {
    shortLabel: "Avatar Items",
    unit: "marketplace items",
    icon: "package",
    source: { kind: "avatar", code: "roblox-avatar-items" }
  },
  "free-roblox-items": {
    shortLabel: "Free Items",
    unit: "free items",
    icon: "gift",
    source: { kind: "free" }
  },
  "roblox-free-items": {
    shortLabel: "Free Items",
    unit: "free items",
    icon: "gift",
    source: { kind: "free" }
  },
  "roblox-accessories": {
    shortLabel: "Accessories",
    unit: "accessories",
    icon: "package",
    source: { kind: "avatar", code: "roblox-accessories" }
  },
  "roblox-clothing": {
    shortLabel: "Clothing",
    unit: "clothing items",
    icon: "shirt",
    source: { kind: "avatar", code: "roblox-clothing" }
  },
  "roblox-body-parts": {
    shortLabel: "Body Parts",
    unit: "body parts",
    icon: "package",
    source: { kind: "avatar", code: "roblox-body-parts" }
  },
  "roblox-emotes": {
    shortLabel: "Emotes",
    unit: "emotes",
    icon: "smile",
    source: { kind: "avatar", code: "roblox-emotes" }
  },
  "roblox-animations": {
    shortLabel: "Animations",
    unit: "animations",
    icon: "sparkles",
    source: { kind: "avatar", code: "roblox-animations" }
  },
  "roblox-makeup": {
    shortLabel: "Makeup",
    unit: "makeup items",
    icon: "palette",
    source: { kind: "avatar", code: "roblox-makeup" }
  },
  "roblox-color-codes": { shortLabel: "Color Codes", unit: "color codes", icon: "palette", source: null },
  "roblox-errors-and-fixes": { shortLabel: "Errors & Fixes", unit: "errors", icon: "wrench", source: null },
  "roblox-promo-codes": {
    shortLabel: "Promo Codes & Rewards",
    unit: "rewards",
    icon: "gift",
    source: { kind: "promo" }
  },
  "roblox-decal-ids": { shortLabel: "Decal IDs", unit: "decal IDs", icon: "image", source: { kind: "decal" } },
  "roblox-font-ids": { shortLabel: "Font IDs", unit: "font families", icon: "type", source: { kind: "font" } },
  "roblox-mesh-ids": { shortLabel: "Mesh IDs", unit: "MeshPart assets", icon: "package", source: { kind: "mesh" } },
  "admin-commands": { shortLabel: "Admin Commands", unit: "commands", icon: "terminal", source: null }
};

const countMusicIds = publicContentCache(
  async (): Promise<number | null> => {
    const sb = supabaseAdmin();
    const { count, error } = await sb
      .from("roblox_music_ids_ranked_view")
      .select("asset_id", { count: "exact", head: true })
      .not("duration_seconds", "is", null)
      .gt("duration_seconds", 0);
    if (error) throw error;
    return count ?? null;
  },
  ["catalogCardMeta:musicIdsCount:v2"],
  { revalidate: 3600, tags: ["catalog-index", "music-ids"] }
);

const countDecalIds = publicContentCache(
  async (): Promise<number | null> => {
    const sb = supabaseAdmin();
    const { count, error } = await sb
      .from("roblox_decal_ids")
      .select("asset_id", { count: "exact", head: true })
      .eq("status", "active")
      .eq("thumbnail_state", "Completed")
      .not("thumbnail_url", "is", null)
      .not("thumbnail_url", "ilike", "%/UnknownImage/%");
    if (error) throw error;
    return count ?? null;
  },
  ["catalogCardMeta:decalIdsCount:v2"],
  { revalidate: 3600, tags: ["catalog-index", "decal-ids"] }
);

const countMeshIds = publicContentCache(
  async (): Promise<number | null> => {
    const sb = supabaseAdmin();
    const { count, error } = await sb
      .from("roblox_mesh_ids")
      .select("asset_id", { count: "exact", head: true })
      .eq("status", "active")
      .eq("thumbnail_state", "Completed")
      .not("thumbnail_url", "is", null);
    if (error) throw error;
    return count ?? null;
  },
  ["catalogCardMeta:meshIdsCount:v1"],
  { revalidate: 3600, tags: ["catalog-index", "catalog:roblox-mesh-ids"] }
);

const countFontIds = publicContentCache(
  async (): Promise<number | null> => {
    const sb = supabaseAdmin();
    const { count, error } = await sb
      .from("roblox_font_ids")
      .select("asset_id", { count: "exact", head: true })
      .eq("status", "active")
      .eq("thumbnail_state", "Completed")
      .not("thumbnail_url", "is", null);
    if (error) throw error;
    return count ?? null;
  },
  ["catalogCardMeta:fontIdsCount:v1"],
  { revalidate: 3600, tags: ["catalog-index", "catalog:roblox-font-ids"] }
);

const countPromoRewards = publicContentCache(
  async (): Promise<number | null> => {
    const sb = supabaseAdmin();
    const { count, error } = await sb
      .from("roblox_promo_rewards")
      .select("id", { count: "exact", head: true })
      .in("status", ["source_listed_unverified", "verified_claimable", "unavailable", "expired"])
      .or("status.in.(verified_claimable,unavailable,expired),claim_type.eq.experience_code");
    if (error) throw error;
    return count ?? null;
  },
  ["catalogCardMeta:promoRewardsCount:v2"],
  { revalidate: 3600, tags: ["catalog-index", "catalog:roblox-promo-codes"] }
);

async function resolveCount(source: CountSource): Promise<number | null> {
  if (!source) return null;
  try {
    if (source.kind === "music") {
      return await countMusicIds();
    }
    if (source.kind === "decal") {
      return await countDecalIds();
    }
    if (source.kind === "mesh") {
      return await countMeshIds();
    }
    if (source.kind === "font") {
      return await countFontIds();
    }
    if (source.kind === "free") {
      return await getFreeItemsCount();
    }
    if (source.kind === "promo") {
      return await countPromoRewards();
    }
    const config = resolveAvatarCatalogTopLevelConfig(source.code);
    if (!config) return null;
    return await getAvatarCatalogCount(config);
  } catch (error) {
    console.error("Error resolving catalog card count", error);
    return null;
  }
}

export async function resolveCatalogCardMeta(code: string): Promise<CatalogCardMeta> {
  const config = CATALOG_CONFIG[code];
  if (!config) {
    return { shortLabel: null, count: null, unit: null, icon: null };
  }
  const count = await resolveCount(config.source);
  return { shortLabel: config.shortLabel, count, unit: config.unit, icon: config.icon };
}

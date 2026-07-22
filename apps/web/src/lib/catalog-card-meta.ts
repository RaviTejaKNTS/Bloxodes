import { publicContentCache } from "@/lib/public-content-cache";
import { supabaseAdmin } from "@/lib/supabase";
import {
  getAvatarCatalogCount,
  resolveAvatarCatalogTopLevelConfig,
  type AvatarCatalogResolvedSearch,
  type AvatarCatalogSaleFilter
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
  | { kind: "avatar"; code: string; sale?: AvatarCatalogSaleFilter }
  | { kind: "music" }
  | { kind: "decal" }
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
    source: { kind: "avatar", code: "roblox-items-and-bundles", sale: "free" }
  },
  "roblox-free-items": {
    shortLabel: "Free Items",
    unit: "free items",
    icon: "gift",
    source: { kind: "avatar", code: "roblox-items-and-bundles", sale: "free" }
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
  "roblox-decal-ids": { shortLabel: "Decal IDs", unit: "decal IDs", icon: "image", source: { kind: "decal" } },
  "admin-commands": { shortLabel: "Admin Commands", unit: "commands", icon: "terminal", source: null }
};

const countMusicIds = publicContentCache(
  async (): Promise<number | null> => {
    const sb = supabaseAdmin();
    const { count, error } = await sb
      .from("roblox_music_ids_ranked_view")
      .select("asset_id", { count: "exact", head: true });
    if (error) throw error;
    return count ?? null;
  },
  ["catalogCardMeta:musicIdsCount"],
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
      .not("thumbnail_url", "is", null);
    if (error) throw error;
    return count ?? null;
  },
  ["catalogCardMeta:decalIdsCount"],
  { revalidate: 3600, tags: ["catalog-index", "decal-ids"] }
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
    const config = resolveAvatarCatalogTopLevelConfig(source.code);
    if (!config) return null;
    const filters: AvatarCatalogResolvedSearch = {
      search: "",
      sort: "featured",
      sale: source.sale ?? "all",
      creator: "all"
    };
    return await getAvatarCatalogCount(config, filters);
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

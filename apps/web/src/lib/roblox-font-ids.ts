import { publicContentCache } from "@/lib/public-content-cache";
import { supabaseAdmin } from "@/lib/supabase";

export type RobloxFontFace = {
  name: string;
  weight: number;
  style: string;
  assetId: number;
};

export type RobloxFontId = {
  asset_id: number;
  name: string;
  native_styles: string[];
  faces: RobloxFontFace[];
  designer: string | null;
  font_version: string | null;
  license_name: string | null;
  license_url: string | null;
  creator_name: string | null;
  creator_verified: boolean | null;
  vote_count: number | null;
  upvote_percent: number | null;
  thumbnail_url: string | null;
  creator_store_url: string;
  roblox_updated_at: string | null;
  verified_at: string | null;
};

const FONT_SELECT_FIELDS =
  "asset_id, name, native_styles, faces, designer, font_version, license_name, license_url, creator_name, creator_verified, vote_count, upvote_percent, thumbnail_url, creator_store_url, roblox_updated_at, verified_at";

const loadCachedRobloxFontIds = publicContentCache(
  async (): Promise<RobloxFontId[]> => {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("roblox_font_ids")
      .select(FONT_SELECT_FIELDS)
      .eq("status", "active")
      .eq("thumbnail_state", "Completed")
      .not("thumbnail_url", "is", null)
      .order("vote_count", { ascending: false, nullsFirst: false })
      .order("name", { ascending: true });

    if (error) {
      console.error("Failed to load Roblox font IDs", error);
      return [];
    }
    return (data ?? []) as RobloxFontId[];
  },
  ["catalog:roblox-font-ids:items"],
  {
    revalidate: 86400,
    tags: ["catalog-index", "catalog:roblox-font-ids"]
  }
);

export async function listRobloxFontIds(): Promise<RobloxFontId[]> {
  return loadCachedRobloxFontIds();
}

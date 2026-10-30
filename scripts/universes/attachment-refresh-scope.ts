import type { supabaseAdmin } from "@/lib/supabase-admin";

export const ATTACHMENT_HOT_CAP = 100;
export const ATTACHMENT_REQUEST_CAP = 400;

// Published wiki hubs retain priority and are never dropped to fit the HOT cap.
// HOT games use the existing (stats_tier, playing DESC) universe index.
export async function listHotAttachmentUniverseIds(db: ReturnType<typeof supabaseAdmin>) {
  const { data, error } = await db.from("roblox_universes").select("universe_id")
    .eq("stats_tier", "HOT").order("playing", { ascending: false, nullsFirst: false })
    .order("universe_id").limit(ATTACHMENT_HOT_CAP);
  if (error) throw error;
  return (data ?? []).map(row => Number(row.universe_id)).filter(id => Number.isSafeInteger(id) && id > 0);
}

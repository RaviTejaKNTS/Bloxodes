import type { SupabaseClient } from "@supabase/supabase-js";

const MIN_UPDATE_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Moves a catalog page's visible "Updated on" date (`catalog_pages.updated_at`) to `now`,
 * but only when the current date is at least seven days old. Callers decide whether the
 * page's real content changed; this only rate-limits the date so it never moves daily.
 */
export async function touchCatalogPageTimestamp(
  client: SupabaseClient,
  code: string,
  now = new Date()
): Promise<boolean> {
  // Apply the age condition in the write so concurrent jobs cannot both bump it.
  const cutoff = new Date(now.getTime() - MIN_UPDATE_INTERVAL_MS).toISOString();
  const { data, error } = await client
    .from("catalog_pages")
    .update({ updated_at: now.toISOString() })
    .eq("code", code)
    .lte("updated_at", cutoff)
    .select("code");
  if (error) throw new Error(`Failed to update ${code} catalog timestamp: ${error.message}`);
  return Boolean(data?.length);
}

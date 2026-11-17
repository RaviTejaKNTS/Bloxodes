import type { SupabaseClient } from "@supabase/supabase-js";
import { readPublishQuery } from "./publish-network.mjs";

// Read before any writes. R2 object existence does not prove an image was live.
export async function newCollectionImageKeys(db: SupabaseClient, family: "wiki" | "game", code: string, contentHash: string, items: readonly { image_key: string | null }[], namespace?: string) {
  const keys = [...new Set(items.flatMap(item => item.image_key ? [item.image_key] : []))];
  const prefix = `${family}_collection`;
  if (family === "game" && !namespace) throw new Error("Game collection image baseline requires a namespace.");
  const page = await readPublishQuery(() => {
    const query = db.from(`${prefix}_pages`).select("id,is_published,published_dataset_id").eq("code", code);
    return (family === "game" ? query.eq("namespace", namespace!) : query).maybeSingle();
  });
  if (page.error) throw page.error;
  if (!page.data?.is_published || !page.data.published_dataset_id) return keys;
  const current = await readPublishQuery(() => db.from(`${prefix}_datasets`).select("id,content_hash,created_at").eq("id", page.data!.published_dataset_id).single());
  if (current.error) throw current.error;
  let baselineId = current.data.id;
  if (current.data.content_hash === contentHash) {
    // The last attempt may have published the row but failed its live checks.
    // Reconstruct the same delta from the preceding immutable revision.
    const previous = await readPublishQuery(() => db.from(`${prefix}_datasets`).select("id").eq("collection_page_id", page.data!.id)
      .lt("created_at", current.data.created_at).order("created_at", { ascending: false }).limit(1).maybeSingle());
    if (previous.error) throw previous.error;
    if (!previous.data) return keys;
    baselineId = previous.data.id;
  }
  const baseline = new Set<string>();
  for (let offset = 0; ; offset += 500) {
    const rows = await readPublishQuery(() => db.from(`${prefix}_items`).select("image_key").eq("dataset_id", baselineId).order("item_slug").range(offset, offset + 499));
    if (rows.error) throw rows.error;
    for (const row of rows.data ?? []) if (row.image_key) baseline.add(row.image_key);
    if ((rows.data?.length ?? 0) < 500) break;
  }
  return keys.filter(key => !baseline.has(key));
}

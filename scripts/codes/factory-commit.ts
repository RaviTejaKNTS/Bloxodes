import type { SupabaseClient } from "@supabase/supabase-js";

export async function commitFactoryPage(sb: SupabaseClient, pageId: string, payload: Record<string, unknown>,
  factory: { universeId: number; fingerprint: string; linkedIds: string[] },
  resolvedUniverseId: number | null, codesSynced: boolean, prepareCover: () => Promise<string | void>) {
  if (resolvedUniverseId !== factory.universeId || !codesSynced) {
    throw new Error("Factory preparation failed: universe did not resolve or source refresh failed");
  }
  const cover = await prepareCover();
  const result = await sb.rpc("publish_factory_code_page", {
    p_page_id: pageId, p_payload: { ...payload, ...(cover ? { cover_image: cover } : {}) },
    p_bundle_hash: factory.fingerprint, p_linked_ids: [...new Set(factory.linkedIds)]
  });
  if (result.error) throw new Error(`Failed to publish page: ${result.error.message}`);
}

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CodePageFinal } from "./final-contract";

// Only database publication fields; writer-only keys never reach the RPC.
export function factoryPublicationPayload(final: Omit<CodePageFinal, "game_display_name">) {
  return {
    name: final.name, slug: final.slug, universe_id: final.universe_id,
    roblox_link: final.roblox_link, source_url: final.source_url, source_url_2: final.source_url_2,
    intro_md: final.intro_md, redeem_md: final.redeem_md, troubleshoot_md: final.troubleshoot_md,
    rewards_md: final.rewards_md, find_codes_md: final.find_codes_md,
    seo_description: final.meta_description, interlinking_ai_copy_md: final.interlinking_copy_md
  };
}

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

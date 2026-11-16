import "server-only";
import { requestCache } from "@/lib/request-cache";
import { supabaseAdmin } from "./supabase";
import type { SeoCode } from "./code-page-seo";

export const loadGameCodeSeoData = requestCache(async (pageId: string, namespace: string, gameId: string) => {
  const client = supabaseAdmin();
  const [codeResult, gameResult] = await Promise.all([
    client.from("game_codes").select("code,rewards_text,status,first_seen_at,last_seen_at,verified_at").eq("code_page_id", pageId).order("verified_at", { ascending: false, nullsFirst: false }),
    client.from("games").select("title").eq("namespace", namespace).eq("id", gameId).eq("is_published", true).single()
  ]);
  if (codeResult.error) throw new Error(`Game codes read failed: ${codeResult.error.message}`);
  if (gameResult.error) throw new Error(`Game codes identity read failed: ${gameResult.error.message}`);
  return { codes: (codeResult.data ?? []) as SeoCode[], name: gameResult.data.title as string };
});

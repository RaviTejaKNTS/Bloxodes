import "server-only";
import { cache } from "react";
import { supabaseAdmin } from "./supabase";
import type { GameCodePage } from "./game-registry";
import { codePageDescription, type SeoCode } from "./code-page-seo";

export const loadGameCodeSeoData = cache(async (pageId: string, namespace: string, gameId: string) => {
  const client = supabaseAdmin();
  const [codeResult, gameResult] = await Promise.all([
    client.from("game_codes").select("code,rewards_text,status,first_seen_at,last_seen_at").eq("code_page_id", pageId).order("verified_at", { ascending: false, nullsFirst: false }),
    client.from("games").select("title").eq("namespace", namespace).eq("id", gameId).eq("is_published", true).single()
  ]);
  if (codeResult.error) throw new Error(`Game codes read failed: ${codeResult.error.message}`);
  if (gameResult.error) throw new Error(`Game codes identity read failed: ${gameResult.error.message}`);
  return { codes: (codeResult.data ?? []) as SeoCode[], name: gameResult.data.title as string };
});

export function gameCodeDescription(page: GameCodePage, data: Awaited<ReturnType<typeof loadGameCodeSeoData>>) {
  // This template shows the page's updated timestamp, rather than a last-check label.
  return codePageDescription({ name: data.name, codes: data.codes, lastChecked: page.updated_at });
}

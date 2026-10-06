import "server-only";
import { cache } from "react";
import { supabaseAdmin } from "./supabase";
import type { SharedGameGame, SharedGameWikiPage, SharedGameWikiCollectionPage } from "./shared-game-reader";
import type { ToolContent } from "./tools";

export const getGameRoot = cache(async (namespace: string): Promise<SharedGameGame | null> => {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(namespace) || namespace === "roblox") return null;
  const { data, error } = await supabaseAdmin().from("games").select("*").eq("namespace", namespace).is("parent_id", null).eq("is_published", true).maybeSingle();
  if (error) throw new Error(`Game registry read failed: ${error.message}`);
  return data as SharedGameGame | null;
});
export const getGameWikiByPath = cache(async (namespace: string, path: string): Promise<SharedGameWikiPage | null> => {
  if (!(await getGameRoot(namespace))) return null;
  const { data, error } = await supabaseAdmin().from("game_wiki_pages_view").select("*").eq("namespace", namespace).eq("canonical_path", path).eq("is_published", true).maybeSingle();
  if (error) throw new Error(`Game wiki read failed: ${error.message}`);
  return data as SharedGameWikiPage | null;
});
export const getGameCollectionByPath = cache(async (namespace: string, path: string): Promise<SharedGameWikiCollectionPage | null> => {
  if (!(await getGameRoot(namespace))) return null;
  const { data, error } = await supabaseAdmin().from("game_collection_pages_view").select("*").eq("namespace", namespace).eq("canonical_path", path).eq("is_published", true).maybeSingle();
  if (error) throw new Error(`Game collection read failed: ${error.message}`);
  return data as SharedGameWikiCollectionPage | null;
});
export type GameToolPage = ToolContent & { id: string; namespace: string; canonical_path: string; tool_key: string; rules_json: Record<string, unknown> };
export const getGameToolByPath = cache(async (namespace: string, path: string): Promise<GameToolPage | null> => {
  if (!(await getGameRoot(namespace))) return null;
  const { data, error } = await supabaseAdmin().from("game_tool_pages_view").select("*").eq("namespace", namespace).eq("canonical_path", path).eq("is_published", true).maybeSingle();
  if (error) throw new Error(`Game tool read failed: ${error.message}`);
  return data as GameToolPage | null;
});
export type GameCodePage = { id: string; namespace: string; game_id: string; canonical_path: string; title: string; seo_title: string | null; meta_description: string | null; intro_md: string | null; redeem_md: string | null; rewards_md: string | null; troubleshoot_md: string | null; find_codes_md: string | null; faq_json: Array<{q:string;a:string}> | null; updated_at: string | null; published_at: string | null };
export const getGameCodeByPath = cache(async (namespace: string, path: string): Promise<GameCodePage | null> => {
  if (!(await getGameRoot(namespace))) return null;
  const { data, error } = await supabaseAdmin().from("game_code_pages_view").select("*").eq("namespace", namespace).eq("canonical_path", path).eq("is_published", true).maybeSingle();
  if (error) throw new Error(`Game codes page read failed: ${error.message}`);
  return data as GameCodePage | null;
});

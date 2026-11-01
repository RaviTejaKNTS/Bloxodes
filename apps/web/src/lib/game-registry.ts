import "server-only";
import { cache } from "react";
import { supabaseAdmin } from "./supabase";
import type { SharedGameGame, SharedGameWikiPage, SharedGameWikiCollectionPage } from "./shared-game-reader";
import { resolveGameCoverImage } from "./game-images";
import { readGameArtwork } from "./game-artwork";
import { createGameReader } from "./shared-game-reader";
import type { ToolContent } from "./tools";

export const getGameRoot = cache(async (namespace: string): Promise<SharedGameGame | null> => {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(namespace) || namespace === "roblox") return null;
  const { data, error } = await supabaseAdmin().from("games").select("*").eq("namespace", namespace).is("parent_id", null).eq("is_published", true).maybeSingle();
  if (error) throw new Error(`Game registry read failed: ${error.message}`);
  return data as SharedGameGame | null;
});
const readGameWiki = cache(async (namespace: string, value: string, column: "canonical_path" | "id"): Promise<SharedGameWikiPage | null> => {
  if (!(await getGameRoot(namespace))) return null;
  const { data, error } = await supabaseAdmin().from("game_wiki_pages_view").select("*").eq("namespace", namespace).eq(column, value).eq("is_published", true).maybeSingle();
  if (error) throw new Error(`Game wiki read failed: ${error.message}`);
  return data as SharedGameWikiPage | null;
});
export const getGameWikiByPath = cache((namespace: string, path: string) => readGameWiki(namespace, path, "canonical_path"));
export const getGameWikiById = cache((namespace: string, id: string) => readGameWiki(namespace, id, "id"));
const readGameCollection = cache(async (namespace: string, value: string, column: "canonical_path" | "id"): Promise<SharedGameWikiCollectionPage | null> => {
  if (!(await getGameRoot(namespace))) return null;
  const { data, error } = await supabaseAdmin().from("game_collection_pages_view").select("*").eq("namespace", namespace).eq(column, value).eq("is_published", true).maybeSingle();
  if (error) throw new Error(`Game collection read failed: ${error.message}`);
  return data as SharedGameWikiCollectionPage | null;
});
export const getGameCollectionByPath = cache((namespace: string, path: string) => readGameCollection(namespace, path, "canonical_path"));
export const getGameCollectionById = cache((namespace: string, id: string) => readGameCollection(namespace, id, "id"));
export type GameToolPage = ToolContent & { game_id: string; id: string; namespace: string; slug: string; canonical_path: string; tool_key: string; rules_json: Record<string, unknown> };
const readGameTool = cache(async (namespace: string, value: string, column: "canonical_path" | "id"): Promise<GameToolPage | null> => {
  if (!(await getGameRoot(namespace))) return null;
  const { data, error } = await supabaseAdmin().from("game_tool_pages_view").select("*").eq("namespace", namespace).eq(column, value).eq("is_published", true).maybeSingle();
  if (error) throw new Error(`Game tool read failed: ${error.message}`);
  return data ? { ...data, thumb_url: resolveGameCoverImage({ ...data, game_cover_image: (await getGameArtwork(namespace, data.game_id))?.cover_image }) } as GameToolPage : null;
});
export const getGameToolByPath = cache((namespace: string, path: string) => readGameTool(namespace, path, "canonical_path"));
export const getGameToolById = cache((namespace: string, id: string) => readGameTool(namespace, id, "id"));
export type GameCodePage = { image?: string | null; id: string; namespace: string; game_id: string; canonical_path: string; title: string; seo_title: string | null; meta_description: string | null; intro_md: string | null; redeem_md: string | null; rewards_md: string | null; troubleshoot_md: string | null; find_codes_md: string | null; faq_json: Array<{q:string;a:string}> | null; updated_at: string | null; published_at: string | null };
const readGameCode = cache(async (namespace: string, value: string, column: "canonical_path" | "id"): Promise<GameCodePage | null> => {
  if (!(await getGameRoot(namespace))) return null;
  const { data, error } = await supabaseAdmin().from("game_code_pages_view").select("*").eq("namespace", namespace).eq(column, value).eq("is_published", true).maybeSingle();
  if (error) throw new Error(`Game codes page read failed: ${error.message}`);
  return data ? { ...data, image: (await getGameArtwork(namespace, data.game_id))?.cover_image } as GameCodePage : null;
});
export const getGameCodeByPath = cache((namespace: string, path: string) => readGameCode(namespace, path, "canonical_path"));
export const getGameCodeById = cache((namespace: string, id: string) => readGameCode(namespace, id, "id"));

export const getGameArtwork = cache(readGameArtwork);

export type GameDirectoryPage = { kind: string; href: string; title: string; image: string | null };

export const getGameDirectoryPages = cache(async (namespace: string, gameId?: string): Promise<GameDirectoryPage[]> => {
  const tables = ["game_wiki_pages_view", "game_collection_pages_view", "game_code_pages_view", "game_tool_pages_view", "game_map_pages_view", "game_quiz_pages_view", "game_catalog_pages_view", "game_checklist_pages_view"];
  const results = await Promise.all(tables.map(async table => {
    const fields = "id,game_id,title,canonical_path" + (table === "game_wiki_pages_view" ? ",cover_image" : table === "game_tool_pages_view" ? ",thumb_url" : table === "game_collection_pages_view" ? ",namespace,code,wiki_slug,collection_slug,published_dataset_id" : "");
    let query = supabaseAdmin().from(table).select(fields).eq("namespace", namespace);
    if (gameId) query = query.eq("game_id", gameId);
    if (table !== "game_checklist_pages_view") query = query.eq("is_published", true);
    if (table === "game_collection_pages_view") query = query.not("published_dataset_id", "is", null);
    const { data, error } = await query.order("title");
    if (error) throw new Error(`Game directory read failed: ${error.message}`);
    const rows = (data ?? []) as unknown as Array<{ id: string; game_id: string; title: string; canonical_path: string; cover_image?: string | null; thumb_url?: string | null }>;
    return Promise.all(rows.map(async page => {
      const artwork = await getGameArtwork(namespace, page.game_id);
      const itemImage = table === "game_collection_pages_view" ? (await createGameReader(namespace).listPublishedSharedGameWikiCollectionImageUrls(page as unknown as SharedGameWikiCollectionPage, 1))[0] : null;
      return { kind: table, href: String(page.canonical_path), title: String(page.title), image: table === "game_collection_pages_view" ? itemImage || null : resolveGameCoverImage({ ...page, image: null, game_cover_image: artwork?.cover_image }) };
    }));
  }));
  return results.flat();
});

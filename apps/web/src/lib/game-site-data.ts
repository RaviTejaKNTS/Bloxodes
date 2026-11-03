import "server-only";
import { cache } from "react";
import { supabaseAdmin } from "./supabase";
import { gameLandingPath } from "./game-root-page";
import type { SharedGameGame } from "./shared-game-reader";
import type { GameMenu } from "./game-site-navigation";

const PAGE_TABLES = ["wiki", "collection", "map", "checklist", "quiz", "tool", "code", "catalog"] as const;
export const listGameMenus = cache(async (namespace?: string, gameId?: string, includeCollections = true): Promise<GameMenu[]> => {
  let roots = supabaseAdmin().from("games").select("*").is("parent_id", null).eq("is_published", true);
  if (namespace) roots = roots.eq("namespace", namespace);
  const { data, error } = await roots.order("title");
  if (error) throw error;
  const menus = ((data ?? []) as SharedGameGame[]).filter(root => root.namespace !== "roblox").map(root => ({ namespace: root.namespace, title: root.title, href: gameLandingPath(root), image: root.cover_image || root.hero_image || "/Bloxodes.png", pages: [] as GameMenu["pages"] }));
  if (!menus.length) return [];
  const groups = await Promise.all(PAGE_TABLES.filter(kind => includeCollections || kind !== "collection").map(async kind => {
    const table = kind === "collection" ? "game_collection_pages_view" : `game_${kind}_pages_view`;
    const pages: Array<GameMenu["pages"][number] & { namespace: string }> = [];
    for (let offset = 0;; offset += 1000) {
      let query = supabaseAdmin().from(table).select("namespace,game_id,title,canonical_path");
      if (namespace) query = query.eq("namespace", namespace);
      if (gameId) query = query.eq("game_id", gameId);
      if (kind !== "checklist") query = query.eq("is_published", true);
      if (kind === "collection") query = query.not("published_dataset_id", "is", null);
      const { data: rows, error } = await query.order("canonical_path").range(offset, offset + 999);
      if (error) throw error;
      for (const row of rows ?? []) pages.push({ namespace: row.namespace, kind, gameId: row.game_id, title: row.title, href: row.canonical_path });
      if ((rows ?? []).length < 1000) return pages;
    }
  }));
  for (const group of groups) for (const page of group) menus.find(menu => menu.namespace === page.namespace)?.pages.push(page);
  return menus;
});
export async function listGameCards() {
  return (await listGameMenus()).slice().sort((a, b) => b.pages.length - a.pages.length || a.title.localeCompare(b.title));
}

/** Called only for requests marked as games by the server's published URL policy. */
export const getGameMenuForPath = cache(async (path: string): Promise<GameMenu | null> => {
  try {
    const { data: route, error } = await supabaseAdmin().from("site_routes")
      .select("game_id").eq("source", "game").eq("status", "live").eq("path", path).maybeSingle();
    if (error || !route?.game_id) return null;
    const { data: game, error: gameError } = await supabaseAdmin().from("games")
      .select("*").eq("id", route.game_id).eq("is_published", true).maybeSingle();
    if (gameError || !game || game.namespace === "roblox") return null;
    const stored = (await listGameMenus(game.namespace, game.kind === "franchise" ? undefined : game.id, false))[0];
    if (!stored) return null;
    const menu = { ...stored };
    // Individual games get their own title and home, with no sibling page lists.
    if (game.kind !== "franchise") {
      menu.title = game.title;
      menu.href = gameLandingPath(game as SharedGameGame);
    }
    return { ...menu, pages: menu.pages.filter(page => page.kind !== "collection") };
  } catch {
    return null;
  }
});

import type { supabaseAdmin } from "./supabase-admin";

type Database = ReturnType<typeof supabaseAdmin>;
type Row = { id: string; title: string; canonical_path: string };
export const MOVED_PAGE_KINDS = ["wiki", "collection", "code", "quiz", "checklist", "tool", "map", "catalog"];

/** Views enforce owner/parent visibility; explicit flags exclude page drafts. */
export async function loadPublishedMovedGamePages(db: Database, kind: string, signal?: AbortSignal): Promise<Row[]> {
  if (!MOVED_PAGE_KINDS.includes(kind)) throw new Error("Unknown game directory");
  const now = new Date().toISOString();
  const games: Array<{ id: string; namespace: string; parent_id: string | null }> = [];
  for (let offset = 0;; offset += 500) {
    let query = db.from("games").select("id,namespace,parent_id")
      .eq("url_style", "page_type").eq("is_published", true)
      .or(`published_at.is.null,published_at.lte.${now}`).order("id").range(offset, offset + 499);
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query;
    if (error) throw new Error("Moved game directory unavailable");
    games.push(...(data ?? []));
    if (!data || data.length < 500) break;
  }
  const visibleRoots = new Set(games.filter(game => !game.parent_id).map(game => game.namespace));
  const ids = games.filter(game => visibleRoots.has(game.namespace)).map(game => game.id);
  const rows: Row[] = [];
  // Bound IN filters as well as response pages.
  for (let start = 0; start < ids.length; start += 200) {
    for (let offset = 0;; offset += 500) {
      let query = db.from(`game_${kind}_pages_view`).select("id,title,canonical_path")
        .in("game_id", ids.slice(start, start + 200))
        .eq(kind === "checklist" ? "is_public" : "is_published", true);
      query = kind === "checklist" ? query.lte("published_at", now)
        : query.or(`published_at.is.null,published_at.lte.${now}`);
      query = query.order("id").range(offset, offset + 499);
      if (signal) query = query.abortSignal(signal);
      const { data, error } = await query;
      if (error) throw new Error("Moved game pages unavailable");
      rows.push(...(data ?? []) as Row[]);
      if (!data || data.length < 500) break;
    }
  }
  return rows;
}

import "server-only";
import { supabaseAdmin } from "./supabase";

const INDEXES: Record<string, string> = {
  wiki: "/wiki", collection: "/wiki", code: "/codes", tool: "/tools",
  map: "/maps", quiz: "/quizzes", checklist: "/checklists", catalog: "/catalog", hub: "/games"
};

/** Identity comes from registry ownership, including old aliases and hidden pages. */
export async function gameContentRevalidationTargets(slug: string) {
  if (!/^[a-z0-9-]+(?:\/[a-z0-9-]+)*$/.test(slug)) return { paths: [], tags: [], collectionPaths: [] };
  const db = supabaseAdmin();
  async function rows(table: string, columns: string, filters: Record<string, string>) {
    const result: Array<Record<string, string>> = [];
    for (let offset = 0;; offset += 500) {
      let query = db.from(table).select(columns);
      for (const [key, value] of Object.entries(filters)) query = query.eq(key, value);
      // site_routes is keyed by path and has no id column.
      const { data, error } = await query.order(table === "site_routes" ? "path" : "id").range(offset, offset + 499);
      if (error) throw new Error(`Game revalidation lookup failed: ${table}`);
      result.push(...(data ?? []) as unknown as Array<Record<string, string>>);
      if (!data || data.length < 500) return result;
    }
  }
  const namespaceEvent = !slug.includes("/");
  const owners = namespaceEvent
    ? []
    : await rows("site_routes", "page_id,page_type,game_id,path", { source: "game", path: `/${slug}` });
  // A namespace event expands every owner; a page event never expands siblings.
  const namespace = namespaceEvent ? slug : null;
  const games = namespace
    ? await rows("games", "id,namespace,parent_id,url_style", { namespace })
    : owners[0]?.game_id ? await rows("games", "id,namespace,parent_id,url_style", { id: owners[0].game_id }) : [];
  const paths = new Set<string>(namespaceEvent ? [] : [`/${slug}`]);
  const tags = new Set<string>();
  const indexes = new Set<string>(["/games", "/feed.xml", "/sitemap.xml", "/sitemaps/games.xml"]);
  const pagePaths = new Set<string>();
  const collectionPaths = new Set<string>();
  const addOwner = async (owner: Record<string, string>) => {
    const routes = await rows("site_routes", "path", { source: "game", page_type: owner.page_type, page_id: owner.page_id });
    for (const route of routes) {
      pagePaths.add(route.path);
      if (owner.page_type === "collection") {
        collectionPaths.add(route.path);
        // Invalidate the subtree and shared pagination tag, including drafts
        // and collections whose published runtime has been removed.
      }
    }
    const game = games.find(game => game.id === owner.game_id);
    const index = INDEXES[owner.page_type];
    if (index) indexes.add(game?.url_style === "namespace" ? `/${game.namespace}${index === "/games" ? "" : index}` : index);
  };
  for (const game of games) {
    const root = (await rows("games", "id,namespace,parent_id,url_style", { namespace: game.namespace })).find(row => !row.parent_id);
    if (!root) throw new Error("Game revalidation root is missing");
    if (namespaceEvent) {
      for (const route of await rows("site_routes", "page_id,page_type,game_id,path", { source: "game", game_id: game.id, status: "live" })) await addOwner(route);
    }
    // Wiki slugs are permanent editorial IDs and need not equal the root slug.
    for (const id of new Set([game.id, root.id])) {
      for (const wiki of await rows("game_wiki_pages", "id,canonical_path", { game_id: id })) pagePaths.add(wiki.canonical_path);
    }
    // Specialized renderers may consume a sibling title or edition's collection.
    // Refresh maps and calculators in the owning namespace for every game.
    for (const [table, index] of [["game_tool_pages", "/tools"], ["game_map_pages", "/maps"]]) {
      for (const dependent of await rows(table, "id,canonical_path", { namespace: game.namespace })) {
        pagePaths.add(dependent.canonical_path);
        indexes.add(index);
      }
    }
    const hubs = await rows("site_routes", "path", { source: "game", game_id: root.id, page_type: "hub", status: "live" });
    for (const hub of hubs) pagePaths.add(hub.path);
  }
  for (const owner of owners) await addOwner(owner);
  for (const path of pagePaths) {
    paths.add(path);
    // Every numbered collection page shares this Cloudflare tag. Next also
    // invalidates the collection subtree in the route handler.
    // No page-count cap is involved in invalidation. Warming remains best effort.
    tags.add(`page:${path}`);
  }
  for (const index of indexes) {
    paths.add(index);
    tags.add(`page:${index}`);
    if (["/wiki", "/codes", "/tools", "/checklists"].includes(index)) paths.add(`${index}/page/[page]`);
  }
  tags.add("games-index");
  tags.add("feed");
  tags.add("sitemap:games");
  return { paths: [...paths], tags: [...tags], collectionPaths: [...collectionPaths] };
}

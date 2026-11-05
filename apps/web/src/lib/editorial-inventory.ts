import { isRetiredMusicGameCatalogCode } from "@/lib/game-specific-id-pages";
import type { SupabaseClient } from "@supabase/supabase-js";

export const EDITORIAL_INVENTORY_VERSION = 1;

export type EditorialInventoryFamily =
  | "article"
  | "codes"
  | "wiki"
  | "collection"
  | "catalog"
  | "event"
  | "checklist"
  | "quiz"
  | "tool";

export type EditorialInventoryItem = {
  family: EditorialInventoryFamily;
  title: string;
  key: string;
  universe_id: number | null;
  public_path?: string;
  namespace?: string;
  slug?: string;
  kind?: "game" | "franchise";
};

type InventoryConfig = {
  table: string;
  family: EditorialInventoryFamily;
  titleColumn: string;
  keyColumn: string;
  visibilityColumn: string;
};

const INVENTORY_CONFIGS: InventoryConfig[] = [
  { table: "articles", family: "article", titleColumn: "title", keyColumn: "slug", visibilityColumn: "is_published" },
  { table: "code_pages", family: "codes", titleColumn: "name", keyColumn: "slug", visibilityColumn: "is_published" },
  { table: "wiki_pages", family: "wiki", titleColumn: "title", keyColumn: "slug", visibilityColumn: "is_published" },
  { table: "wiki_collection_pages", family: "collection", titleColumn: "title", keyColumn: "code", visibilityColumn: "is_published" },
  { table: "catalog_pages", family: "catalog", titleColumn: "title", keyColumn: "code", visibilityColumn: "is_published" },
  { table: "events_pages", family: "event", titleColumn: "title", keyColumn: "slug", visibilityColumn: "is_published" },
  { table: "checklist_pages", family: "checklist", titleColumn: "title", keyColumn: "slug", visibilityColumn: "is_public" },
  { table: "quiz_pages", family: "quiz", titleColumn: "title", keyColumn: "code", visibilityColumn: "is_published" },
  { table: "tools", family: "tool", titleColumn: "title", keyColumn: "code", visibilityColumn: "is_published" }
];

async function fetchInventoryFamily(
  supabase: SupabaseClient,
  config: InventoryConfig
): Promise<EditorialInventoryItem[]> {
  const rows: EditorialInventoryItem[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from(config.table)
      .select(`${config.titleColumn},${config.keyColumn},universe_id`)
      .eq(config.visibilityColumn, true)
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`Could not load ${config.table} editorial inventory: ${error.message}`);
    const page = (data ?? []) as unknown as Record<string, unknown>[];
    for (const row of page) {
      const rawTitle = row[config.titleColumn];
      const rawKey = row[config.keyColumn];
      const title = typeof rawTitle === "string" ? rawTitle.trim() : "";
      const key = typeof rawKey === "string" ? rawKey.trim() : "";
      const rawUniverseId = row.universe_id;
      const universeId = typeof rawUniverseId === "number"
        ? rawUniverseId
        : typeof rawUniverseId === "string" && /^\d+$/.test(rawUniverseId)
          ? Number(rawUniverseId)
          : null;
      if (config.family === "catalog" && isRetiredMusicGameCatalogCode(key)) continue;
      if (title && key) rows.push({ family: config.family, title, key, universe_id: universeId });
    }
    if (page.length < pageSize) break;
  }
  return rows;
}

// Read published views so game/parent visibility and scheduled articles match public pages.
async function fetchGameInventory(supabase: SupabaseClient): Promise<EditorialInventoryItem[]> {
  async function pages<T>(table: string, columns: string): Promise<T[]> {
    const rows: T[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from(table).select(columns)
        .eq("is_published", true).order("id").range(from, from + 999);
      if (error) throw new Error(`Could not load ${table} editorial inventory: ${error.message}`);
      rows.push(...((data ?? []) as unknown as T[]));
      if ((data ?? []).length < 1000) return rows;
    }
  }
  type GameIdentity = { id: string; namespace: string; slug: string; kind: "game" | "franchise" };
  type GamePage = { id: string; game_id: string; namespace: string; title: string; slug: string; canonical_path: string };
  const [games, articles, wikis] = await Promise.all([
    pages<GameIdentity>("games", "id,namespace,slug,kind"),
    pages<GamePage>("game_article_pages_view", "id,game_id,namespace,title,slug,canonical_path"),
    pages<GamePage>("game_wiki_pages_view", "id,game_id,namespace,title,slug,canonical_path"),
  ]);
  const owners = new Map(games.map(game => [game.id, game]));
  const items: EditorialInventoryItem[] = [];
  for (const [family, rows] of [["article", articles], ["wiki", wikis]] as const) {
    for (const row of rows) {
      const game = owners.get(row.game_id);
      if (!game || game.namespace !== row.namespace) continue;
      items.push({ family, title: row.title, key: row.slug, universe_id: null,
        public_path: row.canonical_path, namespace: game.namespace, slug: game.slug, kind: game.kind });
    }
  }
  return items;
}

// Roblox callers read the default projection, so non-Roblox rows can't affect their
// duplicate checks and a failed game read can't stop them.
export async function loadEditorialInventory(
  supabase: SupabaseClient,
  { includeGames = false }: { includeGames?: boolean } = {}
): Promise<EditorialInventoryItem[]> {
  const families = await Promise.all([
    ...INVENTORY_CONFIGS.map((config) => fetchInventoryFamily(supabase, config)),
    ...(includeGames ? [fetchGameInventory(supabase)] : [])
  ]);
  return families.flat().sort((left, right) =>
    left.family.localeCompare(right.family) || left.title.localeCompare(right.title)
  );
}

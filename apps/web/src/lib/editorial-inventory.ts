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
      if (title && key) rows.push({ family: config.family, title, key, universe_id: universeId });
    }
    if (page.length < pageSize) break;
  }
  return rows;
}

export async function loadEditorialInventory(supabase: SupabaseClient): Promise<EditorialInventoryItem[]> {
  const families = await Promise.all(INVENTORY_CONFIGS.map((config) => fetchInventoryFamily(supabase, config)));
  return families.flat().sort((left, right) =>
    left.family.localeCompare(right.family) || left.title.localeCompare(right.title)
  );
}

import type { SupabaseClient } from "@supabase/supabase-js";
import type { GameCollectionConfig, GameCollectionGroup } from "./types";

export type RegisteredGameCollectionGroup = GameCollectionGroup & {
  sortOrder: number;
  collectionConfigs: Array<GameCollectionConfig & { pageType: "database" | "collectible" }>;
};

// Accept the caller's server client so command-line tools share this mapping.
export async function readGameCollectionGroups(client: SupabaseClient): Promise<RegisteredGameCollectionGroup[]> {
  const groups: RegisteredGameCollectionGroup[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error, status } = await client.from("roblox_wiki_registry")
      .select("game_slug,game_name,universe_id,universe_names,sort_order,collections")
      .order("sort_order").order("game_slug").range(offset, offset + 999);
    if (error) throw Object.assign(new Error(`Roblox wiki registry read failed (HTTP ${status}): ${[error.message, error.details, error.hint].filter(Boolean).join(": ")}. If the table is missing, apply the registry migration.`), { cause: error, status });
    for (const row of data ?? []) {
      const collections = row.collections as Array<{ slug: string; label: string; sortOrder: number; pageType: "database" | "collectible" }>;
      groups.push({
        gameSlug: row.game_slug,
        gameName: row.game_name,
        universeId: row.universe_id == null ? undefined : Number(row.universe_id),
        universeNames: row.universe_names,
        sortOrder: row.sort_order,
        collections: collections.map(entry => entry.slug),
        collectionConfigs: collections.map(entry => ({
          code: `${row.game_slug}-${entry.slug}`,
          gameSlug: row.game_slug,
          gameName: row.game_name,
          slug: entry.slug,
          label: entry.label,
          sortOrder: entry.sortOrder,
          pageType: entry.pageType,
          universeNames: row.universe_names
        }))
      });
    }
    if ((data?.length ?? 0) < 1000) return groups;
  }
}

export async function readGameCollectionConfigs(client: SupabaseClient) {
  return (await readGameCollectionGroups(client)).flatMap(group => group.collectionConfigs);
}

export async function readGameCollectionConfigByWikiPath(client: SupabaseClient, game: string, collection: string) {
  return (await readGameCollectionConfigs(client)).find(entry =>
    entry.gameSlug === game.trim().toLowerCase() && entry.slug === collection.trim().toLowerCase()) ?? null;
}

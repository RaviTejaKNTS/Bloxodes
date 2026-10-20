import test from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readGameCollectionGroups } from "../../../apps/web/src/lib/game-collections/registry";

function reader(rows: unknown[], error: { message: string } | null = null) {
  const query = {
    select: (_fields: string) => query,
    order: (_field: string) => query,
    range: async (start: number, end: number) => ({ data: rows.slice(start, end + 1), error })
  };
  return { from: (table: string) => { assert.equal(table, "roblox_wiki_registry"); return query; } } as unknown as SupabaseClient;
}

test("database registry exposes new games, custom labels, aliases, ordering and renderer types", async () => {
  const groups = await readGameCollectionGroups(reader([{
    game_slug: "new-game", game_name: "New Game", universe_id: "123", universe_names: ["New Game", "Old Name"], sort_order: 80000,
    collections: [{ slug: "pets", label: "All companions", sortOrder: 80010, pageType: "collectible" }]
  }, { game_slug: "empty-game", game_name: "Empty Game", universe_id: null, universe_names: ["Empty Game"], sort_order: 81000, collections: [] }]));
  assert.equal(groups[0].universeId, 123);
  assert.deepEqual(groups[0].collectionConfigs, [{
    code: "new-game-pets", gameSlug: "new-game", gameName: "New Game", slug: "pets", label: "All companions", sortOrder: 80010,
    pageType: "collectible", universeNames: ["New Game", "Old Name"]
  }]);
  assert.deepEqual(groups[1].collections, []);
  assert.equal(groups[1].universeId, undefined);
});

test("registry reads paginate and never substitute a static list on database failure", async () => {
  const row = { game_slug: "game", game_name: "Game", universe_id: 1, universe_names: ["Game"], sort_order: 1, collections: [] };
  assert.equal((await readGameCollectionGroups(reader(Array.from({ length: 1001 }, () => row)))).length, 1001);
  await assert.rejects(readGameCollectionGroups(reader([], { message: "missing relation" })), /Apply the registry migration first/);
});

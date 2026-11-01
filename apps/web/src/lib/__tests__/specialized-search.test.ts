import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ rows: [] as object[] }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase", () => ({ supabaseAdmin: () => ({
 rpc: async () => ({ data: state.rows, error: null }),
 from: () => { const q = { select: () => q, eq: () => q, not: () => q, or: () => q, in: () => q, ilike: () => q, order: () => q, limit: () => q, then: (resolve: (value: unknown) => unknown) => resolve({data: [], error: null}) }; return q; }
}) }));
import { GET } from "@/app/api/search/all/route";
beforeEach(() => { state.rows = []; });
it.each(["gta5", "red-dead-2", "minecraft", "peak"])("returns the indexed %s map with the shared identity", async slug => {
 state.rows = [{entity_type: "game_map", entity_id: "map-id", slug, title: `${slug} map`, url: `/maps/${slug}`, updated_at: null}];
 const response = await GET(new Request(`https://bloxodes.com/api/search/all?q=${slug}&scope=maps`));
 expect((await response.json()).items).toMatchObject([{id: "game_map-map-id", url: `/maps/${slug}`, type: "tool"}]);
});
it("has no synthetic static map when no published index row exists", async () => {
 const response = await GET(new Request("https://bloxodes.com/api/search/all?q=gta+5+map"));
 expect((await response.json()).items).toEqual([]);
});

it.each([
 ["gta_game", "wiki"], ["gta_wiki", "wiki"], ["gta_wiki_collection", "wiki"], ["gta_checklist", "checklist"],
 ["red_dead_game", "wiki"], ["red_dead_wiki", "wiki"], ["red_dead_wiki_collection", "wiki"],
 ["minecraft_game", "wiki"], ["minecraft_wiki", "wiki"], ["minecraft_wiki_collection", "wiki"], ["minecraft_tool", "tool"]
])("reads legacy %s rows during rollout", async (entity_type, type) => {
 state.rows = [{ entity_type, entity_id: "old-id", title: "Legacy page", url: "/wiki/legacy-page", updated_at: null }];
 for (const scope of ["games", "global"]) {
  const response = await GET(new Request(`https://bloxodes.com/api/search/all?q=legacy&scope=${scope}`));
  expect((await response.json()).items).toMatchObject([{ type, url: "/wiki/legacy-page" }]);
 }
});
it.each(["story", "mode", "grand", "theft", "auto", "gta"])("preserves Roblox ranking for %s", async word => {
 state.rows = [
  { entity_type: "wiki", entity_id: "loose", title: "Unrelated newer match", url: "/wiki/newer", updated_at: "2026-10-20" },
  { entity_type: "wiki", entity_id: "match", title: "Beta Alpha", url: "/wiki/older", updated_at: "2026-10-01" }
 ];
 const response = await GET(new Request(`https://bloxodes.com/api/search/all?q=${word}+alpha+beta&scope=wiki`));
 expect((await response.json()).items.map((item: { id: string }) => item.id)).toEqual(["wiki-match", "wiki-loose"]);
});

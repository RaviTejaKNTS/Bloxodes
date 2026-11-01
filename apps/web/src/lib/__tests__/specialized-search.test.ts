import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ path: "/gta/maps/gta5" as string | null, moved: false, failMap: false, failRoot: false, other: false }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/game-extra-pages", () => ({ getGameMapBySlug: async () => {
  if (state.failMap) throw new Error("Map unavailable");
  return state.path ? { canonical_path: state.path } : null;
} }));
vi.mock("@/lib/game-registry", () => ({ getGameRoot: async () => {
  if (state.failRoot) throw new Error("Root unavailable");
  return { url_style: state.moved ? "page_type" : "namespace" };
} }));
vi.mock("@/lib/supabase", () => ({ supabaseAdmin: () => ({
  rpc: async () => ({ data: state.other ? [{ entity_type: "gta_wiki", entity_id: "other", slug: "other", title: "GTA 5 map guide", url: "/gta/wiki/other", search_text: "gta 5 map" }] : [], error: null }),
  from: () => {
    const query = { select: () => query, eq: () => query, or: () => query, in: () => query, ilike: () => query, order: () => query, limit: () => query, then: (resolve: (value: unknown) => unknown) => resolve({ data: [], error: null }) };
    return query;
  }
}) }));
import { GET } from "@/app/api/search/all/route";
it.each(["/gta/maps/gta5", "/maps/gta5", null])("search uses the published map canonical path %s and retains search identity", async path => {
  state.path = path;
  state.moved = path !== "/gta/maps/gta5";
  const response = await GET(new Request("https://bloxodes.com/api/search/all?q=gta+5+map&scope=gta"));
  expect(response.status).toBe(200);
  const { items } = await response.json();
  if (!path) expect(items).toEqual([]);
  else {
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id: "gta_wiki-gta5-interactive-map", title: "GTA 5 Interactive Map", url: path, type: "wiki" });
  }
});

beforeEach(() => { Object.assign(state, { path: "/gta/maps/gta5", moved: false, failMap: false, failRoot: false, other: false }); });
it.each([false, true])("keeps the committed static GTA5 result while unmoved (identity failure=%s)", async failRoot => {
  Object.assign(state, { failRoot, failMap: true });
  const response = await GET(new Request("https://bloxodes.com/api/search/all?q=gta+5+map&scope=gta"));
  expect(response.status).toBe(200);
  expect((await response.json()).items).toMatchObject([{ id: "gta_wiki-gta5-interactive-map", url: "/gta/maps/gta5" }]);
});
it("retains other search results if the moved map lookup fails", async () => {
  Object.assign(state, { moved: true, failMap: true, other: true });
  const response = await GET(new Request("https://bloxodes.com/api/search/all?q=gta+5+map&scope=gta"));
  expect(response.status).toBe(200);
  expect((await response.json()).items).toMatchObject([{ id: "gta_wiki-other", url: "/gta/wiki/other" }]);
});

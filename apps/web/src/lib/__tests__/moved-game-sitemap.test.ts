import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ error: false, filters: {} as Record<string, unknown>, ranges: [] as number[][] }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase", () => ({ supabaseAdmin: () => ({ from: (table: string) => {
  expect(table).toBe("site_routes");
  const q = {
    select: (columns: string) => { expect(columns).toBe("path"); return q; },
    eq: (key: string, value: unknown) => { state.filters[key] = value; return q; },
    not: (key: string, op: string, value: unknown) => { state.filters[key] = [op, value]; return q; },
    order: (key: string) => { expect(key).toBe("path"); return q; },
    range: async (start: number, end: number) => {
      state.ranges.push([start, end]);
      if (state.error) return { data: null, error: { message: "Unavailable" } };
      const all = [
        ...Array.from({ length: 501 }, (_, i) => ({ path: `/old/game-${i}`, status: "old", source: "game", page_id: "owner" })),
        { path: "/live/game", status: "live", source: "game", page_id: "owner" },
        { path: "/gone/game", status: "gone", source: "game", page_id: "owner" },
        { path: "/old/roblox", status: "old", source: "roblox", page_id: "owner" },
        { path: "/old/unlinked", status: "old", source: null, page_id: null }
      ];
      return { error: null, data: all.filter(r => r.status === state.filters.status && r.source === state.filters.source && (state.filters.page_id ? r.page_id !== null : true)).slice(start, end + 1) };
    }
  }; return q;
} }) }));
import { GET } from "@/app/sitemaps/moved.xml/route";
import { GET as index } from "@/app/sitemap.xml/route";
import { MOVED_GAME_SITEMAP_REMOVE_ON } from "../moved-game-sitemap";
beforeEach(() => { state.error = false; state.filters = {}; state.ranges = []; });
it("lists only old page-linked game routes, including every database page", async () => {
  const response = await GET(); const xml = await response.text();
  expect(response.status).toBe(200);
  expect([...xml.matchAll(/<loc>/g)]).toHaveLength(501);
  expect(xml).toContain("https://bloxodes.com/old/game-500");
  for (const path of ["/live/game", "/gone/game", "/old/roblox", "/old/unlinked"]) expect(xml).not.toContain(path);
  expect(state.filters).toEqual({ status: "old", source: "game", page_id: ["is", null] });
  expect(state.ranges).toEqual([[0, 499], [500, 999]]);
  expect(await (await index()).text()).toContain("https://bloxodes.com/sitemaps/moved.xml");
  expect(MOVED_GAME_SITEMAP_REMOVE_ON).toBe("2027-01-02");
});
it("returns a retryable error rather than an incomplete sitemap", async () => {
  state.error = true; const response = await GET();
  expect(response.status).toBe(503); expect(response.headers.get("Retry-After")).toBe("60");
});

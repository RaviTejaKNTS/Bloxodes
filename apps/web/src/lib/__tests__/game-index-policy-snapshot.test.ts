import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const state = vi.hoisted(() => ({ failure: false, filters: [] as Record<string, unknown>[] }));
vi.mock("../published-moved-game-pages", () => ({
  MOVED_PAGE_KINDS: ["wiki"],
  loadPublishedMovedGamePages: async () => [{ id: "published-owner", canonical_path: "/wiki/published" }, { id: "missing", canonical_path: "/wiki/missing" }, { id: "expected-owner", canonical_path: "/wiki/wrong-owner" }]
}));
vi.mock("../supabase-admin", () => ({ supabaseAdmin: () => ({ from: () => {
  const filters: Record<string, unknown> = {};
  state.filters.push(filters);
  const query = {
    select: () => query, eq: (key: string, value: unknown) => { filters[key] = value; return query; },
    in: (key: string, value: unknown) => { filters[key] = value; return query; },
    abortSignal: async () => ({ error: state.failure ? { message: "private detail" } : null, data: [
      { path: "/wiki/published", page_id: "published-owner" },
      { path: "/wiki/draft", page_id: "draft-owner" },
      { path: "/wiki/wrong-owner", page_id: "different-owner" }
    ] })
  };
  return query;
} }) }));
import { loadGameIndexPolicyRows } from "../site-route-snapshot";
it("requires both published-page evidence and matching live registry ownership", async () => {
  const rows = await loadGameIndexPolicyRows(new AbortController().signal);
  expect(rows.map(row => row.path)).toEqual(["/wiki/published"]);
  expect(state.filters[0]).toMatchObject({ source: "game", status: "live", page_type: "wiki" });
});
it("policy lookup failure is isolated from redirect loading", async () => {
  state.failure = true;
  try {
    await expect(loadGameIndexPolicyRows(new AbortController().signal)).rejects.toThrow("Published game policy routes unavailable");
  } finally { state.failure = false; }
});

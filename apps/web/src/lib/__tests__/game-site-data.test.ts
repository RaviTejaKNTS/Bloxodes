import { describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ calls: [] as Array<[string, string, unknown]>, roots: [
  { namespace: "gta", slug: "gta", kind: "franchise", title: "GTA", cover_image: "/gta-cover.webp" },
  { namespace: "arc-raiders", slug: "arc-raiders", kind: "game", title: "ARC Raiders", hero_image: "/arc-hero.webp" }
] }));
vi.mock("server-only", () => ({}));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(), cache: (fn: unknown) => fn }));
vi.mock("../supabase", () => ({ supabaseAdmin: () => ({ from: (table: string) => {
  const pages = table === "game_tool_pages_view" ? [1, 2].map(n => ({ namespace: "arc-raiders", game_id: "arc", title: `Tool ${n}`, canonical_path: `/tools/arc-raiders-${n}` })) : [];
  const query = {
    select: () => query, is: () => query,
    eq: (key: string, value: unknown) => { state.calls.push([table, key, value]); return query; },
    not: (key: string, _op: string, value: unknown) => { state.calls.push([table, key, value]); return query; },
    order: () => query, range: () => query,
    then: (resolve: (value: unknown) => unknown) => resolve({ data: table === "games" ? state.roots : pages, error: null })
  };
  return query;
} }) }));
import { listGameCards, listGameMenus } from "../game-site-data";
describe("published game directory", () => {
  it("uses kind, slug and stored artwork for every root, without a game allowlist", async () => {
    expect(await listGameMenus()).toEqual([
      expect.objectContaining({ href: "/games/gta", image: "/gta-cover.webp" }),
      expect.objectContaining({ href: "/wiki/arc-raiders", image: "/arc-hero.webp", pages: [expect.objectContaining({ href: "/tools/arc-raiders-1" }), expect.objectContaining({ href: "/tools/arc-raiders-2" })] })
    ]);
    expect(state.calls).toContainEqual(["games", "is_published", true]);
    expect(state.calls).toContainEqual(["game_tool_pages_view", "is_published", true]);
    expect(state.calls).toContainEqual(["game_collection_pages_view", "published_dataset_id", null]);
  });
  it("orders home cards by published content count", async () => {
    expect((await listGameCards()).map(game => game.namespace)).toEqual(["arc-raiders", "gta"]);
  });
});
it("falls back to no menu when route ownership is unavailable", async () => {
  const { getGameMenuForPath } = await import("../game-site-data");
  // This fixture has no route maybeSingle reader: unexpected failures are contained.
  expect(await getGameMenuForPath("/wiki/arc-raiders")).toBeNull();
});
it("filters menu reads by namespace and individual game", async () => {
 state.calls = [];
 await listGameMenus("arc-raiders", "arc", false);
 expect(state.calls).toContainEqual(["games", "namespace", "arc-raiders"]);
 expect(state.calls.some(([table]) => table === "game_collection_pages_view")).toBe(false);
 for (const kind of ["wiki", "map", "checklist", "quiz", "tool", "code", "catalog"]) {
  expect(state.calls).toContainEqual([`game_${kind}_pages_view`, "namespace", "arc-raiders"]);
  expect(state.calls).toContainEqual([`game_${kind}_pages_view`, "game_id", "arc"]);
 }
});

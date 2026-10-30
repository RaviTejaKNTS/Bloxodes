import { describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";
import { getMusicGameIdPage, isRetiredMusicGameCatalogCode, MUSIC_GAME_ID_PAGES } from "../game-specific-id-pages";

vi.mock("@/lib/public-content-cache", () => ({ publicContentCache: (fn: unknown) => fn }));
const mocks = vi.hoisted(() => ({ admin: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ supabaseAdmin: mocks.admin }));
import { listPublishedCatalogCodes, listPublishedCatalogPagesByUniverseId } from "../catalog";

const retiredCode = "roblox-music-ids/games/work-at-a-pizza-place";

describe("retired music game", () => {
  it("is absent from the registry used by static params and index cards", () => {
    expect(getMusicGameIdPage("work-at-a-pizza-place")).toBeNull();
    expect(MUSIC_GAME_ID_PAGES.some(page => page.slug === "work-at-a-pizza-place")).toBe(false);
    expect(isRetiredMusicGameCatalogCode(retiredCode)).toBe(true);
    expect(isRetiredMusicGameCatalogCode("roblox-music-ids/games/a-dusty-trip")).toBe(false);
  });

  it("permanently redirects the old page and its descendants", async () => {
    const require = createRequire(import.meta.url);
    const config = require("../../../next.config.js");
    const redirects = await config.redirects();
    expect(redirects).toContainEqual({
      source: `/catalog/${retiredCode}/:path*`,
      destination: "/catalog/roblox-music-ids",
      permanent: true
    });
  });

  it.each([false, true])("excludes a still-published DB row from related links, fallback=%s", async fallback => {
    const result = { data: [{ code: retiredCode }, { code: "roblox-music-ids" }], error: null };
    const query = {
      select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), not: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      then: (resolve: (value: unknown) => unknown) => resolve(result)
    };
    mocks.admin.mockReturnValue({ from: (table: string) => fallback && table.endsWith("_view")
      ? { ...query, then: (resolve: (value: unknown) => unknown) => resolve({ data: null, error: { message: "view unavailable" } }) }
      : query });
    expect(await listPublishedCatalogCodes()).toEqual(["roblox-music-ids"]);
    expect(await listPublishedCatalogPagesByUniverseId(47545)).toEqual([{ code: "roblox-music-ids" }]);
  });
});

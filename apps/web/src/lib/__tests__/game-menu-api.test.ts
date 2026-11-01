import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ menu: vi.fn(), paths: vi.fn() }));
vi.mock("@/lib/game-site-data", () => ({ getGameMenuForPath: state.menu }));
vi.mock("@/lib/site-route-snapshot", () => ({ readGameIndexPaths: state.paths }));
import { GET } from "@/app/api/game-menu/route";
beforeEach(() => { vi.clearAllMocks(); state.paths.mockResolvedValue(new Set(["/wiki/terraria/items"])); state.menu.mockResolvedValue({ namespace: "terraria" }); });
it("returns only the current game's menu and normalizes pagination", async () => {
 const response = await GET(new Request("https://bloxodes.com/api/game-menu?path=/wiki/terraria/items/page/2"));
 expect(await response.json()).toEqual({ menu: { namespace: "terraria" } });
 expect(state.menu).toHaveBeenCalledExactlyOnceWith("/wiki/terraria/items");
 expect(response.headers.get("Cache-Control")).toContain("max-age=60");
});
it("returns nothing for Roblox without a menu read", async () => {
 const response = await GET(new Request("https://bloxodes.com/api/game-menu?path=/wiki/the-forge"));
 expect(await response.json()).toEqual({ menu: null }); expect(state.menu).not.toHaveBeenCalled();
});
it("contains failures without caching them", async () => {
 state.menu.mockRejectedValue(new Error("offline"));
 const response = await GET(new Request("https://bloxodes.com/api/game-menu?path=/wiki/terraria/items"));
 expect(await response.json()).toEqual({ menu: null }); expect(response.headers.get("Cache-Control")).toBe("no-store");
});

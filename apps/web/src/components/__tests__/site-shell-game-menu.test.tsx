import { expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ path: "", menu: vi.fn(async (_path: string) => null) }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-bloxodes-game-path": state.path }) }));
vi.mock("@/lib/site-route-snapshot", () => ({ readGameIndexPaths: async () => new Set(["/wiki/arc-raiders"]) }));
vi.mock("next/font/google", () => ({ Inter: () => ({ className: "font" }) }));
vi.mock("@/lib/game-site-data", () => ({ getGameMenuForPath: state.menu }));
vi.mock("@/components/SiteHeader", () => ({ SiteHeader: () => null }));
vi.mock("@/components/SiteFooter", () => ({ SiteFooter: () => null }));
vi.mock("@/components/RecentVisitTracker", () => ({ RecentVisitTracker: () => null }));
import { SiteShell } from "../SiteShell";
it("makes no game menu calls on Roblox requests", async () => {
 state.menu.mockClear(); state.path = "";
 await SiteShell({ children: "Roblox page" });
 expect(state.menu).not.toHaveBeenCalled();
});
it("resolves only the current game's path", async () => {
 state.menu.mockClear(); state.path = "/wiki/arc-raiders";
 await SiteShell({ children: "Game page" });
 expect(state.menu).toHaveBeenCalledExactlyOnceWith(state.path);
});

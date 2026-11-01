// @vitest-environment jsdom
import { act, type ComponentProps } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { GameMenu } from "@/lib/game-site-navigation";
const state = vi.hoisted(() => ({ path: "/wiki/the-forge", searchMenus: [] as GameMenu[], drawerMenus: [] as GameMenu[] }));
vi.mock("next/navigation", () => ({ usePathname: () => state.path }));
vi.mock("next/link", () => ({ default: ({ children, ...props }: ComponentProps<"a">) => <a {...props}>{children}</a> }));
vi.mock("@/components/SiteLogo", () => ({ SiteLogo: () => null }));
vi.mock("@/components/AccountSheetButton", () => ({ AccountSheetButton: () => null }));
vi.mock("@/components/SiteMoreDrawer", () => ({ SiteMoreDrawer: ({ gameMenus }: { gameMenus: GameMenu[] }) => { state.drawerMenus = gameMenus; return null; } }));
vi.mock("@/components/GlobalSearchOverlay", () => ({ GlobalSearchOverlay: ({ gameMenus }: { gameMenus: GameMenu[] }) => { state.searchMenus = gameMenus; return null; } }));
import { SiteHeader } from "../SiteHeader";
import { resolveSearchScope, signedOutSidebarAccount, siteNavLinks } from "@/lib/site-navigation";
const gta: GameMenu = { namespace: "gta", title: "GTA 5", href: "/wiki/gta-5", image: "", pages: [] };
const terraria: GameMenu = { namespace: "terraria", title: "Terraria", href: "/wiki/terraria", image: "", pages: [] };
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const fetchMenu = vi.fn();
beforeEach(() => {
 state.path = "/wiki/the-forge";
 vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
 vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
 vi.stubGlobal("fetch", fetchMenu.mockReset());
 container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });
async function navigate(path: string, initial: GameMenu[] = []) {
 state.path = path;
 await act(async () => { root.render(<SiteHeader account={signedOutSidebarAccount} gameMenus={initial} gamePaths={[gta.href, terraria.href]} />); });
}
const primary = () => [...container.querySelectorAll('nav[aria-label="Primary"] a')].map(a => a.getAttribute("href"));
it("follows Roblox → GTA → Terraria → Roblox without fetching on Roblox", async () => {
 fetchMenu.mockImplementation(async (url: string) => ({ ok: true, json: async () => ({ menu: url.includes("gta-5") ? gta : terraria }) }));
 await navigate("/wiki/the-forge");
 expect(primary()).toEqual(siteNavLinks.map(link => link.href)); expect(fetchMenu).not.toHaveBeenCalled();
 await navigate(gta.href);
 expect(primary()).toEqual([gta.href]); expect(state.drawerMenus).toEqual([gta]);
 expect(resolveSearchScope(state.path, {}, state.searchMenus).scope).toBe("games");
 await navigate(terraria.href);
 expect(primary()).toEqual([terraria.href]); expect(state.searchMenus).toEqual([terraria]);
 await navigate("/wiki/the-forge");
 expect(primary()).toEqual(siteNavLinks.map(link => link.href)); expect(state.searchMenus).toEqual([]);
 expect(resolveSearchScope(state.path, {}, state.searchMenus).scope).toBe("wiki");
 expect(fetchMenu).toHaveBeenCalledTimes(2);
});
it("uses the server menu initially and falls back when the next game request fails", async () => {
 await navigate(gta.href, [gta]); expect(primary()).toEqual([gta.href]); expect(fetchMenu).not.toHaveBeenCalled();
 fetchMenu.mockRejectedValue(new Error("offline"));
 await navigate(terraria.href, [gta]);
 expect(primary()).toEqual(siteNavLinks.map(link => link.href)); expect(state.searchMenus).toEqual([]);
});
it("ignores an old request that finishes after navigation to Roblox", async () => {
 let finish!: (value: unknown) => void;
 fetchMenu.mockReturnValue(new Promise(resolve => { finish = resolve; }));
 await navigate("/wiki/the-forge"); await navigate(gta.href); await navigate("/wiki/the-forge");
 await act(async () => { finish({ ok: true, json: async () => ({ menu: gta }) }); });
 expect(primary()).toEqual(siteNavLinks.map(link => link.href)); expect(state.searchMenus).toEqual([]);
});

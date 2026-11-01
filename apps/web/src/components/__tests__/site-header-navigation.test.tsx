// @vitest-environment jsdom
import { act, type ComponentProps } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { GameMenu } from "@/lib/game-site-navigation";
const state = vi.hoisted(() => ({ path: "/wiki/the-forge", searchMenus: [] as GameMenu[] }));
vi.mock("next/navigation", () => ({ usePathname: () => state.path }));
vi.mock("next/link", () => ({ default: ({ children, ...props }: ComponentProps<"a">) => <a {...props}>{children}</a> }));
vi.mock("@/components/SiteLogo", () => ({ SiteLogo: () => null }));
vi.mock("@/components/AccountSheetButton", () => ({ AccountSheetButton: () => null }));
vi.mock("@/components/SiteFeedbackButton", () => ({ SiteFeedbackButton: () => null }));
vi.mock("@/components/ThemeToggle", () => ({ ThemeToggle: () => null }));
vi.mock("@/components/GlobalSearchOverlay", () => ({ GlobalSearchOverlay: ({ gameMenus }: { gameMenus: GameMenu[] }) => { state.searchMenus = gameMenus; return null; } }));
import { SiteHeader } from "../SiteHeader";
import { GameMenuBridge } from "../games/GameMenuBridge";
import { publishGameMenu } from "@/lib/game-menu-store";
import { signedOutSidebarAccount, siteNavLinks } from "@/lib/site-navigation";
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
async function navigate(path: string, menu?: GameMenu | null) {
 state.path = path;
 await act(async () => { root.render(<><SiteHeader account={signedOutSidebarAccount} />{menu !== undefined && <GameMenuBridge key={path} path={path} menu={menu} />}</>); });
}
const primary = () => [...container.querySelectorAll('nav[aria-label="Primary"] a')].map(a => a.getAttribute("href"));
const drawer = () => container.querySelector("#site-more-drawer")!;
it("follows Roblox → GTA → Terraria → Roblox using page menus without requests", async () => {
 await navigate("/wiki/the-forge");
 expect(primary()).toEqual(siteNavLinks.map(link => link.href));
 await navigate(gta.href, gta);
 expect(primary()).toEqual([gta.href]); expect(drawer().textContent).toContain(gta.title);
 expect(state.searchMenus).toEqual([gta]);
 await navigate(terraria.href, terraria);
 expect(primary()).toEqual([terraria.href]); expect(drawer().textContent).toContain(terraria.title);
 expect(drawer().textContent).not.toContain(gta.title);
 expect(state.searchMenus).toEqual([terraria]);
 await navigate("/wiki/the-forge");
 expect(primary()).toEqual(siteNavLinks.map(link => link.href)); expect(state.searchMenus).toEqual([]);
 expect(drawer().textContent).not.toContain(terraria.title);
 expect(fetchMenu).not.toHaveBeenCalled();
});
it("uses the bridge on a direct game visit and falls back when the next menu is unavailable", async () => {
 await navigate(gta.href, gta); expect(primary()).toEqual([gta.href]);
 await navigate(terraria.href, null);
 expect(primary()).toEqual(siteNavLinks.map(link => link.href)); expect(state.searchMenus).toEqual([]);
 expect(fetchMenu).not.toHaveBeenCalled();
});
it("hides an outgoing menu even while its bridge is still mounted", async () => {
 await navigate(gta.href, gta);
 state.path = "/wiki/the-forge";
 await act(async () => { root.render(<><SiteHeader account={signedOutSidebarAccount} /><GameMenuBridge key={gta.href} path={gta.href} menu={gta} /></>); });
 expect(primary()).toEqual(siteNavLinks.map(link => link.href));
 expect(state.searchMenus).toEqual([]);
});
it("does not let late outgoing cleanup clear the next game's menu", async () => {
 await navigate(terraria.href);
 let clearOld!: () => void;
 let clearNew!: () => void;
 await act(async () => {
  clearOld = publishGameMenu(gta.href, gta);
  clearNew = publishGameMenu(terraria.href, terraria);
  clearOld();
 });
 expect(primary()).toEqual([terraria.href]);
 await act(async () => clearNew());
 expect(primary()).toEqual(siteNavLinks.map(link => link.href));
});

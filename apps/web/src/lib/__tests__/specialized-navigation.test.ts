import { describe, expect, it, vi } from "vitest";
import { resolveSearchScope, siteNavGroupsForPath, siteNavLinksForPath } from "../site-navigation";

const paths = {
  "/gta": "/games/gta", "/gta/wiki": "/games/gta", "/gta/maps": "/games/gta",
  "/gta/maps/gta5": "/maps/gta5", "/gta/checklists": "/games/gta",
  "/red-dead": "/games/red-dead", "/red-dead/wiki": "/games/red-dead",
  "/red-dead/wiki/red-dead-redemption-2/horses": "/wiki/red-dead-redemption-2/horses",
  "/minecraft": "/games/minecraft", "/minecraft/wiki": "/games/minecraft", "/minecraft/tools": "/games/minecraft",
  "/minecraft/java/wiki": "/wiki/minecraft-java"
};
describe("specialized navigation follows registry ownership", () => {
  it.each([
    ["/maps/gta5", "GTA"], ["/wiki/red-dead-redemption-2/horses", "Red Dead"],
    ["/wiki/minecraft-java/enchantments/page/2", "Minecraft"]
  ])("keeps the franchise group on %s", (path, label) => {
    expect(siteNavGroupsForPath(path, paths)[0].label).toBe(label);
    expect(resolveSearchScope(path, paths).label).toBe(label);
    expect(siteNavLinksForPath(path, paths).every(link => !/^\/(gta|red-dead|minecraft)(\/|$)/.test(link.href))).toBe(true);
  });
  it("leaves unmoved namespaces on their existing links", () => {
    expect(siteNavLinksForPath("/gta/wiki/gta-5")[0].href).toBe("/gta");
  });
  it("does not infer ownership from an unrelated shared slug", () => {
    expect(siteNavGroupsForPath("/wiki/unrelated", paths)[0].label).toBe("Browse");
  });
});

// HEAD leaves every curated namespace destination untouched before a move,
// even when the registry already contains legacy aliases to namespace pages.
const state = vi.hoisted(() => ({ moved: false }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/game-registry", () => ({ getGameRoot: async (namespace: string) => ({ url_style: state.moved && namespace === "gta" ? "page_type" : "namespace" }) }));
vi.mock("@/lib/site-route-snapshot", () => ({ readRedirectSnapshot: async () => ({ exact: new Map([
  ["/gta", { path: "/gta", status: "old", page_id: "root", resolved_target: state.moved ? "/games/gta" : "/gta/wiki" }],
  ["/minecraft/wiki", { path: "/minecraft/wiki", status: "old", page_id: "edition", resolved_target: "/minecraft/java/wiki" }],
]), prefixes: [] }) }));
import { gameLinkPaths } from "../game-link-paths";
it("preserves existing aliases in home, navigation and sidebar links until their namespace moves", async () => {
  state.moved = false;
  expect(await gameLinkPaths()).toEqual({});
  state.moved = true;
  expect(await gameLinkPaths()).toEqual({ "/gta": "/games/gta" });
});

// Fixed HEAD navigation, including ordering and labels.
it.each([
  ["/gta/wiki/gta-5", [["/gta", "GTA Home"], ["/gta/wiki", "GTA Wiki"], ["/gta/maps", "Interactive Maps"], ["/gta/checklists", "Checklists"], ["/games", "All Games"]]],
  ["/red-dead/wiki/red-dead-redemption-2", [["/red-dead", "Red Dead Home"], ["/red-dead/wiki", "Red Dead Wiki"], ["/games", "All Games"]]],
  ["/minecraft/java/wiki", [["/minecraft", "Minecraft Home"], ["/minecraft/wiki", "Minecraft Wiki"], ["/minecraft/tools", "Tools"], ["/games", "All Games"]]],
] as const)("preserves committed navigation at %s", (path, expected) => {
  expect(siteNavLinksForPath(path).map(link => [link.href, link.label])).toEqual(expected);
  expect(siteNavGroupsForPath(path)[0].links.map(link => [link.href, link.label])).toEqual(expected);
});

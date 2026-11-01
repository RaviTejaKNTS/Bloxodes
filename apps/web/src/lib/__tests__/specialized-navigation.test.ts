import { describe, expect, it } from "vitest";
import { resolveSearchScope, siteNavGroupsForPath, siteNavLinksForPath } from "../site-navigation";

const paths = {
  "/gta": "/games/gta", "/gta/wiki": "/games/gta", "/gta/maps": "/games/gta",
  "/gta/maps/gta5": "/maps/gta5", "/gta/checklists": "/games/gta",
  "/red-dead": "/games/red-dead", "/red-dead/wiki": "/games/red-dead",
  "/red-dead/wiki/red-dead-redemption-2/horses": "/wiki/red-dead-redemption-2/horses",
  "/minecraft": "/games/minecraft", "/minecraft/wiki": "/games/minecraft", "/minecraft/tools": "/games/minecraft",
  "/minecraft/java/wiki": "/wiki/minecraft-java"
};
const menus = [
  { namespace: "gta", title: "GTA", href: "/games/gta", image: "/cover.webp", pages: [{ kind: "map", gameId: "gta5", title: "Map", href: "/maps/gta5" }] },
  { namespace: "red-dead", title: "Red Dead", href: "/games/red-dead", image: "/cover.webp", pages: [{ kind: "wiki", gameId: "rdr2", title: "RDR2", href: "/wiki/red-dead-redemption-2" }] },
  { namespace: "minecraft", title: "Minecraft", href: "/games/minecraft", image: "/cover.webp", pages: [{ kind: "wiki", gameId: "java", title: "Java", href: "/wiki/minecraft-java" }] }
];
describe("specialized navigation follows registry ownership", () => {
  it.each([
    ["/maps/gta5", "GTA"], ["/wiki/red-dead-redemption-2/horses", "Red Dead"],
    ["/wiki/minecraft-java/enchantments/page/2", "Minecraft"]
  ])("keeps the franchise group on %s", (path, label) => {
    expect(siteNavGroupsForPath(path, paths, menus)[0].label).toBe(label);
    expect(resolveSearchScope(path, paths, menus).scope).toBe("games");
    expect(siteNavLinksForPath(path, paths, menus).every(link => !/^\/(gta|red-dead|minecraft)(\/|$)/.test(link.href))).toBe(true);
  });
  it("uses global navigation when no published menu owns the path", () => {
    expect(siteNavLinksForPath("/gta/wiki/gta-5")[0].href).toBe("/");
  });
  it("does not infer ownership from an unrelated shared slug", () => {
    expect(siteNavGroupsForPath("/wiki/unrelated", paths)[0].label).toBe("Browse");
  });
});

it.each(menus)("uses published navigation for $namespace", menu => {
  const expected = [[menu.href, menu.title], ...menu.pages.map(page => [page.href, page.title])];
  expect(siteNavLinksForPath(menu.pages[0].href, {}, menus).map(link => [link.href, link.label])).toEqual(expected);
  expect(siteNavGroupsForPath(menu.pages[0].href, {}, menus)[0].links.map(link => [link.href, link.label])).toEqual(expected);
});

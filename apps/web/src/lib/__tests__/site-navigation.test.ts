import { describe, expect, it } from "vitest";
import { siteNavGroupsForPath, siteNavLinksForPath, siteNavLinks } from "../site-navigation";
import { gameMenuForPath, gameSidebarLinks, gameRelatedPages, type GameMenu } from "../game-site-navigation";
import { gameCollectionProgressOptions } from "../game-collection-progress-options";
import { gameChecklistConfig } from "../engagement/config";
import { engagementProgressKey } from "../engagement/types";

export function menuFor(namespace: string): GameMenu {
  return { namespace, title: namespace, href: `/games/${namespace}`, image: "/cover.webp", pages: [
    { kind: "wiki", gameId: "owner", title: "Wiki", href: `/wiki/${namespace}-game` },
    { kind: "collection", gameId: "owner", title: "Items", href: `/wiki/${namespace}-game/items` },
    ...["map", "checklist", "quiz", "tool", "code", "catalog"].map(kind => ({ kind, gameId: "owner", title: kind, href: `/${kind}s/${namespace}-game` })),
    { kind: "tool", gameId: "sibling", title: "Sibling tool", href: `/tools/${namespace}-sibling` }
  ] };
}
it("keeps the Roblox menu for unowned paths", () => expect(siteNavLinksForPath("/wiki/the-forge")).toBe(siteNavLinks));
describe.each(["gta", "red-dead", "minecraft", "arc-raiders"])("%s shared navigation", namespace => {
  const menu = menuFor(namespace);
  it("uses stored page-type links and lists only available page types", () => {
    const groups = siteNavGroupsForPath(menu.pages[1].href, {}, [menu]);
    expect(groups.map(group => group.label)).toEqual([namespace, "Browse"]);
    expect(groups[0].links.map(link => link.href)).toEqual([menu.href, ...menu.pages.filter(page => page.kind !== "collection").map(page => page.href)]);
    expect(groups[1].links).toBe(siteNavLinks);
    const sparse = { ...menu, pages: menu.pages.slice(0, 2) };
    expect(siteNavLinksForPath(sparse.href, {}, [sparse]).map(link => link.href)).toEqual([menu.href, menu.pages[0].href]);
    expect(gameMenuForPath(`${menu.pages[1].href}/page/2`, [menu])).toBe(menu);
    expect(gameMenuForPath(`${menu.href}-other`, [menu])).toBeUndefined();
  });
  it("scopes sidebar and wiki related links to the owner", () => {
    expect(gameSidebarLinks(menu, "owner")).toHaveLength(8);
    expect(gameRelatedPages(menu, "owner").map(page => page.kind)).toEqual(["map", "checklist", "quiz", "tool", "code", "catalog"]);
    expect(gameSidebarLinks(menu, "missing")).toEqual([]);
  });
  it("keeps saved collection and standalone checklist keys", () => {
    const options = gameCollectionProgressOptions(namespace);
    expect(options.storageKeyPrefix + "saved-code").toBe(`${namespace}-collection:saved-code`);
    expect(options.eventName).toBe(`${namespace}-collection-progress`);
    expect(options.endpoint).toBe(`/api/games/${namespace}/collections/progress`);
    const config = gameChecklistConfig(namespace, `/checklists/${namespace}-game`);
    expect(config.basePath).toBe("/checklists");
    expect(engagementProgressKey(config.progressNamespace, "saved-slug")).toBe(`${namespace}:saved-slug`);
  });
});

import { describe, expect, it } from "vitest";
import { isNavLinkActive, resolveSearchScope, siteNavLinks, siteNavLinksForPath } from "@/lib/site-navigation";
import { cacheTagsForEvent, cacheTagsForPath } from "@/lib/public-cache-tags";

describe("Minecraft navigation and publication invalidation", () => {
  it("keeps the edition directory and tool navigation", () => {
    const menu = { namespace: "minecraft", title: "Minecraft", href: "/games/minecraft", image: "/cover.webp", pages: [{ kind: "wiki", gameId: "java", title: "Java", href: "/wiki/minecraft-java" }, { kind: "collection", gameId: "java", title: "Enchantments", href: "/wiki/minecraft-java/enchantments" }] };
    expect(siteNavLinksForPath(menu.pages[1].href, {}, [menu]).map(link => link.href)).toEqual([menu.href, menu.pages[0].href]);
    expect(siteNavLinksForPath("/minecraft-tools")).toBe(siteNavLinks);
    expect(isNavLinkActive(menu.pages[1].href, menu.pages[0].href)).toBe(true);
    expect(resolveSearchScope(menu.pages[1].href, {}, [menu])).toEqual({ scope: "games", label: "games" });
    expect(resolveSearchScope("/minecraft-tools").scope).not.toBe("minecraft");
  });

  it("uses shared publication events and stored page dependencies", () => {
    expect(cacheTagsForEvent("game_content", "wiki/minecraft-bedrock/enchantments")).toContain("sitemap:games");
    expect(cacheTagsForPath("/wiki/minecraft-bedrock/enchantments/page/99")).toContain("page:/wiki/minecraft-bedrock/enchantments");
    expect(cacheTagsForPath("/tools/minecraft-xp-calculator")).toContain("page:/tools/minecraft-xp-calculator");
  });
});

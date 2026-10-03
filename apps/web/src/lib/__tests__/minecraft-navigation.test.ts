import { describe, expect, it } from "vitest";
import { isNavLinkActive, minecraftNavLinks, resolveSearchScope, siteNavLinks, siteNavLinksForPath } from "@/lib/site-navigation";
import { cacheTagsForEvent, cacheTagsForPath } from "@/lib/public-cache-tags";

describe("Minecraft navigation and publication invalidation", () => {
  it("uses one wiki hub with collection and tool routes", () => {
    expect(minecraftNavLinks.map((link) => link.href)).toEqual(["/minecraft", "/minecraft/wiki", "/minecraft/tools", "/games"]);
    expect(siteNavLinksForPath("/minecraft/wiki/enchantments")).toBe(minecraftNavLinks);
    expect(siteNavLinksForPath("/minecraft-tools")).toBe(siteNavLinks);
    expect(isNavLinkActive("/minecraft/wiki/enchantments", "/minecraft")).toBe(false);
    expect(isNavLinkActive("/minecraft/wiki/enchantments", "/minecraft/wiki")).toBe(true);
    expect(resolveSearchScope("/minecraft/tools/xp-calculator")).toEqual({ scope: "minecraft", label: "Minecraft" });
    expect(resolveSearchScope("/minecraft-tools").scope).not.toBe("minecraft");
  });

  it("invalidates published collections, their pagination, tool dependencies and indexes", () => {
    const tags = cacheTagsForEvent("minecraft_wiki_collection", "enchantments");
    for (const path of ["/minecraft", "/minecraft/wiki", "/minecraft/wiki/enchantments", "/minecraft/wiki/enchantments/page/2", "/minecraft/tools/anvil-enchantment-planner", "/sitemaps/minecraft.xml", "/feed.xml"]) {
      expect(cacheTagsForPath(path).some((tag) => tags.includes(tag)), path).toBe(true);
    }
    expect(tags).toContain("minecraft-wiki-collection:enchantments");
    expect(tags).not.toContain("wiki-collection-index");
    expect(tags).not.toContain("tools-index");
  });

  it("refreshes cached wiki identity and isolated tool metadata", () => {
    expect(cacheTagsForEvent("minecraft_game", "minecraft")).toEqual(expect.arrayContaining(["minecraft-games-index", "minecraft-game:minecraft", "minecraft-wiki:minecraft"]));
    expect(cacheTagsForEvent("minecraft_wiki", "minecraft")).toContain("minecraft-wiki:minecraft");
    expect(cacheTagsForEvent("minecraft_tool", "xp-calculator")).toContain("minecraft-tool:xp-calculator");
    for (const event of ["minecraft_game", "minecraft_wiki"] as const) {
      expect(cacheTagsForPath("/minecraft/wiki/weapons").some(tag => cacheTagsForEvent(event, "minecraft").includes(tag))).toBe(true);
    }
  });
});

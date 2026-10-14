import { describe, expect, it } from "vitest";
import { gtaNavLinks, minecraftNavLinks, redDeadNavLinks, siteNavGroupsForPath, siteNavLinks } from "@/lib/site-navigation";

describe("More drawer link groups", () => {
  it("lists every site section once outside the franchise sections", () => {
    const groups = siteNavGroupsForPath("/wiki/the-forge");
    expect(groups.map((group) => group.label)).toEqual(["Browse"]);
    expect(groups[0].links).toBe(siteNavLinks);
  });

  it.each([
    ["/gta/wiki/gta-5/vehicles", "GTA", gtaNavLinks],
    ["/red-dead/wiki/red-dead-redemption-2/cigarette-cards", "Red Dead", redDeadNavLinks],
    ["/minecraft/bedrock/wiki/enchantments", "Minecraft", minecraftNavLinks]
  ])("puts the franchise pages first on %s and keeps every site section", (path, label, franchiseLinks) => {
    const groups = siteNavGroupsForPath(path);
    expect(groups.map((group) => group.label)).toEqual([label, "Browse"]);
    expect(groups[0].links).toBe(franchiseLinks);
    const hrefs = groups.flatMap((group) => group.links.map((link) => link.href));
    expect(new Set(hrefs).size).toBe(hrefs.length);
    for (const link of siteNavLinks) expect(hrefs).toContain(link.href);
  });
});

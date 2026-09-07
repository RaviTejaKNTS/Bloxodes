import { describe, expect, it } from "vitest";
import { gtaWikiNavLinks, isGtaWikiNavLinkActive } from "@/lib/site-navigation";

describe("GTA wiki sidebar navigation", () => {
  it("lists every released GTA wiki once in newest-first order", () => {
    expect(gtaWikiNavLinks).toHaveLength(16);
    expect(gtaWikiNavLinks[0]).toEqual({ href: "/gta/wiki/gta-online", label: "GTA Online" });
    expect(gtaWikiNavLinks.at(-1)).toEqual({ href: "/gta/wiki/gta", label: "Grand Theft Auto" });
    expect(new Set(gtaWikiNavLinks.map((link) => link.href)).size).toBe(gtaWikiNavLinks.length);
  });

  it("keeps GTA VI out of the released-game list", () => {
    expect(gtaWikiNavLinks.some((link) => link.href.includes("gta-6"))).toBe(false);
  });

  it("keeps a game highlighted while browsing one of its collections", () => {
    expect(isGtaWikiNavLinkActive(
      "/gta/wiki/gta-online/action-figures",
      "/gta/wiki/gta-online"
    )).toBe(true);
    expect(isGtaWikiNavLinkActive(
      "/gta/wiki/gta-online/action-figures",
      "/gta/wiki/gta-5"
    )).toBe(false);
  });
});

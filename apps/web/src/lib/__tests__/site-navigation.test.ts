import { describe, expect, it } from "vitest";
import { gtaWikiNavLinks, isGtaWikiNavLinkActive } from "@/lib/site-navigation";

describe("GTA wiki sidebar navigation", () => {
  it("lists every approved GTA wiki once in newest-first order", () => {
    expect(gtaWikiNavLinks).toHaveLength(17);
    expect(gtaWikiNavLinks[0]).toEqual({ href: "/gta/wiki/gta-6", label: "GTA VI" });
    expect(gtaWikiNavLinks[1]).toEqual({ href: "/gta/wiki/gta-online", label: "GTA Online" });
    expect(gtaWikiNavLinks[gtaWikiNavLinks.length - 1]).toEqual({ href: "/gta/wiki/gta", label: "Grand Theft Auto" });
    expect(new Set(gtaWikiNavLinks.map((link) => link.href)).size).toBe(gtaWikiNavLinks.length);
  });

  it("keeps GTA VI highlighted while browsing pre-launch collections", () => {
    for (const collection of ["characters", "locations", "editions", "trailers"]) {
      expect(isGtaWikiNavLinkActive(`/gta/wiki/gta-6/${collection}`, "/gta/wiki/gta-6")).toBe(true);
      expect(isGtaWikiNavLinkActive(`/gta/wiki/gta-6/${collection}`, "/gta/wiki/gta-5")).toBe(false);
    }
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

import { describe, expect, it } from "vitest";
import { isNavLinkActive, redDeadWikiNavLinks } from "../site-navigation";

describe("Red Dead wiki navigation", () => {
  it("lists exactly the five published game hubs", () => {
    expect(redDeadWikiNavLinks.map((link) => link.href)).toEqual([
      "/red-dead/wiki/red-dead-online",
      "/red-dead/wiki/red-dead-redemption-2",
      "/red-dead/wiki/undead-nightmare",
      "/red-dead/wiki/red-dead-redemption",
      "/red-dead/wiki/red-dead-revolver"
    ]);
  });

  it("highlights only the owning game on nested collection routes", () => {
    const path = "/red-dead/wiki/red-dead-redemption-2/dinosaur-bones";
    expect(redDeadWikiNavLinks.filter((link) => isNavLinkActive(path, link.href)).map((link) => link.label))
      .toEqual(["Red Dead Redemption 2"]);
  });

  it("does not activate a game on franchise indexes or other franchises", () => {
    for (const path of ["/red-dead", "/red-dead/wiki", "/gta/wiki/gta-5"]) {
      expect(redDeadWikiNavLinks.some((link) => isNavLinkActive(path, link.href))).toBe(false);
    }
  });
});

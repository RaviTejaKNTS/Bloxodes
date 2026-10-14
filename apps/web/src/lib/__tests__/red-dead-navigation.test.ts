import { describe, expect, it } from "vitest";
import { isNavLinkActive, redDeadNavLinks, siteNavLinksForPath } from "../site-navigation";

describe("Red Dead navigation", () => {
  it("uses the franchise links on every Red Dead route", () => {
    for (const path of ["/red-dead", "/red-dead/wiki", "/red-dead/wiki/red-dead-redemption-2/dinosaur-bones"]) {
      expect(siteNavLinksForPath(path)).toBe(redDeadNavLinks);
    }
  });

  it("highlights the wiki on nested collection routes and the home link only on the landing page", () => {
    const path = "/red-dead/wiki/red-dead-redemption-2/dinosaur-bones";
    expect(redDeadNavLinks.filter((link) => isNavLinkActive(path, link.href)).map((link) => link.label)).toEqual(["Red Dead Wiki"]);
    expect(redDeadNavLinks.filter((link) => isNavLinkActive("/red-dead", link.href)).map((link) => link.label)).toEqual(["Red Dead Home"]);
  });
});

import { expect, it } from "vitest";
import { isNavLinkActive, siteNavLinksForPath } from "../site-navigation";
it("uses the same stored menu contract for Red Dead", () => {
  const menu = { namespace: "red-dead", title: "Red Dead", href: "/games/red-dead", image: "/cover.webp", pages: [{ kind: "wiki", gameId: "rdr2", title: "RDR2", href: "/wiki/red-dead-redemption-2" }, { kind: "collection", gameId: "rdr2", title: "Bones", href: "/wiki/red-dead-redemption-2/dinosaur-bones" }] };
  const links = siteNavLinksForPath(menu.pages[1].href, {}, [menu]);
  expect(links.map(link => link.href)).toEqual([menu.href, menu.pages[0].href]);
  expect(links.filter(link => isNavLinkActive(menu.pages[1].href, link.href)).map(link => link.label)).toEqual(["RDR2"]);
});

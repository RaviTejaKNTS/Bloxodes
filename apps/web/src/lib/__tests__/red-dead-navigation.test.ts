import { expect, it } from "vitest";
import { isNavLinkActive, resolveSearchScope } from "../site-navigation";
it("uses the same stored menu contract for Red Dead", () => {
  const menu = { namespace: "red-dead", title: "Red Dead", href: "/games/red-dead", image: "/cover.webp", pages: [{ kind: "wiki", gameId: "rdr2", title: "RDR2", href: "/wiki/red-dead-redemption-2" }, { kind: "collection", gameId: "rdr2", title: "Bones", href: "/wiki/red-dead-redemption-2/dinosaur-bones" }] };
  expect(resolveSearchScope(menu.pages[1].href, {}, [menu]).scope).toBe("games");
  expect(isNavLinkActive(menu.pages[1].href, "/wiki")).toBe(true);
});

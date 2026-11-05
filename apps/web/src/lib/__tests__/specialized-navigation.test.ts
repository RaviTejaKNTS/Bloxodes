import { describe, expect, it } from "vitest";
import { resolveSearchScope } from "../site-navigation";

const paths = {
  "/gta": "/games/gta", "/gta/wiki": "/games/gta", "/gta/maps": "/games/gta",
  "/gta/maps/gta5": "/maps/gta5", "/gta/checklists": "/games/gta",
  "/red-dead": "/games/red-dead", "/red-dead/wiki": "/games/red-dead",
  "/red-dead/wiki/red-dead-redemption-2/horses": "/wiki/red-dead-redemption-2/horses",
  "/minecraft": "/games/minecraft", "/minecraft/wiki": "/games/minecraft", "/minecraft/tools": "/games/minecraft",
  "/minecraft/java/wiki": "/wiki/minecraft-java"
};
const menus = [
  { namespace: "gta", title: "GTA", href: "/games/gta", image: "/cover.webp", pages: [{ kind: "map", gameId: "gta5", title: "Map", href: "/maps/gta5" }] },
  { namespace: "red-dead", title: "Red Dead", href: "/games/red-dead", image: "/cover.webp", pages: [{ kind: "wiki", gameId: "rdr2", title: "RDR2", href: "/wiki/red-dead-redemption-2" }] },
  { namespace: "minecraft", title: "Minecraft", href: "/games/minecraft", image: "/cover.webp", pages: [{ kind: "wiki", gameId: "java", title: "Java", href: "/wiki/minecraft-java" }] }
];
describe("specialized navigation follows registry ownership", () => {
  it.each([
    ["/maps/gta5", "GTA"], ["/wiki/red-dead-redemption-2/horses", "Red Dead"],
    ["/wiki/minecraft-java/enchantments/page/2", "Minecraft"]
  ])("keeps game search on %s", (path) => {
    expect(resolveSearchScope(path, paths, menus).scope).toBe("games");
  });
  it("does not infer ownership from an unrelated shared slug", () => {
    expect(resolveSearchScope("/wiki/unrelated", paths, menus).scope).toBe("wiki");
  });
});

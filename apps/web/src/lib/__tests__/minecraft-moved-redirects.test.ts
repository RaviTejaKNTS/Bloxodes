import { describe, expect, it } from "vitest";
import { minecraftLegacyRedirect } from "../minecraft-paths";
import { buildRedirectSnapshot, resolveSiteRoute, type RedirectRoute } from "../site-route-resolver";

function resolver(moved: boolean) {
  const paths = ["java", "bedrock"].flatMap(edition => ["", "/enchantments", "/achievements", "/enchantments/page/2"].map(tail => ({
    path: `/minecraft/${edition}/wiki${tail}`, status: "old", match_type: "exact", tail_mode: "drop", match_self: true,
    page_id: "owner", page_type: tail ? "collection" : "wiki", target_url: null,
    resolved_target: `/wiki/minecraft-${edition}${tail}`, redirect_code: 308, origin: "namespace-move"
  } as RedirectRoute)));
  paths.push({ ...paths[0], path: "/minecraft/tools/nether-portal-calculator", resolved_target: "/tools/minecraft-nether-portal-calculator" });
  const snapshot = buildRedirectSnapshot(moved ? paths : []);
  return (path: string) => resolveSiteRoute(snapshot, path)?.target ?? path;
}

describe("Minecraft compatibility redirects across a namespace move", () => {
  it.each([false, true])("legacy edition-less links resolve once (moved=%s)", moved => {
    const base = moved ? "/wiki/minecraft-java" : "/minecraft/java/wiki";
    expect(minecraftLegacyRedirect("/minecraft/wiki/enchantments", "?ref=guide", resolver(moved))).toBe(`${base}/enchantments?ref=guide`);
    expect(minecraftLegacyRedirect("/minecraft/wiki/enchantments/page/2", "", resolver(moved))).toBe(`${base}/enchantments/page/2`);
    const bedrock = moved ? "/wiki/minecraft-bedrock" : "/minecraft/bedrock/wiki";
    expect(minecraftLegacyRedirect("/minecraft/wiki/achievements", "", resolver(moved))).toBe(`${bedrock}/achievements`);
    expect(minecraftLegacyRedirect("/minecraft/wiki/enchantments", "?edition=bedrock&ref=guide", resolver(moved))).toBe(`${bedrock}/enchantments?ref=guide`);
  });
  it("lets the route table handle plain edition URLs", () => {
    expect(minecraftLegacyRedirect("/minecraft/java/wiki/enchantments", "", resolver(true))).toBeNull();
  });
  it("removes edition queries while resolving moved destinations", () => {
    expect(minecraftLegacyRedirect("/minecraft/java/wiki", "?edition=java&ref=x", resolver(true))).toBe("/wiki/minecraft-java?ref=x");
    expect(minecraftLegacyRedirect("/minecraft/tools/nether-portal-calculator", "?edition=bedrock", resolver(true))).toBe("/tools/minecraft-nether-portal-calculator");
  });
  it("keeps the bare legacy wiki available to the route table", () => {
    expect(minecraftLegacyRedirect("/minecraft/wiki", "", resolver(true))).toBeNull();
  });
});

// Hidden legacy owners and Java-missing collections use their exact moved alias.
it("uses exact retirement aliases before the edition fallback", () => {
  const targets: Record<string, string> = {
    "/minecraft/wiki/legacy-minecraft": "/games/minecraft",
    "/minecraft/wiki/bedrock-only/page/4": "/wiki/minecraft-bedrock/bedrock-only/page/4"
  };
  const resolve = (path: string) => targets[path] ?? path;
  expect(minecraftLegacyRedirect("/minecraft/wiki/legacy-minecraft", "?edition=java", resolve)).toBe("/games/minecraft");
  expect(minecraftLegacyRedirect("/minecraft/wiki/bedrock-only/page/4", "?x=1", resolve)).toBe("/wiki/minecraft-bedrock/bedrock-only/page/4?x=1");
});

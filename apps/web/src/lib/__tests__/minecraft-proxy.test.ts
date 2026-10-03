import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { proxy } from "@/proxy";
import { buildMinecraftCollectionPath, minecraftLegacyRedirect } from "@/lib/minecraft-paths";

describe("permanent Minecraft edition routes", () => {
  it("migrates explicit legacy links and preserves pagination and useful queries", () => {
    const response = proxy(new NextRequest("https://bloxodes.com/minecraft/wiki/recipes/page/2?edition=bedrock&view=list"));
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe("https://bloxodes.com/minecraft/bedrock/wiki/recipes/page/2?view=list");
    expect(response.headers.get("set-cookie")).toBeNull();
  });
  it("ignores remembered editions for the directory and fixed legacy migration", () => {
    for (const cookie of ["", "minecraft-edition=java", "minecraft-edition=bedrock"]) {
      const headers = { cookie };
      expect(proxy(new NextRequest("https://bloxodes.com/minecraft/wiki", { headers })).headers.get("location")).toBeNull();
      expect(proxy(new NextRequest("https://bloxodes.com/minecraft/wiki/fuels", { headers })).headers.get("location")).toBe("https://bloxodes.com/minecraft/java/wiki/fuels");
      expect(proxy(new NextRequest("https://bloxodes.com/minecraft/bedrock/wiki/fuels", { headers })).headers.get("location")).toBeNull();
    }
  });
  it("routes exclusive objectives to their fixed edition and strips obsolete queries", () => {
    expect(minecraftLegacyRedirect("/minecraft/wiki/achievements", "")).toBe("/minecraft/bedrock/wiki/achievements");
    expect(minecraftLegacyRedirect("/minecraft/wiki/advancements", "")).toBe("/minecraft/java/wiki/advancements");
    expect(minecraftLegacyRedirect("/minecraft/bedrock/wiki/fuels", "?edition=java&view=list")).toBe("/minecraft/bedrock/wiki/fuels?view=list");
    expect(minecraftLegacyRedirect("/minecraft/wiki", "?edition=java")).toBe("/minecraft/java/wiki");
    expect(minecraftLegacyRedirect("/wiki", "?edition=java")).toBeNull();
    expect(buildMinecraftCollectionPath("minecraft-java", "fuels")).toBe("/minecraft/java/wiki/fuels");
    expect(buildMinecraftCollectionPath("minecraft-bedrock", "fuels")).toBe("/minecraft/bedrock/wiki/fuels");
  });
});

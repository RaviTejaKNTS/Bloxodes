import { NextRequest } from "next/server";
import { expect, it, vi } from "vitest";
import { buildRedirectSnapshot, type RedirectRoute } from "../site-route-resolver";
vi.mock("@/lib/site-route-snapshot", () => ({ readGameIndexPaths: () => new Set(), readRedirectSnapshot: async () => buildRedirectSnapshot([
  ["/minecraft/wiki", "/wiki/minecraft-java", "wiki"],
  ["/minecraft/wiki/recipes", "/wiki/minecraft-java/recipes", "collection"],
  ["/minecraft/wiki/achievements", "/wiki/minecraft-bedrock/achievements", "collection"],
  ["/minecraft/bedrock/wiki/fuels", "/wiki/minecraft-bedrock/fuels", "collection"]
].map(([path, target, page_type]) => ({ path, page_type, page_id: path, resolved_target: target, target_url: null, status: "old", match_type: "exact", tail_mode: "append", match_self: true, redirect_code: 308, origin: "fixture" } as RedirectRoute))) }));
import { proxy } from "@/proxy";
it.each([
 ["/minecraft/wiki?edition=bedrock&ref=guide", "/wiki/minecraft-java?edition=bedrock&ref=guide"],
 ["/minecraft/wiki/recipes/page/2?edition=bedrock&view=list", "/wiki/minecraft-java/recipes/page/2?edition=bedrock&view=list"],
 ["/minecraft/wiki/achievements?edition=java", "/wiki/minecraft-bedrock/achievements?edition=java"],
 ["/minecraft/bedrock/wiki/fuels?edition=java", "/wiki/minecraft-bedrock/fuels?edition=java"]
])("uses the stored default owner for %s", async (path, target) => {
 const response = await proxy(new NextRequest(`https://bloxodes.com${path}`));
 expect(response.status).toBe(308);
 expect(response.headers.get("location")).toBe(`https://bloxodes.com${target}`);
 expect(response.headers.get("set-cookie")).toBeNull();
});

it.each(["/wiki/blox-fruits?edition=bedrock", "/wiki/minecraft-java?edition=bedrock", "/minecraft/tools/test?edition=bedrock"])("leaves unmatched queries alone: %s", async path => {
 const response = await proxy(new NextRequest(`https://bloxodes.com${path}`));
 expect(response.headers.get("location")).toBeNull();
});

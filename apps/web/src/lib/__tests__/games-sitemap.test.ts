import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/game-content-index", () => ({ listSharedGameDiscoveryPages: async () => [
  { namespace: "peak", canonical_path: "/wiki/peak", title: "PEAK" },
  { namespace: "peak", canonical_path: "/maps/peak-map", title: "Map" },
  { namespace: "risk-of-rain", canonical_path: "/games/risk-of-rain", title: "Risk of Rain" },
  { namespace: "risk-of-rain", canonical_path: "/wiki/risk-of-rain-2/items", title: "Items" },
  { namespace: "unmoved", canonical_path: "/unmoved/tools/cost", title: "Cost" }
] }));
vi.mock("@/lib/game-registry", () => ({ getGameRoot: async (namespace: string) => ({ namespace, url_style: namespace === "unmoved" ? "namespace" : "page_type" }) }));
vi.mock("@/lib/game-landing", () => ({
  getGameLandingForLinks: async (namespace: string) => ({ root: { namespace }, isAlias: true, path: namespace === "peak" ? "/wiki/peak" : namespace === "unmoved" ? "/unmoved/wiki" : "/games/risk-of-rain" }),
  gameLandingSitemapEntries: (landing: { path: string }) => [{ loc: `https://bloxodes.com${landing.path}` }]
}));
import { GET } from "@/app/sitemaps/games.xml/route";
it("uses owner namespaces and saved paths, emits each URL once and retains unmoved directories", async () => {
  const response = await GET();
  expect(response.status).toBe(200);
  const xml = await response.text();
  const urls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => match[1]);
  expect(new Set(urls).size).toBe(urls.length);
  expect(urls).toContain("https://bloxodes.com/unmoved/tools");
  expect(urls).toContain("https://bloxodes.com/wiki/risk-of-rain-2/items");
  expect(urls).not.toContain("https://bloxodes.com/wiki/maps");
  expect(urls).not.toContain("https://bloxodes.com/peak");
});

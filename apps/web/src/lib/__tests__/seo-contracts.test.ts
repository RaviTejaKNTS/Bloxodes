import { describe, expect, it } from "vitest";
import {
  CRITICAL_SEO_PATHS,
  SEO_ROUTE_CONTRACTS,
  expectedCanonicalPath,
  findSeoRouteContract,
  isPrivateRoute
} from "@/lib/seo-contracts";

describe("SEO route contracts", () => {
  it("defines one unique sitemap per public family", () => {
    const families = SEO_ROUTE_CONTRACTS.map((contract) => contract.family);
    const sitemaps = SEO_ROUTE_CONTRACTS.map((contract) => contract.sitemapPath);
    expect(new Set(families).size).toBe(families.length);
    expect(new Set(sitemaps).size).toBe(sitemaps.length);
  });

  it("maps representative routes to the expected family", () => {
    expect(findSeoRouteContract("/codes/fisch")?.family).toBe("codes");
    expect(findSeoRouteContract("/catalog/roblox-music-ids")?.family).toBe("catalog");
    expect(findSeoRouteContract("/wiki/grow-a-garden/pets")?.family).toBe("wiki");
    expect(findSeoRouteContract("/stats/games/example")?.family).toBe("stats");
  });

  it("keeps API, auth and account routes private", () => {
    expect(isPrivateRoute("/api/health")).toBe(true);
    expect(isPrivateRoute("/auth/roblox/callback")).toBe(true);
    expect(isPrivateRoute("/account/settings")).toBe(true);
    expect(isPrivateRoute("/articles/example")).toBe(false);
  });

  it("ensures every critical path belongs to a contract", () => {
    expect(CRITICAL_SEO_PATHS.length).toBeGreaterThan(15);
    for (const path of CRITICAL_SEO_PATHS) {
      expect(findSeoRouteContract(path), path).not.toBeNull();
    }
  });

  it("normalizes trailing slashes for canonical comparisons", () => {
    expect(expectedCanonicalPath("/")).toBe("/");
    expect(expectedCanonicalPath("/codes/")).toBe("/codes");
  });
});

import { describe, expect, it } from "vitest";
import { cacheTagsForEvent, cacheTagsForPath, serializeCacheTags } from "@/lib/public-cache-tags";

describe("public cache tags", () => {
  it("tags the codes index separately from code detail pages", () => {
    expect(cacheTagsForPath("/codes")).toContain("codes-index");
    expect(cacheTagsForPath("/codes/page/2")).toContain("codes-index");
    expect(cacheTagsForPath("/codes/car-wash-tycoon")).toEqual(
      expect.arrayContaining(["site", "codes", "code:car-wash-tycoon"])
    );
  });

  it("purges code detail, indexes, home, feed, and sitemap tags for code events", () => {
    const tags = cacheTagsForEvent("code", "Car-Wash-Tycoon");
    expect(tags).toEqual(
      expect.arrayContaining(["code:car-wash-tycoon", "codes-index", "home", "feed", "sitemap", "sitemap:codes"])
    );
    expect(tags).not.toContain("site");
  });

  it("tags wiki catalog pages with both wiki and collection tags", () => {
    expect(cacheTagsForPath("/wiki/slime-rng/slimes")).toEqual(
      expect.arrayContaining(["wiki:slime-rng", "wiki-catalog:slime-rng/slimes", "wiki-catalog-index"])
    );
  });

  it("keeps the sitemap index tag separate from family sitemap tags", () => {
    expect(cacheTagsForPath("/sitemap.xml")).toEqual(expect.arrayContaining(["site", "sitemap"]));
    expect(cacheTagsForPath("/sitemaps/codes.xml")).toEqual(expect.arrayContaining(["site", "sitemap:codes"]));
    expect(cacheTagsForPath("/sitemaps/codes.xml")).not.toContain("sitemap");
  });

  it("serializes unique Cloudflare cache tags", () => {
    expect(serializeCacheTags(["home", "home", "codes-index"])).toBe("home,codes-index");
  });
});

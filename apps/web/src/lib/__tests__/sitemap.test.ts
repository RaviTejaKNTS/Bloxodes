import { describe, expect, it } from "vitest";
import {
  MAIN_SITEMAP_ROUTES,
  buildSitemapIndexXml,
  buildSitemapUrlSetXml,
  toIsoDate,
  withSiteUrl
} from "@/lib/sitemap";

describe("sitemap builders", () => {
  it("builds canonical Bloxodes URLs", () => {
    expect(withSiteUrl("codes")).toBe("https://bloxodes.com/codes");
    expect(withSiteUrl("/codes")).toBe("https://bloxodes.com/codes");
  });

  it("normalizes valid dates and omits invalid values", () => {
    expect(toIsoDate("2026-01-01")).toBe("2026-01-01T00:00:00.000Z");
    expect(toIsoDate("invalid")).toBeUndefined();
  });

  it("escapes URL-set values", () => {
    const xml = buildSitemapUrlSetXml([
      {
        loc: "https://bloxodes.com/stats/games?genre=A&B",
        changefreq: "weekly",
        priority: "0.5"
      }
    ]);
    expect(xml).toContain("A&amp;B");
    expect(xml).toContain("<urlset");
  });

  it("builds sitemap indexes with lastmod", () => {
    const xml = buildSitemapIndexXml([
      { loc: "https://bloxodes.com/sitemaps/codes.xml", lastmod: "2026-01-01T00:00:00.000Z" }
    ]);
    expect(xml).toContain("<sitemapindex");
    expect(xml).toContain("<lastmod>2026-01-01T00:00:00.000Z</lastmod>");
  });

  it("keeps main sitemap paths unique", () => {
    const paths = MAIN_SITEMAP_ROUTES.map((entry) => entry.path);
    expect(new Set(paths).size).toBe(paths.length);
  });
});

import { describe, expect, it, vi } from "vitest";
import { GET } from "@/app/sitemaps/codes.xml/route";
import { listCodePageSitemapDates } from "@/lib/db";

vi.mock("@/lib/db", () => ({ listCodePageSitemapDates: vi.fn() }));

describe("codes sitemap content dates", () => {
  it("uses the same content evidence as the page and keeps unlisted Google paths", async () => {
    vi.mocked(listCodePageSitemapDates).mockResolvedValueOnce([
      {
        slug: "unlisted-game",
        published_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-10-12T00:00:00Z",
        codes: [{ first_seen_at: "2026-09-01T00:00:00Z" }]
      },
      {
        slug: "doors",
        published_at: "2026-01-01T00:00:00Z",
        codes: [{ first_seen_at: "2026-08-01T00:00:00Z" }]
      }
    ]);
    const xml = await (await GET()).text();
    expect(xml).toContain("https://bloxodes.com/codes/unlisted-game");
    expect(xml).toContain("<lastmod>2026-09-01T00:00:00.000Z</lastmod>");
    expect(xml).toContain("<loc>https://bloxodes.com/codes/doors</loc><lastmod>2026-08-01T00:00:00.000Z</lastmod>");
    expect(xml).not.toContain("2026-10-01");
    expect(xml).not.toContain("2026-10-12");
  });
});

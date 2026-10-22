import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/sitemaps/catalog.xml/route";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({ admin: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ supabaseAdmin: mocks.admin }));

afterEach(() => vi.restoreAllMocks());

describe("catalog sitemap core paths", () => {
  it("retains DB lastmod for core paths while supplying missing core entries", async () => {
    const query = {
      select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), not: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [
        { code: "roblox-music-ids", content_updated_at: "2026-10-01", updated_at: "2026-10-20", published_at: "2025-01-01" },
        { code: "roblox-decal-ids", content_updated_at: null, updated_at: "2026-09-30", published_at: "2025-01-01" },
        { code: "free-roblox-items", content_updated_at: null, updated_at: null, published_at: "2025-01-01" }
      ], error: null })
    };
    mocks.admin.mockReturnValue({ from: () => query });
    const response = await GET();
    expect(response.status).toBe(200);
    const xml = await response.text();
    const urls = xml.match(/<url>[\s\S]*?<\/url>/g) ?? [];
    for (const [path, lastmod] of [
      ["roblox-music-ids", "2026-10-01T00:00:00.000Z"],
      ["roblox-decal-ids", "2026-09-30T00:00:00.000Z"],
      ["free-roblox-items", "2025-01-01T00:00:00.000Z"]
    ]) {
      const entries = urls.filter(url => url.includes(`<loc>https://bloxodes.com/catalog/${path}</loc>`));
      expect(entries).toHaveLength(1);
      expect(entries[0]).toContain(`<lastmod>${lastmod}</lastmod>`);
    }
    const colorCodes = urls.find(url => url.includes("/catalog/roblox-color-codes</loc>"));
    expect(colorCodes).toBeDefined();
    expect(colorCodes).not.toContain("<lastmod>");
  });
});

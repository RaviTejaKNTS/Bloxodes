import { describe, expect, it, vi } from "vitest";

const pages = vi.hoisted(() => {
  const dates = { published_at: "2020-01-01T00:00:00Z", created_at: "2020-01-01T00:00:00Z", updated_at: "2020-01-02T00:00:00Z", content_updated_at: "2020-01-02T00:00:00Z" };
  return {
    wiki: [{ ...dates, title: "GTA VI Wiki", canonical_path: "/gta/wiki/gta-6", meta_description: "Pre-launch announcements." }],
    collections: ["characters", "locations", "editions", "trailers"].map(slug => ({
      ...dates, title: `GTA VI ${slug}`, canonical_path: `/gta/wiki/gta-6/${slug}`, meta_description: "Announced details."
    }))
  };
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase", () => ({ supabaseAdmin: () => ({ from: () => {
  const query = {
    select: () => query, eq: () => query, not: () => query, order: () => query, limit: () => query,
    then: (resolve: (result: unknown) => unknown) => resolve({ data: [], error: null })
  };
  return query;
} }) }));
vi.mock("@/lib/game-content-db", () => ({ gameDatabase: (client: unknown) => client }));
vi.mock("@/lib/game-content-index", () => ({ listSharedGameDiscoveryPages: async () => [] }));
vi.mock("@/lib/gta", () => ({
  listPublishedGtaWikiPages: async () => pages.wiki,
  listPublishedGtaWikiCollections: async () => pages.collections
}));
vi.mock("@/lib/minecraft", () => ({
  listPublishedMinecraftWikiPages: async () => [], listPublishedMinecraftCollections: async () => [], listPublishedMinecraftTools: async () => [],
  buildMinecraftWikiPath: vi.fn(), buildMinecraftCollectionPath: vi.fn()
}));

import { GET } from "@/app/feed.xml/route";

describe("GTA pre-launch feed discovery", () => {
  it("includes the published hub and all four collections once using their canonical paths", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    const xml = await response.text();
    for (const page of [...pages.wiki, ...pages.collections]) {
      const link = `<link>https://bloxodes.com${page.canonical_path}</link>`;
      expect(xml.split(link)).toHaveLength(2);
      expect(xml).toContain(`<title>${page.title}</title>`);
    }
    expect(xml).toContain("Pre-launch announcements.");
  });
});

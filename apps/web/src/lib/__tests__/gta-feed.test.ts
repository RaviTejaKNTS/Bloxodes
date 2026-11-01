import { beforeEach, describe, expect, it, vi } from "vitest";

const pages = vi.hoisted(() => {
  const dates = { published_at: "2020-01-01T00:00:00Z", created_at: "2020-01-01T00:00:00Z", updated_at: "2020-01-02T00:00:00Z", content_updated_at: "2020-01-02T00:00:00Z" };
  return {
    moved: false,
    redDeadMoved: false,
    wiki: [{ ...dates, title: "GTA VI Wiki", canonical_path: "/gta/wiki/gta-6", meta_description: "Pre-launch announcements." }],
    collections: ["characters", "locations", "editions", "trailers"].map(slug => ({
      ...dates, title: `GTA VI ${slug}`, canonical_path: `/gta/wiki/gta-6/${slug}`, meta_description: "Announced details."
    }))
  };
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/game-registry", () => ({ getGameRoot: async () => ({ url_style: pages.redDeadMoved ? "page_type" : "namespace" }) }));
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
  listPublishedGtaWikiPages: async () => pages.wiki.map(page => ({ ...page, canonical_path: pages.moved ? page.canonical_path.replace("/gta/wiki/", "/wiki/") : page.canonical_path })),
  listPublishedGtaWikiCollections: async () => pages.collections.map(page => ({ ...page, canonical_path: pages.moved ? page.canonical_path.replace("/gta/wiki/", "/wiki/") : page.canonical_path }))
}));
vi.mock("@/lib/minecraft", () => ({
  listPublishedMinecraftWikiPages: async () => [], listPublishedMinecraftCollections: async () => [], listPublishedMinecraftTools: async () => [],
  buildMinecraftWikiPath: vi.fn(), buildMinecraftCollectionPath: vi.fn()
}));

vi.mock("@/lib/red-dead", () => ({ listPublishedRedDeadWikiPages: async () => [{ ...pages.wiki[0], title: "Red Dead Wiki", canonical_path: pages.redDeadMoved ? "/wiki/red-dead-redemption-2" : "/red-dead/wiki/red-dead-redemption-2" }], listPublishedRedDeadWikiCollections: async () => [{ ...pages.wiki[0], title: "Red Dead horses", canonical_path: pages.redDeadMoved ? "/wiki/red-dead-redemption-2/horses" : "/red-dead/wiki/red-dead-redemption-2/horses" }] }));

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

beforeEach(() => { pages.moved = false; pages.redDeadMoved = false; });
it("lists moved GTA and Red Dead feed entries once at stored URLs", async () => {
  pages.redDeadMoved = true;
  pages.moved = true;
  const xml = await (await GET()).text();
  for (const page of [...pages.wiki, ...pages.collections]) {
    expect(xml).not.toContain(`https://bloxodes.com${page.canonical_path}`);
    expect(xml.split(`<link>https://bloxodes.com${page.canonical_path.replace("/gta/wiki/", "/wiki/")}</link>`)).toHaveLength(2);
  }
  for (const path of ["/wiki/red-dead-redemption-2", "/wiki/red-dead-redemption-2/horses"]) expect(xml.split(`<link>https://bloxodes.com${path}</link>`)).toHaveLength(2);
});

// Membership captured from HEAD: Red Dead is excluded, even if GTA alone moves.
it.each([false, true])("preserves the committed feed membership before Red Dead moves (GTA moved=%s)", async moved => {
  pages.moved = moved;
  const xml = await (await GET()).text();
  const links = [...xml.matchAll(/<item>.*?<link>(.*?)<\/link>/g)].map(match => match[1]);
  const prefix = moved ? "/wiki" : "/gta/wiki";
  expect(links).toEqual([
    "https://bloxodes.com/stats/reports/roblox-september-2026",
    "https://bloxodes.com/stats/reports/roblox-july-2026",
    "https://bloxodes.com/stats/reports/roblox-june-2026",
    ...["", "/characters", "/locations", "/editions", "/trailers"].map(tail => `https://bloxodes.com${prefix}/gta-6${tail}`)
  ]);
});

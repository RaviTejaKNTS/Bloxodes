import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cacheTagsForEvent } from "@/lib/public-cache-tags";

const mocks = vi.hoisted(() => ({
  path: vi.fn(), tag: vi.fn(),
  purge: vi.fn(async () => ({ enabled: false, ok: true, reason: "test" }))
}));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.path, revalidateTag: mocks.tag }));
vi.mock("@/lib/cloudflare-cache", () => ({ purgeCloudflarePublicCache: mocks.purge, warmCloudflarePaths: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ supabaseAdmin: vi.fn() }));

import { POST } from "@/app/api/revalidate/route";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("REVALIDATE_SECRET", "test-secret");
});
afterEach(() => vi.unstubAllEnvs());

async function publish(type: string, slug: string) {
  return POST(new Request("https://bloxodes.com/api/revalidate", {
    method: "POST", headers: { authorization: "Bearer test-secret", "content-type": "application/json" },
    body: JSON.stringify({ type, slug })
  }));
}

describe("GTA pre-launch publication revalidation", () => {
  it("invalidates the GTA VI hub and discovery routes for shared hub publication", async () => {
    expect((await publish("game_content", "gta/wiki/gta-6")).status).toBe(200);
    const paths = mocks.path.mock.calls.map(([path]) => path);
    expect(paths).toEqual(expect.arrayContaining([
      "/gta/wiki/gta-6", "/gta/wiki", "/gta", "/games", "/feed.xml", "/sitemaps/gta.xml"
    ]));
  });

  it.each(["characters", "locations", "editions", "trailers"])("refreshes the parent wiki when the %s collection changes", async (collection) => {
    expect((await publish("game_content", `gta/wiki/gta-6/${collection}`)).status).toBe(200);
    const paths = mocks.path.mock.calls.map(([path]) => path);
    expect(paths).toEqual(expect.arrayContaining([
      "/gta/wiki/gta-6", `/gta/wiki/gta-6/${collection}`, `/gta/wiki/gta-6/${collection}/page/2`,
      "/gta/wiki", "/gta", "/feed.xml", "/sitemap.xml", "/sitemaps/gta.xml"
    ]));
    expect(mocks.purge).toHaveBeenCalledWith(expect.objectContaining({
      paths: expect.arrayContaining(["/gta/wiki/gta-6"]), tags: expect.arrayContaining(["gta", "feed"])
    }));
  });

  it.each([
    ["gta_game", "gta-6"], ["gta_wiki", "gta-6"], ["gta_wiki_collection", "gta-6/characters"]
  ] as const)("keeps %s compatibility events connected to the feed", async (type, slug) => {
    expect((await publish(type, slug)).status).toBe(200);
    expect(mocks.path).toHaveBeenCalledWith("/feed.xml");
    expect(cacheTagsForEvent(type, slug)).toContain("feed");
  });
});

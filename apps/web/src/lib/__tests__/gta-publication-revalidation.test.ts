import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";


const mocks = vi.hoisted(() => ({
  path: vi.fn(), tag: vi.fn(),
  purge: vi.fn(async () => ({ enabled: false, ok: true, reason: "test" }))
}));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.path, revalidateTag: mocks.tag }));
vi.mock("@/lib/cloudflare-cache", () => ({ purgeCloudflarePublicCache: mocks.purge, warmCloudflarePaths: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ supabaseAdmin: vi.fn() }));

vi.mock("@/lib/game-content-revalidation", () => ({gameContentRevalidationTargets: async (slug: string) => ({paths: [`/${slug}`, "/feed.xml", "/sitemaps/games.xml"], tags: ["games-index", `page:/${slug}`], collectionPaths: [`/${slug}`]})}));
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

it.each(["gta", "red-dead", "minecraft", "peak"])("routes %s publication through the same owner resolver", async namespace => {
 const slug = `wiki/${namespace}/items`;
 expect((await publish("game_content", slug)).status).toBe(200);
 expect(mocks.path).toHaveBeenCalledWith(`/${slug}`, "layout");
 expect(mocks.path).toHaveBeenCalledWith("/sitemaps/games.xml");
 expect(mocks.purge).toHaveBeenCalledWith(expect.objectContaining({paginationPrefixes: [`/${slug}/page/`]}));
});

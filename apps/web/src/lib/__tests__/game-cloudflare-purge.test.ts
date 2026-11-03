import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { purgeCloudflarePublicCache } from "../cloudflare-cache";
const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubEnv("CLOUDFLARE_API_TOKEN", "fixture-token");
  vi.stubEnv("CLOUDFLARE_ZONE_ID", "fixture-zone");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset().mockImplementation(async () => new Response(JSON.stringify({ success: true }), { status: 200 }));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
it.each(["prefixes", "files", "everything", "tags-and-prefixes"])("%s uses exact indexes and pagination-only prefixes for game events", async strategy => {
  vi.stubEnv("CLOUDFLARE_PURGE_STRATEGY", strategy);
  const result = await purgeCloudflarePublicCache({ paths: ["/wiki", "/wiki/peak", "/wiki/peak/items"], tags: ["page:/wiki/peak/items"], paginationPrefixes: ["/wiki/peak/items/page/"] });
  expect(result.ok).toBe(true);
  const bodies = fetchMock.mock.calls.map(([, options]) => JSON.parse(options.body));
  expect(bodies).toEqual([
    { files: ["https://bloxodes.com/wiki", "https://bloxodes.com/wiki/peak", "https://bloxodes.com/wiki/peak/items"] },
    { prefixes: ["bloxodes.com/wiki/peak/items/page"] }
  ]);
});
it("failed tag purge falls back without purging the whole wiki prefix", async () => {
  vi.stubEnv("CLOUDFLARE_PURGE_STRATEGY", "tags");
  vi.stubEnv("CLOUDFLARE_TAG_PURGE_FALLBACK", "true");
  fetchMock.mockImplementationOnce(async () => new Response(JSON.stringify({ success: false }), { status: 500 }));
  expect((await purgeCloudflarePublicCache({ paths: ["/wiki"], tags: ["page:/wiki"], paginationPrefixes: [] })).ok).toBe(true);
  const bodies = fetchMock.mock.calls.map(([, options]) => JSON.parse(options.body));
  expect(bodies).toEqual([{ tags: ["page:/wiki"] }, { files: ["https://bloxodes.com/wiki"] }]);
});

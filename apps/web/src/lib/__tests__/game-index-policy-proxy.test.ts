import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { buildRedirectSnapshot, type RedirectRoute } from "../site-route-resolver";
import { googleIndexHeader } from "../seo/google-index-policy";

const state = vi.hoisted(() => ({ policy: vi.fn(), redirects: [] as RedirectRoute[] }));
vi.mock("server-only", () => ({}));
vi.mock("../supabase-admin", () => ({ supabaseAdmin: vi.fn() }));
vi.mock("../site-config", () => ({ SEARCH_INDEXING_ENABLED: true }));
vi.mock("../site-route-snapshot", async importOriginal => {
  const actual = await importOriginal<typeof import("../site-route-snapshot")>();
  return {
    ...actual,
    readGameIndexPaths: (...args: Parameters<typeof actual.readGameIndexPaths>) => state.policy(...args),
    readRedirectSnapshot: async () => buildRedirectSnapshot(state.redirects)
  };
});
import { createGameIndexPolicyCache, SITE_ROUTE_SNAPSHOT_TTL } from "../site-route-snapshot";
import { proxy } from "../../proxy";

const published = [{ path: "/wiki/published-game", status: "live", match_type: "exact", indexableGamePath: true } as RedirectRoute];
const request = (path: string) => new NextRequest(`http://localhost:3000${path}`);
function deferredLoad() {
  let resolve!: (rows: RedirectRoute[]) => void;
  const load = vi.fn(() => new Promise<RedirectRoute[]>(done => { resolve = done; }));
  return { load, resolve: (rows = published) => resolve(rows) };
}

beforeEach(() => { vi.useFakeTimers(); state.policy.mockReset(); state.redirects = []; });
afterEach(() => { vi.useRealTimers(); });

it("cold HTML requests share one policy load before setting Google's header", async () => {
  const pending = deferredLoad();
  state.policy.mockImplementation(createGameIndexPolicyCache(pending.load));
  let completed = false;
  const first = proxy(request("/wiki/published-game")).then(response => { completed = true; return response; });
  const second = proxy(request("/wiki/published-game/page/2"));
  await vi.advanceTimersByTimeAsync(0);
  expect(pending.load).toHaveBeenCalledTimes(1);
  expect(completed).toBe(false);
  pending.resolve();
  for (const response of await Promise.all([first, second])) {
    expect(response.headers.get("X-Robots-Tag")).toBeNull();
  }
});

it("after two seconds cold requests use exactly the static policy, then recover when the load finishes", async () => {
  const pending = deferredLoad();
  state.policy.mockImplementation(createGameIndexPolicyCache(pending.load));
  const paths = [
    "/games/unlisted", "/wiki/published-game", "/maps/unlisted", "/checklists/unlisted",
    "/quizzes/unlisted", "/tools/unlisted", "/codes/unlisted", "/catalog/unlisted",
    "/wiki/rivals", "/codes/rivals", "/tools/robux-to-usd-calculator", "/wiki/rivals?view=list"
  ];
  const responses = paths.map(path => proxy(request(path)));
  await vi.advanceTimersByTimeAsync(2_000);
  for (const [index, response] of (await Promise.all(responses)).entries()) {
    expect(response.headers.get("X-Robots-Tag")).toBe(googleIndexHeader(paths[index]));
  }
  expect(pending.load).toHaveBeenCalledTimes(1);
  pending.resolve();
  await vi.advanceTimersByTimeAsync(0);
  expect((await proxy(request("/wiki/published-game"))).headers.get("X-Robots-Tag")).toBeNull();
});

it("warm requests use the last good policy while a refresh is pending", async () => {
  let now = 0;
  const pending = deferredLoad();
  const load = vi.fn().mockResolvedValueOnce(published).mockImplementation(pending.load);
  const policy = createGameIndexPolicyCache(load, () => now);
  await policy(undefined, true);
  state.policy.mockImplementation(policy);
  now = SITE_ROUTE_SNAPSHOT_TTL + 1;
  const response = await proxy(request("/wiki/published-game"));
  expect(response.headers.get("X-Robots-Tag")).toBeNull();
  expect(load).toHaveBeenCalledTimes(2);
  pending.resolve();
  await vi.advanceTimersByTimeAsync(0);
});

it("redirects never read or wait for a cold policy", async () => {
  state.policy.mockImplementation(() => new Promise(() => {}));
  const hostRedirect = await proxy(new NextRequest("https://www.bloxodes.com/wiki/published-game"));
  expect(hostRedirect.status).toBe(301);
  const pathRedirect = await proxy(request("/minecraft/wiki/fuels"));
  expect(pathRedirect.status).toBe(308);
  expect(state.policy).not.toHaveBeenCalled();
});

it("paths outside HTML game pages do not request a cold-policy wait", async () => {
  state.policy.mockResolvedValue(new Set());
  for (const path of ["/articles/example", "/api/example", "/wiki", "/wiki/example.json"]) {
    await proxy(request(path));
    expect(state.policy).toHaveBeenLastCalledWith(undefined, false);
  }
});

// Exercise the proxy ordering, rather than only minecraftLegacyRedirect in isolation.
it.each([
  ["/minecraft/wiki/achievements/page/2?ref=guide", "/wiki/minecraft-bedrock/achievements/page/2?ref=guide"],
  ["/minecraft/wiki/achievements?page=2", "/wiki/minecraft-bedrock/achievements?page=2"],
  ["/minecraft/wiki/mobs?edition=java&ref=guide", "/wiki/minecraft-java/mobs?ref=guide"],
  ["/minecraft/tools/xp-calculator?edition=bedrock", "/tools/minecraft-xp-calculator"],
])("moved snapshot redirects %s directly to its final owner", async (oldPath, finalPath) => {
  state.redirects = [
    ["/minecraft/wiki/achievements", "/wiki/minecraft-bedrock/achievements"],
    ["/minecraft/java/wiki/mobs", "/wiki/minecraft-java/mobs"],
    ["/minecraft/tools/xp-calculator", "/tools/minecraft-xp-calculator"],
  ].map(([path, target_url]) => ({ path, target_url, page_id: path.endsWith("achievements") ? "achievements-id" : null, page_type: "collection", resolved_target: target_url, tail_mode: "drop", match_self: true, origin: "fixture", status: "old", match_type: "exact", redirect_code: 308 } as RedirectRoute));
  state.policy.mockResolvedValue(new Set());
  const response = await proxy(request(oldPath));
  expect(response.status).toBe(308);
  expect(response.headers.get("location")).toBe(`http://localhost:3000${finalPath}`);
  expect(state.policy).not.toHaveBeenCalled();
});

it("without moved aliases the proxy preserves the namespace edition destination", async () => {
  const response = await proxy(request("/minecraft/wiki/mobs?edition=bedrock&ref=guide"));
  expect(response.status).toBe(308);
  expect(response.headers.get("location")).toBe("http://localhost:3000/minecraft/bedrock/wiki/mobs?ref=guide");
  expect(state.policy).not.toHaveBeenCalled();
});

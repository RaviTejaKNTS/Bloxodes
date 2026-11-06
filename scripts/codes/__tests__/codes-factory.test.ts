import test from "node:test";
import assert from "node:assert/strict";
import { beebomArticles, emptyState, initializeRobloxdenBaseline, pendingKeys, queueDecision, recordAttempt, resolveName, sitemapSlugs, titleToName } from "../discovery-model";
import { codePageFinalSchema } from "../final-contract";
import { CodesQueue, FatalDiscoveryError, makeRequest } from "../discovery-io";

test("sitemap accepts only exact game paths and deduplicates", () => {
  const urls = ["https://robloxden.com/game-codes/test-game", "https://robloxden.com/game-codes/test-game/", "https://robloxden.com/game-codes/genres", "https://robloxden.com/game-codes/categories", "https://robloxden.com/game-codes/genres/action", "https://other.com/game-codes/foo"];
  assert.deepEqual(sitemapSlugs(`<urlset>${urls.map(url => `<url><loc>${url}</loc></url>`).join("")}</urlset>`), ["test-game"]);
});
test("source titles drop date suffixes without damaging the name", () => {
  assert.equal(titleToName("Example Game Codes (November 2026) | Roblox Den"), "Example Game");
  assert.equal(titleToName("Example Game Codes (November 2026) | Beebom"), "Example Game");
});
test("seen entries stay skipped, failed entries retry until cap", () => {
  const state = emptyState(); state.entries.old = { attempts: 0, done: "initial-baseline" };
  recordAttempt(state, "new", "network", 2);
  assert.deepEqual(pendingKeys(["old", "new", "fresh"], state), ["new", "fresh"]);
  assert.match(recordAttempt(state, "new", "network", 2).done!, /given-up/);
  assert.deepEqual(pendingKeys(["new"], state), []);
});
test("dedupe distinguishes unpublished overlap and merges only New rows", () => {
  assert.equal(queueDecision({ is_published: false }, null, "bee"), "existing-unpublished");
  assert.equal(queueDecision(null, { status: "New", urls: ["den"] }, "bee"), "merge");
  assert.equal(queueDecision(null, { status: "Claimed", urls: [] }, "bee"), "already-queued");
  assert.equal(queueDecision(null, null, "bee"), "create");
});
test("name matching refuses approximate and ambiguous games", () => {
  const row = { universe_id: 1, name: "Example: Game!", root_place_id: 2 };
  assert.equal(resolveName("example game", [row])?.universe_id, 1);
  assert.equal(resolveName("example", [row]), null);
  assert.equal(resolveName("example game", [row, { ...row, universe_id: 3 }]), null);
});
const final = { slug: "example-game", name: "Example Game", universe_id: 1, roblox_link: "https://www.roblox.com/games/2", source_url: "https://robloxden.com/game-codes/example-game", source_url_2: null, intro_md: "Intro", redeem_md: "Steps", rewards_md: "Rewards", troubleshoot_md: "Trouble", find_codes_md: "Find", meta_description: "x".repeat(155), game_display_name: "Example Game", interlinking_copy_md: "" };
test("final contract rejects wrong identity, sources, slugs and missing copy", () => {
  assert.ok(codePageFinalSchema.safeParse(final).success);
  for (const patch of [{ slug: "example-codes" }, { universe_id: -1 }, { source_url: null }, { roblox_link: "https://evil.com/games/2" }, { redeem_md: "" }, { meta_description: "short" }, { unknown: "field" }]) assert.equal(codePageFinalSchema.safeParse({ ...final, ...patch }).success, false);
});
test("Beebom first page parsing excludes navigation", () => {
  assert.deepEqual(beebomArticles('<a href="/test-codes/">Test</a><a href="/tag/roblox-codes/">Tag</a>'), ["https://beebom.com/test-codes/"]);
});
test("Notion is queried by universe before merging and retains both sources", async () => {
  const calls: Array<{ route: string; body: any }> = [];
  const queue = new CodesQueue(async (url, init) => {
    calls.push({ route: url, body: init?.body ? JSON.parse(String(init.body)) : null });
    if (url.endsWith("/query")) return JSON.stringify({ results: [{ id: "row", properties: { Status: { select: { name: "New" } }, "RobloxDen URL": { url: "den" }, "Found on": { multi_select: [{ name: "RobloxDen" }] } } }] });
    return "{}";
  }, "mock-token");
  assert.equal(await queue.put({ universe_id: 1, root_place_id: 2, name: "Test" }, "Beebom", "bee", false), "merge");
  assert.equal(calls[0].body.filter.number.equals, 1);
  assert.deepEqual(calls[1].body.properties["Found on"].multi_select, [{ name: "RobloxDen" }, { name: "Beebom" }]);
});
test("Notion auth failures fail immediately without retrying", async () => {
  let calls = 0;
  const request = makeRequest(AbortSignal.timeout(5000), async () => { calls++; return new Response("", { status: 401 }); });
  await assert.rejects(request("https://api.notion.com/v1/data_sources/test", {}, true), FatalDiscoveryError);
  assert.equal(calls, 1);
});
test("dry-run never creates a Notion page", async () => {
  let creates = 0;
  const queue = new CodesQueue(async () => JSON.stringify({ results: [] }), "mock-token", "source", "database", async () => { creates++; throw new Error("Unexpected network"); });
  assert.equal(await queue.put({ universe_id: 1, root_place_id: 2, name: "Test" }, "Beebom", "bee", true), "create");
  assert.equal(creates, 0);
});
test("uncertain Notion creation is never repeated in the same run", async () => {
  let creates = 0;
  const queue = new CodesQueue(async () => JSON.stringify({ results: [] }), "mock-token", "source", "database", async () => { creates++; throw new Error("Connection reset after write"); });
  await assert.rejects(queue.put({ universe_id: 1, root_place_id: 2, name: "Test" }, "Beebom", "bee", false), FatalDiscoveryError);
  assert.equal(creates, 1);
});

test("initial RobloxDen baseline queues nothing; a later added slug is pending", () => {
  const state = emptyState();
  assert.equal(initializeRobloxdenBaseline(state, ["old"]), true);
  assert.deepEqual(pendingKeys(["den:old"], state), []);
  assert.equal(initializeRobloxdenBaseline(state, ["old", "new"]), false);
  assert.deepEqual(pendingKeys(["den:old", "den:new"], state), ["den:new"]);
});

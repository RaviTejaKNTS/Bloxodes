import assert from "node:assert/strict";
import test from "node:test";
import { fetchGamePasses, fetchGamePassThumbnails, refreshGamePasses, saveGamePasses, type GamePass } from "../game-passes";
import { listPublishedWikiUniverseIds } from "../refresh-wiki-game-passes";

type Row = Record<string, any>;
function database(initial: Row[] = [], fail?: "upsert" | "delete" | "select") {
  const rows = new Map(initial.map(row => [row.pass_id, { ...row }]));
  const calls: string[] = [];
  const db = { from(table: string) {
    assert.equal(table, "roblox_universe_gamepasses");
    let operation = "select";
    let payload: Row[] = [];
    let universe = 0;
    let after = 0;
    let limit = 200;
    let deletedIds: number[] = [];
    const chain: any = {
      upsert(input: Row[], options: unknown) { assert.deepEqual(options, { onConflict: "pass_id" }); operation = "upsert"; payload = input; return chain; },
      select() { operation = "select"; return chain; },
      delete() { operation = "delete"; return chain; },
      eq(column: string, id: number) { assert.equal(column, "universe_id"); universe = id; return chain; },
      gt(column: string, id: number) { assert.equal(column, "pass_id"); after = id; return chain; },
      in(column: string, ids: number[]) { assert.equal(column, "pass_id"); deletedIds = ids; return chain; },
      order() { return chain; },
      limit(value: number) { limit = value; return chain; },
      then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) {
        calls.push(operation);
        if (operation === fail) return Promise.resolve({ error: new Error(`${fail} failed`), data: null }).then(resolve, reject);
        if (operation === "upsert") for (const row of payload) rows.set(row.pass_id, row);
        if (operation === "delete") for (const id of deletedIds) if (rows.get(id)?.universe_id === universe) rows.delete(id);
        const data = operation === "select" ? [...rows.values()].filter(row => row.universe_id === universe && row.pass_id > after).sort((a,b) => a.pass_id - b.pass_id).slice(0, limit) : null;
        return Promise.resolve({ error: null, data }).then(resolve, reject);
      }
    };
    return chain;
  }};
  return { db: db as unknown as Parameters<typeof saveGamePasses>[0], rows, calls };
}

const pass = (id: number, extra: Partial<GamePass> = {}): GamePass => ({ id, name: `Pass ${id}`, isForSale: true, price: 799, displayIconImageAssetId: 9000 + id, ...extra });

test("Full pass data requests paginate and deduplicate without dropping off-sale rows", async () => {
  const requests: URL[] = [];
  const rows = await fetchGamePasses(5203828273, async url => {
    const request = new URL(url); requests.push(request);
    return request.searchParams.get("pageToken")
      ? { gamePasses: [pass(1, { price: 349 }), pass(2, { isForSale: false, price: undefined })], nextPageToken: "" }
      : { gamePasses: [pass(1)], nextPageToken: "next" };
  });
  assert.equal(rows.length, 2);
  assert.equal(rows[0].price, 349);
  assert.equal(rows[1].isForSale, false);
  assert.ok(requests.every(url => url.searchParams.get("passView") === "Full"));
  assert.equal(requests[1].searchParams.get("pageToken"), "next");
});

test("HTTP failure, malformed list, invalid IDs, missing Full prices and repeated pagination reject snapshots", async () => {
  for (const response of [{}, { gamePasses: [pass(-1)] }, { gamePasses: [pass(1, { price: undefined })] }, { gamePasses: [pass(1)], nextPageToken: "same" }, { gamePasses: [], nextPageToken: "incomplete" }]) {
    await assert.rejects(fetchGamePasses(1, async () => response));
  }
  let calls = 0;
  await assert.rejects(fetchGamePasses(1, async () => {
    if (++calls === 1) return { gamePasses: [pass(1)], nextPageToken: "next" };
    throw new Error("429 exhausted");
  }), /429 exhausted/);
  assert.equal(calls, 2);
});

test("thumbnail requests deduplicate and batch 100 IDs, accepting only Completed images", async () => {
  const sizes: number[] = [];
  const urls = await fetchGamePassThumbnails([...Array.from({ length: 205 }, (_, i) => pass(i+1)), pass(1)], async url => {
    const ids = new URL(url).searchParams.get("assetIds")!.split(",").map(Number); sizes.push(ids.length);
    return { data: ids.map((id, index) => ({ targetId: id, state: index === 0 ? "Pending" : "Completed", imageUrl: `https://cdn.test/${id}` })) };
  });
  assert.deepEqual(sizes, [100, 100, 5]);
  assert.equal(urls.size, 202);
  assert.equal(urls.has(9001), false);
});

test("save upserts changed prices/icons before pruning only removed passes in this universe", async () => {
  const { db, rows, calls } = database([{ pass_id: 1, universe_id: 10, price: null }, { pass_id: 2, universe_id: 10 }, { pass_id: 3, universe_id: 20 }]);
  await saveGamePasses(db, 10, [pass(1), pass(4, { isForSale: false })], new Map([[9001, "https://cdn.test/current"]]));
  assert.equal(calls[0], "select");
  assert.ok(calls.indexOf("upsert") < calls.indexOf("delete"));
  assert.equal(rows.get(1)?.price, 799);
  assert.equal(rows.get(1)?.icon_image_url, "https://cdn.test/current");
  assert.equal(rows.get(4)?.is_for_sale, false);
  assert.equal(rows.has(2), false);
  assert.equal(rows.has(3), true);
});

test("failed upsert never prunes and failed prune is reported", async () => {
  const fixture = database([{ pass_id: 2, universe_id: 10 }], "upsert");
  await assert.rejects(saveGamePasses(fixture.db, 10, [pass(1)], new Map()), /upsert failed/);
  assert.deepEqual(fixture.calls, ["select", "upsert"]);
  assert.equal(fixture.rows.has(2), true);
  const deletion = database([{ pass_id: 2, universe_id: 10 }], "delete");
  await assert.rejects(saveGamePasses(deletion.db, 10, [], new Map()), /delete failed/);
  assert.equal(deletion.rows.has(2), true);
});

test("a successful empty snapshot removes passes across bounded read pages only for that universe", async () => {
  const fixture = database([...Array.from({ length: 405 }, (_, index) => ({ pass_id: index + 1, universe_id: 10 })), { pass_id: 1000, universe_id: 20 }]);
  await saveGamePasses(fixture.db, 10, [], new Map());
  assert.deepEqual([...fixture.rows.keys()], [1000]);
  assert.equal(fixture.calls.filter(call => call === "delete").length, 3);
});

test("a later page failure preserves the entire stored universe while other universes refresh", async () => {
  const fixture = database([{ pass_id: 5, universe_id: 10 }, { pass_id: 6, universe_id: 20 }]);
  const result = await refreshGamePasses(fixture.db, [10,20,10], async url => {
    if (url.includes("/universes/10/")) {
      if (new URL(url).searchParams.has("pageToken")) throw new Error("page two unavailable");
      return { gamePasses: [pass(1)], nextPageToken: "next" };
    }
    return { gamePasses: [], nextPageToken: "" };
  });
  assert.deepEqual(result.failed, [10]);
  assert.deepEqual(result.refreshed, [20]);
  assert.equal(fixture.rows.has(5), true);
  assert.equal(fixture.rows.has(1), false);
  assert.equal(fixture.rows.has(6), false);
});

test("thumbnail API failure leaves stored rows untouched and fails the affected refresh", async () => {
  const fixture = database([{ pass_id: 5, universe_id: 10 }]);
  const result = await refreshGamePasses(fixture.db, [10], async url => {
    if (url.includes("thumbnails.roblox.com")) throw new Error("thumbnail 503");
    return { gamePasses: [pass(1)], nextPageToken: "" };
  });
  assert.deepEqual(result.failed, [10]);
  assert.deepEqual(fixture.calls, []);
  assert.equal(fixture.rows.has(5), true);
});

test("wiki refresh bounds simultaneous pass requests to two and uses no deep endpoints", async () => {
  let active = 0, peak = 0;
  const fixture = database();
  const result = await refreshGamePasses(fixture.db, Array.from({ length: 41 }, (_, i) => i + 1), async url => {
    assert.ok(url.includes("/game-passes?"));
    peak = Math.max(peak, ++active);
    await new Promise(resolve => setImmediate(resolve));
    active--;
    return { gamePasses: [], nextPageToken: "" };
  });
  assert.equal(peak, 2);
  assert.equal(result.refreshed.length, 41);
});

test("wiki targets page through every published hub and deduplicate universes", async () => {
  const pages = [Array.from({ length: 200 }, (_, i) => ({ slug: String(i).padStart(3, "0"), universe_id: i + 1 })), [{ slug: "last", universe_id: 1 }], []];
  const cursors: string[] = [];
  const db = { from(table: string) {
    assert.equal(table, "wiki_pages");
    const chain: any = {
      select() { return chain; }, eq(key: string, value: boolean) { assert.equal(key, "is_published"); assert.equal(value, true); return chain; },
      not(key: string, op: string, value: null) { assert.equal(key, "universe_id"); assert.equal(op, "is"); assert.equal(value, null); return chain; },
      gt(key: string, value: string) { assert.equal(key, "slug"); cursors.push(value); return chain; }, order() { return chain; }, limit(n: number) { assert.equal(n, 200); return chain; },
      then(resolve: (value: unknown) => unknown) { return Promise.resolve({ data: pages.shift(), error: null }).then(resolve); }
    }; return chain;
  }};
  const ids = await listPublishedWikiUniverseIds(db as unknown as Parameters<typeof listPublishedWikiUniverseIds>[0]);
  assert.equal(ids.length, 200);
  assert.deepEqual(cursors, ["", "199", "last"]);
});

for (const [name, data] of [
  ["missing state", [{ targetId: 9001, imageUrl: "https://cdn.test/unconfirmed" }]],
  ["Pending", [{ targetId: 9001, state: "Pending" }]],
  ["TemporarilyUnavailable", [{ targetId: 9001, state: "TemporarilyUnavailable" }]],
  ["omitted", []],
  ["Completed without URL", [{ targetId: 9001, state: "Completed" }]]
] as const) {
  test(`${name} thumbnails retain the same asset URL while sale and price change; Completed replaces it later`, async () => {
    const fixture = database([{ pass_id: 1, universe_id: 10, icon_image_id: 9001, icon_image_url: "https://cdn.test/stored", price: 799, is_for_sale: true }]);
    const refresh = (rows: unknown[], price: number, isForSale: boolean) => refreshGamePasses(fixture.db, [10], async url =>
      url.includes("thumbnails.roblox.com") ? { data: rows } : { gamePasses: [pass(1, { price, isForSale })] });
    const pending = await refresh([...data], 349, false);
    assert.deepEqual(pending.refreshed, [10]);
    assert.equal(fixture.rows.get(1)?.icon_image_url, "https://cdn.test/stored");
    assert.equal(fixture.rows.get(1)?.price, 349);
    assert.equal(fixture.rows.get(1)?.is_for_sale, false);
    await refresh([{ targetId: 9001, state: "Completed", imageUrl: "https://cdn.test/current" }], 399, true);
    assert.equal(fixture.rows.get(1)?.icon_image_url, "https://cdn.test/current");
    assert.equal(fixture.rows.get(1)?.price, 399);
    assert.equal(fixture.rows.get(1)?.is_for_sale, true);
  });
}

test("new/changed/removed icon assets never inherit a different asset's stored URL", async () => {
  const fixture = database([{ pass_id: 1, universe_id: 10, icon_image_id: 123, icon_image_url: "https://cdn.test/other-asset" }]);
  await saveGamePasses(fixture.db, 10, [pass(1), pass(2)], new Map());
  assert.equal(fixture.rows.get(1)?.icon_image_url, null);
  assert.equal(fixture.rows.get(2)?.icon_image_url, null);
  await saveGamePasses(fixture.db, 10, [pass(1, { displayIconImageAssetId: undefined })], new Map());
  assert.equal(fixture.rows.get(1)?.icon_image_id, null);
  assert.equal(fixture.rows.get(1)?.icon_image_url, null);
});

test("thumbnail coverage rejects unexpected/duplicate targets; failed existing-icon reads never write or prune", async () => {
  for (const data of [[{ targetId: 123, state: "Completed", imageUrl: "bad" }], [{ targetId: 9001 }, { targetId: 9001 }]]) {
    await assert.rejects(fetchGamePassThumbnails([pass(1)], async () => ({ data })), /Unexpected\/duplicate/);
  }
  const fixture = database([{ pass_id: 2, universe_id: 10 }], "select");
  await assert.rejects(saveGamePasses(fixture.db, 10, [pass(1)], new Map()), /select failed/);
  assert.deepEqual(fixture.calls, ["select"]);
  assert.equal(fixture.rows.has(2), true);
});

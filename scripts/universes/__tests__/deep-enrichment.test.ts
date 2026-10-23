import assert from "node:assert/strict";
import test from "node:test";
import { processAttachments, processBatch, processEnrichmentBatches, throwDeepEnrichmentFailures } from "../enrich-roblox-universes";

type Row = Record<string, any>;
const oldMarker = "2020-01-01T00:00:00Z";
const targets = [1, 2, 3].map(id => ({
  universe_id: id, root_place_id: id + 100, last_seen_in_sort: null, last_seen_in_search: null, updated_at: null
}));
function fixture(fail?: { table: string; operation: string; id: number }) {
  const tables: Record<string, Row[]> = {
    roblox_universes: targets.map(row => ({ ...row, last_deep_enriched_at: oldMarker, slug: `game-${row.universe_id}` })),
    roblox_universe_gamepasses: [], roblox_universe_badges: [], roblox_universe_place_servers: []
  };
  const events: string[] = [];
  const earlyUpserts: Row[] = [];
  const db = { from(table: string) {
    assert.ok(table in tables, table);
    let operation = "select";
    let payload: Row[] = [];
    let updates: Row = {};
    let predicate = (_row: Row) => true;
    let sortKey = "";
    let count = Infinity;
    const filter = (next: (row: Row) => boolean) => { const previous = predicate; predicate = row => previous(row) && next(row); };
    const chain: any = {
      select() { return chain; },
      upsert(rows: Row[]) { operation = "upsert"; payload = rows; return chain; },
      insert(rows: Row[]) { operation = "insert"; payload = rows; return chain; },
      delete() { operation = "delete"; return chain; },
      update(row: Row) { operation = "update"; updates = row; return chain; },
      eq(key: string, value: unknown) { filter(row => row[key] === value); return chain; },
      in(key: string, values: unknown[]) { filter(row => values.includes(row[key])); return chain; },
      gt(key: string, value: number) { filter(row => row[key] > value); return chain; },
      order(key: string) { sortKey = key; return chain; }, limit(value: number) { count = value; return chain; },
      then(resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) {
        events.push(`${table}/${operation}`);
        const selected = tables[table].filter(predicate);
        if (fail?.table === table && fail.operation === operation && selected.some(row => row.universe_id === fail.id)) {
          return Promise.resolve({ data: null, error: new Error("injected database failure") }).then(resolve, reject);
        }
        if (operation === "upsert") {
          const key = table === "roblox_universes" ? "universe_id" : "pass_id";
          if (table === "roblox_universes") earlyUpserts.push(...payload);
          for (const row of payload) {
            const existing = tables[table].find(stored => stored[key] === row[key]);
            if (existing) Object.assign(existing, row); else tables[table].push({ ...row });
          }
        }
        if (operation === "insert") tables[table].push(...payload);
        if (operation === "delete") tables[table] = tables[table].filter(row => !predicate(row));
        if (operation === "update") for (const row of selected) Object.assign(row, updates);
        if (sortKey) selected.sort((a, b) => a[sortKey] - b[sortKey]);
        return Promise.resolve({ data: operation === "select" ? selected.slice(0, count).map(row => ({ ...row })) : null, error: null }).then(resolve, reject);
      }
    }; return chain;
  } } as unknown as Parameters<typeof processBatch>[0];
  return { db, tables, events, earlyUpserts };
}

function dependencies(state: ReturnType<typeof fixture>, fail?: "passes" | "badges" | "social" | "groups" | "metadata") {
  const requests: string[] = [];
  const fetcher = async (url: string) => {
    requests.push(url);
    if (url.includes("/game-passes?")) {
      const id = Number(url.match(/universes\/(\d+)/)![1]);
      if (fail === "passes" && id === 1) throw new Error("injected pass failure");
      return { gamePasses: [{ id: id * 10, isForSale: true, price: 99 }] };
    }
    if (url.includes("/badges?")) {
      const id = Number(url.match(/universes\/(\d+)/)![1]);
      if (fail === "badges" && id === 1) throw new Error("injected badge failure");
      return { data: [{ id: id * 100, name: `Badge ${id}` }] };
    }
    if (url.includes("/servers/Public?")) return { data: [{ id: "server", playing: 1 }] };
    throw new Error(`Unexpected endpoint ${url}`);
  };
  const deps: Parameters<typeof processBatch>[3] = {
    fetchUniverseMetadata: async ids => new Map(ids.filter(id => !(fail === "metadata" && id === 1)).map(id => [id, { raw: {}, rootPlaceId: id + 100 }])),
    fetchGameDetails: async ids => ids.map(id => ({ id, rootPlaceId: id + 100, name: `Game ${id}` })),
    fetchGameIcons: async () => [], fetchGameThumbnails: async () => [], upsertMedia: async () => ({ mediaRows: 0 }),
    processAttachments: (db, rows) => processAttachments(db, rows, fetcher),
    syncSocialLinks: async (_db, ids) => {
      state.events.push(`social/${ids.join(",")}`);
      if (fail === "social") throw new Error("injected social failure");
      return ids.length;
    },
    syncGroups: async (_db, metadata) => {
      state.events.push(`groups/${[...metadata.keys()].join(",")}`);
      if (fail === "groups") throw new Error("injected group failure");
      return metadata.size;
    }
  };
  return { deps, requests };
}

test("a pass failure keeps independent work and later batches running, then reports an aggregate failure", async () => {
  const state = fixture();
  const { deps, requests } = dependencies(state, "passes");
  const results: Awaited<ReturnType<typeof processBatch>>[] = [];
  const failures = await processEnrichmentBatches(state.db, targets, "deep", 2, stats => { results.push(stats); }, {
    processBatch: (db, rows, mode) => processBatch(db, rows, mode, deps), pause: async () => {}
  });
  assert.deepEqual(failures.map(failure => [failure.universeId, failure.stage]), [[1, "passes"]]);
  assert.equal(results.length, 2);
  assert.deepEqual(results.map(result => [result.passesCount, result.badgesCount, result.serversCount]), [[1, 2, 2], [1, 1, 1]]);
  for (const target of targets) {
    assert.ok(requests.some(url => url.includes(`/universes/${target.universe_id}/badges?`)));
    assert.ok(requests.some(url => url.includes(`/games/${target.root_place_id}/servers/Public?`)));
    assert.ok(state.tables.roblox_universe_badges.some(row => row.universe_id === target.universe_id));
    assert.ok(state.tables.roblox_universe_place_servers.some(row => row.universe_id === target.universe_id));
  }
  assert.deepEqual(state.events.filter(event => /^(social|groups)\//.test(event)), ["social/1,2", "groups/1,2", "social/3", "groups/3"]);
  assert.equal(state.tables.roblox_universes[0].last_deep_enriched_at, oldMarker);
  assert.notEqual(state.tables.roblox_universes[1].last_deep_enriched_at, oldMarker);
  assert.notEqual(state.tables.roblox_universes[2].last_deep_enriched_at, oldMarker);
  assert.ok(state.earlyUpserts.every(row => !("last_deep_enriched_at" in row)));
  assert.ok(state.events.indexOf("roblox_universes/update") > state.events.indexOf("groups/1,2"));
  assert.throws(() => throwDeepEnrichmentFailures(failures), error => error instanceof AggregateError && /1\/passes/.test(error.message));
});

for (const failure of ["badges", "metadata", "social", "groups"] as const) {
  test(`${failure} failure does not advance incomplete deep freshness or skip independent stages`, async () => {
    const state = fixture();
    const { deps, requests } = dependencies(state, failure);
    const result = await processBatch(state.db, targets.slice(0, 2), "deep", deps);
    assert.ok(result.failures.some(item => item.universeId === 1));
    assert.equal(state.tables.roblox_universes[0].last_deep_enriched_at, oldMarker);
    assert.ok(requests.some(url => url.includes("/games/101/servers/Public?")));
    assert.ok(state.events.some(event => event.startsWith("groups/")));
    if (failure === "social" || failure === "groups") assert.equal(state.tables.roblox_universes[1].last_deep_enriched_at, oldMarker);
    else assert.notEqual(state.tables.roblox_universes[1].last_deep_enriched_at, oldMarker);
    assert.throws(() => throwDeepEnrichmentFailures(result.failures), AggregateError);
  });
}

test("badge/server save errors are checked and leave freshness unchanged while later work finishes", async () => {
  for (const table of ["roblox_universe_badges", "roblox_universe_place_servers"]) {
    const state = fixture({ table, operation: "delete", id: 1 });
    state.tables[table].push({ universe_id: 1 });
    const { deps } = dependencies(state);
    const result = await processBatch(state.db, targets.slice(0, 2), "deep", deps);
    assert.ok(result.failures.some(item => item.universeId === 1 && item.stage.endsWith("save")));
    assert.equal(state.tables.roblox_universes[0].last_deep_enriched_at, oldMarker);
    assert.notEqual(state.tables.roblox_universes[1].last_deep_enriched_at, oldMarker);
    assert.ok(state.events.includes("groups/1,2"));
  }
});

test("light enrichment never changes the deep freshness marker", async () => {
  const state = fixture();
  const { deps } = dependencies(state);
  const result = await processBatch(state.db, targets, "light", deps);
  assert.deepEqual(result.failures, []);
  assert.ok(state.tables.roblox_universes.every(row => row.last_deep_enriched_at === oldMarker));
  assert.ok(state.earlyUpserts.every(row => !("last_deep_enriched_at" in row)));
});

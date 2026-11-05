import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { itemClaimBatches } from "../item-stats-utils";
import { statsRefreshRunStatus } from "../../shared/stats-job-run";

import { internalCatalogItemId, robloxCatalogSortParams, useLiveLegacyBundleIds } from "../../catalog/catalog-discovery-db";
import {
  assignItemStatsTier,
  fetchCatalogItemDetailsBatch,
  fetchResaleDataResult,
  resetRobloxRequestStateForTests,
  robloxTargetId,
  RobloxRateLimitError
} from "../item-stats-utils";
import { assignStatsTier } from "../../universes/stats-tier";

test("canonical item identity keeps asset IDs positive and bundle IDs negative", () => {
  assert.equal(internalCatalogItemId(123, "Asset"), 123);
  assert.equal(internalCatalogItemId(123, "Bundle"), -123);
  assert.equal(robloxTargetId({ asset_id: -123, item_type: "Bundle" }), 123);
});

test("discovery writes to a live legacy bundle row instead of a new canonical row", () => {
  const rows = [
    { asset_id: -365520, item_type: "Bundle" },
    { asset_id: -777, item_type: "Bundle" },
    { asset_id: 365520, item_type: "Asset" }
  ];
  useLiveLegacyBundleIds(rows, new Set([365520]));
  assert.deepEqual(rows.map((row) => row.asset_id), [365520, -777, 365520]);
});

test("catalog discovery maps friendly sort labels to Roblox's numeric API enum", () => {
  assert.deepEqual(robloxCatalogSortParams("MostFavorited"), { sortType: "1", sortAggregation: "5" });
  assert.deepEqual(robloxCatalogSortParams("BestSelling"), { sortType: "2", sortAggregation: "5" });
  assert.deepEqual(robloxCatalogSortParams("RecentlyUpdated"), { sortType: "3" });
  assert.throws(() => robloxCatalogSortParams("NotARealSort"));
});

test("item stats tiers match the universe NEW HOT WARM COLD vocabulary", () => {
  assert.equal(assignItemStatsTier({ name: null }).tier, "NEW");
  assert.equal(assignItemStatsTier({ name: "Limited", category: "Accessories", subcategory: "Head", favorite_count: 5, has_resellers: true, last_item_stats_refreshed_at: "2026-01-01T00:00:00Z" }).tier, "WARM");
  assert.equal(assignItemStatsTier({ name: "Valuable", category: "Accessories", subcategory: "Head", favorite_count: 100_000, last_item_stats_refreshed_at: "2026-01-01T00:00:00Z" }).tier, "HOT");
  assert.equal(assignItemStatsTier({ name: "Popular", category: "Accessories", subcategory: "Head", favorite_count: 15_000, last_item_stats_refreshed_at: "2026-01-01T00:00:00Z" }).tier, "WARM");
  assert.equal(assignItemStatsTier({ name: "Long tail", category: "Accessories", subcategory: "Head", favorite_count: 10, last_item_stats_refreshed_at: "2026-01-01T00:00:00Z" }).tier, "COLD");
  assert.deepEqual(assignItemStatsTier({ catalog_status: "unavailable" }), { tier: "COLD", reason: "catalog_unavailable", refreshHours: 168 });
});

test("universe tiers carry refresh SLAs for NEW HOT WARM and COLD", () => {
  assert.deepEqual(assignStatsTier({}), { tier: "NEW", reason: "new_or_missing_stats", refreshHours: 2 });
  assert.equal(assignStatsTier({ playing: 100, lastStatsRefreshedAt: "2026-01-01T00:00:00Z" }).refreshHours, 1);
  assert.equal(assignStatsTier({ visits: 10_000_000, lastStatsRefreshedAt: "2026-01-01T00:00:00Z" }).refreshHours, 12);
  assert.equal(assignStatsTier({ playing: 0, visits: 0, lastStatsRefreshedAt: "2026-01-01T00:00:00Z" }).refreshHours, 20);
});

test("catalog details sends typed positive Roblox IDs", async (context) => {
  resetRobloxRequestStateForTests();
  let body: Record<string, unknown> | null = null;
  context.mock.method(globalThis, "fetch", async (_input: string | URL | Request, init?: RequestInit) => {
    body = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ data: [{ id: 10 }, { id: 20 }] }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  });

  const rows = await fetchCatalogItemDetailsBatch([
    { asset_id: 10, item_type: "Asset" },
    { asset_id: -20, item_type: "Bundle" }
  ], { userAgent: "test", minRequestMs: 0, maxRetries: 0 });

  assert.equal(rows.length, 2);
  assert.deepEqual(body, { items: [{ itemType: "Asset", id: 10 }, { itemType: "Bundle", id: 20 }] });
});

test("catalog details surfaces exhausted rate limits", async (context) => {
  resetRobloxRequestStateForTests();
  context.mock.method(globalThis, "fetch", async () => new Response("rate limited", {
    status: 429,
    headers: { "retry-after": "0" }
  }));

  await assert.rejects(
    fetchCatalogItemDetailsBatch([{ asset_id: 10, item_type: "Asset" }], { userAgent: "test", minRequestMs: 0, maxRetries: 0 }),
    RobloxRateLimitError
  );
});

test("resale fetch distinguishes unsupported items from transient failures", async (context) => {
  resetRobloxRequestStateForTests();
  context.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({ errors: [{ message: "unsupported" }] }), {
    status: 404,
    headers: { "content-type": "application/json" }
  }));

  const result = await fetchResaleDataResult(10, { userAgent: "test", minRequestMs: 0, maxRetries: 0 });
  assert.equal(result.kind, "unsupported");
});

test("item refresh claims and processes all 1500 rows without exceeding the API cap", async () => {
  const limits: number[] = [];
  let processed = 0;
  for await (const rows of itemClaimBatches({ limit: 1500, assetIds: [], dryRun: false }, async ({ limit }) => {
    assert.equal(processed, limits.reduce((total, size) => total + size, 0), "previous claim must be processed before claiming again");
    limits.push(limit);
    return Array.from({ length: limit }, (_, index) => index);
  })) {
    processed += rows.length;
  }
  assert.deepEqual(limits, [1000, 500]);
  assert.equal(processed, 1500);
});

test("item refresh stops on a short claim", async () => {
  let calls = 0;
  const batches = [];
  for await (const rows of itemClaimBatches({ limit: 1500, assetIds: [], dryRun: false }, async () => {
    calls += 1;
    return [123];
  })) batches.push(rows);
  assert.equal(calls, 1);
  assert.deepEqual(batches, [[123]]);
});

test("explicit asset IDs are deduplicated and visited once despite short or empty slices", async () => {
  const ids = Array.from({ length: 1002 }, (_, index) => index + 1);
  const requested: number[][] = [];
  const returned: number[] = [];
  for await (const rows of itemClaimBatches({ limit: 1500, assetIds: [...ids, 1], dryRun: false }, async ({ assetIds, limit }) => {
    requested.push(assetIds);
    assert.equal(limit, assetIds.length);
    return requested.length === 1 ? [] : assetIds;
  })) returned.push(...rows);
  assert.deepEqual(requested, [ids.slice(0, 1000), [1001, 1002]]);
  assert.deepEqual(returned, [1001, 1002]);
});

test("explicit assets still respect the total refresh limit", async () => {
  const requested: number[][] = [];
  for await (const _rows of itemClaimBatches({ limit: 1, assetIds: [10, 20], dryRun: false }, async ({ assetIds }) => {
    requested.push(assetIds);
    return assetIds;
  })) { /* Consume each processed batch. */ }
  assert.deepEqual(requested, [[10]]);
});

test("explicit assets stop at the limit when earlier slices return nothing", async () => {
  const ids = Array.from({ length: 3000 }, (_, index) => index + 1);
  const requested: number[] = [];
  for await (const _rows of itemClaimBatches({ limit: 1500, assetIds: ids, dryRun: false }, async ({ assetIds }) => {
    requested.push(assetIds.length);
    return [];
  })) { /* No rows are returned. */ }
  assert.deepEqual(requested, [1000, 500]);
});

test("item dry run previews once with the original options", async () => {
  const options = { limit: 1500, assetIds: [10, 10], dryRun: true };
  let calls = 0;
  for await (const rows of itemClaimBatches(options, async (actual) => {
    calls += 1;
    assert.deepEqual(actual, options);
    return [10];
  })) assert.deepEqual(rows, [10]);
  assert.equal(calls, 1);
});

test("item refresh separates missing rows from real failures and keeps missing handling", () => {
  const source = readFileSync(new URL("../update-item-hourly-stats.ts", import.meta.url), "utf8");
  const missingBranch = source.slice(source.indexOf("if (!payload)"), source.indexOf("const economy =", source.indexOf("if (!payload)")));
  assert.match(missingBranch, /missingRowCount \+= 1/);
  assert.doesNotMatch(missingBranch, /failedRows|failedSamples/);
  assert.match(source, /await markMissingResponses\(missingRows, workerId\)/);
  assert.match(source, /missing_rows: missingRowCount/);
  assert.match(source, /rowsClaimed: claimedRows/);
  assert.match(source, /statsRefreshRunStatus\(succeededRows, failedRows, missingRowCount\)/);
  assert.equal(statsRefreshRunStatus(100, 0, 0), "success");
  assert.equal(statsRefreshRunStatus(984, 0, 16), "success", "a few removals are normal");
  assert.equal(statsRefreshRunStatus(100, 2, 0), "partial");
  assert.equal(statsRefreshRunStatus(0, 2, 0), "failed");
  assert.equal(statsRefreshRunStatus(970, 0, 30), "success", "one whole missing batch in a large run stays under the share");
  assert.equal(statsRefreshRunStatus(0, 0, 30), "failed", "a run with only a full batch missing is not a success");
});

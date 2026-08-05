import assert from "node:assert/strict";
import test from "node:test";

import { internalCatalogItemId } from "../../catalog/catalog-discovery-db";
import {
  assignItemStatsTier,
  fetchCatalogItemDetailsBatch,
  fetchResaleDataResult,
  resetRobloxRequestStateForTests,
  robloxTargetId,
  RobloxRateLimitError
} from "../item-stats-utils";

test("canonical item identity keeps asset IDs positive and bundle IDs negative", () => {
  assert.equal(internalCatalogItemId(123, "Asset"), 123);
  assert.equal(internalCatalogItemId(123, "Bundle"), -123);
  assert.equal(robloxTargetId({ asset_id: -123, item_type: "Bundle" }), 123);
});

test("item stats tiers match the universe NEW HOT WARM COLD vocabulary", () => {
  assert.equal(assignItemStatsTier({ name: null }).tier, "NEW");
  assert.equal(assignItemStatsTier({ name: "Limited", category: "Accessories", subcategory: "Head", favorite_count: 5, has_resellers: true, last_item_stats_refreshed_at: "2026-01-01T00:00:00Z" }).tier, "HOT");
  assert.equal(assignItemStatsTier({ name: "Popular", category: "Accessories", subcategory: "Head", favorite_count: 15_000, last_item_stats_refreshed_at: "2026-01-01T00:00:00Z" }).tier, "WARM");
  assert.equal(assignItemStatsTier({ name: "Long tail", category: "Accessories", subcategory: "Head", favorite_count: 10, last_item_stats_refreshed_at: "2026-01-01T00:00:00Z" }).tier, "COLD");
  assert.deepEqual(assignItemStatsTier({ catalog_status: "unavailable" }), { tier: "COLD", reason: "catalog_unavailable", refreshHours: 168 });
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

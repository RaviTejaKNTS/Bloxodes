import assert from "node:assert/strict";
import test from "node:test";
import { defaultDecalQuerySeeds, planMissingDecalBatch, decalDiscoveryHealth, parseDecalStepCounts } from "../decal-discovery";

test("discovery includes a current-year query before the saturated evergreen queries", () => {
  assert.deepEqual(defaultDecalQuerySeeds(["", "meme", "2026"], new Date("2026-10-30T00:00:00Z")), ["2026", "", "meme"]);
  assert.equal(defaultDecalQuerySeeds(["meme"], new Date("2027-01-01T00:00:00Z"))[0], "2027");
});

test("known candidates do not spend the insertion budget or hide a later new candidate", () => {
  const known = Array.from({ length: 3000 }, (_, i) => ({ asset_id: i + 1 }));
  const existing = new Set(known.map((row) => row.asset_id));
  let inserted = 0;
  inserted += planMissingDecalBatch(known, existing, 3000 - inserted).length;
  assert.equal(inserted, 0);
  const nextPage = [...known.slice(0, 10), { asset_id: 4001 }, { asset_id: 4002 }];
  assert.deepEqual(planMissingDecalBatch(nextPage, existing, 1), [{ asset_id: 4001 }]);
  assert.deepEqual(planMissingDecalBatch(nextPage, existing, 0), []);
});

test("a seven-day discovery stall reports partial health even if verification keeps running", () => {
  const now = Date.parse("2026-10-30T06:55:00Z");
  assert.match(decalDiscoveryHealth("2026-10-20T06:55:00Z", now)!, /No new decals/);
  assert.match(decalDiscoveryHealth("2026-10-23T06:55:00Z", now)!, /7 days/);
  assert.equal(decalDiscoveryHealth("2026-10-24T06:55:00Z", now), null);
  assert.ok(decalDiscoveryHealth(null, now));
  assert.throws(() => decalDiscoveryHealth("invalid", now));
});

test("the refresh ledger records real step counts including zero inserts", () => {
  assert.deepEqual(parseDecalStepCounts("Done. Configs: 9. Unique candidates this run: 3000. Inserted: 0. Already known: 3000."),
    { candidates: 3000, inserted: 0, already_known: 3000, configs: 9 });
  assert.deepEqual(parseDecalStepCounts("Done. Candidate rows: 42. Inserted: 2. Already known: 40. Source rows: 42."),
    { candidates: 42, inserted: 2, already_known: 40 });
  assert.deepEqual(parseDecalStepCounts("Done. Total verified: 5000."), { verified: 5000 });
  assert.deepEqual(parseDecalStepCounts("Done. Reranked 38138 active decal rows (982 curated)."), { reranked: 38138 });
});

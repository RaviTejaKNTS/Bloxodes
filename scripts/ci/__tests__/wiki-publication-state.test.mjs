import assert from "node:assert/strict";
import test from "node:test";
import { wikiReceiptMatches, wikiDispatchReady } from "../wiki-publication-state.mjs";

const now = Date.parse("2026-10-07T06:00:00Z");
const ticket = {requestId: "exact-request"};
const queued = {status: "publishing",lease_token: null,lease_expires_at: null,production_receipt: {request_id: ticket.requestId,state: "publishing",started_at: "2026-10-07T01:00:00Z"}};

test("a queued release survives hours without a builder lease or duplicate dispatch", () => {
  assert.equal(wikiReceiptMatches(queued,ticket,now), true);
  assert.equal(wikiDispatchReady(queued,now), false);
  assert.equal(wikiReceiptMatches(queued,{requestId: "replaced-request"},now), false);
  assert.equal(wikiReceiptMatches({...queued,status: "published"},ticket,now), false);
});
test("legacy processing requests still require a live lease", () => {
  assert.equal(wikiReceiptMatches({...queued,status: "processing",lease_expires_at: "2026-10-07T05:00:00Z"},ticket,now),false);
  assert.equal(wikiReceiptMatches({...queued,status: "processing",lease_expires_at: "2026-10-07T07:00:00Z"},ticket,now),true);
});
test("failed requests retry after a delay and stop after three attempts", () => {
  const failed = {...queued,production_receipt: {...queued.production_receipt,state: "failed",dispatch_attempts: 1,failed_at: "2026-10-07T05:30:00Z"}};
  assert.equal(wikiDispatchReady(failed,now),true);
  assert.equal(wikiDispatchReady({...failed,production_receipt: {...failed.production_receipt,dispatch_attempts: 3}},now),false);
  assert.equal(wikiDispatchReady({...failed,production_receipt: {...failed.production_receipt,failed_at: "2026-10-07T05:50:00Z"}},now),false);
});
test("legacy failures use the same live-lease rule and remain retryable", () => {
  const legacy = {...queued,status: "processing",lease_expires_at: "2026-10-07T07:00:00Z"};
  assert.equal(wikiReceiptMatches(legacy,ticket,now),true);
  const failed = {...legacy,production_receipt: {...legacy.production_receipt,state: "failed",dispatch_attempts: 1,failed_at: "2026-10-07T05:30:00Z"}};
  assert.equal(wikiDispatchReady(failed,now),true);
  assert.equal(wikiDispatchReady({...failed,lease_expires_at: "2026-10-07T05:00:00Z"},now),false);
});

import assert from "node:assert/strict";
import test from "node:test";
import { wikiReceiptMatches, wikiDispatchReady, wikiDispatchRecovery, wikiDispatchClaimMatches, matchingWikiRun } from "../wiki-publication-state.mjs";

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

test("only stale preparation claims can recover without GitHub evidence", () => {
  const preparing = {...queued,production_receipt: {...queued.production_receipt,dispatch_phase: "preparing"}};
  assert.equal(wikiDispatchRecovery(preparing,now),"retry");
  assert.equal(wikiDispatchRecovery(preparing,Date.parse("2026-10-07T01:10:00Z")),null);
  assert.equal(wikiDispatchRecovery({...preparing,status: "published"},now),null);
  assert.equal(wikiDispatchRecovery({...preparing,status: "processing",lease_expires_at: "2026-10-07T02:00:00Z"},now),null);
  assert.equal(wikiDispatchRecovery(queued,now),null);
});

test("submitted claims require inspection and a queued run prevents recovery", () => {
  const submitted = {...queued,production_receipt: {...queued.production_receipt,dispatch_phase: "submitted"}};
  assert.equal(wikiDispatchRecovery(submitted,now),"inspect");
  assert.equal(wikiDispatchRecovery({...submitted,production_receipt: {...submitted.production_receipt,github_run_id: 123}},now),null);
  assert.equal(wikiDispatchReady(submitted,now),false);
});

test("a recovered or replaced claim fences the older publisher before dispatch", () => {
  const preparing = {...queued,production_receipt: {...queued.production_receipt,dispatch_phase: "preparing"}};
  const claim = preparing.production_receipt;
  assert.equal(wikiDispatchClaimMatches(preparing,ticket,claim,now),true);
  for (const change of [{state: "failed"},{dispatch_phase: "submitted"},{started_at: "2026-10-07T05:00:00Z"},{request_id: "replaced-request"}]) {
    assert.equal(wikiDispatchClaimMatches({...preparing,production_receipt: {...claim,...change}},ticket,claim,now),false);
  }
});

test("GitHub evidence must match this bundle, production branch and dispatch attempt", () => {
  const hash = "a".repeat(64);
  const receipt = {...queued.production_receipt,artifact_binding: {bundle_hash: hash}};
  const run = {id: 123,display_title: `Selected content ${hash}`,event: "workflow_dispatch",head_branch: "production",created_at: "2026-10-07T02:00:00Z",status: "queued"};
  assert.equal(matchingWikiRun([run],receipt)?.id,123);
  for (const change of [{head_branch: "other"},{event: "push"},{display_title: `Selected content ${"b".repeat(64)}`},{created_at: "2026-10-07T00:59:59Z"}]) {
    assert.equal(matchingWikiRun([{...run,...change}],receipt),null);
  }
  assert.equal(matchingWikiRun([],receipt),null);
  assert.equal(matchingWikiRun([run],{}),null);
});

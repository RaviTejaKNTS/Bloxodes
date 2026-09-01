import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCodexExecArgs,
  classifyCodexFallbackReason,
  fallbackTargetCount,
  parseCodexReasoningEffort
} from "../article-writer-provider";

test("Codex execution pins Luna xhigh and keeps the workspace sandbox", () => {
  const args = buildCodexExecArgs({
    worktree: "/srv/bloxodes",
    model: "gpt-5.6-luna",
    reasoningEffort: "xhigh",
    prompt: "write the batch"
  });

  assert.deepEqual(args.slice(0, 7), [
    "exec",
    "--cd",
    "/srv/bloxodes",
    "--model",
    "gpt-5.6-luna",
    "--config",
    'model_reasoning_effort="xhigh"'
  ]);
  assert.ok(args.includes("--approve-for-me"));
  assert.ok(args.includes("--json"));
  assert.ok(args.includes("--ephemeral"));
  assert.ok(!args.includes("--dangerously-bypass-approvals-and-sandbox"));
});

test("Codex reasoning effort accepts xhigh and rejects unknown values", () => {
  assert.equal(parseCodexReasoningEffort("xhigh"), "xhigh");
  assert.throws(() => parseCodexReasoningEffort("extra-high"));
});

test("Codex fallback classifies only provider and account failures", () => {
  assert.equal(classifyCodexFallbackReason('{"type":"error","message":"429 rate_limit_exceeded"}'), "quota_or_rate_limit");
  assert.equal(classifyCodexFallbackReason("401 unauthorized: token expired"), "authentication");
  assert.equal(classifyCodexFallbackReason("model_not_found: gpt-5.6-luna"), "model_unavailable");
  assert.equal(classifyCodexFallbackReason("503 service unavailable"), "provider_unavailable");
  assert.equal(classifyCodexFallbackReason("article verifier failed because final.json is invalid"), null);
  assert.equal(classifyCodexFallbackReason("batch exceeded its timeout"), null);
});

test("fallback target excludes rows already touched by Codex", () => {
  assert.equal(fallbackTargetCount(6, 0), 6);
  assert.equal(fallbackTargetCount(6, 2), 4);
  assert.equal(fallbackTargetCount(6, 7), 0);
});

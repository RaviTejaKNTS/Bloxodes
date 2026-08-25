import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCodexExecArgs,
  parseCodexReasoningEffort
} from "../article-writer-provider";

test("Codex execution pins Luna max and keeps the workspace sandbox", () => {
  const args = buildCodexExecArgs({
    worktree: "/srv/bloxodes",
    model: "gpt-5.6-luna",
    reasoningEffort: "max",
    prompt: "write the batch"
  });

  assert.deepEqual(args.slice(0, 7), [
    "exec",
    "--cd",
    "/srv/bloxodes",
    "--model",
    "gpt-5.6-luna",
    "--config",
    'model_reasoning_effort="max"'
  ]);
  assert.ok(args.includes("--approve-for-me"));
  assert.ok(args.includes("--json"));
  assert.ok(args.includes("--ephemeral"));
  assert.ok(!args.includes("--dangerously-bypass-approvals-and-sandbox"));
});

test("Codex reasoning effort accepts max and rejects unknown values", () => {
  assert.equal(parseCodexReasoningEffort("max"), "max");
  assert.throws(() => parseCodexReasoningEffort("extra-high"));
});

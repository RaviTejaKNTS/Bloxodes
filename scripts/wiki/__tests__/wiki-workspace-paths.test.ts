import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, symlink, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { resolveWikiAttemptRoot } from "../wiki-workspace-paths";

test("saved wiki attempts survive release aliases while cross-game and symlink escapes are refused", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "wiki-runtime-paths-"));
  try {
    const state = path.join(root, "state");
    await mkdir(path.join(state, "game-a", "attempt-1"), { recursive: true });
    await mkdir(path.join(state, "game-b", "attempt-1"), { recursive: true });
    await symlink(state, path.join(root, "old-checkout"));
    await symlink(state, path.join(root, "new-release"));
    const queue = path.join(root, "new-release", "game-a");
    const saved = path.join(root, "old-checkout", "game-a", "attempt-1");
    assert.equal(await resolveWikiAttemptRoot(queue, saved, 2), saved);
    assert.equal(await resolveWikiAttemptRoot(queue, null, 2), path.join(queue, "attempt-2"));
    await assert.rejects(resolveWikiAttemptRoot(queue, path.join(state, "game-b", "attempt-1"), 2), /escapes/);
    await assert.rejects(resolveWikiAttemptRoot(queue, queue, 2), /escapes/);
    await symlink(path.join(state, "game-b"), path.join(queue, "escape"));
    await assert.rejects(resolveWikiAttemptRoot(queue, path.join(queue, "escape", "attempt-1"), 2), /escapes/);
    await symlink(path.join(state, "game-b"), path.join(queue, "attempt-3"));
    await assert.rejects(resolveWikiAttemptRoot(queue, null, 3), /escapes/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

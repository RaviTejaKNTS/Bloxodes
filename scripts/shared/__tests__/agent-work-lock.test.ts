import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { acquireAgentWorkLock } from "../agent-work-lock";

test("serializes article and wiki workflows through one lock", async () => {
  const worktree = await mkdtemp(path.join(os.tmpdir(), "bloxodes-agent-lock-"));
  try {
    const releaseArticle = await acquireAgentWorkLock(worktree, "article-batch");
    assert.ok(releaseArticle);
    assert.equal(await acquireAgentWorkLock(worktree, "wiki-automation"), null);

    const lockPath = path.join(worktree, "tmp", "article-writer", "writer.lock");
    const lock = JSON.parse(await readFile(lockPath, "utf8")) as { mode?: unknown };
    assert.equal(lock.mode, "article-batch");

    await releaseArticle();
    const releaseWiki = await acquireAgentWorkLock(worktree, "wiki-automation");
    assert.ok(releaseWiki);
    await releaseWiki();
  } finally {
    await rm(worktree, { recursive: true, force: true });
  }
});

test("replaces a stale lock before starting work", async () => {
  const worktree = await mkdtemp(path.join(os.tmpdir(), "bloxodes-stale-agent-lock-"));
  try {
    const lockDir = path.join(worktree, "tmp", "article-writer");
    await mkdir(lockDir, { recursive: true });
    await writeFile(path.join(lockDir, "writer.lock"), JSON.stringify({ pid: 2_147_483_647, token: "stale" }));

    const release = await acquireAgentWorkLock(worktree, "wiki-automation");
    assert.ok(release);
    await release();
  } finally {
    await rm(worktree, { recursive: true, force: true });
  }
});

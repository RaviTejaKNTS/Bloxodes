import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { setupWorktree } from "../../dev/setup-worktree.mjs";
import { inspectPrivatePaths } from "../../dev/worktree-cleanup-storage.mjs";
import { contains, findWorktreeRecord, inspectLink, privateEnvFiles, checkoutPaths, taskLocationAllowed } from "../../dev/worktree-storage.mjs";

async function temporary(t) {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "bloxodes-worktree-")));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}

test("cleanup refuses checkout-owned private env files", async t => {
  const root = await temporary(t), main = path.join(root, "main"), task = path.join(root, "task");
  await fs.mkdir(main); await fs.mkdir(task);
  await fs.writeFile(path.join(task, ".env.local"), "private", { mode: 0o600 });
  await assert.rejects(inspectPrivatePaths(task, main), /checkout-owned/);
});

test("a missing unrelated worktree does not hide the selected task record", async t => {
  const main = await temporary(t), task = path.join(main, "task");
  await fs.mkdir(task);
  const selected = { worktree: task, branch: "refs/heads/task" };
  assert.equal(await findWorktreeRecord([{ worktree: path.join(main, "gone") }, selected], task), selected);
});

test("links preserve existing files and reject different or broken destinations", async t => {
  const root = await temporary(t);
  const source = path.join(root, "source"), other = path.join(root, "other"), destination = path.join(root, "destination");
  await fs.mkdir(source); await fs.mkdir(other);
  assert.equal(await inspectLink(source, destination), true);
  await fs.writeFile(destination, "keep me");
  await assert.rejects(inspectLink(source, destination), /Preserving/);
  assert.equal(await fs.readFile(destination, "utf8"), "keep me");
  await fs.unlink(destination); await fs.symlink(other, destination);
  await assert.rejects(inspectLink(source, destination), /somewhere else/);
  await fs.unlink(destination); await fs.symlink(path.join(root, "missing"), destination);
  await assert.rejects(inspectLink(source, destination), /ENOENT/);
});

test("env metadata rejects public files and nested symlinks without reading secrets", async t => {
  const root = await temporary(t), secret = path.join(root, "private.env");
  await fs.writeFile(secret, "secret", { mode: 0o600 });
  assert.deepEqual(await privateEnvFiles(root), [secret]);
  await fs.chmod(secret, 0o644);
  await assert.rejects(privateEnvFiles(root), /private/);
  await fs.chmod(secret, 0o600); await fs.symlink(secret, path.join(root, "escape.env"));
  await assert.rejects(privateEnvFiles(root), /symlink/);
});

test("setup links private env storage and creates only local scratch", async t => {
  const directory = await temporary(t), main = path.join(directory, "main"), worktree = path.join(directory, "task");
  await fs.mkdir(main);
  const git = (...args) => execFileSync("git", ["-C", main, ...args], { stdio: "pipe" });
  git("init", "-b", "production"); git("config", "user.email", "fixture@example.com"); git("config", "user.name", "Fixture");
  for (const relative of [".agents/skills", ".claude/skills", ".codex/environments", "env", ".envs/targets"]) await fs.mkdir(path.join(main, relative), { recursive: true });
  for (const relative of ["AGENTS.md", "t3.json", ".agents/skills/.keep", ".claude/skills/.keep", ".codex/environments/environment.toml"]) await fs.writeFile(path.join(main, relative), "fixture\n");
  await fs.writeFile(path.join(main, "env/config.json"), JSON.stringify({ profiles: { "managed-dev": ["targets/managed-dev.env"] } }));
  await fs.writeFile(path.join(main, ".gitignore"), ".envs\ntmp\n");
  await fs.writeFile(path.join(main, ".envs/targets/managed-dev.env"), "fixture", { mode: 0o600 });
  git("add", "."); git("commit", "-m", "Fixture"); git("worktree", "add", "-b", "task", worktree);
  const mainTmp = path.join(main, "tmp");
  await fs.mkdir(mainTmp);
  await fs.writeFile(path.join(mainTmp, "keep.json"), "main scratch");
  for (let run = 0; run < 2; run++) {
    const result = await setupWorktree({ cwd: worktree, suppliedMain: main });
    assert.equal(result.links, run === 0 ? 1 : 0);
    assert.deepEqual(await fs.readdir(path.join(worktree, "tmp")), ["test-reports"]);
    assert.deepEqual(await fs.readdir(path.join(worktree, "tmp/test-reports")), []);
    assert.deepEqual(await fs.readdir(mainTmp), ["keep.json"]);
    assert.equal(await fs.readFile(path.join(mainTmp, "keep.json"), "utf8"), "main scratch");
  }
  assert.equal(await fs.realpath(path.join(worktree, ".envs")), path.join(main, ".envs"));
  assert.equal((await fs.lstat(path.join(worktree, "tmp"))).isSymbolicLink(), false);
  assert.equal((await fs.lstat(path.join(worktree, "tmp/test-reports"))).isSymbolicLink(), false);
  await assert.rejects(fs.access(path.join(worktree, "node_modules")));
  await fs.writeFile(path.join(worktree, "tmp/keep.json"), "task scratch");
  await setupWorktree({ cwd: worktree, suppliedMain: main });
  assert.equal(await fs.readFile(path.join(worktree, "tmp/keep.json"), "utf8"), "task scratch");
  await inspectPrivatePaths(worktree, main);
  await fs.writeFile(path.join(worktree, ".envs/targets/public.env"), "fixture", { mode: 0o644 });
  await assert.rejects(setupWorktree({ cwd: worktree, suppliedMain: main }), /private regular file/);
  await fs.unlink(path.join(main, ".envs/targets/public.env"));
  await fs.unlink(path.join(worktree, "t3.json"));
  await assert.rejects(setupWorktree({ cwd: worktree, suppliedMain: main }), /ENOENT/);
  await fs.writeFile(path.join(worktree, "t3.json"), "fixture\n");
  await fs.rm(path.join(worktree, "tmp"), { recursive: true });
  await fs.symlink(mainTmp, path.join(worktree, "tmp"));
  await assert.rejects(setupWorktree({ cwd: worktree, suppliedMain: main }), /tmp must belong to this checkout/);
  assert.equal(await fs.readFile(path.join(mainTmp, "keep.json"), "utf8"), "main scratch");
  await assert.rejects(checkoutPaths(worktree, worktree), /main checkout/);
  assert.equal(await taskLocationAllowed(main, main, worktree), false);
  assert.equal(await taskLocationAllowed(main, worktree, worktree), false);
  assert.equal(contains("/srv/data", "/srv/database"), false);
  await fs.unlink(path.join(worktree, "tmp"));
  await fs.mkdir(path.join(worktree, "tmp"));
  await fs.writeFile(path.join(worktree, "tmp/disposable.json"), "task scratch");
  await inspectPrivatePaths(worktree, main);
  git("worktree", "remove", worktree);
  await assert.rejects(fs.access(worktree), /ENOENT/);
  assert.equal(await fs.readFile(path.join(mainTmp, "keep.json"), "utf8"), "main scratch");
});

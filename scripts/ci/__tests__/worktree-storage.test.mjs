import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { claimContent } from "../../dev/claim-shared-content.mjs";
import { setupWorktree } from "../../dev/setup-worktree.mjs";
import { archiveScratch, assertNoContentClaims, inspectPrivatePaths } from "../../dev/worktree-cleanup-storage.mjs";
import { contains, findWorktreeRecord, inspectLink, privateEnvFiles, checkoutPaths, taskLocationAllowed } from "../../dev/worktree-storage.mjs";

async function temporary(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "bloxodes-worktree-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}

test("content claims exclude another checkout and survive the owning process", async t => {
  const main = await temporary(t);
  const first = path.join(main, "first"), second = path.join(main, "second");
  await fs.mkdir(first); await fs.mkdir(second);
  await claimContent({ main, root: first, game: "minecraft-java" });
  await claimContent({ main, root: first, game: "minecraft-java" });
  await assert.rejects(claimContent({ main, root: second, game: "minecraft-java" }), /belong/);
  await assert.rejects(claimContent({ main, root: second, game: "minecraft-java", release: true }), /Only/);
  await claimContent({ main, root: first, game: "minecraft-java", release: true });
  await claimContent({ main, root: second, game: "minecraft-java" });
  await assert.rejects(claimContent({ main, root: first, game: "../escape" }), /slug/);
});

test("simultaneous claims cannot both own the same game's drafts", async t => {
  const main = await temporary(t);
  const roots = [path.join(main, "a"), path.join(main, "b")];
  await Promise.all(roots.map(root => fs.mkdir(root)));
  const results = await Promise.allSettled(roots.map(root => claimContent({ main, root, game: "sandustry" })));
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
});

test("repeated releases cannot delete a new owner's receipt", async t => {
  const main = await temporary(t);
  const first = path.join(main, "first"), second = path.join(main, "second");
  await fs.mkdir(first); await fs.mkdir(second);
  await Promise.all([claimContent({ main, root: first, game: "gta" }), claimContent({ main, root: first, game: "gta" })]);
  await Promise.allSettled([
    claimContent({ main, root: first, game: "gta", release: true }),
    claimContent({ main, root: first, game: "gta", release: true }),
    claimContent({ main, root: second, game: "gta" }),
  ]);
  await claimContent({ main, root: second, game: "gta" });
  const receipt = JSON.parse(await fs.readFile(path.join(main, "tmp/content-claims/gta.json"), "utf8"));
  assert.equal(receipt.worktree, second);
  await assert.rejects(claimContent({ main, root: first, game: "gta" }), /belong/);
});

test("scratch archives verify regular files and record links without following them", async t => {
  const root = await temporary(t), source = path.join(root, "scratch"), archive = path.join(root, "archive");
  await fs.mkdir(source); await fs.writeFile(path.join(source, "brief.md"), "preserve this brief");
  await fs.symlink(root, path.join(source, "outside"));
  await fs.symlink(path.join(root, "missing"), path.join(source, "dangling"));
  await archiveScratch(source, archive);
  assert.equal(await fs.readFile(path.join(archive, "tmp/brief.md"), "utf8"), "preserve this brief");
  const manifest = JSON.parse(await fs.readFile(path.join(archive, "manifest.json"), "utf8"));
  assert.match(manifest.find(entry => entry.path === "brief.md").sha256, /^[a-f0-9]{64}$/);
  assert.equal(manifest.find(entry => entry.path === "outside").symlink, root);
  assert.equal(manifest.find(entry => entry.path === "dangling").symlink, path.join(root, "missing"));
  await assert.rejects(fs.access(path.join(archive, "tmp/outside")));
});

test("cleanup refuses checkout-owned private env files", async t => {
  const root = await temporary(t), main = path.join(root, "main"), task = path.join(root, "task");
  await fs.mkdir(main); await fs.mkdir(task);
  await fs.writeFile(path.join(task, ".env.local"), "private", { mode: 0o600 });
  await assert.rejects(inspectPrivatePaths(task, main), /checkout-owned/);
});

test("unrelated claim operation directories do not block cleanup", async t => {
  const main = await temporary(t), task = path.join(main, "task"), directory = path.join(main, "tmp/content-claims");
  await fs.mkdir(directory, { recursive: true });
  await fs.mkdir(path.join(directory, "gta.operation"));
  await fs.writeFile(path.join(directory, "gta.json"), JSON.stringify({ worktree: path.join(main, "other") }));
  await assertNoContentClaims(main, task);
  await fs.writeFile(path.join(directory, "sandustry.json"), JSON.stringify({ worktree: task }));
  await assert.rejects(assertNoContentClaims(main, task), /Release/);
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

test("optional references skip missing sources and dangling links without weakening required links", async t => {
  const root = await temporary(t), source = path.join(root, "source"), missing = path.join(root, "missing");
  const brokenSource = path.join(root, "broken-source"), destination = path.join(root, "destination"), other = path.join(root, "other");
  const warnings = [];
  t.mock.method(console, "warn", message => warnings.push(message));
  await fs.mkdir(source); await fs.mkdir(other);
  await fs.symlink(missing, brokenSource); await fs.symlink(missing, destination);
  assert.equal(await inspectLink(missing, path.join(root, "absent-reference"), { optional: true }), false);
  assert.equal(await inspectLink(brokenSource, path.join(root, "broken-reference"), { optional: true }), false);
  assert.equal(await inspectLink(source, destination, { optional: true }), false);
  assert.equal(warnings.length, 3);
  assert.match(warnings[0], /optional reference source/); assert.ok(warnings[0].includes(missing));
  assert.ok(warnings[1].includes(brokenSource)); assert.ok(warnings[2].includes(destination));
  assert.equal(await fs.readlink(destination), missing);
  await assert.rejects(inspectLink(source, destination), /ENOENT/);
  await assert.rejects(inspectLink(source, other, { optional: true }), /Preserving/);
  const wrong = path.join(root, "wrong");
  await fs.symlink(other, wrong);
  await assert.rejects(inspectLink(source, wrong, { optional: true }), /somewhere else/);
  await assert.rejects(inspectLink(missing, other, { optional: true }), /Preserving/);
  await assert.rejects(inspectLink(brokenSource, wrong, { optional: true }), /somewhere else/);
  assert.equal(warnings.length, 3);
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

test("setup links the canonical store but leaves scratch and pipeline state separate", async t => {
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
  const history = path.join(main, "tmp/worktree-reference"), missing = path.join(main, "tmp/missing");
  await fs.mkdir(history, { recursive: true });
  await fs.mkdir(path.join(main, "tmp/article-pipeline"));
  await fs.symlink(missing, path.join(main, "tmp/release-backups"));
  await fs.symlink(path.join(main, "tmp/release-backups"), path.join(history, "release-backups"));
  await fs.symlink(missing, path.join(history, "article-pipeline"));
  const warnings = [];
  t.mock.method(console, "warn", message => warnings.push(message));
  for (let run = 0; run < 2; run++) {
    warnings.length = 0;
    await setupWorktree({ cwd: worktree, suppliedMain: main });
    assert.equal(warnings.filter(message => message.includes("release-backups")).length, 1);
    assert.ok(warnings.some(message => message.includes("optional reference source") && message.includes("release-backups")));
    assert.ok(warnings.some(message => message.includes("optional reference link") && message.includes("article-pipeline")));
  }
  assert.equal(await fs.readlink(path.join(history, "article-pipeline")), missing);
  assert.equal(await fs.readlink(path.join(history, "release-backups")), path.join(main, "tmp/release-backups"));
  assert.equal(await fs.realpath(path.join(worktree, ".envs")), path.join(main, ".envs"));
  assert.equal(await fs.realpath(path.join(worktree, "tmp/content-workspace")), path.join(main, "tmp/content-workspace"));
  assert.equal((await fs.lstat(path.join(worktree, "tmp"))).isSymbolicLink(), false);
  await assert.rejects(fs.access(path.join(worktree, "node_modules")));
  await assert.rejects(fs.access(path.join(worktree, "tmp/article-writer")));
  await assert.rejects(fs.access(path.join(worktree, "tmp/article-pipeline")));
  await assert.rejects(checkoutPaths(worktree, worktree), /main checkout/);
  assert.equal(await taskLocationAllowed(main, main, worktree), false);
  assert.equal(await taskLocationAllowed(main, worktree, worktree), false);
  assert.equal(contains("/srv/data", "/srv/database"), false);
});

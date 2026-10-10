import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { articleModelPermissionArgs } from "../article-model-permissions";
import { stageCodexArgs, type StageRuntimeOptions } from "../article-stage-runtime";

test("Codex stages and Claude fallback share read restrictions without legacy sandbox overrides", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "article-permissions-"));
  const repo = path.join(root, "repo"), profiles = path.join(root, "private-profiles");
  await mkdir(repo); await mkdir(profiles); await symlink(profiles, path.join(repo, ".envs"));
  const codexHome = path.join(root, "codex-home");
  await mkdir(path.join(codexHome, "packages"), { recursive: true }); await writeFile(path.join(codexHome, "auth.json"), "{}"); await writeFile(path.join(codexHome, "config.toml"), "");
  const options = { worktree: repo, runDir: path.join(root, "run"), codexBin: "/operator/.codex/packages/release/bin/codex", env: { HOME: "/operator", CODEX_HOME: codexHome } };
  for (const review of [true, false]) {
    const args = articleModelPermissionArgs(options, review);
    const config = args.find(arg => arg.startsWith("permissions.bloxodes_article.filesystem="))!;
    assert.ok(args.includes("--ignore-user-config")); assert.ok(args.includes("--strict-config"));
    assert.ok(args.includes('approval_policy="never"')); assert.ok(args.includes("allow_login_shell=false"));
    for (const denied of [profiles, "/etc/bloxodes", "/proc", path.join(codexHome, "auth.json"), path.join(codexHome, "config.toml"), "/operator/.claude", "/operator/.aws", "/operator/.ssh", "/operator/.config/gh"]) assert.ok(config.includes(`${JSON.stringify(denied)} = "deny"`), denied);
    assert.ok(config.includes('":minimal" = "read"'));
    assert.ok(!config.includes('":root" = "read"'));
    assert.ok(config.includes('"**/.env*" = "deny"'));
    assert.ok(config.includes(`"." = "${review ? "read" : "write"}"`));
    assert.ok(config.includes('"/operator/.codex/packages/release/codex-resources" = "read"'));
    // A parent deny would hide the sandbox helper under packages/, so CODEX_HOME is denied per entry.
    assert.ok(!config.includes(`${JSON.stringify(codexHome)} = "deny"`));
    assert.ok(!config.includes(`${JSON.stringify(path.join(codexHome, "packages"))} = "deny"`));
    // Networked stages need the resolver, CA store and headless Chrome; reviews stay offline.
    assert.equal(config.includes('"/etc" = "read"'), !review);
    assert.equal(config.includes('"/opt/google" = "read"'), !review);
    assert.equal(config.includes('"/operator/.cache/ms-playwright" = "read"'), !review);
  }
  const args = stageCodexArgs({ ...options, model: "legacy", reasoning: "max" } as StageRuntimeOptions, "writing", "write", path.join(root, "attempt"), { provider: "codex", model: "gpt-6-luna", effort: "max" });
  assert.ok(!args.includes("--sandbox")); assert.ok(!args.includes("--approve-for-me"));
  assert.ok(!args.some(arg => arg.startsWith("sandbox_workspace_write.")));
  assert.ok(args.includes('default_permissions="bloxodes_article"'));
});

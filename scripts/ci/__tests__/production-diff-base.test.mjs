import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { productionDiffBase } from "../production-diff-base.mjs";

test("a later guidance release includes earlier web changes that are not live", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "production-diff-"));
  const git = args => execFileSync("git", args, {cwd: root, encoding: "utf8"}).trim();
  try {
    git(["init", "--quiet"]);
    git(["config", "user.name", "CI fixture"]);
    git(["config", "user.email", "ci@example.invalid"]);
    await fs.writeFile(path.join(root, "README.md"), "Initial live version");
    git(["add", "."]); git(["commit", "--quiet", "-m", "Initial"]);
    const live = git(["rev-parse", "HEAD"]);
    await fs.mkdir(path.join(root, "apps/web"), {recursive: true});
    await fs.writeFile(path.join(root, "apps/web/page.tsx"), "Reviewed web change");
    git(["add", "."]); git(["commit", "--quiet", "-m", "Web"]);
    const previous = git(["rev-parse", "HEAD"]);
    await fs.writeFile(path.join(root, "README.md"), "Guidance change");
    git(["add", "."]); git(["commit", "--quiet", "-m", "Guidance"]);
    const head = git(["rev-parse", "HEAD"]);
    const base = await productionDiffBase(head, async () => Response.json({ok: true, build: {sha: live}}), (base, target) => {
      git(["merge-base", "--is-ancestor", base, target]); return true;
    });
    assert.equal(base, live);
    assert.equal(git(["diff", "--name-only", previous, head]), "README.md");
    assert.ok(git(["diff", "--name-only", base, head]).includes("apps/web/page.tsx"));
  } finally { await fs.rm(root, {recursive: true, force: true}); }
});

test("an unknown, unhealthy or unrelated live version requires full release classification", async () => {
  const head = "c".repeat(40);
  assert.equal(await productionDiffBase(head, async () => {throw new Error("Offline");}), "");
  assert.equal(await productionDiffBase(head, async () => Response.json({ok: false}, {status: 503})), "");
  assert.equal(await productionDiffBase(head, async () => Response.json({ok: true, build: {sha: "unknown"}})), "");
  assert.equal(await productionDiffBase(head, async () => Response.json({ok: true, build: {sha: "a".repeat(40)}}), () => false), "");
});

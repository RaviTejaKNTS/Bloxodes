import path from "node:path";
import fs from "node:fs/promises";
import { checkoutPaths, findWorktreeRecord, git, taskLocationAllowed } from "./worktree-storage.mjs";
import { archiveScratch, assertNoContentClaims, inspectPrivatePaths } from "./worktree-cleanup-storage.mjs";

const args = process.argv.slice(2);
const value = flag => args.indexOf(flag) >= 0 ? args[args.indexOf(flag) + 1] : undefined;
const target = value("--worktree");
const sha = value("--released-sha");
const apply = args.includes("--apply");
if (typeof target !== "string" || !path.isAbsolute(target) || !/^[0-9a-f]{40}$/.test(sha ?? "")) throw new Error("Select one finished --worktree and its full --released-sha.");
const { root: current, main, records } = await checkoutPaths();
const resolved = await fs.realpath(target);
const record = await findWorktreeRecord(records, resolved);
if (!record?.branch || record.detached || record.locked || !await taskLocationAllowed(main, resolved, current)) {
  throw new Error("Cleanup accepts one finished task on the T3 HDD or legacy task path. Current/main and detached runtimes stay intact.");
}
if (apply && !args.includes("--inactive-confirmed")) throw new Error("Check T3 first: the task must be settled with no active run. Then supply --inactive-confirmed.");
if (git(resolved, "status", "--porcelain") || git(main, "status", "--porcelain") || git(main, "branch", "--show-current") !== "production") throw new Error("Keep dirty task/main checkouts intact.");
await inspectPrivatePaths(resolved, main);
await assertNoContentClaims(main, resolved);
if (git(main, "ls-remote", "origin", "refs/heads/production").split(/\s+/)[0] !== sha) throw new Error("Production moved since this release.");
git(main, "fetch", "origin", "production");
git(resolved, "merge-base", "--is-ancestor", "HEAD", sha);
git(main, "merge-base", "--is-ancestor", "HEAD", sha);
console.log(`Finished task ${resolved}; production ${sha}; ${apply ? "applying cleanup" : "plan only"}.`);
if (apply) {
  const archive = path.join(main, "tmp/finished-worktrees", `${path.basename(resolved)}-${Date.now()}`);
  await archiveScratch(path.join(resolved, "tmp"), archive);
  git(main, "merge", "--ff-only", sha);
  git(main, "worktree", "remove", record.worktree);
  git(main, "branch", "-d", record.branch.slice("refs/heads/".length));
  console.log(`Task removed. Private scratch archive: ${archive}`);
}

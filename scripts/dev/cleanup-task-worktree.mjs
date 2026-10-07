import path from "node:path";
import { execFileSync } from "node:child_process";

const args = process.argv.slice(2);
const target = args[args.indexOf("--worktree") + 1];
const sha = args[args.indexOf("--released-sha") + 1];
const apply = args.includes("--apply");
const git = (root, ...flags) => execFileSync("git", ["-C", root, ...flags], { encoding: "utf8" }).trim();
const current = git(process.cwd(), "rev-parse", "--show-toplevel");
const records = git(current, "worktree", "list", "--porcelain").split("\n\n").map(record => Object.fromEntries(record.split("\n").map(line => { const space = line.indexOf(" "); return space < 0 ? [line,true] : [line.slice(0,space),line.slice(space+1)]; })));
const main = records[0].worktree;
if (typeof target !== "string" || !path.isAbsolute(target) || !/^[0-9a-f]{40}$/.test(sha ?? "")) throw new Error("Select one finished --worktree and its full --released-sha.");
const record = records.find(record => record.worktree === target);
if (!record?.branch || target === current || target === main || !target.startsWith(`${main}/tmp/worktrees/`) || record.detached || record.locked) throw new Error("Cleanup accepts only an explicitly finished, inactive task checkout. Detached runtimes stay intact.");
if (git(target, "status", "--porcelain") || git(main, "status", "--porcelain") || git(main, "branch", "--show-current") !== "production") throw new Error("Keep dirty task/main checkouts intact.");
if (git(main, "ls-remote", "origin", "refs/heads/production").split(/\s+/)[0] !== sha) throw new Error("Production moved since this release.");
git(main, "fetch", "origin", "production");
git(target, "merge-base", "--is-ancestor", "HEAD", sha);
git(main, "merge-base", "--is-ancestor", "HEAD", sha);
console.log(`Finished task ${target}; production ${sha}; ${apply ? "applying cleanup" : "plan only"}.`);
if (apply) {
  git(main, "merge", "--ff-only", sha);
  git(main, "worktree", "remove", target);
  git(main, "branch", "-d", record.branch.slice("refs/heads/".length));
}

import { execFileSync } from "node:child_process";

export async function productionDiffBase(head, request = fetch, ancestor = (base, target) => {
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", base, target], {stdio: "pipe"});
    return true;
  } catch { return false; }
}) {
  if (!/^[0-9a-f]{40}$/.test(head ?? "")) throw new Error("A full release HEAD SHA is required.");
  try {
    const response = await request("https://bloxodes.com/api/health?scope=deploy", {cache: "no-store", signal: AbortSignal.timeout(15_000)});
    const health = await response.json();
    const live = health.build?.sha;
    if (response.ok && health.ok === true && /^[0-9a-f]{40}$/.test(live ?? "") && ancestor(live, head)) return live;
  } catch { /* The workflow performs a full guarded release if the live base cannot be proved. */ }
  return "";
}

if (process.argv[1]?.endsWith("production-diff-base.mjs")) console.log(await productionDiffBase(process.env.HEAD_SHA));

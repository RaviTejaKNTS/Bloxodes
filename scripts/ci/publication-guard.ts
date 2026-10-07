import { execFileSync } from "node:child_process";

export function assertProductionPublication() {
  if (process.env.GITHUB_ACTIONS !== "true" || process.env.BLOXODES_CONTENT_RELEASE !== "true") {
    throw new Error("Production content writes run only in publish-content.yml with an approved batch.");
  }
  const sha = process.env.BLOXODES_APPROVED_SHA;
  const git = (...args: string[]) => execFileSync("git", args, { encoding: "utf8" }).trim();
  if (!/^[0-9a-f]{40}$/.test(sha ?? "") || git("rev-parse", "HEAD") !== sha || git("rev-parse", "origin/production") !== sha) {
    throw new Error("Production publication requires the exact approved production checkout.");
  }
}

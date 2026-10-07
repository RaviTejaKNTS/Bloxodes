import { execFileSync } from "node:child_process";
import { batchPath } from "./content-contract.mjs";

const [file, sha, mode = "verify"] = process.argv.slice(2);
batchPath(file);
if (!/^[0-9a-f]{40}$/.test(sha ?? "") || !["verify", "apply"].includes(mode)) throw new Error("Usage: node scripts/ci/dispatch-content.mjs content/releases/<batch>/batch.json <production-sha> [verify|apply]");
execFileSync("gh", ["workflow", "run", "publish-content.yml", "--repo", "RaviTejaKNTS/Bloxodes", "--ref", "production", "--json"], {
  input: JSON.stringify({ batch: file, approved_sha: sha, apply: mode === "apply" ? "true" : "false" }), stdio: ["pipe", "inherit", "inherit"]
});
console.log("GitHub content release requested. Queue rows stay completed until production readback succeeds.");

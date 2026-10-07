import { execFileSync } from "node:child_process";
const base = process.env.BASE_SHA;
const head = process.env.HEAD_SHA;
if (!/^[0-9a-f]{40}$/.test(base ?? "") || !/^[0-9a-f]{40}$/.test(head ?? "")) throw new Error("Full base and head SHAs are required.");
const files = execFileSync("git", ["diff", "--name-only", "-z", base!, head!], { encoding: "utf8" }).split("\0").filter(Boolean);
const batches = new Set(files.flatMap(file => file.match(/^content\/releases\/([a-z0-9-]+)\//) ? [`content/releases/${file.split("/")[2]}/batch.json`] : []));
for (const batch of batches) execFileSync(process.execPath, ["--import", "tsx", "scripts/ci/publish-content.ts", "--managed", "--batch", batch], { env: process.env, stdio: "inherit" });

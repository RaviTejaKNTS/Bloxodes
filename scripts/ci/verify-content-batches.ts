import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { verifyStaticBatch } from "./content-static-contract.mjs";
import { changedContentBatches } from "./content-contract.mjs";
const base = process.env.BASE_SHA;
const head = process.env.HEAD_SHA;
if (!/^[0-9a-f]{40}$/.test(base ?? "") || !/^[0-9a-f]{40}$/.test(head ?? "")) throw new Error("Full base and head SHAs are required.");
const files = execFileSync("git", ["diff", "--name-only", "-z", base!, head!], { encoding: "utf8" }).split("\0").filter(Boolean);
const batches = changedContentBatches(files, existsSync);
for (const batch of batches) {
  const parsed = verifyStaticBatch(batch);
  console.log(`Verified static content contract: ${batch}; ${parsed.operations.length} operations. Publication jobs own managed QA.`);
}

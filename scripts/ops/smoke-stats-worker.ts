import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadBloxodesEnv } from "../shared/env-files";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const requiredRuntimeFiles = [
  "env/config.json",
  "package.json",
  "scripts/shared/env-files.ts",
  "scripts/shared/load-env.ts",
  "scripts/universes/update-universe-hourly-stats.ts",
  "scripts/universes/audit-universe-stats-workflow.ts",
];

const missing = requiredRuntimeFiles.filter(
  (relativePath) => !fs.existsSync(path.join(repoRoot, relativePath))
);
if (missing.length > 0) {
  throw new Error(`Stats worker image is missing runtime files: ${missing.join(", ")}`);
}

const loaded = loadBloxodesEnv();
if (loaded.profile !== "process-only") {
  throw new Error(
    `Stats worker smoke expected the process-only env profile, received ${loaded.profile}`
  );
}
if (loaded.files.length > 0) {
  throw new Error(
    `Stats worker smoke unexpectedly loaded workstation env files: ${loaded.files.join(", ")}`
  );
}

console.log(
  JSON.stringify({
    ok: true,
    profile: loaded.profile,
    requiredRuntimeFiles: requiredRuntimeFiles.length,
    buildSha: process.env.BLOXODES_BUILD_SHA ?? "unknown",
  })
);

import "../shared/load-env";

import { readBloxodesEnvFile } from "../shared/env-files";
import { isProductionSupabaseUrl } from "../shared/supabase-target";
import { spawn } from "node:child_process";

// Occasional preview against the PROD Supabase on port 5000.
// Default dev (port 3000, `npm run dev:managed`) uses managed development;
// content/writing workflows must run there first. This command explicitly forces the
// Supabase connection to prod for read-only design/data spot checks.

const repoRoot = process.cwd();

// Supabase keys we override to prod. Everything else keeps the normal dev config
// loaded by ../shared/load-env (managed-development-first).
const PROD_SUPABASE_KEYS = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE",
  "SUPABASE_DB_PASSWORD",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_MEDIA_BUCKET",
  "SUPABASE_MEDIA_PUBLIC_URL"
];

const baseEnv = readBloxodesEnvFile("targets/production.env");
for (const key of PROD_SUPABASE_KEYS) {
  if (baseEnv[key]) {
    // Set in process.env so Next (@next/env does not override pre-set keys) keeps prod
    // even though the default development profile points Supabase at managed development.
    process.env[key] = baseEnv[key];
  }
}

const supabaseUrl = process.env.SUPABASE_URL;
if (!isProductionSupabaseUrl(supabaseUrl)) {
  throw new Error(
    `Refusing to start prod preview against a non-production SUPABASE_URL (${supabaseUrl ?? "unset"}). Check .envs/targets/production.env.`
  );
}

console.log(`Starting prod-DB preview against ${supabaseUrl} on http://localhost:5000`);

const child = spawn("npm", ["run", "dev:prod", "-w", "@bloxodes/web"], {
  cwd: repoRoot,
  env: process.env,
  shell: false,
  stdio: "inherit"
});

child.on("error", (error) => {
  console.error(error);
  process.exitCode = 1;
});

child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});

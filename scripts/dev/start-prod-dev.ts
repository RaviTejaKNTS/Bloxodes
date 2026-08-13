import "../shared/load-env";

import { readBloxodesEnvFile } from "../shared/env-files";
import { spawn } from "node:child_process";

// Occasional preview against the PROD Supabase on port 5000.
// Default dev (port 3000, `npm run dev:local`) stays on the local Supabase stack;
// content/writing workflows must run there first. This command only forces the
// Supabase connection to prod for read-only design/data spot checks.

const repoRoot = process.cwd();

// Supabase keys we override to prod. Everything else keeps the normal dev config
// loaded by ../shared/load-env (local-first).
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

function isLocalSupabaseUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  } catch {
    return false;
  }
}

const baseEnv = readBloxodesEnvFile("targets/production.env");
for (const key of PROD_SUPABASE_KEYS) {
  if (baseEnv[key]) {
    // Set in process.env so Next (@next/env does not override pre-set keys) keeps prod
    // even though the default local profile points Supabase at the local stack.
    process.env[key] = baseEnv[key];
  }
}

const supabaseUrl = process.env.SUPABASE_URL;
if (isLocalSupabaseUrl(supabaseUrl)) {
  throw new Error(
    `Refusing to start prod preview against local SUPABASE_URL (${supabaseUrl ?? "unset"}). Check .envs/targets/production.env.`
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

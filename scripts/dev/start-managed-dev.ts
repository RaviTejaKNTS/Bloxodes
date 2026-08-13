import "../shared/load-env";

import { spawn } from "node:child_process";
import { assertManagedDevelopmentSupabaseUrl } from "../shared/supabase-target";

const supabaseUrl = process.env.SUPABASE_URL;
assertManagedDevelopmentSupabaseUrl(supabaseUrl, "managed-development preview");
const host = new URL(supabaseUrl).hostname;

console.log(`Starting managed-dev preview against ${host}`);
const child = spawn("npm", ["run", "dev:web"], {
  cwd: process.cwd(),
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

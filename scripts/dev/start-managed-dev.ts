import "../shared/load-env";

import { spawn } from "node:child_process";

const supabaseUrl = process.env.SUPABASE_URL;
let managedUrl: URL;
try {
  managedUrl = new URL(supabaseUrl ?? "");
} catch {
  throw new Error("Managed-dev SUPABASE_URL is missing or invalid.");
}

const host = managedUrl.hostname;
if (managedUrl.protocol !== "https:" || !host.endsWith(".supabase.co")) {
  throw new Error(
    `Refusing managed-dev preview against ${host || "unset"}; expected an HTTPS *.supabase.co project.`
  );
}

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

import { existsSync } from "node:fs";
import { spawn } from "node:child_process";

const SECRET_ENV_PATH = "/run/secrets/production_env";
const SPLIT_SECRET_ENV_PATHS = [
  "/run/secrets/application_env",
  "/run/secrets/content_env",
  "/run/secrets/distribution_env",
  "/run/secrets/production_target_env"
];
const FALLBACK_ENV_PATHS = [
  ".envs/shared/application.env",
  ".envs/integrations/content.env",
  ".envs/integrations/distribution.env",
  ".envs/targets/production.env"
];
const [command, ...args] = process.argv.slice(2);

if (!command) {
  console.error("Usage: node scripts/ops/run-with-production-build-env.mjs <command> [...args]");
  process.exit(1);
}

function loadFiles(paths) {
  for (const envPath of paths) process.loadEnvFile(envPath);
}

if (existsSync(SECRET_ENV_PATH)) {
  process.loadEnvFile(SECRET_ENV_PATH);
  console.log("Loaded production build environment from the BuildKit secret mount.");
} else if (SPLIT_SECRET_ENV_PATHS.every(existsSync)) {
  loadFiles(SPLIT_SECRET_ENV_PATHS);
  console.log("Loaded production build environment from split BuildKit secret mounts.");
} else if (FALLBACK_ENV_PATHS.every(existsSync)) {
  loadFiles(FALLBACK_ENV_PATHS);
  console.log("Loaded production build environment from the explicit split production profile.");
} else {
  console.error(
    "No complete production build environment was provided through an aggregate secret, " +
      "split secrets, or the workstation production profile."
  );
  process.exit(1);
}

const child = spawn(command, args, {
  env: process.env,
  stdio: "inherit"
});

child.on("error", (error) => {
  console.error(`Failed to start ${command}: ${error.message}`);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    console.error(`${command} exited after signal ${signal}.`);
    process.exit(1);
  }
  process.exit(code ?? 1);
});

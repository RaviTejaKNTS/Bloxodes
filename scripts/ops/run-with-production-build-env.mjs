import { existsSync } from "node:fs";
import { spawn } from "node:child_process";

const SECRET_ENV_PATH = "/run/secrets/production_env";
const FALLBACK_ENV_PATH = ".env";
const [command, ...args] = process.argv.slice(2);

if (!command) {
  console.error("Usage: node scripts/ops/run-with-production-build-env.mjs <command> [...args]");
  process.exit(1);
}

if (existsSync(SECRET_ENV_PATH)) {
  process.loadEnvFile(SECRET_ENV_PATH);
  console.log("Loaded production build environment from the BuildKit secret mount.");
} else if (existsSync(FALLBACK_ENV_PATH)) {
  process.loadEnvFile(FALLBACK_ENV_PATH);
  console.log("Loaded production build environment from the local .env fallback.");
} else {
  console.error("No production build environment was provided.");
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

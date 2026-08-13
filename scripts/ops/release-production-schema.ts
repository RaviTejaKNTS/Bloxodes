import "../shared/load-env";

import { execFileSync, spawn, spawnSync, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { isProductionSupabaseUrl } from "../shared/supabase-target";

type MigrationPolicy = {
  production_schema_present_history_missing: string[];
};

const repoRoot = path.resolve(import.meta.dirname, "../..");
const argv = process.argv.slice(2);
const apply = argv.includes("--apply");

function value(flag: string): string | undefined {
  const index = argv.indexOf(flag);
  return index === -1 ? undefined : argv[index + 1]?.trim();
}

function git(...args: string[]): string {
  return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" }).trim();
}

function required(name: string, input: string | undefined): string {
  const resolved = input?.trim();
  if (!resolved) throw new Error(`${name} is required.`);
  return resolved;
}

function run(command: string, args: string[], env: NodeJS.ProcessEnv): void {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    env,
    stdio: "inherit"
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} exited with status ${result.status}.`);
}

async function unusedLocalPort(): Promise<number> {
  const server = net.createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Could not reserve a local SSH tunnel port.");
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return address.port;
}

async function waitForTunnel(process: ChildProcess, port: number): Promise<void> {
  let earlyExit: Error | null = null;
  process.once("exit", (code) => {
    earlyExit = new Error(`SSH tunnel exited before readiness with status ${code}.`);
  });

  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (earlyExit) throw earlyExit;
    const connected = await new Promise<boolean>((resolve) => {
      const socket = net.connect({ host: "127.0.0.1", port });
      socket.once("connect", () => {
        socket.destroy();
        resolve(true);
      });
      socket.once("error", () => resolve(false));
    });
    if (connected) return;
    await delay(250);
  }
  throw new Error("Timed out waiting for the production Postgres SSH tunnel.");
}

async function main() {
  const approvedSha = required("--approved-sha", value("--approved-sha"));
  if (!/^[0-9a-f]{40}$/.test(approvedSha)) throw new Error("--approved-sha must be a full 40-character Git SHA.");
  if (git("rev-parse", "HEAD") !== approvedSha) throw new Error("The current checkout does not match --approved-sha.");
  if (git("status", "--porcelain")) throw new Error("The current checkout is dirty; refusing schema release.");
  if (apply && value("--confirm") !== "APPLY production") {
    throw new Error('Production apply requires --confirm "APPLY production".');
  }
  if (apply && git("rev-parse", "origin/production") !== approvedSha) {
    throw new Error("Production apply requires origin/production to equal the approved SHA.");
  }

  const productionUrl = required("SUPABASE_URL", process.env.SUPABASE_URL);
  if (!isProductionSupabaseUrl(productionUrl)) throw new Error("SUPABASE_URL is not the Bloxodes production host.");
  const password = required("SUPABASE_DB_PASSWORD", process.env.SUPABASE_DB_PASSWORD);
  const sshUser = required("VPS_ADMIN_USER", process.env.VPS_ADMIN_USER);
  const sshHost = required("VPS_HOST", process.env.VPS_HOST);
  if (!/^[a-zA-Z0-9_.-]+$/.test(sshUser) || !/^[a-zA-Z0-9_.-]+$/.test(sshHost)) {
    throw new Error("The configured VPS SSH target is invalid.");
  }

  const port = await unusedLocalPort();
  const tunnel = spawn("ssh", [
    "-o", "BatchMode=yes",
    "-o", "ExitOnForwardFailure=yes",
    "-o", "ConnectTimeout=10",
    "-N",
    "-L", `127.0.0.1:${port}:127.0.0.1:54322`,
    `${sshUser}@${sshHost}`
  ], { stdio: ["ignore", "ignore", "inherit"] });

  try {
    await waitForTunnel(tunnel, port);
    const dbUrl = `postgresql://postgres@127.0.0.1:${port}/postgres?sslmode=disable`;
    const commandEnv = { ...process.env, PGPASSWORD: password };
    const proofFile = path.join(repoRoot, "scripts/ops/sql/verify-production-history-repair.sql");
    const policy = JSON.parse(
      fs.readFileSync(path.join(repoRoot, "supabase/migration-policy.json"), "utf8")
    ) as MigrationPolicy;

    run("psql", [dbUrl, "--no-psqlrc", "--file", proofFile], commandEnv);

    if (!apply) {
      console.log("Production schema plan (read only):");
      run("supabase", ["db", "push", "--db-url", dbUrl, "--dry-run"], commandEnv);
      console.log("Plan complete. Pre-convergence schema-present versions remain pending until an approved apply repairs history.");
      return;
    }

    if (!policy.production_schema_present_history_missing.length) {
      throw new Error("Migration policy has no verified production history repairs.");
    }
    run("supabase", [
      "migration", "repair",
      ...policy.production_schema_present_history_missing,
      "--status", "applied",
      "--db-url", dbUrl,
      "--yes"
    ], commandEnv);
    run("supabase", ["db", "push", "--db-url", dbUrl, "--dry-run"], commandEnv);
    run("supabase", ["db", "push", "--db-url", dbUrl], commandEnv);
    run("supabase", ["migration", "list", "--db-url", dbUrl], commandEnv);
  } finally {
    tunnel.kill("SIGTERM");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

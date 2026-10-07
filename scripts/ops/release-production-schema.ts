import "../shared/load-env";

import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { migrationBody } from "../ci/migration-transaction.mjs";
import { createHash } from "node:crypto";

import { isProductionSupabaseUrl } from "../shared/supabase-target";

type MigrationPolicy = {
  convergence_version: string;
  production_schema_present_history_missing: string[];
  production_pending_before_convergence: string[];
};

type Migration = {
  version: string;
  name: string;
  file: string;
  sql: string;
};

const repoRoot = path.resolve(import.meta.dirname, "../..");
const migrationRoot = path.join(repoRoot, "supabase/migrations");
const argv = process.argv.slice(2);
const apply = argv.includes("--apply");
const transport = value("--transport") ?? "ssh";
const databaseRole = value("--database-role") ?? "postgres";

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

function sqlLiteral(input: string): string {
  return `'${input.replaceAll("'", "''")}'`;
}

function readMigrations(): Migration[] {
  return fs.readdirSync(migrationRoot)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((file) => {
      const match = file.match(/^(\d{8,14})_([a-z0-9_]+)\.sql$/);
      if (!match) throw new Error(`Invalid migration filename: ${file}`);
      return {
        version: match[1]!,
        name: match[2]!,
        file,
        sql: fs.readFileSync(path.join(migrationRoot, file), "utf8")
      };
    });
}

function runRemoteSql(target: string, sql: string, tuplesOnly = false): string {
  if (transport === "dokploy" || transport === "studio") {
    const helper = path.join(repoRoot, transport === "studio" ? "scripts/ops/studio-container-psql.mjs" : "scripts/ops/dokploy-container-psql.mjs");
    const result = spawnSync(process.execPath, [helper, "--database-role", databaseRole, ...(tuplesOnly ? ["--tuples-only"] : [])], {
      cwd: repoRoot,
      input: sql,
      encoding: "utf8",
      env: process.env,
      maxBuffer: 20 * 1024 * 1024
    });
    if (result.error) throw result.error;
    if (result.stderr) process.stderr.write(result.stderr);
    if (result.status !== 0) {
      if (result.stdout) process.stderr.write(result.stdout);
      throw new Error(`${transport} production SQL exited with status ${result.status}.`);
    }
    return result.stdout.trim();
  }
  const psql = [
    "docker", "exec", "-i", "supabase-db",
    "psql", "-U", databaseRole, "-d", "postgres",
    "-X", "-v", "ON_ERROR_STOP=1"
  ];
  if (tuplesOnly) psql.push("-A", "-t");
  const result = spawnSync("ssh", [
    "-o", "BatchMode=yes",
    "-o", "ConnectTimeout=10",
    target,
    psql.join(" ")
  ], {
    cwd: repoRoot,
    input: sql,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024
  });
  if (result.error) throw result.error;
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) throw new Error(`Remote production psql exited with status ${result.status}.`);
  return result.stdout.trim();
}

function ledgerInsert(migration: Migration): string {
  return `insert into supabase_migrations.schema_migrations (version, name, statements)\n` +
    `values (${sqlLiteral(migration.version)}, ${sqlLiteral(migration.name)}, array[]::text[]);`;
}

async function main() {
  if (!["ssh", "dokploy", "studio"].includes(transport)) {
    throw new Error("--transport must be ssh, dokploy or studio.");
  }
  if (!["postgres", "supabase_admin"].includes(databaseRole)) {
    throw new Error("--database-role must be postgres or supabase_admin.");
  }
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
  const sshUser = transport === "ssh" ? required("VPS_ADMIN_USER", process.env.VPS_ADMIN_USER) : "unused";
  const sshHost = transport === "ssh" ? required("VPS_HOST", process.env.VPS_HOST) : "unused";
  if (!/^[a-zA-Z0-9_.-]+$/.test(sshUser) || !/^[a-zA-Z0-9_.-]+$/.test(sshHost)) {
    throw new Error("The configured VPS SSH target is invalid.");
  }
  const target = `${sshUser}@${sshHost}`;

  const policy = JSON.parse(
    fs.readFileSync(path.join(repoRoot, "supabase/migration-policy.json"), "utf8")
  ) as MigrationPolicy;
  const migrations = readMigrations();
  const byVersion = new Map(migrations.map((migration) => [migration.version, migration]));
  const remoteVersions = new Set(
    runRemoteSql(
      target,
      "select version from supabase_migrations.schema_migrations order by version;",
      true
    ).split(/\s+/).filter(Boolean)
  );

  const historyRepairs = policy.production_schema_present_history_missing
    .filter((version) => !remoteVersions.has(version))
    .map((version) => {
      const migration = byVersion.get(version);
      if (!migration) throw new Error(`History repair version ${version} has no local migration file.`);
      return migration;
    });
  const historyRepairVersions = new Set(historyRepairs.map((migration) => migration.version));
  const pending = migrations.filter(
    (migration) => !remoteVersions.has(migration.version) && !historyRepairVersions.has(migration.version)
  );
  const allowedPreConvergence = new Set(policy.production_pending_before_convergence);
  const unexpected = pending.filter(
    (migration) => migration.version < policy.convergence_version && !allowedPreConvergence.has(migration.version)
  );
  if (unexpected.length) {
    throw new Error(`Unexpected pre-convergence production migrations: ${unexpected.map((item) => item.file).join(", ")}`);
  }

  if (process.env.GITHUB_ACTIONS === "true") {
    const receiptPath = required("--managed-receipt", value("--managed-receipt"));
    const receipt = JSON.parse(fs.readFileSync(receiptPath, "utf8"));
    if (receipt.sha !== approvedSha || receipt.project !== "bbtcaurrtyoukvjbxbbj" || receipt.applied !== true || !Array.isArray(receipt.migrations)) {
      throw new Error("A matching managed-development application receipt is required.");
    }
    for (const migration of pending) {
      const hash = createHash("sha256").update(fs.readFileSync(path.join(migrationRoot, migration.file))).digest("hex");
      if (!receipt.migrations.some((entry: { version: string; hash: string }) => entry.version === migration.version && entry.hash === hash)) {
        throw new Error(`${migration.file} has no matching managed-development proof.`);
      }
    }
  }

  const proofSql = fs.readFileSync(
    path.join(repoRoot, "scripts/ops/sql/verify-production-history-repair.sql"),
    "utf8"
  );
  const transaction = [
    "begin;",
    "select pg_advisory_xact_lock(746213809);",
    "set local lock_timeout = '15s';",
    "set local statement_timeout = '180s';",
    proofSql,
    ...historyRepairs.map(ledgerInsert),
    ...pending.flatMap((migration) => [
      `-- ${migration.file}`,
      migrationBody(migration.sql),
      "set constraints all immediate;",
      ledgerInsert(migration)
    ]),
    apply ? "commit;" : "rollback;"
  ].join("\n\n");

  console.log(`Production history repairs: ${historyRepairs.map((item) => item.version).join(", ") || "none"}`);
  console.log(`Production schema migrations: ${pending.map((item) => item.version).join(", ") || "none"}`);
  if (!historyRepairs.length && !pending.length) {
    runRemoteSql(target, proofSql);
    console.log("Production schema is already converged.");
    return;
  }

  runRemoteSql(target, transaction);
  if (!apply) {
    console.log("Production schema plan passed and was rolled back; no production changes were retained.");
    return;
  }

  const finalVersions = new Set(
    runRemoteSql(
      target,
      "select version from supabase_migrations.schema_migrations order by version;",
      true
    ).split(/\s+/).filter(Boolean)
  );
  const missing = [...historyRepairs, ...pending].filter((migration) => !finalVersions.has(migration.version));
  if (missing.length) throw new Error(`Production ledger verification failed: ${missing.map((item) => item.version).join(", ")}`);
  console.log(`Production schema applied and verified at approved SHA ${approvedSha}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

import "../shared/load-env";
import { migrationBody } from "./migration-transaction.mjs";
import { historyRepairs, repairHistorySql } from "./migration-history.mjs";
import { verifiedMigrationHashes } from "./migration-byte-proof.mjs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const PROJECT = "bbtcaurrtyoukvjbxbbj";
const root = path.resolve(import.meta.dirname, "../..");
const args = process.argv.slice(2);
const apply = args.includes("--apply");
const sha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
const token = process.env.MANAGED_DEV_SUPABASE_ACCESS_TOKEN;
if (!token) throw new Error("MANAGED_DEV_SUPABASE_ACCESS_TOKEN is required. OAuth connector sessions are not CI credentials.");
if (process.env.SUPABASE_URL !== `https://${PROJECT}.supabase.co`) throw new Error("Unexpected managed-development target.");
const policy = JSON.parse(fs.readFileSync(path.join(root, "supabase/migration-policy.json"), "utf8"));
const migrations = fs.readdirSync(path.join(root, "supabase/migrations")).filter(file => file.endsWith(".sql")).sort().map(file => {
  const version = file.match(/^(\d{8,14})_/)?.[1];
  if (!version) throw new Error(`Invalid migration ${file}`);
  const sql = fs.readFileSync(path.join(root, "supabase/migrations", file), "utf8");
  return { version, name: file.slice(version.length + 1, -4), file, sql, hash: createHash("sha256").update(sql).digest("hex") };
});
async function query(sql: string): Promise<Array<Record<string, unknown>>> {
  const response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT}/database/query`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }), signal: AbortSignal.timeout(240_000)
  });
  const result = await response.json();
  if (!response.ok || !Array.isArray(result)) throw new Error(`Managed-development SQL failed with HTTP ${response.status}.`);
  return result;
}
const literal = (value: string) => `'${value.replaceAll("'", "''")}'`;
async function main() {
  const ledgerQuery = "select version,name,encode(sha256(convert_to(array_to_string(statements,E'\\n'),'UTF8')),'hex') as sql_hash from supabase_migrations.schema_migrations order by version;";
  const ledger = await query(ledgerQuery);
  // Include legacy pending production versions when present; never attest an
  // unproven pre-convergence baseline merely because its version exists.
  const proofMigrations = migrations.filter(m => m.version >= policy.convergence_version || policy.managed_dev_pending_before_convergence.includes(m.version) || policy.production_pending_before_convergence.includes(m.version));
  verifiedMigrationHashes(proofMigrations,ledger,policy);
  const repairs = historyRepairs(policy.managed_dev_history_aliases ?? [], migrations, ledger);
  const before = new Set([...ledger.map(row => String(row.version)), ...repairs.map(row => row.version)]);
  const pending = migrations.filter(m => !before.has(m.version) && (m.version >= policy.convergence_version || policy.managed_dev_pending_before_convergence.includes(m.version)));
  console.log(`Managed-development verified history repairs: ${repairs.map(row => row.version).join(", ") || "none"}`);
  console.log(`Managed-development pending migrations: ${pending.map(m => m.file).join(", ") || "none"}`);
  const transaction = ["begin;", "select pg_advisory_xact_lock(746213809);", "set local lock_timeout = '15s';", "set local statement_timeout = '180s';", ...repairHistorySql(repairs), ...pending.flatMap(m => [
    migrationBody(m.sql),
    "set constraints all immediate;",
    `insert into supabase_migrations.schema_migrations(version,name,statements) values (${literal(m.version)},${literal(m.name)},array[${literal(m.sql)}]::text[]);`
  ]), apply ? "commit;" : "rollback;"].join("\n");
  if (pending.length || repairs.length) {
    await query(transaction.replace(/commit;\s*$/, "rollback;"));
    if (apply) await query(transaction);
  }
  const afterLedger = await query(ledgerQuery);
  const verified = verifiedMigrationHashes(proofMigrations,afterLedger,policy);
  const after = new Set(afterLedger.map(row => String(row.version)));
  const missing = migrations.filter(m => (m.version >= policy.convergence_version || policy.managed_dev_pending_before_convergence.includes(m.version)) && !after.has(m.version));
  if (apply && missing.length) throw new Error(`Managed-development ledger is missing ${missing.map(m => m.version).join(", ")}`);
  if (process.env.GITHUB_ACTIONS === "true") {
    fs.writeFileSync(path.join(process.env.RUNNER_TEMP!, "managed-schema-receipt.json"), JSON.stringify({ sha, project: PROJECT, applied: apply, migrations: verified }, null, 2));
  }
  console.log(apply ? `Managed-development schema verified at ${sha}.` : "Managed-development rollback plan passed.");
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });

import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { historyRepairs } from "../ci/migration-history.mjs";

type MigrationPolicy = {
  version: number;
  convergence_version: string;
  production_history_only: string[];
  production_schema_present_history_missing: string[];
  production_history_repaired?: string[];
  production_pending_before_convergence: string[];
  production_applied_pre_convergence?: string[];
  managed_dev_pending_before_convergence: string[];
  managed_dev_baseline_applied?: string[];
  managed_dev_history_aliases?: Array<Record<string, string>>;
};

const repoRoot = path.resolve(import.meta.dirname, "../..");
const migrationRoot = path.join(repoRoot, "supabase/migrations");
const policy = JSON.parse(
  fs.readFileSync(path.join(repoRoot, "supabase/migration-policy.json"), "utf8")
) as MigrationPolicy;
const errors: string[] = [];
const byVersion = new Map<string, string[]>();

for (const name of fs.readdirSync(migrationRoot).filter((entry) => entry.endsWith(".sql")).sort()) {
  const match = name.match(/^(\d{8,14})_[a-z0-9_]+\.sql$/);
  if (!match) {
    errors.push(`Invalid migration filename: ${name}`);
    continue;
  }
  const version = match[1]!;
  byVersion.set(version, [...(byVersion.get(version) ?? []), name]);

  if (version >= policy.convergence_version) {
    const sql = fs.readFileSync(path.join(migrationRoot, name), "utf8").toLowerCase();
    if (sql.includes("security definer") && !sql.includes("set search_path")) {
      errors.push(`${name} creates SECURITY DEFINER code without a fixed search_path.`);
    }
  }
}

for (const [version, names] of byVersion) {
  if (names.length > 1) errors.push(`Duplicate migration version ${version}: ${names.join(", ")}`);
}

if (!byVersion.has(policy.convergence_version)) {
  errors.push(`Convergence migration ${policy.convergence_version} is missing.`);
}
if (fs.existsSync(path.join(repoRoot, "supabase/seed.sql"))) {
  errors.push("supabase/seed.sql exists even though the local Supabase database is retired.");
}
const config = fs.readFileSync(path.join(repoRoot, "supabase/config.toml"), "utf8");
if (!/\[db\.seed\][\s\S]*?enabled\s*=\s*false/.test(config)) {
  errors.push("supabase/config.toml must keep db.seed disabled.");
}

for (const version of [
  ...policy.production_schema_present_history_missing,
  ...(policy.production_history_repaired ?? []),
  ...policy.production_pending_before_convergence,
  ...(policy.production_applied_pre_convergence ?? []),
  ...policy.managed_dev_pending_before_convergence,
  ...(policy.managed_dev_baseline_applied ?? [])
]) {
  if (!byVersion.has(version)) errors.push(`Migration policy references missing local version ${version}.`);
}

try {
  historyRepairs(policy.managed_dev_history_aliases ?? [], [...byVersion].map(([version, files]) => ({
    version, hash: createHash("sha256").update(fs.readFileSync(path.join(migrationRoot, files[0]!))).digest("hex")
  })), []);
} catch (error) {
  errors.push(error instanceof Error ? error.message : String(error));
}

if (errors.length) {
  console.error(`Migration integrity check found ${errors.length} problem(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  `Migration history ready: ${byVersion.size} unique versions; future parity begins at ${policy.convergence_version}.`
);

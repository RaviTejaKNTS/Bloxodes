import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { parse } from "dotenv";

type EnvConfig = {
  version: number;
  profiles: Record<string, string[]>;
  overlays: Record<string, string[]>;
};

const repoRoot = path.resolve(import.meta.dirname, "../..");
const envRoot = path.join(repoRoot, ".envs");
const exampleRoot = path.join(repoRoot, "env/examples");
const config = JSON.parse(fs.readFileSync(path.join(repoRoot, "env/config.json"), "utf8")) as EnvConfig;
const errors: string[] = [];

function filesUnder(root: string, suffix: string): string[] {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { recursive: true, encoding: "utf8" })
    .map((entry) => path.join(root, entry))
    .filter((entry) => entry.endsWith(suffix) && fs.statSync(entry).isFile())
    .sort();
}

function read(relativePath: string): Record<string, string> {
  const filePath = path.join(envRoot, relativePath);
  if (!fs.existsSync(filePath)) {
    errors.push(`Missing env file required by env/config.json: .envs/${relativePath}`);
    return {};
  }
  return parse(fs.readFileSync(filePath));
}

function host(value: string | undefined, label: string): string | null {
  if (!value) {
    errors.push(`${label} is missing.`);
    return null;
  }
  try {
    return new URL(value).hostname;
  } catch {
    errors.push(`${label} is not a valid URL.`);
    return null;
  }
}

if (!fs.existsSync(envRoot)) errors.push(".envs/ is missing. Run scripts/dev/setup-worktree.sh in a worktree.");
if (fs.existsSync(path.join(envRoot, "targets/local.env"))) {
  errors.push(".envs/targets/local.env is forbidden; the local Supabase target is retired.");
}

for (const legacy of [
  ".env",
  ".env.local",
  ".env.analytics",
  ".env.codex",
  ".env.homelab",
  ".env.indexing",
  ".env.northflank",
  ".env.secrets",
  ".env.stats"
]) {
  if (fs.existsSync(path.join(repoRoot, legacy))) errors.push(`Retired legacy path still exists: ${legacy}`);
}

const configuredFiles = new Set([
  ...Object.values(config.profiles).flat(),
  ...Object.values(config.overlays).flat()
]);
for (const relativePath of configuredFiles) read(relativePath);

const realFiles = filesUnder(envRoot, ".env");
const exampleFiles = filesUnder(exampleRoot, ".env.example");
const realKeys = new Set<string>();
const exampleKeys = new Set<string>();
for (const file of realFiles) {
  const mode = fs.statSync(file).mode & 0o777;
  if ((mode & 0o077) !== 0) errors.push(`${path.relative(repoRoot, file)} must be mode 600, not ${mode.toString(8)}.`);
  for (const key of Object.keys(parse(fs.readFileSync(file)))) realKeys.add(key);
}
for (const file of exampleFiles) {
  for (const key of Object.keys(parse(fs.readFileSync(file)))) exampleKeys.add(key);
}
for (const key of [...realKeys].sort()) {
  if (!exampleKeys.has(key)) errors.push(`Real env key is missing from committed examples: ${key}`);
}

const jsonSecret = path.join(envRoot, "secrets/google-indexing-service-account.json");
if (!fs.existsSync(jsonSecret)) errors.push("Missing .envs/secrets/google-indexing-service-account.json.");
else if ((fs.statSync(jsonSecret).mode & 0o077) !== 0) errors.push("Google indexing JSON must be mode 600.");

const tracked = execFileSync("git", ["ls-files", ".envs"], { cwd: repoRoot, encoding: "utf8" }).trim();
if (tracked) errors.push("Real .envs files are tracked by Git.");

const managed = read("targets/managed-dev.env");
const managedServer = host(managed.SUPABASE_URL, "managed-dev SUPABASE_URL");
const managedPublic = host(managed.NEXT_PUBLIC_SUPABASE_URL, "managed-dev NEXT_PUBLIC_SUPABASE_URL");
const managedMedia = host(managed.SUPABASE_MEDIA_PUBLIC_URL, "managed-dev SUPABASE_MEDIA_PUBLIC_URL");
if (!managedServer?.endsWith(".supabase.co")) errors.push("Managed development must use an HTTPS *.supabase.co host.");
if (managedServer !== managedPublic || managedServer !== managedMedia) {
  errors.push("Managed-dev server, public client, and media hosts must be the same managed project.");
}
if (managed.SUPABASE_ANON_KEY !== managed.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  errors.push("Managed-dev server and public anon keys do not match.");
}
if (!managed.SUPABASE_SERVICE_ROLE) errors.push("Managed-dev service-role credential is missing.");

const production = read("targets/production.env");
const productionServer = host(production.SUPABASE_URL, "production SUPABASE_URL");
const productionPublic = host(production.NEXT_PUBLIC_SUPABASE_URL, "production NEXT_PUBLIC_SUPABASE_URL");
const productionMedia = host(production.SUPABASE_MEDIA_PUBLIC_URL, "production SUPABASE_MEDIA_PUBLIC_URL");
if (productionServer !== "database.bloxodes.com" || productionPublic !== "database.bloxodes.com") {
  errors.push("Production server and public client must use database.bloxodes.com.");
}
if (productionMedia !== "media.bloxodes.com") errors.push("Production media must use media.bloxodes.com.");
if (production.SUPABASE_ANON_KEY !== production.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  errors.push("Production server and public anon keys do not match.");
}
if (!production.SUPABASE_SERVICE_ROLE || !production.SUPABASE_DB_PASSWORD) {
  errors.push("Production operator credentials are incomplete.");
}

const expectedManagedProfile = [
  "shared/application.env",
  "integrations/content.env",
  "integrations/distribution.env",
  "targets/managed-dev.env"
];
if (JSON.stringify(config.profiles["managed-dev"]) !== JSON.stringify(expectedManagedProfile)) {
  errors.push("managed-dev profile does not match the canonical file order.");
}
if ((config.profiles["process-only"] ?? []).length !== 0) errors.push("process-only must not load workstation files.");

if (errors.length) {
  console.error(`Environment doctor found ${errors.length} problem(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  `Environment ready: ${realFiles.length} private env files, ${realKeys.size} documented keys, ` +
    `managed-dev=${managedServer}, production=${productionServer}, no local Supabase target.`
);

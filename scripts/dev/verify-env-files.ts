import fs from "node:fs";
import path from "node:path";
import { parse } from "dotenv";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const envRoot = path.join(repoRoot, ".envs");
const legacyFiles = [
  ".env",
  ".env.local",
  ".env.analytics",
  ".env.indexing",
  ".env.homelab",
  ".env.northflank",
  ".env.stats",
  ".env.codex"
];

function pairsFromFile(filePath: string): Set<string> {
  const values = parse(fs.readFileSync(filePath));
  return new Set(Object.entries(values).map(([key, value]) => `${key}\u0000${value}`));
}

function expectedMigratedPair(pair: string): string {
  const legacyIndexingPath =
    "GOOGLE_INDEXING_SERVICE_ACCOUNT_FILE\u0000.env.secrets/google-indexing-service-account.json";
  return pair === legacyIndexingPath
    ? "GOOGLE_INDEXING_SERVICE_ACCOUNT_FILE\u0000.envs/secrets/google-indexing-service-account.json"
    : pair;
}

const legacyPairs = new Set<string>();
for (const relativePath of legacyFiles) {
  const filePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(filePath)) continue;
  for (const pair of pairsFromFile(filePath)) legacyPairs.add(pair);
}

const migratedPairs = new Set<string>();
for (const filePath of fs.existsSync(envRoot)
  ? fs.readdirSync(envRoot, { recursive: true, encoding: "utf8" })
      .map((entry) => path.join(envRoot, entry))
      .filter((entry) => entry.endsWith(".env") && fs.statSync(entry).isFile())
  : []) {
  for (const pair of pairsFromFile(filePath)) migratedPairs.add(pair);
}

const missing = [...legacyPairs].filter((pair) => !migratedPairs.has(expectedMigratedPair(pair)));
if (missing.length) {
  console.error(`Missing ${missing.length} legacy key/value pair(s):`);
  for (const pair of missing) console.error(`- ${pair.split("\u0000", 1)[0]}`);
  process.exit(1);
}

const legacySecret = path.join(repoRoot, ".env.secrets/google-indexing-service-account.json");
const migratedSecret = path.join(envRoot, "secrets/google-indexing-service-account.json");
if (fs.existsSync(legacySecret)) {
  if (!fs.existsSync(migratedSecret)) throw new Error("Google indexing service-account file was not migrated.");
  if (!fs.readFileSync(legacySecret).equals(fs.readFileSync(migratedSecret))) {
    throw new Error("Migrated Google indexing service-account file differs from the legacy file.");
  }
}

const managedDev = parse(fs.readFileSync(path.join(envRoot, "targets/managed-dev.env")));
if (!managedDev.SUPABASE_URL?.includes(".supabase.co")) {
  throw new Error("Legacy .env.local values were not preserved as the managed-dev target.");
}

console.log(
  `Verified ${legacyPairs.size} unique legacy key/value pairs; none were lost ` +
    "(the indexing credential file path was relocated intentionally)."
);

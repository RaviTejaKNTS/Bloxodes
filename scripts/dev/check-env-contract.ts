import fs from "node:fs";
import path from "node:path";
import { parse } from "dotenv";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const realRoot = path.join(repoRoot, ".envs");
const exampleRoot = path.join(repoRoot, "env/examples");

function envFiles(root: string, suffix: string): string[] {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { recursive: true, encoding: "utf8" })
    .map((entry) => path.join(root, entry))
    .filter((entry) => entry.endsWith(suffix) && fs.statSync(entry).isFile());
}

function keys(files: string[]): Set<string> {
  const result = new Set<string>();
  for (const file of files) {
    for (const key of Object.keys(parse(fs.readFileSync(file)))) result.add(key);
  }
  return result;
}

const realFiles = envFiles(realRoot, ".env");
const exampleFiles = envFiles(exampleRoot, ".env.example");
const realKeys = keys(realFiles);
const exampleKeys = keys(exampleFiles);
const undocumented = [...realKeys].filter((key) => !exampleKeys.has(key)).sort();

if (undocumented.length) {
  console.error("Real env keys missing from committed examples:");
  for (const key of undocumented) console.error(`- ${key}`);
  process.exit(1);
}

for (const file of realFiles) {
  const mode = fs.statSync(file).mode & 0o777;
  if ((mode & 0o077) !== 0) throw new Error(`${file} must not be group/world readable (mode ${mode.toString(8)}).`);
}

const secretFile = path.join(realRoot, "secrets/google-indexing-service-account.json");
if (fs.existsSync(secretFile) && (fs.statSync(secretFile).mode & 0o077) !== 0) {
  throw new Error(`${secretFile} must not be group/world readable.`);
}

console.log(
  `Env contract is complete: ${realKeys.size} real variable names are documented by ${exampleFiles.length} example files.`
);

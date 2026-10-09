import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

export const sharedFolders = ["content-workspace", "game-plans", "game-collection-suggestions", "game-collection-runs"];
export const referenceFolders = [
  "article-pipeline", "sourced-games", "minecraft-tool-covers", "beebom-editorial-study",
  "gta-map-research", "gta-race-source-cache", "gta-radio-source-pages", "gta4-encounter-sources",
  "gta-online-character-sources", "gta-vehicle-source-html-2026-09-26",
  "gta-other-vehicle-source-html-2026-09-26", "gta-hd-weapon-source-html-2026-09-26",
  "gta-kill-frenzy-source-2026-09-26", "gta-weapon-database-2026-09-26", "release-backups",
];

export function git(root, ...args) {
  return execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

export function worktreeRecords(root) {
  return git(root, "worktree", "list", "--porcelain", "-z").split("\0\0").filter(Boolean).map(record =>
    Object.fromEntries(record.split("\0").filter(Boolean).map(line => {
      const space = line.indexOf(" ");
      return space < 0 ? [line, true] : [line.slice(0, space), line.slice(space + 1)];
    })));
}

export async function existing(file) {
  try { return await fs.lstat(file); }
  catch (error) { if (error.code === "ENOENT") return null; throw error; }
}

export function contains(parent, child) {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

export async function checkoutPaths(cwd = process.cwd(), suppliedMain = process.env.T3CODE_PROJECT_ROOT) {
  const root = await fs.realpath(git(cwd, "rev-parse", "--show-toplevel"));
  const records = worktreeRecords(root);
  const main = await fs.realpath(records[0].worktree);
  if (suppliedMain && await fs.realpath(suppliedMain) !== main) throw new Error("T3CODE_PROJECT_ROOT must be this repository's main checkout.");
  const common = async checkout => fs.realpath(git(checkout, "rev-parse", "--path-format=absolute", "--git-common-dir"));
  if (await common(root) !== await common(main)) throw new Error("The task and main checkout must belong to the same repository.");
  return { root, main, records };
}

async function optionalReferencePath(file) {
  try { return await fs.realpath(file); }
  catch (error) { if (["ENOENT", "ENOTDIR", "ELOOP"].includes(error.code)) return null; throw error; }
}

export async function inspectLink(source, destination, { optional = false } = {}) {
  const current = await existing(destination);
  if (current && !current.isSymbolicLink()) throw new Error(`Preserving existing local path. Merge its files before linking: ${destination}`);
  if (!optional) {
    if (!current) return true;
    if (await fs.realpath(destination) !== await fs.realpath(source)) throw new Error(`Existing link points somewhere else: ${destination}`);
    return false;
  }
  // Check destination conflicts before skipping, so a missing source never hides one.
  const resolvedSource = await optionalReferencePath(source);
  const resolvedDestination = current ? await optionalReferencePath(destination) : null;
  if (resolvedDestination && resolvedDestination !== resolvedSource) throw new Error(`Existing link points somewhere else: ${destination}`);
  if (!resolvedSource) {
    console.warn(`Skipping missing or dangling optional reference source: ${source}`);
    return false;
  }
  if (current && !resolvedDestination) {
    console.warn(`Skipping dangling optional reference link: ${destination}`);
    return false;
  }
  return !current;
}

export async function privateEnvFiles(directory) {
  const files = [];
  async function walk(folder) {
    for (const entry of await fs.readdir(folder, { withFileTypes: true })) {
      const file = path.join(folder, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Private env storage cannot contain a nested symlink: ${file}`);
      if (entry.isDirectory()) await walk(file);
      else {
        const info = await fs.stat(file);
        if (!info.isFile() || (info.mode & 0o077) !== 0) throw new Error(`Env file must be a private regular file: ${file}`);
        await fs.access(file);
        files.push(file);
      }
    }
  }
  await walk(directory);
  return files;
}

export async function taskLocationAllowed(main, target, current) {
  const resolved = await fs.realpath(target);
  if (resolved === await fs.realpath(current) || resolved === main) return false;
  const roots = [path.join(main, "tmp/worktrees"), "/srv/data/t3code/worktrees/Bloxodes"];
  return roots.some(root => contains(root, resolved) && root !== resolved);
}

export async function findWorktreeRecord(records, target) {
  for (const record of records) {
    try {
      if (await fs.realpath(record.worktree) === target) return record;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  return undefined;
}

import fs from "node:fs";
import path from "node:path";

function hasRepoMarkers(dir: string) {
  return fs.existsSync(path.join(dir, "package.json")) && fs.existsSync(path.join(dir, "data"));
}

function findRepoRoot(startDir: string) {
  const configured = process.env.BLOXODES_REPO_ROOT;
  if (configured && hasRepoMarkers(configured)) {
    return configured;
  }

  let current = startDir;
  while (true) {
    if (hasRepoMarkers(current)) return current;
    const parent = path.dirname(current);
    if (parent === current) return startDir;
    current = parent;
  }
}

export const REPO_ROOT = findRepoRoot(process.cwd());

export function repoPath(...segments: string[]) {
  return path.join(REPO_ROOT, ...segments);
}

export function webPublicPath(...segments: string[]) {
  return repoPath("apps", "web", "public", ...segments);
}

import { readdir, readFile, realpath, lstat, rm } from "node:fs/promises";
import path from "node:path";

const root = "/home/teja/.local/share/bloxodes-automation-runtime";
async function main() {
  const releasesRoot = await realpath(path.join(root, "releases"));
  const preserve = new Set<string>();
  preserve.add(await realpath(path.join(root, "current")));
  const prepared = (await readFile(path.join(root, "prepared-sha"), "utf8")).trim();
  if (!/^[0-9a-f]{40}$/.test(prepared)) throw new Error("Invalid prepared runtime SHA.");
  preserve.add(path.join(releasesRoot, prepared));
  const activations = (await readdir(path.join(root, "activations"))).sort().reverse();
  for (const activation of activations) {
    const previous = await readFile(path.join(root, "activations", activation, "previous-current"), "utf8").catch(() => "");
    const candidate = previous.trim();
    if (candidate && !preserve.has(candidate)) { preserve.add(candidate); break; }
  }
  const releases = await Promise.all((await readdir(releasesRoot)).filter(name => /^[0-9a-f]{40}$/.test(name)).map(async name => {
    const directory = path.join(releasesRoot, name);
    return { directory, mtime: (await lstat(directory)).mtimeMs };
  }));
  releases.sort((a, b) => b.mtime - a.mtime).slice(0, 3).forEach(release => preserve.add(release.directory));
  // Preserve any accessible process working directory as an additional guard.
  for (const pid of (await readdir("/proc")).filter(name => /^\d+$/.test(name))) {
    const cwd = await realpath(`/proc/${pid}/cwd`).catch(() => "");
    for (const release of releases) if (cwd === release.directory || cwd.startsWith(release.directory + "/")) preserve.add(release.directory);
  }
  let candidates = 0;
  for (const { directory } of releases) {
    if (preserve.has(directory)) continue;
    for (const name of ["node_modules", "apps/web/.next"]) {
      const target = path.join(directory, name);
      const info = await lstat(target).catch(() => null);
      if (!info) continue;
      if (!info.isDirectory() || info.isSymbolicLink()) throw new Error(`Cache is not a real directory: ${target}`);
      if (await realpath(target) !== target) throw new Error(`Cache path escapes release: ${target}`);
      // Recheck the pointer immediately before removal, including during prep.
      const current = await realpath(path.join(root, "current"));
      if (directory === current) throw new Error("Runtime changed during cache retention; retry.");
      candidates += 1;
      console.log(`${process.argv.includes("--apply") ? "Removing" : "Would remove"} generated cache ${target}`);
      if (process.argv.includes("--apply")) await rm(target, { recursive: true, force: true });
    }
  }
  console.log(`${candidates} superseded caches selected. Source checkouts, state, credentials and artifacts retained.`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });

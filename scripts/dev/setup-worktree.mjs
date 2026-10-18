import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkoutPaths, existing, inspectLink, privateEnvFiles, contains } from "./worktree-storage.mjs";

export async function setupWorktree({ cwd = process.cwd(), suppliedMain = process.env.T3CODE_PROJECT_ROOT } = {}) {
  const { root, main } = await checkoutPaths(cwd, suppliedMain);
  if (await existing("/srv/data/t3code") && (!contains("/srv/data", main) || !contains("/srv/data", root))) {
    throw new Error("Bloxodes homelab development checkouts must resolve to the HDD under /srv/data.");
  }
  const sourceEnv = path.join(main, ".envs");
  const files = await privateEnvFiles(sourceEnv);
  const config = JSON.parse(await fs.readFile(path.join(root, "env/config.json"), "utf8"));
  for (const name of config.profiles["managed-dev"]) await fs.access(path.join(sourceEnv, name));
  for (const name of ["node_modules", "tmp", "apps/web/.next"]) {
    if ((await existing(path.join(root, name)))?.isSymbolicLink()) throw new Error(`${name} must belong to this checkout.`);
  }
  const tmp = path.join(root, "tmp");
  const links = [];
  const collectLink = async (source, destination) => {
    if (await inspectLink(source, destination)) links.push({ source, destination });
  };
  // Inspect every destination before creating directories or links.
  if (root !== main) {
    await collectLink(sourceEnv, path.join(root, ".envs"));
  }
  for (const name of ["AGENTS.md", ".agents/skills", ".claude/skills", ".codex/environments/environment.toml", "t3.json"]) await fs.access(path.join(root, name));
  await fs.mkdir(tmp, { recursive: true });
  await fs.mkdir(path.join(tmp, "test-reports"), { recursive: true });
  for (const { source, destination } of links) {
    try { await fs.symlink(source, destination); }
    catch (error) {
      if (error.code !== "EEXIST") throw error;
      await inspectLink(source, destination);
    }
  }
  console.log(`Worktree ready: ${root}. Linked private env files: ${files.length}.`);
  console.log("tmp/ is private checkout scratch and is deleted with this worktree.");
  console.log("Dependencies, checks, builds and browser verification run on GitHub.");
  return { root, main, links: links.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  setupWorktree().catch(error => { console.error(error.message); process.exitCode = 1; });
}

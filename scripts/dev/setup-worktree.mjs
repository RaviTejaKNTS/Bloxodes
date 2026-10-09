import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkoutPaths, existing, inspectLink, privateEnvFiles, referenceFolders, sharedFolders, contains } from "./worktree-storage.mjs";

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
  const mainTmp = path.join(main, "tmp");
  const history = path.join(mainTmp, "worktree-reference");
  const claims = path.join(mainTmp, "content-claims");
  const links = [];
  const collectLink = async (source, destination, options) => {
    if (await inspectLink(source, destination, options)) links.push({ source, destination, options });
  };
  // Inspect every destination before creating directories or links.
  if (root !== main) {
    await collectLink(sourceEnv, path.join(root, ".envs"));
    for (const name of sharedFolders) await collectLink(path.join(mainTmp, name), path.join(tmp, name));
    await collectLink(history, path.join(tmp, "shared-history"));
    await collectLink(claims, path.join(tmp, "content-claims"));
  }
  for (const name of referenceFolders) {
    const source = path.join(mainTmp, name);
    await collectLink(source, path.join(history, name), { optional: true });
  }
  for (const name of ["AGENTS.md", ".agents/skills", ".claude/skills", ".codex/environments/environment.toml", "t3.json"]) await fs.access(path.join(root, name));
  await fs.mkdir(tmp, { recursive: true });
  await fs.mkdir(path.join(tmp, "test-reports"), { recursive: true });
  for (const name of sharedFolders) await fs.mkdir(path.join(mainTmp, name), { recursive: true });
  await fs.mkdir(history, { recursive: true });
  await fs.mkdir(claims, { recursive: true, mode: 0o700 });
  for (const { source, destination, options } of links) {
    try { await fs.symlink(source, destination); }
    catch (error) {
      if (error.code !== "EEXIST") throw error;
      await inspectLink(source, destination, options);
    }
  }
  console.log(`Worktree ready: ${root}. Shared private env files: ${files.length}.`);
  console.log("Claim a game before editing shared drafts. Historical article artifacts are under tmp/shared-history/article-pipeline.");
  console.log("Dependencies, checks, builds and browser verification run on GitHub.");
  return { root, main, links: links.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  setupWorktree().catch(error => { console.error(error.message); process.exitCode = 1; });
}

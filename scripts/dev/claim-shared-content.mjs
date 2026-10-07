import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkoutPaths, git } from "./worktree-storage.mjs";

export async function claimContent({ main, root, game, release = false }) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(game ?? "")) throw new Error("Select one --game slug, for example minecraft-java.");
  const directory = path.join(main, "tmp/content-claims");
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  const file = path.join(directory, `${game}.json`);
  const owner = await fs.realpath(root);
  const operation = path.join(directory, `${game}.operation`);
  let locked = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { await fs.mkdir(operation, { mode: 0o700 }); locked = true; break; }
    catch (error) {
      if (error.code !== "EEXIST") throw error;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
  }
  if (!locked) throw new Error(`Another claim operation is in progress: ${operation}. Inspect an abandoned operation before removing it.`);
  try {
    if (!release) {
      let handle;
      try { handle = await fs.open(file, "wx", 0o600); }
      catch (error) {
        if (error.code !== "EEXIST") throw error;
        const current = JSON.parse(await fs.readFile(file, "utf8"));
        if (current.worktree === owner) return;
        throw new Error(`Shared drafts for ${game} belong to ${current.worktree}. Keep that claim until its task releases it.`);
      }
      try { await handle.writeFile(JSON.stringify({ game, worktree: owner, claimedAt: new Date().toISOString() }) + "\n"); }
      finally { await handle.close(); }
    } else {
      let current;
      try { current = JSON.parse(await fs.readFile(file, "utf8")); }
      catch (error) { if (error.code === "ENOENT") return; throw error; }
      if (current.worktree !== owner) throw new Error(`Only ${current.worktree} can release this game claim.`);
      await fs.unlink(file);
    }
  } finally {
    await fs.rmdir(operation);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const gameIndex = args.indexOf("--game");
  checkoutPaths().then(async ({ main, root }) => {
    if (!git(root, "branch", "--show-current")) throw new Error("Installed detached runtimes do not claim task drafts.");
    await claimContent({ main, root, game: gameIndex >= 0 ? args[gameIndex + 1] : undefined, release: args.includes("--release") });
    console.log(`Shared draft claim ${args.includes("--release") ? "released" : "held"}.`);
  }).catch(error => { console.error(error.message); process.exitCode = 1; });
}

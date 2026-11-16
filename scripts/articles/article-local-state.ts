import { randomUUID } from "node:crypto";
import { hostname, homedir } from "node:os";
import path from "node:path";
import fs from "node:fs/promises";

export type ArticleCandidate = {
  id: string; source_url: string; source_title: string; source_name: string;
  curation_status: string; created_at: string; updated_at: string;
  [key: string]: any;
};
export type ArticleLocalState = { version: 1; candidates: ArticleCandidate[]; runs: Record<string, any>[] };
export function articleStateDirectory() {
  const configured = process.env.ARTICLE_DISCOVERY_STATE_DIR?.trim();
  const directory = path.resolve(configured || (process.platform === "linux"
    ? "/srv/data/bloxodes-automation-runtime/state/articles"
    : path.join(homedir(), ".local/state/bloxodes/articles")));
  if (directory.split(path.sep).includes("current")) throw new Error("ARTICLE_DISCOVERY_STATE_DIR must be outside the runtime current symlink.");
  return directory;
}
export function pruneArticleState(state: ArticleLocalState, now = Date.now()) {
  const cutoff = now - 90 * 86400_000;
  const recent = state.candidates.filter(row => Date.parse(row.last_seen_at || row.updated_at || row.created_at) >= cutoff);
  // Never silently drop unprocessed work to satisfy a size limit.
  const pending = recent.filter(row => ["pending", "processing"].includes(row.curation_status));
  if (pending.length > 5000) throw new Error("Article discovery has more than 5,000 undecided candidates; curate them before discovery continues.");
  state.candidates = [...pending, ...recent.filter(row => !["pending", "processing"].includes(row.curation_status))
    .sort((a, b) => String(b.last_seen_at || b.updated_at).localeCompare(String(a.last_seen_at || a.updated_at))).slice(0, 5000 - pending.length)];
  state.runs = state.runs.filter(row => Date.parse(row.created_at) >= cutoff).slice(-200);
  // Full model responses are useful briefly; decisions and counts last 90 days.
  for (const run of state.runs.slice(0, -10)) delete run.raw_response;
  return state;
}
export async function readArticleState(directory = articleStateDirectory()): Promise<ArticleLocalState> {
  try {
    const stat = await fs.stat(path.join(directory, "state.json"));
    if (stat.size > 64 * 1024 * 1024) throw new Error("Article discovery state exceeds 64 MB.");
    const state = JSON.parse(await fs.readFile(path.join(directory, "state.json"), "utf8"));
    if (state.version !== 1 || !Array.isArray(state.candidates) || !Array.isArray(state.runs)) throw new Error("Invalid article discovery state schema.");
    return state;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { version: 1, candidates: [], runs: [] };
    throw error;
  }
}
export async function saveArticleState(state: ArticleLocalState, directory = articleStateDirectory()) {
  const serialized = JSON.stringify(pruneArticleState(state));
  if (Buffer.byteLength(serialized) > 64 * 1024 * 1024) throw new Error("Article discovery state exceeds 64 MB after pruning.");
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  const temporary = path.join(directory, `.state-${randomUUID()}.tmp`);
  try {
    const handle = await fs.open(temporary, "wx", 0o600);
    try { await handle.writeFile(serialized); await handle.sync(); } finally { await handle.close(); }
    await fs.rename(temporary, path.join(directory, "state.json"));
    const parent = await fs.open(directory, "r");
    try { await parent.sync(); } finally { await parent.close(); }
  } finally { await fs.rm(temporary, { force: true }); }
}

// mkdir gives the lock a visible owner directory even if the process is killed
// before it writes owner.json. Same-host dead PIDs are recovered immediately.
export async function withArticleState<T>(apply: boolean, work: (state: ArticleLocalState, save: () => Promise<void>) => Promise<T>, directory = articleStateDirectory()) {
  if (!apply) return work(await readArticleState(directory), async () => {});
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  const lock = path.join(directory, ".writer-lock");
  const token = randomUUID();
  for (let attempt = 0; ; attempt++) {
    try { await fs.mkdir(lock); break; }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      if (attempt > 0) throw new Error("Article discovery state is busy.");
      let stale = false;
      try {
        const owner = JSON.parse(await fs.readFile(path.join(lock, "owner.json"), "utf8"));
        const started = Date.parse(owner.started_at);
        const leaseExpired = Number.isFinite(started) && Date.now() - started > 2 * 3600_000;
        if (owner.host === hostname() && Number.isInteger(owner.pid)) {
          stale = leaseExpired;
          try { process.kill(owner.pid, 0); } catch (error) { stale ||= (error as NodeJS.ErrnoException).code === "ESRCH"; }
        } else stale = Number.isFinite(started) ? leaseExpired : Date.now() - (await fs.stat(lock)).mtimeMs > 60_000;
      } catch { stale = Date.now() - (await fs.stat(lock)).mtimeMs > 60_000; }
      if (!stale) throw new Error("Article discovery state is busy.");
      // Rename before removal; never unlink a replacement owner's lock.
      const abandoned = `${lock}.stale-${randomUUID()}`;
      try { await fs.rename(lock, abandoned); } catch { throw new Error("Article discovery lock changed; retry."); }
      await fs.rm(abandoned, { recursive: true, force: true });
    }
  }
  try {
    await fs.writeFile(path.join(lock, "owner.json"), JSON.stringify({ token, host: hostname(), pid: process.pid, started_at: new Date().toISOString() }));
    // Clean only abandoned temp files from earlier, interrupted atomic saves.
    for (const name of await fs.readdir(directory)) if (/^\.state-[0-9a-f-]+\.tmp$/.test(name)) await fs.rm(path.join(directory, name), { force: true });
    const state = await readArticleState(directory);
    return await work(state, () => saveArticleState(state, directory));
  } finally {
    const owner = JSON.parse(await fs.readFile(path.join(lock, "owner.json"), "utf8"));
    if (owner.token === token) await fs.rm(lock, { recursive: true });
  }
}

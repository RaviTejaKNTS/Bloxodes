import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { acquireAdvisoryFileLock } from "../shared/advisory-file-lock";

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
  const newestFirst = (a: ArticleCandidate, b: ArticleCandidate) =>
    String(b.source_published_at || b.source_discovered_at || b.created_at).localeCompare(String(a.source_published_at || a.source_discovered_at || a.created_at)) || b.id.localeCompare(a.id);
  // A saved curation plan must retain every referenced candidate for recovery.
  const planned = new Set(state.runs.filter(run => run.status === "running").flatMap(run => run.candidate_ids ?? []));
  const protectedRows = state.candidates.filter(row => row.curation_status === "processing" || planned.has(row.id));
  if (protectedRows.length > 5000) throw new Error("Article discovery has more than 5,000 candidates in active curation plans.");
  const protectedIds = new Set(protectedRows.map(row => row.id));
  const pending = recent.filter(row => row.curation_status === "pending" && !protectedIds.has(row.id)).sort(newestFirst);
  const retained = pending.slice(0, 5000 - protectedRows.length);
  const dropped = pending.length - retained.length;
  if (dropped) console.warn(`Article discovery backlog cap: dropped ${dropped} oldest undecided candidate(s); kept ${retained.length} newest undecided and ${protectedRows.length} active candidate(s), limit 5,000.`);
  state.candidates = [...protectedRows, ...retained, ...recent.filter(row => row.curation_status !== "pending" && !protectedIds.has(row.id))
    .sort(newestFirst).slice(0, 5000 - protectedRows.length - retained.length)];
  const activeRuns = state.runs.filter(row => row.status === "running");
  if (activeRuns.length > 200) throw new Error("Article discovery has more than 200 active curation runs.");
  const completedSlots = 200 - activeRuns.length;
  const completedRuns = state.runs.filter(row => row.status !== "running" && Date.parse(row.created_at) >= cutoff);
  state.runs = [...(completedSlots ? completedRuns.slice(-completedSlots) : []), ...activeRuns];
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

export async function withArticleState<T>(apply: boolean, work: (state: ArticleLocalState, save: () => Promise<void>) => Promise<T>, directory = articleStateDirectory()) {
  if (!apply) return work(await readArticleState(directory), async () => {});
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  const unlock = await acquireAdvisoryFileLock(path.join(directory, ".writer.lock"));
  try {
    // Clean only abandoned temp files from earlier, interrupted atomic saves.
    for (const name of await fs.readdir(directory)) if (/^\.state-[0-9a-f-]+\.tmp$/.test(name)) await fs.rm(path.join(directory, name), { force: true });
    const state = await readArticleState(directory);
    return await work(state, () => saveArticleState(state, directory));
  } finally {
    await unlock();
  }
}

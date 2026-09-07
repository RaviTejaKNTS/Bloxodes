import "../shared/load-env";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { saveJson } from "./article-pipeline";
import { resolveArticleDevCredentials } from "./article-queue-env";
import { acquireAgentWorkLock } from "../shared/agent-work-lock";

export type PublicationIntent = { version: 1; queueId: string; authorizedAt: string; attempts: number; nextAttemptAt?: string; publishedAt?: string; error?: string };
const directory = (root: string) => path.join(root, "tmp/article-publication");
function intentPath(root: string, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Publication intent requires an exact queue UUID.");
  return path.join(directory(root), `${id}.json`);
}
// Persist authorization BEFORE the writer starts. A crash after completion cannot lose it.
export async function authorizePublication(root: string, id: string) {
  const file = intentPath(root, id);
  try { await readFile(file); return; } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  await saveJson(file, { version: 1, queueId: id, authorizedAt: new Date().toISOString(), attempts: 0 } satisfies PublicationIntent);
}
export function publicationDue(intent: PublicationIntent, now = Date.now()) {
  return !intent.publishedAt && intent.attempts < 6 && (!intent.nextAttemptAt || Date.parse(intent.nextAttemptAt) <= now);
}
export async function drainPublications(root: string, dev: { url: string; serviceRole: string }, release = async (id: string) => {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("npm", ["run", "articles:release", "--", "--queue-id", id, "--apply", "--allow-prod"], { cwd: root, env: process.env, stdio: "inherit" });
    child.on("error", reject); child.on("close", code => code === 0 ? resolve() : reject(new Error(`Guarded release exited ${code}`)));
  });
}) {
  const unlock = await acquireAgentWorkLock(directory(root), "publication-outbox");
  if (!unlock) return;
  const issues: string[] = [];
  try {
    const db = createClient(dev.url, dev.serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });
    for (const name of (await readdir(directory(root))).filter(n => /^[0-9a-f-]{36}\.json$/i.test(n))) {
      const file = path.join(directory(root), name);
      try {
        const intent = JSON.parse(await readFile(file, "utf8")) as PublicationIntent;
        if (intent.version !== 1 || !Number.isInteger(intent.attempts) || intent.attempts < 0 || !Number.isFinite(Date.parse(intent.authorizedAt)) || (intent.nextAttemptAt && !Number.isFinite(Date.parse(intent.nextAttemptAt))) || path.basename(intentPath(root, intent.queueId)) !== name) throw new Error(`Invalid publication intent ${name}`);
        if (intent.publishedAt) continue;
        if (intent.attempts >= 6) { issues.push(`${intent.queueId}: publication retries exhausted; ${intent.error}`); continue; }
        if (!publicationDue(intent)) continue;
        const { data: row, error } = await db.from("article_generation_queue").select("status").eq("id", intent.queueId).eq("workflow_mode", "agent_runner").maybeSingle();
        if (error) throw new Error(error.message);
        if (!row || !["completed", "published"].includes(row.status)) continue;
        // Reserve retry durably before subprocess: process loss also consumes a bounded attempt.
        intent.attempts++;
        intent.nextAttemptAt = new Date(Date.now() + Math.min(360, 15 * 2 ** (intent.attempts - 1)) * 60_000).toISOString();
        await saveJson(file, intent);
        try {
          await release(intent.queueId);
          intent.publishedAt = new Date().toISOString(); delete intent.error; delete intent.nextAttemptAt;
        } catch (error) { intent.error = error instanceof Error ? error.message : String(error); issues.push(`${intent.queueId}: ${intent.error}`); }
        await saveJson(file, intent);
      } catch (error) { issues.push(`${name}: ${error instanceof Error ? error.message : error}`); }
    }
    await saveJson(path.join(directory(root), "health.json"), { checkedAt: new Date().toISOString(), issues });
    if (issues.length) throw new Error(`Article publication needs attention:\n${issues.join("\n")}`);
  } finally { await unlock(); }
}
async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 1 || args[0] !== "--apply") throw new Error("Usage: npm run articles:publication:drain -- --apply");
  await drainPublications(process.cwd(), resolveArticleDevCredentials());
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main().catch(error => { console.error(error.message); process.exitCode = 1; });

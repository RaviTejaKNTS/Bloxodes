import "../shared/load-env";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { dispatchArticle } from "../ci/dispatch-article";
import { createClient } from "@supabase/supabase-js";
import { saveJson } from "./article-pipeline";
import { resolveArticleDevCredentials } from "./article-queue-env";
import { acquireAgentWorkLock } from "../shared/agent-work-lock";
import {execFileSync} from 'node:child_process';
import {matchingArticleRun,articleRunOutcome} from '../ci/article-publication-state.mjs';

export type PublicationIntent = { version: 1; queueId: string; authorizedAt: string; attempts: number; nextAttemptAt?: string; publishedAt?: string; error?: string; dispatchHash?: string; submittedAt?: string; githubRunId?: number; githubRunUrl?: string };
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
export async function acknowledgePublishedIntents(root: string, dev: { url: string; serviceRole: string }, ids: string[]) {
  if (!ids.length || ids.length > 20 || new Set(ids).size !== ids.length || ids.some(id => !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))) throw new Error("Acknowledgement requires 1-20 exact unique queue UUIDs.");
  const unlock = await acquireAgentWorkLock(directory(root), "publication-acknowledgement");
  if (!unlock) throw new Error("Publication outbox is busy; retry the exact acknowledgement after its owner finishes.");
  try {
    const db = createClient(dev.url, dev.serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: rows, error } = await db.from("article_generation_queue").select("id,status,result_slug,production_url").in("id", ids).eq("workflow_mode", "agent_runner");
    if (error) throw new Error(error.message);
    const intents = [];
    for (const id of ids) {
      const row = rows?.find(row => row.id === id);
      if (row?.status !== "published" || !row.result_slug || row.production_url !== `https://bloxodes.com/articles/${row.result_slug}`) throw new Error(`${id}: exact queue row is not acknowledged as published at its canonical URL.`);
      const intent = JSON.parse(await readFile(intentPath(root, id), "utf8")) as PublicationIntent;
      if (intent.version !== 1 || intent.queueId !== id || !Number.isFinite(Date.parse(intent.authorizedAt)) || !Number.isInteger(intent.attempts) || intent.attempts < 0) throw new Error(`${id}: invalid original publication authorization.`);
      intents.push(intent);
    }
    for (const intent of intents) {
      intent.publishedAt ||= new Date().toISOString(); delete intent.error; delete intent.nextAttemptAt;
      await saveJson(intentPath(root, intent.queueId), intent);
      console.log(`Acknowledged already-published article ${intent.queueId}; attempts retained=${intent.attempts}.`);
    }
  } finally { await unlock(); }
}
export async function drainPublications(root: string, dev: { url: string; serviceRole: string }, release?: (id: string) => Promise<void | { dispatched: true; hash: string }>) {
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
        const { data: row, error } = await db.from("article_generation_queue").select("status,result_slug,production_url").eq("id", intent.queueId).eq("workflow_mode", "agent_runner").maybeSingle();
        if (error) throw new Error(error.message);
        // An exact guarded manual recovery may finish after the outbox exhausts.
        // Reconcile its verified queue acknowledgement without resetting attempts.
        if (row?.status === "published") {
          if (!row.result_slug || row.production_url !== `https://bloxodes.com/articles/${row.result_slug}`) throw new Error("Published queue acknowledgement has no matching canonical URL.");
          intent.publishedAt = new Date().toISOString(); delete intent.error; delete intent.nextAttemptAt;
          await saveJson(file, intent);
          continue;
        }
        if (intent.dispatchHash) {
          const endpoint=intent.githubRunId ? `repos/RaviTejaKNTS/Bloxodes/actions/runs/${intent.githubRunId}` : `repos/RaviTejaKNTS/Bloxodes/actions/workflows/publish-content.yml/runs?event=workflow_dispatch&branch=production&per_page=100&created=%3E%3D${encodeURIComponent(intent.submittedAt!)}`;
          const response=JSON.parse(execFileSync('gh',['api',endpoint],{encoding:'utf8',timeout:30_000}));
          const run=matchingArticleRun(intent.githubRunId?[response]:response.workflow_runs,intent);
          if(run) {intent.githubRunId=run.id;intent.githubRunUrl=run.html_url;await saveJson(file,intent);}
          const outcome=articleRunOutcome(run);
          if(outcome==='pending') {
            if(!run && Date.now()-Date.parse(intent.submittedAt!)>30*60_000) issues.push(`${intent.queueId}: recorded dispatch has no visible GitHub run. Inspect it before retrying.`);
            continue;
          }
          if(outcome==='receipt-needed') {issues.push(`${intent.queueId}: GitHub succeeded but the queue has no publication receipt. Inspect ${intent.githubRunUrl}.`);continue;}
          intent.error=`GitHub publication ${intent.githubRunId} ended with ${run?.conclusion || 'unknown'}.`;
          delete intent.dispatchHash;delete intent.submittedAt;delete intent.githubRunId;delete intent.githubRunUrl;
          await saveJson(file,intent);
        }
        if (intent.attempts >= 6) { issues.push(`${intent.queueId}: publication retries exhausted; ${intent.error}`); continue; }
        if (!publicationDue(intent)) continue;
        if (!row || !["completed", "published"].includes(row.status)) continue;
        // Reserve retry durably before subprocess: process loss also consumes a bounded attempt.
        intent.attempts++;
        intent.nextAttemptAt = new Date(Date.now() + Math.min(360, 15 * 2 ** (intent.attempts - 1)) * 60_000).toISOString();
        await saveJson(file, intent);
        try {
          const beforeDispatch=async(hash:string)=>{intent.dispatchHash=hash;intent.submittedAt=new Date().toISOString();await saveJson(file,intent);};
          const result = release ? await release(intent.queueId) : await dispatchArticle(intent.queueId,root,beforeDispatch);
          if(result?.dispatched && !intent.dispatchHash) await beforeDispatch(result.hash);
          if (!result?.dispatched) { intent.publishedAt = new Date().toISOString(); delete intent.nextAttemptAt; }
          delete intent.error;
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
  if (args[0] === "--acknowledge-published") {
    if (args[args.length - 1] !== "--apply") throw new Error("Exact publication acknowledgement requires --apply.");
    const ids: string[] = [];
    for (let index = 1; index < args.length - 1; index += 2) {
      if (args[index] !== "--queue-id" || !args[index + 1]) throw new Error("Usage: --acknowledge-published --queue-id UUID [--queue-id UUID]");
      ids.push(args[index + 1]);
    }
    await acknowledgePublishedIntents(process.cwd(), resolveArticleDevCredentials(), ids);
    return;
  }
  if (args.length !== 1 || args[0] !== "--apply") throw new Error("Usage: npm run articles:publication:drain -- --apply");
  await drainPublications(process.cwd(), resolveArticleDevCredentials());
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main().catch(error => { console.error(error.message); process.exitCode = 1; });

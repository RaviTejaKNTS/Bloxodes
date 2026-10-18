import "../shared/load-env";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { acquireAgentWorkLock } from "../shared/agent-work-lock";
import { artifactHashes, saveJson, type PipelineState } from "./article-pipeline";
import { assertUnpublishedIntent, type PublicationIntent } from "./article-publication-outbox";
import { exactQueueIds, ownerEvidence, parseOwnerArgs } from "./article-owner-actions";
import { resolveArticleDevCredentials } from "./article-queue-env";

export type OwnerApproval = ReturnType<typeof ownerEvidence> & {
  status: "pending" | "completed";
  previousArtifacts: Record<string, string>;
  previousReview: Record<string, unknown>;
  approvedArtifacts: Record<string, string>;
};

export async function approveOwnerArticleEdit(root: string, dev: { url: string; serviceRole: string }, id: string, expectedHash: string, operator: string, reason: string) {
  exactQueueIds([id]);
  const evidence = ownerEvidence(operator, reason);
  if (!/^[0-9a-f]{64}$/.test(expectedHash)) throw new Error("Approval requires --expected-final-hash SHA256.");
  const unlock = await acquireAgentWorkLock(path.join(root, "tmp/article-publication"), "publication-owner-approval");
  if (!unlock) throw new Error("Publication outbox is busy; retry after its owner finishes.");
  let unlockRun: (() => Promise<void>) | undefined;
  try {
    const db = createClient(dev.url, dev.serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: row, error } = await db.from("article_generation_queue").select("id,status,result_slug,result_path,production_url").eq("id", id).eq("workflow_mode", "agent_runner").maybeSingle();
    if (error) throw new Error(error.message);
    const intent = JSON.parse(await readFile(path.join(root, "tmp/article-publication", `${id}.json`), "utf8")) as PublicationIntent;
    assertUnpublishedIntent(intent, id, row ?? undefined);
    if (!row?.result_path || path.isAbsolute(row.result_path)) throw new Error("Owner approval requires a stored relative pipeline result_path.");
    const pipeline = await realpath(path.join(root, "tmp/article-pipeline"));
    const finalPath = await realpath(path.resolve(root, row.result_path));
    const content = path.dirname(finalPath), run = path.dirname(content);
    if (path.basename(finalPath) !== "final.json" || path.basename(content) !== "content" || path.dirname(run) !== pipeline) throw new Error("Owner approval requires an exact pipeline content/final.json.");
    for (const name of ["state.json", "editorial_review.json", "content/brief.md", "content/media.json"]) {
      if (await realpath(path.join(run, name)) !== path.join(run, name)) throw new Error("Owner approval files must stay inside their pipeline run.");
    }
    unlockRun = await acquireAgentWorkLock(run, "article-owner-approval") ?? undefined;
    if (!unlockRun) throw new Error("Article pipeline is busy; retry after its owner finishes.");
    const stateFile = path.join(run, "state.json"), reviewFile = path.join(run, "editorial_review.json");
    const state = JSON.parse(await readFile(stateFile, "utf8")) as PipelineState;
    const review = JSON.parse(await readFile(reviewFile, "utf8"));
    if (state.status !== "completed" || state.stage !== "done" || state.job.id !== id || state.job.slug !== row.result_slug || state.inFlight || state.controllerWrites || review.status !== "completed") throw new Error("Owner approval requires matching completed pipeline and editorial approval.");
    for (const stage of ["copy_check", "image_check", "import_verify", "browser_verify"] as const) {
      if (state.history.filter(entry => entry.stage === stage).slice(-1).pop()?.decision.status !== "completed") throw new Error(`Missing original ${stage} approval.`);
    }
    const hashes = await artifactHashes(content);
    for (const name of ["brief.md", "media.json"]) {
      if (!hashes[name] || hashes[name] !== state.artifacts[name] || hashes[name] !== review.input_hashes?.[name]) throw new Error(`Owner copy approval cannot change approved ${name}.`);
    }
    if (hashes["final.json"] !== expectedHash) throw new Error("Edited final does not match the expected SHA256.");
    const final = JSON.parse(await readFile(finalPath, "utf8"));
    if (final.slug !== state.job.slug || typeof final.title !== "string" || !final.title.trim() || typeof final.content_md !== "string" || !final.content_md.trim()) throw new Error("Edited final must retain its article identity and nonempty copy.");
    // Run the real gate on the new bytes. No model, import, dispatch or publication.
    execFileSync(process.execPath, ["--import", pathToFileURL(createRequire(import.meta.url).resolve("tsx")).href, path.join(root, "scripts/content/check-public-copy.ts"), finalPath], { cwd: root, stdio: "inherit", timeout: 60_000 });
    if (JSON.stringify(await artifactHashes(content)) !== JSON.stringify(hashes)) throw new Error("Article inputs changed during copy validation.");
    let approval = state.ownerApprovals?.slice(-1).pop();
    // Resume a crash after the completed approval was saved but before the outbox.
    if (approval?.status === "completed" && state.artifacts["final.json"] === expectedHash && approval.operator === evidence.operator && approval.reason === evidence.reason && JSON.stringify(approval.approvedArtifacts) === JSON.stringify(hashes)) {
      await makeEditedIntentDue(root, intent);
      return;
    }
    if (approval?.status === "pending") {
      if (JSON.stringify(approval.approvedArtifacts) !== JSON.stringify(hashes) || JSON.stringify(approval.previousArtifacts) !== JSON.stringify(state.artifacts) || approval.operator !== evidence.operator || approval.reason !== evidence.reason) throw new Error("Pending owner approval differs; restore its exact reviewed inputs and operator request.");
    } else {
      if (state.artifacts["final.json"] === expectedHash) throw new Error("Final already matches its recorded approval.");
      approval = { ...evidence, status: "pending", previousArtifacts: { ...state.artifacts }, previousReview: review, approvedArtifacts: hashes };
      state.ownerApprovals = [...(state.ownerApprovals ?? []), approval];
      // Persist the old evidence before replacing approval; pending records fail release.
      await saveJson(stateFile, state);
    }
    await saveJson(reviewFile, {
      status: "completed", summary: `Owner approved edited copy: ${approval.reason}`,
      findings: [], repair_stage: null, accepted_missing: [], input_hashes: hashes,
      owner_approval: { operator: approval.operator, at: approval.at, previous_final_hash: approval.previousArtifacts["final.json"] },
    });
    state.history.push({ stage: "editorial_review", attempt: state.attempts.editorial_review ?? 0, at: approval.at, decision: { status: "completed", summary: `Owner approval: ${approval.reason}`, findings: [], repair_stage: null, accepted_missing: [] } });
    state.history.push({ stage: "copy_check", attempt: state.attempts.copy_check ?? 0, at: approval.at, decision: { status: "completed", summary: "Owner edit passed content:check-copy; exact-content managed QA remains required.", findings: [], repair_stage: null, accepted_missing: [] } });
    state.artifacts = hashes;
    approval.status = "completed";
    await saveJson(stateFile, state);
    await makeEditedIntentDue(root, intent);
    console.log(`Recorded owner approval for ${id} at ${expectedHash}; publication budget unchanged.`);
  } finally { if (unlockRun) await unlockRun(); await unlock(); }
}

async function makeEditedIntentDue(root: string, intent: PublicationIntent) {
  // Keep exhausted budgets explicit; all other approved edits are due again.
  delete intent.copyBlocked;
  if (intent.attempts < 6) { delete intent.nextAttemptAt; delete intent.error; }
  await saveJson(path.join(root, "tmp/article-publication", `${intent.queueId}.json`), intent);
}

async function main() {
  const options = parseOwnerArgs(process.argv.slice(2), true);
  await approveOwnerArticleEdit(process.cwd(), resolveArticleDevCredentials(), options.ids[0], options.expectedHash, options.operator, options.reason);
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main().catch(error => { console.error(error.message); process.exitCode = 1; });

import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { acquireAgentWorkLock } from "../shared/agent-work-lock";
import { recoverFixedRuntimeBlocker } from "./article-runtime-recovery";

export const STAGES = ["research", "research_review", "images", "image_review", "image_upload", "writing", "editorial_review", "copy_check", "image_check", "import_verify", "browser_verify"] as const;
export type Stage = typeof STAGES[number];
export type WorkStage = "research" | "images" | "writing";
export type Decision = {
  status: "completed" | "needs_revision" | "blocked" | "skipped";
  summary: string;
  findings: string[];
  repair_stage: WorkStage | null;
  accepted_missing: string[];
  localizedCorrectionApplied?: boolean;
  delegatedToCi?: boolean;
};
export type ArticleJob = {
  id: string;
  title: string;
  slug: string;
  article_type: string;
  sources: unknown;
  refresh?: boolean;
};
export type PipelineState = {
  version: 1;
  job: ArticleJob;
  stage: Stage | "done";
  status: "running" | "blocked" | "skipped" | "completed";
  attempts: Partial<Record<Stage, number>>;
  revisions: Record<WorkStage, number>;
  failures: Partial<Record<Stage, number>>;
  technicalRepairs: Partial<Record<Stage, number>>;
  editorialCorrections?: number;
  operationalResumes?: Partial<Record<Stage, number>>;
  retryAfter?: string;
  blockerKind?: "provider" | "technical";
  feedback: string;
  origin?: { runDir: string; artifacts: Record<string, string>; reason: string };
  afterResearchReview?: Stage;
  afterImageUpload?: Stage;
  inFlight?: Stage;
  ownershipInput?: { hashes: Record<string, string>; media: string | null; identity: string | null };
  identityInput?: string | null;
  artifacts: Record<string, string>;
  history: { stage: Stage; attempt: number; at: string; decision: Decision }[];
};
export class StageFailure extends Error {
  constructor(message: string, readonly retryable = false, readonly repairStage: WorkStage | null = null, readonly kind: "provider" | "technical" = "technical") { super(message); }
}
export class StageInterrupted extends Error {}
export class ArtifactOwnershipFailure extends StageFailure {}
export const ARTIFACTS = ["brief.md", "media.json", "final.json"];
export const isModelStage = (stage: Stage) => ["research", "research_review", "images", "image_review", "writing", "editorial_review"].includes(stage);
export const isReviewStage = (stage: Stage) => stage.endsWith("_review");

export async function saveJson(file: string, value: unknown) {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, file);
}
export async function artifactHashes(workspace: string) {
  const result: Record<string, string> = {};
  for (const name of ARTIFACTS) {
    try { result[name] = createHash("sha256").update(await readFile(path.join(workspace, name))).digest("hex"); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  }
  return result;
}
async function optionalText(file: string) {
  try { return await readFile(file, "utf8"); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
}
function imageEvidence(text: string | null) {
  if (text === null) return null;
  const media = JSON.parse(text);
  return JSON.stringify({ ...media, entries: media.entries.map(({ placement_heading: _, ...entry }: any) => entry) });
}
export async function ownershipSnapshot(runDir: string) {
  return {
    hashes: await artifactHashes(path.join(runDir, "content")),
    media: await optionalText(path.join(runDir, "content/media.json")),
    identity: await optionalText(path.join(runDir, "game-identity.json")),
  };
}
export async function assertStageOwnership(runDir: string, stage: Stage, before: Awaited<ReturnType<typeof ownershipSnapshot>>, controllerOutput?: unknown) {
  const after = await ownershipSnapshot(runDir);
  const output = controllerOutput as Decision | undefined;
  const allowed = stage === "research" ? ["brief.md"] : ["images", "image_upload"].includes(stage) ? ["media.json"] : ["writing", "import_verify"].includes(stage) ? ["final.json", "media.json"] : [];
  // Successful adapters can apply reviewed omissions or a bounded local correction.
  // Failed/malformed adapter exits below always use the strict worker ownership rules.
  if (output?.status === "completed" && stage === "image_review") allowed.push("media.json");
  if (output?.localizedCorrectionApplied && stage === "editorial_review") allowed.push("final.json");
  if (ARTIFACTS.some(name => before.hashes[name] !== after.hashes[name] && !allowed.includes(name))) {
    throw new ArtifactOwnershipFailure(`${stage} modified an artifact outside its ownership; approval rejected.`);
  }
  if (before.identity !== after.identity) {
    let reviewedIdentity = false;
    if (output?.status === "completed" && stage === "research_review" && after.identity) {
      try { reviewedIdentity = Boolean(before.hashes["brief.md"]) && JSON.parse(after.identity).approved_brief_hash === before.hashes["brief.md"]; } catch { /* Reject malformed identity. */ }
    }
    if (!reviewedIdentity) throw new ArtifactOwnershipFailure(`${stage} changed the immutable code-owned game identity input; approval rejected.`);
  }
  if (stage === "writing" && before.media !== after.media) {
    try { if (imageEvidence(before.media) === imageEvidence(after.media)) return; }
    catch { /* Invalid image evidence cannot inherit approval. */ }
    throw new ArtifactOwnershipFailure("Writer changed approved image evidence or URLs; approval rejected.");
  }
}
export function parseDecision(value: unknown): Decision {
  const d = value as Decision;
  const errors: string[] = [];
  if (!d || typeof d !== "object" || Array.isArray(d)) throw new StageFailure("Invalid stage decision: expected a JSON object, not prose or an array.", true);
  if (!["completed", "needs_revision", "blocked", "skipped"].includes(d.status)) errors.push("status must be completed, needs_revision, blocked, or skipped");
  if (typeof d.summary !== "string" || !d.summary.trim()) errors.push("summary must be a nonempty string");
  if (!Array.isArray(d.findings) || d.findings.some(x => typeof x !== "string")) errors.push("findings must be an array of strings");
  if (![null, "research", "images", "writing"].includes(d.repair_stage)) errors.push("repair_stage must be research, images, writing, or null");
  if (!Array.isArray(d.accepted_missing) || d.accepted_missing.some(x => typeof x !== "string")) errors.push("accepted_missing must be an array of exact media.json id strings");
  if (errors.length) throw new StageFailure(`Invalid stage decision: ${errors.join("; ")}. Return the complete schema object.`, true);
  if (d.status === "needs_revision" && (!d.repair_stage || !d.findings.length)) throw new StageFailure("Revision requires a target stage and concrete findings.");
  if (d.status === "completed" && (d.repair_stage !== null || d.findings.length)) throw new StageFailure("A completed stage cannot retain unresolved findings or request repair.");
  return d;
}
const allowedRepairs: Partial<Record<Stage, WorkStage[]>> = {
  research: ["research"], research_review: ["research"], images: ["research", "images"], image_review: ["research", "images"],
  writing: ["research", "images", "writing"], editorial_review: ["research", "images", "writing"], copy_check: ["writing"], image_check: ["images", "writing"]
};

export function applyDecision(state: PipelineState, decision: Decision, maxRevisions: number) {
  const stage = state.stage as Stage;
  state.feedback = [...new Set([decision.summary, ...decision.findings])].join("\n");
  if (decision.status === "blocked" || decision.status === "skipped") { state.status = decision.status; return; }
  if (decision.localizedCorrectionApplied && stage === "editorial_review" && decision.status === "needs_revision") {
    if ((state.editorialCorrections ?? 0) >= 1) throw new StageFailure("Localized editorial correction exhausted.");
    state.editorialCorrections = (state.editorialCorrections ?? 0) + 1;
    state.stage = "editorial_review";
    return; // Changed copy must receive a fresh independent review before QA.
  }
  if (decision.status === "needs_revision") {
    const target = decision.repair_stage!;
    if (!allowedRepairs[stage]?.includes(target)) throw new StageFailure(`${stage} cannot route a repair to ${target}.`);
    const technical = stage === "copy_check" || stage === "image_check";
    const used = technical ? (state.technicalRepairs[stage] ?? 0) : state.revisions[target];
    if (used >= maxRevisions) { state.status = "blocked"; state.feedback = `${technical ? "Technical correction" : "Review"} budget exhausted for ${target}. ${state.feedback}`; return; }
    if (technical) state.technicalRepairs[stage] = used + 1;
    else state.revisions[target]++;
    // Repair the evidence in place, then continue the affected task. Approved images need
    // not be rediscovered for a prose correction; a reviewer can request image repair explicitly.
    if (target === "research" && STAGES.indexOf(stage) >= STAGES.indexOf("writing")) state.afterResearchReview = "writing";
    else if (target === "research" && ["images", "image_review"].includes(stage)) state.afterResearchReview = "images";
    if (target === "images" && STAGES.indexOf(stage) >= STAGES.indexOf("writing")) state.afterImageUpload = "writing";
    state.stage = target;
    return;
  }
  state.failures[stage] = 0;
  if (stage === "research_review" && state.afterResearchReview) { state.stage = state.afterResearchReview; delete state.afterResearchReview; }
  else if (stage === "image_upload" && state.afterImageUpload) { state.stage = state.afterImageUpload; delete state.afterImageUpload; }
  else state.stage = STAGES.indexOf(stage) + 1 < STAGES.length ? STAGES[STAGES.indexOf(stage) + 1] : "done";
  if (state.stage === "done") state.status = "completed";
}

export type PipelineOptions = {
  job: ArticleJob;
  runDir: string;
  maxRevisions?: number;
  maxStageFailures?: number;
  retryTechnical?: boolean;
  reviseFrom?: string;
  reviewFirst?: boolean;
  revisionFeedback?: string;
  deadline: number;
  execute: (stage: Stage, state: PipelineState, attemptDir: string) => Promise<Decision>;
};
export async function runArticlePipeline(options: PipelineOptions): Promise<PipelineState> {
  const { runDir, job } = options;
  const workspace = path.join(runDir, "content");
  const stateFile = path.join(runDir, "state.json");
  await mkdir(workspace, { recursive: true });
  const unlock = await acquireAgentWorkLock(runDir, "article-stage-pipeline");
  if (!unlock) throw new Error(`Article run already active: ${runDir}`);
  try {
    let state: PipelineState;
    try { state = JSON.parse(await readFile(stateFile, "utf8")); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      state = { version: 1, job, stage: "research", status: "running", attempts: {}, revisions: { research: 0, images: 0, writing: 0 }, failures: {}, technicalRepairs: {}, feedback: "", artifacts: {}, history: [] };
      if (options.reviseFrom) {
        const source = path.resolve(options.reviseFrom);
        if (source === path.resolve(runDir)) throw new Error("A revision must use a new run directory.");
        const prior: PipelineState = JSON.parse(await readFile(path.join(source, "state.json"), "utf8"));
        const sourceHashes = await artifactHashes(path.join(source, "content"));
        if (prior.status !== "completed" || JSON.stringify(prior.job) !== JSON.stringify(job) ||
            JSON.stringify(sourceHashes) !== JSON.stringify(prior.artifacts) || ARTIFACTS.some(name => !sourceHashes[name]) ||
            !prior.history.some(h => h.stage === "editorial_review" && h.decision.status === "completed") ||
            (!prior.origin && !["research_review", "image_review"].every(s => prior.history.some(h => h.stage === s && h.decision.status === "completed")))) {
          throw new Error("Revision source must be a completed, unchanged run for the same job with approved evidence.");
        }
        if (Object.keys(await artifactHashes(workspace)).length) throw new Error("Revision destination must be empty; existing artifacts cannot inherit approval.");
        for (const name of ARTIFACTS) await copyFile(path.join(source, "content", name), path.join(workspace, name));
        state.artifacts = await artifactHashes(workspace);
        if (JSON.stringify(state.artifacts) !== JSON.stringify(sourceHashes)) throw new Error("Revision source changed while copying; no approval inherited.");
        const sourceIdentity = await optionalText(path.join(source, "game-identity.json"));
        if (sourceIdentity && sourceIdentity === prior.identityInput && JSON.parse(sourceIdentity).approved_brief_hash === sourceHashes["brief.md"]) {
          await writeFile(path.join(runDir, "game-identity.json"), sourceIdentity, { mode: 0o600 });
          if (sourceIdentity !== await optionalText(path.join(source, "game-identity.json"))) throw new Error("Revision identity changed while copying; no approval inherited.");
          state.identityInput = sourceIdentity;
        }
        state.stage = options.reviewFirst ? "editorial_review" : "writing";
        state.feedback = options.revisionFeedback || "User-authorized editorial refinement. Review the retained draft against the current writing contract and improve substantive defects while preserving approved facts and media.";
        state.origin = { runDir: source, artifacts: sourceHashes, reason: state.feedback };
      }
    }
    if (state.version !== 1 || JSON.stringify(state.job) !== JSON.stringify(job)) throw new Error("Run input changed; use a new run directory rather than reusing old approval.");
    state.technicalRepairs ??= {};
    const hashes = await artifactHashes(workspace);
    const interrupted = state.status === "running" && Boolean(state.inFlight);
    if (!interrupted && state.identityInput !== undefined && state.identityInput !== await optionalText(path.join(runDir, "game-identity.json"))) throw new Error("Game identity changed outside the recorded stage; cached approvals cannot be reused.");
    if (JSON.stringify(hashes) !== JSON.stringify(state.artifacts) && !interrupted && Object.keys(state.artifacts).length) {
      throw new Error("Artifacts changed outside the recorded stage. Start a new reviewed run; cached approvals cannot be reused.");
    }
    if (options.retryTechnical && state.status === "blocked" && !state.retryAfter) {
      await recoverFixedRuntimeBlocker(state, runDir, hashes);
    }
    if (state.status === "blocked" && state.retryAfter && (Date.now() >= Date.parse(state.retryAfter) || (options.retryTechnical && state.blockerKind === "technical"))) {
      const stage = state.stage as Stage;
      state.operationalResumes ??= {};
      const used = state.operationalResumes[stage] ?? 0;
      delete state.retryAfter;
      if (used >= 2) {
        state.feedback = `Operational recovery budget exhausted for ${stage}. ${state.feedback}`;
        await saveJson(stateFile, state);
        return state;
      }
      state.operationalResumes[stage] = used + 1;
      state.status = "running";
      state.failures[stage] = 0;
      delete state.blockerKind;
    }
    if (state.status !== "running") return state; // Evidence/review blockers and pending backoff never reset.
    if (interrupted) {
      const stage = state.inFlight!;
      const savedInput = state.ownershipInput;
      if (savedInput) await assertStageOwnership(runDir, stage, savedInput);
      else {
        // Older interrupted runs have no image/identity snapshot. Do not inherit approval.
        if (JSON.stringify(hashes) !== JSON.stringify(state.artifacts)) throw new Error("Interrupted legacy stage changed inputs; start a new reviewed run.");
      }
      state.failures[stage] = (state.failures[stage] ?? 0) + 1;
      if (state.failures[stage]! >= (options.maxStageFailures ?? 2)) { state.status = "blocked"; state.feedback = `Repeated interrupted ${stage} executions; retained artifacts require attention.`; await saveJson(stateFile, state); return state; }
      state.artifacts = hashes;
      state.identityInput = await optionalText(path.join(runDir, "game-identity.json"));
      state.feedback = `Resume the interrupted ${stage} from its saved artifacts.\n${state.feedback}`;
      delete state.inFlight;
    }
    while (state.stage !== "done") {
      if (Date.now() >= options.deadline) { state.status = "blocked"; state.feedback = "Outer article deadline reached; saved work retained."; state.blockerKind = "technical"; if ((state.operationalResumes?.[state.stage as Stage] ?? 0) < 2) state.retryAfter = new Date(Date.now() + 180 * 60_000).toISOString(); break; }
      const stage = state.stage;
      const attempt = (state.attempts[stage] ?? 0) + 1;
      state.attempts[stage] = attempt;
      state.inFlight = stage;
      state.ownershipInput = await ownershipSnapshot(runDir);
      state.identityInput ??= state.ownershipInput.identity;
      const attemptDir = path.join(runDir, "attempts", `${stage}-${attempt}`);
      await mkdir(attemptDir, { recursive: true });
      // Persist before launch: a crash cannot silently grant another editorial revision.
      await saveJson(stateFile, state);
      console.log(`[article ${job.id}] ${stage} attempt ${attempt}`);
      let decision: Decision;
      let ownershipRejected = false;
      try {
        const output = await options.execute(stage, state, attemptDir);
        await assertStageOwnership(runDir, stage, state.ownershipInput, output);
        decision = parseDecision(output);
      }
      catch (error) {
        // Execution adapters may fail before parsing, including provider fallback and shutdown.
        try { await assertStageOwnership(runDir, stage, state.ownershipInput); }
        catch (ownershipError) { error = ownershipError; }
        ownershipRejected = error instanceof ArtifactOwnershipFailure;
        if (error instanceof StageInterrupted) {
          state.feedback = error.message;
          await saveJson(stateFile, state); // Keep inFlight so a later run resumes this exact stage.
          throw error;
        }
        const failure = error instanceof StageFailure ? error : new StageFailure(String(error));
        state.failures[stage] = (state.failures[stage] ?? 0) + 1;
        delete state.inFlight;
        if (!ownershipRejected) {
          state.artifacts = await artifactHashes(workspace);
          state.identityInput = await optionalText(path.join(runDir, "game-identity.json"));
        }
        if (failure.retryable && state.failures[stage]! < (options.maxStageFailures ?? 2)) {
          state.feedback = failure.message;
          await saveJson(path.join(attemptDir, "failure.json"), { message: failure.message, retryable: true });
          await saveJson(stateFile, state);
          continue;
        }
        if (failure.retryable && !failure.repairStage) {
          state.blockerKind = failure.kind;
          if ((state.operationalResumes?.[stage] ?? 0) < 2) state.retryAfter = new Date(Date.now() + 180 * 60_000).toISOString();
        }
        decision = { status: failure.repairStage ? "needs_revision" : "blocked", summary: failure.message, findings: [failure.message], repair_stage: failure.repairStage, accepted_missing: [] };
      }
      await saveJson(path.join(attemptDir, "decision.json"), decision);
      delete state.inFlight;
      state.history.push({ stage, attempt, at: new Date().toISOString(), decision });
      if (!ownershipRejected) {
        state.artifacts = await artifactHashes(workspace);
        state.identityInput = await optionalText(path.join(runDir, "game-identity.json"));
      }
      delete state.ownershipInput;
      try { applyDecision(state, decision, options.maxRevisions ?? 1); }
      catch (error) { state.status = "blocked"; state.feedback = error instanceof Error ? error.message : String(error); }
      await saveJson(stateFile, state);
      if (state.status !== "running") break;
    }
    await saveJson(stateFile, state);
    return state;
  } finally { await unlock(); }
}

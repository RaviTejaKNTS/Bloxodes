import { readFile } from "node:fs/promises";
import path from "node:path";
import { isReviewStage, type PipelineState, type Stage } from "./article-pipeline";

export async function recoverFixedRuntimeBlocker(state: PipelineState, runDir: string, hashes: Record<string, string>) {
  if (state.status !== "blocked") return false;
  const stage = state.stage as Stage;
  const readOnlyReview = isReviewStage(stage) && /read.only/i.test(state.feedback)
    && /(?:sav|writ).*artifact|artifact.*(?:sav|writ)/i.test(state.feedback);
  const copyConflict = /\/sources\//i.test(state.feedback)
    && state.history.some(entry => entry.stage === "copy_check" && entry.decision.status !== "completed");
  if (!readOnlyReview && !copyConflict) return false;
  let nextStage = stage;
  if (copyConflict) {
    const review = JSON.parse(await readFile(path.join(runDir, "editorial_review.json"), "utf8"));
    if (review.status !== "completed" || !review.input_hashes) return false;
    if (["brief.md", "media.json"].some(file => !hashes[file] || hashes[file] !== review.input_hashes[file])) return false;
    nextStage = hashes["final.json"] === review.input_hashes["final.json"] ? "copy_check" : "editorial_review";
  }
  state.operationalResumes ??= {};
  const used = state.operationalResumes[nextStage] ?? 0;
  if (used >= 2) return false;
  state.operationalResumes[nextStage] = used + 1;
  state.status = "running"; state.stage = nextStage;
  state.feedback = `Retry after a repaired runtime blocker. Resume ${nextStage}; retain all editorial and technical repair budgets.`;
  delete state.retryAfter; delete state.blockerKind;
  return true;
}

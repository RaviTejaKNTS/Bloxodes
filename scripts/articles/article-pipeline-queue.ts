import { createClient } from "@supabase/supabase-js";
import path from "node:path";
import { runConfiguredArticle } from "./run-article-pipeline";
import type { StageRuntimeOptions } from "./article-stage-runtime";
import type { ArticleJob } from "./article-pipeline";

export function queueArticleJob(row: Record<string, any>): ArticleJob {
  const slug = row.result_slug || String(row.article_title).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return { id: row.id, title: row.article_title, slug, article_type: row.article_type || "guide",
    sources: { source_url: row.source_url, source_urls: row.source_urls ?? [], source_items: row.source_items ?? [], curation_reason: row.curation_reason ?? null } };
}
export async function processArticleQueueRow(dev: { url: string; serviceRole: string }, id: string, runtime: StageRuntimeOptions, run = runConfiguredArticle) {
  const db = createClient(dev.url, dev.serviceRole, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: row, error } = await db.from("article_generation_queue").select("id,article_title,article_type,result_slug,source_url,source_urls,source_items,curation_reason,attempts")
    .eq("id", id).eq("workflow_mode", "agent_runner").eq("status", "pending").not("curated_at", "is", null).maybeSingle();
  if (error) throw new Error(`Queue read failed: ${error.message}`);
  if (!row) return;
  const token = new Date().toISOString();
  const worker = "code-homelab";
  const { data: claimed, error: claimError } = await db.from("article_generation_queue").update({ status: "processing", locked_at: token, locked_by: worker,
    last_attempted_at: token, attempts: Number(row.attempts ?? 0) + 1, last_error: null, outcome_reason: null, next_attempt_at: null })
    .eq("id", id).eq("status", "pending").eq("attempts", row.attempts ?? 0).select("id").maybeSingle();
  if (claimError) throw new Error(`Queue claim failed: ${claimError.message}`);
  if (!claimed) return;
  try {
    const result = await run(queueArticleJob(row), runtime);
    const completed = result.status === "completed";
    const skipped = result.status === "skipped";
    const patch = {
      status: completed ? "completed" : skipped ? "skipped" : "blocked",
      locked_at: null, locked_by: null, next_attempt_at: result.retryAfter ?? null,
      completed_at: completed || skipped ? new Date().toISOString() : null,
      result_path: completed ? path.relative(runtime.worktree, path.join(runtime.runDir, "content/final.json")) : null,
      result_slug: result.job.slug,
      last_error: completed || skipped ? null : result.feedback.slice(0, 2000),
      outcome_reason: result.feedback.slice(0, 2000)
    };
    const { data, error: updateError } = await db.from("article_generation_queue").update(patch).eq("id", id).eq("status", "processing").eq("locked_by", worker).eq("locked_at", token).select("id").maybeSingle();
    if (updateError || !data) throw new Error(`Queue completion lost its claim: ${updateError?.message ?? id}`);
    console.log(`[article ${id}] ${patch.status}: ${result.feedback}`);
    return result;
  } catch (failure) {
    const message = failure instanceof Error ? failure.message : String(failure);
    const { error: cleanupError } = await db.from("article_generation_queue").update({ status: "blocked", locked_at: null, locked_by: null,
      next_attempt_at: new Date(Date.now() + 180 * 60_000).toISOString(), last_error: message.slice(0, 2000), outcome_reason: message.slice(0, 2000) })
      .eq("id", id).eq("status", "processing").eq("locked_by", worker).eq("locked_at", token);
    if (cleanupError) throw new Error(`${message}; queue cleanup failed: ${cleanupError.message}`);
    throw failure;
  }
}

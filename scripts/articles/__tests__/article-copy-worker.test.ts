import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { artifactHashes, runArticlePipeline, saveJson, type Decision, type PipelineState } from "../article-pipeline";
import { executeArticleStage, type StageRuntimeOptions } from "../article-stage-runtime";

const pass: Decision = { status: "completed", summary: "Passed.", findings: [], repair_stage: null, accepted_missing: [] };
for (const repair of [true, false]) test(`CI-QA worker runs the real copy gate and ${repair ? "repairs through writing" : "blocks after its existing correction budget"}`, async t => {
  const runDir = await mkdtemp(path.join(os.tmpdir(), "article-copy-worker-"));
  t.after(() => rm(runDir, { recursive: true, force: true }));
  const job = { id: "copy-worker", slug: "copy-worker", title: "Copy worker", article_type: "guide", sources: [] };
  const content = path.join(runDir, "content");
  const writeCopy = (content_md: string) => saveJson(path.join(content, "final.json"), { title: job.title, slug: job.slug, content_md });
  await saveJson(path.join(content, "brief.md"), "Approved evidence.");
  await saveJson(path.join(content, "media.json"), { entries: [] });
  await writeCopy("Get fully clear, not just to the edge.");
  const state: PipelineState = { version: 1, job, stage: "copy_check", status: "running", attempts: {}, revisions: { research: 0, images: 0, writing: 1 }, failures: {}, technicalRepairs: {}, feedback: "", artifacts: await artifactHashes(content), history: [] };
  await saveJson(path.join(runDir, "state.json"), state);
  const runtime: StageRuntimeOptions = { worktree: process.cwd(), runDir, codexBin: "unused", model: "unused", reasoning: "max", grokFallback: false, grokBin: "unused", grokModel: "unused", deadline: Date.now() + 60_000, stageTimeoutMs: 30_000, baseUrl: "http://localhost:3100", env: { PATH: process.env.PATH, HOME: os.homedir(), SUPABASE_URL: "https://test.supabase.co", BLOXODES_CI_QA: "1" } };
  let writing = 0, reviews = 0;
  const result = await runArticlePipeline({ job, runDir, deadline: runtime.deadline, execute: async (stage, current, attempt) => {
    if (stage === "copy_check") return executeArticleStage(runtime, stage, current, attempt);
    if (stage === "writing") {
      writing++;
      assert.match(current.feedback, /AI-ish contrast filler.*\n.*not just/);
      if (repair) await writeCopy("Get fully clear.");
    }
    if (stage === "editorial_review") reviews++;
    return pass;
  } });
  assert.equal(writing, 1); assert.equal(reviews, 1);
  assert.equal(result.technicalRepairs.copy_check, 1); assert.equal(result.revisions.writing, 1);
  assert.equal(result.status, repair ? "completed" : "blocked");
  if (repair) assert.equal(result.history.filter(entry => entry.stage === "copy_check").slice(-1)[0].decision.delegatedToCi, undefined);
  else assert.match(result.feedback, /budget exhausted.*writing/s);
});

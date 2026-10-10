import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { executeArticleStage, stagePrompt, stageDecisionSchema, type StageRuntimeOptions } from "../article-stage-runtime";
import { parseDecision, saveJson, type PipelineState } from "../article-pipeline";
import { writeArticleRunReport } from "../article-run-report";

const pass = { status: "completed", summary: "Reviewed the evidence and accepted the omissions.", findings: [], repair_stage: null, accepted_missing: [] };
const job = { id: "routing-test", slug: "routing-test", title: "Routing guide", article_type: "guide", sources: [] };
async function fixture() {
  const runDir = await mkdtemp(path.join(os.tmpdir(), "article-routing-"));
  await mkdir(path.join(runDir, "content")); await mkdir(path.join(runDir, "attempt"));
  await writeFile(path.join(runDir, "content/brief.md"), "Approved research.");
  const runtime: StageRuntimeOptions = { worktree: process.cwd(), runDir, deadline: Date.now() + 30_000, stageTimeoutMs: 5000,
    codexBin: path.join(runDir, "codex.cjs"), claudeBin: path.join(runDir, "claude.cjs"), model: "gpt-5.6-luna", reasoning: "max", grokFallback: false, grokBin: "grok", grokModel: "grok-4.5",
    env: { HOME: os.homedir(), PATH: process.env.PATH, SUPABASE_URL: "https://test.supabase.co", SUPABASE_SERVICE_ROLE: "secret-placeholder" }, baseUrl: "http://localhost:3100" };
  const state = { job, feedback: "", history: [], revisions: { writing: 0, images: 0, research: 0 } } as unknown as PipelineState;
  return { runDir, runtime, state, attempt: path.join(runDir, "attempt") };
}
async function fake(bin: string, body: string) { await writeFile(bin, `#!/usr/bin/env node\n${body}\n`, { mode: 0o700 }); }

test("Claude returns a structured review without a decision-file write and records usage", async () => {
  const f = await fixture();
  await fake(f.runtime.claudeBin!, `if(process.env.SUPABASE_SERVICE_ROLE)process.exit(9);console.error('diagnostic');console.log(JSON.stringify({structured_output:${JSON.stringify(pass)},usage:{input_tokens:7,output_tokens:3},modelUsage:{'claude-haiku-5-5':{inputTokens:7}}}));`);
  const decision = await executeArticleStage(f.runtime, "research_review", f.state, f.attempt);
  assert.equal(decision.status, "completed");
  assert.equal(f.runtime.modelAttempts?.[0].provider, "claude");
  assert.equal(f.runtime.modelAttempts?.[0].usage?.input_tokens, 7);
  const review = JSON.parse(await readFile(path.join(f.runDir, "research_review.json"), "utf8"));
  assert.equal(review.status, "completed"); assert.ok(review.input_hashes["brief.md"]);
});

test("Claude provider/auth/model/quota errors and a missing binary fall back to gpt-6-luna", async () => {
  for (const failure of ["401 unauthorized", "429 rate limit", "unknown model", "503 service unavailable", null]) {
    const f = await fixture();
    if (failure) await fake(f.runtime.claudeBin!, `console.log(JSON.stringify({is_error:true,errors:[${JSON.stringify(failure)}]}));process.exitCode=1;`);
    await fake(f.runtime.codexBin, `const fs=require('fs'),a=process.argv;if(a[a.indexOf('--model')+1]!=='gpt-6-luna')process.exit(9);fs.writeFileSync(a[a.indexOf('--output-last-message')+1],${JSON.stringify(JSON.stringify(pass))});`);
    assert.equal((await executeArticleStage(f.runtime, "research_review", f.state, f.attempt)).status, "completed");
    assert.deepEqual(f.runtime.modelAttempts?.map(attempt => attempt.provider), ["claude", "codex"]);
    assert.ok(f.runtime.modelAttempts?.[1].fallback_reason);
    assert.equal(JSON.parse(await readFile(path.join(f.attempt, "fallback.json"), "utf8")).to.model, "gpt-6-luna");
  }
});

test("Claude tool/content errors do not trigger provider fallback; reviewer ownership remains enforced", async () => {
  const f = await fixture();
  await fake(f.runtime.claudeBin!, "console.log(JSON.stringify({is_error:true,errors:['Invalid manuscript']}));process.exitCode=1;");
  await assert.rejects(executeArticleStage(f.runtime, "research_review", f.state, f.attempt), /Claude research_review failed/);
  assert.equal(f.runtime.modelAttempts?.length, 1);
  await fake(f.runtime.claudeBin!, `require('fs').writeFileSync('brief.md','modified');console.log(JSON.stringify({structured_output:${JSON.stringify(pass)}}));`);
  await assert.rejects(executeArticleStage(f.runtime, "research_review", f.state, f.attempt), /outside its ownership/);
});

test("image review accepts an image-free plan and may omit a rejected verified candidate by exact id", async () => {
  for (const status of ["missing", "verified"]) {
    const f = await fixture();
    await saveJson(path.join(f.runDir, "content/media.json"), { required: true, article_slug: job.slug, expected_count: 1, entries: [{ id: "exact-target", status,
      search_queries: ["game exact target", "game target screenshot"], searched_source_urls: ["https://wiki.example/target", "https://guide.example/target"], missing_reason: "No suitable clean screenshot." }] });
    await fake(f.runtime.claudeBin!, `console.log(JSON.stringify({structured_output:${JSON.stringify({ ...pass, accepted_missing: ["exact-target"] })}}));`);
    const decision = await executeArticleStage(f.runtime, "image_review", f.state, f.attempt);
    assert.equal(decision.status, "completed");
    const media = JSON.parse(await readFile(path.join(f.runDir, "content/media.json"), "utf8"));
    assert.equal(media.entries[0].status, "accepted_missing");
    await fake(f.runtime.claudeBin!, `console.log(JSON.stringify({structured_output:${JSON.stringify({ ...pass, accepted_missing: ["invented-id"] })}}));`);
    await assert.rejects(executeArticleStage(f.runtime, "image_review", f.state, f.attempt), /unknown=.*invented-id.*exact-target/);
  }
});

test("review prompts require JSON-only decisions and image schema cannot request writing repairs", () => {
  const runtime = { worktree: "/repo", runDir: "/run" } as StageRuntimeOptions;
  const state = { job, feedback: "" } as PipelineState;
  assert.match(stagePrompt(runtime, "research_review", state), /must never create decision.json/);
  assert.match(stagePrompt(runtime, "image_review", state), /exact media.json entry ids/);
  assert.match(stagePrompt(runtime, "images", state), /never block article writing/);
  assert.ok(!stageDecisionSchema("images").properties.repair_stage.enum.includes("writing"));
  assert.throws(() => parseDecision({ status: "completed" }), /summary.*findings.*repair_stage.*accepted_missing/);
});

test("timing reports retain actual provider/model, fallback history and usage from both providers", async () => {
  const f = await fixture();
  await saveJson(path.join(f.runDir, "state.json"), { job, status: "completed", stage: "done", feedback: "" });
  const dir = path.join(f.runDir, "attempts/research_review-1");
  await saveJson(path.join(dir, "timing.json"), { stage: "research_review", provider: "codex", model: "gpt-6-luna", effort: "max", elapsed_ms: 2000,
    started_at: "2026-10-10T00:00:00Z", finished_at: "2026-10-10T00:00:02Z", model_attempts: [
      { provider: "claude", model: "claude-haiku-5-5", effort: "xhigh", usage: { input_tokens: 5 } },
      { provider: "codex", model: "gpt-6-luna", effort: "max", fallback_reason: "quota_or_rate_limit" }] });
  await writeFile(path.join(dir, "codex-events.jsonl"), '{"type":"turn.completed","usage":{"input_tokens":7,"output_tokens":3}}\n');
  await saveJson(path.join(f.runDir, "attempts/writing-1/timing.json"), { stage: "writing", provider: "claude", model: "claude-haiku-5-5", effort: "xhigh", elapsed_ms: 1000,
    started_at: "2026-10-10T00:00:03Z", finished_at: "2026-10-10T00:00:04Z", model_attempts: [{ provider: "claude", model: "claude-haiku-5-5", effort: "xhigh", usage: { input_tokens: 9 } }] });
  await writeArticleRunReport(f.runDir, "gpt-5.6-luna", "max");
  const report = JSON.parse(await readFile(path.join(f.runDir, "run-report.json"), "utf8"));
  assert.equal(report.attempts[0].provider, "codex"); assert.equal(report.attempts[0].model, "gpt-6-luna");
  assert.equal(report.attempts[0].usage.input_tokens, 12); assert.ok(report.attempts[0].model_attempts[1].fallback_reason);
  assert.equal(report.attempts[1].usage.input_tokens, 9); assert.equal(report.attempts[1].provider, "claude");
});

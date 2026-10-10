import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { executeArticleStage, stagePrompt, stageDecisionSchema, type StageRuntimeOptions } from "../article-stage-runtime";
import { parseDecision, saveJson, runArticlePipeline, artifactHashes, type Decision, type PipelineState } from "../article-pipeline";
import { writeArticleRunReport } from "../article-run-report";

const pass: Decision = { status: "completed", summary: "Reviewed the evidence and accepted the omissions.", findings: [], repair_stage: null, accepted_missing: [] };
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
async function fake(bin: string, body: string) {
  const stdout = "console.log=(...values)=>require('fs').writeSync(1,values.join(' ')+'\\n');";
  await writeFile(bin, `#!/usr/bin/env node\n${stdout}\n${body}\n`, { mode: 0o700 });
}

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
test("ownership violations beat malformed responses, provider fallback and command timeout", async () => {
  for (const provider of ["claude", "codex"] as const) {
    for (const exit of ["malformed", "provider", "timeout"] as const) {
      const f = await fixture();
      f.runtime.stageConfigs = { research_review: { provider, model: provider === "claude" ? "claude-haiku-5-5" : "gpt-6-luna", effort: provider === "claude" ? "xhigh" : "max" } };
      f.runtime.stageTimeoutMs = exit === "timeout" ? 800 : 5000;
      const bin = provider === "claude" ? f.runtime.claudeBin! : f.runtime.codexBin;
      const result = exit === "timeout" ? "setInterval(()=>{},1000);" : exit === "provider" ? (provider === "claude" ? "console.log(JSON.stringify({is_error:true,errors:['429 rate limit']}));process.exitCode=1;" : "console.log(JSON.stringify({type:'error',message:'429 rate limit'}));process.exitCode=1;") : provider === "claude" ? "console.log('not JSON');" : "const a=process.argv;require('fs').writeFileSync(a[a.indexOf('--output-last-message')+1],'not JSON');";
      await fake(bin, `require('fs').writeFileSync('brief.md','tampered');${result}`);
      await assert.rejects(executeArticleStage(f.runtime, "research_review", f.state, f.attempt), /outside its ownership/);
      assert.equal(f.runtime.modelAttempts?.length, 1, "no fallback may adopt tampered inputs");
      await assert.rejects(readFile(path.join(f.runDir, "research_review.json")), { code: "ENOENT" });
    }
  }
});
test("writing evidence changes are rejected before malformed Claude responses can retry", async () => {
  const f = await fixture();
  await saveJson(path.join(f.runDir, "content/media.json"), { entries: [{ id: "target", status: "verified", public_url: "https://media.example/approved" }] });
  await fake(f.runtime.claudeBin!, "require('fs').writeFileSync('media.json',JSON.stringify({entries:[]}));console.log('invalid decision');");
  await assert.rejects(executeArticleStage(f.runtime, "writing", f.state, f.attempt), /Writer changed approved image evidence/);
});
test("research repairs refresh identity after review even when the pipeline skips images", async () => {
  const f = await fixture(); let research = 0, writing = 0, reviews = 0;
  await fake(f.runtime.claudeBin!, `console.log(JSON.stringify({structured_output:${JSON.stringify(pass)}}));`);
  const original = globalThis.fetch;
  globalThis.fetch = async input => {
    const id = new URL(new Request(input).url).searchParams.get("universe_id")?.replace("eq.", "");
    assert.ok(id === "1234" || id === "5678");
    return new Response(JSON.stringify({ universe_id: Number(id) }), { headers: { "Content-Type": "application/json" } });
  };
  try {
    const state = await runArticlePipeline({ job, runDir: f.runDir, deadline: f.runtime.deadline, execute: async (stage, state, attempt) => {
      if (stage === "research") await writeFile(path.join(f.runDir, "content/brief.md"), `Research status: ready_for_review\nuniverse_id: ${++research === 1 ? 1234 : 5678}`);
      if (stage === "research_review") return executeArticleStage(f.runtime, stage, state, attempt);
      if (stage === "writing") {
        const identity = JSON.parse(await readFile(path.join(f.runDir, "game-identity.json"), "utf8"));
        assert.equal(identity.universe_id, ++writing === 1 ? 1234 : 5678);
        assert.equal(identity.approved_brief_hash, (await artifactHashes(path.join(f.runDir, "content")))["brief.md"]);
      }
      if (stage === "editorial_review" && ++reviews === 1) return { ...pass, status: "needs_revision" as const, findings: ["Repair the game identity."], repair_stage: "research" as const };
      return pass;
    } });
    assert.equal(state.status, "completed"); assert.equal(writing, 2); assert.equal(state.attempts.images, 1);
  } finally { globalThis.fetch = original; }
});
test("writing cannot reuse an identity resolved for an older brief", async () => {
  const f = await fixture();
  await saveJson(path.join(f.runDir, "game-identity.json"), { universe_id: null, approved_brief_hash: "old-brief" });
  const final = { slug: job.slug, title: job.title, content_md: "The route starts here.", universe_id: null };
  await fake(f.runtime.claudeBin!, `require('fs').writeFileSync('final.json',${JSON.stringify(JSON.stringify(final))});console.log(JSON.stringify({structured_output:${JSON.stringify(pass)}}));`);
  await assert.rejects(executeArticleStage(f.runtime, "writing", f.state, f.attempt), /not bound to the approved brief/);
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

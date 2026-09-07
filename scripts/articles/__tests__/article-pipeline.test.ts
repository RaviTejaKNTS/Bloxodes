import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runArticlePipeline, STAGES, StageFailure, StageInterrupted, parseDecision, type Decision, type Stage, type PipelineState } from "../article-pipeline";
import { articleStageEnvironment, stageCodexArgs, stagePrompt, workerEnvironment, runStageCommand, executeArticleStage, type StageRuntimeOptions } from "../article-stage-runtime";
import { validateJob } from "../run-article-pipeline";

const job = { id: "test-job", title: "How to Get Test Item", slug: "test-item", article_type: "guide", sources: [] };
const pass = (): Decision => ({ status: "completed", summary: "Evidence and artifact checked.", findings: [], repair_stage: null, accepted_missing: [] });
const revision = (target: "research" | "images" | "writing"): Decision => ({ status: "needs_revision", summary: "Missing essential guidance.", findings: ["The prerequisite material has no acquisition instructions."], repair_stage: target, accepted_missing: [] });
const dir = () => mkdtemp(path.join(os.tmpdir(), "article-pipeline-test-"));
const deadline = () => Date.now() + 30_000;

test("successful article advances through all model reviews and technical checks before completion", async () => {
  const runDir = await dir(), calls: Stage[] = [];
  const state = await runArticlePipeline({ job, runDir, deadline: deadline(), execute: async stage => { calls.push(stage); return pass(); } });
  assert.deepEqual(calls, [...STAGES]); assert.equal(state.status, "completed");
  await runArticlePipeline({ job, runDir, deadline: deadline(), execute: async () => { throw Error("Completed stages must not rerun"); } });
});
test("blocked research never starts images, writing, import or browser", async () => {
  const calls: Stage[] = [];
  const state = await runArticlePipeline({ job, runDir: await dir(), deadline: deadline(), execute: async stage => {
    calls.push(stage); return stage === "research_review" ? { ...pass(), status: "blocked", summary: "Final reward condition is unsupported." } : pass();
  } });
  assert.deepEqual(calls, ["research", "research_review"]); assert.equal(state.status, "blocked");
});
test("writing revision reuses approved research/images and review budgets survive resume", async () => {
  const runDir = await dir(), calls: Stage[] = [];
  const state = await runArticlePipeline({ job, runDir, deadline: deadline(), execute: async stage => { calls.push(stage); return stage === "editorial_review" ? revision("writing") : pass(); } });
  assert.equal(state.status, "blocked"); assert.equal(state.revisions.writing, 1);
  assert.equal(calls.filter(x => x === "research").length, 1); assert.equal(calls.filter(x => x === "images").length, 1);
  assert.equal(calls.filter(x => x === "writing").length, 2); assert.ok(!calls.includes("import_verify"));
  const resumed = await runArticlePipeline({ job, runDir, deadline: deadline(), execute: async () => { throw Error("Exhausted review cannot silently restart"); } });
  assert.equal(resumed.revisions.writing, 1);
});
test("evidence repair after writing returns to research review and writing, preserving media", async () => {
  const calls: Stage[] = []; let first = true;
  const state = await runArticlePipeline({ job, runDir: await dir(), deadline: deadline(), execute: async stage => {
    calls.push(stage); if (stage === "editorial_review" && first) { first = false; return revision("research"); } return pass();
  } });
  assert.equal(state.status, "completed"); assert.equal(calls.filter(x => x === "images").length, 1);
  assert.equal(calls.filter(x => x === "research_review").length, 2); assert.equal(calls.filter(x => x === "writing").length, 2);
});
test("technical retry does not restart model stages; exhausted browser failure prevents completion", async () => {
  const calls: Stage[] = [];
  const state = await runArticlePipeline({ job, runDir: await dir(), deadline: deadline(), execute: async stage => {
    calls.push(stage); if (stage === "browser_verify") throw new StageFailure("Browser did not render the article", true); return pass();
  } });
  assert.equal(state.status, "blocked"); assert.equal(calls.filter(x => x === "browser_verify").length, 2);
  assert.equal(calls.filter(x => x === "writing").length, 1);
});
test("copy validation failure receives a bounded writer revision and a new editorial review", async () => {
  let first = true; const calls: Stage[] = [];
  const state = await runArticlePipeline({ job, runDir: await dir(), deadline: deadline(), execute: async stage => {
    calls.push(stage); if (stage === "copy_check" && first) { first = false; throw new StageFailure("Bad public copy", false, "writing"); } return pass();
  } });
  assert.equal(state.status, "completed"); assert.equal(calls.filter(x => x === "editorial_review").length, 2);
});
test("one narrow technical correction remains available after the substantive writing revision", async () => {
  let review = 0, checks = 0;
  const state = await runArticlePipeline({ job, runDir: await dir(), deadline: deadline(), execute: async stage => {
    if (stage === "editorial_review" && ++review === 1) return revision("writing");
    if (stage === "copy_check" && ++checks === 1) throw new StageFailure("One invalid public-copy phrase", false, "writing");
    return pass();
  } });
  assert.equal(state.status, "completed"); assert.equal(state.revisions.writing, 1); assert.equal(state.technicalRepairs.copy_check, 1); assert.equal(review, 3);
});
test("changed approved artifacts and changed job input cannot inherit saved completion", async () => {
  const runDir = await dir();
  await runArticlePipeline({ job, runDir, deadline: deadline(), execute: async stage => { if (stage === "research") await writeFile(path.join(runDir, "content/brief.md"), "saved evidence"); return pass(); } });
  await writeFile(path.join(runDir, "content/brief.md"), "changed evidence");
  await assert.rejects(runArticlePipeline({ job, runDir, deadline: deadline(), execute: async () => pass() }), /Artifacts changed/);
  await assert.rejects(runArticlePipeline({ job: { ...job, title: "Different promise" }, runDir, deadline: deadline(), execute: async () => pass() }), /Run input changed/);
});
test("expired runtime deadline launches no worker", async () => {
  const state = await runArticlePipeline({ job, runDir: await dir(), deadline: Date.now() - 1, execute: async () => { throw Error("must not launch"); } });
  assert.equal(state.status, "blocked"); assert.match(state.feedback, /deadline/);
});
test("external shutdown preserves the interrupted stage and its previously approved work", async () => {
  const runDir = await dir();
  await assert.rejects(runArticlePipeline({ job, runDir, deadline: deadline(), execute: async stage => {
    if (stage === "writing") { await writeFile(path.join(runDir, "content/final.json"), "partial draft"); throw new StageInterrupted("service shutdown"); }
    return pass();
  } }), /shutdown/);
  const saved = JSON.parse(await readFile(path.join(runDir, "state.json"), "utf8"));
  assert.equal(saved.inFlight, "writing"); assert.equal(saved.status, "running");
  const calls: Stage[] = [];
  const resumed = await runArticlePipeline({ job, runDir, deadline: deadline(), execute: async stage => { calls.push(stage); return pass(); } });
  assert.equal(calls[0], "writing"); assert.ok(!calls.includes("research")); assert.equal(resumed.status, "completed");
});
test("invalid or contradictory decisions never grant approval", () => {
  assert.throws(() => parseDecision({ status: "completed" }));
  assert.throws(() => parseDecision({ ...pass(), findings: ["Missing recipe"] }));
  assert.throws(() => parseDecision({ ...revision("research"), repair_stage: "publish" }));
  assert.throws(() => validateJob({ ...job, slug: "../../other-article" }));
  assert.throws(() => validateJob({ ...job, id: undefined }));
  assert.throws(() => validateJob({ ...job, slug: undefined }));
  assert.throws(() => validateJob({ ...job, refresh: "true" }));
});
test("native worker controls are disabled and review sessions are read-only", () => {
  const options = { worktree: "/repo", runDir: "/repo/tmp/run", model: "gpt-5.6-luna", reasoning: "max" } as StageRuntimeOptions;
  const args = stageCodexArgs(options, "editorial_review", "review", "/repo/tmp/run/attempt");
  assert.ok(args.includes("features.multi_agent=false")); assert.ok(args.includes("features.multi_agent_v2=false"));
  assert.ok(args.includes("features.apps=false")); assert.ok(args.includes("read-only")); assert.ok(args.includes("--output-schema"));
  assert.ok(!args.includes("--approve-for-me"));
  const writerArgs = stageCodexArgs(options, "writing", "write", "/repo/tmp/run/attempt");
  assert.ok(writerArgs.includes("--approve-for-me")); assert.ok(!writerArgs.includes("--sandbox"));
  const prompt = stagePrompt(options, "writing", { job, feedback: "Fix the missing ingredient source" } as PipelineState);
  assert.match(prompt, /Fix the missing ingredient/); assert.match(prompt, /Choose your own headings/);
});
test("model stages receive no database, queue, release or unrelated integration secrets", () => {
  const env = workerEnvironment({ HOME: "/safe", PATH: "/bin", SUPABASE_SERVICE_ROLE: "secret", ARTICLE_DEV_SUPABASE_SERVICE_ROLE: "secret", GROQ_API_KEY: "secret", ARTICLE_RELEASE_PRODUCTION_ENV_FILE: "/secret", ARTICLE_PIPELINE_STAGE: "research" });
  assert.equal(env.HOME, "/safe"); assert.equal(env.ARTICLE_PIPELINE_STAGE, "research");
  assert.ok(!JSON.stringify(env).includes("secret")); assert.equal(env.BLOXODES_ENV_PROFILE, "process-only");
});
test("quiet process is allowed to finish; only the runtime deadline stops it", async () => {
  const runDir = await dir();
  const r = await runStageCommand({ bin: process.execPath, args: ["-e", "setTimeout(()=>console.log('finished'),150)"], cwd: runDir, env: process.env, log: path.join(runDir, "quiet.log"), timeoutMs: 5000 });
  assert.equal(r.code, 0); assert.match(r.tail, /finished/);
  await assert.rejects(runStageCommand({ bin: process.execPath, args: ["-e", "setInterval(()=>{},1000)"], cwd: runDir, env: process.env, log: path.join(runDir, "deadline.log"), timeoutMs: 100 }), /deadline/);
});
test("completed model response without its promised artifact cannot advance", async () => {
  const runDir = await dir(), attemptDir = path.join(runDir, "attempt");
  await mkdir(path.join(runDir, "content")); await mkdir(attemptDir);
  const fake = path.join(runDir, "fake-codex.cjs");
  await writeFile(fake, `#!/usr/bin/env node\nconst fs=require('fs');const a=process.argv;fs.writeFileSync(a[a.indexOf('--output-last-message')+1],${JSON.stringify(JSON.stringify(pass()))});\n`, { mode: 0o700 });
  const runtime: StageRuntimeOptions = { worktree: process.cwd(), runDir, deadline: deadline(), stageTimeoutMs: 5000, codexBin: fake, model: "gpt-5.6-luna", reasoning: "max", grokFallback: false, grokBin: "grok", grokModel: "grok-4.5", env: { ...process.env, SUPABASE_URL: "https://test.supabase.co" }, baseUrl: "http://localhost:3000" };
  await assert.rejects(executeArticleStage(runtime, "research", { job, feedback: "" } as PipelineState, attemptDir));
  assert.ok((await readFile(path.join(attemptDir, "schema.json"), "utf8")).includes("repair_stage"));
});
test("provider fallback accepts structured stdout without mixing diagnostic stderr into the decision", async () => {
  const runDir = await dir(), attemptDir = path.join(runDir, 'attempt');
  await mkdir(path.join(runDir, 'content')); await mkdir(attemptDir);
  const codex = path.join(runDir, 'codex.cjs'), grok = path.join(runDir, 'grok.cjs');
  await writeFile(codex, `#!/usr/bin/env node\nconsole.log(JSON.stringify({type:'error',message:'429 rate limit'}));process.exitCode=1;\n`, { mode: 0o700 });
  await writeFile(grok, `#!/usr/bin/env node\nconst fs=require('fs');fs.writeFileSync('brief.md','Research status: ready_for_review\\n');console.error('provider diagnostic');console.log(JSON.stringify({structured_output:${JSON.stringify(pass())}}));\n`, { mode: 0o700 });
  const runtime: StageRuntimeOptions = { worktree: process.cwd(), runDir, deadline: deadline(), stageTimeoutMs: 5000, codexBin: codex, model: 'gpt-5.6-luna', reasoning: 'max', grokFallback: true, grokBin: grok, grokModel: 'grok-4.5', env: { ...process.env, SUPABASE_URL: 'https://test.supabase.co' }, baseUrl: 'http://localhost:3000' };
  const result = await executeArticleStage(runtime, 'research', { job, feedback: '' } as PipelineState, attemptDir);
  assert.equal(result.status, 'completed');
  await writeFile(codex, `#!/usr/bin/env node\nconsole.log(JSON.stringify({type:'item.completed',item:{output:'source returned 429'}}));process.exitCode=1;\n`, { mode: 0o700 });
  await assert.rejects(executeArticleStage(runtime, 'research_review', { job, feedback: '' } as PipelineState, attemptDir), /Codex research_review exited/);
});
test("external process cancellation is distinguished from a deadline and launches no replacement", async () => {
  const runDir = await dir(), controller = new AbortController();
  const pending = runStageCommand({ bin: process.execPath, args: ['-e', 'setInterval(()=>{},1000)'], cwd: runDir, env: process.env, log: path.join(runDir, 'shutdown.log'), timeoutMs: 5000, signal: controller.signal });
  setTimeout(() => controller.abort(), 100);
  await assert.rejects(pending, StageInterrupted);
  await assert.rejects(runStageCommand({ bin: '/must-not-launch', args: [], cwd: runDir, env: process.env, log: path.join(runDir, 'unused.log'), timeoutMs: 5000, signal: controller.signal }), StageInterrupted);
});
test('provider backoff resumes only the failed stage and remains bounded across invocations', async () => {
  const runDir = await dir(), calls: Stage[] = [];
  const execute = async (stage: Stage) => { calls.push(stage); if (stage === 'images') throw new StageFailure('Account usage limit', true, null, 'provider'); return pass(); };
  let state = await runArticlePipeline({ job, runDir, deadline: deadline(), execute });
  assert.equal(state.blockerKind, 'provider'); assert.ok(state.retryAfter);
  const initialCalls = calls.length;
  await runArticlePipeline({ job, runDir, deadline: deadline(), execute });
  assert.equal(calls.length, initialCalls, 'no model launches during backoff');
  for (let cycle = 0; cycle < 2; cycle++) {
    state.retryAfter = new Date(Date.now() - 1).toISOString();
    await writeFile(path.join(runDir, 'state.json'), JSON.stringify(state));
    state = await runArticlePipeline({ job, runDir, deadline: deadline(), execute });
  }
  assert.equal(calls.filter(x => x === 'research').length, 1);
  assert.equal(calls.filter(x => x === 'research_review').length, 1);
  assert.equal(calls.filter(x => x === 'images').length, 6);
  assert.equal(state.retryAfter, undefined); assert.equal(state.status, 'blocked');
  await runArticlePipeline({ job, runDir, deadline: deadline(), execute: async () => { throw Error('exhausted recovery must not restart'); } });
});
test('operational recovery succeeds without resetting substantive revision counts', async () => {
  const runDir = await dir(); let reviewed = false;
  let state = await runArticlePipeline({ job, runDir, deadline: deadline(), execute: async stage => {
    if (stage === 'editorial_review' && !reviewed) { reviewed = true; return revision('writing'); }
    if (stage === 'browser_verify') throw new StageFailure('Browser unavailable', true);
    return pass();
  } });
  state.retryAfter = new Date(Date.now() - 1).toISOString();
  await writeFile(path.join(runDir, 'state.json'), JSON.stringify(state));
  const calls: Stage[] = [];
  state = await runArticlePipeline({ job, runDir, deadline: deadline(), execute: async stage => { calls.push(stage); return pass(); } });
  assert.deepEqual(calls, ['browser_verify']); assert.equal(state.status, 'completed'); assert.equal(state.revisions.writing, 1);
});
test('technical stages use managed-development import semantics without loading another env profile', () => {
  const source = { SUPABASE_URL: 'https://test.supabase.co', SUPABASE_SERVICE_ROLE: 'test-placeholder', NODE_ENV: 'production', CODEX_THREAD_ID: 'parent' };
  const env = articleStageEnvironment(source, 'import_verify');
  assert.equal(env.NODE_ENV, 'development'); assert.equal(env.BLOXODES_ENV_PROFILE, 'process-only');
  assert.equal(env.SUPABASE_URL, source.SUPABASE_URL); assert.equal(env.SUPABASE_SERVICE_ROLE, source.SUPABASE_SERVICE_ROLE); assert.equal(env.CODEX_THREAD_ID, undefined);
  assert.equal(articleStageEnvironment(source, 'writing').NODE_ENV, 'production');
  assert.throws(() => articleStageEnvironment({ ...source, SUPABASE_URL: 'https://database.bloxodes.com' }, 'import_verify'));
});
test('explicit technical recovery consumes its existing budget and cannot bypass provider or editorial blockers', async () => {
  const runDir = await dir();
  let state = await runArticlePipeline({ job, runDir, deadline: deadline(), execute: async stage => { if (stage === 'import_verify') throw new StageFailure('Fixed importer environment issue', true); return pass(); } });
  assert.ok(Date.parse(state.retryAfter!) > Date.now());
  const calls: Stage[] = [];
  state = await runArticlePipeline({ job, runDir, deadline: deadline(), retryTechnical: true, execute: async stage => { calls.push(stage); return pass(); } });
  assert.deepEqual(calls, ['import_verify', 'browser_verify']); assert.equal(state.operationalResumes?.import_verify, 1); assert.equal(state.status, 'completed');
  for (const provider of [true, false]) {
    const blockedDir = await dir();
    await runArticlePipeline({ job, runDir: blockedDir, deadline: deadline(), execute: async () => { if (provider) throw new StageFailure('Quota', true, null, 'provider'); return { ...pass(), status: 'blocked', summary: 'Unsupported procedure' }; } });
    const blocked = await runArticlePipeline({ job, runDir: blockedDir, deadline: deadline(), retryTechnical: true, execute: async () => { throw Error('must not run'); } });
    assert.equal(blocked.status, 'blocked');
  }
});

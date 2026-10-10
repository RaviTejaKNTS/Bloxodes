import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { ArtifactOwnershipFailure, artifactHashes, runArticlePipeline, saveJson, StageInterrupted, type Decision, type PipelineState, type Stage } from "../article-pipeline";
import { REVIEW_CRITERIA } from "../article-editorial-review";
import { executeArticleStage, type StageRuntimeOptions } from "../article-stage-runtime";

const job = { id: "controller-recovery", slug: "controller-recovery", title: "Controller recovery", article_type: "guide", sources: [] };
const pass: Decision = { status: "completed", summary: "The review is complete.", findings: [], repair_stage: null, accepted_missing: [] };
const cases = [
  ["research_review", "game-identity.json"],
  ["image_review", "content/media.json"],
  ["editorial_review", "content/final.json"],
] as const;

async function interruptedControllerWrite(t: any, stage: Stage, file: string) {
  const runDir = await mkdtemp(path.join(os.tmpdir(), "article-controller-recovery-"));
  t.after(() => rm(runDir, { recursive: true, force: true }));
  await mkdir(path.join(runDir, "content"));
  await writeFile(path.join(runDir, "content/brief.md"), "Approved game instructions.\n");
  const body = "Follow the four-country progression.";
  await saveJson(path.join(runDir, "content/final.json"), { slug: job.slug, title: job.title, universe_id: null, content_md: body });
  await saveJson(path.join(runDir, "content/media.json"), { required: true, article_slug: job.slug, expected_count: 1, entries: [{ id: "target", status: "missing", missing_reason: "No suitable screenshot.", search_queries: ["game target", "game screenshot"], searched_source_urls: ["https://wiki.example/target", "https://guide.example/target"] }] });
  const artifacts = await artifactHashes(path.join(runDir, "content"));
  await saveJson(path.join(runDir, "game-identity.json"), { universe_id: null, supplied_id: null, note: "Previous identity.", approved_brief_hash: artifacts["brief.md"] });
  const identityInput = await readFile(path.join(runDir, "game-identity.json"), "utf8");
  const initial: PipelineState = { version: 1, job, stage, status: "running", attempts: {}, failures: {}, technicalRepairs: {}, revisions: { research: 0, images: 0, writing: 1 }, feedback: "", artifacts, identityInput, history: [] };
  await saveJson(path.join(runDir, "state.json"), initial);
  const response = stage === "image_review" ? { ...pass, accepted_missing: ["target"] } : stage === "editorial_review" ? {
    ...pass, status: "needs_revision", summary: "Correct the place type.", findings: ["Use states instead of countries."], repair_stage: "writing",
    editorial_evidence: { checks: REVIEW_CRITERIA.map(criterion => ({ criterion, verdict: criterion === "evidence" ? "revise" : "pass", quotes: [body], assessment: "The place type needs a correction." })), faqs: [] },
    localized_corrections: [{ before: "four-country", after: "four-state" }],
  } : pass;
  const codexBin = path.join(runDir, "codex.cjs"), claudeBin = path.join(runDir, "claude.cjs");
  await writeFile(codexBin, `#!/usr/bin/env node\nconst fs = require('fs'); const args = process.argv; fs.writeFileSync(args[args.indexOf('--output-last-message') + 1], ${JSON.stringify(JSON.stringify(response))});\n`, { mode: 0o700 });
  await writeFile(claudeBin, `#!/usr/bin/env node\nconsole.log(JSON.stringify({ structured_output: ${JSON.stringify(response)} }));\n`, { mode: 0o700 });
  const runtime: StageRuntimeOptions = { worktree: process.cwd(), runDir, codexBin, claudeBin, model: "gpt-6-luna", reasoning: "max", grokFallback: false, grokBin: "unused", grokModel: "unused", deadline: Date.now() + 60_000, stageTimeoutMs: 5000, baseUrl: "http://localhost:3100", env: { HOME: os.homedir(), PATH: process.env.PATH, SUPABASE_URL: "https://test.supabase.co" } };
  const original = await readFile(path.join(runDir, file), "utf8");
  let crashState = "";
  await assert.rejects(runArticlePipeline({ job, runDir, deadline: runtime.deadline, execute: async (current, state, attemptDir) => {
    assert.equal(current, stage);
    await executeArticleStage(runtime, current, state, attemptDir);
    crashState = await readFile(path.join(runDir, "state.json"), "utf8");
    assert.ok(JSON.parse(crashState).controllerWrites, "the intent is durable before the adapter returns or the interruption handler saves state");
    throw new StageInterrupted("Crash after controller write, before decision commit.");
  } }), /Crash after controller write/);
  // Replay the disk checkpoint from before the interruption handler, as for a killed process.
  await writeFile(path.join(runDir, "state.json"), crashState);
  const saved = JSON.parse(await readFile(path.join(runDir, "state.json"), "utf8")) as PipelineState;
  assert.equal(saved.inFlight, stage);
  assert.equal(saved.stage, stage);
  assert.equal(saved.history.length, 0);
  assert.deepEqual(saved.ownershipInput?.hashes, initial.artifacts);
  const writes = saved.controllerWrites!;
  const intent = writes.files[file as keyof typeof writes.files]!;
  assert.equal(writes.briefHash, artifacts["brief.md"]);
  assert.equal(intent.bytes, await readFile(path.join(runDir, file), "utf8"));
  assert.equal(intent.hash, createHash("sha256").update(intent.bytes).digest("hex"));
  assert.notEqual(intent.bytes, original);
  await assert.rejects(readFile(path.join(runDir, `attempts/${stage}-1/decision.json`)), { code: "ENOENT" });
  return { runDir, saved, original, intent, deadline: runtime.deadline };
}

for (const [stage, file] of cases) {
  test(`${stage} resumes after its controller write without inheriting review approval`, async t => {
    const f = await interruptedControllerWrite(t, stage, file);
    const calls: Stage[] = [];
    const resumed = await runArticlePipeline({ job, runDir: f.runDir, deadline: f.deadline, execute: async (current, state) => {
      calls.push(current);
      if (current === stage && stage === "editorial_review") assert.equal(state.editorialCorrections, 1);
      return pass;
    } });
    assert.equal(calls[0], stage);
    assert.equal(resumed.attempts[stage], 2);
    assert.equal(resumed.status, "completed");
    assert.equal(resumed.history[0].stage, stage);
    assert.equal(resumed.controllerWrites, undefined);
  });

  test(`${stage} also resumes when the durable intent was never applied`, async t => {
    const f = await interruptedControllerWrite(t, stage, file);
    await writeFile(path.join(f.runDir, file), f.original);
    const resumed = await runArticlePipeline({ job, runDir: f.runDir, deadline: f.deadline, execute: async (current, state) => {
      if (current === stage && stage === "editorial_review") assert.equal(state.editorialCorrections, undefined);
      return pass;
    } });
    assert.equal(resumed.status, "completed");
  });

  test(`${stage} rejects different bytes despite a matching brief binding`, async t => {
    const f = await interruptedControllerWrite(t, stage, file);
    // Whitespace alone changes the bytes while preserving every JSON field.
    await writeFile(path.join(f.runDir, file), `${f.intent.bytes} `);
    let calls = 0;
    await assert.rejects(runArticlePipeline({ job, runDir: f.runDir, deadline: f.deadline, execute: async () => { calls++; return pass; } }), ArtifactOwnershipFailure);
    assert.equal(calls, 0);
  });
}

test("a recovered identity write still requires the research reviewer to accept the brief", async t => {
  const f = await interruptedControllerWrite(t, "research_review", "game-identity.json");
  const calls: Stage[] = [];
  const resumed = await runArticlePipeline({ job, runDir: f.runDir, deadline: f.deadline, execute: async stage => {
    calls.push(stage);
    return { ...pass, status: "blocked", summary: "The procedure remains unsupported." };
  } });
  assert.deepEqual(calls, ["research_review"]);
  assert.equal(resumed.status, "blocked");
});

test("recovery rejects controller intents bound to another brief", async t => {
  const f = await interruptedControllerWrite(t, "research_review", "game-identity.json");
  f.saved.controllerWrites!.briefHash = "another-brief";
  await saveJson(path.join(f.runDir, "state.json"), f.saved);
  await assert.rejects(runArticlePipeline({ job, runDir: f.runDir, deadline: f.deadline, execute: async () => { assert.fail("A mismatched intent must not launch a review."); } }), ArtifactOwnershipFailure);
});

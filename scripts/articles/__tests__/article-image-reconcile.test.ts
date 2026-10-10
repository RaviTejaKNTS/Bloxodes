import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { checkArticleImageReadiness, type ArticleImageManifest } from "../../content/article-image-readiness";
import { reconcileArticleImages, reconcileWrittenArticleImages } from "../article-image-reconcile";
import { artifactHashes, assertStageOwnership, ownershipSnapshot, runArticlePipeline, saveArticleControllerJson, saveJson, StageInterrupted, type Decision, type PipelineState, type Stage } from "../article-pipeline";
import { executeArticleStage, type StageRuntimeOptions } from "../article-stage-runtime";
import { REVIEW_CRITERIA } from "../article-editorial-review";

const job = { id: "image-reconcile", slug: "image-reconcile", title: "Image reconciliation", article_type: "guide", sources: [] };
const url = "https://media.bloxodes.com/articles/image-reconcile/sources/panel.webp";
const pass: Decision = { status: "completed", summary: "The stage passed.", findings: [], repair_stage: null, accepted_missing: [] };
function media(): ArticleImageManifest {
  return { schema: 1, article_slug: job.slug, visual_type: "steps", required: true, expected_count: 1, entries: [{
    id: "panel", label: "Weapon evolution panel", required: true, status: "verified", placement_heading: "Old heading",
    source_page_url: "https://wiki.example/panel", original_image_url: "https://wiki.example/panel.png",
    match_evidence: "The panel shows the exact weapon requirements.", rights_note: "Official gameplay screenshot.",
    alt: "Weapon evolution requirements panel", uploaded_path: `articles/${job.slug}/sources/panel.webp`, public_url: url, width: 1280, height: 720,
  }] };
}
const final = (content_md: string) => ({ slug: job.slug, title: job.title, universe_id: null, content_md });
const placed = `## Evolution\n\n![The weapon requirements screen](${url})`;

test("a dropped hosted image retains verification, URLs and evidence for a later revision", () => {
  const original = media();
  const result = reconcileArticleImages(original, final("## Evolution\n\nRead the requirements."), {});
  assert.equal(result.readiness.ready, true);
  assert.equal(result.readiness.summary.unused, 1);
  assert.equal(result.changed, false);
  assert.deepEqual(result.manifest, original);
  const restored = reconcileArticleImages(result.manifest, final(placed), {});
  assert.equal(restored.readiness.ready, true);
  assert.equal(restored.manifest.entries[0]!.status, "verified");
});

test("duplicate placements sync to the first occurrence heading", () => {
  const result = reconcileArticleImages(media(), final(`${placed}\n\n## Upgrade\n\n![The weapon requirements screen](${url})`), {});
  assert.equal(result.readiness.ready, true, result.readiness.errors.join("\n"));
  assert.equal(result.manifest.entries[0]!.placement_heading, "Evolution");
});

test("reconciliation syncs the actual heading and normalized alt and is idempotent", () => {
  const body = placed.replace("The weapon requirements screen", "The weapon &amp; requirements screen");
  const result = reconcileArticleImages(media(), final(body), {});
  assert.equal(result.manifest.entries[0]!.placement_heading, "Evolution");
  assert.equal(result.manifest.entries[0]!.alt, "The weapon & requirements screen");
  assert.equal(result.readiness.ready, true);
  assert.equal(reconcileArticleImages(result.manifest, final(body), {}).changed, false);
  const omitted = reconcileArticleImages(media(), final("No body images."), {});
  assert.equal(reconcileArticleImages(omitted.manifest, final("No body images."), {}).changed, false);
});

test("structured-block images use the same placement and alt rules", () => {
  const body = ["## Evolution", "", "```tier-list", "schema: 1", "id: weapons", "title: Weapons ranked", "scope: Evolution", "tiers:", "  - rank: S", "    items:", "      - name: Sword", `        image: ${url}`, "        alt: Sword evolution requirements", "```"].join("\n");
  const result = reconcileArticleImages(media(), final(body), {});
  assert.equal(result.readiness.ready, true);
  assert.equal(result.manifest.entries[0]!.alt, "Sword evolution requirements");
});

const defects = [
  `![Weapon evolution requirements panel](${url})\n\n## Evolution\n\nRead the panel.`,
  `${placed}\n\n![Invented screenshot](https://foreign.example/invented.png)`,
  `## Evolution\n\n<img src="${url}" alt="Weapon requirements">`,
  `## Evolution\n\n![x](${url})`,
  `![Weapon evolution requirements panel](${url})\n\n${placed}`,
];
test("unheaded, foreign, raw HTML, short-alt and inconsistent duplicate images remain writing defects", () => {
  for (const body of defects) assert.equal(reconcileArticleImages(media(), final(body), {}).readiness.ready, false, body);
});

async function fixture(t: any, stage: Stage = "writing") {
  const runDir = await mkdtemp(path.join(os.tmpdir(), "article-image-reconcile-"));
  t.after(() => rm(runDir, { recursive: true, force: true }));
  await mkdir(path.join(runDir, "content"));
  await writeFile(path.join(runDir, "content/brief.md"), "Approved evidence.\n");
  await saveJson(path.join(runDir, "content/media.json"), media());
  await saveJson(path.join(runDir, "content/final.json"), final("## Evolution\n\nRead the requirements."));
  const artifacts = await artifactHashes(path.join(runDir, "content"));
  await saveJson(path.join(runDir, "game-identity.json"), { universe_id: null, approved_brief_hash: artifacts["brief.md"] });
  const state: PipelineState = { version: 1, job, stage, status: "running", attempts: {}, revisions: { research: 0, images: 0, writing: 0 }, failures: {}, technicalRepairs: {}, feedback: "", artifacts, history: [] };
  await saveJson(path.join(runDir, "state.json"), state);
  const codexBin = path.join(runDir, "writer.cjs");
  await writeFile(codexBin, `#!/usr/bin/env node\nconst fs = require('fs'); const args = process.argv; fs.writeFileSync(args[args.indexOf('--output-last-message') + 1], ${JSON.stringify(JSON.stringify(pass))});\n`, { mode: 0o700 });
  const runtime: StageRuntimeOptions = { stageConfigs: { writing: { provider: "codex", model: "gpt-6-luna", effort: "max" } }, worktree: process.cwd(), runDir, codexBin, model: "gpt-6-luna", reasoning: "max", grokFallback: false, grokBin: "unused", grokModel: "unused", deadline: Date.now() + 60_000, stageTimeoutMs: 5000, baseUrl: "http://localhost:3100", env: { PATH: process.env.PATH, HOME: os.homedir(), SUPABASE_URL: "https://test.supabase.co", BLOXODES_CI_QA: "1" } };
  return { runDir, state, runtime };
}

test("the actual writer adapter reconciles each pass before editorial review", async t => {
  const f = await fixture(t);
  let reviews = 0;
  const state = await runArticlePipeline({ job, runDir: f.runDir, deadline: f.runtime.deadline, execute: async (stage, state, attempt) => {
    if (stage === "writing") {
      if (state.revisions.writing) await saveJson(path.join(f.runDir, "content/final.json"), final(placed));
      return executeArticleStage(f.runtime, stage, state, attempt);
    }
    if (stage === "editorial_review" && reviews++ === 0) return { ...pass, status: "needs_revision", findings: ["Explain the panel."], repair_stage: "writing" };
    if (stage === "image_check") return executeArticleStage(f.runtime, stage, state, attempt);
    return pass;
  } });
  assert.equal(state.status, "completed");
  const restored = JSON.parse(await readFile(path.join(f.runDir, "content/media.json"), "utf8"));
  assert.equal(restored.entries[0].status, "verified");
  assert.equal(restored.entries[0].public_url, url);
  assert.equal(restored.entries[0].placement_heading, "Evolution");
  assert.equal(state.attempts.writing, 2);
  assert.equal(state.revisions.writing, 1);
  assert.equal(state.history.find(entry => entry.stage === "image_check")!.decision.delegatedToCi, undefined);
});

test("local image_check routes to the remaining writing revision even with CI QA enabled", async t => {
  for (const used of [0, 1]) {
    const f = await fixture(t, "image_check");
    await saveJson(path.join(f.runDir, "content/final.json"), final(defects[0]!));
    f.state.artifacts = await artifactHashes(path.join(f.runDir, "content"));
    f.state.revisions.writing = used;
    await saveJson(path.join(f.runDir, "state.json"), f.state);
    const calls: Stage[] = [];
    const result = await runArticlePipeline({ job, runDir: f.runDir, deadline: f.runtime.deadline, execute: async (stage, state, attempt) => {
      calls.push(stage);
      if (stage === "image_check") return executeArticleStage(f.runtime, stage, state, attempt);
      if (stage === "writing") {
        await saveJson(path.join(f.runDir, "content/final.json"), final(placed));
        await reconcileWrittenArticleImages(f.runDir, state, stage, f.runtime.env);
      }
      return pass;
    } });
    assert.equal(result.status, used ? "blocked" : "completed");
    assert.equal(calls.includes("writing"), !used);
    assert.equal(result.revisions.writing, 1);
    assert.equal(result.technicalRepairs.image_check, undefined);
    if (used) assert.match(result.feedback, /budget exhausted.*writing.*Article body image readiness failed/s);
  }
});

test("a writing reconciliation defect returns to writing once and blocks locally after exhaustion", async t => {
  for (const used of [0, 1]) {
    const f = await fixture(t);
    await saveJson(path.join(f.runDir, "content/final.json"), final(defects[0]!));
    f.state.artifacts = await artifactHashes(path.join(f.runDir, "content"));
    f.state.revisions.writing = used;
    await saveJson(path.join(f.runDir, "state.json"), f.state);
    let writes = 0;
    const result = await runArticlePipeline({ job, runDir: f.runDir, deadline: f.runtime.deadline, execute: async (stage, state, attempt) => {
      if (stage === "writing") {
        if (writes++ > 0) await saveJson(path.join(f.runDir, "content/final.json"), final(placed));
        return executeArticleStage(f.runtime, stage, state, attempt);
      }
      return pass;
    } });
    assert.equal(result.status, used ? "blocked" : "completed");
    assert.equal(writes, used ? 1 : 2);
    assert.equal(result.history[0]!.decision.repair_stage, "writing");
    if (used) assert.match(result.feedback, /budget exhausted.*writing.*Article body image readiness failed/s);
  }
});

test("the localized editorial edit reconciles changed alt text and records both writes", async t => {
  const f = await fixture(t, "editorial_review");
  const body = `## Old heading\n\n![Weapon evolution requirements panel](${url})`;
  await saveJson(path.join(f.runDir, "content/final.json"), final(body));
  f.state.artifacts = await artifactHashes(path.join(f.runDir, "content"));
  f.state.revisions.writing = 1;
  await saveJson(path.join(f.runDir, "state.json"), f.state);
  const response = { ...pass, status: "needs_revision", findings: ["Use recipe requirements in the alt text."], repair_stage: "writing",
    editorial_evidence: { checks: REVIEW_CRITERIA.map(criterion => ({ criterion, verdict: criterion === "evidence" ? "revise" : "pass", quotes: ["Weapon evolution requirements panel"], assessment: "The recipe label needs a correction." })), faqs: [] },
    localized_corrections: [{ before: "Weapon evolution requirements panel", after: "Weapon recipe requirements panel" }] };
  await writeFile(f.runtime.codexBin, `#!/usr/bin/env node\nconst fs=require('fs'),a=process.argv;fs.writeFileSync(a[a.indexOf('--output-last-message')+1],${JSON.stringify(JSON.stringify(response))});\n`, { mode: 0o700 });
  f.runtime.stageConfigs!.editorial_review = { provider: "codex", model: "gpt-6-luna", effort: "max" };
  let reviews = 0;
  const result = await runArticlePipeline({ job, runDir: f.runDir, deadline: f.runtime.deadline, execute: async (stage, state, attempt) => {
    if (stage === "editorial_review" && reviews++ === 0) {
      const decision = await executeArticleStage(f.runtime, stage, state, attempt);
      assert.equal(decision.localizedCorrectionApplied, true);
      assert.deepEqual(Object.keys(state.controllerWrites!.files).sort(), ["content/final.json", "content/media.json"]);
      return decision;
    }
    if (stage === "image_check") return executeArticleStage(f.runtime, stage, state, attempt);
    return pass;
  } });
  assert.equal(result.status, "completed");
  assert.equal(result.editorialCorrections, 1);
  assert.equal(result.revisions.writing, 1);
  const manifest = JSON.parse(await readFile(path.join(f.runDir, "content/media.json"), "utf8"));
  assert.equal(manifest.entries[0].alt, "Weapon recipe requirements panel");
});

test("editorial acceptance finishes a partial correction and binds its receipt to the reconciled media", async t => {
  const f = await fixture(t, "editorial_review");
  await saveJson(path.join(f.runDir, "content/final.json"), final(placed));
  f.state.artifacts = await artifactHashes(path.join(f.runDir, "content"));
  f.state.editorialCorrections = 1;
  f.state.revisions.writing = 1;
  await saveJson(path.join(f.runDir, "state.json"), f.state);
  const response = { ...pass, editorial_evidence: { checks: REVIEW_CRITERIA.map(criterion => ({ criterion, verdict: "pass", quotes: ["The weapon requirements screen"], assessment: "The panel wording now matches the instructions." })), faqs: [] }, localized_corrections: [] };
  await writeFile(f.runtime.codexBin, `#!/usr/bin/env node\nconst fs=require('fs'),a=process.argv;fs.writeFileSync(a[a.indexOf('--output-last-message')+1],${JSON.stringify(JSON.stringify(response))});\n`, { mode: 0o700 });
  f.runtime.stageConfigs!.editorial_review = { provider: "codex", model: "gpt-6-luna", effort: "max" };
  const result = await runArticlePipeline({ job, runDir: f.runDir, deadline: f.runtime.deadline, execute: async (stage, state, attempt) => {
    if (stage === "editorial_review" || stage === "image_check") return executeArticleStage(f.runtime, stage, state, attempt);
    return pass;
  } });
  assert.equal(result.status, "completed");
  assert.equal(result.editorialCorrections, 1);
  const receipt = JSON.parse(await readFile(path.join(f.runDir, "editorial_review.json"), "utf8"));
  assert.deepEqual(receipt.input_hashes, result.artifacts);
});

for (const stage of ["writing", "editorial_review"] as const) {
  test(`${stage} resumes after recorded reconciliation and retains all controller intents`, async t => {
    const f = await fixture(t, stage);
    await saveJson(path.join(f.runDir, "content/final.json"), final(placed));
    f.state.artifacts = await artifactHashes(path.join(f.runDir, "content"));
    await saveJson(path.join(f.runDir, "state.json"), f.state);
    let crashState = "";
    await assert.rejects(runArticlePipeline({ job, runDir: f.runDir, deadline: f.runtime.deadline, execute: async (_, state) => {
      if (stage === "editorial_review") await saveArticleControllerJson(f.runDir, state, stage, state.ownershipInput!, "content/final.json", final(placed.replace("Evolution", "Revised heading")));
      await reconcileWrittenArticleImages(f.runDir, state, stage, f.runtime.env);
      crashState = await readFile(path.join(f.runDir, "state.json"), "utf8");
      throw new StageInterrupted("Crash after image reconciliation.");
    } }), StageInterrupted);
    const saved: PipelineState = JSON.parse(crashState);
    assert.ok(saved.controllerWrites!.files["content/media.json"]);
    if (stage === "editorial_review") assert.ok(saved.controllerWrites!.files["content/final.json"]);
    await assertStageOwnership(f.runDir, stage, saved.ownershipInput!, saved.controllerWrites);
    // Different placement bytes cannot reuse the recorded controller intent.
    const file = path.join(f.runDir, "content/media.json");
    const recorded = await readFile(file, "utf8");
    await writeFile(file, recorded.replace(stage === "writing" ? "Evolution" : "Revised heading", "Another heading"));
    await assert.rejects(assertStageOwnership(f.runDir, stage, saved.ownershipInput!, saved.controllerWrites));
    await writeFile(file, recorded);
    await writeFile(path.join(f.runDir, "state.json"), crashState);
    const result = await runArticlePipeline({ job, runDir: f.runDir, deadline: f.runtime.deadline, execute: async (current, state) => {
      if (current === stage) await reconcileWrittenArticleImages(f.runDir, state, stage, f.runtime.env);
      return pass;
    } });
    assert.equal(result.status, "completed");
    assert.equal(result.attempts[stage], 2);
    assert.equal(result.controllerWrites, undefined);
    assert.deepEqual(result.artifacts, (await ownershipSnapshot(f.runDir)).hashes);
    if (stage === "editorial_review") assert.equal(result.editorialCorrections, 1);
  });
}

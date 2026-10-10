import assert from "node:assert/strict";
import test from "node:test";
import { articleStageConfig, articleStageTimeoutMs, articleClaudeBin } from "../article-stage-config";
import { parseArgs } from "../run-homelab-article-batch";

test("all six stages use the approved split despite installed legacy 5.6 settings", () => {
  const env = { ARTICLE_WRITER_CODEX_MODEL: "gpt-5.6-luna", ARTICLE_WRITER_CODEX_REASONING_EFFORT: "low" };
  for (const stage of ["research", "images", "editorial_review"] as const) assert.deepEqual(articleStageConfig(stage, env), { provider: "codex", model: "gpt-6-luna", effort: "max" });
  for (const stage of ["research_review", "image_review", "writing"] as const) assert.deepEqual(articleStageConfig(stage, env), { provider: "claude", model: "claude-haiku-5-5", effort: "xhigh" });
});
test("stage overrides win and changing provider supplies compatible default model/effort", () => {
  assert.deepEqual(articleStageConfig("writing", { ARTICLE_STAGE_WRITING_PROVIDER: "codex" }), { provider: "codex", model: "gpt-6-luna", effort: "max" });
  assert.deepEqual(articleStageConfig("research", { ARTICLE_STAGE_RESEARCH_MODEL: "override", ARTICLE_STAGE_RESEARCH_EFFORT: "high", ARTICLE_STAGE_USE_LEGACY_CODEX_DEFAULTS: "true", ARTICLE_WRITER_CODEX_MODEL: "legacy" }), { provider: "codex", model: "override", effort: "high" });
  assert.equal(articleStageConfig("research", { ARTICLE_STAGE_USE_LEGACY_CODEX_DEFAULTS: "true", ARTICLE_WRITER_CODEX_MODEL: "legacy" }).model, "legacy");
  assert.throws(() => articleStageConfig("writing", { ARTICLE_STAGE_WRITING_PROVIDER: "other" }));
  assert.throws(() => articleStageConfig("writing", { ARTICLE_STAGE_WRITING_EFFORT: "none" }));
  assert.equal(articleClaudeBin({ ARTICLE_CLAUDE_BIN: "/custom/claude" }), "/custom/claude");
});
test("writing and editorial limits have stage overrides while the shared batch deadline stays separate", () => {
  assert.equal(articleStageTimeoutMs("writing", {}), 90 * 60_000);
  assert.equal(articleStageTimeoutMs("editorial_review", {}), 60 * 60_000);
  assert.equal(articleStageTimeoutMs("images", {}, 20 * 60_000), 20 * 60_000);
  assert.equal(articleStageTimeoutMs("writing", { ARTICLE_STAGE_WRITING_TIMEOUT_MINUTES: "75" }), 75 * 60_000);
  assert.throws(() => articleStageTimeoutMs("writing", { ARTICLE_STAGE_WRITING_TIMEOUT_MINUTES: "0" }));
});
test("invalid legacy reasoning blocks startup only when a selected stage uses it", () => {
  const env = { ARTICLE_WRITER_CODEX_REASONING_EFFORT: "obsolete" };
  assert.equal(parseArgs([], env).codexReasoningEffort, "max");
  assert.equal(parseArgs(["--codex-reasoning", "obsolete"], {}).codexReasoningEffort, "max");
  assert.throws(() => parseArgs([], { ...env, ARTICLE_STAGE_USE_LEGACY_CODEX_DEFAULTS: "true" }), /Codex reasoning effort/);
  assert.equal(parseArgs([], { ...env, ARTICLE_STAGE_USE_LEGACY_CODEX_DEFAULTS: "true", ARTICLE_STAGE_RESEARCH_EFFORT: "low", ARTICLE_STAGE_IMAGES_EFFORT: "high", ARTICLE_STAGE_EDITORIAL_REVIEW_EFFORT: "max" }).codexReasoningEffort, "max");
  assert.throws(() => parseArgs([], { ARTICLE_STAGE_RESEARCH_EFFORT: "obsolete" }), /Codex reasoning effort/);
});

import assert from "node:assert/strict";
import test from "node:test";
import { WIKI_STAGES, wikiStageConfig } from "../wiki-stage-config";
import { wikiWorkerEnvironment, wikiCodexStageArgs, wikiStageSandboxProbeArgs, assertWikiOwnership } from "../wiki-stage-runtime";
import { wikiDecisionSchema, wikiStagePrompt, parseWikiDecision, type WikiIdentity } from "../wiki-stage-prompts";

const identity: WikiIdentity = { id: "queue", game_name: "Game", wiki_slug: "game", universe_id: 123, root_place_id: 456 };
test("every wiki stage uses the owner's model split despite old installed defaults", () => {
  const haiku = ["collection_research_review", "collection_data_review", "collection_image_review", "collection_writing", "hub_research_review", "hub_writing"];
  for (const stage of WIKI_STAGES) {
    const config = wikiStageConfig(stage, { WIKI_AUTOMATION_CODEX_MODEL: "gpt-5.6-luna", WIKI_AUTOMATION_CODEX_REASONING: "low" });
    assert.equal(config.provider, haiku.includes(stage) ? "claude" : "codex");
    assert.equal(config.model, haiku.includes(stage) ? "claude-haiku-5-5" : "gpt-6-luna");
    assert.equal(config.effort, haiku.includes(stage) ? "xhigh" : "max");
  }
});
test("stage overrides win over legacy opt-in and validate provider, effort and timeout", () => {
  const env = { WIKI_STAGE_USE_LEGACY_CODEX_DEFAULTS: "true", WIKI_AUTOMATION_CODEX_MODEL: "legacy", WIKI_AUTOMATION_CODEX_REASONING: "low", WIKI_STAGE_HUB_WRITING_PROVIDER: "codex", WIKI_STAGE_HUB_WRITING_MODEL: "chosen", WIKI_STAGE_HUB_WRITING_EFFORT: "high", WIKI_STAGE_HUB_WRITING_TIMEOUT_MINUTES: "12" };
  assert.deepEqual(wikiStageConfig("hub_writing", env), { provider: "codex", model: "chosen", effort: "high", timeoutMs: 720_000 });
  assert.equal(wikiStageConfig("hub_research", env).model, "legacy");
  assert.throws(() => wikiStageConfig("hub_writing", { WIKI_STAGE_HUB_WRITING_PROVIDER: "other" }));
  assert.throws(() => wikiStageConfig("hub_writing", { WIKI_STAGE_HUB_WRITING_EFFORT: "none" }));
  assert.throws(() => wikiStageConfig("hub_research", { WIKI_STAGE_HUB_RESEARCH_TIMEOUT_MINUTES: "0" }));
});
test("worker env retains CLI HOME and OAuth while removing all database/release credentials", () => {
  const env = wikiWorkerEnvironment({ HOME: "/model", CODEX_HOME: "/model/.codex", PATH: "/bin", CLAUDE_CODE_OAUTH_TOKEN: "login-token", SUPABASE_SERVICE_ROLE: "db-secret", WIKI_DEV_SUPABASE_SERVICE_ROLE: "db-secret", WIKI_R2_SECRET_ACCESS_KEY: "media-secret", WIKI_RELEASE_PRODUCTION_ENV_FILE: "/private.env", GH_TOKEN: "github-secret", DATABASE_URL: "db", DOKPLOY_API_KEY: "deploy", BLOXODES_ENV_PROFILE: "managed-dev" });
  assert.equal(env.HOME, "/model"); assert.equal(env.CLAUDE_CODE_OAUTH_TOKEN, "login-token");
  assert.equal(env.BLOXODES_ENV_PROFILE, "process-only");
  for (const key of ["SUPABASE_SERVICE_ROLE", "WIKI_DEV_SUPABASE_SERVICE_ROLE", "WIKI_R2_SECRET_ACCESS_KEY", "WIKI_RELEASE_PRODUCTION_ENV_FILE", "GH_TOKEN", "DATABASE_URL", "DOKPLOY_API_KEY"]) assert.equal(env[key], undefined);
});
test("review args and prompts disable writes, subagents and local technical QA", () => {
  const task = { stage: "collection_image_review" as const, folder: "/state/collections/pets", collection: { slug: "pets", name: "Pets" }, revision: false, feedback: "", approved: [], attemptDir: "/state/.stages/pets/review/1" };
  const options = { worktree: "/repo", root: "/state", identity, env: {}, codexBin: "codex", deadline: Date.now() + 1000 };
  const args = wikiCodexStageArgs(options, task, { provider: "codex", model: "gpt-6-luna", effort: "max", timeoutMs: 1000 }, "review");
  assert.ok(args.includes('default_permissions="bloxodes_wiki_stage"'));
  assert.ok(args.includes("permissions.bloxodes_wiki_stage.network.enabled=false"));
  assert.ok(!args.includes("--sandbox"));
  const policy = args.find(arg => arg.startsWith("permissions.bloxodes_wiki_stage.filesystem="))!;
  assert.ok(policy.includes('"/state/collections/pets" = { "." = "read"'));
  assert.ok(policy.includes('"/etc/bloxodes" = "deny"'));
  assert.ok(policy.includes('"/proc" = "deny"'));
  assert.ok(args.includes("features.multi_agent=false")); assert.ok(!args.includes("--approve-for-me"));
  assert.ok(wikiDecisionSchema(task.stage).required.includes("accepted_missing"));
  const prompt = wikiStagePrompt({ ...options, ...task });
  assert.match(prompt, /bloxodes-game-collection-images\/SKILL.md/);
  assert.match(prompt, /Review stages never edit or create files/);
  assert.match(prompt, /Missing images never block/);
  assert.match(prompt, /No database access/);
});
test("Codex profile keeps the sandbox helper readable and gives networked stages resolver access", async t => {
  const { mkdtemp, mkdir, writeFile, rm } = await import("node:fs/promises");
  const os = await import("node:os"); const path = await import("node:path");
  const codexHome = await mkdtemp(path.join(os.tmpdir(), "wiki-codex-home-"));
  t.after(() => rm(codexHome, { recursive: true, force: true }));
  await mkdir(path.join(codexHome, "packages")); await writeFile(path.join(codexHome, "auth.json"), "{}");
  const options = { worktree: "/repo", root: "/state", identity, env: { HOME: "/model", CODEX_HOME: codexHome }, codexBin: "codex", deadline: Date.now() + 1000 };
  for (const [stage, review] of [["collection_images", false], ["collection_image_review", true]] as const) {
    const task = { stage, folder: "/state/collections/pets", collection: { slug: "pets", name: "Pets" }, revision: false, feedback: "", approved: [], attemptDir: "/state/.stages/pets/x/1" };
    const policy = wikiCodexStageArgs(options, task, { provider: "codex", model: "gpt-6-luna", effort: "max", timeoutMs: 1000 }, "p").find(arg => arg.startsWith("permissions.bloxodes_wiki_stage.filesystem="))!;
    // A parent deny would hide the sandbox helper under packages/, so CODEX_HOME is denied per entry.
    assert.ok(policy.includes(`${JSON.stringify(path.join(codexHome, "auth.json"))} = "deny"`));
    assert.ok(!policy.includes(`${JSON.stringify(codexHome)} = "deny"`));
    assert.ok(!policy.includes(`${JSON.stringify(path.join(codexHome, "packages"))} = "deny"`));
    assert.equal(policy.includes('"/etc" = "read"'), !review);
    assert.ok(policy.includes('"/etc/bloxodes" = "deny"'));
  }
});
test("ownership catches reviewer edits, sibling changes and writing changes to data or the original draft", () => {
  const task = { stage: "collection_editorial_review" as const, folder: "/state/collections/pets", revision: false, feedback: "", approved: [], attemptDir: "/state/.stages/pets/1" };
  assert.throws(() => assertWikiOwnership({ "collections/pets/draft-final.json": "before" }, { "collections/pets/draft-final.json": "after" }, task, "/state"), /outside its ownership/);
  const revision = { ...task, stage: "collection_writing" as const, revision: true };
  assert.doesNotThrow(() => assertWikiOwnership({}, { "collections/pets/final.json": "new" }, revision, "/state"));
  for (const file of ["collections/pets/draft-final.json", "collections/pets/dataset.json", "collections/units/final.json", ".stages/state.json"]) assert.throws(() => assertWikiOwnership({ [file]: "old" }, { [file]: "new" }, revision, "/state"));
});


test("decisions distinguish unresolved findings from accepted image omissions", () => {
  const completed = { status: "completed", summary: "Approved.", findings: [], repair_stage: null };
  assert.throws(() => parseWikiDecision({ ...completed, repair_stage: "data" }, "collection_data_review"), /cannot request repairs/);
  assert.throws(() => parseWikiDecision({ ...completed, findings: ["Wrong costs."] }, "collection_data_review"), /unresolved findings/);
  assert.doesNotThrow(() => parseWikiDecision({ ...completed, accepted_missing: ["cat"] }, "collection_image_review"));
  assert.doesNotThrow(() => parseWikiDecision({ ...completed, status: "needs_revision", findings: ["Wrong costs."], repair_stage: "data" }, "collection_data_review"));
});

test("readiness uses the actual named stage policy without model generation or legacy flags", () => {
  const task = { stage: "collection_images" as const, folder: "/state/collections/pets", revision: false, feedback: "", approved: [], attemptDir: "/state/.stages/probe" };
  const options = { worktree: "/repo", root: "/state", identity, env: { HOME: "/model" }, codexBin: "codex", deadline: Date.now() + 1000 };
  const args = wikiStageSandboxProbeArgs(options, task, "/state/collections/pets/probe.cjs");
  assert.equal(args[0], "sandbox");
  assert.ok(args.includes('default_permissions="bloxodes_wiki_stage"'));
  const policy = args.find(arg => arg.startsWith("permissions.bloxodes_wiki_stage.filesystem="))!;
  assert.ok(policy.includes('"/state/collections/pets" = { "." = "write"'));
  assert.ok(policy.includes('"**/.env*" = "deny"'));
  assert.ok(policy.includes('"**/.aws/**" = "deny"'));
  assert.ok(!args.includes("--sandbox"));
  assert.ok(!args.includes("--model"));
  assert.ok(!args.includes("--approve-for-me"));
  assert.deepEqual(args.slice(-3), ["--", process.execPath, "/state/collections/pets/probe.cjs"]);
});

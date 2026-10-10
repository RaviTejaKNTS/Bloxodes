import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { executeWikiModelStage, WikiOwnershipError } from "../wiki-stage-runtime";

const done = { status: "completed", summary: "Approved.", findings: [], repair_stage: null };
async function fixture(t: any) {
  const root = await mkdtemp(path.join(os.tmpdir(), "wiki-provider-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const folder = path.join(root, "collections/pets");
  const attemptDir = path.join(root, ".stages/pets/writing/1");
  await mkdir(folder, { recursive: true });
  return { root, folder, attemptDir, options: { root, worktree: "/repo", identity: { id: "queue", game_name: "Game", wiki_slug: "game", universe_id: 1, root_place_id: 2 }, env: { HOME: "/model", CLAUDE_CODE_OAUTH_TOKEN: "oauth", SUPABASE_SERVICE_ROLE: "secret" }, codexBin: "codex", deadline: Date.now() + 60_000 }, task: { stage: "collection_writing" as const, folder, attemptDir, revision: false, feedback: "", approved: [] } };
}
test("missing Claude, auth, quota and unavailable models fall back and record both attempts", async t => {
  for (const failure of ["Could not launch claude: ENOENT", "401 unauthorized", "429 rate limit", "unknown model"]) {
    const f = await fixture(t); const providers: string[] = [];
    const result = await executeWikiModelStage({ ...f.options, runCommand: async command => {
      assert.equal(command.env.SUPABASE_SERVICE_ROLE, undefined);
      assert.equal(command.env.CLAUDE_CODE_OAUTH_TOKEN, command.bin === "codex" ? undefined : "oauth");
      providers.push(command.bin);
      if (command.bin !== "codex") {
        if (failure.includes("ENOENT")) throw new Error(failure);
        return { code: 1, stdout: JSON.stringify({ is_error: true, errors: [failure] }), stderr: "", tail: "" };
      }
      assert.equal(command.args[command.args.indexOf("--model") + 1], "gpt-6-luna");
      await writeFile(path.join(f.attemptDir, "response.json"), JSON.stringify(done));
      return { code: 0, stdout: "", stderr: "", tail: "" };
    } }, f.task);
    assert.equal(result.status, "completed"); assert.equal(providers.length, 2);
    const attempts = JSON.parse(await readFile(path.join(f.attemptDir, "model-attempts.json"), "utf8"));
    assert.equal(attempts[0].model, "claude-haiku-5-5"); assert.equal(attempts[1].model, "gpt-6-luna");
    assert.ok(attempts[1].fallback_reason);
  }
});
test("successful Claude structured output retains usage and never falls back for source 429 text", async t => {
  const f = await fixture(t); let calls = 0;
  await executeWikiModelStage({ ...f.options, runCommand: async () => { calls++; return { code: 0, stdout: JSON.stringify({ structured_output: done, result: "Source HTTP 429", usage: { output_tokens: 12 }, modelUsage: { "claude-haiku-5-5": {} } }), stderr: "Source HTTP 429", tail: "" }; } }, f.task);
  assert.equal(calls, 1);
  const attempts = JSON.parse(await readFile(path.join(f.attemptDir, "model-attempts.json"), "utf8"));
  assert.equal(attempts[0].usage.output_tokens, 12);
});
test("a Claude reviewer cannot edit a brief or code-owned state even on provider failure", async t => {
  const f = await fixture(t); let calls = 0;
  await writeFile(path.join(f.folder, "brief.md"), "Original.");
  await assert.rejects(executeWikiModelStage({ ...f.options, runCommand: async command => {
    calls++;
    assert.equal(command.args[command.args.indexOf("--tools") + 1], "Read,Grep,Glob,WebFetch,WebSearch");
    await writeFile(path.join(f.folder, "brief.md"), "Changed.");
    return { code: 1, stdout: JSON.stringify({ is_error: true, errors: ["quota"] }), stderr: "", tail: "" };
  } }, { ...f.task, stage: "collection_research_review" }), WikiOwnershipError);
  assert.equal(calls, 1);
});
test("image workers can wire media but cannot change approved public values", async t => {
  const f = await fixture(t);
  await writeFile(path.join(f.folder, "dataset.json"), JSON.stringify({ meta: { schemaVersion: 2 }, items: [{ item: { cost: 1 }, system: { slug: "cat", image: null } }] }));
  await assert.rejects(executeWikiModelStage({ ...f.options, runCommand: async () => {
    await writeFile(path.join(f.folder, "dataset.json"), JSON.stringify({ meta: { schemaVersion: 2 }, items: [{ item: { cost: 99 }, system: { slug: "cat", image: null } }] }));
    await writeFile(path.join(f.attemptDir, "response.json"), JSON.stringify(done));
    return { code: 0, stdout: "", stderr: "", tail: "" };
  } }, { ...f.task, stage: "collection_images" }), /changed approved rows/);
});

test("a reviewer cannot change code-owned stage state", async t => {
  const f = await fixture(t);
  await mkdir(path.join(f.root, ".stages"), { recursive: true });
  await writeFile(path.join(f.root, ".stages/state.json"), "{}");
  await assert.rejects(executeWikiModelStage({ ...f.options, runCommand: async () => {
    await writeFile(path.join(f.root, ".stages/state.json"), '{"changed":true}');
    return { code: 0, stdout: JSON.stringify({ structured_output: done }), stderr: "", tail: "" };
  } }, { ...f.task, stage: "collection_research_review" }), WikiOwnershipError);
});

import assert from "node:assert/strict";
import test from "node:test";

import {
  PI_WRITER_MODEL,
  PI_WRITER_REASONING,
  PI_WRITER_SYSTEM_PROMPT,
  assertArticleWorkspace,
  assertLunaMaxConfiguration,
  assertPiVersion,
  buildPiWriterArgs,
  buildPiWriterPrompt,
  parsePiWriterSkill
} from "../pi-article-writer";

test("Pi writer uses the minimal article handoff and no source detail", () => {
  const skill = parsePiWriterSkill(".agents/skills/bloxodes-tier-list-writing/SKILL.md");
  const prompt = buildPiWriterPrompt({
    skill,
    title: "Runaways class tier list",
    slug: "runaways-best-class-tier-list",
    type: "tier-list",
    workspace: "/srv/bloxodes/tmp/content-workspace/runaways/articles/runaways-best-class-tier-list"
  });
  assert.equal(prompt.split("\n").length, 2);
  assert.equal(prompt.startsWith("Skill: "), true);
  assert.equal(prompt.includes("source"), false);
  assert.equal(prompt.includes("ranking"), false);
  assert.doesNotThrow(() => JSON.parse(prompt.split("\n")[1].slice("Article: ".length)));
});

test("Pi writer is isolated and pinned to Luna max", () => {
  const skill = parsePiWriterSkill(".agents/skills/bloxodes-article-writing/SKILL.md");
  const args = buildPiWriterArgs({ repoRoot: "/srv/bloxodes", skill, prompt: "Skill: x\nArticle: y" });
  assert.ok(args.includes("--no-context-files"));
  assert.ok(args.includes("--no-extensions"));
  assert.ok(args.includes("--no-session"));
  assert.ok(args.includes("--no-approve"));
  assert.equal(args[args.indexOf("--model") + 1], PI_WRITER_MODEL);
  assert.equal(args[args.indexOf("--thinking") + 1], PI_WRITER_REASONING);
  assert.equal(args[args.indexOf("--tools") + 1], "read,write,edit,grep,find,ls");
  assert.ok(PI_WRITER_SYSTEM_PROMPT.includes("never invent first-hand experience"));
  assert.ok(PI_WRITER_SYSTEM_PROMPT.includes("Never mention sources"));
});

test("Pi and parent configuration reject any model or effort downgrade", () => {
  assert.doesNotThrow(() => assertLunaMaxConfiguration("gpt-5.6-luna", "max", "test"));
  assert.throws(() => assertLunaMaxConfiguration("gpt-5.6-luna", "xhigh", "test"));
  assert.throws(() => assertLunaMaxConfiguration("gpt-5.5", "max", "test"));
});

test("Pi version gate requires max-reasoning support", () => {
  assert.equal(assertPiVersion("0.84.3\n"), "0.84.3");
  assert.equal(assertPiVersion("pi 0.90.1"), "0.90.1");
  assert.throws(() => assertPiVersion("0.74.0"));
  assert.throws(() => assertPiVersion("unknown"));
});

test("Pi workspace must be an article content workspace", () => {
  assert.equal(
    assertArticleWorkspace("/srv/bloxodes", "/srv/bloxodes/tmp/content-workspace/game/articles/slug"),
    "/srv/bloxodes/tmp/content-workspace/game/articles/slug"
  );
  assert.throws(() => assertArticleWorkspace("/srv/bloxodes", "/srv/bloxodes"));
  assert.throws(() => assertArticleWorkspace("/srv/bloxodes", "/tmp/outside"));
});

import assert from "node:assert/strict";
import test from "node:test";
import { buildClaudeStageArgs, parseClaudeEffort, parseHeadlessResult, headlessProviderErrors } from "../claude-stage-runner";

const decision = { status: "completed", summary: "Reviewed the evidence.", findings: [], repair_stage: null, accepted_missing: [] };
const options = { workspace: "/state/run/content", readDirectories: ["/repo/.agents/skills", "/state/run"], model: "claude-haiku-5-5", effort: "xhigh" as const, schema: { type: "object" }, prompt: "Return only JSON." };

test("Claude review keeps OAuth and exposes read-only tools including image Read", () => {
  const args = buildClaudeStageArgs({ ...options, review: true });
  for (const flag of ["-p", "--json-schema", "--no-session-persistence", "--strict-mcp-config", "--restricted"]) assert.ok(args.includes(flag));
  assert.ok(!args.includes("--bare"));
  assert.equal(args[args.indexOf("--output-format") + 1], "json");
  assert.equal(args[args.indexOf("--effort") + 1], "xhigh");
  assert.equal(args[args.indexOf("--tools") + 1], "Read,Grep,Glob,WebFetch,WebSearch");
  assert.equal(args[args.indexOf("--permission-mode") + 1], "dontAsk");
  const denied = args[args.indexOf("--disallowedTools") + 1].split(",");
  for (const tool of ["Agent", "Task", "Bash", "Write", "Edit"]) assert.ok(denied.includes(tool));
  assert.equal(args[args.indexOf("--mcp-config") + 1], '{"mcpServers":{}}');
  // Reads are scoped to the workspace and added roots, never a blanket Read/Grep/Glob grant.
  const allowed = args[args.indexOf("--allowedTools") + 1].split(",");
  for (const rule of ["Read(//state/run/content/**)", "Read(//repo/.agents/skills/**)", "Read(//state/run/**)"]) assert.ok(allowed.includes(rule), rule);
  for (const blanket of ["Read", "Grep", "Glob"]) assert.ok(!allowed.includes(blanket), blanket);
  const deny = JSON.parse(args[args.indexOf("--settings") + 1]).permissions.deny;
  for (const rule of ["Read(//**/.ssh/**)", "Read(//**/.config/gh/**)", "Read(//proc/**)"]) assert.ok(deny.includes(rule), rule);
});

test("Claude writing grants Write/Edit only under the workspace and disables hooks", () => {
  const args = buildClaudeStageArgs({ ...options, review: false });
  const allowed = args[args.indexOf("--allowedTools") + 1];
  assert.ok(allowed.includes("Edit(//state/run/content/**)"));
  assert.ok(!allowed.includes("Write("));
  assert.ok(!allowed.split(",").includes("Write"));
  assert.ok(!allowed.includes("Write(//repo"));
  const settings = JSON.parse(args[args.indexOf("--settings") + 1]);
  assert.equal(settings.disableAllHooks, true);
  assert.ok(settings.permissions.deny.includes("Read(//**/.envs/**)"));
});

test("headless parsing accepts Claude snake-case and Grok camel-case with token usage", () => {
  for (const key of ["structured_output", "structuredOutput"]) {
    const result = parseHeadlessResult(JSON.stringify({ [key]: decision, usage: { input_tokens: 12, output_tokens: 4 }, modelUsage: { "grok-4.7-build": { outputTokens: 4 } }, result: "Unstructured provider prose." }));
    assert.deepEqual(result.decision, decision);
    assert.equal(result.usage.input_tokens, 12);
  }
  assert.throws(() => parseHeadlessResult('{"result":"I saved a decision file"}'));
  assert.throws(() => parseHeadlessResult('{"is_error":true,"errors":["401 unauthorized"]}'), /unauthorized/);
  assert.equal(headlessProviderErrors('{"result":"Source HTTP 429","is_error":false}'), "");
  assert.match(headlessProviderErrors('{"is_error":true,"errors":["rate limit"]}'), /rate limit/);
  assert.equal(parseClaudeEffort("xhigh"), "xhigh");
  assert.throws(() => parseClaudeEffort("none"));
});

import assert from "node:assert/strict";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { parseClaudePrintResult, runClaudePrint, stripJsonFence } from "../claude-print-runner";

const success = (result: string) => JSON.stringify({ type: "result", subtype: "success", is_error: false, result });

test("print results keep plain text and unwrap fenced article JSON for validation", () => {
  const article = { intro_md: "Intro", redeem_md: "Steps" };
  for (const text of [JSON.stringify(article), `\n\`\`\`json\n${JSON.stringify(article)}\n\`\`\`\n`]) {
    assert.deepEqual(JSON.parse(stripJsonFence(parseClaudePrintResult(success(text)))), article);
  }
  assert.equal(parseClaudePrintResult(success("Alternative [Game codes](/codes/game).")), "Alternative [Game codes](/codes/game).");
  assert.throws(() => JSON.parse(stripJsonFence("not JSON")));
});

test("print results reject provider errors, turn limits, invalid envelopes and empty text", () => {
  assert.throws(() => parseClaudePrintResult('{"is_error":true,"errors":["rate limited"]}'), /rate limited/);
  assert.throws(() => parseClaudePrintResult('{"type":"result","subtype":"error_max_turns","is_error":true}'), /error_max_turns/);
  assert.throws(() => parseClaudePrintResult('{"result":"text"}'), /Unexpected/);
  assert.throws(() => parseClaudePrintResult(success("  ")), /empty text/);
  assert.throws(() => parseClaudePrintResult("not JSON"));
});

async function withFakeCli(source: string, action: (bin: string) => Promise<void>) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "bloxodes-claude-print-"));
  const bin = path.join(dir, "claude.cjs");
  try {
    await writeFile(bin, `#!/usr/bin/env node\n${source}`);
    await chmod(bin, 0o700);
    await action(bin);
  } finally { await rm(dir, { recursive: true, force: true }); }
}

const options = { prompt: "source excerpt", systemPrompt: "Write alternatives.", model: "claude-haiku-5-5", effort: "xhigh" as const, timeoutMs: 5000 };

test("print runner passes both auth methods, strips DB secrets and disables all tools", async () => {
  await withFakeCli(`
    let prompt = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", chunk => prompt += chunk);
    process.stdin.on("end", () => console.log(JSON.stringify({ type: "result", subtype: "success", result: JSON.stringify({
      args: process.argv.slice(2), prompt, api: Boolean(process.env.ANTHROPIC_API_KEY),
      oauth: Boolean(process.env.CLAUDE_CODE_OAUTH_TOKEN), db: process.env.SUPABASE_SERVICE_ROLE,
      maxOutput: process.env.CLAUDE_CODE_MAX_OUTPUT_TOKENS
    }) })));
  `, async bin => {
    for (const auth of [{ ANTHROPIC_API_KEY: "test-api" }, { CLAUDE_CODE_OAUTH_TOKEN: "test-oauth" }]) {
      const result = JSON.parse(await runClaudePrint({ ...options, bin, env: { PATH: process.env.PATH, ...auth, SUPABASE_SERVICE_ROLE: "never-pass" } }));
      assert.equal(result.prompt, options.prompt);
      assert.equal(result.db, undefined);
      assert.ok(result.api || result.oauth);
      assert.equal(result.maxOutput, "32000");
      for (const [flag, value] of [["--model", options.model], ["--effort", "xhigh"], ["--output-format", "json"], ["--max-turns", "1"], ["--tools", ""], ["--mcp-config", '{"mcpServers":{}}'], ["--system-prompt", options.systemPrompt]]) {
        assert.equal(result.args[result.args.indexOf(flag) + 1], value);
      }
      assert.ok(result.args.includes("--restricted"));
      assert.ok(result.args.includes("--strict-mcp-config"));
      assert.ok(!result.args.includes("--bare"));
    }
    const limited = JSON.parse(await runClaudePrint({ ...options, bin, maxOutputTokens: 8000, env: { PATH: process.env.PATH, ANTHROPIC_API_KEY: "test-api" } }));
    assert.equal(limited.maxOutput, "8000");
    await assert.rejects(runClaudePrint({ ...options, bin, maxOutputTokens: 0, env: { PATH: process.env.PATH, ANTHROPIC_API_KEY: "test-api" } }), /output limit must be a positive integer/);
  });
});

test("print runner surfaces CLI exits, redacts auth and enforces its deadline", async () => {
  const env = { PATH: process.env.PATH, ANTHROPIC_API_KEY: "test-secret" };
  await assert.rejects(runClaudePrint({ ...options, env: {} }), /requires ANTHROPIC_API_KEY or CLAUDE_CODE_OAUTH_TOKEN/);
  await withFakeCli('process.stdin.resume(); process.stdin.on("end", () => { console.error("auth " + process.env.ANTHROPIC_API_KEY); process.exit(2); });', async bin => {
    await assert.rejects(runClaudePrint({ ...options, bin, env }), /exited 2: auth \[redacted\]/);
  });
  await withFakeCli('process.stdin.resume(); setInterval(() => {}, 1000);', async bin => {
    await assert.rejects(runClaudePrint({ ...options, bin, env, timeoutMs: 100 }), /timed out after 100 ms/);
  });
});

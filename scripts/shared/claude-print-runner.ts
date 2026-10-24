import { spawn } from "node:child_process";
import { headlessProviderErrors, parseClaudeEffort, type ClaudeEffort } from "./claude-stage-runner";

export class ClaudePrintInterrupted extends Error {}

export function stripJsonFence(text: string): string {
  const trimmed = text.trim();
  return trimmed.match(/^```(?:json)?\s*\n([\s\S]*?)\n```\s*$/i)?.[1]?.trim() ?? trimmed;
}

export function parseClaudePrintResult(stdout: string): string {
  const body = JSON.parse(stdout);
  const errors = headlessProviderErrors(stdout);
  if (errors) throw new Error(`Claude CLI failed: ${errors.slice(-4000)}`);
  if (body?.type !== "result" || body.subtype !== "success" || typeof body.result !== "string") {
    throw new Error(`Unexpected Claude CLI result (type=${body?.type}, subtype=${body?.subtype}).`);
  }
  if (!body.result.trim()) throw new Error("Claude CLI returned empty text.");
  return body.result.trim();
}

// Text-only counterpart of the homelab article stage runner: same restricted
// print/JSON invocation and process-group timeout, with all tools disabled.
export async function runClaudePrint(options: {
  prompt: string; systemPrompt?: string; model: string; effort: ClaudeEffort;
  timeoutMs: number; env?: NodeJS.ProcessEnv; bin?: string;
}): Promise<string> {
  const env = options.env ?? process.env;
  if (!env.ANTHROPIC_API_KEY?.trim() && !env.CLAUDE_CODE_OAUTH_TOKEN?.trim()) {
    throw new Error("Claude CLI requires ANTHROPIC_API_KEY or CLAUDE_CODE_OAUTH_TOKEN.");
  }
  if (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0) throw new Error("Claude CLI timeout must be positive.");
  // Keep authentication, but never pass database, storage or publication secrets.
  const allowed = ["PATH", "HOME", "USER", "LOGNAME", "SHELL", "LANG", "LC_ALL", "TMPDIR", "TZ",
    "XDG_CONFIG_HOME", "XDG_CACHE_HOME", "HTTPS_PROXY", "HTTP_PROXY", "NO_PROXY", "NODE_EXTRA_CA_CERTS",
    "ANTHROPIC_API_KEY", "CLAUDE_CODE_OAUTH_TOKEN"];
  const workerEnv = Object.fromEntries(allowed.flatMap(key => env[key] ? [[key, env[key]]] : []));
  const args = ["-p", "--model", options.model, "--effort", parseClaudeEffort(options.effort),
    "--output-format", "json", "--max-turns", "1", "--no-session-persistence",
    "--strict-mcp-config", "--mcp-config", '{"mcpServers":{}}',
    "--restricted", "--safe-mode", "--no-chrome", "--disable-slash-commands",
    "--permission-mode", "dontAsk", "--permission-prompts", "none", "--tools", "",
    "--disallowedTools", "mcp__*", "--settings", '{"disableAllHooks":true}',
    ...(options.systemPrompt ? ["--system-prompt", options.systemPrompt] : [])];
  const redact = (text: string) => [env.ANTHROPIC_API_KEY, env.CLAUDE_CODE_OAUTH_TOKEN]
    .reduce((value, secret) => secret ? value.split(secret).join("[redacted]") : value, text);

  return new Promise((resolve, reject) => {
    const child = spawn(options.bin ?? "claude", args, {
      env: { ...workerEnv, CLAUDE_CODE_MAX_OUTPUT_TOKENS: "5000" },
      detached: process.platform !== "win32", stdio: ["pipe", "pipe", "pipe"]
    });
    let stdout = "", stderr = "", failure = "", finished = false, interrupted = false;
    let force: NodeJS.Timeout | undefined;
    const kill = (signal: NodeJS.Signals) => {
      try { if (process.platform !== "win32" && child.pid) process.kill(-child.pid, signal); else child.kill(signal); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error; }
    };
    const stop = (reason: string) => {
      if (failure) return;
      failure = reason;
      kill("SIGTERM");
      force = setTimeout(() => kill("SIGKILL"), 5_000);
      force.unref();
    };
    const abort = () => { interrupted = true; stop("Claude CLI interrupted by process signal."); };
    process.once("SIGTERM", abort); process.once("SIGINT", abort);
    const timer = setTimeout(() => stop(`Claude CLI timed out after ${options.timeoutMs} ms.`), options.timeoutMs);
    const cleanup = () => {
      finished = true;
      clearTimeout(timer); if (force) clearTimeout(force);
      process.off("SIGTERM", abort); process.off("SIGINT", abort);
    };
    child.stdout.on("data", data => {
      stdout += data.toString();
      if (stdout.length > 1_000_000) { stdout = stdout.slice(0, 1_000_000); stop("Claude CLI output exceeded 1 MB."); }
    });
    child.stderr.on("data", data => { stderr = (stderr + data.toString()).slice(-4000); });
    child.stdin.on("error", error => { stop(`Could not send prompt to Claude CLI: ${error.message}`); });
    child.on("error", error => {
      if (finished) return;
      cleanup(); reject(new Error(redact(`Could not launch Claude CLI: ${error.message}`)));
    });
    child.on("close", (code, signal) => {
      if (finished) return;
      if (failure) kill("SIGKILL");
      cleanup();
      if (interrupted) { reject(new ClaudePrintInterrupted(failure)); return; }
      try {
        if (failure) throw new Error(`${failure}${stderr ? ` ${stderr}` : ""}`);
        const errors = headlessProviderErrors(stdout);
        if (code !== 0) throw new Error(`Claude CLI exited ${code ?? signal}: ${errors || stderr || "no error details"}`);
        resolve(parseClaudePrintResult(stdout));
      } catch (error) { reject(new Error(redact(error instanceof Error ? error.message : String(error)))); }
    });
    // Source excerpts can exceed the OS argument-size limit. Send the unchanged
    // user prompt through stdin rather than placing it in the command line.
    child.stdin.end(options.prompt);
  });
}

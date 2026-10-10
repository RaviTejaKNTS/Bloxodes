import path from "node:path";

export const CLAUDE_EFFORTS = ["low", "medium", "high", "xhigh", "max"] as const;
export type ClaudeEffort = typeof CLAUDE_EFFORTS[number];

export function parseClaudeEffort(value: string): ClaudeEffort {
  if (CLAUDE_EFFORTS.includes(value as ClaudeEffort)) return value as ClaudeEffort;
  throw new Error(`Claude effort must be one of: ${CLAUDE_EFFORTS.join(", ")}.`);
}

// Restricted mode keeps OAuth, ignores local hooks/settings, and confines file tools.
// dontAsk plus path-scoped allow rules permits writes only in the assigned workspace.
export function buildClaudeStageArgs(options: {
  workspace: string; readDirectories: string[]; review: boolean;
  model: string; effort: ClaudeEffort; schema: unknown; prompt: string;
}): string[] {
  const readTools = ["Read", "Grep", "Glob", "WebFetch", "WebSearch"];
  const rule = (directory: string) => `//${path.resolve(directory).replace(/^\//, "")}/**`;
  // --restricted already confines file tools to the workspace and --add-dir roots.
  // Scoped Read rules (which also govern Grep and Glob) repeat that boundary.
  const readable = [options.workspace, ...options.readDirectories].map(directory => `Read(${rule(directory)})`);
  // Claude checks both Write and Edit paths against Edit rules, not Write(path).
  const writable = [`Edit(${rule(options.workspace)})`];
  return ["-p", options.prompt, "--model", options.model, "--effort", options.effort,
    "--output-format", "json", "--json-schema", JSON.stringify(options.schema),
    "--no-session-persistence", "--strict-mcp-config", "--mcp-config", '{"mcpServers":{}}',
    "--restricted", "--safe-mode", "--no-chrome", "--disable-slash-commands", "--permission-mode", "dontAsk",
    "--permission-prompts", "none", "--tools", [...readTools, ...(!options.review ? ["Write", "Edit"] : [])].join(","),
    "--allowedTools", [...readable, "WebFetch", "WebSearch", ...(!options.review ? writable : [])].join(","),
    "--disallowedTools", ["Task", "Agent", "Bash", "PowerShell", "REPL", "mcp__*", ...(options.review ? ["Write", "Edit"] : [])].join(","),
    ...options.readDirectories.flatMap(directory => ["--add-dir", path.resolve(directory)]),
    "--settings", JSON.stringify({ disableAllHooks: true, permissions: { deny: [
      "Read(//**/.env*)", "Read(//**/.envs/**)", "Read(//**/.claude/**)", "Read(//**/.codex/**)", "Read(//**/.aws/**)",
      "Read(//**/.ssh/**)", "Read(//**/.config/gh/**)", "Read(//**/.grok/**)", "Read(//**/.netrc)", "Read(//**/.git-credentials)",
      "Read(//etc/bloxodes/**)", "Read(//proc/**)"
    ] } })];
}

export type HeadlessResult = {
  decision: unknown; usage: Record<string, number>; modelUsage: Record<string, unknown>;
};

export function headlessResultMetadata(stdout: string): Omit<HeadlessResult, "decision"> {
  try {
    const body = JSON.parse(stdout);
    return { usage: body?.usage ?? {}, modelUsage: body?.modelUsage ?? {} };
  } catch { return { usage: {}, modelUsage: {} }; }
}

// Never extract JSON from prose. Claude and Grok use different envelope spellings.
export function parseHeadlessResult(stdout: string): HeadlessResult {
  const body = JSON.parse(stdout);
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Expected a structured provider result object.");
  if (body.is_error) throw new Error(`Headless provider failed: ${JSON.stringify(body.errors ?? body.result ?? body.subtype)}`);
  let decision = body.structured_output ?? body.structuredOutput ?? body.result ?? body;
  if (typeof decision === "string") decision = JSON.parse(decision);
  return { decision, usage: body.usage ?? {}, modelUsage: body.modelUsage ?? {} };
}

export function headlessProviderErrors(stdout: string): string {
  try {
    const body = JSON.parse(stdout);
    return body.is_error ? JSON.stringify(body.errors ?? body.result ?? body.subtype) : "";
  } catch { return ""; }
}

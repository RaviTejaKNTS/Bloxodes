// Keep initial runs, session resumes and deterministic readiness on the same policy.
export function wikiSandboxConfig(writableRoot: string): string[] {
  return ["--config", 'sandbox_mode="workspace-write"',
    "--config", "sandbox_workspace_write.network_access=true",
    "--config", `sandbox_workspace_write.writable_roots=${JSON.stringify([writableRoot])}`];
}

export function wikiCodexArgs(args: string[], writableRoot: string): string[] {
  return ["exec", "--sandbox", "workspace-write", "--add-dir", writableRoot,
    ...wikiSandboxConfig(writableRoot), "--config", 'approval_policy="never"',
    ...args.slice(1).filter(arg => arg !== "--ephemeral" && arg !== "--approve-for-me")];
}

export function isWikiTechnicalFailure(message: string): boolean {
  return /\b(?:ENOTFOUND|EAI_AGAIN|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EPERM|EACCES|EROFS|ENOENT)\b|bwrap:|sandbox|fetch failed|preview.*(?:bind|port|startup)|sitemap|publication.*(?:failed|timeout)|CLI.*(?:quota|usage limit)/i.test(message);
}

export function wikiFailureMessage(rootCause: string, fallback: string): string {
  // JSONL command results can be large; retain the causal sandbox/network error.
  const matches = rootCause.match(/bwrap:[^\n"\\]+|(?:ENOTFOUND|EAI_AGAIN|EPERM|EACCES|EROFS)[^\n"\\]*/g);
  return matches?.length ? `${matches.slice(-3).join("; ")}. ${fallback}` : fallback;
}

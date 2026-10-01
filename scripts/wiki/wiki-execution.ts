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

export function wikiSandboxProbeArgs(writableRoot: string, help: string): string[] {
  if (help.includes("--permission-profile")) {
    return ["sandbox", "--permission-profile", "wiki-readiness",
      "--config", 'permissions.wiki-readiness.extends=":workspace"',
      "--config", "permissions.wiki-readiness.network.enabled=true",
      "--config", `permissions.wiki-readiness.filesystem={${JSON.stringify(writableRoot)}="write"}`];
  }
  return ["sandbox", ...(/Commands:[\s\S]*\blinux\b/.test(help) ? ["linux"] : []), ...wikiSandboxConfig(writableRoot)];
}

export function isWikiTechnicalFailure(message: string): boolean {
  return /\b(?:ENOTFOUND|EAI_AGAIN|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EPERM|EACCES|EROFS|ENOENT)\b|bwrap:|sandbox|fetch failed|preview.*(?:bind|port|startup)|sitemap|publication.*(?:failed|timeout)|CLI.*(?:quota|usage limit)|(?:Browser|Chromium).*(?:no available backend|unavailable|could not start)|registry-only.*(?:unregistered|cannot recognize)/i.test(message);
}

export const WIKI_RENDERED_PREVIEW_GUIDANCE = "Prefer the product-native collaborative Browser: check preview_status and, when needed, preview_open. If those tools are absent or explicitly report unsupported/unavailable, use headless Chrome/Chromium through Playwright (scripts/content/article-browser.ts exports launchArticleBrowser). Still render the hub and each approved collection at desktop and mobile widths; check headings, metadata/canonical, images, pagination and controls, and save screenshots/DOM findings under the artifact root. Do not waive rendered QA or block solely because the interactive Browser backend is unavailable. npm run verify:wiki-final now accepts task-local unregistered games and syncs the exact final.json to managed development; do not use the old registry-only seed command.";

export function wikiFailureMessage(rootCause: string, fallback: string): string {
  // JSONL command results can be large; retain the causal sandbox/network error.
  const matches = rootCause.match(/bwrap:[^\n"\\]+|(?:ENOTFOUND|EAI_AGAIN|EPERM|EACCES|EROFS)[^\n"\\]*/g);
  return matches?.length ? `${matches.slice(-3).join("; ")}. ${fallback}` : fallback;
}

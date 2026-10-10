import { readdirSync, realpathSync } from "node:fs";
import path from "node:path";

function resolved(file: string) {
  try { return realpathSync(file); } catch { return path.resolve(file); }
}

function codexHomeEntries(codexHome: string): string[] {
  try { return readdirSync(codexHome).filter(entry => entry !== "packages"); } catch { return []; }
}

/** Restrict model-generated commands without hiding credentials from the trusted CLI/controller. */
export function articleModelPermissionArgs(options: {
  worktree: string; runDir: string; codexBin: string; env: NodeJS.ProcessEnv;
}, review: boolean, baseline?: string): string[] {
  const root = resolved(options.worktree || process.cwd());
  const workspace = resolved(path.join(options.runDir, "content"));
  const home = options.env.HOME;
  const filesystem: Record<string, string | Record<string, string>> = {
    ":minimal": "read",
    [root]: "read",
    [resolved(options.runDir)]: "read",
    [workspace]: review ? "read" : "write",
    // Nested rules keep copied/symlinked env files out of otherwise readable guidance.
    ["/etc/bloxodes"]: "deny",
    ["/proc"]: "deny",
    ["/srv/data/projects/Bloxodes/.envs"]: "deny",
    [resolved(path.join(root, ".envs"))]: "deny",
  };
  for (const directory of [root, workspace]) {
    // Use a scoped rule so scanning never traverses the entire host filesystem.
    filesystem[directory] = { ".": directory === workspace && !review ? "write" : "read", "**/.env*": "deny", "**/.envs/**": "deny", "**/.codex/**": "deny", "**/.claude/**": "deny", "**/.aws/**": "deny", "**/.ssh/**": "deny" };
  }
  if (baseline) filesystem[resolved(baseline)] = { ".": "read", "**/.env*": "deny", "**/.envs/**": "deny" };
  if (home) for (const directory of [".claude", ".aws", ".ssh", ".config/gh", ".grok"]) filesystem[resolved(path.join(home, directory))] = "deny";
  // The sandbox helper itself lives under CODEX_HOME/packages, and a parent deny
  // overrides nested reads, so deny every other CODEX_HOME entry one by one.
  const codexHome = options.env.CODEX_HOME || (home ? path.join(home, ".codex") : "");
  if (codexHome) for (const entry of codexHomeEntries(codexHome)) filesystem[resolved(path.join(codexHome, entry))] = "deny";
  if (!review) {
    // Networked stages need the resolver and CA store, plus headless Chrome for
    // image inspection. /etc/bloxodes stays denied by its more specific rule.
    for (const input of ["/etc", "/run/systemd/resolve", "/opt/google"]) filesystem[input] = "read";
    if (home) for (const cache of [".cache/ms-playwright", ".npm"]) filesystem[resolved(path.join(home, cache))] = "read";
  }
  // Packaged helpers are executable inputs. Reopen only their files and resources,
  // never the auth/config files beside CODEX_HOME.
  if (options.codexBin && path.isAbsolute(options.codexBin)) {
    const binDir = path.dirname(resolved(options.codexBin));
    filesystem[resolved(options.codexBin)] = "read";
    filesystem[path.join(binDir, "codex-code-mode-host")] = "read";
    if (path.basename(binDir) === "bin") for (const name of ["codex-resources", "codex-path"]) filesystem[path.join(path.dirname(binDir), name)] = "read";
  }
  const toml = (value: Record<string, unknown>): string => `{ ${Object.entries(value).map(([key, item]) => `${JSON.stringify(key)} = ${typeof item === "object" && item !== null ? toml(item as Record<string, unknown>) : JSON.stringify(item)}`).join(", ")} }`;
  return [
    "--ignore-user-config", "--ignore-rules", "--strict-config",
    "--config", 'default_permissions="bloxodes_article"',
    "--config", `permissions.bloxodes_article.filesystem=${toml({ ...filesystem, glob_scan_max_depth: 16 })}`,
    "--config", `permissions.bloxodes_article.network.enabled=${!review}`,
    "--config", 'approval_policy="never"',
    "--config", "allow_login_shell=false",
  ];
}

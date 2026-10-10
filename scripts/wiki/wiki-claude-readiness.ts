import { access, mkdtemp, rm } from "node:fs/promises";
import { constants } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { wikiClaudeBin } from "./wiki-stage-config";
import { wikiWorkerEnvironment } from "./wiki-stage-runtime";

// No model generation. Run as the service user inside its unit to prove filesystem access.
export async function checkWikiClaudeAvailability(env: NodeJS.ProcessEnv): Promise<{ available: boolean; message: string }> {
  const bin = wikiClaudeBin(env);
  const home = env.HOME;
  try {
    if (!home) throw new Error("Model HOME is missing.");
    if (bin.includes("/")) await access(bin, constants.X_OK);
    const canary = await mkdtemp(path.join(home, ".claude-readiness-"));
    await rm(canary, { recursive: true });
    const workerEnv = wikiWorkerEnvironment(env);
    const version = spawnSync(bin, ["--version"], { env: workerEnv, encoding: "utf8", timeout: 15_000 });
    if (version.status !== 0) throw new Error(`Claude executable cannot start${version.error ? `: ${version.error.message}` : "."}`);
    if (env.CLAUDE_CODE_OAUTH_TOKEN?.trim()) return { available: true, message: `${bin} executes and HOME is writable; OAuth token configured. Token validity, quota and model access are checked on the first stage.` };
    const auth = spawnSync(bin, ["auth", "status", "--json"], { env: workerEnv, encoding: "utf8", timeout: 15_000 });
    let loggedIn = false;
    try { loggedIn = JSON.parse(auth.stdout).loggedIn === true; } catch { /* Missing login or unsupported CLI auth probe. */ }
    if (auth.status !== 0 || !loggedIn) throw new Error("No Claude login or CLAUDE_CODE_OAUTH_TOKEN is configured for the model user.");
    return { available: true, message: `${bin} executes, HOME is writable and Claude reports a login. Quota and model access are checked on the first stage.` };
  } catch (error) {
    return { available: false, message: `${error instanceof Error ? error.message : error} Claude stages will fall back to Codex gpt-6-luna at max.` };
  }
}

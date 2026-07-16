import "../shared/load-env";

import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { existsSync, mkdirSync, rmSync, symlinkSync } from "node:fs";
import { dirname, resolve } from "node:path";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const port = Number(process.env.CANDIDATE_PORT || "3100");
const baseUrl = process.env.CANDIDATE_BASE_URL || `http://127.0.0.1:${port}`;
const canonicalOrigin = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://bloxodes.com";

function run(script: string, args: string[] = [], env: NodeJS.ProcessEnv = {}) {
  console.log(`\n[candidate] npm run ${script}${args.length ? ` -- ${args.join(" ")}` : ""}`);
  const result = spawnSync(npm, ["run", script, ...(args.length ? ["--", ...args] : [])], {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
    stdio: "inherit"
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${script} failed with exit code ${result.status}`);
}

function stageStandaloneAssets() {
  const root = process.cwd();
  const standaloneRoot = resolve(root, "apps/web/.next/standalone");
  const serverPath = resolve(standaloneRoot, "apps/web/server.js");
  if (!existsSync(serverPath)) throw new Error(`Standalone candidate is missing: ${serverPath}`);

  // Next intentionally omits public/static payloads from the standalone folder.
  // Docker copies these paths into the image; local verification uses symlinks so
  // it exercises the same server layout without duplicating the large public tree.
  const links = [
    [resolve(root, "apps/web/public"), resolve(standaloneRoot, "apps/web/public")],
    [resolve(root, "apps/web/.next/static"), resolve(standaloneRoot, "apps/web/.next/static")],
    [resolve(root, "data"), resolve(standaloneRoot, "data")]
  ] as const;

  for (const [source, destination] of links) {
    if (!existsSync(source)) throw new Error(`Candidate asset source is missing: ${source}`);
    rmSync(destination, { recursive: true, force: true });
    mkdirSync(dirname(destination), { recursive: true });
    symlinkSync(source, destination, "dir");
  }

  return serverPath;
}

async function waitForHealth(server: ChildProcess) {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Candidate server exited early with ${server.exitCode}`);
    try {
      const response = await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(2_000) });
      if (response.ok) return;
    } catch {
      // The server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Candidate server did not become healthy at ${baseUrl}`);
}

async function main() {
  if (!Number.isSafeInteger(port) || port < 1024 || port > 65_535) throw new Error("Invalid CANDIDATE_PORT");
  run("verify:build");
  const serverPath = stageStandaloneAssets();

  const server = spawn(process.execPath, [serverPath], {
    cwd: process.cwd(),
    env: { ...process.env, HOSTNAME: "127.0.0.1", PORT: String(port) },
    stdio: "inherit",
    detached: process.platform !== "win32"
  });

  const stop = async () => {
    if (server.exitCode !== null) return;
    if (process.platform !== "win32" && server.pid) process.kill(-server.pid, "SIGTERM");
    else server.kill("SIGTERM");
    await Promise.race([
      once(server, "exit"),
      new Promise((resolveStop) => setTimeout(resolveStop, 5_000))
    ]);
    if (server.exitCode === null) {
      if (process.platform !== "win32" && server.pid) process.kill(-server.pid, "SIGKILL");
      else server.kill("SIGKILL");
      await once(server, "exit");
    }
  };

  try {
    await waitForHealth(server);
    const env = {
      TEST_BASE_URL: baseUrl,
      SEO_AUDIT_FETCH_ORIGIN: baseUrl,
      SITE_URL: canonicalOrigin,
      PLAYWRIGHT_SKIP_WEBSERVER: "1"
    };
    run("test:sitemaps", [], env);
    run("test:seo", [], env);
    run("test:routes", [], env);
    run("test:render", [], env);
  } finally {
    await stop();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});

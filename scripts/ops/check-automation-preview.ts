import "../shared/load-env";
import { spawn, spawnSync } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { resolveWikiDevCredentials } from "../wiki/wiki-automation-env";

// Exercise Next's generated-file writes under the real restricted service sandbox.
// No model, content mutation, or publication is involved.
async function main() {
  const root = process.cwd();
  const port = 3199;
  const dev = resolveWikiDevCredentials();
  await new Promise<void>((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", reject);
    probe.listen(port, "127.0.0.1", () => probe.close(error => error ? reject(error) : resolve()));
  });
  const child = spawn(process.execPath, [path.join(root, "node_modules/next/dist/bin/next"), "dev", "--webpack", "--hostname", "127.0.0.1", "--port", String(port)], {
    cwd: path.join(root, "apps/web"), detached: true, stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, NEXT_DIST_DIR: ".next", NODE_ENV: "development", BLOXODES_ENV_PROFILE: "process-only",
      SUPABASE_URL: dev.url, SUPABASE_SERVICE_ROLE: dev.serviceRole, NEXT_PUBLIC_SUPABASE_URL: dev.url }
  });
  let startupError: Error | undefined;
  child.on("error", error => { startupError = error; });
  // Drain output without logging environment-bearing framework diagnostics.
  child.stdout.resume(); child.stderr.resume();
  try {
    let ready = false;
    const deadline = Date.now() + 120_000;
    while (Date.now() < deadline) {
      if (startupError) throw startupError;
      if (child.exitCode !== null) throw new Error(`Restricted preview exited ${child.exitCode}.`);
      try { if ((await fetch(`http://127.0.0.1:${port}/favicon.ico`, { signal: AbortSignal.timeout(3000) })).ok) { ready = true; break; } } catch { /* startup */ }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    if (!ready) throw new Error("Restricted preview startup timed out.");
    const page = await fetch(`http://127.0.0.1:${port}/wiki`, { signal: AbortSignal.timeout(90_000) });
    if (!page.ok) throw new Error(`Restricted wiki preview returned HTTP ${page.status}.`);
    await page.text();
  } finally {
    if (child.pid) {
      try { process.kill(-child.pid, "SIGTERM"); } catch { /* already stopped */ }
      await new Promise(resolve => setTimeout(resolve, 2000));
      try { process.kill(-child.pid, "SIGKILL"); } catch { /* already stopped */ }
    }
  }
  const status = spawnSync("git", ["-c", `safe.directory=${root}`, "status", "--porcelain"], { encoding: "utf8" });
  if (status.status !== 0 || status.stdout.trim()) throw new Error("Restricted preview did not preserve the clean release checkout.");
  console.log("Restricted wiki preview returned HTTP 200 and preserved the clean release checkout.");
}
main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });

import "../shared/load-env";
import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { resolveArticleDevCredentials } from "./article-queue-env";
import { parseCodexReasoningEffort } from "./article-writer-provider";
import { runArticlePipeline, saveJson, STAGES, type ArticleJob } from "./article-pipeline";
import { executeArticleStage, type StageRuntimeOptions } from "./article-stage-runtime";
import { writeArticleRunReport } from "./article-run-report";

export function validateJob(value: unknown): ArticleJob {
  const job = value as ArticleJob;
  if (!job || typeof job.id !== "string" || !/^[a-zA-Z0-9_-]+$/.test(job.id) || typeof job.title !== "string" || !job.title.trim() ||
      typeof job.slug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(job.slug) || typeof job.article_type !== "string" || !job.article_type.trim() ||
      (job.refresh !== undefined && typeof job.refresh !== "boolean") || job.sources == null) throw new Error("Job requires id, title, safe article slug, article_type, sources, and an optional boolean refresh.");
  return job;
}
export function managedArticleEnvironment(dev: { url: string; serviceRole: string }): NodeJS.ProcessEnv {
  return { ...process.env, SUPABASE_URL: dev.url, SUPABASE_SERVICE_ROLE: dev.serviceRole, SUPABASE_SERVICE_ROLE_KEY: dev.serviceRole,
    NEXT_PUBLIC_SUPABASE_URL: dev.url, ARTICLE_DEV_SUPABASE_URL: dev.url, ARTICLE_DEV_SUPABASE_SERVICE_ROLE: dev.serviceRole,
    ARTICLE_WRITER_DEV_ONLY: "true", ARTICLE_WRITER_BATCH_CONTEXT: "1", BLOXODES_ENV_PROFILE: "process-only", NODE_ENV: "production" };
}
export async function withArticlePreview<T>(worktree: string, env: NodeJS.ProcessEnv, suppliedUrl: string | undefined, work: (baseUrl: string) => Promise<T>): Promise<T> {
  if (suppliedUrl) {
    const url = new URL(suppliedUrl);
    if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname) && !url.hostname.endsWith(".ts.net") && !/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(url.hostname)) throw new Error("Article preview must use localhost or Tailscale, never production.");
    const response = await fetch(new URL("/favicon.ico", url), { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error(`Supplied preview is not ready: HTTP ${response.status}`);
    return work(suppliedUrl.replace(/\/$/, ""));
  }
  const port = Number(process.env.ARTICLE_PIPELINE_PREVIEW_PORT ?? "3100");
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("Invalid article preview port.");
  // Do not adopt an unknown service occupying the chosen port.
  const net = await import("node:net");
  await new Promise<void>((resolve, reject) => { const probe = net.createServer(); probe.once("error", reject); probe.listen(port, "0.0.0.0", () => probe.close(error => error ? reject(error) : resolve())); });
  const output = path.join(worktree, "tmp/article-pipeline");
  await mkdir(output, { recursive: true });
  const log = createWriteStream(path.join(output, "preview.log"), { flags: "a", mode: 0o600 });
  const child = spawn(process.execPath, [path.join(worktree, "node_modules/next/dist/bin/next"), "dev", "--webpack", "--hostname", "0.0.0.0", "--port", String(port)], {
    cwd: path.join(worktree, "apps/web"), env: { ...env, NODE_ENV: "development", NEXT_DIST_DIR: ".next-article-pipeline" }, detached: process.platform !== "win32", stdio: ["ignore", "pipe", "pipe"]
  });
  child.stdout.pipe(log); child.stderr.pipe(log);
  let launchError: Error | undefined;
  child.on("error", e => { launchError = e; });
  const terminate = (signal: NodeJS.Signals) => {
    try { if (process.platform !== "win32" && child.pid) process.kill(-child.pid, signal); else child.kill(signal); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error; }
  };
  let stopped = false;
  const stop = () => { stopped = true; terminate("SIGTERM"); };
  process.once("SIGTERM", stop); process.once("SIGINT", stop);
  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    const until = Date.now() + 120_000;
    let ready = false;
    while (Date.now() < until) {
      if (stopped) throw new Error("Preview startup stopped by external request.");
      if (launchError) throw launchError;
      if (child.exitCode !== null || child.signalCode !== null) throw new Error(`Managed-dev preview exited ${child.exitCode ?? child.signalCode}; see ${output}/preview.log`);
      try { if ((await fetch(`${baseUrl}/favicon.ico`, { signal: AbortSignal.timeout(5_000) })).ok) { ready = true; break; } } catch { /* Starting Next. */ }
      await new Promise(resolve => setTimeout(resolve, 1_000));
    }
    if (!ready) throw new Error("Managed-development preview did not become ready within 120 seconds.");
    return await work(baseUrl);
  } finally {
    process.off("SIGTERM", stop); process.off("SIGINT", stop);
    if (child.exitCode === null && child.signalCode === null) {
      terminate("SIGTERM");
      await new Promise<void>(resolve => { const timer = setTimeout(() => { terminate("SIGKILL"); resolve(); }, 5_000); child.once("close", () => { clearTimeout(timer); resolve(); }); });
    }
    terminate("SIGKILL"); // Also reap any owned Next descendants before releasing the preview port.
    log.end();
  }
}
export async function runConfiguredArticle(job: ArticleJob, runtime: StageRuntimeOptions) {
  validateJob(job);
  const input = path.join(runtime.runDir, "input.json");
  try { if (JSON.stringify(JSON.parse(await readFile(input, "utf8"))) !== JSON.stringify(job)) throw new Error("Run input changed; preserve this run and use a new directory."); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; await saveJson(input, job); }
  try {
    return await runArticlePipeline({ job, runDir: runtime.runDir, deadline: runtime.deadline, retryTechnical: runtime.retryTechnical,
      reviseFrom: runtime.reviseFrom, reviewFirst: runtime.reviewFirst, revisionFeedback: runtime.revisionFeedback,
      execute: async (stage, state, attemptDir) => {
        const started = Date.now();
        let outcome = "failed";
        try { const decision = await executeArticleStage(runtime, stage, state, attemptDir); outcome = decision.status; return decision; }
        finally { await saveJson(path.join(attemptDir, "timing.json"), { stage, started_at: new Date(started).toISOString(), finished_at: new Date().toISOString(), elapsed_ms: Date.now() - started, outcome }); }
      } });
  } finally {
    // Reporting must not replace the original execution outcome or release a queue lease early.
    await writeArticleRunReport(runtime.runDir, runtime.model, runtime.reasoning).catch(error => console.warn(`Article timing report unavailable: ${error.message}`));
  }
}
async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help")) {
    console.log("Usage: npm run articles:pipeline -- --input <job.json> --run-dir <ignored-directory> [--apply] [--base-url <managed-dev-preview>] [--retry-technical] [--revise-from <completed-run>] [--feedback-file <text-file>] [--review-first]\nRuns one code-controlled article; no queue mutations or production release. Existing run state resumes safely; review budgets do not reset. --retry-technical retries a repaired technical failure before its backoff expires, consuming the existing recovery budget; it cannot override provider or editorial blockers. --revise-from creates a separate writing/review experiment from unchanged completed evidence; the original run and its review budgets are preserved. --review-first evaluates the retained draft before requesting any writer repair."); return;
  }
  let input = "", runDir = "", baseUrl = process.env.ARTICLE_PIPELINE_PREVIEW_BASE_URL, apply = false, retryTechnical = false, reviewFirst = false, reviseFrom: string | undefined, feedbackFile: string | undefined;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--input") input = args[++i];
    else if (args[i] === "--run-dir") runDir = args[++i];
    else if (args[i] === "--base-url") baseUrl = args[++i];
    else if (args[i] === "--apply") apply = true;
    else if (args[i] === "--retry-technical") retryTechnical = true;
    else if (args[i] === "--review-first") reviewFirst = true;
    else if (args[i] === "--revise-from") reviseFrom = path.resolve(args[++i]);
    else if (args[i] === "--feedback-file") feedbackFile = path.resolve(args[++i]);
    else throw new Error(`Unknown option: ${args[i]}`);
  }
  if (!input || !runDir) throw new Error("--input and --run-dir are required.");
  const job = validateJob(JSON.parse(await readFile(path.resolve(input), "utf8")));
  const worktree = path.resolve(process.env.ARTICLE_WRITER_WORKTREE || process.cwd());
  runDir = path.resolve(runDir);
  if (!runDir.startsWith(`${worktree}/tmp/`)) throw new Error("Run directory must be inside this worktree's ignored tmp/ directory.");
  if (reviseFrom && !reviseFrom.startsWith(`${worktree}/tmp/`)) throw new Error("Revision source must be inside this worktree's ignored tmp/ directory.");
  if (reviewFirst && !reviseFrom) throw new Error("--review-first requires --revise-from.");
  if (feedbackFile && !reviseFrom) throw new Error("--feedback-file requires --revise-from.");
  if (!apply) { console.log(JSON.stringify({ job, runDir, stages: reviseFrom ? STAGES.slice(STAGES.indexOf(reviewFirst ? "editorial_review" : "writing")) : STAGES, reviseFrom, writes: "none (dry run)" }, null, 2)); return; }
  const env = managedArticleEnvironment(resolveArticleDevCredentials());
  const stageMinutes = Number(process.env.ARTICLE_PIPELINE_STAGE_TIMEOUT_MINUTES ?? "45");
  if (!Number.isFinite(stageMinutes) || stageMinutes < 1 || stageMinutes > 120) throw new Error("Stage timeout must be 1-120 minutes.");
  const result = await withArticlePreview(worktree, env, baseUrl, async url => runConfiguredArticle(job, {
    worktree, runDir, env, baseUrl: url, retryTechnical, reviseFrom, reviewFirst, revisionFeedback: feedbackFile ? await readFile(feedbackFile, "utf8") : undefined, deadline: Date.now() + 300 * 60_000, stageTimeoutMs: stageMinutes * 60_000,
    codexBin: process.env.ARTICLE_WRITER_CODEX_BIN || path.join(os.homedir(), ".local/bin/codex"), model: process.env.ARTICLE_WRITER_CODEX_MODEL || "gpt-5.6-luna",
    reasoning: parseCodexReasoningEffort(process.env.ARTICLE_WRITER_CODEX_REASONING_EFFORT || "max"),
    grokFallback: /^(true|1)$/i.test(process.env.ARTICLE_WRITER_GROK_FALLBACK || "false"), grokBin: process.env.ARTICLE_WRITER_GROK_BIN || "grok", grokModel: process.env.ARTICLE_WRITER_GROK_MODEL || "grok-4.5"
  }));
  console.log(JSON.stringify({ status: result.status, stage: result.stage, reason: result.feedback, runDir }, null, 2));
  if (result.status === "blocked") process.exitCode = 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main().catch(error => { console.error(error.message); process.exitCode = 1; });

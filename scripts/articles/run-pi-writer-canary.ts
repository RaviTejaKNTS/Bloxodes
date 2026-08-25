import "../shared/load-env";

import { spawn, spawnSync } from "node:child_process";
import { accessSync, constants as fsConstants } from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  PI_WRITER_MODEL,
  PI_WRITER_PROVIDER,
  PI_WRITER_REASONING,
  assertLunaMaxConfiguration,
  assertPiVersion
} from "./pi-article-writer";

const EXPECTED = "PI_LUNA_MAX_READY";

function resolvePi(): string {
  const configured = process.env.ARTICLE_WRITER_PI_BIN?.trim();
  if (configured) return configured;
  const local = path.join(os.homedir(), ".local", "bin", "pi");
  try {
    accessSync(local, fsConstants.X_OK);
    return local;
  } catch {
    return "pi";
  }
}

async function run(bin: string, args: string[]): Promise<string> {
  const allowed = [
    "PATH",
    "HOME",
    "USER",
    "LOGNAME",
    "SHELL",
    "TMPDIR",
    "TMP",
    "TEMP",
    "LANG",
    "LC_ALL",
    "TERM",
    "COLORTERM",
    "NO_COLOR",
    "FORCE_COLOR",
    "PI_CODING_AGENT_DIR",
    "HTTPS_PROXY",
    "HTTP_PROXY",
    "NO_PROXY",
    "SSL_CERT_FILE",
    "NODE_EXTRA_CA_CERTS"
  ];
  const env: NodeJS.ProcessEnv = { NODE_ENV: process.env.NODE_ENV ?? "development" };
  for (const key of allowed) {
    if (process.env[key] !== undefined) env[key] = process.env[key];
  }
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { cwd: process.cwd(), env, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", (chunk: Buffer) => {
      process.stdout.write(chunk);
      output += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => process.stderr.write(chunk));
    child.on("error", reject);
    const timeout = setTimeout(() => child.kill("SIGTERM"), 120_000);
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code === 0) resolve(output);
      else reject(new Error(`Pi canary exited with code ${code ?? "unknown"}.`));
    });
  });
}

async function main(): Promise<void> {
  if (!process.argv.slice(2).includes("--apply")) {
    console.log(`Dry run: would call ${PI_WRITER_PROVIDER}/${PI_WRITER_MODEL} at ${PI_WRITER_REASONING} and require ${EXPECTED}.`);
    return;
  }
  const provider = process.env.ARTICLE_WRITER_PI_PROVIDER?.trim() || PI_WRITER_PROVIDER;
  const model = process.env.ARTICLE_WRITER_PI_MODEL?.trim() || PI_WRITER_MODEL;
  const reasoning = process.env.ARTICLE_WRITER_PI_REASONING_EFFORT?.trim() || PI_WRITER_REASONING;
  if (provider !== PI_WRITER_PROVIDER) throw new Error(`Pi canary must use ${PI_WRITER_PROVIDER}.`);
  assertLunaMaxConfiguration(model, reasoning, "Pi canary");
  const pi = resolvePi();
  const piVersion = spawnSync(pi, ["--version"], { encoding: "utf8" });
  if (piVersion.status !== 0) throw new Error("Pi CLI failed its version check.");
  assertPiVersion(piVersion.stdout);
  const output = await run(pi, [
    "-p",
    "--provider",
    provider,
    "--model",
    model,
    "--thinking",
    reasoning,
    "--system-prompt",
    `Reply with exactly ${EXPECTED} and nothing else.`,
    "--no-context-files",
    "--no-extensions",
    "--no-skills",
    "--no-prompt-templates",
    "--no-themes",
    "--no-session",
    "--no-approve",
    "--tools",
    "read",
    "--",
    `Reply exactly: ${EXPECTED}`
  ]);
  if (output.trim() !== EXPECTED) throw new Error(`Pi canary returned an unexpected response: ${JSON.stringify(output.trim())}`);
  console.log("Pi ChatGPT Luna Max canary passed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

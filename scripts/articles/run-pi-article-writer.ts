import "../shared/load-env";

import { spawn, spawnSync } from "node:child_process";
import { accessSync, constants as fsConstants } from "node:fs";
import { access, lstat, mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  PI_WRITER_MODEL,
  PI_WRITER_PROVIDER,
  PI_WRITER_REASONING,
  assertArticleWorkspace,
  buildPiWriterArgs,
  buildPiWriterPrompt,
  assertPiVersion,
  parsePiWriterSkill,
  type PiWriterSkill
} from "./pi-article-writer";

type Options = {
  apply: boolean;
  piBin: string;
  provider: string;
  model: string;
  reasoning: string;
  repoRoot: string;
  skill: PiWriterSkill | null;
  title: string;
  slug: string;
  type: string;
  workspace: string;
  timeoutMinutes: number;
};

function executableDefault(): string {
  const local = path.join(os.homedir(), ".local", "bin", "pi");
  try {
    accessSync(local, fsConstants.X_OK);
    return local;
  } catch {
    return "pi";
  }
}

function requireValue(argv: string[], index: number, flag: string): string {
  const value = argv[index + 1]?.trim();
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value.`);
  return value;
}

function parsePositiveInteger(value: string, label: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 5 || parsed > 180) {
    throw new Error(`${label} must be an integer from 5 to 180.`);
  }
  return parsed;
}

function printUsage(): void {
  console.log(`Usage: npm run articles:writer:pi -- --skill <SKILL.md> --title <title> --slug <slug> --type <type> --workspace <path> [--apply]

Runs the isolated Pi article-writing stage only. Dry-run is the default.
Pi is fixed to openai-codex/gpt-5.6-luna with max reasoning.`);
}

function parseArgs(argv: string[]): Options {
  const options: Options = {
    apply: false,
    piBin: process.env.ARTICLE_WRITER_PI_BIN?.trim() || executableDefault(),
    provider: process.env.ARTICLE_WRITER_PI_PROVIDER?.trim() || PI_WRITER_PROVIDER,
    model: process.env.ARTICLE_WRITER_PI_MODEL?.trim() || PI_WRITER_MODEL,
    reasoning: process.env.ARTICLE_WRITER_PI_REASONING_EFFORT?.trim() || PI_WRITER_REASONING,
    repoRoot: process.cwd(),
    skill: null,
    title: "",
    slug: "",
    type: "",
    workspace: "",
    timeoutMinutes: parsePositiveInteger(process.env.ARTICLE_WRITER_PI_TIMEOUT_MINUTES ?? "90", "ARTICLE_WRITER_PI_TIMEOUT_MINUTES")
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    }
    if (arg === "--apply") options.apply = true;
    else if (arg === "--skill") {
      options.skill = parsePiWriterSkill(requireValue(argv, index, arg));
      index += 1;
    } else if (arg === "--title") {
      options.title = requireValue(argv, index, arg);
      index += 1;
    } else if (arg === "--slug") {
      options.slug = requireValue(argv, index, arg);
      index += 1;
    } else if (arg === "--type") {
      options.type = requireValue(argv, index, arg);
      index += 1;
    } else if (arg === "--workspace") {
      options.workspace = requireValue(argv, index, arg);
      index += 1;
    } else if (arg === "--pi-bin") {
      options.piBin = requireValue(argv, index, arg);
      index += 1;
    } else if (arg === "--timeout-minutes") {
      options.timeoutMinutes = parsePositiveInteger(requireValue(argv, index, arg), arg);
      index += 1;
    } else if (arg !== "--apply") throw new Error(`Unknown option: ${arg}`);
  }

  if (!options.skill) throw new Error("--skill is required.");
  if (!options.title) throw new Error("--title is required.");
  if (!options.slug) throw new Error("--slug is required.");
  if (!options.type) throw new Error("--type is required.");
  if (!options.workspace) throw new Error("--workspace is required.");
  options.repoRoot = path.resolve(options.repoRoot);
  options.workspace = assertArticleWorkspace(options.repoRoot, options.workspace);
  return options;
}

async function runCommand(
  bin: string,
  args: string[],
  cwd: string,
  timeoutMinutes: number,
  env: NodeJS.ProcessEnv = process.env
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    const capture = (chunk: Buffer, stream: NodeJS.WriteStream) => {
      stream.write(chunk);
      output += chunk.toString("utf8");
      if (output.length > 1_000_000) output = output.slice(-1_000_000);
    };
    child.stdout.on("data", (chunk: Buffer) => capture(chunk, process.stdout));
    child.stderr.on("data", (chunk: Buffer) => capture(chunk, process.stderr));
    child.on("error", reject);
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 15_000).unref();
    }, timeoutMinutes * 60_000);
    timeout.unref();
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code === 0) resolve(output);
      else reject(new Error(`${bin} exited with code ${code ?? "unknown"}.`));
    });
  });
}

function piChildEnvironment(): NodeJS.ProcessEnv {
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
  return env;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  options.repoRoot = await realpath(options.repoRoot);
  options.workspace = assertArticleWorkspace(options.repoRoot, await realpath(options.workspace));
  await access(options.workspace, fsConstants.R_OK | fsConstants.W_OK);
  await access(path.join(options.workspace, "brief.md"), fsConstants.R_OK);
  await access(path.join(options.workspace, "media.json"), fsConstants.R_OK);
  if (path.isAbsolute(options.piBin)) await access(options.piBin, fsConstants.X_OK);
  const piVersion = spawnSync(options.piBin, ["--version"], { encoding: "utf8" });
  if (piVersion.status !== 0) {
    throw new Error(`Pi CLI failed its version check: ${piVersion.stderr?.trim() || piVersion.error?.message || "unknown error"}`);
  }
  assertPiVersion(piVersion.stdout);

  const prompt = buildPiWriterPrompt({
    skill: options.skill!,
    title: options.title,
    slug: options.slug,
    type: options.type,
    workspace: options.workspace
  });
  const args = buildPiWriterArgs({
    repoRoot: options.repoRoot,
    skill: options.skill!,
    prompt,
    provider: options.provider,
    model: options.model,
    reasoning: options.reasoning
  });

  if (!options.apply) {
    console.log(`Dry run: Pi ${options.provider}/${options.model} at ${options.reasoning} would write ${path.join(options.workspace, "final.json")}.`);
    console.log(prompt);
    return;
  }

  console.log(`Starting isolated Pi writer (${options.provider}/${options.model}, ${options.reasoning}) for ${options.slug}.`);
  const finalPath = path.join(options.workspace, "final.json");
  try {
    if ((await lstat(finalPath)).isSymbolicLink()) throw new Error("final.json must not be a symbolic link.");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const output = await runCommand(options.piBin, args, options.workspace, options.timeoutMinutes, piChildEnvironment());
  const logDir = path.join(options.repoRoot, "tmp", "article-writer", "pi-runs");
  await mkdir(logDir, { recursive: true });
  await writeFile(path.join(logDir, `${new Date().toISOString().replaceAll(":", "-")}-${options.slug}.log`), output, "utf8");

  if ((await lstat(finalPath)).isSymbolicLink()) throw new Error("Pi created a symbolic-link final.json.");
  const final = JSON.parse(await readFile(finalPath, "utf8")) as { slug?: unknown; content_md?: unknown };
  if (final.slug !== options.slug) throw new Error(`Pi final slug does not match ${options.slug}.`);
  if (typeof final.content_md !== "string" || !final.content_md.trim()) throw new Error("Pi final has no content_md.");

  await runCommand("npm", ["run", "content:check-copy", "--", finalPath], options.repoRoot, 10);
  await runCommand(
    "npm",
    ["run", "check:article-image-readiness", "--", "--manifest", path.join(options.workspace, "media.json"), "--file", finalPath],
    options.repoRoot,
    10
  );
  console.log(`Pi writer completed and deterministic checks passed: ${finalPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

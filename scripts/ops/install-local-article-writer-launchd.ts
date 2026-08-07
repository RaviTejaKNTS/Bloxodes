import { spawnSync } from "node:child_process";
import { constants as fsConstants } from "node:fs";
import { access, mkdir, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import {
  isLocalSupabaseUrl,
  resolveArticleQueueCredentials,
  supabaseTarget
} from "../articles/article-queue-env";

type Options = {
  install: boolean;
  uninstall: boolean;
  queueEnvFile: string | null;
  worktree: string;
  grokBin: string;
};

const LABEL = "com.bloxodes.article-writer";
const SCHEDULE = [
  [0, 30],
  [3, 0],
  [5, 30],
  [8, 0],
  [10, 30],
  [13, 0],
  [15, 30],
  [18, 0],
  [20, 30],
  [23, 0]
] as const;

function printUsage() {
  console.log(`Usage: npm run articles:writer:launchd -- [--install|--uninstall] [options]

Options:
  --install                 Write and activate the per-user launchd job
  --uninstall               Deactivate and remove the per-user launchd job
  --queue-env-file PATH     Production queue env file (required for --install)
  --worktree PATH           Persistent Bloxodes writing worktree (default: current repo)
  --grok-bin PATH           Grok executable (default: ~/.grok/bin/grok)
  --help                    Show this help

Without --install or --uninstall, this validates and prints the intended schedule without changing launchd.`);
}

function requireValue(argv: string[], index: number, flag: string): string {
  const value = argv[index + 1]?.trim();
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value.`);
  return value;
}

function parseArgs(argv: string[]): Options {
  const options: Options = {
    install: false,
    uninstall: false,
    queueEnvFile: process.env.ARTICLE_QUEUE_ENV_FILE?.trim() || null,
    worktree: path.resolve(process.env.ARTICLE_WRITER_WORKTREE?.trim() || process.cwd()),
    grokBin: path.resolve(process.env.ARTICLE_WRITER_GROK_BIN?.trim() || path.join(os.homedir(), ".grok/bin/grok"))
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    } else if (arg === "--install") {
      options.install = true;
    } else if (arg === "--uninstall") {
      options.uninstall = true;
    } else if (arg === "--queue-env-file") {
      options.queueEnvFile = path.resolve(requireValue(argv, index, arg));
      index += 1;
    } else if (arg.startsWith("--queue-env-file=")) {
      options.queueEnvFile = path.resolve(arg.slice("--queue-env-file=".length));
    } else if (arg === "--worktree") {
      options.worktree = path.resolve(requireValue(argv, index, arg));
      index += 1;
    } else if (arg.startsWith("--worktree=")) {
      options.worktree = path.resolve(arg.slice("--worktree=".length));
    } else if (arg === "--grok-bin") {
      options.grokBin = path.resolve(requireValue(argv, index, arg));
      index += 1;
    } else if (arg.startsWith("--grok-bin=")) {
      options.grokBin = path.resolve(arg.slice("--grok-bin=".length));
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  if (options.install && options.uninstall) throw new Error("Choose either --install or --uninstall, not both.");
  return options;
}

function xmlEscape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function plist(options: Options, stdoutPath: string, stderrPath: string): string {
  const intervals = SCHEDULE.map(([hour, minute]) => `    <dict>
      <key>Hour</key><integer>${hour}</integer>
      <key>Minute</key><integer>${minute}</integer>
    </dict>`).join("\n");
  const pathValue = [path.dirname(options.grokBin), "/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin"]
    .filter((value, index, values) => values.indexOf(value) === index)
    .join(":");
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/zsh</string>
    <string>-lc</string>
    <string>exec npm run articles:writer:local -- --apply</string>
  </array>
  <key>WorkingDirectory</key><string>${xmlEscape(options.worktree)}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>ARTICLE_QUEUE_ENV_FILE</key><string>${xmlEscape(options.queueEnvFile!)}</string>
    <key>ARTICLE_WRITER_WORKTREE</key><string>${xmlEscape(options.worktree)}</string>
    <key>ARTICLE_WRITER_GROK_BIN</key><string>${xmlEscape(options.grokBin)}</string>
    <key>PATH</key><string>${xmlEscape(pathValue)}</string>
  </dict>
  <key>StartCalendarInterval</key>
  <array>
${intervals}
  </array>
  <key>ProcessType</key><string>Background</string>
  <key>LowPriorityIO</key><true/>
  <key>StandardOutPath</key><string>${xmlEscape(stdoutPath)}</string>
  <key>StandardErrorPath</key><string>${xmlEscape(stderrPath)}</string>
</dict>
</plist>
`;
}

function launchctl(...args: string[]) {
  const result = spawnSync("/bin/launchctl", args, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`launchctl ${args[0]} failed: ${(result.stderr || result.stdout).trim()}`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const launchAgentsDir = path.join(os.homedir(), "Library", "LaunchAgents");
  const plistPath = path.join(launchAgentsDir, `${LABEL}.plist`);
  const uid = typeof process.getuid === "function" ? process.getuid() : os.userInfo().uid;
  const domain = `gui/${uid}`;

  if (options.uninstall) {
    spawnSync("/bin/launchctl", ["bootout", domain, plistPath], { encoding: "utf8" });
    try {
      await unlink(plistPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    console.log(`Removed ${plistPath}.`);
    return;
  }

  if (!options.queueEnvFile) throw new Error("--queue-env-file is required for validation and installation.");
  await access(path.join(options.worktree, "package.json"), fsConstants.R_OK);
  await access(options.grokBin, fsConstants.X_OK);
  const queue = resolveArticleQueueCredentials({ envFile: options.queueEnvFile });
  if (isLocalSupabaseUrl(queue.url)) throw new Error("The launchd writer queue must point to production, not local Supabase.");

  const logDir = path.join(options.worktree, "tmp", "article-writer");
  const stdoutPath = path.join(logDir, "launchd.stdout.log");
  const stderrPath = path.join(logDir, "launchd.stderr.log");
  const plistContents = plist(options, stdoutPath, stderrPath);
  const lint = spawnSync("/usr/bin/plutil", ["-lint", "-"], { input: plistContents, encoding: "utf8" });
  if (lint.status !== 0) throw new Error(`Generated LaunchAgent plist is invalid: ${(lint.stderr || lint.stdout).trim()}`);
  const queueClient = createClient(queue.url, queue.serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const { error: readinessError } = await queueClient
    .from("article_generation_queue")
    .select("id, workflow_mode, source_name, curated_at")
    .limit(1);
  if (readinessError) {
    throw new Error(`Production article queue schema is not ready for the local writer: ${readinessError.message}`);
  }
  console.log(`Queue: ${supabaseTarget(queue.url)} (${queue.source})`);
  console.log(`Worktree: ${options.worktree}`);
  console.log(`Grok: ${options.grokBin}`);
  console.log(`Schedule: ${SCHEDULE.map(([hour, minute]) => `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`).join(", ")} local time`);
  console.log(`LaunchAgent: ${plistPath}`);
  if (!options.install) {
    console.log("Dry run: launchd was not changed. Pass --install to activate the schedule.");
    return;
  }

  await mkdir(launchAgentsDir, { recursive: true });
  await mkdir(logDir, { recursive: true });
  await writeFile(plistPath, plistContents, { encoding: "utf8", mode: 0o600 });
  spawnSync("/bin/launchctl", ["bootout", domain, plistPath], { encoding: "utf8" });
  launchctl("bootstrap", domain, plistPath);
  console.log(`Installed and activated ${LABEL}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

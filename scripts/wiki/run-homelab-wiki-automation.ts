import "../shared/load-env";

import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { access, mkdir, readFile, realpath } from "node:fs/promises";
import { constants as fsConstants, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import { parse as parseDotenv } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { articleGameSlugFromUniverse } from "@/lib/slug";
import { fetchProductionEditorialInventory } from "../articles/production-editorial-inventory";
import {
  buildCodexExecArgs,
  parseCodexReasoningEffort
} from "../articles/article-writer-provider";
import { acquireAgentWorkLock } from "../shared/agent-work-lock";
import { isProductionSupabaseUrl } from "../shared/supabase-target";
import { readSessionState, saveSessionState, recoverStep, resumedCodexArgs } from "./wiki-session-recovery";
import { MODEL_FORBIDDEN_ENV_KEYS, resolveWikiDevCredentials } from "./wiki-automation-env";

type StatsGame = {
  universeId: number;
  rootPlaceId: number;
  slug: string;
  name: string;
  displayName: string;
  description?: string | null;
  creatorName?: string | null;
  creatorType?: string | null;
  genre?: string | null;
  subgenre?: string | null;
  iconUrl?: string | null;
  playing?: number | null;
  visits?: number | null;
  rank: number;
};

type QueueRow = {
  id: string;
  universe_id: number;
  root_place_id: number;
  game_name: string;
  wiki_slug: string;
  rank_at_claim: number;
  current_ccu: number | null;
  status: string;
  attempts: number;
  max_attempts: number;
  lease_token: string | null;
  lease_owner: string | null;
  processing_slot: number | null;
  result_root: string | null;
  wiki_final_path: string | null;
  collection_manifests: unknown;
};

type WorkflowResult = {
  queueId: string;
  universeId: number;
  wikiSlug: string;
  outcome: "ready" | "blocked";
  outcomeReason?: string;
  suggestionsPath: string;
  wikiFinalPath?: string;
  approvedCollections: string[];
  blockedCollections: Array<{ slug: string; reason: string }>;
  collectionManifests: string[];
};

type RuntimeManifestIdentity = {
  schemaVersion?: unknown;
  game?: { slug?: unknown; universeId?: unknown };
  collection?: { slug?: unknown };
  dataset?: unknown;
  finalJson?: unknown;
  mediaRoot?: unknown;
};

const worktree = path.resolve(process.env.WIKI_AUTOMATION_WORKTREE?.trim() || process.cwd());
const timeoutMinutes = Number(process.env.WIKI_AUTOMATION_TIMEOUT_MINUTES || "660");
const workerCount = Number(process.env.WIKI_AUTOMATION_CONCURRENCY || "1");
const maxGamesPerRun = Number(process.env.WIKI_AUTOMATION_MAX_GAMES_PER_RUN || "1");
const leaseMinutes = Math.min(720, Math.max(30, timeoutMinutes + 30));
const modelHome = process.env.WIKI_AUTOMATION_MODEL_HOME?.trim() || "/var/lib/bloxodes/wiki-model";
const codexBin = process.env.WIKI_AUTOMATION_CODEX_BIN?.trim() || "/home/teja/.local/bin/codex";
const codexModel = process.env.WIKI_AUTOMATION_CODEX_MODEL?.trim() || "gpt-5.6-luna";
const codexReasoning = parseCodexReasoningEffort(process.env.WIKI_AUTOMATION_CODEX_REASONING?.trim() || "max");
const productionEnvFile = path.resolve(process.env.WIKI_RELEASE_PRODUCTION_ENV_FILE?.trim() || ".envs/targets/production.env");
const apply = process.argv.includes("--apply");
const skipProduction = process.argv.includes("--skip-production-release");
const releaseOnly = process.argv.includes("--release-only");
const queueId = process.env.WIKI_AUTOMATION_QUEUE_ID?.trim();
const activeChildren = new Set<ChildProcess>();
let stopRequested = false;

function terminateProcessGroup(child: ChildProcess, signal: NodeJS.Signals) {
  if (!child.pid) return;
  try {
    if (process.platform === "win32") child.kill(signal);
    else process.kill(-child.pid, signal);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
  }
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    if (stopRequested) return;
    stopRequested = true;
    console.log(`Received ${signal}; stopping active lanes and returning their leases to retry.`);
    for (const child of activeChildren) terminateProcessGroup(child, "SIGTERM");
  });
}

function assertOptions() {
  if (!Number.isInteger(timeoutMinutes) || timeoutMinutes < 60 || timeoutMinutes > 690) {
    throw new Error("WIKI_AUTOMATION_TIMEOUT_MINUTES must be an integer from 60 to 690.");
  }
  if (!Number.isInteger(workerCount) || workerCount < 1 || workerCount > 2) {
    throw new Error("WIKI_AUTOMATION_CONCURRENCY must be 1 or 2.");
  }
  if (!Number.isInteger(maxGamesPerRun) || maxGamesPerRun < 0 || maxGamesPerRun > 100) {
    throw new Error("WIKI_AUTOMATION_MAX_GAMES_PER_RUN must be an integer from 0 to 100.");
  }
  if (releaseOnly && (!apply || skipProduction)) {
    throw new Error("--release-only requires --apply and cannot be combined with --skip-production-release.");
  }
  if (!codexModel) throw new Error("WIKI_AUTOMATION_CODEX_MODEL cannot be empty.");
}

async function retryOperation<T>(label: string, operation: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === 3) break;
      const delayMs = attempt * 3_000;
      console.warn(`${label} failed on attempt ${attempt}/3; retrying in ${delayMs / 1_000}s.`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

function assertCleanCheckout(context: string) {
  const result = spawnSync("git", ["-c", `safe.directory=${worktree}`, "status", "--porcelain"], { cwd: worktree, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`Could not inspect git status during ${context}: ${result.stderr.trim()}`);
  if (result.stdout.trim()) throw new Error(`Wiki automation requires a clean checkout during ${context}.`);
}

async function fetchTop100(): Promise<StatsGame[]> {
  const games: StatsGame[] = [];
  for (const page of [1, 2]) {
    const payload = await retryOperation(`Top-games page ${page}`, async () => {
      const response = await fetch(`https://bloxodes.com/api/stats/games?page=${page}&limit=50&sort=playing`, {
        headers: { Accept: "application/json", "User-Agent": "BloxodesWikiAutomation/1.0" },
        signal: AbortSignal.timeout(30_000)
      });
      if (!response.ok) throw new Error(`Top-games API returned ${response.status}.`);
      return response.json() as Promise<{ games?: StatsGame[] }>;
    });
    if (!Array.isArray(payload.games)) throw new Error("Top-games API returned an invalid payload.");
    games.push(...payload.games);
  }
  const valid = games.filter((game) => Number.isSafeInteger(game.universeId) && game.universeId > 0 && game.rank >= 1 && game.rank <= 100);
  if (valid.length !== 100 || new Set(valid.map((game) => game.rank)).size !== 100) {
    throw new Error(`Expected an exact top 100; received ${valid.length} valid ranked rows.`);
  }
  return valid.sort((left, right) => left.rank - right.rank);
}

async function mirrorUniverse(dev: SupabaseClient, game: StatsGame) {
  const lookup = await dev.from("roblox_universes")
    .select("root_place_id,name,display_name,slug,description,creator_name,creator_type,genre_l1,genre_l2,icon_url,playing,visits,raw_metadata")
    .eq("universe_id", game.universeId)
    .maybeSingle();
  if (lookup.error) throw new Error(`Could not inspect managed-dev universe ${game.universeId}: ${lookup.error.message}`);
  const existing = lookup.data as Record<string, unknown> | null;
  const automationMetadata = { source: "production-top-games-api", rank: game.rank, mirrored_at: new Date().toISOString() };
  const payload = {
    universe_id: game.universeId,
    root_place_id: game.rootPlaceId || existing?.root_place_id,
    name: game.name || existing?.name,
    display_name: game.displayName || existing?.display_name || game.name,
    slug: existing?.slug || game.slug,
    description: game.description ?? existing?.description ?? null,
    creator_name: game.creatorName ?? existing?.creator_name ?? null,
    creator_type: game.creatorType ?? existing?.creator_type ?? null,
    genre_l1: game.genre ?? existing?.genre_l1 ?? null,
    genre_l2: game.subgenre ?? existing?.genre_l2 ?? null,
    icon_url: game.iconUrl ?? existing?.icon_url ?? null,
    playing: game.playing ?? existing?.playing ?? null,
    visits: game.visits ?? existing?.visits ?? null,
    raw_metadata: {
      ...(existing?.raw_metadata && typeof existing.raw_metadata === "object" ? existing.raw_metadata as Record<string, unknown> : {}),
      wiki_automation: automationMetadata
    }
  };
  const { error } = await dev.from("roblox_universes").upsert(payload, { onConflict: "universe_id" });
  if (error) throw new Error(`Could not mirror universe ${game.universeId} to managed dev: ${error.message}`);
}

async function enqueueNext(dev: SupabaseClient): Promise<QueueRow | null> {
  const [top100, inventory, queueResult] = await Promise.all([
    fetchTop100(),
    retryOperation("Production editorial inventory", fetchProductionEditorialInventory),
    dev.from("wiki_generation_queue").select("universe_id,wiki_slug")
  ]);
  if (queueResult.error) throw new Error(`Could not inspect wiki queue: ${queueResult.error.message}`);
  const completedUniverses = new Set(
    inventory.items.filter((item) => item.family === "wiki" && item.universe_id).map((item) => Number(item.universe_id))
  );
  const completedSlugs = new Set(inventory.items.filter((item) => item.family === "wiki").map((item) => item.key));
  const queuedUniverses = new Set((queueResult.data ?? []).map((row) => Number(row.universe_id)));
  const queuedSlugs = new Set((queueResult.data ?? []).map((row) => String(row.wiki_slug)));
  const game = top100.find((candidate) => !completedUniverses.has(candidate.universeId) && !queuedUniverses.has(candidate.universeId));
  if (!game) return null;
  let wikiSlug = articleGameSlugFromUniverse({
    universe_id: game.universeId,
    slug: game.slug,
    display_name: game.displayName,
    name: game.name
  });
  if (completedSlugs.has(wikiSlug) || queuedSlugs.has(wikiSlug)) wikiSlug = `${wikiSlug}-${game.universeId}`;
  await mirrorUniverse(dev, game);
  const { data, error } = await dev.from("wiki_generation_queue").insert({
    universe_id: game.universeId,
    root_place_id: game.rootPlaceId,
    game_name: game.displayName || game.name,
    wiki_slug: wikiSlug,
    rank_at_claim: game.rank,
    current_ccu: game.playing ?? null,
    status: "queued"
  }).select("*").single();
  if (error) throw new Error(`Could not enqueue ${game.name}: ${error.message}`);
  console.log(`Enqueued rank ${game.rank}: ${game.name} (${game.universeId}) as ${wikiSlug}.`);
  return data as QueueRow;
}

async function previewNext(dev: SupabaseClient) {
  const queued = await dev.from("wiki_generation_queue").select("game_name,wiki_slug,rank_at_claim,status,next_attempt_at")
    .in("status", ["queued", "retry"])
    .order("rank_at_claim", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (queued.error) throw new Error(`Could not inspect wiki queue: ${queued.error.message}`);
  if (queued.data) {
    console.log(`Dry run: next durable queue row is rank ${queued.data.rank_at_claim} ${queued.data.game_name} (${queued.data.status}).`);
    return;
  }
  const [top100, inventory, queueResult] = await Promise.all([
    fetchTop100(),
    retryOperation("Production editorial inventory", fetchProductionEditorialInventory),
    dev.from("wiki_generation_queue").select("universe_id")
  ]);
  if (queueResult.error) throw new Error(`Could not inspect wiki queue: ${queueResult.error.message}`);
  const completedUniverses = new Set(
    inventory.items.filter((item) => item.family === "wiki" && item.universe_id).map((item) => Number(item.universe_id))
  );
  const queuedUniverses = new Set((queueResult.data ?? []).map((row) => Number(row.universe_id)));
  const game = top100.find((candidate) => !completedUniverses.has(candidate.universeId) && !queuedUniverses.has(candidate.universeId));
  if (game) console.log(`Dry run: next new candidate is rank ${game.rank} ${game.displayName || game.name} (${game.universeId}).`);
  else console.log("Dry run: no current top-100 game without a durable wiki result remains.");
}

async function claim(dev: SupabaseClient, lane: number): Promise<QueueRow | null> {
  const worker = `${os.hostname()}-wiki-homelab-${lane}`;
  const { data, error } = await dev.rpc("claim_wiki_generation_queue_item", {
    p_worker: worker,
    p_lease_minutes: leaseMinutes,
    ...(queueId ? { p_queue_id: queueId } : {})
  });
  if (error) throw new Error(`Wiki queue claim failed: ${error.message}`);
  const row = Array.isArray(data) ? data[0] : data;
  return row ? row as QueueRow : null;
}

let allocationTail = Promise.resolve();

async function claimOrEnqueue(dev: SupabaseClient, lane: number): Promise<QueueRow | null> {
  let releaseAllocation!: () => void;
  const previous = allocationTail;
  allocationTail = new Promise<void>((resolve) => { releaseAllocation = resolve; });
  await previous;
  try {
    let row = await claim(dev, lane);
    if (row || queueId) return row;
    const enqueued = await enqueueNext(dev);
    if (!enqueued) return null;
    row = await claim(dev, lane);
    if (!row) throw new Error("A queue row was enqueued but could not be claimed.");
    return row;
  } finally {
    releaseAllocation();
  }
}

function modelEnvironment(dev: { url: string; serviceRole: string }): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const key of MODEL_FORBIDDEN_ENV_KEYS) delete env[key];
  for (const key of Object.keys(env)) {
    if (/PRODUCTION|DOKPLOY|SUPABASE_DB_PASSWORD|SSH_AUTH_SOCK|VPS_|GITHUB_TOKEN|GH_TOKEN|BITWARDEN|^BW_/i.test(key)) delete env[key];
  }
  env.BLOXODES_ENV_PROFILE = "managed-dev";
  env.NODE_ENV = "development";
  env.BLOXODES_ENV_OVERLAYS = "";
  env.SUPABASE_URL = dev.url;
  env.SUPABASE_SERVICE_ROLE = dev.serviceRole;
  env.WIKI_DEV_SUPABASE_URL = dev.url;
  env.WIKI_DEV_SUPABASE_SERVICE_ROLE = dev.serviceRole;
  env.HOME = modelHome;
  env.CODEX_HOME = path.join(modelHome, ".codex");
  env.WIKI_AUTOMATION_BATCH_CONTEXT = "1";
  return env;
}

function promptFor(row: QueueRow, resultRoot: string): string {
  return `Run one complete Bloxodes wiki + collection workflow for this exact game.

Identity:
- queue id: ${row.id}
- game: ${row.game_name}
- wiki slug: ${row.wiki_slug}
- universe id: ${row.universe_id}
- root place id: ${row.root_place_id}
- Roblox URL: https://www.roblox.com/games/${row.root_place_id}
- current top-100 rank snapshot: ${row.rank_at_claim}
- artifact root: ${resultRoot}
- reserved localhost preview port: ${3240 + (row.processing_slot || 1)}

Workflow:
1. Run .agents/skills/bloxodes-game-collection-suggestions/SKILL.md for ${row.game_name}. Save suggestions.md under the artifact root.
2. Run .agents/skills/bloxodes-game-collection-workflow-runner/SKILL.md for ${row.game_name}, using that suggestions.md file to create all [create] collections.
3. Run .agents/skills/bloxodes-wiki-workflow-runner/SKILL.md for ${row.game_name}.

For collection subagent handoffs, send only the skill, game name, and collection name. Let the skills supply the instructions.

Runtime context: use the artifact root above instead of the skills' default workspace. The model works in managed development; trusted code publishes to production after verification. Use the reserved preview port and stop the preview when finished. Keep tracked source unchanged. Task-local publication uses scripts/collections/sync-game-collection-runtime.ts and scripts/collections/sync-game-wiki-runtime.ts.

Finish by writing ${path.join(resultRoot, "workflow-result.json")} with exactly:
{
  "queueId": "${row.id}",
  "universeId": ${row.universe_id},
  "wikiSlug": "${row.wiki_slug}",
  "outcome": "ready" or "blocked",
  "outcomeReason": "...",
  "suggestionsPath": "absolute path",
  "wikiFinalPath": "absolute path when ready",
  "approvedCollections": ["slug"],
  "blockedCollections": [{"slug":"...","reason":"..."}],
  "collectionManifests": ["absolute runtime-manifest.json path"]
}
Record ready when the skill workflows finish successfully; otherwise record blocked with the unfinished work.`;
}

function sanitizeError(value: string, env: NodeJS.ProcessEnv): string {
  let text = value;
  for (const [key, secret] of Object.entries(env)) {
    if (secret && secret.length > 6 && /KEY|TOKEN|SECRET|PASSWORD|ROLE/i.test(key)) text = text.split(secret).join("[redacted]");
  }
  return text.slice(-6000);
}

async function runCommand(command: string, args: string[], env: NodeJS.ProcessEnv, timeoutMs?: number, sessionFile?: string) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: worktree, env, stdio: ["ignore", "pipe", "pipe"], shell: false, detached: process.platform !== "win32"
    });
    activeChildren.add(child);
    let tail = "", pending = "", sessionWrite = Promise.resolve();
    child.stdout?.on("data", (chunk: Buffer) => {
      process.stdout.write(chunk);
      if (!sessionFile) { tail = (tail + chunk.toString()).slice(-12000); return; }
      pending += chunk.toString();
      const lines = pending.split("\n"); pending = lines.pop() || "";
      for (const line of lines) {
        try {
          const event = JSON.parse(line);
          if (event.type === "thread.started" && typeof event.thread_id === "string") {
            sessionWrite = sessionWrite.then(async () => {
              const state = await readSessionState(sessionFile);
              if (state.sessionId && state.sessionId !== event.thread_id) throw new Error("Codex resumed a different session.");
              state.sessionId = event.thread_id;
              await saveSessionState(sessionFile, state);
            });
          }
        } catch { /* Other JSONL events are not session metadata. */ }
      }
    });
    child.stderr?.on("data", (chunk: Buffer) => { process.stderr.write(chunk); tail = (tail + chunk.toString()).slice(-12000); });
    const timer = timeoutMs ? setTimeout(() => {
      terminateProcessGroup(child, "SIGTERM");
      setTimeout(() => terminateProcessGroup(child, "SIGKILL"), 15_000).unref();
    }, timeoutMs) : null;
    timer?.unref();
    child.on("error", reject);
    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      terminateProcessGroup(child, "SIGTERM");
      setTimeout(() => {
        terminateProcessGroup(child, "SIGKILL"); activeChildren.delete(child);
        sessionWrite.then(() => code === 0 ? resolve() : reject(new Error(`${command} exited with ${code}: ${sanitizeError(tail, env)}`)), reject);
      }, 1_000);
    });
  });
}

async function runDirectCodex(args: string[], env: NodeJS.ProcessEnv, resultRoot: string, previewPort: number) {
  const relativeAttempt = path.relative(path.join(worktree, "tmp", "wiki-automation"), resultRoot);
  const directEnv = {
    ...env,
    PORT: String(previewPort),
    NEXT_DIST_DIR: path.join(".next", "wiki-automation", relativeAttempt)
  };
  await mkdir(path.join(resultRoot, "tmp"), { recursive: true });
  await runCommand(codexBin, ["exec", "--sandbox", "workspace-write", ...args.slice(1).filter((arg) => arg !== "--ephemeral" && arg !== "--approve-for-me")], directEnv, timeoutMinutes * 60_000, path.join(resultRoot, "session.json"));
}

async function assertPreviewPortFree(port: number) {
  const open = await new Promise<boolean>((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    socket.setTimeout(1_000);
    socket.once("connect", () => { socket.destroy(); resolve(true); });
    socket.once("timeout", () => { socket.destroy(); resolve(false); });
    socket.once("error", () => resolve(false));
  });
  if (open) throw new Error(`Reserved preview port ${port} is still listening after the workflow exited.`);
}

async function readWorkflowResult(row: QueueRow, resultRoot: string): Promise<WorkflowResult> {
  const root = await realpath(resultRoot);
  const file = path.join(root, "workflow-result.json");
  const result = JSON.parse(await readFile(file, "utf8")) as WorkflowResult;
  if (result.outcome !== "ready" && result.outcome !== "blocked") throw new Error("Workflow result has an invalid outcome.");
  if (result.queueId !== row.id || result.universeId !== row.universe_id || result.wikiSlug !== row.wiki_slug) {
    throw new Error("Workflow result identity does not match the claimed queue row.");
  }
  const paths = [result.suggestionsPath, result.wikiFinalPath, ...(result.collectionManifests ?? [])].filter(Boolean) as string[];
  for (const candidate of paths) {
    const resolved = await realpath(candidate);
    if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) throw new Error(`Artifact escapes result root: ${candidate}`);
  }
  const approved = result.approvedCollections ?? [];
  if (approved.some((slug) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))) {
    throw new Error("Workflow result contains an invalid approved collection slug.");
  }
  if (new Set(approved).size !== approved.length) throw new Error("Workflow result contains duplicate approved collection slugs.");
  if (result.wikiFinalPath) {
    const wikiFinal = JSON.parse(await readFile(result.wikiFinalPath, "utf8")) as { slug?: unknown; universe_id?: unknown };
    if (wikiFinal.slug !== row.wiki_slug || Number(wikiFinal.universe_id) !== row.universe_id) {
      throw new Error("Wiki final identity does not match the claimed queue row.");
    }
  }
  const manifestSlugs: string[] = [];
  for (const manifestPath of result.collectionManifests ?? []) {
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as RuntimeManifestIdentity;
    if (
      manifest.schemaVersion !== 1 ||
      manifest.game?.slug !== row.wiki_slug ||
      Number(manifest.game?.universeId) !== row.universe_id ||
      typeof manifest.collection?.slug !== "string" ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(manifest.collection.slug)
    ) {
      throw new Error(`Collection manifest identity does not match the queue row: ${manifestPath}`);
    }
    const manifestRoot = path.dirname(await realpath(manifestPath));
    for (const [label, value] of [["dataset", manifest.dataset], ["finalJson", manifest.finalJson], ["mediaRoot", manifest.mediaRoot]] as const) {
      if (label === "finalJson" && value === undefined) continue;
      if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is missing in ${manifestPath}.`);
      const resolved = await realpath(path.resolve(manifestRoot, value));
      if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
        throw new Error(`${label} escapes the queue artifact root: ${manifestPath}`);
      }
    }
    manifestSlugs.push(manifest.collection.slug);
  }
  if (new Set(manifestSlugs).size !== manifestSlugs.length) throw new Error("Workflow result contains duplicate collection manifests.");
  if (result.outcome === "ready" && [...manifestSlugs].sort().join("\n") !== [...approved].sort().join("\n")) {
    throw new Error("Approved collection slugs do not exactly match the collection manifests.");
  }
  if (result.outcome === "ready" && (!result.wikiFinalPath || !result.collectionManifests?.length || !result.approvedCollections?.length)) {
    throw new Error("Ready workflow must contain a hub and at least one approved collection manifest.");
  }
  return result;
}

async function transition(dev: SupabaseClient, row: QueueRow, values: Record<string, unknown>) {
  const { data, error } = await dev.from("wiki_generation_queue").update(values)
    .eq("id", row.id).eq("status", "processing").eq("lease_token", row.lease_token!).eq("lease_owner", row.lease_owner!)
    .select("id").maybeSingle();
  if (error) throw new Error(`Queue transition failed: ${error.message}`);
  if (!data) throw new Error("Queue lease was lost before transition.");
}

async function heartbeat(dev: SupabaseClient, row: QueueRow) {
  const { data, error } = await dev.rpc("heartbeat_wiki_generation_queue_item", {
    p_id: row.id, p_lease_token: row.lease_token, p_lease_minutes: leaseMinutes
  });
  if (error || data !== true) throw new Error(`Wiki queue heartbeat failed: ${error?.message || "lease lost"}`);
}

function productionEnvironment(): NodeJS.ProcessEnv {
  const parsed = parseDotenv(readFileSync(productionEnvFile, "utf8"));
  const url = parsed.SUPABASE_URL?.trim();
  const serviceRole = parsed.SUPABASE_SERVICE_ROLE?.trim();
  if (!url || !serviceRole || !isProductionSupabaseUrl(url)) throw new Error("Production wiki credentials are missing or target an unrecognized host.");
  const env: NodeJS.ProcessEnv = { ...process.env, ...parsed, SUPABASE_URL: url, SUPABASE_SERVICE_ROLE: serviceRole };
  env.NODE_ENV = "production";
  env.BLOXODES_ENV_PROFILE = "process-only";
  env.BLOXODES_ENV_OVERLAYS = "";
  return env;
}

async function release(result: WorkflowResult) {
  const inventory = await retryOperation("Production editorial inventory", fetchProductionEditorialInventory);
  const collisions = inventory.items.filter(
    (item) => item.family === "wiki" && (item.universe_id === result.universeId || item.key === result.wikiSlug)
  );
  if (collisions.some((item) => item.universe_id !== result.universeId || item.key !== result.wikiSlug)) {
    throw new Error(`Production wiki identity collision: ${JSON.stringify(collisions)}.`);
  }
  const env = productionEnvironment();
  await runCommand("node", ["--import", "tsx", "scripts/collections/sync-game-wiki-runtime.ts", "--final-json", result.wikiFinalPath!, "--game", result.wikiSlug, "--universe-id", String(result.universeId)], env);
  for (const manifest of result.collectionManifests) {
    await runCommand("node", ["--import", "tsx", "scripts/collections/sync-game-collection-runtime.ts", "--normalize-legacy-media", "--manifest", manifest], env);
  }
  for (const manifest of result.collectionManifests) {
    await runCommand("node", ["--import", "tsx", "scripts/collections/sync-game-collection-runtime.ts", "--normalize-legacy-media", "--manifest", manifest, "--apply", "--upload-media", "--allow-prod"], env);
  }
  for (const manifest of result.collectionManifests) {
    await runCommand("node", ["--import", "tsx", "scripts/collections/sync-game-collection-runtime.ts", "--normalize-legacy-media", "--manifest", manifest, "--apply", "--upload-media", "--publish", "--allow-prod"], env);
  }
  await runCommand("node", ["--import", "tsx", "scripts/collections/sync-game-wiki-runtime.ts", "--final-json", result.wikiFinalPath!, "--game", result.wikiSlug, "--universe-id", String(result.universeId), "--apply", "--allow-prod"], env);
  const wikiFinal = JSON.parse(await readFile(result.wikiFinalPath!, "utf8")) as { title?: unknown };
  const expectedPages = [{
    url: `https://bloxodes.com/wiki/${result.wikiSlug}`,
    text: typeof wikiFinal.title === "string" ? wikiFinal.title : result.wikiSlug
  }];
  for (const manifestPath of result.collectionManifests) {
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
      collection?: { slug?: unknown; label?: unknown };
    };
    expectedPages.push({
      url: `https://bloxodes.com/wiki/${result.wikiSlug}/${String(manifest.collection?.slug)}`,
      text: String(manifest.collection?.label || manifest.collection?.slug)
    });
  }
  for (const expected of expectedPages) {
    let ok = false;
    for (let attempt = 0; attempt < 24; attempt += 1) {
      const response = await fetch(expected.url, { redirect: "follow", signal: AbortSignal.timeout(30_000) });
      const body = response.status === 200 ? await response.text() : "";
      if (response.status === 200 && body.toLowerCase().includes(expected.text.toLowerCase())) { ok = true; break; }
      await new Promise((resolve) => setTimeout(resolve, 5_000));
    }
    if (!ok) throw new Error(`Live verification failed for ${expected.url}.`);
  }
  await retryOperation("Published wiki sitemap", async () => {
    const response = await fetch("https://bloxodes.com/sitemaps/wiki.xml", { signal: AbortSignal.timeout(30_000) });
    const body = await response.text();
    if (!response.ok || expectedPages.some((page) => !body.includes(`<loc>${page.url}</loc>`))) throw new Error("Published wiki URLs are not yet in the sitemap.");
  });
  return expectedPages.map((page) => page.url);
}

async function releaseRequestedWiki(dev: SupabaseClient): Promise<boolean> {
  const query = await dev.from("wiki_generation_queue").select("*")
    .eq("status", "processing").in("production_receipt->>state", ["requested", "publishing"])
    .gt("lease_expires_at", new Date().toISOString()).order("started_at").limit(20);
  if (query.error) throw query.error;
  const now = Date.now();
  const row = (query.data || []).find((candidate) => candidate.production_receipt?.state === "requested" ||
    now - Date.parse(candidate.production_receipt?.started_at || "") > 16 * 60_000);
  if (!row) return false;
  const request = row.production_receipt;
  const claimed = await dev.from("wiki_generation_queue").update({ production_receipt: { ...request, state: "publishing", started_at: new Date().toISOString() } })
    .eq("id", row.id).eq("status", "processing").eq("lease_token", row.lease_token)
    .eq("production_receipt->>request_id", request.request_id).eq("production_receipt->>state", request.state).select("id");
  if (claimed.error) throw claimed.error;
  if (!claimed.data?.length) return false;
  let receipt;
  try {
    if (!row.result_root) throw new Error("Publication request has no artifact root.");
    const expectedRoot = path.join(worktree, "tmp", "wiki-automation", row.id);
    if (!(await realpath(row.result_root)).startsWith(`${await realpath(expectedRoot)}${path.sep}`)) throw new Error("Publication root escapes the requested queue game.");
    const result = await readWorkflowResult(row, row.result_root);
    if (result.outcome !== "ready") throw new Error("Publication request is not ready.");
    const urls = await release(result);
    receipt = { ...request, state: "published", urls, verified_at: new Date().toISOString() };
  } catch (error) {
    receipt = { ...request, state: "failed", error: sanitizeError(error instanceof Error ? error.message : String(error), productionEnvironment()), failed_at: new Date().toISOString() };
  }
  const saved = await dev.from("wiki_generation_queue").update({ production_receipt: receipt })
    .eq("id", row.id).eq("status", "processing").eq("lease_token", row.lease_token).eq("production_receipt->>request_id", request.request_id);
  if (saved.error) throw saved.error;
  console.log(`Publisher ${receipt.state}: ${row.game_name}`);
  return true;
}

async function requestProduction(dev: SupabaseClient, row: QueueRow, resultRoot: string, result: WorkflowResult): Promise<string[]> {
  const requestId = `${row.id}-${Date.now()}`;
  await transition(dev, row, {
    result_root: resultRoot, wiki_final_path: result.wikiFinalPath, collection_manifests: result.collectionManifests,
    approved_collections: result.approvedCollections, blocked_collections: result.blockedCollections,
    managed_dev_completed_at: new Date().toISOString(),
    production_receipt: { state: "requested", request_id: requestId }
  });
  console.log(`Requested trusted production publication for ${row.game_name}.`);
  const deadline = Date.now() + 30 * 60_000;
  while (!stopRequested && Date.now() < deadline) {
    const query = await dev.from("wiki_generation_queue").select("production_receipt,status,lease_token").eq("id", row.id).single();
    if (query.error) throw query.error;
    if (query.data.status !== "processing" || query.data.lease_token !== row.lease_token) throw new Error("Publication wait lost its queue lease.");
    const receipt = query.data.production_receipt;
    if (receipt?.request_id === requestId) {
      if (receipt.state === "published" && Array.isArray(receipt.urls)) return receipt.urls;
      if (receipt.state === "failed") throw new Error(receipt.error || "Production publication failed.");
    }
    await new Promise((resolve) => setTimeout(resolve, 10_000));
  }
  throw new Error("Production publisher did not finish before the wait deadline.");
}

async function retryDelay(dev: SupabaseClient): Promise<number | null> {
  const query = await dev.from("wiki_generation_queue").select("next_attempt_at")
    .eq("status", "retry")
    .order("next_attempt_at", { ascending: true, nullsFirst: true })
    .limit(1)
    .maybeSingle();
  if (query.error) throw new Error(`Could not inspect retryable wiki rows: ${query.error.message}`);
  if (!query.data) return null;
  const next = query.data.next_attempt_at ? new Date(query.data.next_attempt_at).getTime() : Date.now();
  return Math.max(5_000, Math.min(60_000, next - Date.now()));
}

async function runOne(dev: SupabaseClient, devCredentials: { url: string; serviceRole: string }, lane: number): Promise<boolean> {
  let activeRow: QueueRow | null = null;
  let leaseActive = false;
  try {
    const row = await claimOrEnqueue(dev, lane);
    if (!row) return false;
    activeRow = row;
    leaseActive = true;
    console.log(`[lane ${lane}] Claimed ${row.game_name} (${row.id}), attempt ${row.attempts}/${row.max_attempts}.`);
    if (!apply) {
      await transition(dev, row, {
        status: "retry",
        lease_token: null,
        lease_owner: null,
        lease_expires_at: null,
        processing_slot: null,
        next_attempt_at: new Date().toISOString(),
        last_error: "Dry-run claim released."
      });
      leaseActive = false;
      console.log(`[lane ${lane}] Dry run complete; Codex was not started.`);
      return true;
    }

    const queueRoot = path.join(worktree, "tmp", "wiki-automation", row.id);
    const resultRoot = row.result_root ? path.resolve(row.result_root) : path.join(queueRoot, `attempt-${row.attempts}`);
    if (!resultRoot.startsWith(`${queueRoot}${path.sep}`)) throw new Error("Saved result root escapes queue workspace.");
    await mkdir(resultRoot, { recursive: true });
    await transition(dev, row, { result_root: resultRoot });
    const sessionFile = path.join(resultRoot, "session.json");
    const env = modelEnvironment(devCredentials);
    const port = 3240 + (row.processing_slot || lane);
    const heartbeatTimer = setInterval(() => void heartbeat(dev, row).catch(console.error), 5 * 60_000);
    heartbeatTimer.unref();
    try {
    let result: WorkflowResult;
    try { result = await readWorkflowResult(row, resultRoot); }
    catch {
      const state = await readSessionState(sessionFile);
      const prompt = state.sessionId ? "Continue the unfinished wiki and collection workflow in this session and write its workflow-result.json." : promptFor(row, resultRoot);
      const args = state.sessionId ? resumedCodexArgs(state.sessionId, prompt, codexModel, codexReasoning)
        : buildCodexExecArgs({ worktree, model: codexModel, reasoningEffort: codexReasoning, prompt });
      await runDirectCodex(args, env, resultRoot, port);
      result = await readWorkflowResult(row, resultRoot);
    }
    const syncDevelopment = async () => {
      result = await readWorkflowResult(row, resultRoot);
      if (result.outcome !== "ready") throw new Error(result.outcomeReason || "Workflow is not ready.");
      await assertPreviewPortFree(port);
      assertCleanCheckout(`post-agent verification for lane ${lane}`);
      await runCommand("node", ["--import", "tsx", "scripts/collections/sync-game-wiki-runtime.ts", "--final-json", result.wikiFinalPath!, "--game", row.wiki_slug, "--universe-id", String(row.universe_id), "--apply"], env);
      for (const manifest of result.collectionManifests) {
        await runCommand("node", ["--import", "tsx", "scripts/collections/sync-game-collection-runtime.ts", "--normalize-legacy-media", "--manifest", manifest, "--apply", "--upload-media", "--publish"], env);
      }
    };
    const repair = async (sessionId: string, error: string) => {
      const prompt = `The outer publication step failed: ${error}\nFix the affected artifacts in this existing workflow and update workflow-result.json. Verify in managed development. Trusted code will retry publication; do not access production.`;
      await runDirectCodex(resumedCodexArgs(sessionId, prompt, codexModel, codexReasoning), env, resultRoot, port);
      result = await readWorkflowResult(row, resultRoot);
    };

    if (result.outcome === "blocked") {
      await transition(dev, row, {
        status: "blocked",
        completed_at: new Date().toISOString(),
        outcome_reason: result.outcomeReason || "No collection cleared the evidence gates.",
        suggestions_path: result.suggestionsPath,
        result_root: resultRoot,
        approved_collections: result.approvedCollections,
        blocked_collections: result.blockedCollections,
        lease_token: null,
        lease_owner: null,
        lease_expires_at: null,
        processing_slot: null
      });
      leaseActive = false;
      console.log(`[lane ${lane}] Blocked ${row.game_name} honestly; claiming the next game.`);
      return true;
    }

    await recoverStep({ file: sessionFile, label: "Managed-development sync", operation: syncDevelopment, repair });
    let urls: string[] = [];
    if (!skipProduction) {
      urls = await recoverStep({ file: sessionFile, label: "Production publication", operation: () => requestProduction(dev, row, resultRoot, result),
        repair: async (sessionId, error) => { await repair(sessionId, error); await syncDevelopment(); } });
    }
    await transition(dev, row, {
      status: "managed_dev_ready",
      managed_dev_completed_at: new Date().toISOString(),
      suggestions_path: result.suggestionsPath,
      result_root: resultRoot,
      wiki_final_path: result.wikiFinalPath,
      approved_collections: result.approvedCollections,
      blocked_collections: result.blockedCollections,
      collection_manifests: result.collectionManifests,
      lease_token: null,
      lease_owner: null,
      lease_expires_at: null,
      processing_slot: null
    });
    leaseActive = false;
    if (skipProduction) {
      console.log(`[lane ${lane}] Managed-dev workflow complete; production release disabled.`);
      return true;
    }
    const { error } = await dev.from("wiki_generation_queue").update({
      status: "published",
      published_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      production_receipt: { urls, verified_at: new Date().toISOString() },
      last_error: null
    }).eq("id", row.id).eq("status", "managed_dev_ready");
    if (error) throw new Error(`Could not record wiki publication: ${error.message}`);
    const session = await readSessionState(sessionFile);
    await saveSessionState(sessionFile, { ...session, completed: true, lastError: undefined });
    console.log(`[lane ${lane}] Published and verified ${row.game_name}: ${urls.join(", ")}`);
    return true;
    } finally { clearInterval(heartbeatTimer); }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[lane ${lane}] ${message}`);
    if (leaseActive && activeRow?.lease_token && activeRow.lease_owner) {
      const terminal = activeRow.attempts >= activeRow.max_attempts;
      const delayMinutes = Math.min(60, 15 * 2 ** Math.max(0, activeRow.attempts - 1));
      const failure = await dev.from("wiki_generation_queue").update({
        status: terminal ? "failed" : "retry",
        last_error: message.slice(0, 4000),
        next_attempt_at: terminal ? null : new Date(Date.now() + delayMinutes * 60_000).toISOString(),
        completed_at: terminal ? new Date().toISOString() : null,
        lease_token: null,
        lease_owner: null,
        lease_expires_at: null,
        processing_slot: null
      }).eq("id", activeRow.id).eq("status", "processing")
        .eq("lease_token", activeRow.lease_token).eq("lease_owner", activeRow.lease_owner);
      if (failure.error) throw new Error(`Could not record wiki retry state: ${failure.error.message}`);
      return true;
    }
    throw error;
  }
}

async function main() {
  if (process.env.WIKI_AUTOMATION_BATCH_CONTEXT === "1") {
    console.log("Nested wiki automation invocation ignored; the outer homelab batch already owns this run.");
    return;
  }
  assertOptions();
  assertCleanCheckout("startup");
  if (!releaseOnly) await access(codexBin, fsConstants.X_OK);
  const devCredentials = resolveWikiDevCredentials();
  const dev = createClient(devCredentials.url, devCredentials.serviceRole, { auth: { autoRefreshToken: false, persistSession: false } });
  if (!apply) {
    await previewNext(dev);
    return;
  }
  if (releaseOnly) {
    productionEnvironment();
    while (await releaseRequestedWiki(dev)) { /* Trusted publisher never runs model turns or takes the model lock. */ }
    return;
  }
  let lock = await acquireAgentWorkLock(worktree, "wiki-automation");
  while (!lock && !stopRequested) {
    console.log("Another article or wiki agent workflow is active; waiting 60 seconds without interrupting it.");
    await new Promise((resolve) => setTimeout(resolve, 60_000));
    lock = await acquireAgentWorkLock(worktree, "wiki-automation");
  }
  if (!lock) return;
  try {
    let claimedGames = 0;
    const reserveClaim = () => {
      if (maxGamesPerRun === 0) return true;
      if (claimedGames >= maxGamesPerRun) return false;
      claimedGames += 1;
      return true;
    };
    const releaseUnusedClaim = () => {
      if (maxGamesPerRun > 0) claimedGames -= 1;
    };
    const workers = Array.from({ length: workerCount }, (_, index) => (async () => {
      const lane = index + 1;
      while (!stopRequested) {
        if (!reserveClaim()) {
          console.log(`[lane ${lane}] Shared ${maxGamesPerRun}-game run limit reached.`);
          return;
        }
        const worked = await runOne(dev, devCredentials, lane);
        if (worked) continue;
        if (queueId) { console.log(`Requested queue row ${queueId} is not claimable.`); return; }
        releaseUnusedClaim();
        const delay = await retryDelay(dev);
        if (delay === null) {
          console.log(`[lane ${lane}] No top-100 game without a durable wiki queue result remains.`);
          return;
        }
        console.log(`[lane ${lane}] Waiting ${Math.ceil(delay / 1000)} seconds for a retryable game.`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    })().catch((error) => {
      stopRequested = true;
      for (const child of activeChildren) terminateProcessGroup(child, "SIGTERM");
      throw error;
    }));

    const settled = await Promise.allSettled(workers);
    const failure = settled.find((entry): entry is PromiseRejectedResult => entry.status === "rejected");
    if (failure) throw failure.reason;
    console.log(maxGamesPerRun > 0
      ? `Wiki processing stopped after the configured ${maxGamesPerRun}-game limit.`
      : "Continuous wiki processing stopped because every current top-100 game has a durable queue result.");
  } finally {
    await lock();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

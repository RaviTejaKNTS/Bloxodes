import "../shared/load-env";

import { spawn, spawnSync } from "node:child_process";
import { access, mkdir, readFile, realpath } from "node:fs/promises";
import { constants as fsConstants, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { parse as parseDotenv } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { articleGameSlugFromUniverse } from "@/lib/slug";
import { fetchProductionEditorialInventory } from "../articles/production-editorial-inventory";
import { buildCodexExecArgs } from "../articles/article-writer-provider";
import { acquireAgentWorkLock } from "../shared/agent-work-lock";
import { isProductionSupabaseUrl } from "../shared/supabase-target";
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

const worktree = path.resolve(process.env.WIKI_AUTOMATION_WORKTREE?.trim() || process.cwd());
const timeoutMinutes = Number(process.env.WIKI_AUTOMATION_TIMEOUT_MINUTES || "660");
const leaseMinutes = Math.min(720, Math.max(30, timeoutMinutes + 30));
const codexBin = process.env.WIKI_AUTOMATION_CODEX_BIN?.trim() || path.join(os.homedir(), ".local", "bin", "codex");
const productionEnvFile = path.resolve(process.env.WIKI_RELEASE_PRODUCTION_ENV_FILE?.trim() || ".envs/targets/production.env");
const apply = process.argv.includes("--apply");
const skipProduction = process.argv.includes("--skip-production-release");

function assertOptions() {
  if (!Number.isInteger(timeoutMinutes) || timeoutMinutes < 60 || timeoutMinutes > 690) {
    throw new Error("WIKI_AUTOMATION_TIMEOUT_MINUTES must be an integer from 60 to 690.");
  }
  if (process.env.WIKI_AUTOMATION_CODEX_MODEL && process.env.WIKI_AUTOMATION_CODEX_MODEL !== "gpt-5.6-luna") {
    throw new Error("Wiki automation is fixed to gpt-5.6-luna.");
  }
  if (process.env.WIKI_AUTOMATION_CODEX_REASONING && process.env.WIKI_AUTOMATION_CODEX_REASONING !== "max") {
    throw new Error("Wiki automation is fixed to max reasoning.");
  }
}

function assertCleanCheckout(context: string) {
  const result = spawnSync("git", ["status", "--porcelain"], { cwd: worktree, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`Could not inspect git status during ${context}: ${result.stderr.trim()}`);
  if (result.stdout.trim()) throw new Error(`Wiki automation requires a clean checkout during ${context}.`);
}

async function fetchTop100(): Promise<StatsGame[]> {
  const games: StatsGame[] = [];
  for (const page of [1, 2]) {
    const response = await fetch(`https://bloxodes.com/api/stats/games?page=${page}&limit=50&sort=playing`, {
      headers: { Accept: "application/json", "User-Agent": "BloxodesWikiAutomation/1.0" },
      signal: AbortSignal.timeout(30_000)
    });
    if (!response.ok) throw new Error(`Top-games API returned ${response.status}.`);
    const payload = await response.json() as { games?: StatsGame[] };
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
  const payload = {
    universe_id: game.universeId,
    root_place_id: game.rootPlaceId,
    name: game.name,
    display_name: game.displayName || game.name,
    slug: game.slug,
    description: game.description ?? null,
    creator_name: game.creatorName ?? null,
    creator_type: game.creatorType ?? null,
    genre_l1: game.genre ?? null,
    genre_l2: game.subgenre ?? null,
    icon_url: game.iconUrl ?? null,
    playing: game.playing ?? null,
    visits: game.visits ?? null,
    raw_metadata: { source: "production-top-games-api", rank: game.rank, mirrored_at: new Date().toISOString() }
  };
  const { error } = await dev.from("roblox_universes").upsert(payload, { onConflict: "universe_id" });
  if (error) throw new Error(`Could not mirror universe ${game.universeId} to managed dev: ${error.message}`);
}

async function enqueueNext(dev: SupabaseClient): Promise<QueueRow | null> {
  const [top100, inventory, queueResult] = await Promise.all([
    fetchTop100(),
    fetchProductionEditorialInventory(),
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

async function claim(dev: SupabaseClient): Promise<QueueRow | null> {
  const worker = `${os.hostname()}-wiki-homelab`;
  const { data, error } = await dev.rpc("claim_wiki_generation_queue_item", {
    p_worker: worker,
    p_lease_minutes: leaseMinutes
  });
  if (error) throw new Error(`Wiki queue claim failed: ${error.message}`);
  const row = Array.isArray(data) ? data[0] : data;
  return row ? row as QueueRow : null;
}

function modelEnvironment(dev: { url: string; serviceRole: string }): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const key of MODEL_FORBIDDEN_ENV_KEYS) delete env[key];
  for (const key of Object.keys(env)) {
    if (/PRODUCTION|DOKPLOY|SUPABASE_DB_PASSWORD/i.test(key)) delete env[key];
  }
  env.BLOXODES_ENV_PROFILE = "managed-dev";
  env.NODE_ENV = "development";
  env.BLOXODES_ENV_OVERLAYS = "";
  env.SUPABASE_URL = dev.url;
  env.SUPABASE_SERVICE_ROLE = dev.serviceRole;
  env.WIKI_DEV_SUPABASE_URL = dev.url;
  env.WIKI_DEV_SUPABASE_SERVICE_ROLE = dev.serviceRole;
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

Required workflow:
1. Read and follow .agents/skills/bloxodes-game-collection-suggestions/SKILL.md. Save its evidence-complete suggestion record under the artifact root.
2. As the parent, approve only defensible [create] suggestions. A source-incomplete or partial roster is blocked, never guessed.
3. Read and follow .agents/skills/bloxodes-game-collection-workflow-runner/SKILL.md for every approved collection. Let that runner delegate its research, data, images, and writing gates exactly as the skill requires, but keep no more than two collection subagents active at once.
4. Read and follow .agents/skills/bloxodes-wiki-workflow-runner/SKILL.md for the hub.
5. Use task-local runtime-manifest.json files and scripts/collections/sync-game-collection-runtime.ts. Publish verified datasets and media to managed development and the shared bloxodes-wiki R2 bucket. Do not register collections in source code and do not add local data/public media.
6. Use scripts/collections/sync-game-wiki-runtime.ts to publish the hub to managed development.
7. Run the final copy/data/media, managed-dev readback, localhost route, metadata, pagination, sitemap, HTML-size, typecheck, git diff, and rendered Browser/Chromium gates required by the skills. Tracked source must remain unchanged.

Security:
- This process is managed-development only. Never read .envs, /etc/bloxodes, production credentials, or production infrastructure.
- Never write production. The outer runner performs exact-game production release after your process exits.

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
Ready requires a verified hub and at least one verified collection. If no collection clears the evidence gates, write blocked honestly.`;
}

async function runCommand(command: string, args: string[], env: NodeJS.ProcessEnv, timeoutMs?: number) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { cwd: worktree, env, stdio: "inherit", shell: false });
    const timer = timeoutMs ? setTimeout(() => {
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 15_000).unref();
    }, timeoutMs) : null;
    timer?.unref();
    child.on("error", reject);
    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with ${code ?? "unknown"}.`));
    });
  });
}

async function readWorkflowResult(row: QueueRow, resultRoot: string): Promise<WorkflowResult> {
  const root = await realpath(resultRoot);
  const file = path.join(root, "workflow-result.json");
  const result = JSON.parse(await readFile(file, "utf8")) as WorkflowResult;
  if (result.queueId !== row.id || result.universeId !== row.universe_id || result.wikiSlug !== row.wiki_slug) {
    throw new Error("Workflow result identity does not match the claimed queue row.");
  }
  const paths = [result.suggestionsPath, result.wikiFinalPath, ...(result.collectionManifests ?? [])].filter(Boolean) as string[];
  for (const candidate of paths) {
    const resolved = await realpath(candidate);
    if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) throw new Error(`Artifact escapes result root: ${candidate}`);
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
  env.BLOXODES_ENV_PROFILE = "production";
  env.BLOXODES_ENV_OVERLAYS = "";
  return env;
}

async function release(result: WorkflowResult) {
  const inventory = await fetchProductionEditorialInventory();
  const collisions = inventory.items.filter(
    (item) => item.family === "wiki" && (item.universe_id === result.universeId || item.key === result.wikiSlug)
  );
  if (collisions.some((item) => item.universe_id !== result.universeId || item.key !== result.wikiSlug)) {
    throw new Error(`Production wiki identity collision: ${JSON.stringify(collisions)}.`);
  }
  const env = productionEnvironment();
  for (const manifest of result.collectionManifests) {
    await runCommand("node", ["--import", "tsx", "scripts/collections/sync-game-collection-runtime.ts", "--manifest", manifest, "--apply", "--publish", "--allow-prod"], env);
  }
  await runCommand("node", ["--import", "tsx", "scripts/collections/sync-game-wiki-runtime.ts", "--final-json", result.wikiFinalPath!, "--game", result.wikiSlug, "--universe-id", String(result.universeId), "--apply", "--allow-prod"], env);
  const urls = [`https://bloxodes.com/wiki/${result.wikiSlug}`, ...result.approvedCollections.map((slug) => `https://bloxodes.com/wiki/${result.wikiSlug}/${slug}`)];
  for (const url of urls) {
    let ok = false;
    for (let attempt = 0; attempt < 24; attempt += 1) {
      const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(30_000) });
      if (response.status === 200 && (await response.text()).includes(result.wikiSlug.split("-")[0])) { ok = true; break; }
      await new Promise((resolve) => setTimeout(resolve, 5_000));
    }
    if (!ok) throw new Error(`Live verification failed for ${url}.`);
  }
  return urls;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string" && Boolean(entry.trim()))
    : [];
}

async function releaseManagedDevReady(dev: SupabaseClient): Promise<boolean> {
  if (skipProduction) return false;
  const query = await dev.from("wiki_generation_queue").select("*")
    .eq("status", "managed_dev_ready")
    .order("managed_dev_completed_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (query.error) throw new Error(`Could not inspect pending wiki releases: ${query.error.message}`);
  if (!query.data) return false;
  const row = query.data as QueueRow & {
    approved_collections?: unknown;
    blocked_collections?: unknown;
    suggestions_path?: string | null;
  };
  if (!row.result_root || !row.wiki_final_path) throw new Error(`Managed-dev-ready row ${row.id} has incomplete artifact paths.`);
  const manifests = stringArray(row.collection_manifests);
  const approved = stringArray(row.approved_collections);
  if (!manifests.length || !approved.length) throw new Error(`Managed-dev-ready row ${row.id} has no collection artifacts.`);
  await readWorkflowResult(row, row.result_root);
  const result: WorkflowResult = {
    queueId: row.id,
    universeId: row.universe_id,
    wikiSlug: row.wiki_slug,
    outcome: "ready",
    suggestionsPath: row.suggestions_path || "",
    wikiFinalPath: row.wiki_final_path,
    approvedCollections: approved,
    blockedCollections: Array.isArray(row.blocked_collections)
      ? row.blocked_collections as Array<{ slug: string; reason: string }>
      : [],
    collectionManifests: manifests
  };
  const urls = await release(result);
  const update = await dev.from("wiki_generation_queue").update({
    status: "published",
    published_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    production_receipt: { urls, verified_at: new Date().toISOString() },
    last_error: null
  }).eq("id", row.id).eq("status", "managed_dev_ready");
  if (update.error) throw new Error(`Could not record resumed wiki publication: ${update.error.message}`);
  console.log(`Resumed, published, and verified ${row.game_name}: ${urls.join(", ")}`);
  return true;
}

async function main() {
  assertOptions();
  assertCleanCheckout("startup");
  await access(codexBin, fsConstants.X_OK);
  const devCredentials = resolveWikiDevCredentials();
  const dev = createClient(devCredentials.url, devCredentials.serviceRole, { auth: { autoRefreshToken: false, persistSession: false } });
  const lock = await acquireAgentWorkLock(worktree, "wiki-automation");
  if (!lock) { console.log("Another article or wiki agent workflow is active; this two-hour tick was skipped."); return; }
  let activeRow: QueueRow | null = null;
  try {
    if (await releaseManagedDevReady(dev)) return;
    let row = await claim(dev);
    if (!row) {
      const enqueued = await enqueueNext(dev);
      if (!enqueued) { console.log("No top-100 game without a wiki remains."); return; }
      row = await claim(dev);
    }
    if (!row) throw new Error("A queue row was enqueued but could not be claimed.");
    activeRow = row;
    console.log(`Claimed ${row.game_name} (${row.id}), attempt ${row.attempts}/${row.max_attempts}.`);
    if (!apply) {
      await transition(dev, row, { status: "retry", lease_token: null, lease_owner: null, lease_expires_at: null, next_attempt_at: new Date().toISOString(), last_error: "Dry-run claim released." });
      console.log("Dry run complete; Codex was not started.");
      return;
    }

    const resultRoot = path.join(worktree, "tmp", "wiki-automation", row.id);
    await mkdir(resultRoot, { recursive: true });
    const heartbeatTimer = setInterval(() => void heartbeat(dev, row!).catch((error) => console.error(error)), 5 * 60_000);
    heartbeatTimer.unref();
    let result: WorkflowResult;
    try {
      const args = buildCodexExecArgs({ worktree, model: "gpt-5.6-luna", reasoningEffort: "max", prompt: promptFor(row, resultRoot) });
      await runCommand(codexBin, args, modelEnvironment(devCredentials), timeoutMinutes * 60_000);
      assertCleanCheckout("post-agent verification");
      result = await readWorkflowResult(row, resultRoot);
    } finally {
      clearInterval(heartbeatTimer);
    }

    if (result.outcome === "blocked") {
      await transition(dev, row, {
        status: "blocked", completed_at: new Date().toISOString(), outcome_reason: result.outcomeReason || "No collection cleared the evidence gates.",
        suggestions_path: result.suggestionsPath, result_root: resultRoot, approved_collections: result.approvedCollections,
        blocked_collections: result.blockedCollections, lease_token: null, lease_owner: null, lease_expires_at: null
      });
      console.log(`Blocked ${row.game_name} honestly; the next tick will move to the next game.`);
      return;
    }

    const devEnv = modelEnvironment(devCredentials);
    await runCommand("node", ["--import", "tsx", "scripts/collections/sync-game-wiki-runtime.ts", "--final-json", result.wikiFinalPath!, "--game", row.wiki_slug, "--universe-id", String(row.universe_id)], devEnv);
    for (const manifest of result.collectionManifests) {
      await runCommand("node", ["--import", "tsx", "scripts/collections/sync-game-collection-runtime.ts", "--manifest", manifest], devEnv);
    }
    await transition(dev, row, {
      status: "managed_dev_ready", managed_dev_completed_at: new Date().toISOString(), suggestions_path: result.suggestionsPath,
      result_root: resultRoot, wiki_final_path: result.wikiFinalPath, approved_collections: result.approvedCollections,
      blocked_collections: result.blockedCollections, collection_manifests: result.collectionManifests,
      lease_token: null, lease_owner: null, lease_expires_at: null
    });
    if (skipProduction) { console.log("Managed-dev workflow complete; production release disabled."); return; }
    const urls = await release(result);
    const { error } = await dev.from("wiki_generation_queue").update({
      status: "published", published_at: new Date().toISOString(), completed_at: new Date().toISOString(),
      production_receipt: { urls, verified_at: new Date().toISOString() }
    }).eq("id", row.id).eq("status", "managed_dev_ready");
    if (error) throw new Error(`Could not record wiki publication: ${error.message}`);
    console.log(`Published and verified ${row.game_name}: ${urls.join(", ")}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    if (activeRow?.lease_token && activeRow.lease_owner) {
      const terminal = activeRow.attempts >= activeRow.max_attempts;
      const delayMinutes = Math.min(60, 15 * 2 ** Math.max(0, activeRow.attempts - 1));
      const failure = await dev.from("wiki_generation_queue").update({
        status: terminal ? "failed" : "retry",
        last_error: message.slice(0, 4000),
        next_attempt_at: terminal ? null : new Date(Date.now() + delayMinutes * 60_000).toISOString(),
        completed_at: terminal ? new Date().toISOString() : null,
        lease_token: null,
        lease_owner: null,
        lease_expires_at: null
      }).eq("id", activeRow.id).eq("status", "processing")
        .eq("lease_token", activeRow.lease_token).eq("lease_owner", activeRow.lease_owner);
      if (failure.error) console.error(`Could not record wiki retry state: ${failure.error.message}`);
    }
    throw error;
  } finally {
    await lock();
  }
}

main().catch(() => { process.exitCode = 1; });

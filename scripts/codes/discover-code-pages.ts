import { discoveryExitCode } from "./command-outcome";
import { fetchPlaceDetails } from "@/lib/roblox/universe";
import { loadBloxodesEnv } from "../shared/env-files";

process.env.BLOXODES_ENV_PROFILE ??= "production-preview";
loadBloxodesEnv();
import { createClient } from "@supabase/supabase-js";
import { load } from "cheerio";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { CodesQueue, FatalDiscoveryError, makeRequest } from "./discovery-io";
import { beebomArticles, emptyState, initializeRobloxdenBaseline, queueDecision, observeCandidates, processPendingBatch, ResolutionError, OperationalDiscoveryError, resolveName, robloxPlaceIds, sitemapSlugs, titleToName, type DiscoveryState } from "./discovery-model";

async function main() {
  const dry = process.argv.includes("--dry-run");
  const statePath = process.env.CODES_DISCOVERY_STATE_PATH || path.resolve("tmp/codes-discovery/state.json");
  const deadline = AbortSignal.timeout(15 * 60_000);
  const request = makeRequest(deadline);
  if (!process.env.NOTION_CODES_QUEUE_TOKEN) throw new FatalDiscoveryError("NOTION_CODES_QUEUE_TOKEN is required");
  const queue = new CodesQueue(request, process.env.NOTION_CODES_QUEUE_TOKEN);
  await queue.validate();
  // Only SELECT is allowed through this client, even if the supplied key has wider privileges.
  const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE!, { global: {
    fetch: (url, init) => {
      if (init?.method && init.method !== "GET" && init.method !== "HEAD") throw new FatalDiscoveryError("Discovery database is read-only");
      return fetch(url, { ...init, signal: AbortSignal.any([deadline, AbortSignal.timeout(20_000)]) });
    }
  } });
  let state: DiscoveryState;
  try { state = JSON.parse(await readFile(statePath, "utf8")); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw new FatalDiscoveryError("Cannot read discovery state; refusing to reset baseline"); state = emptyState(); }
  if (state.version !== 1 || !state.entries || typeof state.robloxdenBaseline !== "boolean") throw new FatalDiscoveryError("Invalid discovery state");
  const save = async () => {
    if (dry) return;
    await mkdir(path.dirname(statePath), { recursive: true });
    const temp = `${statePath}.${process.pid}.tmp`;
    await writeFile(temp, JSON.stringify(state), { mode: 0o600 }); await rename(temp, statePath);
  };
  const stats: Record<string, number> = { newSlugs: 0, queued: 0, merged: 0, existingPublished: 0, existingUnpublished: 0, alreadyQueued: 0, unresolved: 0, retried: 0, givenUp: 0, fetched: 0 };
  const slugs = sitemapSlugs(await request("https://robloxden.com/sitemap.xml", {}, true));
  if (!slugs.length) throw new FatalDiscoveryError("RobloxDen sitemap contains no game codes pages");
  initializeRobloxdenBaseline(state, slugs);
  stats.newSlugs = await observeCandidates(state, slugs.map(slug => `den:${slug}`), save);
  const articles = beebomArticles(await request("https://beebom.com/tag/roblox-codes/", {}, true));
  if (!articles.length) throw new FatalDiscoveryError("Beebom tag page contains no codes articles");
  stats.newSlugs += await observeCandidates(state, articles.map(url => `bee:${url}`), save);
  // Exact normalized matches require the complete universe inventory, not a truncated API response.
  const names: Array<{ universe_id: number; root_place_id: number | null; name: string | null; display_name?: string | null }> = [];
  for (let start = 0; ; start += 1000) {
    const result = await sb.from("roblox_universes").select("universe_id,root_place_id,name,display_name").order("universe_id").range(start, start + 999);
    if (result.error) throw new FatalDiscoveryError(`Universe database read failed: ${result.error.message}`);
    names.push(...result.data); if (result.data.length < 1000) break;
  }
  await processPendingBatch(state, { signal: deadline, save, process: async key => {
    if (state.entries[key]?.attempts) stats.retried++;
    const den = key.startsWith("den:");
    const url = den ? `https://robloxden.com/game-codes/${key.slice(4)}` : key.slice(4);
    stats.fetched++;
    const html = await request(url);
    const $ = load(html); const name = titleToName($("title").text() || $("h1").first().text());
    const placeIds = robloxPlaceIds(html);
    let game: { universe_id: number; root_place_id: number; name: string };
    if (placeIds.length === 1) {
      const detail = await fetchPlaceDetails(String(placeIds[0]), async (url) => new Response(await request(String(url)), { headers: { "Content-Type": "application/json" } }));
      if (!detail || !detail.universeId || !Number.isSafeInteger(detail.universeId) || detail.universeId <= 0) throw new OperationalDiscoveryError("Roblox universe lookup failed");
      game = { universe_id: detail!.universeId!, root_place_id: detail!.rootPlaceId || placeIds[0], name: detail!.name || name };
      names.push(game);
    } else if (placeIds.length > 1) throw new ResolutionError("Ambiguous Roblox game links");
    else {
      const match = resolveName(name, names);
      if (!match?.root_place_id) throw new ResolutionError(`Unresolved or ambiguous game name: ${name}`);
      game = { universe_id: match.universe_id, root_place_id: match.root_place_id, name: match.name || name };
    }
    const existing = await sb.from("code_pages").select("is_published").eq("universe_id", game.universe_id);
    if (existing.error) throw new FatalDiscoveryError(`Code pages database read failed: ${existing.error.message}`);
    let reason: string;
    if (existing.data.length) {
      reason = queueDecision(existing.data.find(row => !row.is_published) ?? existing.data[0], null, url) === "existing-unpublished" ? "existingUnpublished" : "existingPublished"; stats[reason]++;
    } else {
      const action = await queue.put(game, den ? "RobloxDen" : "Beebom", url, dry);
      reason = action; stats[action === "create" ? "queued" : action === "merge" ? "merged" : "alreadyQueued"]++;
    }
    state.entries[key] = { attempts: state.entries[key]?.attempts || 0, done: reason }; await save();
    return reason === "create";
  } });
  stats.unresolved = Object.values(state.entries).filter(entry => entry.error && !entry.done).length;
  stats.givenUp = Object.values(state.entries).filter(entry => entry.done?.startsWith("given-up:")).length;
  // Keep unresolved and given-up URLs visible in the single-line run report.
  console.log(JSON.stringify({ ...stats, problems: Object.entries(state.entries).filter(([, entry]) => entry.error).map(([key, entry]) => ({ key, ...entry })) }));
}
const timer = setTimeout(() => { console.error("Codes discovery failed: whole-run deadline exceeded"); process.exit(1); }, 16 * 60_000);
discoveryExitCode(main).then(code => { process.exitCode = code; }).finally(() => clearTimeout(timer));

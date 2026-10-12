import "../shared/load-env";
import { writeFile } from "node:fs/promises";

import { supabaseAdmin } from "@/lib/supabase-admin";

const SELECT_FIELDS = [
  "asset_id",
  "title",
  "artist",
  "album",
  "genre",
  "duration_seconds",
  "thumbnail_url",
  "rank",
  "source",
  "raw_payload",
  "first_seen_at",
  "last_seen_at",
  "verified_at",
  "vote_count",
  "upvote_percent",
  "creator_verified",
  "popularity_score"
].join(",");

const READ_PAGE_SIZE = clampNumber(process.env.ROBLOX_MUSIC_RERANK_READ_PAGE_SIZE, 1000, 100, 5000);
const WRITE_CHUNK_SIZE = clampNumber(process.env.ROBLOX_MUSIC_RERANK_WRITE_CHUNK_SIZE, 500, 50, 1000);
const MAX_ROWS = clampNumber(process.env.ROBLOX_MUSIC_RERANK_MAX_ROWS, 0, 0, Number.POSITIVE_INFINITY);
const DRY_RUN = toBoolean(process.env.ROBLOX_MUSIC_RERANK_DRY_RUN, false);
const MIN_SCORE_DELTA = clampNumber(process.env.ROBLOX_MUSIC_RERANK_MIN_SCORE_DELTA, 0.01, 0, 100000);

type MusicRow = {
  asset_id: number;
  title: string | null;
  artist: string | null;
  album: string | null;
  genre: string | null;
  duration_seconds: number | null;
  thumbnail_url: string | null;
  rank: number | null;
  source: string | null;
  raw_payload: Record<string, unknown> | null;
  first_seen_at: string | null;
  last_seen_at: string | null;
  verified_at: string | null;
  vote_count: number | null;
  upvote_percent: number | null;
  creator_verified: boolean | null;
  popularity_score: number | null;
};

type ScoreUpdate = {
  asset_id: number;
  title: string;
  artist: string;
  source: string;
  raw_payload: Record<string, unknown>;
  first_seen_at: string;
  last_seen_at: string;
  popularity_score: number;
};

type AutomationSummary = {
  type: "music-ids";
  stats: {
    reranked: number;
    scanned: number;
    updated: number;
    dryRun: boolean;
    topPreview: Array<{ assetId: number; title: string | null; source: string | null; score: number }>;
  };
};

function clampNumber(raw: string | undefined, fallback: number, min: number, max: number): number {
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function toBoolean(value: string | undefined, fallback = false): boolean {
  if (value === undefined) return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "y"].includes(normalized)) return true;
  if (["0", "false", "no", "n"].includes(normalized)) return false;
  return fallback;
}

function ageInDays(value: string | null): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return null;
  return Math.max(0, (Date.now() - time) / (1000 * 60 * 60 * 24));
}

function textReady(value: string | null, unknown: string): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 && normalized !== unknown;
}

function sourceWeight(source: string | null): number {
  switch (source) {
    case "music_discovery_top_songs":
      return 90;
    case "music_discovery_top_100":
      return 70;
    case "creator_store_top_current":
      return 210;
    case "creator_store_trending":
      return 190;
    case "creator_store_top_week":
      return 185;
    case "creator_store_top_month":
      return 140;
    case "creator_store_top_year":
      return 95;
    case "toolbox_music_search":
      return 45;
    case "seed_web":
      return 10;
    default:
      return 20;
  }
}

function sourceFreshnessWeight(source: string | null): number {
  switch (source) {
    case "creator_store_top_current":
    case "creator_store_trending":
    case "creator_store_top_week":
    case "creator_store_top_month":
    case "creator_store_top_year":
      return 1;
    case "music_discovery_top_songs":
      return 0.65;
    case "music_discovery_top_100":
      return 0.45;
    case "toolbox_music_search":
      return 0.35;
    default:
      return 0.15;
  }
}

function isDailyDiscoverySource(source: string | null): boolean {
  return source === "music_discovery_top_songs" || source === "music_discovery_top_100";
}

function chartRank(row: MusicRow): number | null {
  const meta = row.raw_payload?._meta;
  if (!meta || typeof meta !== "object") return null;
  const rank = (meta as Record<string, unknown>).chartRank;
  return typeof rank === "number" && Number.isFinite(rank) && rank > 0 ? rank : null;
}

function computeScore(row: MusicRow): number {
  const lastSeenDays = ageInDays(row.last_seen_at);
  const firstSeenDays = ageInDays(row.first_seen_at);
  const verifiedDays = ageInDays(row.verified_at);
  const rank = typeof row.rank === "number" && Number.isFinite(row.rank) && row.rank > 0 ? row.rank : null;
  const creatorStoreRank = chartRank(row);

  const freshnessWeight = sourceFreshnessWeight(row.source);
  const recentSeenBoost = lastSeenDays === null ? 0 : Math.max(0, 180 - lastSeenDays) * 2.1 * freshnessWeight;
  const newDiscoveryBoost = firstSeenDays === null ? 0 : Math.max(0, 45 - firstSeenDays) * 2;
  const verifiedBoost = verifiedDays === null ? 0 : Math.max(0, 90 - verifiedDays) * 0.5;
  const rankBoost = rank ? Math.max(0, 520 - rank) * 0.08 : 0;
  const chartRankBoost = creatorStoreRank ? Math.max(0, 1100 - creatorStoreRank) * 0.35 : 0;
  const voteBoost = Math.log10(Math.max(0, row.vote_count ?? 0) + 1) * 75;
  const upvoteBoost = Math.max(0, Math.min(100, row.upvote_percent ?? 0)) * 2.5;
  const creatorBoost = row.creator_verified ? 70 : 0;
  const duration = row.duration_seconds ?? 0;
  const durationBoost = duration >= 90 && duration <= 300 ? 90 : duration > 0 && duration < 600 ? 35 : -120;
  const metadataBoost =
    (textReady(row.title, "unknown title") ? 25 : -80) +
    (textReady(row.artist, "unknown artist") ? 25 : -70) +
    (row.album ? 10 : 0) +
    (row.genre ? 30 : 0) +
    (row.thumbnail_url ? 25 : 0);
  const stalePenalty =
    lastSeenDays === null ? 180 :
      lastSeenDays > 365 ? 900 :
        lastSeenDays > 180 ? 450 :
          0;
  const dailyDiscoveryPenalty = isDailyDiscoverySource(row.source) && rank ? 180 : 0;

  return Math.max(
    0,
    sourceWeight(row.source) +
    recentSeenBoost +
    newDiscoveryBoost +
    verifiedBoost +
    rankBoost +
    chartRankBoost +
    voteBoost +
    upvoteBoost +
    creatorBoost +
    durationBoost +
    metadataBoost -
    stalePenalty -
    dailyDiscoveryPenalty
  );
}

async function loadRows(): Promise<MusicRow[]> {
  const sb = supabaseAdmin();
  const rows: MusicRow[] = [];
  let from = 0;

  while (true) {
    const remaining = MAX_ROWS > 0 ? MAX_ROWS - rows.length : Number.POSITIVE_INFINITY;
    if (remaining <= 0) break;
    const pageSize = Math.min(READ_PAGE_SIZE, remaining);
    const { data, error } = await sb
      .from("roblox_music_ids")
      .select(SELECT_FIELDS)
      .order("asset_id", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) {
      throw new Error(`Failed to load music IDs for rerank: ${error.message}`);
    }

    const page = (data ?? []) as MusicRow[];
    rows.push(...page);
    if (page.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

async function writeUpdates(updates: ScoreUpdate[]) {
  if (DRY_RUN || updates.length === 0) return;
  const sb = supabaseAdmin();
  for (let i = 0; i < updates.length; i += WRITE_CHUNK_SIZE) {
    const chunk = updates.slice(i, i + WRITE_CHUNK_SIZE);
    const { error } = await sb.from("roblox_music_ids").upsert(chunk, { onConflict: "asset_id" });
    if (error) {
      throw new Error(`Failed to write rerank chunk: ${error.message}`);
    }
  }
}

async function updateCatalogTimestamp() {
  if (DRY_RUN) return false;
  const sb = supabaseAdmin();
  const { error } = await sb
    .from("catalog_pages")
    .update({ updated_at: new Date().toISOString() })
    .eq("code", "roblox-music-ids");
  if (error) {
    console.warn(`Catalog timestamp update failed: ${error.message}`);
    return false;
  }
  return true;
}

async function writeAutomationSummary(summary: AutomationSummary) {
  const summaryPath = process.env.AUTOMATION_SUMMARY_PATH;
  if (!summaryPath) return;
  await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
}

async function run() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE must be set.");
  }

  const rows = await loadRows();
  const scored = rows.map((row) => ({
    row,
    score: Number(computeScore(row).toFixed(3))
  }));
  const updates = scored
    .filter(({ row, score }) => Math.abs(score - (row.popularity_score ?? 0)) >= MIN_SCORE_DELTA)
    .flatMap(({ row, score }) => {
      if (!row.title || !row.artist || !row.source || !row.first_seen_at || !row.last_seen_at) return [];
      return [{
        asset_id: row.asset_id,
        title: row.title,
        artist: row.artist,
        source: row.source,
        raw_payload: row.raw_payload ?? {},
        first_seen_at: row.first_seen_at,
        last_seen_at: row.last_seen_at,
        popularity_score: score
      }];
    });

  await writeUpdates(updates);
  const catalogTimestampUpdated = await updateCatalogTimestamp();
  const topPreview = scored
    .slice()
    .sort((a, b) => b.score - a.score || a.row.asset_id - b.row.asset_id)
    .slice(0, 10)
    .map(({ row, score }) => ({
      assetId: row.asset_id,
      title: row.title,
      source: row.source,
      score
    }));

  console.log(
    `Rerank complete. Scanned ${rows.length}, ${DRY_RUN ? "would update" : "updated"} ${updates.length}.`
  );
  if (catalogTimestampUpdated) {
    console.log("Catalog page timestamp updated.");
  }
  console.table(topPreview);

  await writeAutomationSummary({
    type: "music-ids",
    stats: {
      reranked: rows.length,
      scanned: rows.length,
      updated: updates.length,
      dryRun: DRY_RUN,
      topPreview
    }
  });
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

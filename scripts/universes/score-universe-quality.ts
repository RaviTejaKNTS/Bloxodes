import "../shared/load-env";

import { supabaseAdmin } from "@/lib/supabase-admin";

const DEFAULT_LIMIT = Number(process.env.ROBLOX_QUALITY_LIMIT ?? "0");
const BATCH_SIZE = Number(process.env.ROBLOX_QUALITY_BATCH ?? "500");

type UniverseRow = {
  universe_id: number;
  name: string | null;
  display_name: string | null;
  description: string | null;
  icon_url: string | null;
  thumbnail_urls: unknown;
  creator_has_verified_badge: boolean | null;
  group_has_verified_badge: boolean | null;
  visibility: string | null;
  privacy_type: string | null;
  is_active: boolean | null;
  is_archived: boolean | null;
  is_sponsored: boolean | null;
  playing: number | null;
  visits: number | null;
  favorites: number | null;
  likes: number | null;
  dislikes: number | null;
  last_seen_in_sort: string | null;
  last_seen_in_search: string | null;
  updated_at_api: string | null;
};

type ScoreResult = {
  score: number;
  tier: "A" | "B" | "C" | "D" | "archive";
  candidate: boolean;
  reasons: string[];
};

function logScore(value: number | null | undefined, weight: number) {
  const safeValue = typeof value === "number" && Number.isFinite(value) ? Math.max(value, 0) : 0;
  return Math.log10(safeValue + 1) * weight;
}

function hasThumbnails(value: unknown) {
  return Array.isArray(value) && value.length > 0;
}

function daysSince(value: string | null) {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return null;
  return Math.max((Date.now() - parsed) / (24 * 60 * 60 * 1000), 0);
}

function ratePositive(likes: number | null, dislikes: number | null) {
  const up = typeof likes === "number" && Number.isFinite(likes) ? Math.max(likes, 0) : 0;
  const down = typeof dislikes === "number" && Number.isFinite(dislikes) ? Math.max(dislikes, 0) : 0;
  const total = up + down;
  if (total < 20) return null;
  return up / total;
}

function computeScore(row: UniverseRow): ScoreResult {
  let score = 0;
  const reasons: string[] = [];

  const playing = row.playing ?? 0;
  const visits = row.visits ?? 0;
  const favorites = row.favorites ?? 0;
  score += logScore(playing, 22);
  score += logScore(visits, 5);
  score += logScore(favorites, 5);

  if (playing >= 1000) reasons.push("high_ccu");
  else if (playing >= 100) reasons.push("active_players");
  else if (playing >= 10) reasons.push("some_active_players");

  if (visits >= 1_000_000) reasons.push("million_plus_visits");
  else if (visits >= 100_000) reasons.push("six_figure_visits");

  if (favorites >= 10_000) reasons.push("strong_favorites");

  const likeRatio = ratePositive(row.likes, row.dislikes);
  if (likeRatio != null) {
    score += likeRatio * 20;
    if (likeRatio >= 0.85) reasons.push("strong_like_ratio");
    else if (likeRatio < 0.55) {
      score -= 12;
      reasons.push("weak_like_ratio");
    }
  }

  if (row.icon_url) {
    score += 3;
    reasons.push("has_icon");
  }
  if (hasThumbnails(row.thumbnail_urls)) {
    score += 3;
    reasons.push("has_thumbnails");
  }
  if (row.description && row.description.trim().length >= 80) {
    score += 4;
    reasons.push("usable_description");
  }

  if (row.creator_has_verified_badge || row.group_has_verified_badge) {
    score += 5;
    reasons.push("verified_creator_or_group");
  }

  if (row.last_seen_in_sort) {
    score += 6;
    reasons.push("seen_in_explore");
  }
  if (row.last_seen_in_search) {
    score += 2;
    reasons.push("seen_in_search");
  }

  const updateAgeDays = daysSince(row.updated_at_api);
  if (updateAgeDays != null) {
    if (updateAgeDays <= 30) {
      score += 4;
      reasons.push("recently_updated");
    } else if (updateAgeDays <= 180) {
      score += 2;
      reasons.push("updated_this_year");
    } else if (updateAgeDays > 720) {
      score -= 5;
      reasons.push("stale_api_update");
    }
  }

  if (row.is_sponsored) {
    score -= 3;
    reasons.push("sponsored");
  }

  const visibility = (row.visibility ?? "").toLowerCase();
  const privacy = (row.privacy_type ?? "").toLowerCase();
  if (row.is_archived || row.is_active === false || visibility.includes("private") || privacy.includes("private")) {
    score -= 50;
    reasons.push("not_public_or_inactive");
  }

  score = Math.max(0, Math.round(score * 10) / 10);

  let tier: ScoreResult["tier"] = "archive";
  if (
    playing >= 1000 ||
    (score >= 125 && (playing >= 500 || visits >= 10_000_000 || favorites >= 100_000))
  ) {
    tier = "A";
  } else if (
    playing >= 100 ||
    (score >= 90 && (playing >= 50 || visits >= 1_000_000 || favorites >= 10_000))
  ) {
    tier = "B";
  } else if (
    score >= 60 &&
    (playing >= 5 || visits >= 100_000 || favorites >= 1_000)
  ) {
    tier = "C";
  } else if (score >= 28 || visits >= 10_000 || playing >= 1) {
    tier = "D";
  }

  return {
    score,
    tier,
    candidate: tier === "A" || tier === "B",
    reasons: Array.from(new Set(reasons))
  };
}

async function fetchPage(offset: number, count: number): Promise<UniverseRow[]> {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("roblox_universes")
    .select(
      [
        "universe_id",
        "name",
        "display_name",
        "description",
        "icon_url",
        "thumbnail_urls",
        "creator_has_verified_badge",
        "group_has_verified_badge",
        "visibility",
        "privacy_type",
        "is_active",
        "is_archived",
        "is_sponsored",
        "playing",
        "visits",
        "favorites",
        "likes",
        "dislikes",
        "last_seen_in_sort",
        "last_seen_in_search",
        "updated_at_api"
      ].join(", ")
    )
    .order("universe_id", { ascending: true })
    .range(offset, offset + count - 1);
  if (error) throw error;
  return ((data ?? []) as unknown) as UniverseRow[];
}

async function scoreRows(rows: UniverseRow[]) {
  const sb = supabaseAdmin();
  const scoredAt = new Date().toISOString();
  const counts = { A: 0, B: 0, C: 0, D: 0, archive: 0 };

  for (const row of rows) {
    const result = computeScore(row);
    counts[result.tier] += 1;
    const { error } = await sb
      .from("roblox_universes")
      .update({
        discovery_score: result.score,
        quality_score: result.score,
        quality_tier: result.tier,
        quality_reasons: result.reasons,
        is_quality_candidate: result.candidate,
        last_quality_scored_at: scoredAt
      })
      .eq("universe_id", row.universe_id);
    if (error) {
      throw new Error(`Failed to score universe ${row.universe_id}: ${error.message}`);
    }
  }

  return counts;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options: Record<string, number | boolean> = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--limit" || arg === "-l") {
      options.limit = Number(args[i + 1]);
      i += 1;
    } else if (arg === "--batch" || arg === "-b") {
      options.batch = Number(args[i + 1]);
      i += 1;
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    }
  }
  return options;
}

function printHelp() {
  console.log(`
Usage: npm run score:universes -- [options]

Options:
  -l, --limit <number>   Total universes to score; 0 means all (default: ${DEFAULT_LIMIT})
  -b, --batch <number>   Supabase page size (default: ${BATCH_SIZE})
  -h, --help             Show this help text
`);
}

async function main() {
  const options = parseArgs();
  if (options.help) {
    printHelp();
    process.exit(0);
  }

  const totalLimit =
    typeof options.limit === "number" && Number.isFinite(options.limit) && options.limit >= 0
      ? options.limit
      : DEFAULT_LIMIT;
  const batchSize =
    typeof options.batch === "number" && Number.isFinite(options.batch) && options.batch > 0
      ? options.batch
      : BATCH_SIZE;

  let offset = 0;
  let processed = 0;
  const totals = { A: 0, B: 0, C: 0, D: 0, archive: 0 };

  while (true) {
    if (totalLimit > 0 && processed >= totalLimit) break;
    const count = totalLimit > 0 ? Math.min(batchSize, totalLimit - processed) : batchSize;
    const rows = await fetchPage(offset, count);
    if (!rows.length) break;
    const counts = await scoreRows(rows);
    for (const tier of Object.keys(totals) as Array<keyof typeof totals>) {
      totals[tier] += counts[tier];
    }
    processed += rows.length;
    offset += rows.length;
    console.log(
      `Scored ${processed} universes. A:${totals.A} B:${totals.B} C:${totals.C} D:${totals.D} archive:${totals.archive}`
    );
    if (rows.length < count) break;
  }

  if (!processed) {
    console.log("No universes found to score.");
    return;
  }

  console.log(
    `Done. Scored ${processed} universes. A:${totals.A} B:${totals.B} C:${totals.C} D:${totals.D} archive:${totals.archive}`
  );
}

main().catch((error) => {
  console.error("Universe quality scoring failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});

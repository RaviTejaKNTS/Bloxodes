import "../shared/load-env";

import {
  inferDecalCategorySlugs,
  normalizeDecalCategorySlugs,
  getDecalCategoryLabel
} from "@/lib/decal-id-categories";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { chunkArray, normalizeNumber, normalizeText, toBoolean } from "./decal-id-utils";

const DRY_RUN = toBoolean(process.env.ROBLOX_DECAL_RERANK_DRY_RUN, false);
const PAGE_SIZE = 250;

type DecalRow = {
  asset_id: number;
  name: string;
  description: string | null;
  creator_verified: boolean | null;
  roblox_created_at: string | null;
  thumbnail_url: string | null;
  thumbnail_state: string | null;
  source: string | null;
  last_seen_at: string | null;
  first_seen_at: string | null;
  verified_at: string | null;
  vote_count: number | null;
  upvote_percent: number | null;
  sales: number | null;
};

type SourceRow = {
  asset_id: number;
  source_kind: string;
  source_url: string | null;
  source_query: string | null;
  source_page: number | null;
  source_rank: number | null;
  raw_payload: Record<string, unknown> | null;
};

type ScorePayload = {
  asset_id: number;
  popularity_score: number;
  categories: string[];
  primary_category: string | null;
  curated_score: number;
  curated_rank: number | null;
  curated_tier: string | null;
  curated_reason: string | null;
};

function ageInDays(value: string | null): number | null {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return Math.max(0, (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}

function sourceBaseWeight(kind: string | null): number {
  switch (kind) {
    case "progameguides_decal_list":
      return 520;
    case "beebom_decal_list":
      return 500;
    case "robloxden_decal_database":
      return 420;
    case "robloxden_decal_category":
      return 360;
    case "legacy_decal_json":
      return 120;
    case "roblox_toolbox_decal_search":
      return 80;
    default:
      return 40;
  }
}

function sourceRecencyWeight(kind: string | null): number {
  switch (kind) {
    case "progameguides_decal_list":
    case "beebom_decal_list":
      return 1.1;
    case "robloxden_decal_database":
    case "robloxden_decal_category":
      return 0.85;
    case "roblox_toolbox_decal_search":
      return 0.45;
    default:
      return 0.25;
  }
}

function safeRankScore(rank: number | null, max = 550): number {
  return rank && rank > 0 ? Math.max(0, max - rank) : 0;
}

function rawNumber(raw: Record<string, unknown> | null, key: string): number | null {
  if (!raw || typeof raw !== "object") return null;
  return normalizeNumber(raw[key]);
}

function rawStringArray(raw: Record<string, unknown> | null, key: string): string[] {
  if (!raw || typeof raw !== "object") return [];
  const value = raw[key];
  if (!Array.isArray(value)) return [];
  return value.map((entry) => normalizeText(entry)).filter((entry): entry is string => Boolean(entry));
}

function sourceCategories(sourceRows: SourceRow[]): string[] {
  return normalizeDecalCategorySlugs(
    sourceRows.flatMap((source) =>
      source.source_kind === "roblox_toolbox_decal_search"
        ? []
        : [
          source.source_query,
          ...rawStringArray(source.raw_payload, "categories"),
          normalizeText(source.raw_payload?.sourceCategory),
          normalizeText(source.raw_payload?.listedName)
        ]
    )
  );
}

function inferCategories(row: DecalRow, sourceRows: SourceRow[]): string[] {
  const textCategories = inferDecalCategorySlugs([row.name, row.description]);
  const sourceHints = sourceRows.flatMap((source) => [
    source.source_kind === "roblox_toolbox_decal_search" ? null : source.source_query,
    normalizeText(source.raw_payload?.sourceCategory),
    normalizeText(source.raw_payload?.listedName),
    ...rawStringArray(source.raw_payload, "categories")
  ]);

  const inferred = inferDecalCategorySlugs(sourceHints);
  const toolboxHints =
    textCategories.length || inferred.length
      ? []
      : normalizeDecalCategorySlugs(
        sourceRows
          .filter((source) => source.source_kind === "roblox_toolbox_decal_search")
          .map((source) => source.source_query)
      );

  return Array.from(new Set([...textCategories, ...sourceCategories(sourceRows), ...inferred, ...toolboxHints])).slice(0, 5);
}

function strongestSource(sourceRows: SourceRow[], fallback: string | null): string | null {
  const kinds = new Set(sourceRows.map((source) => source.source_kind));
  return [
    "progameguides_decal_list",
    "beebom_decal_list",
    "robloxden_decal_database",
    "robloxden_decal_category",
    "roblox_toolbox_decal_search",
    "legacy_decal_json"
  ].find((kind) => kinds.has(kind)) ?? fallback;
}

function bestExternalRank(sourceRows: SourceRow[]): number | null {
  const ranks = sourceRows
    .filter((source) =>
      ["progameguides_decal_list", "beebom_decal_list", "robloxden_decal_database", "robloxden_decal_category"].includes(
        source.source_kind
      )
    )
    .map((source) => source.source_rank)
    .filter((rank): rank is number => typeof rank === "number" && Number.isFinite(rank) && rank > 0);
  return ranks.length ? Math.min(...ranks) : null;
}

function bestRobloxDenFavoriteCount(sourceRows: SourceRow[]): number {
  return Math.max(
    0,
    ...sourceRows
      .filter((source) => source.source_kind.startsWith("robloxden_"))
      .map((source) => rawNumber(source.raw_payload, "favoriteCount") ?? 0)
  );
}

function textQualityScore(row: DecalRow): number {
  const name = row.name.trim().toLowerCase();
  if (!name || name.startsWith("roblox decal ")) return -140;
  const shortPenalty = name.length < 3 ? -80 : 0;
  const genericPenalty = ["image", "decal", "untitled", "test", "idk"].includes(name) ? -100 : 0;
  const numericPenalty = /^\d+$/.test(name) ? -120 : 0;
  const descriptionBoost = row.description && row.description.length > 12 ? 20 : 0;
  return 70 + descriptionBoost + shortPenalty + genericPenalty + numericPenalty;
}

function computeScores(row: DecalRow, sourceRows: SourceRow[]): Omit<ScorePayload, "asset_id" | "curated_rank"> {
  const sourceCount = sourceRows.length;
  const sourceKind = strongestSource(sourceRows, row.source);
  const categories = inferCategories(row, sourceRows);
  const primaryCategory = categories[0] ?? null;
  const voteCount = normalizeNumber(row.vote_count) ?? 0;
  const upvotePercent = normalizeNumber(row.upvote_percent) ?? 0;
  const sales = normalizeNumber(row.sales) ?? 0;
  const favoriteCount = bestRobloxDenFavoriteCount(sourceRows);
  const externalRank = bestExternalRank(sourceRows);
  const lastSeenDays = ageInDays(row.last_seen_at);
  const firstSeenDays = ageInDays(row.first_seen_at);
  const verifiedDays = ageInDays(row.verified_at);
  const createdDays = ageInDays(row.roblox_created_at);
  const thumbnailBoost = row.thumbnail_state === "Completed" && row.thumbnail_url ? 120 : -600;
  const sourceBoost = sourceRows.reduce((total, source) => total + sourceBaseWeight(source.source_kind), sourceBaseWeight(row.source));
  const sourceDiversityBoost = Math.min(260, sourceCount * 34);
  const voteBoost = Math.log10(voteCount + 1) * 95;
  const upvoteBoost = Math.max(0, Math.min(100, upvotePercent)) * 3.2;
  const salesBoost = Math.log10(sales + 1) * 45;
  const favoriteBoost = Math.log10(favoriteCount + 1) * 115;
  const creatorBoost = row.creator_verified ? 85 : 0;
  const rankBoost = safeRankScore(externalRank, 850) * 0.75;
  const sourceFreshness = sourceRecencyWeight(sourceKind);
  const recentSeenBoost = lastSeenDays === null ? 0 : Math.max(0, 180 - lastSeenDays) * 1.8 * sourceFreshness;
  const newDiscoveryBoost = firstSeenDays === null ? 0 : Math.max(0, 35 - firstSeenDays) * 1.1;
  const verifiedBoost = verifiedDays === null ? 0 : Math.max(0, 60 - verifiedDays) * 0.8;
  const agePenalty = createdDays !== null && createdDays < 2 ? 80 : 0;
  const categoryBoost = categories.length ? 45 : -60;
  const metadataBoost = textQualityScore(row);
  const toolboxOnlyPenalty =
    sourceRows.length <= 1 && (sourceKind === "roblox_toolbox_decal_search" || !sourceKind) ? 260 : 0;
  const lowSignalPenalty =
    voteCount === 0 && upvotePercent === 0 && favoriteCount === 0 && sourceCount <= 1 ? 220 : 0;

  const popularityScore = Math.max(
    0,
    sourceBoost * 0.35 +
      sourceDiversityBoost +
      voteBoost +
      upvoteBoost +
      salesBoost +
      favoriteBoost +
      creatorBoost +
      rankBoost +
      recentSeenBoost +
      newDiscoveryBoost +
      verifiedBoost +
      thumbnailBoost +
      categoryBoost +
      metadataBoost -
      agePenalty -
      toolboxOnlyPenalty -
      lowSignalPenalty
  );

  const isCuratedSource = sourceRows.some((source) =>
    ["progameguides_decal_list", "beebom_decal_list", "robloxden_decal_database", "robloxden_decal_category"].includes(
      source.source_kind
    )
  );
  const highRobloxSignal = voteCount >= 100 || upvotePercent >= 85 || favoriteCount >= 150 || sales >= 100;
  const curatedScore = Math.max(
    0,
    (isCuratedSource ? 700 : 0) +
      (highRobloxSignal ? 240 : 0) +
      sourceBoost * 0.22 +
      rankBoost +
      favoriteBoost +
      voteBoost * 0.7 +
      upvoteBoost +
      creatorBoost +
      metadataBoost +
      categoryBoost -
      toolboxOnlyPenalty -
      lowSignalPenalty
  );

  const curatedTier =
    curatedScore >= 1200 ? "best" :
      curatedScore >= 850 ? "strong" :
        curatedScore >= 620 ? "notable" :
          null;
  const curatedReason = curatedTier
    ? [
      isCuratedSource ? "curated source" : null,
      favoriteCount ? `${favoriteCount.toLocaleString("en-US")} RobloxDen favorites` : null,
      voteCount ? `${voteCount.toLocaleString("en-US")} votes` : null,
      upvotePercent ? `${upvotePercent}% rating` : null,
      primaryCategory ? getDecalCategoryLabel(primaryCategory) : null
    ].filter(Boolean).slice(0, 3).join(" · ")
    : null;

  return {
    popularity_score: popularityScore,
    categories,
    primary_category: primaryCategory,
    curated_score: curatedScore,
    curated_tier: curatedTier,
    curated_reason: curatedReason
  };
}

async function loadRows(): Promise<DecalRow[]> {
  const sb = supabaseAdmin();
  const rows: DecalRow[] = [];
  let lastAssetId = 0;

  while (true) {
    const query = sb
      .from("roblox_decal_ids")
      .select(
        "asset_id, name, description, creator_verified, roblox_created_at, thumbnail_url, thumbnail_state, source, last_seen_at, first_seen_at, verified_at, vote_count, upvote_percent, sales"
      )
      .eq("status", "active")
      .gt("asset_id", lastAssetId)
      .order("asset_id", { ascending: true })
      .limit(PAGE_SIZE);
    const { data, error } = await query;
    if (error) throw new Error(`Failed to load decal rows: ${error.message}`);
    const page = (data ?? []) as DecalRow[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
    lastAssetId = page[page.length - 1]?.asset_id ?? lastAssetId;
  }

  return rows;
}

async function loadSourceRows(assetIds: number[]): Promise<Map<number, SourceRow[]>> {
  const sb = supabaseAdmin();
  const rowsByAssetId = new Map<number, SourceRow[]>();
  for (const chunk of chunkArray(assetIds, 500)) {
    const { data, error } = await sb
      .from("roblox_decal_id_sources")
      .select("asset_id, source_kind, source_url, source_query, source_page, source_rank, raw_payload")
      .in("asset_id", chunk);
    if (error) throw new Error(`Failed to load decal source rows: ${error.message}`);
    for (const source of (data ?? []) as SourceRow[]) {
      const assetId = normalizeNumber(source.asset_id);
      if (!assetId) continue;
      const rows = rowsByAssetId.get(assetId) ?? [];
      rows.push(source);
      rowsByAssetId.set(assetId, rows);
    }
  }
  return rowsByAssetId;
}

function assignCuratedRanks(payload: Array<Omit<ScorePayload, "curated_rank"> & { asset_id: number }>): ScorePayload[] {
  const sorted = payload
    .filter((row) => row.curated_score >= 620 && row.curated_tier)
    .sort((a, b) => b.curated_score - a.curated_score || b.popularity_score - a.popularity_score || a.asset_id - b.asset_id);
  const rankByAssetId = new Map(sorted.map((row, index) => [row.asset_id, index + 1]));

  return payload.map((row) => ({
    ...row,
    curated_rank: rankByAssetId.get(row.asset_id) ?? null
  }));
}

async function main() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE must be set.");
  }

  const rows = await loadRows();
  const sourceRows = await loadSourceRows(rows.map((row) => row.asset_id));
  const payload = assignCuratedRanks(
    rows.map((row) => ({
      asset_id: row.asset_id,
      ...computeScores(row, sourceRows.get(row.asset_id) ?? [])
    }))
  );

  if (DRY_RUN) {
    const curated = payload.filter((row) => row.curated_rank).length;
    console.log(`Dry run: would rerank ${payload.length} active decal rows (${curated} curated).`);
    return;
  }

  const sb = supabaseAdmin();
  for (const chunk of chunkArray(payload, 50)) {
    await Promise.all(
      chunk.map(async (row) => {
        const { error } = await sb
          .from("roblox_decal_ids")
          .update(row)
          .eq("asset_id", row.asset_id);
        if (error) throw new Error(`Failed to update decal ranking ${row.asset_id}: ${error.message}`);
      })
    );
  }

  const curated = payload.filter((row) => row.curated_rank).length;
  console.log(`Done. Reranked ${payload.length} active decal rows (${curated} curated).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

import "../shared/load-env";

import {
  inferDecalCategorySlugs,
  normalizeDecalCategorySlugs
} from "@/lib/decal-id-categories";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { chunkArray, clampNumber, normalizeNumber, normalizeText, sleep, toBoolean } from "./decal-id-utils";

const DRY_RUN = toBoolean(process.env.ROBLOX_DECAL_RERANK_DRY_RUN, false);
const PAGE_SIZE = clampNumber(process.env.ROBLOX_DECAL_RERANK_PAGE_SIZE, 250, 50, 1000);
const SOURCE_PAGE_SIZE = clampNumber(process.env.ROBLOX_DECAL_RERANK_SOURCE_PAGE_SIZE, 1000, 100, 5000);
const UPDATE_CHUNK_SIZE = clampNumber(process.env.ROBLOX_DECAL_RERANK_UPDATE_CHUNK_SIZE, 75, 25, 200);
const UPDATE_MAX_ATTEMPTS = clampNumber(process.env.ROBLOX_DECAL_RERANK_UPDATE_MAX_ATTEMPTS, 6, 1, 10);
const UPDATE_DELAY_MS = clampNumber(process.env.ROBLOX_DECAL_RERANK_UPDATE_DELAY_MS, 500, 0, 10000);

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
      return 760;
    case "beebom_decal_list":
      return 720;
    case "robloxden_decal_database":
      return 300;
    case "robloxden_decal_category":
      return 240;
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

function externalRankBoost(sourceRows: SourceRow[]): number {
  return Math.max(
    0,
    ...sourceRows
      .filter((source) => source.source_rank && source.source_rank > 0)
      .map((source) => {
        switch (source.source_kind) {
          case "progameguides_decal_list":
          case "beebom_decal_list":
            return safeRankScore(source.source_rank, 950) * 0.95;
          case "robloxden_decal_database":
            return safeRankScore(source.source_rank, 700) * 0.35;
          case "robloxden_decal_category":
            return safeRankScore(source.source_rank, 500) * 0.22;
          default:
            return 0;
        }
      })
  );
}

function editorialSourceBoost(sourceRows: SourceRow[]): number {
  return Math.max(
    0,
    ...sourceRows.map((source) => {
      switch (source.source_kind) {
        case "progameguides_decal_list":
          return 3200 + safeRankScore(source.source_rank, 950) * 0.65;
        case "beebom_decal_list":
          return 3000 + safeRankScore(source.source_rank, 950) * 0.65;
        case "robloxden_decal_database":
          return 900 + safeRankScore(source.source_rank, 700) * 0.18;
        case "robloxden_decal_category":
          return 500 + safeRankScore(source.source_rank, 500) * 0.12;
        case "legacy_decal_json":
          return 450;
        default:
          return 0;
      }
    })
  );
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

function hasEditorialSource(sourceRows: SourceRow[]): boolean {
  return sourceRows.some((source) => ["progameguides_decal_list", "beebom_decal_list"].includes(source.source_kind));
}

function frontPageNamePenalty(row: DecalRow, sourceRows: SourceRow[]): number {
  if (hasEditorialSource(sourceRows)) return 0;

  const name = row.name.trim().toLowerCase();
  const genericColor = [
    "black",
    "white",
    "red",
    "blue",
    "green",
    "pink",
    "purple",
    "yellow",
    "brown",
    "gray",
    "grey"
  ].includes(name);

  if (genericColor) return 2200;
  if (name.length < 7) return 1200;
  if (/^(image|decal|texture|test|untitled)(\\s*\\d+)?$/.test(name)) return 1800;

  return 0;
}

function frontPageTonePenalty(row: DecalRow, voteCount: number): number {
  if (voteCount > 0) return 0;

  const text = [row.name, row.description].filter(Boolean).join(" ").toLowerCase();
  if (!text) return 0;

  const strongTerms = ["cursed", "horror", "haunted", "satanic", "pentagram", "gore"];
  const mildTerms = ["scary", "creepy", "uncanny", "demon", "skeleton", "blood"];

  if (strongTerms.some((term) => text.includes(term))) return 900;
  if (mildTerms.some((term) => text.includes(term))) return 450;

  return 0;
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
  const curatedVoteBoost = Math.log10(voteCount + 1) * 1800 + Math.min(voteCount, 100) * 80;
  const curatedFavoriteBoost = Math.log10(favoriteCount + 1) * 420;
  const creatorBoost = row.creator_verified ? 85 : 0;
  const rankBoost = externalRankBoost(sourceRows);
  const editorialBoost = editorialSourceBoost(sourceRows);
  const sourceFreshness = sourceRecencyWeight(sourceKind);
  const recentSeenBoost = lastSeenDays === null ? 0 : Math.max(0, 180 - lastSeenDays) * 1.8 * sourceFreshness;
  const newDiscoveryBoost = firstSeenDays === null ? 0 : Math.max(0, 35 - firstSeenDays) * 1.1;
  const verifiedBoost = verifiedDays === null ? 0 : Math.max(0, 60 - verifiedDays) * 0.8;
  const agePenalty = createdDays !== null && createdDays < 2 ? 80 : 0;
  const categoryBoost = categories.length ? 45 : -60;
  const metadataBoost = textQualityScore(row);
  const toolboxOnlyPenalty =
    sourceRows.length <= 1 && (sourceKind === "roblox_toolbox_decal_search" || !sourceKind) ? 260 : 0;
  const curatedToolboxOnlyPenalty = toolboxOnlyPenalty ? 900 : 0;
  const curatedNamePenalty = frontPageNamePenalty(row, sourceRows);
  const curatedTonePenalty = frontPageTonePenalty(row, voteCount);
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
  const curatedScore = Math.max(
    0,
    curatedVoteBoost +
      editorialBoost +
      curatedFavoriteBoost +
      sourceDiversityBoost +
      sourceBoost * 0.08 +
      creatorBoost +
      Math.max(0, metadataBoost) -
      toolboxOnlyPenalty -
      curatedToolboxOnlyPenalty -
      curatedNamePenalty -
      curatedTonePenalty -
      lowSignalPenalty
  );

  const curatedTier =
    curatedScore >= 5500 ? "best" :
      curatedScore >= 3200 ? "strong" :
        curatedScore >= 1800 ? "notable" :
          null;
  const curatedReason = curatedTier
    ? [
      isCuratedSource ? "curated source" : null,
      favoriteCount ? `${favoriteCount.toLocaleString("en-US")} RobloxDen favorites` : null,
      voteCount ? `${voteCount.toLocaleString("en-US")} votes` : null
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
  let pageCount = 0;

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
    pageCount += 1;
    if (pageCount % 20 === 0) {
      console.log(`Loaded ${rows.length} active decal rows...`);
    }
    if (page.length < PAGE_SIZE) break;
    lastAssetId = page[page.length - 1]?.asset_id ?? lastAssetId;
  }

  console.log(`Loaded ${rows.length} active decal rows.`);
  return rows;
}

async function loadSourceRows(assetIds: number[]): Promise<Map<number, SourceRow[]>> {
  const sb = supabaseAdmin();
  const activeAssetIds = new Set(assetIds);
  const rowsByAssetId = new Map<number, SourceRow[]>();
  let from = 0;
  let pageCount = 0;

  while (true) {
    const { data, error } = await sb
      .from("roblox_decal_id_sources")
      .select("asset_id, source_kind, source_url, source_query, source_page, source_rank, raw_payload")
      .order("asset_id", { ascending: true })
      .range(from, from + SOURCE_PAGE_SIZE - 1);
    if (error) throw new Error(`Failed to load decal source rows: ${error.message}`);

    const page = (data ?? []) as SourceRow[];
    for (const source of page) {
      const assetId = normalizeNumber(source.asset_id);
      if (!assetId || !activeAssetIds.has(assetId)) continue;
      const rows = rowsByAssetId.get(assetId) ?? [];
      rows.push(source);
      rowsByAssetId.set(assetId, rows);
    }

    pageCount += 1;
    if (pageCount % 10 === 0) {
      console.log(`Scanned ${pageCount} decal source pages; matched ${rowsByAssetId.size} active decal IDs...`);
    }
    if (page.length < SOURCE_PAGE_SIZE) break;
    from += SOURCE_PAGE_SIZE;
  }
  console.log(`Loaded source rows for ${rowsByAssetId.size} active decal IDs after scanning ${pageCount} source pages.`);
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

function shouldUsePgQueryBulkUpdate(): boolean {
  const url = process.env.SUPABASE_URL ?? "";
  return Boolean(url) && !/localhost|127\.0\.0\.1/.test(url);
}

function dollarQuote(value: string, tag: string): string {
  if (value.includes(`$${tag}$`)) {
    return dollarQuote(value, `${tag}_x`);
  }
  return `$${tag}$${value}$${tag}$`;
}

async function updateRankingChunkWithPgQuery(chunk: ScorePayload[], chunkNumber: number) {
  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE;
  if (!supabaseUrl || !serviceRole) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE are required for production ranking updates.");
  }

  const payload = dollarQuote(JSON.stringify(chunk), `decal_rank_${chunkNumber}`);
  const query = `
with payload as (
  select *
  from jsonb_to_recordset(${payload}::jsonb) as row(
    asset_id bigint,
    popularity_score double precision,
    categories jsonb,
    primary_category text,
    curated_score double precision,
    curated_rank integer,
    curated_tier text,
    curated_reason text
  )
)
update public.roblox_decal_ids as target
set
  popularity_score = payload.popularity_score,
  categories = coalesce(
    array(select jsonb_array_elements_text(payload.categories)),
    array[]::text[]
  ),
  primary_category = payload.primary_category,
  curated_score = payload.curated_score,
  curated_rank = payload.curated_rank,
  curated_tier = payload.curated_tier,
  curated_reason = payload.curated_reason
from payload
where target.asset_id = payload.asset_id;
`;

  const response = await fetch(`${supabaseUrl}/pg/query`, {
    method: "POST",
    headers: {
      apikey: serviceRole,
      authorization: `Bearer ${serviceRole}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({ query })
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`pg/query failed for ranking chunk ${chunkNumber}: ${text.slice(0, 500)}`);
  }
}

async function updateRankingChunk(sb: ReturnType<typeof supabaseAdmin>, chunk: ScorePayload[], chunkNumber: number) {
  for (let attempt = 1; attempt <= UPDATE_MAX_ATTEMPTS; attempt += 1) {
    let errorMessage: string | null = null;
    try {
      if (shouldUsePgQueryBulkUpdate()) {
        await updateRankingChunkWithPgQuery(chunk, chunkNumber);
      } else {
        await Promise.all(
          chunk.map(async (row) => {
            const { error } = await sb
              .from("roblox_decal_ids")
              .update(row)
              .eq("asset_id", row.asset_id);
            if (error) throw new Error(error.message);
          })
        );
      }
      return;
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
    }
    if (attempt === UPDATE_MAX_ATTEMPTS) {
      throw new Error(`Failed to update ranking chunk ${chunkNumber}: ${errorMessage}`);
    }
    const waitMs = 1000 * attempt * attempt;
    console.warn(`Retrying ranking chunk ${chunkNumber} after error: ${errorMessage}`);
    await sleep(waitMs);
  }
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
  const chunks = chunkArray(payload, UPDATE_CHUNK_SIZE);
  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index];
    await updateRankingChunk(sb, chunk, index + 1);
    if (UPDATE_DELAY_MS > 0 && index < chunks.length - 1) {
      await sleep(UPDATE_DELAY_MS);
    }
    if ((index + 1) % 10 === 0 || index === chunks.length - 1) {
      console.log(`Updated ranking chunks ${index + 1}/${chunks.length}...`);
    }
  }

  const curated = payload.filter((row) => row.curated_rank).length;
  console.log(`Done. Reranked ${payload.length} active decal rows (${curated} curated).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

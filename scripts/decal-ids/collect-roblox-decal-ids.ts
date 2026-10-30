import "../shared/load-env";
import { defaultDecalQuerySeeds } from "../shared/decal-discovery";

import {
  TOOLBOX_SEARCH_API,
  buildDecalRowFromToolbox,
  clampNumber,
  fetchWithRetry,
  insertMissingDecalRows,
  parseCsv,
  sleep,
  toBoolean,
  upsertSourceRows,
  type CreatorStoreAsset,
  type DecalSourceRow
} from "./decal-id-utils";

const USER_AGENT = "BloxodesDecalCollector/1.0";
const PAGE_SIZE = clampNumber(process.env.ROBLOX_DECAL_TOOLBOX_PAGE_SIZE, 100, 1, 100);
const MAX_ASSETS = clampNumber(process.env.ROBLOX_DECAL_COLLECT_MAX_ASSETS, 0, 0, Number.POSITIVE_INFINITY);
const MAX_PAGES_PER_QUERY = clampNumber(process.env.ROBLOX_DECAL_TOOLBOX_MAX_PAGES, 20, 1, 500);
const DELAY_MS = clampNumber(process.env.ROBLOX_DECAL_TOOLBOX_DELAY_MS, 150, 0, 10000);
const MAX_RETRIES = clampNumber(process.env.ROBLOX_DECAL_TOOLBOX_MAX_RETRIES, 3, 0, 10);
const RETRY_BASE_MS = clampNumber(process.env.ROBLOX_DECAL_TOOLBOX_RETRY_BASE_MS, 400, 100, 10000);
const DRY_RUN = toBoolean(process.env.ROBLOX_DECAL_COLLECT_DRY_RUN, false);

const DEFAULT_QUERY_SEEDS = [
  "",
  "meme",
  "anime",
  "cat",
  "dog",
  "face",
  "aesthetic",
  "cute",
  "funny",
  "scary",
  "horror",
  "logo",
  "poster",
  "wallpaper",
  "girl",
  "boy",
  "eyes",
  "hair",
  "shirt",
  "hoodie",
  "one piece",
  "naruto",
  "dragon ball",
  "hello kitty",
  "emoji",
  "cartoon",
  "music",
  "sign",
  "texture",
  "icon",
  "pixel",
  "graffiti",
  "transparent",
  "black",
  "white",
  "red",
  "blue",
  "pink",
  "purple",
  "green"
];

const DEFAULT_SORT_CATEGORIES = ["CreateTime", "Top", "Trending", "Ratings", "UpdatedTime"];
const DEFAULT_SORT_DIRECTIONS = ["Descending"];

type ToolboxResponse = {
  creatorStoreAssets?: CreatorStoreAsset[] | null;
  nextPageToken?: string | null;
  totalResults?: number | null;
};

type CollectConfig = {
  query: string | null;
  sortCategory: string;
  sortDirection: string;
};

function parseSeeds() {
  return defaultDecalQuerySeeds(parseCsv(process.env.ROBLOX_DECAL_QUERY_SEEDS, DEFAULT_QUERY_SEEDS));
}

class ToolboxSearchError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

async function fetchToolboxDecalPage(pageToken: string | null, config: CollectConfig): Promise<ToolboxResponse> {
  const params = new URLSearchParams({
    searchCategoryType: "Decal",
    maxPageSize: String(PAGE_SIZE),
    searchView: "Full",
    sortCategory: config.sortCategory,
    sortDirection: config.sortDirection,
    includeOnlyVerifiedCreators: "false"
  });
  if (config.query) params.set("query", config.query);
  if (pageToken) params.set("pageToken", pageToken);

  const res = await fetchWithRetry(`${TOOLBOX_SEARCH_API}?${params.toString()}`, undefined, {
    maxRetries: MAX_RETRIES,
    retryBaseMs: RETRY_BASE_MS,
    userAgent: USER_AGENT
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ToolboxSearchError(res.status, `Toolbox decal search failed (${res.status}): ${body.slice(0, 300)}`);
  }

  return (await res.json()) as ToolboxResponse;
}

async function collect() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE must be set.");
  }

  const fetchedAt = new Date().toISOString();
  const maxAssets = MAX_ASSETS > 0 ? MAX_ASSETS : Number.POSITIVE_INFINITY;
  const queries = parseSeeds();
  const sortCategories = parseCsv(process.env.ROBLOX_DECAL_SORT_CATEGORIES, DEFAULT_SORT_CATEGORIES);
  const sortDirections = parseCsv(process.env.ROBLOX_DECAL_SORT_DIRECTIONS, DEFAULT_SORT_DIRECTIONS);
  const seenAssetIds = new Set<number>();
  let totalDiscovered = 0;
  let totalInserted = 0;
  let totalAlreadyKnown = 0;
  let totalConfigs = 0;
  let stoppedEarly: string | null = null;

  console.log(
    `Roblox decal discovery starting (${queries.length} queries, ${sortCategories.length} sort categories, max ${
      Number.isFinite(maxAssets) ? maxAssets : "unlimited"
    } new assets)...`
  );

  discovery: for (const sortDirection of sortDirections) {
    for (const sortCategory of sortCategories) {
      for (const rawQuery of queries) {
        // Known candidates must not prevent later queries from finding new assets.
        if (totalInserted >= maxAssets) break discovery;
        const query = rawQuery.trim();
        totalConfigs += 1;
        const label = query || "(empty)";
        console.log(`Search query="${label}" sort=${sortCategory}/${sortDirection}`);

        let pageToken: string | null = null;
        let pageNumber = 0;
        const seenTokens = new Set<string>();

        while (pageNumber < MAX_PAGES_PER_QUERY && totalInserted < maxAssets) {
          if (pageToken && seenTokens.has(pageToken)) break;
          if (pageToken) seenTokens.add(pageToken);

          let payload: ToolboxResponse;
          try {
            payload = await fetchToolboxDecalPage(pageToken, {
              query: query || null,
              sortCategory,
              sortDirection
            });
          } catch (error) {
            // Keep what was inserted and let verify and rerank run; the next day continues discovery.
            if (error instanceof ToolboxSearchError && error.status === 429) {
              stoppedEarly = "Roblox rate limited Toolbox search (429)";
              console.warn(`  ${stoppedEarly}; stopping discovery early.`);
              break discovery;
            }
            throw error;
          }
          const assets = Array.isArray(payload.creatorStoreAssets) ? payload.creatorStoreAssets : [];
          if (!assets.length) break;

          const rows = assets
            .map((entry) => buildDecalRowFromToolbox(entry, fetchedAt, "roblox_toolbox_decal_search"))
            .filter((row): row is NonNullable<typeof row> => Boolean(row))
            .filter((row) => {
              if (seenAssetIds.has(row.asset_id)) return false;
              seenAssetIds.add(row.asset_id);
              return true;
            });

          const sources: DecalSourceRow[] = rows.map((row, index) => ({
            asset_id: row.asset_id,
            source_kind: "roblox_toolbox_decal_search",
            source_query: query || null,
            source_page: pageNumber + 1,
            source_rank: pageNumber * PAGE_SIZE + index + 1,
            raw_payload: {
              sortCategory,
              sortDirection,
              query: query || null
            },
            last_seen_at: fetchedAt
          }));

          const insertResult = await insertMissingDecalRows(rows, { dryRun: DRY_RUN, maxInserts: maxAssets - totalInserted });
          const skippedIds = new Set(insertResult.skippedAssetIds);
          await upsertSourceRows(sources.filter((source) => !skippedIds.has(source.asset_id)), { dryRun: DRY_RUN });
          totalDiscovered += rows.length;
          // Roblox ignores the sort order, so a page with nothing unseen means later pages and sorts repeat it.
          const exhausted = rows.length === 0;
          totalInserted += insertResult.inserted;
          totalAlreadyKnown += insertResult.existing;
          pageNumber += 1;
          console.log(
            `  page ${pageNumber}: ${rows.length} discovered, ${insertResult.inserted} inserted, ${
              insertResult.existing
            } already known (${totalDiscovered} discovered total, ${totalInserted} inserted total)`
          );

          pageToken = payload.nextPageToken ?? null;
          if (!pageToken || exhausted) break;
          await sleep(DELAY_MS);
        }
      }
    }
  }

  console.log(
    `Done. Configs: ${totalConfigs}. Unique candidates this run: ${totalDiscovered}. Inserted: ${totalInserted}. Already known: ${totalAlreadyKnown}.${
      stoppedEarly ? ` Stopped early: ${stoppedEarly}.` : ""
    }`
  );
}

collect().catch((error) => {
  console.error(error);
  process.exit(1);
});

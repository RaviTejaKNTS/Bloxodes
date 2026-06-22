import "../shared/load-env";
import { writeFile } from "node:fs/promises";
import { supabaseAdmin } from "@/lib/supabase-admin";

const TOP_SONGS_API = "https://apis.roblox.com/music-discovery/v1/top-songs";
const PRODUCTINFO_API = (assetId: number) => `https://api.roblox.com/marketplace/productinfo?assetId=${assetId}`;
const ECONOMY_DETAILS_API = (assetId: number) => `https://economy.roblox.com/v2/assets/${assetId}/details`;
const TOOLBOX_ASSET_API = (assetId: number) => `https://apis.roblox.com/toolbox-service/v2/assets/${assetId}`;
const ASSETDELIVERY_API = (assetId: number) => `https://assetdelivery.roblox.com/v1/asset/?id=${assetId}`;
const THUMBNAILS_API = "https://thumbnails.roblox.com/v1/assets";

const USER_AGENT = "BloxodesTopSongsBot/1.0";
const MAX_RETRIES = 3;
const ENRICH_CONCURRENCY = 5;
const ENRICH_REQUEST_DELAY_MS = 150;
const THUMBNAIL_BATCH = 50;
const THUMBNAIL_SIZE = "420x420";
const THUMBNAIL_FORMAT = "Png";
const AUDIO_ASSET_TYPE_ID = 3;
const TOP_SONGS_TARGET = clampNumber(process.env.ROBLOX_TOP_SONGS_TARGET, 500, 1, 1000);
const TOP_SONGS_PAGE_LIMIT = clampNumber(process.env.ROBLOX_TOP_SONGS_PAGE_LIMIT, 50, 1, 100);
const TOP_SONGS_MAX_PAGES = clampNumber(
    process.env.ROBLOX_TOP_SONGS_MAX_PAGES,
    Math.ceil(TOP_SONGS_TARGET / TOP_SONGS_PAGE_LIMIT),
    1,
    50
);

type RobloxTopSong = {
    assetId?: number;
    album?: string;
    artist?: string;
    duration?: number;
    title?: string;
    albumArtAssetId?: number;
};

type RobloxTopSongsResponse = {
    songs?: RobloxTopSong[];
    nextPageToken?: string | null;
};

type MusicRow = {
    asset_id: number;
    title: string;
    artist: string;
    album: string | null;
    genre: string | null;
    duration_seconds: number | null;
    album_art_asset_id: number | null;
    rank: number;
    source: string;
    raw_payload: Record<string, unknown>;
    last_seen_at: string;
};

type AutomationSummary = {
    type: "music-ids";
    stats: {
        topSongsTarget: number;
        topSongsFetched: number;
        topSongsUpserted: number;
        enriched: number;
        ranksCleared: boolean;
        catalogTimestampUpdated: boolean;
    };
};

function clampNumber(raw: string | undefined, fallback: number, min: number, max: number): number {
    if (raw === undefined) return fallback;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
}

function normalizeOptionalText(value?: string | null): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
}

function normalizeRequiredText(value: string | undefined, fallback: string): string {
    if (typeof value !== "string") return fallback;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : fallback;
}

async function sleep(ms: number) {
    if (ms <= 0) return;
    await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchTopSongsPage(pageToken: string, limit: number): Promise<RobloxTopSongsResponse> {
    const params = new URLSearchParams({
        pageToken,
        limit: String(limit)
    });
    const url = `${TOP_SONGS_API}?${params.toString()}`;

    let attempt = 0;
    while (true) {
        const res = await fetch(url, {
            headers: {
                accept: "application/json",
                "user-agent": USER_AGENT
            }
        });

        if (res.ok) {
            return (await res.json()) as RobloxTopSongsResponse;
        }

        const retryable = res.status === 429 || res.status >= 500;
        if (!retryable || attempt >= MAX_RETRIES) {
            const body = await res.text().catch(() => "");
            throw new Error(`Top songs fetch failed (${res.status}): ${body.slice(0, 200)}`);
        }

        const backoff = 300 * Math.pow(2, attempt);
        attempt += 1;
        console.log(`Retrying in ${backoff}ms...`);
        await sleep(backoff);
    }
}

async function fetchTopSongs(target: number): Promise<RobloxTopSong[]> {
    const songs: RobloxTopSong[] = [];
    const seenTokens = new Set<string>();
    let pageToken: string | null = "0";
    let pageCount = 0;

    while (pageToken && pageCount < TOP_SONGS_MAX_PAGES && songs.length < target) {
        if (seenTokens.has(pageToken)) {
            console.log(`Stopping top songs fetch: pageToken ${pageToken} repeated.`);
            break;
        }
        seenTokens.add(pageToken);

        const remaining = target - songs.length;
        const payload = await fetchTopSongsPage(pageToken, Math.min(TOP_SONGS_PAGE_LIMIT, remaining));
        const pageSongs = Array.isArray(payload.songs) ? payload.songs : [];
        if (!pageSongs.length) break;

        songs.push(...pageSongs);
        pageCount += 1;

        pageToken =
            typeof payload.nextPageToken === "string" && payload.nextPageToken.trim().length
                ? payload.nextPageToken.trim()
                : null;
    }

    return songs.slice(0, target);
}

function buildMusicRows(songs: RobloxTopSong[], fetchedAt: string): MusicRow[] {
    const rows: MusicRow[] = [];
    songs.forEach((song, index) => {
        if (typeof song.assetId !== "number") return;
        rows.push({
            asset_id: song.assetId,
            title: normalizeRequiredText(song.title, "Unknown Title"),
            artist: normalizeRequiredText(song.artist, "Unknown Artist"),
            album: normalizeOptionalText(song.album),
            genre: null,
            duration_seconds: typeof song.duration === "number" ? song.duration : null,
            album_art_asset_id: typeof song.albumArtAssetId === "number" ? song.albumArtAssetId : null,
            rank: index + 1,
            source: "music_discovery_top_songs",
            raw_payload: song as Record<string, unknown>,
            last_seen_at: fetchedAt
        });
    });
    return rows;
}

async function clearAllRanks() {
    console.log("Clearing all existing ranks...");
    const sb = supabaseAdmin();

    const { error } = await sb
        .from("roblox_music_ids")
        .update({ rank: null })
        .not("rank", "is", null);

    if (error) {
        throw new Error(`Failed to clear ranks: ${error.message}`);
    }

    console.log("✅ All existing ranks cleared.");
}

async function upsertTopSongs(rows: MusicRow[]) {
    if (!rows.length) return;

    console.log(`Upserting ${rows.length} top songs with ranks...`);
    const sb = supabaseAdmin();

    // For each song, we need to:
    // 1. Check if it exists
    // 2. If exists: update only rank, last_seen_at, and raw_payload
    // 3. If new: insert all data

    for (const row of rows) {
        const { data: existing } = await sb
            .from("roblox_music_ids")
            .select("asset_id")
            .eq("asset_id", row.asset_id)
            .single();

        if (existing) {
            // Update existing song - only update rank, last_seen_at, raw_payload, source
            const { error } = await sb
                .from("roblox_music_ids")
                .update({
                    rank: row.rank,
                    last_seen_at: row.last_seen_at,
                    raw_payload: row.raw_payload,
                    source: row.source
                })
                .eq("asset_id", row.asset_id);

            if (error) {
                console.error(`Failed to update rank for asset ${row.asset_id}: ${error.message}`);
            }
        } else {
            // Insert new song with all data
            const { error } = await sb
                .from("roblox_music_ids")
                .insert(row);

            if (error) {
                console.error(`Failed to insert asset ${row.asset_id}: ${error.message}`);
            }
        }
    }

    console.log("✅ Top songs upserted with ranks.");
}

async function fetchWithRetry(url: string, init?: RequestInit): Promise<Response> {
    let attempt = 0;
    while (true) {
        try {
            await sleep(ENRICH_REQUEST_DELAY_MS);
            const res = await fetch(url, {
                ...init,
                headers: {
                    accept: "application/json",
                    "user-agent": USER_AGENT,
                    ...(init?.headers ?? {})
                }
            });

            const retryable = res.status === 429 || res.status >= 500;
            if (!retryable || attempt >= MAX_RETRIES) {
                return res;
            }

            const backoff = 400 * Math.pow(2, attempt);
            attempt += 1;
            await sleep(backoff);
        } catch (error) {
            if (attempt >= MAX_RETRIES) throw error;
            const backoff = 400 * Math.pow(2, attempt);
            attempt += 1;
            await sleep(backoff);
        }
    }
}

async function fetchJson(url: string): Promise<{ status: number; data: Record<string, unknown> | null }> {
    try {
        const res = await fetchWithRetry(url);
        let data: Record<string, unknown> | null = null;
        try {
            data = (await res.json()) as Record<string, unknown>;
        } catch {
            data = null;
        }
        return { status: res.status, data };
    } catch {
        return { status: 0, data: null };
    }
}

async function fetchAssetDeliveryStatus(assetId: number): Promise<number | null> {
    try {
        const url = ASSETDELIVERY_API(assetId);
        let res = await fetchWithRetry(url, { method: "HEAD", redirect: "manual" });

        if (res.status === 405) {
            res = await fetchWithRetry(url, {
                method: "GET",
                redirect: "manual",
                headers: { Range: "bytes=0-0" }
            });
        }

        return res.status || null;
    } catch {
        return null;
    }
}

async function fetchThumbnails(assetIds: number[]): Promise<Map<number, string>> {
    const map = new Map<number, string>();
    for (let i = 0; i < assetIds.length; i += THUMBNAIL_BATCH) {
        const chunk = assetIds.slice(i, i + THUMBNAIL_BATCH);
        const params = new URLSearchParams({
            assetIds: chunk.join(","),
            size: THUMBNAIL_SIZE,
            format: THUMBNAIL_FORMAT,
            isCircular: "false"
        });
        const url = `${THUMBNAILS_API}?${params.toString()}`;
        try {
            const res = await fetchWithRetry(url);
            if (!res.ok) continue;
            const payload = (await res.json()) as { data?: Array<{ targetId?: number; imageUrl?: string; state?: string }> };
            for (const entry of payload?.data ?? []) {
                if (!entry?.targetId || !entry.imageUrl) continue;
                if (entry.state && entry.state !== "Completed") continue;
                map.set(entry.targetId, entry.imageUrl);
            }
        } catch (error) {
            console.error(`Failed to fetch thumbnails for batch: ${error}`);
        }
    }
    return map;
}

function computePopularityScore(
    rank: number,
    voteCount: number,
    upvotePercent: number,
    creatorVerified: boolean
): number {
    const rankScore = Math.max(0, 1000 - rank);
    const baseScore = voteCount * 0.7 + upvotePercent * 10;
    const verifiedBonus = creatorVerified ? 50 : 0;
    return baseScore + rankScore + verifiedBonus;
}

async function enrichSong(assetId: number, rank: number, thumbnailUrl: string | null) {
    const now = new Date().toISOString();
    const [productInfo, economyDetails, toolboxAsset, assetDeliveryStatus] = await Promise.all([
        fetchJson(PRODUCTINFO_API(assetId)),
        fetchJson(ECONOMY_DETAILS_API(assetId)),
        fetchJson(TOOLBOX_ASSET_API(assetId)),
        fetchAssetDeliveryStatus(assetId)
    ]);

    const toolboxAssetData = toolboxAsset.data ?? {};
    const assetDetails = (toolboxAssetData["asset"] as Record<string, unknown>) ?? {};
    const votingDetails = (toolboxAssetData["voting"] as Record<string, unknown>) ?? {};
    const creatorDetails = (toolboxAssetData["creator"] as Record<string, unknown>) ?? {};

    const voteCount = typeof votingDetails?.voteCount === "number" ? votingDetails.voteCount : 0;
    const upvotePercent = typeof votingDetails?.upVotePercent === "number" ? votingDetails.upVotePercent : 0;
    const creatorVerified = typeof creatorDetails?.verified === "boolean" ? creatorDetails.verified : false;

    const productInfoOk = productInfo.status >= 200 && productInfo.status < 300 && !!productInfo.data;
    const assetTypeId = productInfo.data?.AssetTypeId ?? economyDetails.data?.AssetTypeId ?? assetDetails?.assetTypeId;
    const isAudio = assetTypeId === AUDIO_ASSET_TYPE_ID;
    const assetDeliveryOk = assetDeliveryStatus !== null && assetDeliveryStatus >= 200 && assetDeliveryStatus < 400;
    const boomboxReady = productInfoOk && isAudio && assetDeliveryOk;

    let boomboxReason = null;
    if (!boomboxReady) {
        if (!productInfoOk) boomboxReason = "productinfo_unavailable";
        else if (!isAudio) boomboxReason = "not_audio_asset";
        else if (assetDeliveryStatus === 403) boomboxReason = "assetdelivery_forbidden";
        else if (assetDeliveryStatus === 404) boomboxReason = "assetdelivery_not_found";
        else boomboxReason = "assetdelivery_unavailable";
    }

    const popularityScore = computePopularityScore(rank, voteCount, upvotePercent, creatorVerified);

    // Extract additional metadata
    const genre = typeof assetDetails?.genre === "string" && assetDetails.genre.trim()
        ? assetDetails.genre.trim()
        : null;
    const album = typeof assetDetails?.album === "string" && assetDetails.album.trim()
        ? assetDetails.album.trim()
        : null;

    return {
        asset_id: assetId,
        thumbnail_url: thumbnailUrl,
        genre: genre,
        album: album,
        product_info_json: productInfo.data,
        asset_delivery_status: assetDeliveryStatus,
        boombox_ready: boomboxReady,
        boombox_ready_reason: boomboxReason,
        verified_at: now,
        vote_count: voteCount || null,
        upvote_percent: upvotePercent || null,
        creator_verified: creatorVerified || null,
        popularity_score: popularityScore
    };
}

async function enrichTopSongs(assetIds: number[], ranks: Map<number, number>): Promise<number> {
    console.log(`\n🔍 Enriching top ${assetIds.length} songs with metadata...`);

    try {
        const thumbnails = await fetchThumbnails(assetIds);
        console.log(`✅ Fetched ${thumbnails.size} thumbnails.`);

        const sb = supabaseAdmin();
        let successCount = 0;

        for (let i = 0; i < assetIds.length; i += ENRICH_CONCURRENCY) {
            const slice = assetIds.slice(i, i + ENRICH_CONCURRENCY);
            const updates = await Promise.all(
                slice.map(async (assetId) => {
                    try {
                        const rank = ranks.get(assetId) || 999;
                        const thumbnailUrl = thumbnails.get(assetId) || null;
                        return await enrichSong(assetId, rank, thumbnailUrl);
                    } catch (error) {
                        console.error(`Failed to enrich ${assetId}: ${error}`);
                        return {
                            asset_id: assetId,
                            verified_at: new Date().toISOString(),
                            boombox_ready: false,
                            boombox_ready_reason: "enrich_error"
                        };
                    }
                })
            );

            // Update each song individually with only enrichment fields
            for (const enrichment of updates) {
                const { asset_id, ...updateFields } = enrichment;
                const { error } = await sb
                    .from("roblox_music_ids")
                    .update(updateFields)
                    .eq("asset_id", asset_id);

                if (error) {
                    console.error(`Failed to update enrichment for ${asset_id}: ${error.message}`);
                } else {
                    successCount++;
                }
            }

            console.log(`📊 Enriched ${i + updates.length}/${assetIds.length} songs...`);
        }

        console.log(`✅ Successfully enriched ${successCount}/${assetIds.length} top songs.`);
        return successCount;
    } catch (error) {
        console.error(`⚠️  Enrichment failed: ${error}`);
        return 0;
    }
}

async function updateCatalogPageTimestamp(): Promise<boolean> {
    console.log("\nUpdating catalog page timestamp...");
    const sb = supabaseAdmin();

    const { error } = await sb
        .from("catalog_pages")
        .update({ updated_at: new Date().toISOString() })
        .eq("code", "roblox-music-ids");

    if (error) {
        console.error(`⚠️  Failed to update catalog page timestamp: ${error.message}`);
        return false;
    } else {
        console.log("✅ Catalog page timestamp updated.");
        return true;
    }
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

    console.log(`🎵 Starting Top ${TOP_SONGS_TARGET} Songs Collection...\n`);

    // Step 1: Fetch the top songs before clearing existing ranks.
    console.log(`\nFetching top ${TOP_SONGS_TARGET} songs from Roblox Music Discovery API...`);
    const fetchedAt = new Date().toISOString();
    const songs = await fetchTopSongs(TOP_SONGS_TARGET);

    console.log(`✅ Received ${songs.length} songs from API.\n`);

    if (!songs.length) {
        console.log("⚠️  No songs returned from API.");
        return;
    }

    // Step 2: Build database rows with ranks
    const rows = buildMusicRows(songs, fetchedAt);
    console.log(`📊 Prepared ${rows.length} music rows with ranks 1-${rows.length}.\n`);

    // Step 3: Clear old ranks only after the replacement list is ready.
    await clearAllRanks();

    // Step 4: Upsert songs (keeping existing data for old IDs, updating ranks)
    await upsertTopSongs(rows);

    // Step 5: Enrich all top songs with metadata
    const assetIds = rows.map(row => row.asset_id);
    const ranks = new Map(rows.map(row => [row.asset_id, row.rank]));
    const enrichedCount = await enrichTopSongs(assetIds, ranks);

    // Step 6: Update catalog page timestamp
    const catalogTimestampUpdated = await updateCatalogPageTimestamp();

    await writeAutomationSummary({
        type: "music-ids",
        stats: {
            topSongsTarget: TOP_SONGS_TARGET,
            topSongsFetched: songs.length,
            topSongsUpserted: rows.length,
            enriched: enrichedCount,
            ranksCleared: true,
            catalogTimestampUpdated
        }
    });

    console.log(`\n✅ Done! Successfully processed ${rows.length} top songs.`);
    console.log(`   - Old songs: Kept existing data, updated rank`);
    console.log(`   - New songs: Inserted with full data and rank`);
    console.log(`   - All songs: Enriched with metadata, thumbnails, and scores`);
    console.log(`   - All other songs: Rank cleared (set to NULL)`);
    console.log(`   - Catalog page: Updated timestamp`);
}

run().catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
});

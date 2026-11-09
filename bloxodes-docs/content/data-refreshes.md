# Data refreshes

Last verified: 2026-10-30

Recurring data collectors that keep catalog, puzzle and ID pages fresh. They all run on the VPS through the stats worker (see [stats](stats.md#the-stats-worker)) and write production directly. Times are UTC.

## Puzzles

- **Schedule:** early NYT 04:10; Beebom and early 04:45, 05:00, 05:30; late NYT and LinkedIn 07:10, 08:10; full sweep 08:30; strict audit 08:45.
- **Commands:** `sync:puzzles` (`scripts/puzzles/sync-puzzles.ts`), `audit:puzzles`. Page setup by hand: `upsert:puzzle-pages`, `upload:puzzle-icons`.
- **Data:** `puzzle_pages` (evergreen copy), `puzzle_answers` (dated answers), `puzzle_sync_runs`. 14 pages, 1,638 answers.
- LinkedIn needs auth. If it's missing, that puzzle is skipped, not marked fresh.

## Catalog page dates

Every data-backed catalog page's date (`catalog_pages.updated_at`, shown as "Updated on", JSON-LD `dateModified` and sitemap `lastmod`) moves when items are added to or removed from what the page shows. Reordering, reranking, re-verification, stats and metadata changes never move it. There is no weekly limit.

- **Job:** `catalog-membership-dates` on the VPS worker every 10 minutes (`scripts/catalog/refresh-catalog-membership-dates.ts`) calls `refresh_catalog_membership_dates()`. For each page it fingerprints the full visible set (count plus two order-independent hash sums of item identities) and compares it with `catalog_membership_snapshots`. A changed fingerprint updates the snapshot and the page date in one transaction; the existing `catalog_pages` trigger revalidates the page and the catalog sitemap. The first run for a page saves a baseline without moving its date.
- **Why not triggers:** row triggers on the item tables were benchmarked on 2026-11-09 (PR #215) and rejected: they deadlocked writers and made a 100-row item write take about 1.5 s. The job runs outside writer transactions; a full pass takes about 2 s and doesn't block writes.
- **Covered:** marketplace items and every family and category page, free items (including the 72-hour verification expiry), music and music game pages, decals and decal game pages, fonts, meshes, emote commands and promo rewards. Curated decals and music trending and chart periods keep their own dates in `catalog_membership_snapshots`. Filtered artist, genre and category views use their parent's date. Editorial pages (admin commands, color codes, errors, dictionary) and the game directory pages keep editorial dates.
- **Adding a page:** a new page that uses an existing mapping gets a baseline on the next run. A new data source or a change to a reader's eligibility rule must add matching predicates to `refresh_catalog_membership_dates()` and test coverage.
- No collector writes catalog dates. `refresh_roblox_promo_rewards` still accepts `p_touch_catalog` for old worker images, but it does nothing.
- Detection lags the change by up to 10 minutes, and a change reversed between two runs isn't seen.

## Music IDs

- **Schedule:** 06:20 daily: `collect:top-songs` → `collect:music-ids-curated` → `rerank:music-ids`.
- **Data:** `roblox_music_ids` and its views. 60,144 rows.
- **Page date:** see [catalog page dates](#catalog-page-dates).
- `collect:top-songs` writes the new ranks first, then clears ranks for songs that left the list, so the trending list is never empty mid-run.
- Game-specific music and decal usage is by hand: `sync:game-specific-id-sources` writes `data/game-specific-ids/source-backed.json`, then `seed:game-specific-id-usage` loads `roblox_music_id_game_usage` and `roblox_decal_id_game_usage`.
- Hand-checked community songs live in `data/game-specific-ids/community-music.json` (A Dusty Trip's 30 car radio songs). Both full and `--only-music-game` syncs merge them in; a live row with the same game, asset and use type wins. To load one game into production, seed a file holding only that game's rows (`{"music":[...],"decals":[]}`) without `--replace-source-rows`, which only upserts those rows. Run it against managed development first (default profile, `--dry-run`, then for real), check the page, then repeat with `BLOXODES_ENV_PROFILE=production-preview`: `--dry-run`, then `--allow-prod`.

## Decal IDs

- **Schedule:** 06:55 daily: `refresh:decal-ids` (`scripts/decal-ids/run-decal-id-refresh.ts`) collects, imports candidates, verifies and reranks.
- **Data:** `roblox_decal_ids` and its views. 38,574 rows.
- **Discovery:** Roblox Toolbox search ignores the requested sort and returns the same old decals for the evergreen queries, so the collector searches the current year (for example `2026`) first. `ROBLOX_DECAL_COLLECT_MAX_ASSETS` (3,000 on the worker) limits **new inserts**; already-known candidates don't count, so later queries still run. Roblox ignores the requested sort, so a sort whose first page matches an earlier sort of the same query is skipped, and a page that repeats the query's earlier pages ends it. Every Toolbox request waits `ROBLOX_DECAL_TOOLBOX_DELAY_MS`. If Roblox still rate-limits the search (HTTP 429 after retries), discovery stops early, keeps what it inserted, verify and rerank still run, and the ledger records `partial` with `rate_limited: 1` on the collect step (exit stays 0). The first fixed run on 2026-10-30 inserted 490 decals before a 429.
- **Health:** each run writes a `decal_ids_refresh` row to `stats_job_runs` with per-step counts in `metadata.steps` and `latest_first_seen_at`. If no decal has been inserted for 7 days, the run finishes every step, records `partial` and exits nonzero, so the wrapper logs a failure.

## Marketplace items

- **Discovery:** 03:05, 09:05, 15:05, 21:05: `collect:catalog-items` (`run-roblox-catalog-discovery.ts`).
- **Enrichment:** :42 in hours 02–05, 08–11, 14–17, 20–22: `enrich:catalog-items`.
- **Data:** `roblox_catalog_items` with images, categories, discovery runs and a refresh queue. 85,304 items.

## Item stats

- **Schedule:** tier 01:05; NEW :55 most hours; HOT :32; WARM 01:32, 07:32, 13:32, 19:32; COLD 23:32; resale :17 every 3 hours; index :45 hourly; rollup 01:25; audit :55 every 6 hours.
- **Commands:** `stats:items:*` in `scripts/items/`.
- **Claims:** the Data API returns at most 1,000 rows (`max_rows` in `supabase/config.toml`), so `update-item-hourly-stats.ts` claims at most 1,000 rows at a time, and processes and writes each batch before claiming the next, until it reaches `--limit`. A WARM run has `--limit 1500`, about 55 minutes of request pacing, and overlaps NEW at :55, which waits on the `roblox-api` lock.
- **Run status:** items Roblox no longer returns count in `missing_rows`, not `rows_failed`. See [stats](stats.md).
- **Data:** `roblox_catalog_item_stats_hourly` / `_daily`, resale points, `stats_item_current_index`, price-mover index.
- **Bundle identity:** new bundles get a negative canonical `asset_id`. About 5,000 older bundles still live at their positive ID with no canonical row, and writes keep going to that row: the `set_roblox_catalog_item_identity` trigger keeps a positive bundle ID when a live row holds it, and writers that build negative IDs (catalog discovery and both free-item importers) switch to the stored positive row before writing the item, hits, queue rows or thumbnails. Only one live row may hold a `catalog_item_key` (`idx_roblox_catalog_live_canonical_key`).

## Free items

- 07:00 `import:free-item-candidates` (Python RobloxDen importer), then 07:30 `collect:free-items -- --apply --allow-prod` verifies them against Roblox. Only verified items count as free.

## Promo rewards

- Wednesday 09:40: `refresh:promo-rewards -- --apply --allow-prod` → `roblox_promo_rewards`. 72 rows.

## Reading job health

A wrapper "success" can hide a skipped or partial job. Check `stats_job_runs` for the real outcome.

## Known issues (2026-10-19)

- **Music:** Roblox Creator Store returns HTTP 500, so the job fails before reranking. Last full success 2026-10-14.
- **Item stats backlog:** until 2026-10-24, WARM, HOT, discovery and enrichment batches failed whenever they held an older positive-ID bundle (23505 on the live canonical key). About 70% of active items were overdue. Until the claim fix of 2026-11-04 reaches the VPS worker, each WARM run asked for 1,500 rows but received 1,000, leaving about 500 leased and unprocessed. That's 4,000 rows a day against about 3,800 coming due (about 80,000 WARM items every 21 days), so the backlog barely moved: 32% overdue on 2026-11-04. With 6,000 rows a day it should drop under 5% in about 10 days. The item audit stays partial until then.

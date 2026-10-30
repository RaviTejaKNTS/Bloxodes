# Data refreshes

Last verified: 2026-10-30

Recurring data collectors that keep catalog, puzzle and ID pages fresh. They all run on the VPS through the stats worker (see [stats](stats.md#the-stats-worker)) and write production directly. Times are UTC.

## Puzzles

- **Schedule:** early NYT 04:10; Beebom and early 04:45, 05:00, 05:30; late NYT and LinkedIn 07:10, 08:10; full sweep 08:30; strict audit 08:45.
- **Commands:** `sync:puzzles` (`scripts/puzzles/sync-puzzles.ts`), `audit:puzzles`. Page setup by hand: `upsert:puzzle-pages`, `upload:puzzle-icons`.
- **Data:** `puzzle_pages` (evergreen copy), `puzzle_answers` (dated answers), `puzzle_sync_runs`. 14 pages, 1,638 answers.
- LinkedIn needs auth. If it's missing, that puzzle is skipped, not marked fresh.

## Music IDs

- **Schedule:** 06:20 daily: `collect:top-songs` → `collect:music-ids-curated` → `rerank:music-ids`.
- **Data:** `roblox_music_ids` and its views. 60,144 rows.
- **Page date:** the collectors set `catalog_pages.updated_at` for `roblox-music-ids` only when a run adds new songs (exact asset-ID lookup before writing) and the current date is at least seven days old (`scripts/shared/music-catalog-freshness.ts`). Reranking and chart-order changes never touch it, so the visible "Updated on" date and `dateModified` don't move daily.
- `collect:top-songs` writes the new ranks first, then clears ranks for songs that left the list, so the trending list is never empty mid-run.
- Game-specific music and decal usage is by hand: `sync:game-specific-id-sources` writes `data/game-specific-ids/source-backed.json`, then `seed:game-specific-id-usage` loads `roblox_music_id_game_usage` and `roblox_decal_id_game_usage`.
- Hand-checked community songs live in `data/game-specific-ids/community-music.json` (A Dusty Trip's 30 car radio songs). Both full and `--only-music-game` syncs merge them in; a live row with the same game, asset and use type wins. To load one game into production, seed a file holding only that game's rows (`{"music":[...],"decals":[]}`) without `--replace-source-rows`, which only upserts those rows. Run it against managed development first (default profile, `--dry-run`, then for real), check the page, then repeat with `BLOXODES_ENV_PROFILE=production-preview`: `--dry-run`, then `--allow-prod`.

## Decal IDs

- **Schedule:** 06:55 daily: `refresh:decal-ids` (`scripts/decal-ids/run-decal-id-refresh.ts`) collects, verifies and reranks.
- **Data:** `roblox_decal_ids` and its views. 38,573 rows.

## Marketplace items

- **Discovery:** 03:05, 09:05, 15:05, 21:05: `collect:catalog-items` (`run-roblox-catalog-discovery.ts`).
- **Enrichment:** :42 in hours 02–05, 08–11, 14–17, 20–22: `enrich:catalog-items`.
- **Data:** `roblox_catalog_items` with images, categories, discovery runs and a refresh queue. 85,304 items.

## Item stats

- **Schedule:** tier 01:05; NEW :55 most hours; HOT :32; WARM 01:32, 07:32, 13:32, 19:32; COLD 23:32; resale :17 every 3 hours; index :45 hourly; rollup 01:25; audit :55 every 6 hours.
- **Commands:** `stats:items:*` in `scripts/items/`.
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
- **Item stats backlog:** until 2026-10-24, WARM, HOT, discovery and enrichment batches failed whenever they held an older positive-ID bundle (23505 on the live canonical key). About 70% of active items were overdue. The normal schedules work the backlog down; the item audit stays partial until overdue items drop under 5%.

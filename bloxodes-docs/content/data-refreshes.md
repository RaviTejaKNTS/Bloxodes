# Data refreshes

Last verified: 2026-10-19

Recurring data collectors that keep catalog, puzzle and ID pages fresh. They all run on the VPS through the stats worker (see [stats](stats.md#the-stats-worker)) and write production directly. Times are UTC.

## Puzzles

- **Schedule:** early NYT 04:10; Beebom and early 04:45, 05:00, 05:30; late NYT and LinkedIn 07:10, 08:10; full sweep 08:30; strict audit 08:45.
- **Commands:** `sync:puzzles` (`scripts/puzzles/sync-puzzles.ts`), `audit:puzzles`. Page setup by hand: `upsert:puzzle-pages`, `upload:puzzle-icons`.
- **Data:** `puzzle_pages` (evergreen copy), `puzzle_answers` (dated answers), `puzzle_sync_runs`. 14 pages, 1,638 answers.
- LinkedIn needs auth. If it's missing, that puzzle is skipped, not marked fresh.

## Music IDs

- **Schedule:** 06:20 daily: `collect:top-songs` → `collect:music-ids-curated` → `rerank:music-ids`.
- **Data:** `roblox_music_ids` and its views. 60,144 rows.
- Game-specific music and decal usage is by hand: `sync:game-specific-id-sources` writes `data/game-specific-ids/source-backed.json`, then `seed:game-specific-id-usage` loads `roblox_music_id_game_usage` and `roblox_decal_id_game_usage`.

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

## Free items

- 07:00 `import:free-item-candidates` (Python RobloxDen importer), then 07:30 `collect:free-items -- --apply --allow-prod` verifies them against Roblox. Only verified items count as free.

## Promo rewards

- Wednesday 09:40: `refresh:promo-rewards -- --apply --allow-prod` → `roblox_promo_rewards`. 72 rows.

## Reading job health

A wrapper "success" can hide a skipped or partial job. Check `stats_job_runs` for the real outcome.

## Known issues (2026-10-19)

- **Music:** Roblox Creator Store returns HTTP 500, so the job fails before reranking. Last full success 2026-10-14.
- **Item WARM:** fails on a duplicate live canonical key. The item audit reports partial.
- **Item NEW, HOT, COLD:** latest runs were skipped.
- **Catalog enrichment:** partial (219 succeeded, 81 failed on the last run).

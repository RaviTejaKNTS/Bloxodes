# Stats

Last verified: 2026-10-23

Live Roblox game stats at `/stats` (players, visits, ranks, risers, genres, creators) and the monthly Roblox reports. Metric meanings and chart rules are in [stats metrics](stats-metrics.md).

## Universe stats

```text
discovery -> roblox_universes
tiers -> NEW / HOT / WARM / COLD refresh
latest values + hourly samples -> daily rollups
rank snapshots -> current read indexes
/stats pages and APIs -> revalidation -> Cloudflare
```

| Job | Where | Schedule (UTC) |
| --- | --- | --- |
| HOT refresh | Northflank `stats-hot-hourly` | :12 hourly |
| NEW refresh | VPS | :07 every 2 hours |
| Priority discovery | VPS | :22 hourly |
| WARM refresh | VPS | :32 every 6 hours |
| COLD refresh, then current index rebuild | VPS | :47 hourly |
| Hourly playing ranks | VPS | :30 hourly |
| Strict audit | VPS | :10 every 6 hours |
| Daily rollup, hourly prune, audit | VPS | 00:02 |
| Platform hourly summary | VPS | every 5 minutes |
| Platform daily and visit-share summaries | VPS | 01:05 |
| Worker ledger reconcile | VPS | 00:10 |
| Game passes (wiki hubs and top 100 HOT) | VPS | 03:18 daily |
| Badges (wiki hubs and top 100 HOT) | VPS | 03:38 daily |

Daily rank writes are deliberately not scheduled. Commands are `stats:refresh:new|hot|warm|cold` (`update-universe-hourly-stats.ts`), `discover:universes:priority`, `stats:rank:hourly`, `stats:index:refresh`, `stats:rollup-daily`, `stats:platform:refresh`, `stats:prune-hourly` and `stats:audit`. Every run is recorded in `stats_job_runs`.

**Tables:** `roblox_universes`, `roblox_universe_stats_hourly` / `_daily`, `roblox_universe_rank_snapshots*`, `roblox_platform_stats_hourly` / `_daily`, `stats_visit_share_summaries`, `stats_game_current_index` (101,029 games on 2026-10-19), genre, creator and riser indexes, `roblox_universe_update_events`.

**Single-game import:** `enrich-roblox-universes.ts` also exports `previewRobloxUniverse` (fetch and map, no write) and `importRobloxUniverse`, which `content:publish` uses to add one missing `roblox_universes` row before publishing a wiki. Both reuse the enrichment fetcher and mapper; the import never overwrites an existing row.

**Reads:** `apps/web/src/lib/stats.ts`. Public pages hide player values older than 24 hours, so a fresh index alone doesn't mean fresh data. A games-list page past the last row (PostgREST `PGRST103`) is an empty page with the real total, not an error; `/stats/games` returns 404 for it.

**Platform charts:** the platform player chart reads `roblox_platform_stats_hourly` / `_daily`. The every-5-minute job refreshes the last 3 hours of the hourly summary, so the 24-hour chart is a few minutes old; the 01:05 job also refreshes the last 2 days of the daily summary. Only the 24-hour view may fall back to the live `get_stats_platform_ccu_trend` call, and only when the stored summary has no rows. The visit-share chart calls `get_stats_visit_share_chart`, which reads the stored result for the standard 1d, 7d, 14d, 30d and 90d windows from `stats_visit_share_summaries`. The 01:05 job builds them: it reads every universe in batches of 250, ranks each window over every tracked game, and replaces all five windows for today and tomorrow in one transaction (`npm run stats:platform:refresh -- --visit-share-only` rebuilds them alone). Names, slugs and icons come from `roblox_universes` at read time. Other bucket sizes or past windows use the original live calculation. A missing current summary raises `55000`, so the web keeps its last good result. Daily rows that change after 01:05 show up after the next run. There is no smaller-population fallback. Both charts keep one result per range in the web process for 5 minutes (`stats-chart-cache.ts`), share one query between concurrent requests, and keep serving the last good result when a refresh fails. With no good result yet, the panel says the chart didn't load and the browser retries once.

## Game passes and badges

The Game Passes section on wiki hubs (and the mobile API) and the stats game page read `roblox_universe_gamepasses`; the stats game page's badge card reads `roblox_universe_badges`. The NEW/HOT/WARM/COLD tiers don't touch either table.

- **Scope:** both daily jobs cover every published wiki hub's universe first, then the top 100 HOT universes by current players (`scripts/universes/attachment-refresh-scope.ts`). The wiki list isn't capped; when it uses the budget, HOT universes are deferred and listed in the ledger.
- **Game passes (03:18 UTC):** `refresh:wiki-game-passes -- --include-hot` (`npm run refresh:stats-game-passes` is the same). Without the flag it covers wiki hubs only. It reads the full pass list (`passView=Full`, which includes prices) and fetches icons 100 at a time.
- **Badges (03:38 UTC):** `refresh:stats-badges` (`scripts/universes/refresh-stats-badges.ts`) reads up to ten 100-row badge pages per universe, stores Roblox's raw `winRatePercentage` in `rarity_percent` (a fraction, so 0.066 shows as 6.6%) and sets `stats_updated_at`. It fetches no icons and keeps stored icon fields. Missing fields never overwrite stored values.
- **Light on purpose:** one Roblox request start per second, two universes at a time, 15-second attempts, at most 3 attempts per request, an 8-minute run deadline and at most 400 request starts per run, retries included. Work left at the deadline or cap is recorded as deferred, not retried.
- **Safe writes:** upsert by ID, then remove rows Roblox no longer lists, only after a complete successful fetch for that universe. A failed or partial fetch keeps the stored rows. An unchanged pass icon keeps its stored URL when Roblox hasn't finished the new thumbnail; price and sale status still update.
- **Ledger:** passes write `wiki_game_passes_refresh` rows and badges write `stats_badges_refresh` rows in `stats_job_runs`, with scope, counts, request use and deferred IDs. A partial run exits nonzero. Both queue `stats:games` revalidation after any successful write; pass writes also trigger wiki revalidation.
- **Pages:** wiki hubs show only on-sale passes, with their price, and hide the section when none are on sale. Remote icons (passes, badges, developer and stats game icons) swap to a neutral placeholder when the image fails, including before hydration.
- **Related games:** developer games and stats "similar games" need at least 1 current player or 100,000 visits, so dead places stay out.
- **Deep enrichment** (`enrich:universes:deep`) uses the same pass refresh. A failed stage (passes, badges, servers, social links, groups) no longer stops the others; the run fails once at the end, and `last_deep_enriched_at` moves only for universes whose stages all succeeded. Its badge rows have no `stats_updated_at`, so the stats badge card ignores them.

## Stats page sections

`apps/web/src/lib/stats-insights.ts` holds the pure calculations; `StatsInsightCards.tsx` and `StatsInsightCharts.tsx` render them. Metric rules are in [stats metrics](stats-metrics.md#page-sections).

- **Game page**, after the main chart: Players by month at full width; after rank history: How updates did and Votes per day; then Estimated session length and the genre scatter; then Badge rarity and Game pass prices. Paired cards sit two to a row from `md` up and stack on phones.
- **`/stats`:** Biggest moves this week after Fastest risers; Players by day (13-week calendar) after the Platform CCU trend.
- **Reads:** existing tables and indexes only, each with a short abort deadline and its own five-minute last-good cache in `stats-chart-cache.ts` (capped at 2,048 keys). A slow or failed read hides only its own card. A card with too little data hides instead of showing an empty state.

## The stats worker

All VPS stats and data jobs run in short-lived `bloxodes-stats-worker:production` containers built from `Dockerfile.stats-worker`. The same image runs the Northflank HOT job.

- The image build runs `npm run stats:worker:smoke`.
- `scripts/ops/vps-build-stats-worker.sh` (installed as `bin/build-image.sh`) builds only an exact approved 40-character SHA, smoke-tests it, keeps the old healthy image as `last-known-good` and promotes the new one. The nightly 00:05 rebuild uses the pinned approved SHA. Never rebuild from moving `production` HEAD.
- `bin/run-job.sh` (`scripts/ops/vps-run-job.sh`) repeats the smoke before every job and falls back to `last-known-good` if needed. It also handles locks, timeouts, state files and logs under `/home/ravitejaknts/bloxodes-stats-worker/logs`.
- Northflank rebuilds only when worker runtime paths change (Dockerfile, package manifests, `scripts/`, needed web source, `types/`, `data/`, `env/config.json`).

The worker runs separately from the website. Merging code doesn't update it until a new SHA is approved and built. The current pin is `814feb20538e2431ee27b1d35121e59e5eecb411` (promoted 2026-10-23).

A worker change is done only when the Northflank build succeeds, one HOT run succeeds, the VPS image is promoted, and a VPS job plus index rebuild move production health forward.

## Monthly reports

- **Skill:** `bloxodes-monthly-roblox-report`, run by hand for a month and year.
- **Output:** a frozen data file `apps/web/src/data/reports/roblox-<month>-2026.ts`, a route under `apps/web/src/app/(site)/stats/reports/`, chart components and a committed feature image. Raw extracts stay in `tmp/`.
- **Publish:** a code PR and web deploy. Add the report to the reports index, sitemap and feed by hand.
- Reports aren't `articles` rows and don't regenerate.

## Known issues

- The 00:02 daily rollup's single full pass times out, then succeeds in universe chunks. The rank hourly table gains about 1.6M rows a day. The chained hourly prune deletes the oldest rows first in 10,000-row batches, up to 6M rows per table a night, halves the batch after a timeout and records `partial` with the rows it deleted after three timeouts. Both hourly history tables become eligible for autovacuum after 200,000 dead rows and autoanalyze after 1M changed rows; check `pg_stat_user_tables` dead-row counts after large prunes. Hourly history reached back to June 20 in October 2026 and clears to 90 days over the following nights. The 01:05 daily platform summary scans `roblox_universe_stats_daily` without a date-first index and can still fail; when it does, daily-resolution charts end a day early.
- The hourly platform summary adds up only the games sampled in each hour. HOT games land in alternate hours, so the 24-hour player chart zig-zags between about 10K and 13M. Daily views are not affected.
- `peak_players` in `roblox_platform_stats_hourly` / `_daily` adds up each game's own peak, and games peak at different times, so it overstates the real concurrent peak (33.9M against about 16M real in October 2026). Don't show it as "peak players"; the Players by day calendar uses daily average players.
- Daily rank snapshots aren't scheduled. `roblox_universe_rank_snapshots_daily` has no rows after 2026-08-09, so no page section should read it until the job is scheduled again.
- The August 2026 report is live but missing from the stats sitemap and feed.

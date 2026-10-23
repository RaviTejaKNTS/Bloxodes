# Stats

Last verified: 2026-10-20

Live Roblox game stats at `/stats` (players, visits, ranks, risers, genres, creators) and the monthly Roblox reports. Metric meanings and chart rules are in [stats metrics](stats-metrics.md).

## Prepared platform and visit-share charts

The service-only `stats-prepared@1` store and dedicated runtime prepare platform and visit-share answers. The first release adds this producer while existing public chart readers continue to run. Switch public readers in a separate release only after the benchmark and actual bootstrap prove usable data for every intended selection. Empty prepared tables have no legacy seed.

Once activated, the dedicated homelab worker checks every five minutes, advances bounded source/backfill work and publishes ready generations. The platform SQL reader supports all five periods, four resolutions and previous-period rows in one RPC. Visit share publishes the five ranges together, preserving whole-period ranking and all positive games in the denominator. JSON wraps the complete result, avoiding the REST 1,000-row limit. Missing source history stays explicit; daily inputs still depend on the separate daily producer. This job does not collect new Roblox samples every five minutes.

`types/stats-prepared.ts` defines the SQL wire contract. The fixed Node 22 entrypoint is `scripts/universes/refresh-prepared-charts.mjs`. The worker uses a fenced database lease, durable step receipts and staged publication. Failed preparation leaves the active result intact. Source observation, generation, publication and successful check times have separate meanings; a new check cannot make old source data fresh.

One monotonic 210-second invocation budget includes claim, advance ambiguity recovery and durable finish recovery. Every HTTP call is limited by the remaining budget and its 10-second advance or 8-second control ceiling. Starting another advance requires 53 seconds remaining for receipt lookup, identical replay and finish recovery. HTTP cancellation does not prove SQL rollback; SQL retains separate statement and lock deadlines.

SQL result states are ready, partial, last-good, verified empty and unavailable. A useful last-good result keeps its original dates. `get_stats_prepared_health_v1` reports schema compatibility separately from operational state. A compatible response or non-null generation ID alone does not prove usable chart coverage. The public API/UI cutover, private authenticated web health route, removal of chart API warming and external prepared-heartbeat monitor belong to the reader release; they are not active from this producer release alone.

Successfully removing the final source observation publishes an immutable missing-source generation. Selected rows then return unavailable. Cold empty work and unchanged checks do not refresh generation or publication dates. Processed-empty buckets describe missing coverage; they are not public zero observations.

Package/activation, timer ownership, limits, rollback and credentials are in [release](../operations/release.md#prepared-chart-runtime), [schedules](../automation/schedules.md#homelab-systemd) and [environment](../environment.md). Merging web code does not activate this runtime or move existing VPS/Northflank pins. Existing platform aggregate tables/functions remain for compatibility; their legacy nightly schedule is separate from the new prepared generation pipeline.

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
| Platform aggregates | VPS | 01:05 |
| Worker ledger reconcile | VPS | 00:10 |

Daily rank writes are deliberately not scheduled. Commands are `stats:refresh:new|hot|warm|cold` (`update-universe-hourly-stats.ts`), `discover:universes:priority`, `stats:rank:hourly`, `stats:index:refresh`, `stats:rollup-daily`, `stats:platform:refresh`, `stats:prune-hourly` and `stats:audit`. Every run is recorded in `stats_job_runs`.

**Tables:** `roblox_universes`, `roblox_universe_stats_hourly` / `_daily`, `roblox_universe_rank_snapshots*`, `roblox_platform_stats_hourly` / `_daily`, `stats_game_current_index` (101,029 games on 2026-10-19), genre, creator and riser indexes, `roblox_universe_update_events`.

**Single-game import:** `enrich-roblox-universes.ts` also exports `previewRobloxUniverse` (fetch and map, no write) and `importRobloxUniverse`, which `content:publish` uses to add one missing `roblox_universes` row before publishing a wiki. Both reuse the enrichment fetcher and mapper; the import never overwrites an existing row.

**Reads:** `apps/web/src/lib/stats.ts`. Public pages hide player values older than 24 hours, so a fresh index alone doesn't mean fresh data.

## The stats worker

All VPS stats and data jobs run in short-lived `bloxodes-stats-worker:production` containers built from `Dockerfile.stats-worker`. The same image runs the Northflank HOT job.

- The image build runs `npm run stats:worker:smoke`.
- `scripts/ops/vps-build-stats-worker.sh` (installed as `bin/build-image.sh`) builds only an exact approved 40-character SHA, smoke-tests it, keeps the old healthy image as `last-known-good` and promotes the new one. The nightly 00:05 rebuild uses the pinned approved SHA. Never rebuild from moving `production` HEAD.
- `bin/run-job.sh` (`scripts/ops/vps-run-job.sh`) repeats the smoke before every job and falls back to `last-known-good` if needed. It also handles locks, timeouts, state files and logs under `/home/ravitejaknts/bloxodes-stats-worker/logs`.
- Northflank rebuilds only when worker runtime paths change (Dockerfile, package manifests, `scripts/`, needed web source, `types/`, `data/`, `env/config.json`).

The worker runs separately from the website. Merging code doesn't update it until a new SHA is approved and built. The current pin is `2d78a083dbac97402f666bb99e14afd5930fc223`.

A worker change is done only when the Northflank build succeeds, one HOT run succeeds, the VPS image is promoted, and a VPS job plus index rebuild move production health forward.

## Monthly reports

- **Skill:** `bloxodes-monthly-roblox-report`, run by hand for a month and year.
- **Output:** a frozen data file `apps/web/src/data/reports/roblox-<month>-2026.ts`, a route under `apps/web/src/app/(site)/stats/reports/`, chart components and a committed feature image. Raw extracts stay in `tmp/`.
- **Publish:** a code PR and web deploy. Add the report to the reports index, sitemap and feed by hand.
- Reports aren't `articles` rows and don't regenerate.

## Known issues

- Daily universe rollup (00:02) and platform refresh (01:05) are timing out, so the chained prune and audit may not run.
- `stats-health-monitor.yml` is set to every 5 minutes but GitHub runs it only every couple of hours.
- The August 2026 report is live but missing from the stats sitemap and feed.

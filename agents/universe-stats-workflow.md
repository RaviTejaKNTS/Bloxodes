# Roblox Universe Stats Workflow

This workflow powers `/stats` and Roblox universe metadata.

Last verified runtime notes: 2026-06-08.

## Data Rules

- Use one tier column: `roblox_universes.stats_tier`.
- Do not use the old quality scoring model.
- Do not overwrite existing good data with `null` when Roblox omits a field.
- Fetch favorites from Roblox game details and likes/dislikes from the separate Roblox votes API.
- Do not delete old icons or thumbnails.
- Store every distinct icon/screenshot URL in `roblox_universe_media`.
- `roblox_universes.icon_url` and `thumbnail_urls` are convenience fields only; the durable media history is `roblox_universe_media`.

## Tiers

`NEW`
: Newly discovered, never stats-refreshed, or missing basic stats.

`HOT`
: `playing >= 100` or `visits >= 250,000,000`.

`WARM`
: `playing >= 30` or `visits >= 10,000,000`.

`COLD`
: All other valid Roblox universes.

Null stats do not punish a game. Tiering uses whichever of `playing` or `visits` is available.

## Normal Flow

```txt
collect Explore universes
-> collect search-discovered universes
-> collect creator/group-discovered universes
-> light enrich new rows
-> refresh NEW stats
-> assign stats_tier
-> continue NEW backlog refresh every 2h
-> refresh HOT hourly
-> refresh WARM every 12h
-> refresh rotating COLD batches
-> rank stats
-> roll up daily stats
-> audit and repair media/staleness
-> deep enrich HOT games
```

## Current Production Runtime

Stats and universe jobs no longer run from GitHub Actions. GitHub Actions should stay for deploy/content jobs only.

Production is split across three places:

```txt
VPS worker      -> NEW/WARM/COLD/discovery/deep enrichment/audit
Northflank      -> HOT hourly refresh + rank jobs
Supabase cron   -> DB-local rollups/pruning/health/revalidation drain
```

Do not look for these jobs inside the public Bloxodes web app container. The VPS stats worker is a separate Docker worker launched by cron.

### VPS Worker

Current VPS host:

```txt
187.124.68.197
```

Current worker user and folder:

```txt
user: codex-admin
folder: /home/codex-admin/bloxodes-stats-worker
image: bloxodes-stats-worker:production
source branch: production
dockerfile: Dockerfile.stats-worker
cron marker: BLOXODES_STATS_WORKER
```

Important: `codex-admin` is the current live owner because that is how the worker was originally installed. Long term, this should move to a dedicated production worker user and a neutral folder such as `/srv/bloxodes/stats-worker`, but do not assume that migration has happened unless the VPS says so.

Current worker files on the VPS:

```txt
/home/codex-admin/bloxodes-stats-worker/bin/run-job.sh
/home/codex-admin/bloxodes-stats-worker/bin/build-image.sh
/home/codex-admin/bloxodes-stats-worker/env.stats-worker
/home/codex-admin/bloxodes-stats-worker/logs/
/home/codex-admin/bloxodes-stats-worker/repo/
```

`build-image.sh` pulls the `production` branch into the worker repo and builds:

```txt
docker build -t bloxodes-stats-worker:production -f Dockerfile.stats-worker .
```

`run-job.sh` runs one-off Docker jobs:

```txt
docker run --rm \
  --env-file /home/codex-admin/bloxodes-stats-worker/env.stats-worker \
  -e STATS_WORKER_COMMAND="<cron command>" \
  bloxodes-stats-worker:production
```

`Dockerfile.stats-worker` executes:

```txt
eval "${STATS_WORKER_COMMAND:-npm run stats:audit}"
```

So the `codex-admin` crontab command is the source of truth for each VPS job.

Current VPS crontab block:

```cron
# BLOXODES_STATS_WORKER_START
5 0 * * * /home/codex-admin/bloxodes-stats-worker/bin/build-image.sh >> /home/codex-admin/bloxodes-stats-worker/logs/build-image.log 2>&1
7 */2 * * * /home/codex-admin/bloxodes-stats-worker/bin/run-job.sh stats-new-refresh "npm run enrich:universes:light -- --tier NEW --limit 1000 --batch 25 && npm run stats:refresh:new -- --limit 5000 && npm run stats:tier -- --tier NEW && npm run enqueue:revalidation -- --source stats_new_vps --event stats:stats --event stats:games"
32 */12 * * * /home/codex-admin/bloxodes-stats-worker/bin/run-job.sh stats-warm-refresh "npm run stats:refresh:warm -- --limit 20000 && npm run stats:tier -- --tier WARM && npm run enqueue:revalidation -- --source stats_warm_vps --event stats:stats --event stats:games"
47 */6 * * * /home/codex-admin/bloxodes-stats-worker/bin/run-job.sh stats-cold-refresh "npm run stats:refresh:cold -- --limit 10000 && npm run stats:tier -- --tier COLD && npm run enqueue:revalidation -- --source stats_cold_vps --event stats:stats --event stats:games"
35 1 * * * /home/codex-admin/bloxodes-stats-worker/bin/run-job.sh stats-discovery "npm run collect:universes && npm run enrich:universes:light -- --tier NEW --limit 1000 --batch 25"
5 2 * * * /home/codex-admin/bloxodes-stats-worker/bin/run-job.sh stats-deep-enrichment "npm run enrich:universes:deep -- --tier HOT --limit 500 --batch 25"
10 */6 * * * /home/codex-admin/bloxodes-stats-worker/bin/run-job.sh stats-audit "npm run stats:audit"
# BLOXODES_STATS_WORKER_END
```

VPS logs live here:

```txt
/home/codex-admin/bloxodes-stats-worker/logs/build-image.log
/home/codex-admin/bloxodes-stats-worker/logs/stats-new-refresh.log
/home/codex-admin/bloxodes-stats-worker/logs/stats-warm-refresh.log
/home/codex-admin/bloxodes-stats-worker/logs/stats-cold-refresh.log
/home/codex-admin/bloxodes-stats-worker/logs/stats-discovery.log
/home/codex-admin/bloxodes-stats-worker/logs/stats-deep-enrichment.log
/home/codex-admin/bloxodes-stats-worker/logs/stats-audit.log
```

### VPS Discovery Detail

Current verified VPS discovery is Explore-only until the expanded discovery cron lines are installed on the VPS.

The cron runs:

```txt
npm run collect:universes
```

That maps to:

```txt
tsx scripts/universes/collect-roblox-universes.ts
```

The script calls Roblox Explore:

```txt
https://apis.roblox.com/explore-api/v1/get-sorts
https://apis.roblox.com/explore-api/v1/get-sort-content
```

Current default discovery dimensions:

```txt
devices: computer, phone, tablet, console, vr
countries: us, gb, ca, au, br, ph, id, tr, de, fr, jp, kr
```

The script writes discovered rows directly into:

```txt
roblox_universes
```

It sets `raw_metadata.source = "explore"` and updates `last_seen_in_sort`.

As of the last check, the VPS worker did not have active `search:universes` or `expand:creators` commands in the production worker repo. The only active universe discovery command there was `collect:universes`.

Known limitation: if a Roblox game is not returned by the Explore sort pages for the configured country/devices during the crawl, this workflow will not discover it.

Recent verified discovery run:

```txt
2026-06-08T01:35:01+00:00 starting stats-discovery
2026-06-08T01:42:46+00:00 finished stats-discovery
Explore crawl complete: 125 sorts, 6780 entries stored, 1166 total unique universes
```

The recurring `try-voice-chat` 404 in discovery logs is non-fatal:

```txt
Sort not found or not enabled
```

### Expanded Discovery Sources

The repo now has two additional discovery-only scripts. These scripts insert missing universes as `NEW` and do not change the stats refresh/tier flow.

```txt
npm run discover:universes:search
npm run discover:universes:creators
```

Search discovery:

```txt
file: scripts/universes/search-roblox-universes.ts
source: Roblox omni-search
purpose: catch games that Explore sort pages miss
example gap it targets: VV: ULTIMATUM / universe 2309918273
```

Creator/group discovery:

```txt
file: scripts/universes/expand-roblox-creators.ts
source: public games from creators/groups behind known HOT/WARM universes
purpose: catch other active games from creators we already know
```

Suggested VPS cron additions after the worker image has the new scripts:

```cron
20 3 * * * /home/codex-admin/bloxodes-stats-worker/bin/run-job.sh stats-discovery-search "npm run discover:universes:search -- --max-pages 2 && npm run enrich:universes:light -- --tier NEW --limit 1000 --batch 25"
10 4 * * * /home/codex-admin/bloxodes-stats-worker/bin/run-job.sh stats-discovery-creators "npm run discover:universes:creators -- --limit 500 --max-pages 2 && npm run enrich:universes:light -- --tier NEW --limit 1000 --batch 25"
```

Do not add direct HOT shortcuts here. New rows should continue through the existing path:

```txt
discover -> NEW -> stats-new-refresh -> stats:tier -> HOT/WARM/COLD
```

Explore now covers more geography by default:

```txt
us, gb, ca, au, br, ph, id, tr, de, fr, jp, kr
```

Only add more countries beyond this list if the Explore crawl duration and Roblox rate limits stay healthy.

### Northflank

Northflank stats account `_1` currently owns the fast ranking/stats jobs.

Project:

```txt
bloxodes
```

Current Northflank stats jobs:

```txt
stats-hot-hourly
stats-daily-ranks
```

`stats-hot-hourly`:

```txt
schedule: hourly at :12 UTC
purpose: refresh HOT Roblox universe stats and write hourly playing ranks
```

`stats-daily-ranks`:

```txt
schedule: daily at 00:50 UTC
purpose: snapshot complete daily Roblox universe rank history
```

Northflank does not run the VPS discovery job. Do not look for `stats-discovery` in the Northflank stats account.

### Supabase Cron

Supabase owns DB-local jobs only. Keep network-heavy Roblox crawling/refreshing out of Supabase cron.

Supabase-side work includes:

```txt
daily stats rollup
hourly history pruning
health checks
revalidation queue drain
```

Supabase should not be treated as the owner of `collect:universes`.

## Main Commands

```txt
npm run collect:universes
npm run discover:universes:search
npm run discover:universes:creators
npm run enrich:universes:light -- --tier NEW
npm run stats:refresh -- --tier NEW|HOT|WARM|COLD|ALL
npm run stats:refresh:hot
npm run stats:refresh:warm
npm run stats:refresh:cold
npm run stats:refresh -- --universe-id <id>
npm run stats:tier
npm run stats:rank -- --all --granularity hourly --rank-set playing --snapshot-scope relevant
npm run stats:rank -- --all --granularity daily --rank-set all --snapshot-scope all
npm run stats:rollup-daily -- --date yesterday --finalize
npm run stats:prune-hourly -- --days 90 --apply
npm run stats:audit
npm run enrich:universes:deep -- --tier HOT
```

## Automation Ownership Summary

| Job area | Owner | Schedule |
| --- | --- | --- |
| HOT refresh + hourly playing ranks | Northflank `stats-hot-hourly` | Hourly at `:12` UTC, `:42` IST |
| Daily all-game ranks | Northflank `stats-daily-ranks` | Daily `00:50` UTC, `06:20` IST |
| NEW refresh | VPS worker `stats-new-refresh` | Every 2 hours at `:07` UTC, `:37` IST |
| WARM refresh | VPS worker `stats-warm-refresh` | Every 12 hours at `:32` UTC, `:02` IST |
| COLD refresh | VPS worker `stats-cold-refresh` | Every 6 hours at `:47` UTC, `:17` IST |
| Discovery | VPS worker `stats-discovery` | Daily `01:35` UTC, `07:05` IST |
| Search discovery | VPS worker `stats-discovery-search` | Suggested daily `03:20` UTC, `08:50` IST |
| Creator/group discovery | VPS worker `stats-discovery-creators` | Suggested daily `04:10` UTC, `09:40` IST |
| Deep enrichment | VPS worker `stats-deep-enrichment` | Daily `02:05` UTC, `07:35` IST |
| Daily rollup + hourly prune | Supabase cron/RPC | Daily after UTC day boundary |

## Schema

Current tier columns:

```txt
roblox_universes.stats_tier
roblox_universes.stats_tier_updated_at
roblox_universes.stats_tier_reason
```

Stats history tables:

```txt
roblox_universe_stats_hourly
roblox_universe_stats_daily
```

Rank history tables:

```txt
roblox_universe_rank_snapshots_hourly
roblox_universe_rank_snapshots_daily
roblox_universe_update_events
```

Hourly tables are short-range working history and can be pruned after 90 days. Daily tables are the long-range record.
`roblox_universe_update_events` is a durable marker table for Roblox `updated_at_api` changes detected by the hourly stats refresh.

Old quality columns are removed by migration:

```txt
discovery_score
quality_score
quality_tier
quality_reasons
last_quality_scored_at
is_quality_candidate
```

Removed discovery artifact tables:

```txt
roblox_universe_discovery_jobs
roblox_universe_sort_definitions
roblox_universe_sort_runs
roblox_universe_sort_entries
roblox_universe_search_snapshots
```

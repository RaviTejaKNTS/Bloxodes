# Roblox Universe Stats Workflow

This workflow powers `/stats` and Roblox universe metadata.

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

## Main Commands

```txt
npm run collect:universes
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

## Automation Ownership

Stats and universe refresh jobs no longer run from GitHub Actions. Keep GitHub Actions for deploy and content jobs only.

| Job area | Owner | Schedule |
| --- | --- | --- |
| HOT refresh + hourly playing ranks | Northflank `stats-hot-hourly` | Hourly at `:12` UTC, `:42` IST |
| Daily all-game ranks | Northflank `stats-daily-ranks` | Daily `00:50` UTC, `06:20` IST |
| NEW refresh | VPS worker `stats-new-refresh` | Every 2 hours at `:07` UTC, `:37` IST |
| WARM refresh | VPS worker `stats-warm-refresh` | Every 12 hours at `:32` UTC, `:02` IST |
| COLD refresh | VPS worker `stats-cold-refresh` | Every 6 hours at `:47` UTC, `:17` IST |
| Discovery | VPS worker `stats-discovery` | Daily `01:35` UTC, `07:05` IST |
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

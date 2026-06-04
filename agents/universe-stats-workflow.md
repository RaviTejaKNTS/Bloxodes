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

## GitHub Actions

| Action | Schedule | Refreshes |
| --- | --- | --- |
| `universe-explore-discovery.yml` | Daily `01:35` UTC, `07:05` IST | Lean Explore discovery, max 30 sorts x 2 pages, light enrich NEW, refresh NEW stats, assign tiers |
| `universe-new-refresh.yml` | Every 2 hours at `:07` UTC, `:37` IST | Light enrich NEW backlog, refresh 5,000 NEW stats, assign NEW tiers |
| `roblox-stats-hourly.yml` | Hourly at `:12` UTC, `:42` IST | Refresh HOT stats, roll up today, compute all-game playing ranks, store rank-relevant hourly snapshots, revalidate `/stats` |
| `roblox-stats-daily-ranks.yml` | Daily `00:50` UTC, `06:20` IST | Store full all-game daily rank snapshots for playing, visits, favorites, and rating |
| `roblox-stats-hourly-retention.yml` | Daily `01:25` UTC, `06:55` IST | Delete hourly stats and hourly rank rows older than 90 days |
| `universe-warm-refresh.yml` | Every 12 hours at `:32` UTC, `:02` IST | Refresh WARM only, then reassign WARM tiers |
| `universe-cold-refresh.yml` | Every 6 hours at `:47` UTC, `:17` IST | Refresh rotating COLD batches only, then reassign COLD tiers |
| `roblox-stats-daily-finalize.yml` | Daily `00:20` UTC, `05:50` IST | Finalize yesterday, audit, repair HOT/WARM media, revalidate `/stats` |
| `universe-deep-enrichment.yml` | Daily `02:05` UTC, `07:35` IST | Deep enrich HOT games only |

Keep WARM and COLD in separate GitHub Actions. COLD can run longer and hit more platform throttling, so it should not block WARM freshness.

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
```

Hourly tables are short-range working history and can be pruned after 90 days. Daily tables are the long-range record.

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

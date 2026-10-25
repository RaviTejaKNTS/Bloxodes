# Stats metrics

Last verified: not rechecked since the move from `docs/stats/`. Check the chart code in `apps/web/src/lib/stats.ts` before relying on a detail here.

What each public stats metric means and how chart periods and resolutions shape it.

## Base Rules

- Do not show a separate latest card inside the chart. The chart is for selected metric and selected period only.
- Every metric must clearly be one of: CCU, cumulative value, period growth, or ratio.
- Do not overwrite existing good values with `null` when Roblox skips a field.
- Store raw samples first, then derive daily and period values from those samples.
- Show low-confidence or missing data honestly instead of inventing smooth values.
- Do not mix CCU and visit growth in the same metric.

## Current Data Sources

- `playing`: Roblox game details API, current concurrent players snapshot.
- `visits`: Roblox game details API, cumulative lifetime visits.
- `favorites`: Roblox game details API, cumulative favorites when Roblox provides it.
- `likes` and `dislikes`: Roblox game votes API.
- `rating`: derived from likes and dislikes.

Current scripts already store hourly starts, ends, deltas, and samples in `roblox_universe_stats_hourly`, then roll them into `roblox_universe_stats_daily`.

## Time Periods

Use the same period options for all chart metrics:

- `1d`
- `7d`
- `14d`
- `30d`
- `90d`

Do not show `All` in the chart period selector for now. It creates unclear expectations when history coverage is incomplete.

## Chart Resolutions

Use the same resolution options for all time periods:

- `Hourly`
- `Daily`
- `Weekly`
- `Monthly`

Every period/resolution combination is valid. If a user selects `1d + Monthly`, show one point. If a user selects `90d + Hourly`, show all hourly points available for that 90-day window.

Bucket sizes are range-relative:

| Resolution | Bucket size |
| --- | --- |
| Hourly | 1 hour |
| Daily | 1 day |
| Weekly | 7 days |
| Monthly | 30 days |

This means:

| Selection | Expected points |
| --- | --- |
| `1d + Hourly` | about 24 |
| `1d + Monthly` | 1 |
| `14d + Weekly` | 2 |
| `30d + Monthly` | 1 |
| `90d + Monthly` | 3 |

The chart API should fetch only the selected period/resolution combination and cache it client-side by `period:resolution`.

## Playing

Playing means concurrent users over time.

Do not use `visit_delta` for Playing.

Use one field per bucket:

| Bucket | Field |
| --- | --- |
| Hourly | `avg_playing ?? playing` |
| Daily | `avg_playing ?? playing` |
| Weekly | weighted average of hourly `avg_playing ?? playing` |
| Monthly | weighted average of hourly `avg_playing ?? playing` |

Page summary values:

| UI value | Field |
| --- | --- |
| Current Playing | `roblox_universes.playing` |
| 24h Peak | max `roblox_universe_stats_hourly.peak_playing` over last 24 hours |

`peak_playing` is only for peak labels and rank/sort helpers. The main Playing chart should use `avg_playing ?? playing` so it does not exaggerate every bucket.

## Visits

Visits means the cumulative Roblox visit count as of the selected period endpoint.

Do not use visit delta here. Delta belongs to Period Growth.

Period behavior:

| Period | Show |
| --- | --- |
| `1d` | Latest visits count inside the 1d window |
| `7d` | Visits count at the end of the 7d window |
| `14d` | Visits count at the end of the 14d window |
| `30d` | Visits count at the end of the 30d window |
| `90d` | Visits count at the end of the 90d window |

Visits should normally only increase. If Roblox corrects a count downward, keep the sample but mark the derived delta as suspicious.

## Favorites

Favorites means the cumulative Roblox favorite count as of the selected period endpoint.

Favorites can increase or decrease because users can unfavorite games.

Period behavior:

| Period | Show |
| --- | --- |
| `1d` | Latest favorites count inside the 1d window |
| `7d` | Favorites count at the end of the 7d window |
| `14d` | Favorites count at the end of the 14d window |
| `30d` | Favorites count at the end of the 30d window |
| `90d` | Favorites count at the end of the 90d window |

Favorite change can be shown separately, but the main value is the count.

## Rating

Rating means likes to dislikes ratio.

```txt
rating = likes / (likes + dislikes)
```

Period behavior:

| Period | Show |
| --- | --- |
| `1d` | Rating at the latest sample inside the 1d window |
| `7d` | Rating at the end of the 7d window |
| `14d` | Rating at the end of the 14d window |
| `30d` | Rating at the end of the 30d window |
| `90d` | Rating at the end of the 90d window |

Do not average ratings across a period. If needed, show rating movement separately by comparing `rating_start` and `rating_end`.

## Period Growth

Period Growth is separate from the four main chart metrics.

Use it for values like:

- `1d visits gained`
- `7d visits gained`
- `14d visits gained`
- `30d visits gained`
- `90d visits gained`

Formula:

```txt
period_growth = visits_end - visits_start
```

Use fields:

| Period | Field |
| --- | --- |
| `1d` | sum or boundary delta from hourly `visit_delta`, only when coverage is good |
| `7d` | sum daily `visit_delta` |
| `14d` | sum daily `visit_delta` |
| `30d` | sum daily `visit_delta` |
| `90d` | sum daily `visit_delta` |

Do not call this Playing. It is traffic growth from Roblox's cumulative visit counter.

## Rank History

Rank History is separate from Playing, Visits, Favorites, and Rating.

Use rank snapshots written by `npm run stats:rank` for rank charts and rank milestones.

The rank workflow mirrors metric history with two tables:

- `roblox_universe_rank_snapshots_hourly`: short-range chart data. Compute playing ranks across all eligible games, but store only rank-relevant snapshots (`HOT`, `WARM`, top global ranks, top genre ranks, top subgenre ranks).
- `roblox_universe_rank_snapshots_daily`: long-range rank history. Store full all-game daily snapshots.

Current rank types:

| Rank type | Meaning |
| --- | --- |
| `global_playing` | Rank among tracked games by current playing |
| `genre_playing` | Rank among tracked games in the same genre by current playing |
| `subgenre_playing` | Rank among tracked games in the same subgenre by current playing |

Rank charts use the same period and resolution selectors as metric charts. The y-axis must be reversed so `#1` appears at the top.

Rank milestone table values should come from the selected rank snapshot window:

| UI value | Logic |
| --- | --- |
| Current | latest rank sample in the selected period |
| Best | lowest rank number in the selected period |
| First #1 | first sample where rank equals `1` |
| Left #1 | latest transition from rank `1` to rank `> 1` |
| First Top 10 | first sample where rank is `<= 10` |
| Left Top 10 | latest transition from rank `<= 10` to rank `> 10` |

## Confidence Rules

Every period value should know how complete it is.

Track or derive:

- first sample time
- last sample time
- sample count
- covered hours or days
- expected hours or days
- whether the value is finalized or partial

If a period does not have enough coverage, still show the best available value, but mark it as partial instead of pretending it is complete.

## Workflow Impact

Current workflow is mostly aligned:

- hourly stats refresh stores snapshots, starts, ends, and deltas
- daily rollup derives daily starts, ends, deltas, rating start/end, and sample counts
- Roblox null values do not replace existing good values
- votes API is used for likes and dislikes

Needed improvements:

- Build metric helpers so Playing, Visits, Favorites, Rating, and Period Growth each use the right meaning.
- Add explicit coverage/confidence output to the stats API.
- Use `avg_playing ?? playing` for the Playing chart.
- Use range-relative buckets for Hourly, Daily, Weekly, and Monthly chart resolutions.
- Use `visit_delta` only for Period Growth.
- Use cumulative endpoints for Visits and Favorites.
- Use rating endpoint values, not average rating.
- Keep hourly `stats:rank -- --all --granularity hourly --rank-set playing --snapshot-scope relevant` running after HOT refresh so global, genre, and subgenre rank history stays fresh without storing every game every hour.
- Keep daily `stats:rank -- --all --granularity daily --rank-set all --snapshot-scope all` running so every tracked game gets complete long-term rank history.
- Prune only hourly history older than 90 days. Keep daily stats and daily ranks for longer history.

## Page sections

Rules for the game page and `/stats` cards built in `apps/web/src/lib/stats-insights.ts`. A card hides when it has too little data; it never shows an empty state.

| Card | Source | Rule |
| --- | --- | --- |
| Players by month | `roblox_universe_stats_daily` | "Last 30 days" first, compared with the 30 days before it. Then up to 12 completed UTC months, newest first; the current month is left out. Average = mean of daily `avg_playing ?? playing`; peak = max `peak_playing`. A period needs 7 distinct days of data. |
| Milestones | daily stats, `roblox_universe_rank_snapshots_daily` | New tracked player peaks that beat the previous peak by at least 100 players and 5%; first `global_playing` #1 and top 10; visit and favorite crossings at 1/2/5 × 10ⁿ up to 1B, then every 1B to 10B, 5B to 100B, 10B above. Six items, newest first, at most 2 visit and 2 favorite items. Counter milestones hide when the 1,000-row daily history is cut off. |
| How updates did | `roblox_universe_update_events`, hourly stats, `roblox_virtual_events` | The last 5 updates between 89 days and 48 hours ago. Before = average players over the 24 hours before; after = over the 48 hours after. Each side needs at least half of its complete hourly buckets, so alternate-hour HOT sampling passes. A virtual event starting within 12 hours names the row. Under 5% change shows a grey pill. |
| Votes per day | daily `like_delta`, `dislike_delta` | Last 21 completed days. |
| Estimated session length | daily `avg_playing`, `visit_delta` | `avg_playing × 1440 ÷ visit_delta` minutes, finalized days with at least 12 samples, kept between 0.1 and 720 minutes. Rejoins count as visits, so it is an estimate and the card says so. Needs 5 usable days. |
| Genre scatter | `stats_game_current_index`, `stats_genre_current_index` | Up to 300 same-genre games with 1,000+ fresh players and a rating; y is players on a log scale. Genre count comes from `stats_genre_current_index.games`. Needs 10 peers. |
| Badge rarity | `roblox_universe_badges` | Up to 6 enabled badges spread from most common to rarest. `rarity_percent` holds Roblox's `winRatePercentage` as a fraction (×100 for display), the same number Roblox shows as rarity. Its denominator isn't documented, so don't call it a share of players. Only rows the badge job stamped in the last 7 days count. |
| Game pass prices | `roblox_universe_gamepasses` | On-sale passes with a price above 0 on a log Robux axis that grows to the next round tick past the highest price. |
| Biggest moves this week | `stats_game_current_index.growth_7d_percent` | The top 1,000 games by players with 5,000+ fresh players and a 7-day baseline of 1,000+; top 4 up and top 4 down. Bars cap at ±100%; labels show the real change. It compares player snapshots, not weekly averages. |
| Players by day | `roblox_platform_stats_daily.playing` | 13 Sunday-first weeks of daily average players. Never use `peak_players` here: it adds up each game's own peak. Missing days stay empty. |

Every read has a 3-second deadline and a five-minute last-good cache per key, so a slow or failed read hides only its own card.

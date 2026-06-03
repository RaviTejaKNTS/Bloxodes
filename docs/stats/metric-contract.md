# Stats Metric Contract

This doc defines what each public stats metric means and how chart period/resolution selectors should shape it.

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

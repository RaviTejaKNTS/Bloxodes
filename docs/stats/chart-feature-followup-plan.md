# Stats Chart Feature Follow-up Plan

This doc tracks the chart features we planned after the first stats/rank chart cleanup. Keep the metric definitions in `docs/stats/metric-contract.md` as the source of truth for what each metric means.

## Current Chart Surface

Public page:

- `/stats/games/<roblox_universes.slug>`
- Stats slugs use `roblox_universes.slug`, currently `slug-universeId` style.

Current components:

- `apps/web/src/app/(site)/stats/components/StatsChartPanel.tsx`
- `apps/web/src/app/(site)/stats/components/StatsRankChartPanel.tsx`
- Shared data/read helpers live in `apps/web/src/lib/stats.ts`.

Current chart APIs:

- `/api/stats/games/[universeId]/chart`
- `/api/stats/games/[universeId]/rank-chart`

Both APIs accept:

- `range`: `1d`, `7d`, `14d`, `30d`, `90d`
- `resolution`: `hourly`, `daily`, `weekly`, `monthly`

The page should fetch/cache only the selected `range + resolution` payload instead of preloading every chart mode.

## Current Tables

Metric history:

- `roblox_universe_stats_hourly`
  - Short-range public metric history.
  - One row per universe per hour.
  - Stores playing, visits, favorites, likes, dislikes, rating, starts/ends, deltas, averages, peaks, mins, sample counts, and raw snapshot JSON.
  - Prune after 90 days.
- `roblox_universe_stats_daily`
  - Long-range daily metric summaries.
  - Keep this as the durable history.

Rank history:

- `roblox_universe_rank_snapshots_hourly`
  - Short-range public rank history.
  - Used for hourly rank chart views.
  - Prune after 90 days.
- `roblox_universe_rank_snapshots_daily`
  - Long-range daily rank history.
  - Keep this as the durable rank record.

Event history:

- `roblox_virtual_events`
  - Use this for chart event overlays.
  - Important fields: `event_id`, `universe_id`, `title`, `display_title`, `start_utc`, `end_utc`, `created_utc`, `updated_utc`, `event_status`, `event_visibility`, `guide_slug`, `raw_event_json`.
- `events_pages`
  - Editorial event landing pages only.
  - Do not use this as the chart event timeline source.

Update history:

- `roblox_universe_update_events`
  - Stores historical Roblox game update markers detected by the hourly stats/details refresh.
  - `roblox_universes.updated_at_api` stores only the latest Roblox game update timestamp, so old markers must live here.

## Current Automation

Metric collection:

- Script: `scripts/universes/update-universe-hourly-stats.ts`
- Commands: `npm run stats:refresh:new`, `npm run stats:refresh:hot`, `npm run stats:refresh:warm`, `npm run stats:refresh:cold`
- Hourly HOT stats workflow refreshes hot games and writes metric samples.
- WARM and COLD should stay in separate GitHub Actions/scripts so slower refreshes do not block hot freshness.
- Daily rollup turns hourly metric data into daily summaries.

Rank collection:

- Script: `scripts/universes/rank-universe-stats.ts`
- Command: `npm run stats:rank`
- Hourly rank workflow computes all-game playing ranks, then stores rank-relevant rows in `roblox_universe_rank_snapshots_hourly`.
- Daily rank workflow stores full daily all-game rank rows in `roblox_universe_rank_snapshots_daily`.

Retention:

- Script: `scripts/universes/prune-universe-hourly-history.ts`
- Command: `npm run stats:prune-hourly`
- Hourly metric and hourly rank tables should be pruned after 90 days.
- Daily tables should stay.

Current automation:

| Job | Owner | Main outcome |
| --- | --- | --- |
| `stats-hot-hourly` | Northflank | Refresh HOT stats, snapshot relevant hourly playing ranks, enqueue stats revalidation. |
| `stats-daily-ranks` | Northflank | Snapshot full daily all-game ranks. |
| `stats-new-refresh` | VPS worker | Enrich NEW universes, refresh NEW stats, assign tiers. |
| `stats-warm-refresh` | VPS worker | Refresh WARM stats and assign tiers. |
| `stats-cold-refresh` | VPS worker | Refresh rotating COLD batch and assign tiers. |
| `stats-discovery` | VPS worker | Discover new universes and lightly enrich NEW rows. |
| Daily rollup/prune | Supabase cron/RPC | Finalize daily stats and prune hourly history older than 90 days. |

## Planned Feature Layers

Build chart features as layers on top of the same base chart system:

1. Current selected series.
2. Previous period series.
3. Comparison game series.
4. Annotation overlays for events and updates.

Do not create separate chart systems for stats and ranks. The mental model should stay the same across both panels.

## 1. Previous Period Toggle

Default: off.

When enabled:

- Fetch the period immediately before the selected range.
- Draw it as a dotted line on the same chart.
- Keep x-axis labels for the current period only.
- Align previous data by bucket index, not by absolute date.
- Include both current and previous visible values in the y-axis domain.

Examples:

- `7d` compares the last 7 days with the 7 days before that.
- `30d` compares the last 30 days with the 30 days before that.
- `1d + hourly` compares the last 24 hourly buckets with the previous 24 hourly buckets.

Metric charts:

- Works for Playing, Visits, Favorites, Rating.
- Use the same metric logic from `metric-contract.md`.

Rank charts:

- Works for Global, Genre, Subgenre rank.
- Use the same selected scope, range, and resolution.
- Remember rank y-axis is reversed because `#1` is best.

## 2. Events Overlay

Use existing `roblox_virtual_events`.

Query events by universe and selected chart range:

```txt
universe_id = current universe
start_utc <= range_end
coalesce(end_utc, start_utc, updated_utc, created_utc) >= range_start
```

Display:

- If `start_utc` and `end_utc` exist, show a subtle vertical band for the event duration.
- If only one useful timestamp exists, show a vertical marker line.
- Tooltip should show event title, status, start/end time in the user's timezone, and guide link when `guide_slug` exists.

Control:

- Add an `Events` toggle near the chart controls.
- Hide or disable it when no events exist for the selected range.

Note:

- Brookhaven local data currently may have no `roblox_virtual_events` rows, so this overlay can be empty until real event rows are imported.

## 3. Game Updates Overlay

Use `roblox_universe_update_events` because `roblox_universes.updated_at_api` is only latest state.

Current table:

```txt
roblox_universe_update_events
```

Recommended columns:

```txt
id
universe_id
previous_updated_at_api
updated_at_api
detected_at
sampled_at
source
label
description
stats_tier
playing
visits
favorites
likes
dislikes
rating_percent
raw_game_json
created_at
```

Automation:

- In the hourly stats/details refresh, compare fetched `updated_at_api` with the previous non-null value on `roblox_universes`.
- If it changed, upsert one row into `roblox_universe_update_events` on `(universe_id, updated_at_api)`.
- Do not delete or overwrite old update event rows.
- Do not invent update numbers unless Roblox gives us a real update/version label.

Display:

- Add an `Updates` toggle near the chart controls.
- Show vertical marker lines at `updated_at_api`.
- Tooltip should show `Game updated`, Roblox update time, detected time, and source.

## 4. Compare Games

This is larger than overlays. Build after previous period, events, and updates.

Metric chart comparison:

- Support current game plus up to two comparison games.
- User can search any game.
- Initial suggestions can be nearby games by the selected metric/rank.
- Show selected games as removable chips.
- Use distinct line colors.
- Include all visible series in the y-axis domain.

Start with metric charts only:

- Playing
- Visits
- Favorites
- Rating

Rank comparison is harder because genre/subgenre scopes differ per game. If we add rank comparison later, start with Global rank only.

## Shared Annotation Shape

Future chart APIs can return annotations separately from points:

```ts
type ChartAnnotation =
  | {
      type: "event";
      id: string;
      label: string;
      startAt: string;
      endAt?: string | null;
      status?: string | null;
      href?: string | null;
    }
  | {
      type: "update";
      id: string;
      label: string;
      at: string;
      source?: string | null;
    };
```

Keep annotation timestamps in UTC from the API. Format in the user's timezone in the client tooltip.

## Control Layout

Current chart bottom-right controls include:

- Resolution dropdown.
- Y-axis zoom/start toggle.

Add new controls carefully:

- `Previous period`
- `Events`
- `Updates`
- `Compare`

If the row gets crowded, move secondary toggles into a compact menu, but keep the current metric/range tabs easy to scan.

Default states:

- Zoomed y-axis on by default for metric charts.
- Rank chart zoomed to observed range by default; toggle expands to start at `#1`.
- Previous period off.
- Events off or hidden until rows exist.
- Updates off or hidden until rows exist.
- Compare empty.

## Implementation Order

1. Previous period toggle for metric chart and rank chart.
2. Events overlay from `roblox_virtual_events`.
3. Updates overlay from `roblox_universe_update_events`.
4. Compare games for metric charts.
5. Optional global-rank comparison later.

## Gotchas

- Do not use visits delta as Playing. Playing is CCU only.
- Do not average Rating. Rating is `likes / (likes + dislikes)` at the bucket endpoint.
- Do not replace existing good metric values with `null` when Roblox skips a field.
- Every overlay must respect selected range and resolution.
- Previous period lines should not change x-axis labels.
- Rank y-axis is reversed and should never start from `0`.
- Daily tables are durable. Hourly tables are short-range and can be pruned after 90 days.

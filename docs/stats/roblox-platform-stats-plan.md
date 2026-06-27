# Roblox Platform Stats Plan

## Goal

Create a platform-level stats surface that sits beside individual game stats and makes `/stats` useful for Roblox-wide trends, not only game leaderboards.

## Planned Pages

| Page | Purpose |
| --- | --- |
| `/stats` | Keep as the broad stats hub: top games, platform CCU summary, recent winners, and entry points. Add time range controls to the platform CCU chart. |
| `/stats/games/[slug]` | Keep individual game analytics. Reuse its time range selector patterns for platform charts. |
| `/stats/roblox-platform` | New Roblox-wide page for platform playing, visits, game count, status, and social growth. |

## Data To Store Locally

Do not render these from live third-party calls on every page view. Store snapshots first, then render from Bloxodes tables or materialized indexes.

| Dataset | Suggested cadence | Notes |
| --- | --- | --- |
| Platform CCU | hourly | Aggregate from `roblox_universe_stats_hourly`; keep daily rollups for long ranges. |
| Platform visits/favorites/likes | daily | Aggregate from universe daily rows. Treat as tracked-game totals, not full Roblox totals, unless the source is truly global. |
| Platform top movers | hourly/daily | Derive from existing game stats and rank snapshots. |
| Roblox status | every 5-15 min | Fetch `https://status.roblox.com/` or its public status feed if available; store components/incidents. |
| Roblox socials | daily | Store follower/subscriber/member counts for official Roblox accounts. |
| Game socials | daily or weekly | Store metrics only for games where we have verified social links. |

## Social Metrics Plan

Social links alone are not enough; metrics need snapshots.

1. Keep canonical social links on the game/universe rows or a normalized `social_accounts` table.
2. Add a `social_account_metric_snapshots` table with `account_id`, `metric_name`, `metric_value`, `sampled_at`, and `source`.
3. Use one collector per platform so rate limits and parsing rules are isolated.
4. Render from the latest stored snapshot plus history charts, not from live social endpoints.
5. Start with official Roblox social accounts before game socials, because identity is easier to verify.

## Status Plan

Store status snapshots and incidents locally.

1. Collector fetches Roblox status data on a short cadence.
2. Upsert current component states.
3. Insert incident/update history when incident IDs or text changes.
4. `/stats/roblox-platform` shows current status, recent incidents, and whether platform stats dipped during incidents.

## Chart Plan

Use the same range selector language as individual game pages:

| Range | Source |
| --- | --- |
| 24h / 7d / 30d | hourly platform aggregates |
| 90d / 1y / all | daily platform aggregates |

The first small fix is to make the platform CCU chart on `/stats` accept the same range controls as game charts. The bigger step is a dedicated read model for platform aggregates so `/stats/roblox-platform` does not scan large hourly tables on every request.

## Build Phases

1. Add range controls to the current platform CCU chart.
2. Create platform aggregate tables or materialized views for hourly and daily totals.
3. Add `/stats/roblox-platform` with playing and visits first.
4. Add stored Roblox status snapshots.
5. Add official Roblox social account snapshots.
6. Add game social account snapshots after link verification and rate-limit rules are clear.

# /stats Live Page Plan

Last updated: 2026-05-26

## Short Version

Build a public Roblox stats section on Bloxodes.

The page family should help players, creators, and researchers answer simple questions:

- Which Roblox games are live right now?
- Which games are growing fastest?
- Which games are losing players?
- Which games have the strongest visits, favorites, ratings, and CCU?
- How has one game changed over time?

The public stats product should live on the main site:

```txt
https://bloxodes.com/stats
https://bloxodes.com/stats/games
https://bloxodes.com/stats/games/[game-slug]
https://bloxodes.com/stats/genres
https://bloxodes.com/stats/creators
```

This should use our own Roblox data collection. Do not depend on RoTrends data.

## Product Goal

Make Bloxodes feel like a live Roblox database.

The current site already has codes, wiki pages, catalog pages, tools, lists, events, checklists, and quizzes. Stats should become the live data layer that connects those pages together.

The stats section should be useful even when a game does not have codes or a wiki page yet.

## Main Users

### Players

They want to find games worth playing now.

They care about:

- current player count
- top games
- fast-growing games
- game age
- rating
- visits
- favorites
- charts that show whether a game is rising or fading

### Creators

They want public comparison data.

They care about:

- how their game ranks against similar games
- peak CCU
- daily visits growth
- favorites growth
- rating movement
- genre ranking
- competitor games

### Writers And Researchers

They want quick context.

They care about:

- what is trending
- which genres are hot
- when a game launched
- how big the game is
- whether a game is still active

## Page Family

### `/stats`

This is the public stats home.

It should show:

- live platform snapshot
- top games by current players
- fastest risers
- fastest fallers
- most visited games
- highest rated popular games
- trending genres
- recently discovered games
- links to deeper stats pages

Keep this page broad and easy to scan.

### `/stats/games`

This is the main game table.

It should show many games with filters and sorting.

Useful filters:

- search by game name
- genre
- subgenre
- age rating
- platform support
- minimum current players
- minimum visits
- minimum rating
- creator or group
- has Bloxodes codes page
- has Bloxodes wiki page
- has game catalog pages

Useful sort options:

- current players
- 24-hour player change
- 7-day player change
- visits
- 24-hour visit change
- favorites
- rating
- peak CCU
- created date
- updated date
- Bloxodes quality score

### `/stats/games/[game-slug]`

This is the public stats page for one Roblox game.

It should show:

- game title
- icon
- Roblox play link
- creator or group
- genre and subgenre
- age rating
- current players
- visits
- favorites
- likes
- dislikes
- rating percentage
- created date
- updated date
- Bloxodes links for codes, wiki, catalog, events, tools, quizzes, and checklists

Charts:

- current players over time
- visits over time
- favorites over time
- rating over time
- rank over time
- daily peak CCU
- daily average CCU

Comparison blocks:

- games from the same creator
- similar games in the same genre
- games with similar CCU
- games trending in the same direction

### `/stats/genres`

This page groups the Roblox market by genre.

It should show:

- total current players by genre
- total tracked games by genre
- top games in each genre
- fastest-growing genres
- genre share over time

### `/stats/creators`

This page ranks creators and groups.

It should show:

- creator or group name
- number of tracked games
- total current players
- total visits
- top game
- fastest-growing game
- verified badge if available

This can come after the game pages. It is useful, but not required for MVP.

## MVP Scope

Start small.

MVP should include:

- `/stats`
- `/stats/games`
- `/stats/games/[slug]`
- current players chart
- visits chart
- favorites chart
- rating chart
- top games table
- trending games table
- basic genre filters
- links from stats pages to existing Bloxodes pages

Do not start with:

- private creator dashboards
- paid plans
- alerts
- exports
- AI summaries
- complex revenue estimates
- full competitor dashboards

Those belong in later phases.

## Data We Can Use Publicly

Roblox public APIs can support:

- universe id
- root place id
- game name
- game description
- creator id
- creator name
- creator type
- genre
- current playing count
- visits
- favorites
- likes
- dislikes
- created date
- updated date
- icon
- thumbnails
- badges
- game passes
- developer products when available through supported public endpoints
- search and discovery placement when collected from public discovery surfaces

Public data is enough for a good `/stats` product.

It is not enough for true private creator analytics such as retention, revenue, funnels, or session-level data. That belongs to the paid creator product.

## Current Bloxodes Foundation

Bloxodes already has strong pieces in place.

Existing useful tables:

- `roblox_universes`
- `roblox_universe_stats_daily`
- `roblox_universe_sort_entries`
- `roblox_universe_search_snapshots`
- `roblox_universe_badges`
- `roblox_universe_gamepasses`
- `game_lists`
- `game_list_entries`
- `code_pages`
- `wiki_pages`
- `catalog_pages`
- `events_pages`
- `tools`
- `quiz_pages`
- `checklist_pages`

Existing useful jobs:

- `npm run collect:universes`
- `npm run search:universes`
- `npm run expand:creators`
- `npm run score:universes`
- `npm run update:playing`
- `npm run update:stats`
- `npm run enrich:universes`
- `npm run lists:refresh`

The biggest missing piece is hourly history.

Right now, the current public stats fields are updated on `roblox_universes`. For charts, we need to store each sample instead of only keeping the latest value.

## Clear Data Plan

Use the existing daily table. Do not create a second daily table.

The recommended public stats storage should be:

```txt
roblox_universes
  latest public values

roblox_universe_stats_hourly
  one row per game per hour

roblox_universe_stats_daily
  one row per game per day
```

This gives us:

- fast current values from `roblox_universes`
- useful 24h, 7d, and 30d charts from hourly rows
- cheap long-range charts from the existing daily table

Running `update:stats` every hour is good, but it only works for charts if each hourly point is stored somewhere. Updating only `roblox_universes` loses history. Updating only `roblox_universe_stats_daily` compresses the whole day into one row and loses the shape of the day.

### Why `roblox_universe_stats_daily` Is Not Enough

Daily rows are useful for summaries.

They can answer:

- what was the daily peak CCU?
- what was the daily average CCU?
- how many visits were gained today?
- what was the end-of-day rating?

They cannot answer:

- what happened at 9 AM?
- did the game spike after an update?
- did players drop during the evening?
- what did the last 24 hours look like hour by hour?
- when did the peak happen?

That is why the missing table should be hourly, not daily.

### Daily Row Meaning

The daily row should be a rollup of the completed day, not a random stat sample from one time.

For `playing`, the main daily value should mean:

```txt
highest recorded current players for that day
```

In other words, once the day is done, daily `playing` should be the day's peak CCU from hourly rows.

Keep this rule simple:

```txt
daily.playing = max(hourly.peak_playing)
```

If the daily table has richer fields, also keep:

```txt
daily.peak_playing = max(hourly.peak_playing)
daily.avg_playing = average(hourly.avg_playing)
daily.min_playing = min(hourly.min_playing)
```

For cumulative counters like visits and favorites, "highest" usually means the final value of the day because those counters normally only go up. The more useful daily values are:

```txt
visits_end = latest hourly visits for the day
visit_delta = visits_end - visits_start
favorites_end = latest hourly favorites for the day
favorite_delta = favorites_end - favorites_start
```

For rating, use the end-of-day rating first. Average rating can come later if needed.

## Recommended Data Model

### `roblox_universes`

This table keeps the latest public values.

Use it for:

- current player count
- current visits
- current favorites
- current likes
- current dislikes
- latest rating
- table sorting when exact history is not needed
- page hero metrics

Keep updating it from the existing `update:playing` and `update:stats` scripts.

### `roblox_universe_stats_hourly`

Add this table first.

It stores one public stats row per universe per hour.

Suggested fields:

```txt
universe_id bigint not null
hour_start timestamptz not null
playing bigint
avg_playing numeric
peak_playing bigint
min_playing bigint
visits bigint
visits_start bigint
visits_end bigint
visit_delta bigint
favorites bigint
favorites_start bigint
favorites_end bigint
favorite_delta bigint
likes bigint
likes_start bigint
likes_end bigint
like_delta bigint
dislikes bigint
dislikes_start bigint
dislikes_end bigint
dislike_delta bigint
rating_percent numeric
sample_count integer not null default 1
first_sampled_at timestamptz not null
last_sampled_at timestamptz not null
snapshot jsonb not null default '{}'::jsonb
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
primary key (universe_id, hour_start)
```

Indexes:

```txt
(hour_start desc)
(universe_id, hour_start desc)
(playing desc, hour_start desc)
(peak_playing desc, hour_start desc)
```

Use this for:

- 24-hour charts
- 7-day charts
- 30-day charts
- 1-hour change
- 24-hour change
- 7-day change
- peak CCU
- average CCU
- growth detection

### `roblox_universe_stats_daily`

This table already exists.

Use it for long-range summaries and charts.

Keep the existing table name.

Extend it if needed instead of creating a new daily table.

Recommended daily fields to add if they do not exist:

```txt
avg_playing numeric
peak_playing bigint
min_playing bigint
visits_start bigint
visits_end bigint
visit_delta bigint
favorites_start bigint
favorites_end bigint
favorite_delta bigint
likes_start bigint
likes_end bigint
like_delta bigint
dislikes_start bigint
dislikes_end bigint
dislike_delta bigint
rating_start numeric
rating_end numeric
sample_count integer
```

If we want fewer columns at first, store calculated daily details in the existing `snapshot` JSON field and add typed columns later.

Use daily data for:

- 90-day charts
- all-time tracked charts
- daily peak CCU
- daily average CCU
- daily visits gained
- daily favorites gained
- slow pages and SEO pages

### Optional Later: `roblox_universe_metric_snapshots`

Do not add this in the first version unless we want 5-minute or 10-minute charts.

A raw snapshot table is useful later if we refresh Tier A games more often than hourly.

Example:

```txt
id uuid primary key
universe_id bigint not null
sampled_at timestamptz not null
playing bigint
visits bigint
favorites bigint
likes bigint
dislikes bigint
rating_percent numeric
source text not null
raw_payload jsonb
```

Use raw snapshots for:

- 5-minute live charts
- exact intraday spike timing
- debugging collection issues
- rebuilding hourly rows

For MVP, hourly rows are enough.

### Rank Snapshot Tables

Optional, but useful after the main stats pages work.

Stores rank changes over time.

Use the same mental model as stats history:

- `roblox_universe_rank_snapshots_hourly`: short-range hourly rank chart data.
- `roblox_universe_rank_snapshots_daily`: long-range daily rank history.

Suggested shared fields:

```txt
universe_id bigint not null
rank_type text not null
rank_value integer not null
metric_value numeric
sampled_at timestamptz not null
hour_start timestamptz -- hourly table only
stat_date date -- daily table only
```

Example `rank_type` values:

- `global_playing`
- `global_visits`
- `genre_playing`
- `genre_growth_24h`
- `bloxodes_trending`

## Exact Hourly Update Flow

The hourly process should do three writes.

### Step 1: Fetch Public Roblox Values

For each universe batch, fetch:

- playing
- visits
- favorites
- likes
- dislikes

Calculate:

- rating percentage
- hour bucket
- daily bucket

### Step 2: Update `roblox_universes`

Write the latest values.

This keeps existing pages fast.

### Step 3: Upsert `roblox_universe_stats_hourly`

Use:

```txt
hour_start = date_trunc('hour', sampled_at)
```

If the hour row does not exist, insert it.

If the hour row exists, update it:

- `playing` becomes the latest value
- `peak_playing` becomes the max of old and new
- `min_playing` becomes the min of old and new
- `avg_playing` is recalculated from old average and sample count
- `visits_end` becomes latest visits
- `visit_delta` becomes `visits_end - visits_start`
- same pattern for favorites, likes, and dislikes
- `sample_count` increments
- `last_sampled_at` updates

This supports both hourly collection and faster collection later.

### Step 4: Update Existing `roblox_universe_stats_daily`

Use hourly rows to update the existing daily row.

Use:

```txt
stat_date = sampled_at::date
```

Daily values should come from hourly rows:

- `avg_playing` = average of hourly `avg_playing`
- `peak_playing` = max hourly `peak_playing`
- `min_playing` = min hourly `min_playing`
- `playing` = max hourly `peak_playing`, so the daily headline CCU is the highest recorded CCU for that day
- `visits_start` = earliest hourly `visits_start`
- `visits_end` = latest hourly `visits_end`
- `visit_delta` = `visits_end - visits_start`
- same pattern for favorites, likes, and dislikes
- `rating_end` = latest hourly rating

This means `roblox_universe_stats_daily` stays the long-range summary table.

Daily rows should be finalized after the day is done, then updated only if a late hourly row arrives. Current-day daily rows can still be shown as "today so far."

## Metric Definitions

Keep metric names simple.

### Current Players

The number Roblox reports as currently playing.

Use field:

```txt
roblox_universes.playing
```

### Peak CCU

Highest current-player sample in a time range.

Examples:

- 24-hour peak CCU
- 7-day peak CCU
- all-time tracked peak CCU

### Average CCU

Average current players during a time range.

This is only as accurate as the sample schedule.

### Visit Growth

Visits at the end of the period minus visits at the start.

### Favorite Growth

Favorites at the end of the period minus favorites at the start.

### Rating

```txt
likes / (likes + dislikes)
```

Show as a percentage.

If likes and dislikes are missing or zero, show `Not enough data`.

### Favorites Per 1K Visits

```txt
favorites / visits * 1000
```

This helps compare games of different sizes.

### Trend Score

Use a simple first version.

Suggested formula:

```txt
trend_score =
  24h_player_growth_score
  + 24h_visit_growth_score
  + 7d_player_growth_score
  + rating_score
  + discovery_score
```

Keep the formula explainable.

Do not pretend it is exact. Say it is a Bloxodes trend score.

## Collection Cadence

Use different refresh speeds for different game groups.

For MVP, run public stats hourly.

That is enough to make useful charts and avoids overbuilding.

### Tier A: High-Traffic Games

Examples:

- top 1,000 games by current players
- games with Bloxodes pages
- games in trending lists

Refresh:

```txt
MVP: every 60 minutes
Later: every 5-10 minutes
```

### Tier B: Normal Tracked Games

Examples:

- quality candidates
- games discovered from search
- games with some traffic

Refresh:

```txt
every 60 minutes
```

### Tier C: Long Tail

Examples:

- old games
- low-traffic games
- archived discovery rows

Refresh:

```txt
daily or weekly
```

## Data Jobs

### `update:playing`

Keep updating current `playing`.

Change it so it also upserts the current hour in `roblox_universe_stats_hourly`.

If `update:playing` and `update:stats` stay separate, make sure they do not overwrite each other's hourly values with nulls.

Safer option:

```txt
new script: scripts/universes/update-universe-hourly-stats.ts
```

This one script fetches all public values together and writes latest, hourly, and daily data in one pass.

### `update:stats`

Keep updating visits, favorites, likes, and dislikes.

For MVP, either:

- update this script to upsert `roblox_universe_stats_hourly`, or
- create the new combined hourly script above and let this script stay as a simple latest-value updater

Recommended:

```txt
npm run update:hourly-stats
```

This keeps the chart pipeline easy to reason about.

### New Job: `stats:rollup-hourly`

Only needed later if we add raw snapshots.

For MVP, the hourly collector writes directly into `roblox_universe_stats_hourly`.

Do not add this job yet unless we choose to store raw snapshots.

### New Job: `stats:rollup-daily`

Build daily rollups from hourly data into the existing `roblox_universe_stats_daily`.

Run:

```txt
hourly for today-so-far, then once after the UTC day ends to finalize yesterday
```

The final daily rollup should set the daily `playing` headline to the highest recorded CCU for that day.

### New Job: `stats:rank`

Build rank snapshots and trend lists.

Run:

```txt
hourly playing ranks after HOT stats refresh
daily full rank snapshots after UTC day ends
```

### Suggested Root Commands

Add commands:

```json
{
  "update:hourly-stats": "tsx scripts/universes/update-universe-hourly-stats.ts",
  "stats:rollup-daily": "tsx scripts/universes/rollup-universe-daily-stats.ts",
  "stats:rank": "tsx scripts/universes/rank-universe-stats.ts"
}
```

### Suggested Cron Order

Run this sequence hourly:

```txt
1. npm run update:hourly-stats
2. npm run stats:rollup-daily -- --date today
3. npm run stats:rank
4. npm run lists:refresh
```

Run this once after the day ends:

```txt
npm run stats:rollup-daily -- --date yesterday --finalize
```

## Public API Routes

Keep route handlers thin and read from shared helpers in `apps/web/src/lib/*`.

Suggested API routes:

```txt
GET /api/stats/games
GET /api/stats/games/[universeId]
GET /api/stats/games/[universeId]/chart
GET /api/stats/genres
GET /api/stats/creators
```

Use these for client-side filters and charts.

Server-render the first page for SEO.

## Shared Library Helpers

Add helpers under:

```txt
apps/web/src/lib/stats.ts
```

Suggested functions:

```txt
getStatsHome()
listStatsGames()
getStatsGameBySlug()
getStatsGameCharts()
listStatsGenres()
listStatsCreators()
formatRating()
formatTrendScore()
resolveStatsGameSlug()
```

## Dashboard Design Direction

The stats pages should feel like a public live database, not a marketing page and not a private admin dashboard.

Design goals:

- fast to scan
- strong tables
- clear charts
- small labels
- readable numbers
- no decorative hero
- no nested cards
- no loud gradients
- no oversized empty space

Use the normal Bloxodes shell and design tokens from `DESIGN.md`.

## Shadcn Components To Use

Use existing UI primitives:

- `Card` for metric panels, chart panels, and repeated game blocks
- `Button` for range controls, filter actions, export buttons later, and Roblox links
- `Badge` for rank, trend, genre, rating, platform support, and Bloxodes page links
- `Input` for game search and numeric filters
- `Separator` for quiet section breaks
- `Sheet` for mobile filters
- `Skeleton` for loading tables and charts
- `Tooltip` for metric definitions and chart labels

Add these shadcn primitives before building the page:

- `Table` for `/stats/games`
- `Tabs` for chart ranges and metric groups
- `Select` for sort, genre, platform, and time range controls
- `DropdownMenu` for secondary actions
- `Popover` for compact filter panels on desktop
- `Command` for fast game search if the normal input becomes too limited
- `ScrollArea` for wide tables on desktop and mobile

Add chart support:

- add `recharts`
- add shadcn `ChartContainer`, `ChartTooltip`, and chart helpers in `components/ui/chart.tsx`

Reason:

shadcn chart examples are built around Recharts. The repo does not currently have a chart library, so adding Recharts keeps the implementation familiar and avoids hand-rolled SVG chart logic.

## Stats-Specific Components

Create route-specific components under:

```txt
apps/web/src/app/(site)/stats/components/
```

Suggested components:

```txt
StatsMetricCard
StatsSparkline
StatsChartPanel
StatsTimeRangeTabs
StatsGameTable
StatsGameTableFilters
StatsGameHeader
StatsRankBadge
StatsTrendBadge
StatsDeltaPill
StatsRelatedLinks
StatsGenreGrid
StatsEmptyState
StatsSkeleton
```

Use shared UI primitives inside these components.

Do not make every route-specific component a shadcn primitive.

## Chart Types

Use only a few chart types first.

### Line Chart

Use for:

- current players over time
- visits over time
- favorites over time
- rating over time

This is the main chart type.

### Area Chart

Use lightly for:

- current players on the game detail hero chart
- total players by genre

Do not use strong gradients.

### Bar Chart

Use for:

- daily visit gains
- daily favorite gains
- top genres
- top creators later

### Tiny Sparkline

Use in:

- table rows
- top games modules
- trending cards

Keep sparklines small and simple.

No labels inside sparklines.

## Time Ranges

Recommended chart ranges:

- `24h`
- `7d`
- `30d`
- `90d`
- `All`

Data source by range:

```txt
24h   -> hourly table
7d    -> hourly table
30d   -> hourly table, downsample if needed
90d   -> existing daily table
All   -> existing daily table
```

## Chart Behavior

Charts should be fast and readable.

Rules:

- show loading skeletons
- show empty state when history is missing
- show compact numbers
- show last updated time
- downsample long ranges
- avoid tiny axis labels
- hide dense x-axis labels on mobile
- keep y-axis labels compact
- use tooltips for exact values
- use hourly data for 24h, 7d, and 30d
- use existing daily data for 90d and all-time
- never show a broken blank chart

## Layout Design: `/stats`

Desktop wireframe:

```txt
+--------------------------------------------------------------+
| Roblox Stats                                                 |
| Live Roblox game data tracked by Bloxodes.                   |
| [Search games...]                              [View all]    |
+--------------+--------------+--------------+----------------+
| Live Players | Games Tracked| Visits Today | Last Updated   |
+------------------------------+-------------------------------+
| Top Games Right Now          | Fastest Risers                |
| rank + icon + name + CCU     | rank + icon + name + delta    |
| sparkline                    | sparkline                     |
+------------------------------+-------------------------------+
| Platform CCU Trend                                            |
| large 24h area/line chart                                     |
+------------------------------+-------------------------------+
| Trending Genres              | Recently Discovered           |
| compact bars                 | list rows                     |
+------------------------------+-------------------------------+
```

Mobile order:

```txt
Title
Search
Metric cards, 2 columns
Top games
Fastest risers
Platform trend chart
Trending genres
Recently discovered
```

Component choices:

- title and intro are plain header content
- metric cards use `Card`
- search uses `Input`
- top games and risers use compact list rows, not large cards
- platform trend uses `StatsChartPanel`
- "View all" uses `Button`

## Layout Design: `/stats/games`

Desktop wireframe:

```txt
+--------------------------------------------------------------+
| Roblox Game Stats                                            |
| [Search games...] [Genre] [Sort] [Min players] [Filters]     |
+--------------------------------------------------------------+
| Table                                                        |
| Rank | Game | CCU | 24h | 7d | Visits | Rating | Trend       |
| 1    | icon + name + genre | 120K | +8% | +22% | ...         |
| 2    | icon + name + genre | 98K  | -2% | +10% | ...         |
+--------------------------------------------------------------+
```

Mobile order:

```txt
Title
Search
Sort select
Filter button opens Sheet
Game result rows
Pagination / load more
```

Component choices:

- `Input` for search
- `Select` for sort and primary filters
- `Popover` for desktop advanced filters
- `Sheet` for mobile filters
- `Table` for desktop rows
- stacked compact rows for mobile
- `Badge` for genre, rating, and trend
- `Tooltip` for metric labels like CCU and favorites per 1K visits

Table columns for MVP:

```txt
Rank
Game
Current players
24h change
7d change
Visits
Rating
Trend
Updated
```

Do not show too many columns at first.

Hide lower-priority columns on smaller screens.

## Layout Design: `/stats/games/[slug]`

Desktop wireframe:

```txt
+--------------------------------------------------------------+
| icon  Game Name                                  [Play Roblox]|
| by Creator | Genre | Age Rating | Last updated               |
+--------------+--------------+--------------+----------------+
| Current CCU  | 24h Peak     | Visits       | Rating         |
+----------------------------------------------+---------------+
| Main Chart                                    | Side Summary  |
| Tabs: Players | Visits | Favorites | Rating  | Global rank   |
| Range: 24h 7d 30d 90d All                    | Genre rank    |
| line chart                                    | Peak tracked  |
|                                               | Created date  |
+----------------------------------------------+---------------+
| Bloxodes pages for this game                                  |
| [Codes] [Wiki] [Catalog] [Events] [Tools] [Quizzes]           |
+------------------------------+-------------------------------+
| Similar Games                 | Same Creator                  |
+------------------------------+-------------------------------+
```

Mobile order:

```txt
Game header
Primary metric cards, 2 columns
Chart metric tabs
Chart range tabs
Main chart
Side summary as plain rows
Bloxodes related links
Similar games
Same creator
```

Component choices:

- header uses plain layout, image, `Badge`, and `Button`
- metric cards use `Card`
- chart panel uses `Card`
- chart metric/range controls use `Tabs`
- related links use `Badge` or compact `Button`
- summary uses plain rows with `Separator`
- similar games use compact repeated cards

## Chart Panel Layout

Use the same panel shape on all stats pages.

```txt
+--------------------------------------------------------------+
| Current Players                         [24h][7d][30d][90d] |
| 124,233 playing now                    +8.2% in 24h         |
+--------------------------------------------------------------+
|                                                              |
|                         chart                                |
|                                                              |
+--------------------------------------------------------------+
| Peak 148K     Average 91K     Samples 24     Updated 4m ago |
+--------------------------------------------------------------+
```

Rules:

- panel title stays small
- main value is readable but not hero-sized
- range buttons are compact
- footer stats are quiet
- no chart title repeated inside the chart

## Data Table Design

The table is the heart of `/stats/games`.

Desktop row:

```txt
# | Game                 | CCU    | 24h    | 7d     | Visits | Rating | Trend
1 | [icon] Grow a Garden | 812K   | +12.4% | +31.1% | 12.3B  | 92%    | Rising
```

Mobile row:

```txt
[icon] Grow a Garden                         #1
812K playing    +12.4% 24h    92% rating
12.3B visits    Simulation
```

Rules:

- game name and icon are always visible
- current players are always visible
- one growth metric is always visible
- hide rank only if space is very tight
- do not force the full desktop table onto mobile

## Empty And Loading States

Use `Skeleton` for loading.

Use simple empty states:

```txt
Not enough history yet
We have the latest Roblox stats for this game, but the chart needs a few hourly samples.
```

```txt
No games match these filters
Try clearing the genre, rating, or player filters.
```

Do not show blank chart boxes.

## Visual Details

Use these treatments:

- positive deltas: green text or subtle green badge
- negative deltas: red text or subtle red badge
- neutral deltas: muted text
- rank badges: small bordered badge
- chart lines: one primary accent line per chart
- comparison lines: muted secondary line
- table hover: subtle surface change
- selected range: quiet accent background

Avoid:

- purple-heavy gradients
- large dashboard cards inside more cards
- chart panels with too many colors
- giant numbers that push the chart below the fold
- dense admin-table styling

## SEO Rules

Stats pages are public and publishable.

Add:

- metadata
- canonical URLs
- JSON-LD where useful
- sitemap coverage
- revalidation coverage
- internal links from wiki, codes, lists, and game pages

Use simple titles:

```txt
Roblox Stats
Roblox Game Stats
[Game Name] Stats
Roblox Genre Stats
Roblox Creator Stats
```

Avoid claims like:

- official Roblox analytics
- exact revenue
- exact private data
- guaranteed live accuracy

Use safer wording:

- tracked by Bloxodes
- based on public Roblox data
- refreshed regularly
- estimated where labeled

## Sitemap And Feed

Add stats URLs to:

```txt
apps/web/src/app/sitemap.xml/route.ts
apps/web/src/app/sitemaps/*
```

Create a dedicated stats sitemap if there will be many game stat pages:

```txt
/sitemaps/stats.xml
```

Do not put every low-quality long-tail game in the sitemap at first.

Only index games that meet quality rules:

- has stable name
- has icon
- has enough public data
- has recent snapshots
- is not private or broken
- has enough traffic or Bloxodes coverage

## Revalidation

Stats pages update often.

Use Cloudflare caching carefully.

Suggested cache behavior:

- `/stats`: short cache
- `/stats/games`: short cache
- `/stats/games/[slug]`: short cache for top games, longer for low-traffic games
- chart API: cache by time range

Use cache tags:

```txt
stats
stats-home
stats-games
stats-game:[universe_id]
stats-genre:[genre_slug]
stats-creator:[creator_id]
```

## Page Links To Existing Bloxodes Content

Stats pages should connect to existing Bloxodes pages.

For a game, show links when available:

- codes page
- wiki page
- catalog pages
- event page
- tools
- quizzes
- checklists
- articles
- lists that include the game

This is where Bloxodes can be stronger than a pure stats site.

## Admin Needs

Admin should be able to:

- hide a bad stats page
- merge duplicate slugs
- mark a game as quality candidate
- block a game from indexing
- pin games to refresh faster
- inspect recent snapshots
- inspect collector errors
- manually refresh one universe

This can come after MVP.

## Implementation Phases

### Phase 1: Public Stats MVP

Build:

- `roblox_universe_stats_hourly`
- hourly collector writes latest values and hourly history
- daily rollup writes into existing `roblox_universe_stats_daily`
- `/stats`
- `/stats/games`
- `/stats/games/[slug]`
- basic charts
- basic filters
- basic sitemap

Done when:

- top games show current values
- game detail pages show 24h and 7d charts
- pages link to Roblox and existing Bloxodes pages
- missing history has a clear empty state

### Phase 2: Rollups And Better Trends

Build:

- stronger daily rollups on the existing daily table
- trend score
- hourly and daily rank snapshots
- better genre pages
- top movers
- rank history

Done when:

- 30d and 90d charts load fast
- top movers are not noisy
- trend score is explainable

### Phase 3: Creator And Group Stats

Build:

- `/stats/creators`
- creator detail pages if useful
- group detail pages if useful
- creator totals
- creator game lists

Done when:

- a user can see the top games for a creator or group
- totals are based on tracked games
- pages avoid claiming full creator revenue or private data

### Phase 4: Advanced Public Features

Build:

- compare games
- saved public charts
- alerts for public metrics
- CSV export for public metrics
- embeddable widgets

Only build these after the basic product is useful.

## Risks

### Roblox Rate Limits

Roblox APIs can rate limit or change behavior.

Use:

- batching
- backoff
- separate refresh tiers
- clear collector logs
- safe fallback states

### Bad Or Missing Data

Public data can be missing, delayed, or inconsistent.

Show:

- last updated time
- source label
- empty states
- "not enough data" when needed

### Too Many Pages

Stats can create millions of possible pages.

Do not index everything.

Start with quality candidates and known games.

### Heavy Charts

Hourly and daily rows can become large as tracked games grow.

Use indexes, pagination, chart range limits, and downsampling.

Only add raw snapshots after hourly charts prove useful.

## Open Decisions

- What should the public stats section be called in navigation: `Stats`, `Roblox Stats`, or `Game Stats`?
- Should `/stats/games/[slug]` use the `roblox_universes.slug` or a dedicated stats slug?
- How many games should be indexed in the first stats sitemap?
- What is the first trend score formula?
- Should public compare mode be free or reserved for paid creators?
- How often can we safely refresh Tier A games?

## First Build Checklist

- Add `roblox_universe_stats_hourly`.
- Extend existing `roblox_universe_stats_daily` only where needed.
- Add `npm run update:hourly-stats`.
- Add `npm run stats:rollup-daily`.
- Update latest values on `roblox_universes` during the hourly job.
- Upsert the current hour into `roblox_universe_stats_hourly`.
- Upsert the current day into existing `roblox_universe_stats_daily`.
- Finalize yesterday's daily row after the day ends.
- Make daily `playing` equal the highest recorded hourly CCU for that day.
- Add `recharts`.
- Add shadcn chart helpers.
- Add missing shadcn primitives: `Table`, `Tabs`, `Select`, `DropdownMenu`, `Popover`, `Command`, and `ScrollArea`.
- Add `apps/web/src/lib/stats.ts`.
- Add `/stats` route.
- Add `/stats/games` route.
- Add `/stats/games/[slug]` route.
- Add chart API route.
- Add `StatsMetricCard`.
- Add `StatsChartPanel`.
- Add `StatsGameTable`.
- Add `StatsGameTableFilters`.
- Add `StatsGameHeader`.
- Add sitemap coverage.
- Add cache tags.
- Add internal links from existing game surfaces.

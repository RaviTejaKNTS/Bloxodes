# Paid Creator Analytics Process

Last updated: 2026-05-26

## Short Version

Build a private paid analytics product for Roblox creators.

The public stats pages show public Roblox data.

The paid creator product shows private game data that only the creator and their team can see.

Recommended subdomain:

```txt
https://studio.bloxodes.com
```

Good alternate:

```txt
https://creators.bloxodes.com
```

Use `studio.bloxodes.com` if the product will become a full creator workspace.

Use `creators.bloxodes.com` if it stays mostly analytics.

## Product Goal

Give Roblox creators a private dashboard for their games.

The dashboard should help them answer:

- How many players are live right now?
- How long do players stay?
- Where do players drop off?
- Which products earn Robux?
- Which game passes convert?
- Which updates helped or hurt?
- Which countries, platforms, or cohorts perform best?
- What should I fix next?

This product should be paid because it stores private telemetry, long history, team access, exports, alerts, and creator workflow tools.

## Important Boundary

Do not promise private Roblox Creator Dashboard data unless the creator gives it to us or our SDK collects it.

Public Roblox APIs can show public stats.

Private analytics needs one of these:

- creator installs a Bloxodes Roblox SDK script
- creator connects an approved Roblox OAuth flow if Roblox exposes the needed scopes
- creator imports exports manually

The safest first version is the SDK route.

## Users

### Solo Creator

They have one or two games.

They want:

- live players
- simple session charts
- product sales
- retention basics
- alerts

### Small Studio

They have a team.

They want:

- multiple games
- team access
- role permissions
- exports
- funnels
- update notes
- revenue and product dashboards

### Publisher Or Brand

They track many games.

They want:

- portfolio view
- comparisons
- custom reports
- API access
- benchmarks
- alerts

This can be a later enterprise tier.

## High-Level Flow

```txt
Creator signs in with Roblox
↓
Creator creates a Bloxodes Studio workspace
↓
Creator adds a Roblox game
↓
Bloxodes gives them an install script and secret
↓
Creator pastes the script into ServerScriptService
↓
Roblox game sends a signed heartbeat
↓
Bloxodes marks the game as verified
↓
Private dashboard starts collecting data
↓
Creator upgrades for more history, more games, exports, alerts, and team seats
```

## Account And Login

Bloxodes already has Roblox login.

Use the same user identity system:

- `app_users`
- `app_sessions`
- Roblox OAuth profile fields

For Studio, add workspace ownership.

A user can belong to more than one workspace.

## Workspace Model

### `creator_workspaces`

One workspace is one creator, studio, brand, or agency account.

Suggested fields:

```txt
id uuid primary key
name text not null
slug text unique
owner_user_id uuid not null
billing_status text
plan_key text
stripe_customer_id text
created_at timestamptz
updated_at timestamptz
```

### `creator_workspace_members`

Controls team access.

Suggested fields:

```txt
workspace_id uuid
user_id uuid
role text
created_at timestamptz
```

Suggested roles:

- `owner`
- `admin`
- `analyst`
- `viewer`

Keep roles simple first.

## Game Connection Model

### `creator_games`

Links a private dashboard game to a Roblox universe.

Suggested fields:

```txt
id uuid primary key
workspace_id uuid not null
universe_id bigint not null
root_place_id bigint
display_name text
status text
verified_at timestamptz
last_heartbeat_at timestamptz
public_stats_enabled boolean
private_dashboard_enabled boolean
created_at timestamptz
updated_at timestamptz
```

Suggested status values:

- `pending`
- `verified`
- `paused`
- `disabled`

### `creator_game_secrets`

Stores active SDK secrets.

Suggested fields:

```txt
id uuid primary key
creator_game_id uuid not null
secret_hash text not null
secret_prefix text not null
status text not null
created_at timestamptz
rotated_at timestamptz
revoked_at timestamptz
```

Do not store the plain secret after showing it once.

## Game Verification

Use SDK heartbeat verification first.

The creator adds the Bloxodes script to their game. The script sends a signed heartbeat with:

- universe id
- place id
- server job id
- timestamp
- install token
- signature

Bloxodes verifies:

- token exists
- token belongs to a pending game
- signature is valid
- universe id matches the connected game
- request is fresh

Then mark the game as verified.

This proves the user can edit the Roblox game.

## SDK Install Process

Keep this simple for creators.

### Step 1: Add Game

Creator enters:

```txt
Roblox game URL
```

Bloxodes extracts:

- place id
- universe id
- game name
- icon

### Step 2: Copy Script

Bloxodes shows a short script.

Creator adds it to:

```txt
ServerScriptService
```

### Step 3: Publish Game

Creator publishes the Roblox place.

### Step 4: Run Test

Creator joins a test server.

### Step 5: Verify

Bloxodes receives a heartbeat and marks the game verified.

### Step 6: Dashboard Opens

Creator can now view private analytics.

## SDK Rules

The SDK must be safe.

Rules:

- never break the creator's game
- fail silently if Bloxodes is down
- batch events
- retry with backoff
- avoid sending personally sensitive data
- do not send raw chat
- do not send player names by default
- use hashed anonymous player ids
- keep network calls limited
- let creators disable modules

## Private Data To Collect

### Live Server Data

Collect:

- live server count
- live player count
- server age
- server region if available
- server max players
- server FPS if available
- memory if available

### Player Session Data

Collect:

- anonymous player id
- join time
- leave time
- session length
- first seen time
- returning player flag
- platform if available
- country or region only if safe and allowed

Do not store Roblox username by default.

### Funnel Events

Collect:

- tutorial started
- tutorial completed
- shop opened
- product prompt shown
- purchase completed
- quest started
- quest completed
- custom game events

Let creators define custom event names.

### Monetization Events

Collect:

- product id
- product type
- Robux price
- purchase success
- purchase failure if available
- buyer anonymous id
- timestamp

Supported product types:

- developer product
- game pass
- private server purchase if available
- premium payout estimate only if supported later

### Retention Events

Retention can be calculated from sessions.

Useful metrics:

- day 1 retention
- day 7 retention
- day 30 retention
- new players
- returning players
- average session length
- median session length

## Private Dashboard Pages

### `/dashboard`

Workspace overview.

Show:

- all connected games
- live players
- today visits or sessions
- today revenue if available
- alerts
- recent changes

### `/dashboard/games/[gameId]`

One game overview.

Show:

- live players
- sessions today
- average session length
- retention
- revenue
- conversion rate
- top products
- recent events
- public Roblox stats beside private SDK stats

### `/dashboard/games/[gameId]/live`

Live operations page.

Show:

- live servers
- current players
- recent joins
- recent purchases
- server health
- error or heartbeat status

### `/dashboard/games/[gameId]/players`

Player behavior page.

Show:

- new vs returning players
- session length
- retention
- platform split
- country or region split if allowed

### `/dashboard/games/[gameId]/monetization`

Revenue page.

Show:

- Robux revenue
- product sales
- conversion rate
- prompt-to-purchase rate
- best products
- weak products

### `/dashboard/games/[gameId]/funnels`

Funnels page.

Show:

- tutorial funnel
- shop funnel
- custom funnels
- drop-off steps

### `/dashboard/games/[gameId]/settings`

Game settings.

Show:

- SDK install status
- secret rotation
- event settings
- team access
- data retention
- public/private controls

## Paid Plan Shape

Start with three tiers.

### Free

Use for onboarding.

Suggested limits:

- 1 game
- 24-hour private history
- live players
- basic sessions
- basic product events
- no exports
- no team seats

### Creator

Suggested price:

```txt
$19/month
```

Suggested limits:

- 5 games
- 90-day history
- retention charts
- monetization charts
- custom events
- basic alerts
- CSV export
- 2 team members

### Studio

Suggested price:

```txt
$49-$99/month
```

Suggested limits:

- 20 games
- 1-year history
- advanced funnels
- more alerts
- more team members
- API access
- saved reports
- competitor watchlists

### Enterprise

Manual pricing.

For:

- publishers
- agencies
- brands
- portfolios

Features:

- custom limits
- priority support
- custom dashboards
- data warehouse export
- SSO if needed later

## Billing Process

Use Stripe.

Flow:

```txt
Creator chooses plan
↓
Bloxodes creates Stripe checkout session
↓
Creator pays
↓
Stripe webhook updates workspace plan
↓
Bloxodes unlocks limits
```

Needed routes:

```txt
POST /api/billing/checkout
POST /api/billing/portal
POST /api/billing/webhook
```

Needed fields:

- Stripe customer id
- Stripe subscription id
- plan key
- billing status
- current period end
- trial end

## Data Privacy Rules

This product handles private creator data.

Rules:

- private analytics never appear on public pages by default
- workspace members can only see their own workspace
- use server-side authorization on every dashboard API
- do not expose SDK secrets
- hash player identifiers
- avoid collecting usernames by default
- avoid collecting chat
- give creators data deletion controls
- document what the SDK collects
- show last received heartbeat

## Public Vs Private Data

Keep this boundary clear.

### Public Stats

Can appear on:

```txt
/stats
/stats/games/[slug]
/wiki/[slug]
/lists/[slug]
```

Public stats include:

- current players
- visits
- favorites
- rating
- public game metadata
- public discovery rank

### Private Creator Analytics

Only appears on:

```txt
studio.bloxodes.com
```

Private analytics include:

- sessions
- retention
- funnels
- product conversions
- private revenue tracking
- private alerts
- custom events

Never mix these without creator opt-in.

## API Routes

Suggested creator API routes:

```txt
POST /api/creator/events
POST /api/creator/heartbeat
GET /api/creator/workspaces
POST /api/creator/workspaces
GET /api/creator/games
POST /api/creator/games
GET /api/creator/games/[gameId]
GET /api/creator/games/[gameId]/charts
POST /api/creator/games/[gameId]/rotate-secret
POST /api/creator/games/[gameId]/pause
```

If Studio becomes a separate app, these routes can still live in `apps/web` first or move behind a shared API later.

## Event Ingestion

The ingestion endpoint must be strict.

Validate:

- secret
- signature
- timestamp freshness
- universe id
- event type
- event size
- batch size
- rate limit

Reject:

- unknown game
- revoked secret
- stale timestamp
- oversized payload
- too many events
- invalid event names

Accept:

- heartbeat
- session start
- session end
- custom event
- purchase event
- funnel event

## Suggested Event Shape

```json
{
  "universeId": 123,
  "placeId": 456,
  "serverId": "job-id",
  "sentAt": "2026-05-26T00:00:00.000Z",
  "events": [
    {
      "type": "session_start",
      "anonymousPlayerId": "hash",
      "eventId": "uuid",
      "timestamp": "2026-05-26T00:00:00.000Z",
      "properties": {
        "platform": "computer"
      }
    }
  ]
}
```

## Storage Tables

### `creator_event_batches`

Stores batch metadata.

Use for debugging and replay safety.

### `creator_raw_events`

Stores valid raw events for short-term replay.

Keep retention limited.

### `creator_sessions`

Stores player sessions.

Use for retention and session length.

### `creator_product_events`

Stores monetization events.

Use for revenue and conversion charts.

### `creator_funnel_events`

Stores custom funnel events.

Use for drop-off charts.

### `creator_metric_rollups_hourly`

Stores hourly private metrics.

### `creator_metric_rollups_daily`

Stores daily private metrics.

## Dashboard Metrics

Start with metrics creators understand fast.

### Live

- live players
- live servers
- heartbeat status
- recent purchases

### Growth

- sessions today
- new players
- returning players
- average session length
- day 1 retention
- day 7 retention

### Monetization

- Robux revenue tracked
- purchases
- conversion rate
- top products
- revenue per active player

### Funnels

- start count
- completion count
- conversion percentage
- biggest drop-off step

## Alerts

Alerts should be paid.

Useful alerts:

- game down or no heartbeat
- live players spike
- live players drop
- revenue spike
- revenue drop
- retention drop
- product conversion drop

Send alerts by:

- email first
- Discord webhook later

## Exports

Paid creators should be able to export:

- daily metrics CSV
- product sales CSV
- session rollup CSV
- funnel CSV

Do not export raw anonymous player-level data in the first version unless there is a clear privacy policy.

## Admin Needs

Admin should be able to:

- view workspaces
- view connected games
- see billing status
- see SDK heartbeat status
- revoke game secrets
- pause ingestion
- inspect failed batches
- apply usage limits
- manually verify or unverify a game
- help creators rotate secrets

## Security Checklist

- All dashboard reads check workspace membership.
- All dashboard writes check role.
- SDK secrets are hashed.
- Webhook secrets are verified.
- Stripe webhooks verify signature.
- Ingestion is rate limited.
- Event payload size is capped.
- Private data is never cached publicly.
- Private pages are noindex.
- Audit important actions.

## Implementation Phases

### Phase 1: Studio Shell

Build:

- `studio.bloxodes.com` routing or internal `/dashboard` first
- workspace tables
- workspace member tables
- creator game tables
- Roblox login reuse
- add game flow
- pending game status

Done when:

- a signed-in user can create a workspace
- a signed-in user can add a Roblox game
- the game appears as pending

### Phase 2: SDK Verification

Build:

- game secret generation
- copyable SDK script
- heartbeat endpoint
- signature verification
- verified game status
- last heartbeat display

Done when:

- a creator can install the script
- Bloxodes receives a heartbeat
- the dashboard marks the game verified

### Phase 3: Basic Private Analytics

Build:

- session start/end events
- live players
- live servers
- sessions today
- average session length
- simple charts
- hourly rollups
- daily rollups

Done when:

- creators can see private data that is not public
- data updates without refreshing manually
- missing SDK data has a clear setup state

### Phase 4: Monetization And Funnels

Build:

- product events
- revenue charts
- conversion charts
- custom events
- funnel builder

Done when:

- creators can see product performance
- creators can see where players drop off

### Phase 5: Billing

Build:

- Stripe checkout
- Stripe portal
- Stripe webhook
- plan enforcement
- usage limits
- upgrade prompts

Done when:

- free users can try one game
- paid users unlock history and features
- plan changes update automatically

### Phase 6: Pro Features

Build:

- alerts
- exports
- saved reports
- team roles
- competitor watchlists
- AI summaries

Only build these after creators are using the basic dashboard.

## First Build Checklist

- Choose subdomain name.
- Add workspace tables.
- Add creator game tables.
- Add secret table.
- Add Studio dashboard shell.
- Reuse Roblox login.
- Build add-game flow.
- Build SDK install step.
- Build heartbeat endpoint.
- Mark game verified after heartbeat.
- Add basic live chart.
- Add sessions table.
- Add hourly and daily rollups.
- Add Stripe only after the free verification loop works.

## Open Decisions

- Should the subdomain be `studio.bloxodes.com` or `creators.bloxodes.com`?
- Should free users get 24 hours or 7 days of private history?
- Should team members be part of the first paid tier or only Studio?
- Should public compare mode be free, paid, or both?
- Should creators be able to publish selected private metrics to their public Bloxodes stats page?
- Should the SDK collect country/region in version one, or avoid location data at first?
- Should Discord alerts be part of Creator or Studio?

## Recommended First Decision

Use this split:

```txt
bloxodes.com/stats
```

for public stats, and:

```txt
studio.bloxodes.com
```

for private creator analytics.

This keeps SEO content and private paid software separate.

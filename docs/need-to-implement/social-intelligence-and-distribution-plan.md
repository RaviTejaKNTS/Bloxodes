# Bloxodes Social Intelligence and Distribution Plan

Created: 2026-07-14  
Status: Planning backlog  
Scope: X, Discord, data-led articles, social automation, charts, news, codes, events, music IDs, catalog/item stats, and performance measurement

## Purpose

Bloxodes should not operate as another general Roblox news or codes account. Its durable advantage is the combination of broad Roblox coverage, continuously refreshed structured data, useful player-facing pages, and the ability to explain what is changing across the platform.

The intended position is:

> **Bloxodes is the Roblox data desk: what is growing, falling, breaking records, launching, ending, and worth playing, backed by numbers.**

This plan turns existing Bloxodes data into a repeatable editorial and distribution system. It extends `traffic-diversification-and-community-plan.md`; it does not replace the wider search, app, community, or stability work in that document.

The result should be a system that can:

- detect noteworthy changes in Roblox games, genres, creators, events, codes, music IDs, and catalog items;
- verify that each claim is supported by a complete and comparable data window;
- render clear branded charts and social cards;
- generate platform-specific drafts rather than identical cross-posts;
- route high-risk claims and news through human review;
- publish deterministic, low-risk alerts automatically after the workflow proves reliable;
- turn the strongest findings into durable Bloxodes articles and recurring reports;
- measure whether social activity creates engaged readers, returning Discord members, watchlists, reports, and other useful actions.

## Key decisions

These decisions control the implementation unless they are deliberately revised later.

- [x] Position Bloxodes as a Roblox intelligence/data desk rather than a generic news account.
- [x] Use X primarily for discovery, public credibility, fast insights, charts, and conversation.
- [x] Use Discord primarily for return behavior, alerts, requests, discussion, watchlists, and community loops.
- [x] Treat original Bloxodes data as the highest-value social content pillar.
- [x] Build one shared signal, claim, asset, and publication system instead of separate unrelated bots.
- [x] Keep news discovery automated but news publication reviewed until source and claim quality are proven.
- [x] Allow deterministic low-risk posts to become automatic later; keep statistical superlatives and material news reviewed.
- [x] Track publication separately for every platform and destination. Do not use one global `posted_online` boolean.
- [x] Use official platform APIs and webhooks. Do not use browser automation, self-bots, or scraping to publish.
- [x] Build this incrementally with manual proof before broad automation.

### Roblox-wide traffic claim policy

Bloxodes expects to expand its stats coverage to approximately **250,000 Roblox experiences** in the near future. The remaining long tail is expected to contribute an immaterial share of Roblox concurrent player activity.

Once that coverage is active and the normal stats-health checks pass, Bloxodes may make Roblox-wide claims such as:

- “This genre accounts for almost 40% of Roblox player traffic.”
- “Four games currently control 28% of Roblox traffic.”
- “RPG traffic increased 17% this month.”
- “This was Roblox’s biggest breakout this month.”

For Bloxodes editorial purposes, **Roblox player traffic** means concurrent player activity unless a post explicitly names another measure. The asset or linked methodology should include a compact note such as:

> Based on Bloxodes tracking of approximately 250,000 Roblox experiences. Traffic represents concurrent player activity.

The claim engine must still verify that the relevant observations are fresh, that the comparison windows match, and that no material collection failure affects the result. These checks protect accuracy; they do not require every post to weaken the headline with “among tracked games.”

## Strategic outcomes

The plan is working when:

- people recognize Bloxodes as a source for Roblox-wide numbers and changes;
- recurring reports and charts are anticipated, shared, cited, and discussed;
- X creates discovery and sends qualified readers into Bloxodes and Discord;
- Discord becomes an opt-in alert and participation layer rather than a duplicate feed;
- social-origin visits become engaged visits, not shallow link clicks;
- community reports improve codes, music IDs, events, stats, and content;
- articles gain original data and analysis that competitors cannot reproduce cheaply;
- a search decline on one page or engine does not define the entire business;
- the system can publish consistently without requiring someone to invent every idea manually.

## Content portfolio

Recommended long-run mix:

| Content pillar | Approximate share | Primary purpose |
| --- | ---: | --- |
| Original stats and data insights | 40% | Authority, differentiation, discussion, citations |
| Utility alerts: codes, events, music IDs | 25% | Immediate player value and return behavior |
| Verified Roblox and game news | 15% | Timeliness and reach |
| Community participation | 10% | Polls, predictions, reports, requests, feedback |
| Bloxodes product and methodology | 10% | Trust, launches, changelog, brand building |

This is a portfolio target, not a quota. Do not publish weak data posts merely to hit 40%, and do not manufacture an alert when nothing important changed.

## Source inventory and social opportunities

### 1. Game statistics

Current useful fields and histories include player counts, visits, favorites, likes/dislikes, rating, 24-hour and seven-day baselines, absolute and percentage growth, peaks, global rank, genre rank, subgenre rank, creator data, stats tier, and hourly/daily snapshots.

#### Fast posts

- [ ] Biggest absolute CCU gain over 24 hours.
- [ ] Biggest qualified percentage gain over 24 hours.
- [ ] Top five risers and fallers.
- [ ] Games entering or leaving the global top 10, 20, 50, or 100.
- [ ] Largest global rank jump.
- [ ] Largest genre rank jump.
- [ ] New 24-hour, seven-day, monthly, or tracked-history peak.
- [ ] Games crossing 1K, 10K, 50K, 100K, 250K, 500K, or 1M concurrent players.
- [ ] “Sleeper game” with strong qualified growth outside the obvious leaders.
- [ ] Fastest new game to reach a meaningful CCU threshold.
- [ ] Most stable high-CCU game.
- [ ] Most volatile major game.
- [ ] Longest current streak in the top 10 or top 20.
- [ ] Game with the largest share of its genre.
- [ ] Mobile/console/VR availability comparisons when they support a real reader question.
- [ ] Rating-versus-growth or favorites-versus-growth comparisons.

#### Recurring reports and articles

- [ ] Daily Roblox Market Pulse.
- [ ] Weekly Roblox Games of the Week.
- [ ] Monthly Trending Roblox Games report.
- [ ] Monthly Breakouts and Collapses report.
- [ ] New-release survival report.
- [ ] Deep breakout analysis for one notable game.
- [ ] Update impact study for a major game.
- [ ] “What happened after the viral spike?” follow-up.
- [ ] Prediction scorecard comparing prior watchlists with actual results.

### 2. Genre and subgenre statistics

#### Fast posts

- [ ] Current genre share of Roblox player traffic.
- [ ] Week-over-week or month-over-month genre share change.
- [ ] Fastest-growing genre by absolute traffic.
- [ ] Fastest-growing qualified genre by percentage.
- [ ] Genre gaining or losing the most top-100 positions.
- [ ] Top game within each major genre.
- [ ] How concentrated a genre is in its top one, top five, or top ten games.
- [ ] Emerging subgenre watchlist.
- [ ] “Where Roblox players moved today/this week.”

#### Recurring reports and articles

- [ ] Monthly State of Roblox Genres.
- [ ] Quarterly genre rotation report.
- [ ] Genre concentration and competition report.
- [ ] Major genre comparison with matched periods.
- [ ] “Is this genre actually growing, or is one game carrying it?” analysis.

### 3. Platform-wide statistics

The platform aggregate layer can support hourly and daily tracked traffic, peak players, average players, visits, favorites, likes/dislikes, rating, tracked-game count, and samples.

#### Fast posts

- [ ] Current Roblox-wide concurrent player traffic.
- [ ] Daily and weekly peak time.
- [ ] Highest platform traffic since Bloxodes began full-coverage tracking.
- [ ] Weekday-versus-weekend traffic comparison.
- [ ] Hour-of-day traffic pattern.
- [ ] Top-game, top-10, top-100, and top-1,000 traffic share.
- [ ] Platform concentration change.
- [ ] Share captured by newly released games.
- [ ] “The Roblox day in one chart.”

#### Recurring reports and articles

- [ ] Weekly State of Roblox Traffic.
- [ ] Monthly platform traffic report.
- [ ] Holiday and school-calendar traffic studies.
- [ ] Top-games-versus-long-tail analysis.
- [ ] Platform concentration history.
- [ ] Roblox traffic time-of-day and regional-timezone explainer, without claiming user geography that is not measured.

### 4. Creator and studio statistics

Current creator indexes include game counts, hot/warm/new/cold counts, combined playing, visits, favorites, ratings, top game, membership, and verification data.

#### Fast posts

- [ ] Creator or studio with the most combined concurrent players.
- [ ] Studio with the most hot games.
- [ ] Creator with the largest weekly gain.
- [ ] Most diversified creator portfolio.
- [ ] Creator most dependent on one game.
- [ ] Studio launching the strongest new game.
- [ ] Verified-versus-unverified creator comparisons where meaningful.
- [ ] “One studio currently runs X% of Roblox traffic.”

#### Recurring reports and articles

- [ ] Monthly Roblox Creator Leaderboard.
- [ ] Studio portfolio analysis.
- [ ] One-hit-versus-portfolio comparison.
- [ ] Fastest-growing creators report.
- [ ] Creator durability and release-performance report.

### 5. Catalog and item statistics

Current item stats can support prices, resale prices, favorites, availability, limited status, supply, deadlines, creator/category data, 24-hour and seven-day movement, ranks, and resale history.

#### Fast posts

- [ ] Largest qualified resale-price mover.
- [ ] Biggest price drop.
- [ ] Fastest favorite-count growth.
- [ ] Newly tracked limited or limited unique item.
- [ ] Low-supply or remaining-quantity alert.
- [ ] Official off-sale countdown when a deadline is present.
- [ ] Category market-share or demand comparison.
- [ ] Item reaching a new resale high or low.
- [ ] Creator dominating one item category.

#### Recurring reports and articles

- [ ] Weekly Roblox Item Market report.
- [ ] Monthly limited-item movers report.
- [ ] Category demand report.
- [ ] Price movement versus favorite movement analysis.
- [ ] Supply and resale-history explainers.

Do not present community value estimates as official Roblox value. Keep official price/resale data distinct from third-party trading opinions.

### 6. Events

Current event data includes experience identity, title, description, host, categories, status, visibility, start/end time, thumbnails, and optional guide content.

#### Fast posts

- [ ] Major event starting today.
- [ ] Event starting within one hour.
- [ ] Event live now.
- [ ] Event ending today or soon, based on an official end time.
- [ ] Daily or weekend event calendar.
- [ ] Events from currently trending games.
- [ ] Most anticipated event poll.
- [ ] Event traffic lift after launch.
- [ ] Event that retained or lost its launch lift after 24 hours.

#### Recurring reports and articles

- [ ] Weekly Roblox event calendar.
- [ ] Event guide for complex or valuable events.
- [ ] Before/during/after event impact study.
- [ ] Multi-event traffic comparison.
- [ ] Event postmortem after completion.

### 7. Codes

Codes are a utility and retention format. Social copy must come from refreshed code state, not manual code entry.

#### Fast posts

- [ ] Verified new-code alert.
- [ ] Verified expired-code alert.
- [ ] Multiple new codes for one game.
- [ ] Daily code roundup.
- [ ] Code update for a currently trending game.
- [ ] “Most code-active games this week.”
- [ ] Discord role alert for watched games.

#### Rules

- Never claim a code “expires soon” without an official expiry.
- Never imply a code was released today solely because Bloxodes first detected it today.
- Distinguish first seen, last verified, and officially announced dates.
- Link to the relevant Bloxodes codes page for the complete current state.
- Do not create a separate news article for every code update.
- Track X, Discord, Telegram, and any future platform publication separately.

### 8. Music IDs

Current music data includes asset ID, title, artist, album, duration, genre, current rank, source, first/last seen times, boombox readiness, verification, popularity score, and thumbnails.

#### Fast posts

- [ ] Current top Roblox music IDs.
- [ ] New entry into the top list.
- [ ] Largest music-rank mover.
- [ ] Newly verified boombox-ready ID.
- [ ] Music genre share.
- [ ] Artist with the most ranked IDs.
- [ ] Daily or weekly music-ID discovery.
- [ ] Community request fulfilled.

#### Recurring reports and articles

- [ ] Weekly Roblox Music Chart.
- [ ] Monthly music-ID movers report.
- [ ] Genre and artist trend report.
- [ ] Verified-ID roundup.

#### Required enhancement

- [ ] Add music-rank history or daily snapshots. A current rank and first/last-seen timestamp are not enough to prove a ranking trend.

### 9. Verified Roblox and game news

News should prioritize original sources and material player impact.

#### Source priority

1. Roblox newsroom, status, Creator Hub, official documentation, and DevForum announcements.
2. Official Roblox experience, group, creator, or studio announcements.
3. Official developer Discord announcement channels and official X accounts.
4. Original reporting by an established publication.
5. Secondary aggregators as discovery leads only.

#### News formats

- [ ] Major Roblox platform update.
- [ ] Material creator policy or monetization change.
- [ ] Outage or service degradation with official status sourcing.
- [ ] Major game launch or update.
- [ ] Important safety, moderation, account, or parental-control change.
- [ ] Daily “Roblox news worth knowing” digest.
- [ ] Weekly news recap.
- [ ] Data-enhanced news: update announcement plus measured player response.

#### Publication rule

Automate source monitoring, deduplication, summarization, draft creation, and internal notification. Keep external publication reviewed until the workflow demonstrates consistent original-source selection and claim accuracy.

Do not publish an article merely because a news item exists. Create a Bloxodes article when the story needs explanation, affects many players, benefits from original data, or has durable search/reference value. Otherwise publish a concise social update linking to the original source.

### 10. Community and product posts

- [ ] New Bloxodes tool or calculator.
- [ ] New wiki, collection, checklist, quiz, or event guide.
- [ ] Major stats coverage milestone.
- [ ] Methodology explainer.
- [ ] Public correction with what changed.
- [ ] Community report that led to a verified update.
- [ ] Poll selecting the next tool, report, or game watchlist.
- [ ] Prediction post followed by a transparent result.
- [ ] Monthly Bloxodes changelog.
- [ ] “How we tracked this” behind-the-scenes post.

## Article and report program

Social posts should lead to durable articles when the subject supports depth, multiple findings, reusable charts, or a recurring comparison.

### Flagship recurring articles

- [ ] `Roblox Games of the Week`
- [ ] `Trending Roblox Games This Month`
- [ ] `State of Roblox Traffic — <Month Year>`
- [ ] `Roblox Genre Winners and Losers — <Month Year>`
- [ ] `Biggest Roblox Breakouts and Collapses — <Month Year>`
- [ ] `Roblox Creator Leaderboard — <Month Year>`
- [ ] `Roblox Event Impact Report — <Month Year>`
- [ ] `Roblox Music Chart — <Month Year>`
- [ ] `Roblox Item Market Report — <Month Year>`

### Article package requirements

Each data-led article should include:

- the decision or reader question it answers;
- exact date range and timezone;
- metric definitions;
- coverage and sample-health statement;
- comparison-period rules;
- measured findings separated from interpretation;
- at least one useful chart, when the data supports it;
- links to relevant Bloxodes stats, codes, event, catalog, wiki, or tool pages;
- a concise methodology note;
- a clear generated/updated timestamp;
- corrections history when a material published claim changes.

One article should produce a reusable distribution package:

- one X hero post;
- one X thread or follow-up sequence when warranted;
- two to five isolated chart insights for later posts;
- one Discord digest;
- one Discord discussion prompt or poll;
- optional short-form video script;
- platform-specific alt text and destination links.

## Signal and derived-metric layer

### Candidate derived metrics

- [ ] Absolute CCU change.
- [ ] Percentage CCU change.
- [ ] Global rank delta.
- [ ] Genre and subgenre rank delta.
- [ ] Share of Roblox player traffic.
- [ ] Share of genre traffic.
- [ ] Peak versus prior peak.
- [ ] New rank entry.
- [ ] Days and streaks in rank bands.
- [ ] Momentum score.
- [ ] Volatility score.
- [ ] Staying-power score.
- [ ] Creator portfolio concentration.
- [ ] Genre rotation.
- [ ] Event lift.
- [ ] Post-event persistence proxy.
- [ ] Top-one, top-five, top-ten, top-100, and top-1,000 concentration.
- [ ] Qualified record since Bloxodes tracking began.
- [ ] Source and calculation confidence.
- [ ] Data coverage and freshness score.

### Suggested signal score

Use a transparent score to prioritize candidates, not to invent claims:

| Component | Suggested weight |
| --- | ---: |
| Statistical magnitude | 30% |
| Abnormality versus normal behavior | 20% |
| Affected audience size | 15% |
| Novelty | 15% |
| Source and data confidence | 10% |
| Visual clarity | 10% |

Apply penalties for:

- low or misleading baselines;
- incomplete or mismatched windows;
- missing observations;
- stale game identity, genre, creator, or media data;
- a substantially similar recent post;
- weak reader relevance;
- missing destination page;
- unsupported superlatives;
- a chart that cannot communicate the claim clearly.

### Example qualification rules

- Percentage-growth posts should include both the percentage and absolute change.
- Game percentage-growth records should normally use a meaningful minimum baseline; the existing 1,000-player riser eligibility threshold is a suitable starting point.
- Same-hour comparisons should use the same timezone and aligned hour.
- Weekly comparisons should use equal-length windows and account for weekday/weekend composition.
- Month-to-date should be compared with the matching number of days in the previous month or a clearly labeled prior-period window.
- A full month should not be compared with an incomplete month without saying so.
- A “largest tracked” claim must search the eligible historical record and name the beginning of the reliable tracking period in the methodology.
- An event or update lift should compare pre-event and post-event windows and, when possible, a matched control such as the same weekday/hour pattern.
- CCU persistence may be described as sustained traffic or momentum, not player retention, unless user-level retention is genuinely measured.

## Claim model

Every generated claim should have a machine-readable record containing:

```text
claim_type
entity_type
entity_id
metric
unit
current_value
baseline_value
absolute_change
percentage_change
window_start
window_end
comparison_start
comparison_end
timezone
coverage_count
sample_count
freshness_at
qualification_rules
record_scope
source_tables
source_urls
confidence_score
human_review_required
```

The rendered copy should be generated from the approved claim record. Do not let a language model independently recalculate or embellish the number.

## Chart and asset system

### Chart selection rules

| Chart | Best use |
| --- | --- |
| Donut | One true part-to-whole relationship with a small number of categories |
| Horizontal bar | Rankings and comparisons |
| Slope chart | Two-period movement |
| Line chart | Change across time |
| Bump chart | Rank movement across time |
| Heatmap | Hour-of-day and day-of-week patterns |
| Small multiples | Comparing several game trajectories |
| Scatter/bubble | Percentage versus absolute growth, optionally sized by audience |
| Waterfall | Event or update lift decomposition |
| Record card | One important number with baseline and context |

### Pie and donut policy

Use a pie or donut only when:

- the slices represent a real whole;
- the values sum to 100% after rounding handling;
- there are few enough categories to read quickly;
- smaller categories are combined into `Other`;
- the conclusion depends on share, not rank or trend.

Do not use a pie chart for a long genre list, time series, or positive/negative change.

### Required asset elements

- [ ] Clear headline with one conclusion.
- [ ] Metric and unit.
- [ ] Exact period or observation time.
- [ ] Comparison period when present.
- [ ] Coverage statement or methodology shorthand.
- [ ] Source/methodology destination.
- [ ] Bloxodes branding.
- [ ] Generated timestamp.
- [ ] Accessible color contrast.
- [ ] Text labels that do not depend only on color.
- [ ] Alt text generated from the approved claim record.
- [ ] Layout variants for X, Discord, article, and vertical video.

### Initial reusable templates

- [ ] `record-card`
- [ ] `top-risers-bars`
- [ ] `genre-share-donut`
- [ ] `month-comparison-slope`
- [ ] `event-impact-line`
- [ ] `platform-traffic-heatmap`
- [ ] `creator-portfolio-bars`
- [ ] `item-market-movers`
- [ ] `codes-alert-card`
- [ ] `event-calendar-card`

Reuse the existing Sharp/SVG experience from the current codes-post script, but move rendering into shared, deterministic helpers. Avoid random layouts, random hype copy, or random music selection in the core X/Discord workflow.

## X strategy

### Positioning and profile

Suggested bio:

> The Roblox data desk. Live game stats, breakout charts, codes, events and music IDs. Independent and data-backed. ↓

Suggested banner line:

> Roblox Intelligence — Stats • Codes • Events • IDs

The pinned post should contain:

- what Bloxodes tracks;
- how often key data refreshes;
- what “Roblox player traffic” means;
- a short coverage and methodology statement;
- links to Bloxodes stats, codes, events, Discord, and methodology;
- the fan-made/independent disclaimer;
- examples of the recurring reports people can expect.

### Recommended cadence

- [ ] One strong original data insight per day.
- [ ] Zero to two genuine utility alerts when important changes occur.
- [ ] One interactive question or poll every two days.
- [ ] One weekly data thread or report package.
- [ ] One monthly flagship report.
- [ ] A short manual community/reply block each day.

These are ceilings and targets, not reasons to publish filler. Candidate scoring and cooldown rules should suppress weak or repetitive posts.

### X copy rules

- Lead with the insight, not “new article published.”
- Make the post useful without requiring a click.
- Use one primary number or conclusion per post.
- Use plain language and define unfamiliar metrics.
- Use links selectively and test post-link versus first-reply-link performance.
- Do not use unsolicited mentions to chase reach.
- Do not auto-reply to unrelated users.
- Do not publish identical text used on Discord or other platforms.
- Use platform-native images, alt text, polls, and threads appropriately.
- Mark AI-generated media when required by platform policy.
- Publish through the official X API.

### X measurement

- [ ] Impressions.
- [ ] Likes.
- [ ] Replies.
- [ ] Reposts and quotes.
- [ ] Bookmarks.
- [ ] Profile visits.
- [ ] Follows attributable to a post when available.
- [ ] Link clicks when available for owned recent posts.
- [ ] Media views and completion for videos.
- [ ] Engaged Bloxodes visits from the publication.
- [ ] Discord joins from the publication.

The X API currently uses pay-per-usage access. Confirm current endpoint availability and cost immediately before implementing the publisher and metrics collector.

## Discord strategy

Discord should not be a mirrored X feed. It should provide opt-in utility, discussion, watchlists, and a path for members to improve Bloxodes.

### Initial server structure

- [ ] `#start-here`
- [ ] `#rules-and-safety`
- [ ] `#daily-pulse` as an Announcement channel
- [ ] `#codes-alerts`
- [ ] `#events-alerts`
- [ ] `#stats-lab`
- [ ] `#requests-and-reports`
- [ ] `#general`
- [ ] Private moderation and editorial queue channels

Do not launch many empty channels. Add music, catalog, or game-specific surfaces after demand is visible. Prefer forum posts, threads, and roles to one channel per game.

### Opt-in roles

- [ ] Stats alerts.
- [ ] Codes alerts.
- [ ] Events alerts.
- [ ] Music-ID alerts.
- [ ] Catalog/item-market alerts.
- [ ] Weekly digest only.
- [ ] Watched-game roles or database-backed subscriptions.

### Community loops

- [ ] Report an expired code.
- [ ] Report a broken music ID.
- [ ] Report incorrect or stale stats identity data.
- [ ] Request a missing game, wiki, collection, tool, checklist, or quiz.
- [ ] Vote on the next report or tool.
- [ ] Submit an official event or announcement source.
- [ ] Discuss weekly charts in threads.
- [ ] Receive a public acknowledgement when a verified report improves Bloxodes.

All submissions that can affect public site content must enter a moderation/review queue. They must not become crawlable public HTML automatically.

### Bot commands

- [ ] `/game <name>`
- [ ] `/trend <game>`
- [ ] `/compare <game1> <game2>`
- [ ] `/genre <genre>`
- [ ] `/creator <name>`
- [ ] `/codes <game>`
- [ ] `/events today`
- [ ] `/watch <game>`
- [ ] `/unwatch <game>`
- [ ] `/report-code`
- [ ] `/request-page`
- [ ] `/methodology`

Use incoming webhooks for initial one-way publishing. Build a proper Discord application/bot when commands, roles, subscriptions, or two-way interactions are implemented.

### Discord publishing rules

- Use `allowed_mentions` and default to no unexpected mentions.
- Batch noisy changes into digests.
- Use role mentions only for explicitly opted-in, material alerts.
- Use threads for discussion under major reports.
- Use polls for real editorial or product choices.
- Use an Announcement channel for reports worth following across servers.
- Keep embed text concise and put deeper context in Bloxodes or a thread.

## News candidate and editorial workflow

### Proposed `news_candidates` fields

```text
id
source_url
canonical_source_url
source_type
source_owner
source_trust_tier
published_at
discovered_at
title
summary
claims_json
affected_universe_ids
affected_topics
data_intersection_json
duplicate_group
impact_score
freshness_score
confidence_score
suggested_social_copy
suggested_article_angle
review_status
reviewed_by
reviewed_at
rejection_reason
```

### News scoring

Prioritize:

- number of Roblox players or creators affected;
- official-source confidence;
- immediacy;
- whether Bloxodes data can add original evidence;
- whether Bloxodes has a useful destination page;
- durability beyond the current hour;
- safety or account impact;
- novelty versus already published coverage.

Reject or deprioritize:

- rumor without a strong original source;
- recycled secondary coverage;
- minor patch notes with no broad value;
- unsupported leaks;
- stories created solely to attach a Bloxodes link;
- duplicate stories where the original source is more useful than a Bloxodes rewrite.

## System architecture

```text
Game stats / platform stats / genres / creators / items
Events / codes / music IDs / verified news sources
                         │
                         ▼
             Snapshot and source adapters
                         │
                         ▼
              Signal and record detectors
                         │
                         ▼
         Claim validation and coverage checks
                         │
                         ▼
       Candidate scoring, cooldowns and deduplication
                         │
                         ▼
          Draft copy and deterministic chart assets
                         │
                         ▼
               Editorial approval queue
                         │
             ┌───────────┴───────────┐
             ▼                       ▼
        X publisher            Discord publisher
             │                       │
             └───────────┬───────────┘
                         ▼
        Publication metrics and engaged visits
                         │
                         ▼
          Cadence, template and topic learning
```

### Proposed script structure

```text
scripts/social/
  detect-signals.ts
  detect-records.ts
  collect-news.ts
  generate-drafts.ts
  render-assets.ts
  publish-x.ts
  publish-discord.ts
  collect-x-metrics.ts
  build-discord-digest.ts
  audit-social-workflow.ts
```

Shared helpers should live under:

```text
scripts/shared/social/
```

Add stable `npm run ...` aliases for recurring jobs after their names and responsibilities settle.

### Proposed tables

#### `social_signals`

Stores measured candidates independently of wording.

```text
id
signal_type
entity_type
entity_id
metric
claim_json
score
confidence_score
dedupe_key
detected_at
eligible_until
status
rejection_reason
```

#### `social_drafts`

```text
id
signal_id
platform
destination
copy
alt_text
link_url
asset_spec_json
review_status
reviewed_by
reviewed_at
created_at
updated_at
```

#### `social_assets`

```text
id
draft_id
asset_type
template
storage_path
content_hash
width
height
metadata_json
created_at
```

#### `social_publications`

```text
id
draft_id
platform
destination
idempotency_key
status
external_post_id
post_url
published_at
failed_at
error
metrics_last_collected_at
created_at
updated_at
```

#### `social_metrics`

```text
id
publication_id
captured_at
impressions
likes
replies
reposts
quotes
bookmarks
link_clicks
media_views
video_completions
profile_visits
follows
discord_reactions
discord_thread_replies
site_clicks
engaged_visits
discord_joins
raw_metrics_json
```

#### `social_record_ledger`

Stores qualified records and prevents unsupported “largest ever tracked” copy.

```text
id
record_type
entity_type
entity_id
metric
value
baseline_value
window_start
window_end
qualification_json
tracking_scope_start
supersedes_id
recorded_at
```

### Status model

Suggested candidate/draft states:

```text
detected
qualified
drafted
needs_review
approved
scheduled
publishing
published
rejected
expired
failed
corrected
```

### Idempotency and deduplication

- Every platform publication needs a deterministic idempotency key.
- A post should not be marked published until the platform returns a usable external ID or confirmed message result.
- A Telegram publication must not block X or Discord publication.
- Retries must not create duplicate posts.
- Similar claims should have topic/entity cooldowns.
- Re-rendering an unchanged claim should reuse the content hash and asset where appropriate.
- Corrected posts must preserve a relationship to the original publication.

## Existing codes-post workflow migration

The current `scripts/posts/post-codes.ts` workflow proves that Bloxodes can query unposted codes, render an SVG/image/video, publish it, and update state. It should be treated as a prototype rather than the foundation of the new multi-platform system.

Required changes:

- [ ] Move reusable rendering helpers out of the Telegram-specific script.
- [ ] Replace Telegram-only environment assumptions with publisher adapters.
- [ ] Replace random hype templates with deterministic, evidence-based copy.
- [ ] Remove unsupported urgency such as “before they expire” unless an official deadline exists.
- [ ] Replace `codes.posted_online` as the publication source of truth with `social_publications`.
- [ ] Keep compatibility during migration so existing Telegram behavior is not accidentally duplicated.
- [ ] Generate platform-specific layouts instead of one vertical three-second video for everything.
- [ ] Audit music rights before attaching background audio to generated video.
- [ ] Add dry-run, preview, destination, and explicit apply controls.
- [ ] Add retry, idempotency, and partial-failure handling.

## Scheduling and infrastructure

Stats, the web application, Supabase, analytics, and automation share VPS capacity. Social work must not create a new source of contention.

### Scheduling rules

- Run signal detection after the relevant hourly or daily stats refresh completes successfully.
- Do not start expensive chart/video rendering during database rollups or deployments.
- Queue assets and cap concurrency.
- Cache unchanged chart inputs and assets.
- Prefer SVG/PNG for X and Discord; reserve video generation for selected formats.
- Separate candidate generation from external publication.
- Allow publication to continue from approved queued drafts even if a later detector run fails.
- Record job runs, durations, row counts, failures, and publication outcomes.
- Add a global social-publishing kill switch.
- Add per-platform and per-content-type kill switches.

### Suggested cadence jobs

```text
hourly:
  detect live records, major risers, rank entries, code updates, event state changes

daily:
  build daily pulse candidates, creator/item/music candidates, event calendar

weekly:
  generate weekly report data package and performance review

monthly:
  generate matched-period platform, genre, creator, music and item report packages
```

## Editorial approval and automation levels

### Level 0: manual production

- Humans select the topic, verify data, write copy, render the asset, and publish.
- Use this to validate formats and audience interest.

### Level 1: assisted drafting

- System detects candidates and generates claim records, charts, copy, and alt text.
- Human approves and publishes manually.

### Level 2: reviewed publishing

- System detects and drafts.
- Human approves.
- Platform adapters publish and collect metrics automatically.

### Level 3: selective automatic publishing

Allow only deterministic formats with reliable inputs, such as:

- verified new codes;
- verified expired codes;
- event starting/live/ending transitions with official times;
- scheduled daily or weekly digests from approved query definitions;
- non-superlative milestone alerts with complete observations.

Keep reviewed:

- biggest/largest/record claims;
- interpretation of growth or decline;
- event-impact causation;
- material Roblox news;
- safety, policy, legal, monetization, or account-impact news;
- rumors or disputed facts;
- posts naming or criticizing creators.

## Measurement framework

Follower count is useful context but should not be the main KPI.

### Primary KPIs

#### 1. Social-origin engaged visits

Measure Bloxodes visits attributable to social publications that satisfy the existing engaged-visit definition: at least 30 active seconds and 50% page scroll.

#### 2. Returning Discord audience

Measure weekly and 28-day active members, repeat participants, alert-role retention, watchlists, commands, and useful reports/requests.

#### 3. Qualified reach efficiency

Measure useful outcomes per 1,000 impressions:

- engaged site visits;
- follows;
- bookmarks;
- Discord joins;
- alert-role opt-ins;
- watchlist creation;
- verified reports or requests.

### Driver metrics

- X impressions, engagement, bookmarks, replies, reposts, quotes, and clicks.
- Chart-versus-text performance.
- Topic and template performance.
- Discord reactions, poll participation, thread replies, commands, and role opt-ins.
- Publication cadence and successful-publish rate.
- Draft approval/rejection rate.
- Time from data refresh to candidate and publication.
- Article click-through and engaged-visit rate.
- Percentage of posts with a useful destination page.

### Guardrails

- [ ] Factual correction rate below 1% after the initial calibration period.
- [ ] Zero unsupported superlatives.
- [ ] Zero duplicate publications caused by retries.
- [ ] Zero known broken destination links at publish time.
- [ ] Zero unexpected mass mentions.
- [ ] Low Discord mute/leave spikes after alert batches.
- [ ] Explicit separation of fact, inference, and prediction.
- [ ] No raw visitor-level analytics or sensitive Discord data stored in editorial reports.
- [ ] No platform credentials or webhook URLs committed to the repository.

### Attribution design

- [ ] Give every publication a stable internal publication ID.
- [ ] Use destination URLs that allow aggregate publication attribution without leaking personal data.
- [ ] Decide whether to use campaign parameters, a first-party redirect path, or both.
- [ ] Preserve the current low-cardinality Umami philosophy.
- [ ] Add an analytics event only when its decision, trigger, properties, and cardinality are clear.
- [ ] Keep X/Discord platform metrics separate from Bloxodes site-engagement metrics.

### Initial target-setting approach

Use the first 28 days of consistent publishing to create a baseline. Then set relative targets rather than arbitrary vanity goals.

Provisional post-baseline targets:

- [ ] Improve useful engagements per 1,000 impressions by 25% over the next two comparable 28-day periods.
- [ ] Increase social-origin engaged visits by 50% over the following 56 days.
- [ ] Maintain the factual-correction guardrail.
- [ ] Increase the percentage of Discord members with at least one useful opt-in role or watchlist.
- [ ] Identify at least three repeatable formats that outperform the account median.
- [ ] Retire or revise formats that repeatedly produce reach without useful downstream actions.

## Profile and brand checklist

### X

- [ ] Update bio to the Roblox data-desk positioning.
- [ ] Create a branded intelligence banner.
- [ ] Confirm profile link destination.
- [ ] Publish and pin the methodology/introduction post.
- [ ] Create a consistent chart visual system.
- [ ] Add accessible alt text to every data image.
- [ ] Maintain a public corrections approach.

### Discord

- [ ] Enable Community features.
- [ ] Configure rules, safety, AutoMod, and moderator channels.
- [ ] Create the minimal initial channel structure.
- [ ] Configure Community Onboarding and opt-in roles.
- [ ] Create the Announcement channel.
- [ ] Create private editorial and moderation queues.
- [ ] Soft-launch with trusted users before public promotion.
- [ ] Test webhook and bot permissions with least privilege.
- [ ] Document escalation and correction procedures.

### Bloxodes site

- [ ] Create or expand a public stats methodology page.
- [ ] Explain 250K-experience coverage and the meaning of Roblox player traffic.
- [ ] Add clear X and Discord destinations where appropriate.
- [ ] Create a social/report archive or recurring-report landing page when enough reports exist.
- [ ] Add Discord join and alert/watchlist CTAs selectively, not on every page.
- [ ] Ensure social assets and report pages have correct metadata and previews.

## Implementation roadmap

### Phase 0 — Editorial and data contract

Goal: define what Bloxodes is allowed to claim before building automation.

- [ ] Finalize the platform-wide traffic terminology.
- [ ] Document reliable tracking start dates by metric and table.
- [ ] Define aligned daily, weekly, monthly, and month-to-date periods.
- [ ] Define qualification floors for games, genres, creators, and items.
- [ ] Define record scopes and historical eligibility.
- [ ] Define claim confidence and coverage fields.
- [ ] Define fact, inference, and prediction labels.
- [ ] Define correction and retraction behavior.
- [ ] Define the first five recurring social formats.
- [ ] Define the first flagship weekly and monthly reports.

Exit criteria:

- Every initial format has a query definition, claim template, chart choice, qualification rules, and destination page.

### Phase 1 — Manual proof and profile foundation

Goal: prove audience value before automating publication.

- [ ] Update X positioning, banner, and pinned post.
- [ ] Soft-launch the minimal Discord structure.
- [ ] Create five branded chart templates.
- [ ] Manually produce 15–20 posts from real Bloxodes data.
- [ ] Publish at least one weekly pulse.
- [ ] Draft the first monthly report package.
- [ ] Record post inputs, output, time cost, and performance manually.
- [ ] Identify repeated claim and rendering work suitable for automation.

Exit criteria:

- At least three formats show useful engagement or downstream behavior.
- The team agrees on visual style, voice, and review standards.

### Phase 2 — Signal, claim, asset, and publication foundations

Goal: create the durable internal system without automatic public posting.

- [ ] Add forward-only migrations for signals, drafts, assets, publications, metrics, and record ledger.
- [ ] Add game/genre/platform candidate detectors.
- [ ] Add deterministic claim records.
- [ ] Add cooldown and deduplication rules.
- [ ] Add shared SVG/PNG rendering helpers.
- [ ] Add preview output and dry-run commands.
- [ ] Add an internal review queue or admin surface.
- [ ] Add audit job and kill switches.
- [ ] Record job health and failures.

Exit criteria:

- A detector run can produce reproducible claim JSON, copy, alt text, and assets without publishing externally.

### Phase 3 — Discord publishing and community loops

Goal: establish the lower-risk return channel first.

- [ ] Add Discord webhook publisher with `wait=true` confirmation.
- [ ] Store message IDs and URLs in `social_publications`.
- [ ] Add digest batching.
- [ ] Add codes and event alert roles.
- [ ] Add report/request moderation intake.
- [ ] Add threads under major reports.
- [ ] Add weekly Discord performance review.
- [ ] Add Discord bot only when interactive requirements are ready.

Exit criteria:

- Discord publications are idempotent, role-safe, measurable, and useful without overwhelming members.

### Phase 4 — X publishing and metrics

Goal: publish approved data products through the official API.

- [ ] Confirm current X API costs and required endpoints.
- [ ] Configure OAuth user-context credentials outside the repository.
- [ ] Add media upload and alt-text support.
- [ ] Add official create-post publisher.
- [ ] Store external IDs and post URLs.
- [ ] Add retry/idempotency handling.
- [ ] Collect recent owned-post metrics within the platform’s availability window.
- [ ] Connect publications to site attribution.
- [ ] Add daily and weekly performance summaries.

Exit criteria:

- Approved posts publish reliably with images and alt text, metrics are collected, and retries do not duplicate posts.

### Phase 5 — Codes, events, music, creators, and items

Goal: expand the proven foundation to other Bloxodes data families.

- [ ] Migrate the codes prototype to platform-specific publication records.
- [ ] Add event state-change detectors.
- [ ] Add creator leaderboard/movement detectors.
- [ ] Add catalog/item mover detectors.
- [ ] Add music-rank history.
- [ ] Add music candidate detectors.
- [ ] Add role/watchlist targeting for codes and events.
- [ ] Add source-specific quality rules.

Exit criteria:

- Each family has at least one reliable recurring format and one explicit quality gate.

### Phase 6 — News and data-enhanced reporting

Goal: combine verified news with original Bloxodes evidence.

- [ ] Add official-source registry.
- [ ] Add news discovery and canonical-source resolution.
- [ ] Add news candidate queue and duplicate grouping.
- [ ] Add data-intersection checks for affected games/topics.
- [ ] Add reviewed news-draft workflow.
- [ ] Publish the daily or weekly news digest only after source quality is proven.
- [ ] Produce update/event impact articles from combined news and stats.

Exit criteria:

- News posts consistently cite the original source, separate confirmed facts from interpretation, and add real Bloxodes value.

### Phase 7 — Selective automation and short-form expansion

Goal: automate proven low-risk formats and reuse strong insights elsewhere.

- [ ] Approve a whitelist of auto-publish formats.
- [ ] Add per-format thresholds and kill switches.
- [ ] Add automatic low-risk codes/event posts.
- [ ] Add scheduled digests from approved definitions.
- [ ] Keep superlatives and news reviewed.
- [ ] Add vertical video rendering for selected high-performing formats.
- [ ] Add short-form scripts and captions.
- [ ] Audit music licensing and platform disclosure requirements.
- [ ] Expand only formats that show useful downstream actions.

Exit criteria:

- Automation lowers production effort without increasing factual errors, duplicates, member fatigue, or infrastructure contention.

## First recommended implementation batch

Implement these before building a general bot:

1. [ ] Platform-wide traffic terminology and methodology page.
2. [ ] `social_signals`, `social_drafts`, `social_assets`, `social_publications`, and `social_record_ledger` schema design.
3. [ ] Qualified 24-hour game riser detector.
4. [ ] Genre traffic-share detector.
5. [ ] Platform daily-traffic record detector.
6. [ ] `record-card`, `top-risers-bars`, and `genre-share-donut` templates.
7. [ ] Local preview/dry-run workflow.
8. [ ] Manual X publication of the first approved assets.
9. [ ] Discord Announcement channel and webhook publishing.
10. [ ] Publication attribution and performance baseline.

This batch provides enough variety to test individual games, platform-wide claims, and part-to-whole charts without prematurely building every source adapter.

## Risks and controls

| Risk | Control |
| --- | --- |
| Percentage growth from a tiny baseline | Qualification floors plus absolute-change display |
| “Biggest ever” without a complete history | Record ledger, reliable tracking start, eligibility query |
| Missing samples create a false jump | Coverage/freshness gate and job-health check |
| CCU described as visits or retention | Metric dictionary and claim templates |
| Identical platform spam | Platform-specific drafts and cooldowns |
| Discord notification fatigue | Opt-in roles, batching, digest mode, limited mentions |
| News repeats a secondary source | Canonical-source resolution and human review |
| Retry creates duplicate posts | Idempotency keys and confirmed external IDs |
| One platform publication blocks another | Per-platform publication rows |
| Social rendering competes with stats/database jobs | Queues, concurrency limits, scheduling, caching |
| Credentials leak | Environment/secret storage only; never commit tokens or webhooks |
| Charts look authoritative but hide methodology | Period, metric, coverage, timestamp, and methodology on assets |
| Automation optimizes vanity metrics | Outcome KPIs and engaged-visit measurement |
| Community submissions become unsafe public content | Moderation queue that fails closed |
| Account becomes a link feed | Social-native insight required before CTA |

## References

### Internal

- `docs/need-to-implement/traffic-diversification-and-community-plan.md`
- `docs/analytics/README.md`
- `supabase/migrations/20260915000010_stats_current_indexes.sql`
- `supabase/migrations/20260915000015_stats_platform_ccu_summary.sql`
- `supabase/migrations/20260918000004_create_stats_creator_current_index.sql`
- `supabase/migrations/20260918000005_stats_items_pipeline.sql`
- `supabase/migrations/20260918000007_platform_stats_aggregates.sql`
- `supabase/migrations/20260918000008_stats_visit_share_chart.sql`
- `supabase/migrations/20260715_create_roblox_virtual_events.sql`
- `supabase/migrations/20260713_create_roblox_music_ids.sql`
- `scripts/posts/post-codes.ts`
- `scripts/AGENTS.md`

### Platform documentation to recheck during implementation

- X create/edit post: <https://docs.x.com/x-api/posts/create-post>
- X metrics: <https://docs.x.com/x-api/fundamentals/metrics>
- X developer guidelines: <https://docs.x.com/developer-guidelines>
- X rate limits: <https://docs.x.com/x-api/fundamentals/rate-limits>
- Discord webhooks: <https://docs.discord.com/developers/resources/webhook>
- Discord message/embed limits: <https://docs.discord.com/developers/resources/message>
- Discord Announcement channels: <https://support.discord.com/hc/en-us/articles/360032008192-Announcement-Channel-FAQ>

Platform API access, costs, rate limits, fields, and automation rules can change. Recheck the official documentation before implementing or materially changing a publisher.

## Open questions

- [ ] What is the exact target date and operational definition for the 250K-experience stats coverage milestone?
- [ ] Which five formats should be used for the first manual proof batch?
- [ ] Should the first weekly flagship be `Roblox Games of the Week` or `State of Roblox Traffic`?
- [ ] Should social review live in a Bloxodes admin screen, a private Discord editorial channel, or both?
- [ ] Should publication attribution use a first-party redirect path, campaign parameters, or a hybrid?
- [ ] Which Discord roles should be present at soft launch rather than added later?
- [ ] Which deterministic codes/event formats are safe enough for the first automatic-publish whitelist?
- [ ] How long should entity/topic cooldowns be on X and Discord?
- [ ] Which chart and post formats should receive vertical-video variants?
- [ ] Should recurring data reports have a dedicated `/reports` family or initially remain under `/articles`?

## Final product definition

The completed system should make Bloxodes feel like a live Roblox intelligence network:

- the database detects what changed;
- the claim layer proves what can be said;
- the chart system makes the change understandable;
- X introduces the insight to new people;
- Discord turns it into alerts, discussion, watchlists, and reports;
- Bloxodes articles preserve the deepest findings;
- analytics show which formats create useful, returning audiences;
- community feedback improves the underlying data and content;
- the strongest low-risk workflows run consistently without sacrificing accuracy.


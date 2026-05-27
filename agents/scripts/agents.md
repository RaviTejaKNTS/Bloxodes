# Script Inventory

Authoritative workflow guidance lives in `scripts/AGENTS.md`.
This file is the quick reference for what exists today and how to invoke it.

## Preferred Entry Point

- Prefer `npm run <name>` when a package script exists.
- Fall back to direct `tsx scripts/...` or `python scripts/...` only for scripts that do not have a package alias yet.

## Content Generation And Editing

| Purpose | File | Preferred command |
| --- | --- | --- |
| Batch article generation | `scripts/articles/generate-articles.ts` | `npm run generate:articles` |
| Draft code page generation | `scripts/games/generate-game-article.ts` | `npm run generate` |
| Event guide generation | `scripts/events/generate-events-articles.ts` | `npm run generate:events-articles` |
| Article generation queue worker | `scripts/automation/run-article-generation-queue.ts` | `npm run articles:queue` |
| Generic generation queue worker | `scripts/automation/run-generation-queue.ts` | `npm run generate:queue` |
| Article refresh/update | `scripts/articles/update-articles.ts` | `npm run articles:update` |
| Code-article rewrite | `scripts/codes/rewrite-codes-articles.ts` | `npm run rewrite:codes` |
| Universe description generation | `scripts/universes/generate-universe-description.ts` | `npm run generate:universe-description` |
| Queue event guides | `scripts/events/queue-event-guides.ts` | `npm run queue:event-guides` |
| Public copy quality check | `scripts/content/check-public-copy.ts` | `npm run content:check-copy -- <final.json>` |
### Code Page Workflow Hard Rules

`scripts/codes/update-codes.ts` is the source of truth for active and expired code rows. It reads `games.source_url` and `games.source_url_2`, detects supported providers, scrapes the source pages, upserts active codes, and expires codes that disappear from the supported sources.

For new or corrected code pages:

- Use the game slug only, such as `wizard-alchemy`, because the route is already `/codes/<slug>`.
- Store the Roblox experience URL in `roblox_link`, not in `source_url`.
- Store the RobloxDen codes page in `source_url`.
- Store the Beebom codes page in `source_url_2`.
- Keep `seo_title` empty or null unless the user explicitly asks for a custom title.
- Do not manually insert `codes` rows, `expired_codes`, code names, rewards tied to current code names, or `first_seen_at` dates.
- After the game row is ready, run `npm run refresh:codes -- --slug <game-slug>`.

Code-page article copy must be long-term. Metadata and prose should explain reward types, redemption steps, troubleshooting, and official source locations without naming active codes, exact dates, month/year labels, active-code counts, or freshness claims such as `latest`, `current`, `fresh`, or `updated daily`.

## Codes Refresh And Posting

| Purpose | File | Preferred command |
| --- | --- | --- |
| Refresh active/expired codes | `scripts/codes/update-codes.ts` | `npm run refresh:codes` |
| Post code updates | `scripts/posts/post-codes.ts` | `npm run post:codes` |
| Post one game update | `scripts/posts/post-online.ts` | `npm run post:online` |
| Post Roblox vibes updates | `scripts/posts/post-roblox-vibes.ts` | `npm run post:vibes` |

## Universe And Metadata Jobs

| Purpose | File | Preferred command |
| --- | --- | --- |
| Import games into Supabase | `scripts/games/import-games.ts` | `npm run import:games` |
| Collect Roblox universes | `scripts/universes/collect-roblox-universes.ts` | `npm run collect:universes` |
| Discover universes from Roblox search | `scripts/universes/search-roblox-universes.ts` | `npm run search:universes` |
| Expand universes from creators/groups | `scripts/universes/expand-roblox-creators.ts` | `npm run expand:creators` |
| Score universe quality tiers | `scripts/universes/score-universe-quality.ts` | `npm run score:universes` |
| Run local-safe universe pipeline | `scripts/universes/run-universe-pipeline.ts` | `npm run pipeline:universes` |
| Backfill missing universe IDs | `scripts/backfill/backfill-game-universes.ts` | `npm run backfill:universes` |
| Update universe slugs | `scripts/universes/update-universe-slugs.ts` | direct `tsx scripts/universes/update-universe-slugs.ts` |
| Sync game slugs | `scripts/universes/sync-game-slugs.ts` | direct `tsx scripts/universes/sync-game-slugs.ts` |
| Enrich universes | `scripts/universes/enrich-roblox-universes.ts` | `npm run enrich:universes`, `npm run enrich:universes:light`, `npm run enrich:universes:deep` |
| Update universe stats | `scripts/universes/update-universe-stats.ts` | `npm run update:stats` |
| Update current playing counts | `scripts/universes/update-universe-playing.ts` | `npm run update:playing` |
| Update hourly public stats | `scripts/universes/update-universe-hourly-stats.ts` | `npm run update:hourly-stats`; use `-- --rollup-today` only when the hourly job should also refresh today's daily row |
| Roll hourly stats into daily rows | `scripts/universes/rollup-universe-daily-stats.ts` | `npm run stats:rollup-daily -- --date today`; use `-- --date yesterday --finalize` after the UTC day ends |
| Snapshot public stats rankings | `scripts/universes/rank-universe-stats.ts` | `npm run stats:rank` |

`enrich-roblox-universes.ts` should not be the normal source for `roblox_universe_stats_daily` now that public stats use hourly rollups. It writes same-day daily stat rows only when `ROBLOX_ENRICH_WRITE_DAILY_STATS=true` is set for a legacy one-off.

| Sync daily puzzle answers | `scripts/puzzles/sync-puzzles.ts` | `npm run sync:puzzles`; use `-- --puzzle wordle`, `-- --date YYYY-MM-DD`, `-- --backfill-days 30`, `-- --dry-run`, or `-- --skip-linkedin` as needed. LinkedIn puzzle sync requires `LINKEDIN_LI_AT` in local/production env. |
| Fix games with article content but missing Roblox link/universe ID | `scripts/games/fix-missing-roblox-links-and-universes.ts` | `npm run fix:game-links` local dry run, `npm run fix:game-links -- --prod --apply` to write prod |
| Backfill social links | `scripts/backfill/backfill-social-links.ts` | `npm run links:backfill` |
| Backfill missing cover images | `scripts/backfill/backfill-missing-cover-images.ts` | `npm run cover:backfill` |
| Backfill interlinking copy | `scripts/backfill/backfill-interlinking.ts` | `npm run backfill:interlinking` |

## Lists And Rankings

| Purpose | File | Preferred command |
| --- | --- | --- |
| Refresh game lists | `scripts/lists/refresh-game-lists.ts` | `npm run lists:refresh` |
| Seed trending lists | `scripts/lists/seed-trending-lists.ts` | `npm run seed:trending-lists` |

## Events

| Purpose | File | Preferred command |
| --- | --- | --- |
| Collect Roblox virtual events | `scripts/events/collect-roblox-virtual-events.ts` | `npm run collect:virtual-events` |
| Seed event pages | `scripts/events/seed-events-pages.ts` | `npm run seed:events-pages` |
| Seed event details | `scripts/events/seed-event-details.ts` | `npm run seed:event-details` |
| Shared event revalidation helper | `scripts/shared/revalidate-events.ts` | imported helper |

## Music IDs, Catalog, And Related Ingestion

| Purpose | File | Preferred command |
| --- | --- | --- |
| Collect Roblox music IDs | `scripts/music/collect-roblox-music-ids.ts` | `npm run collect:music-ids` |
| Collect curated music IDs | `scripts/music/collect-curated-roblox-music-ids.ts` | `npm run collect:music-ids-curated` |
| Collect top 100 songs | `scripts/music/collect-top-100-songs.ts` | `npm run collect:top-100-songs` |
| Import music ID seeds | `scripts/music/import-roblox-music-id-seeds.ts` | `npm run import:music-id-seeds` |
| Scrape music ID seeds | `scripts/music/scrape-roblox-music-id-seeds.ts` | direct `tsx scripts/music/scrape-roblox-music-id-seeds.ts` |
| Enrich music IDs | `scripts/music/enrich-roblox-music-ids.ts` | `npm run enrich:music-ids` |
| Backfill music thumbnails | `scripts/music/backfill-roblox-music-thumbnails.ts` | `npm run thumbnails:music-ids` |
| Verify music IDs | `scripts/music/verify-roblox-music-ids.ts` | `npm run verify:music-ids` |
| Collect accessory catalog items | `scripts/catalog/collect-roblox-catalog-items.ts` | `npm run collect:accessory-items` |
| Collect body catalog items | `scripts/catalog/collect-roblox-body-items.ts` | `npm run collect:body-items` |
| Collect clothing catalog items | `scripts/catalog/collect-roblox-clothing-items.ts` | `npm run collect:clothing-items` |
| Collect avatar animation items | `scripts/catalog/collect-roblox-avatar-animation-items.ts` | `npm run collect:avatar-animation-items` |
| Collect Roblox makeup avatar items | `scripts/catalog/collect-roblox-makeup-items.ts` | `npm run collect:makeup-items` |
| Collect Grow a Garden local catalog images | `scripts/catalog/collect-grow-a-garden-images.ts` | `npm run collect:grow-a-garden-images` |
| Collect Slime RNG local catalog data and images | `scripts/catalog/collect-slime-rng-data.ts` | `npm run collect:slime-rng-data` |
| Seed gathered game catalog pages into Supabase | `scripts/catalog/seed-game-catalog-pages.ts` | `npm run seed:game-catalog-pages`, add `-- --dry-run` to preview; add `-- --final-json-root tmp/content-workspace/<game-slug>/catalogs` when approved page `final.json` files should override generated copy; supports new `<collection-slug>/final.json` and older `<catalog-code>/final.json` folders |
| Seed broad catalog pages into Supabase | `scripts/catalog/seed-catalog-pages.ts` | `npm run seed:catalog-pages -- --file tmp/content-workspace/<topic>/catalogs/<batch>/final.json --dry-run`; writes to local Supabase by default and refuses production unless `--allow-prod` is supplied |
| Seed gathered game wiki pages into Supabase | `scripts/catalog/seed-game-wiki-pages.ts` | `npm run seed:game-wiki-pages`, add `-- --dry-run` to preview |
| Import reviewed content final JSON into Supabase | `scripts/content/import-content-final.ts` | `npm run import:content-final -- --file tmp/content-workspace/<game-or-topic-slug>/<page-folder>/final.json --dry-run`; article imports write only to `articles`, fill missing authors randomly, create edited game-thumbnail covers when needed, inject the feature image before the first H2, and require `/articles` plus `/articles/<slug>` verification against the same saved row |
| Collect all catalog item families | multiple catalog collectors | `npm run collect:catalog-items` |
| Enrich catalog items | `scripts/catalog/enrich-roblox-catalog-items.ts` | `npm run enrich:catalog-items` |
| Import RobloxDen free items | `scripts/catalog/import-robloxden-free-items.py` | direct `python scripts/catalog/import-robloxden-free-items.py` |
| Trading limiteds collection | `scripts/trading/collect-all-limiteds.ts` | `npm run trading:collect` |
| Scrape decal IDs | `scripts/decal-ids/scrape-decal-ids.ts` | `npm run scrape:decal-ids` |
| Enrich decal IDs | `scripts/decal-ids/enrich-decal-ids.ts` | `npm run enrich:decal-ids` |

## Ads, Reporting, And Automation Utilities

| Purpose | File | Preferred command |
| --- | --- | --- |
| Update `ads.txt` | `scripts/ads/update-ads-txt.ts` | `npm run ads:update` |
| IndexNow bootstrap | `scripts/automation/indexnow-bootstrap.ts` | `npm run indexnow:bootstrap` |
| Google Indexing API submitter | `scripts/automation/google-indexing-submit.ts` | `npm run indexing:google -- --dry-run`, live only with `--apply` and `GOOGLE_INDEXING_API_ENABLED=true` |
| Warm Cloudflare cache | `scripts/automation/warm-cloudflare-cache.mjs` | `CACHE_WARM_SITE_URL=https://bloxodes.com npm run cache:warm`; default deploy mode warms main/index/legal URLs, all wiki/catalog/tool URLs, sitemap files, and a recent slice from DB-backed detail sitemaps; use `CACHE_WARM_MODE=full` only for intentional full-site warming |
| Queue revalidation events | `scripts/automation/enqueue-revalidation-events.ts` | `npm run enqueue:revalidation -- --event stats:stats --event stats:games`; writes coalesced rows to `revalidation_events` for the Supabase worker |
| Automation reporting | `scripts/automation/report-automation.mjs` | direct `node scripts/automation/report-automation.mjs` |
| Report redeem markdown image gaps | `scripts/backfill/report-redeem-md-missing-images.ts` | direct `tsx scripts/backfill/report-redeem-md-missing-images.ts` |
| Shared Tavily helper | `scripts/shared/tavily.ts` | imported helper |

### Google Indexing API Workflow

The Google Indexing API job is separate from `.env.analytics`. Local settings belong in ignored `.env.indexing` files; production/GitHub settings should be injected as secrets or variables. The script is guarded twice: it needs `--apply`, and it still exits without submitting unless `GOOGLE_INDEXING_API_ENABLED=true`.

For recurring runs, use Supabase state by setting `GOOGLE_INDEXING_STATE_BACKEND=supabase` with `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE`. That lets the job persist the daily submission count and rotate through older URLs instead of hitting the same sitemap URLs every run.

Minimum production settings:

- `GOOGLE_INDEXING_API_ENABLED=true`
- `GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON_BASE64=<service account JSON as base64 secret>`
- `GOOGLE_INDEXING_DAILY_LIMIT=50`
- `GOOGLE_INDEXING_BATCH_LIMIT=10`
- `GOOGLE_INDEXING_REQUEST_DELAY_MS=1000`
- `GOOGLE_INDEXING_RESUBMIT_AFTER_HOURS=168`
- `GOOGLE_INDEXING_STATE_BACKEND=supabase`

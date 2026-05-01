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
| Collect Grow a Garden local catalog images | `scripts/catalog/collect-grow-a-garden-images.ts` | `npm run collect:grow-a-garden-images` |
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
| Warm Cloudflare cache | `scripts/automation/warm-cloudflare-cache.mjs` | direct `node scripts/automation/warm-cloudflare-cache.mjs` |
| Automation reporting | `scripts/automation/report-automation.mjs` | direct `node scripts/automation/report-automation.mjs` |
| Report redeem markdown image gaps | `scripts/backfill/report-redeem-md-missing-images.ts` | direct `tsx scripts/backfill/report-redeem-md-missing-images.ts` |
| Shared Tavily helper | `scripts/shared/tavily.ts` | imported helper |

# Automation scripts

## How to run
- Most scripts are TypeScript and are run via tsx (see package.json scripts).
- Many scripts require Supabase credentials and other env vars; check your runtime config.

## Content generation + editing
- scripts/articles/generate-articles.ts: batch article generation into Supabase.
- scripts/games/generate-game-article.ts: generate a single game article.
- scripts/events/generate-events-articles.ts: generate event guide articles from events pages.
- scripts/automation/run-generation-queue.ts: worker for queued generation tasks.
- scripts/automation/run-article-generation-queue.ts: worker for article generation queue.
- scripts/articles/update-articles.ts: refresh/update existing article content.
- scripts/codes/rewrite-codes-articles.ts: rewrite/refresh code articles.
- scripts/universes/generate-universe-description.ts: generate/update universe descriptions.
- scripts/events/queue-event-guides.ts: queue event guide content for generation.

## Codes refresh + distribution
- scripts/codes/update-codes.ts: refresh active/expired code lists.
- scripts/posts/post-codes.ts: publish code updates to outbound channels.
- scripts/posts/post-online.ts: post a single game update.
- scripts/posts/post-roblox-vibes.ts: post Roblox vibes updates.

## Universe + metadata ingestion
- scripts/games/import-games.ts: import games into Supabase.
- scripts/universes/collect-roblox-universes.ts: collect universe records from Roblox APIs.
- scripts/backfill/backfill-game-universes.ts: backfill missing universe IDs.
- scripts/update-universe-slugs.ts: normalize/update universe slugs.
- scripts/sync-game-slugs.ts: sync game slugs with canonical.
- scripts/universes/enrich-roblox-universes.ts: enrich universe metadata (socials, flags, etc).
- scripts/universes/update-universe-stats.ts: refresh universe stats (visits, likes, etc).
- scripts/universes/update-universe-playing.ts: refresh current playing counts.
- scripts/backfill/backfill-social-links.ts: backfill social links for universes.
- scripts/backfill/backfill-missing-cover-images.ts: fill missing cover images.
- scripts/backfill/backfill-interlinking.ts: backfill interlinking AI copy.

## Lists + rankings
- scripts/lists/refresh-game-lists.ts: refresh list entries and rankings.
- scripts/lists/seed-trending-lists.ts: seed trending lists.

## Events
- scripts/events/collect-roblox-virtual-events.ts: ingest Roblox virtual events.
- scripts/events/seed-events-pages.ts: create/update event landing pages.
- scripts/events/seed-event-details.ts: backfill event details for pages.
- scripts/shared/revalidate-events.ts: helper for revalidating event pages via API.

## Music IDs + catalog
- scripts/music/collect-roblox-music-ids.ts: ingest music IDs from Roblox sources.
- scripts/music/collect-curated-roblox-music-ids.ts: ingest curated music IDs.
- scripts/music/import-roblox-music-id-seeds.ts: import seed lists into Supabase.
- scripts/scrape-roblox-music-id-seeds.ts: scrape external seed lists.
- scripts/music/enrich-roblox-music-ids.ts: enrich music IDs with metadata.
- scripts/music/backfill-roblox-music-thumbnails.ts: backfill album art thumbnails.
- scripts/music/verify-roblox-music-ids.ts: verify boombox readiness / availability.
- scripts/catalog/collect-roblox-catalog-items.ts: ingest Roblox catalog items.
- scripts/catalog/enrich-roblox-catalog-items.ts: enrich catalog items with metadata.

## Ads + diagnostics
- scripts/ads/update-ads-txt.ts: update ads.txt before builds.
- scripts/report-redeem-md-missing-images.ts: report missing images in redeem markdown.
- scripts/debug-extract-images.ts: debug image extraction in markdown.
- scripts/automation/report-automation.mjs: send automation summaries to Telegram.

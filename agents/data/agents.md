# Data Sources Inventory

Authoritative workflow guidance lives in:

- `src/lib/AGENTS.md`
- `supabase/AGENTS.md`
- `data/AGENTS.md`

This file is the quick reference for the repo's current data surface.

## Supabase: Core Public Content

- `games`, `code_pages_view`, `game_pages_index_view`
  - Code pages and code index views.
- `articles`, `article_pages_view`, `article_pages_index_view`
  - Article detail and article index content.
- `authors`
  - Author profiles.
- `game_lists`, `game_lists_index_view`, `game_list_entries`
  - Rankings and list pages.
- `checklist_pages`, `checklist_pages_view`, `checklist_items`
  - Checklist detail and checklist index content.
- `quiz_pages`, `quiz_pages_view`
  - Quiz detail and quiz index content.
- `wiki_pages`, `wiki_pages_view`
  - Game wiki hubs that link editorial controls/tips to `roblox_universes` automation.
- `tools`, `tools_view`
  - Tool copy and tool indexes.
- `catalog_pages`, `catalog_pages_view`
  - Catalog page copy and catalog indexes, including optional `wiki_md`, `wiki_sort_order`, `wiki_item_count`, and `wiki_image_urls` fields for game wiki catalog sections.
- `events_pages`
  - Event landing pages.

## Supabase: Roblox And Catalog Enrichment

- `roblox_universes`
  - Universe metadata, stats, flags, icons, links.
- `roblox_groups`
  - Group details used by the ID extractor.
- `roblox_universe_gamepasses`, `roblox_universe_badges`
  - ID extractor fallback/cache data.
- `roblox_virtual_events`
  - Event scheduling and event media linkage.
- `roblox_music_ids`, `roblox_music_ids_ranked_view`
  - Music ID catalog and ranking/search views.
- `roblox_music_genres_view`, `roblox_music_artists_view`
  - Music filters and taxonomy views.
- `roblox_catalog_items`
  - Free-item and broader catalog ingestion data.

## Supabase: User, Community, And Ops

- `app_users`
  - Account identity and Roblox-linked profile data.
- `app_sessions`
  - Session storage for signed-in flows.
- `comments`
  - Comment threads for supported content types.
- `user_code_progress`
  - Used-code progress per user/game.
- `user_checklist_progress`
  - Checklist completion state.
- `user_quiz_progress`
  - Quiz history and seen-question state.
- `revalidation_events`
  - Publish-trigger queue for the revalidation edge function.
- `article_generation_queue`, `article_generation_artifacts`
  - Article draft generation queue state and per-run model/source/validation audit artifacts.
- RPC `search_site`
  - Site-wide search aggregation.

## Local Datasets

- `data/Admin commands/*.md`
  - Parsed by `src/lib/admin-commands.ts`.
- `data/Grow a Garden/crops.json`
  - Parsed by `src/lib/grow-a-garden/crops.ts`.
- `data/Grow a Garden/crops.md`
  - Supporting content for Grow a Garden data work.
- `data/Grow a Garden/quiz.json`
  - Quiz content for the Grow a Garden quiz flow.
- `data/The Forge/*.json`
  - Forge catalog and calculator datasets consumed by `src/lib/forge/*` and catalog routes.
  - The Forge collection pages also use `quests.json`, `skills.json`, `blueprints.json`, and `npcs.json` through `src/app/(site)/catalog/the-forge/page-data.tsx`.
- `data/Fisch/fish.json`
  - Fisch catalog content.
- `data/Color Codes/roblox-color-codes.json`
  - Color-code dataset for the color-code catalog pages.
- `data/decal-ids/*.json`, `data/decal-ids/*.csv`
  - Decal ID scrape and enrichment outputs.
- `data/roblox errros/roblox-errors.json`
  - Static Roblox error reference dataset.
- `src/data/slug_oldslugs.json`
  - Legacy slug redirect map for the public fallback route.

## Static Config And Generated Assets

- `src/app/(site)/tools/robux-to-usd-calculator/robux-bundles.ts`
- `src/app/(site)/tools/robux-to-usd-calculator/robux-plans.ts`
  - Static pricing inputs for the Robux calculator.
- `src/lib/devex/constants.ts`
  - Static DevEx calculator baseline values.
- `src/config/csp-directives.json`
  - CSP config input.
- `public/*`
  - Images, logos, favicons, generated media, static verification files, and other public assets.

## External APIs And Services

- Roblox public APIs for universes, groups, thumbnails, catalog, and auth.
- Supabase edge functions for publish revalidation and Roblox-code workflows.
- Cloudflare purge API via the app revalidation route.
- Telegram API for automation reports.
- Other script-time providers such as Tavily or content-source sites when the relevant scripts call them.

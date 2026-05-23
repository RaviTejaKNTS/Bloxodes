# Data Sources Inventory

Authoritative workflow guidance lives in:

- `apps/web/src/lib/AGENTS.md`
- `supabase/AGENTS.md`
- `data/AGENTS.md`

This file is the quick reference for the repo's current data surface.
After the monorepo move, older shorthand paths in this inventory that begin with `src/` refer to `apps/web/src/`.

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
- `wiki_catalog_pages`, `wiki_catalog_pages_view`
  - Game-specific collection pages rendered under `/wiki/<game-slug>/<collection-slug>`, with stable `code` values kept for scripts, search, and old catalog URL redirects.
- `tools`, `tools_view`
  - Tool copy and tool indexes.
- `catalog_pages`, `catalog_pages_view`
  - General Roblox catalog hub copy and catalog indexes for pages that are not tied to one game, such as music IDs, decal IDs, free Roblox items, and admin commands.
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
- `data/Grow a Garden/seeds.json`
- `data/Grow a Garden/pets.json`
- `data/Grow a Garden/eggs.json`
- `data/Grow a Garden/gears.json`
- `data/Grow a Garden/crop-mutations.json`
- `data/Grow a Garden/pet-mutations.json`
- `data/Grow a Garden/weather.json`
- `data/Grow a Garden/merchants.json`
- `data/Grow a Garden/npcs.json`
- `data/Grow a Garden/shops.json`
- `data/Grow a Garden/seed-packs.json`
- `data/Grow a Garden/crafting-recipes.json`
- `data/Grow a Garden/food.json`
- `data/Grow a Garden/currencies.json`
  - Local Grow a Garden catalog datasets collected from multiple external sources and intended for wiki/catalog page work.
- `data/Grow a Garden/quiz.json`
  - Quiz content for the Grow a Garden quiz flow.
- `data/Steal a Brainrot/*.json`
  - Local Steal a Brainrot in-game datasets collected from the Steal a Brainrot Wiki for wiki/catalog page work.
  - Matching images live under `apps/web/public/Steal a Brainrot/`.
- `data/Sailor Piece/*.json`
  - Local Sailor Piece in-game datasets collected from SailorPiece.org for wiki/catalog page work.
  - Matching source-provided images live under `apps/web/public/Sailor Piece/`.
- `data/Brookhaven RP/*.json`
  - Local Brookhaven RP in-game datasets collected from the Official Brookhaven Wiki for wiki/catalog page work.
  - Matching source-provided images live under `apps/web/public/Brookhaven RP/`.
- `data/Adopt Me/*.json`
  - Local Adopt Me in-game datasets collected from the Adopt Me Wiki and Roblox public APIs for wiki/catalog page work.
  - Matching source-provided images live under `apps/web/public/Adopt Me/`.
- `data/Blox Fruits/*.json`
  - Local Blox Fruits in-game datasets collected from the Blox Fruits Wiki and Roblox public APIs for wiki/catalog page work.
  - Matching source-provided images live under `apps/web/public/Blox Fruits/`.
- `data/The Forge/*.json`
  - Forge catalog and calculator datasets consumed by `src/lib/forge/*` and catalog routes.
  - The Forge collection pages also use `quests.json`, `skills.json`, `blueprints.json`, and `npcs.json` through `src/app/(site)/catalog/the-forge/page-data.tsx`.
- `data/Wizard Alchemy/*.json`
  - Local Wizard Alchemy game datasets for wiki/catalog page work, including materials, potions, races, wands, brooms, robes, wizard hats, enemies, chests, enchantments, locations, NPCs, and resource nodes.
  - Do not store manual code-page payloads with active codes or dates here. Code pages should update the `games` row with `roblox_link`, RobloxDen `source_url`, and Beebom `source_url_2`, then rely on `scripts/codes/update-codes.ts` to populate `codes`.
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

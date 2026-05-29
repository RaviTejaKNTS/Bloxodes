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
  - `articles` is the article write source. Article views are read projections only; article imports should not write separate index/detail data.
- `authors`
  - Author profiles.
- `game_lists`, `game_lists_index_view`, `game_list_entries`
  - Rankings and list pages.
- `checklist_pages`, `checklist_pages_view`, `checklist_items`
  - Checklist detail and checklist index content.
- `quiz_pages`, `quiz_pages_view`
  - Quiz detail and quiz index metadata. Quiz detail rendering does not use `about_md`; keep quiz value in the intro copy and question pool. Use `agents/content/page-types/quizzes.md` for page shape and validation.
- `puzzle_pages`, `puzzle_pages_view`, `puzzle_answers`, `puzzle_sync_runs`
  - Daily puzzle answer pages under `/puzzles`. `puzzle_pages` stores durable page copy and SEO; `puzzle_answers` stores one row per puzzle/date with `answer_summary` and raw `payload`; dated archive pages are noindex and excluded from the puzzles sitemap.
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
- `roblox_universe_stats_hourly`
  - Public stats history for `/stats`; one row per universe per hour with latest, average, peak, min, deltas, sample counts, and raw snapshot JSON.
- `roblox_universe_stats_daily`
  - Long-range public stats summaries; daily `playing` is the highest recorded CCU for that day after hourly rollup.
- `roblox_universe_rank_snapshots`
  - Hourly public rank snapshots for global playing, visits, favorites, and rating leaderboards.
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
  - Free-item and broad Roblox item and bundle ingestion data. Broad `/catalog/roblox-*` Marketplace pages use category/subcategory, item type, sale status, price, creator, favorite, limited, resale, and thumbnail rows from this table.
- `roblox_catalog_item_images`, `roblox_catalog_categories`, `roblox_catalog_subcategories`, `roblox_catalog_refresh_queue`
  - Avatar marketplace thumbnail cache, taxonomy cache, and enrichment queue for Roblox catalog item routes. Bundle thumbnails must come from the Roblox bundle thumbnail endpoint, while asset thumbnails use the asset endpoint.

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

- Wiki/catalog datasets should satisfy the player-usefulness gate from `agents/content/PROCESS.md`. Keep source-backed fields that players need for decisions, such as prices, currencies, shops, requirements, damage, chances, upgrade paths, locations, roles, limits, and availability, instead of storing only easy-to-scrape labels.

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
  - Local Grow a Garden quiz question pool for `/quizzes/grow-a-garden`.
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
- `data/RIVALS/*.json`
  - Local RIVALS game datasets for wiki/catalog page work, including weapons, maps, skins, wraps, charms, finishers, emotes, official UGC items, and quiz content.
  - `quiz.json` is the local question pool for `/quizzes/rivals`; use the `QuizData` shape with 10 easy, 10 medium, and 10 hard questions when possible.
  - Keep RIVALS catalog datasets limited to durable in-game item collections plus the official UGC exception. Do not store gamepasses, badges, servers, current event reward tracks, ranked-season reward lists, or manual active-code data here.
- `data/Wizard Alchemy/*.json`
  - Local Wizard Alchemy game datasets for wiki/catalog page work, including materials, potions, races, wands, brooms, robes, wizard hats, enemies, chests, enchantments, locations, NPCs, and resource nodes.
  - `potions.json`, `materials.json`, and `races.json` also power the Wizard Alchemy potion planner and race reroll calculator through `src/lib/wizard-alchemy/data.ts`.
  - Do not store manual code-page payloads with active codes or dates here. Code pages should update the `games` row with `roblox_link`, RobloxDen `source_url`, and Beebom `source_url_2`, then rely on `scripts/codes/update-codes.ts` to populate `codes`.
- `data/Slime RNG/*.json`
  - Local Slime RNG game datasets for wiki/catalog page work, including slimes, zones, crafting recipes, items, Power Fruits, rebirths, and index rewards.
  - `quiz.json` is the local question pool for `/quizzes/slime-rng`; follow `agents/content/page-types/quizzes.md` when editing it.
  - Matching source-provided images live under `apps/web/public/Slime RNG/`. Rebirth and index reward rows are text-only because the source data is milestone-based rather than item-image based.
- `data/Kick a Lucky Block/*.json`
  - Local Kick a Lucky Block game datasets for wiki/catalog page work, including brainrots, mutations, weights, and zones. Gamepasses are out of scope for Bloxodes game wiki catalogs.
  - Matching row images live under `apps/web/public/Kick a Lucky Block/` where reliable item art exists. Brainrot rows stay blank when only weak crops, edited graphics, or non-item substitutes are available; mutation rows stay text-only until clean in-game effect captures exist.
- `data/Wizard Alchemy/quiz.json`
  - Local Wizard Alchemy quiz question pool for `/quizzes/wizard-alchemy`.
  - Quiz pools use `QuizData` shape with `easy`, `medium`, and `hard` arrays. Keep easy questions beginner-friendly, make hard questions pro-level, and vary question rhythm naturally.
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

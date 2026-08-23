# Data Sources Inventory

Authoritative workflow guidance lives in:

- `apps/web/src/lib/AGENTS.md`
- `supabase/AGENTS.md`
- `data/AGENTS.md`

This file is the quick reference for the repo's current data surface.
After the monorepo move, older shorthand paths in this inventory that begin with `src/` refer to `apps/web/src/`.

## Supabase: Core Public Content

- `code_pages`, `code_pages_view`, `code_pages_index_view`
  - Code pages and code index views.
- `articles`, `article_pages_view`, `article_pages_index_view`
  - `articles` is the article write source. Article views are read projections only; article imports should not write separate index/detail data.
- `authors`
  - Author profiles.
- `checklist_pages`, `checklist_pages_view`, `checklist_items`
  - Checklist detail and checklist index content.
- `quiz_pages`, `quiz_pages_view`
  - Quiz detail and quiz index metadata. Quiz detail rendering does not use `about_md`; keep quiz value in the intro copy and question pool. Use `bloxodes-quiz-writing` for page shape and validation.
- `puzzle_pages`, `puzzle_pages_view`, `puzzle_answers`, `puzzle_sync_runs`
  - Daily puzzle answer pages under `/puzzles`. `puzzle_pages` stores durable page copy and SEO; `puzzle_answers` stores one row per puzzle/date with `answer_summary` and raw `payload`; dated archive pages are noindex and excluded from the puzzles sitemap.
- `wiki_pages`, `wiki_pages_view`
  - Game wiki hubs that store editorial overview copy in `description_md` and link controls/tips to `roblox_universes` automation.
- `wiki_collection_pages`, `wiki_collection_pages_view`
  - Game-specific collection pages rendered under `/wiki/<game-slug>/<collection-slug>`, with stable `code` values kept for scripts, search, and old catalog URL redirects.
  - Use `display_name` for clean navigation labels such as `Domains` or `Characters`; keep `title`/`seo_title` as full page/SEO titles. Use `item_count` for collection navigation counts instead of parsing titles.
- `tools`, `tools_view`
  - Tool copy and tool indexes.
- `catalog_pages`, `catalog_pages_view`
- `roblox_font_ids`: official Roblox Creator Store FontFamily assets, native faces/styles, preview thumbnails, licensing metadata, and verification timestamps for `/catalog/roblox-font-ids`
- `roblox_mesh_ids`: public Roblox Creator Store MeshPart listings, their underlying geometry Mesh IDs, optional Texture IDs, square previews, source order, and verification timestamps for `/catalog/roblox-mesh-ids`
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
- `roblox_universe_rank_snapshots_hourly`
  - Short-range public rank snapshots for chart views. Hourly automation computes all-game playing ranks, then stores rank-relevant global, genre, and subgenre rows.
- `roblox_universe_rank_snapshots_daily`
  - Long-range public rank snapshots. Daily automation stores full all-game rank rows for playing, visits, favorites, and rating.
- `roblox_universe_update_events`
  - Historical Roblox game update markers detected during hourly stats refreshes. Use this for stats chart update overlays; `roblox_universes.updated_at_api` is latest-state only.
- `stats_game_current_index`, `stats_genre_current_index`, `stats_risers_current_index`, `stats_creator_current_index`
  - Public `/stats` read models for game listings, genre summaries, risers, and creator leaderboards. Current-player values, playing growth, and playing ranks are null after `last_playing_refreshed_at` is more than 24 hours old; the raw last observation remains on `roblox_universes` for history. Rebuild through the stats current-index refresh workflow.
- `stats_job_runs`, `get_roblox_universe_pipeline_health_v3()`
  - Operational job history and the service-role-only, timeout-safe health snapshot used by strict game-stats audits. The snapshot reconciles public 24-hour visibility, tier refresh starts, recent universe-only stale runs, leases, overdue rows, and current-index freshness without scanning multi-million-row daily history tables.
- `roblox_platform_stats_hourly`, `roblox_platform_stats_daily`
  - Public `/stats/roblox-platform` aggregates for platform-level playing, visits, favorites, rating, tracked-game count, and chart ranges. Refresh through `npm run stats:platform:refresh`.
- `roblox_catalog_items`
  - Public `/stats/items` source table for Roblox marketplace item stats, including favorites, price, resale, category, creator, and last-seen fields.
- `roblox_catalog_item_stats_hourly`, `roblox_catalog_item_stats_daily`, `roblox_catalog_item_resale_points`
  - Public `/stats/items/[assetId]` item history tables for hourly marketplace snapshots, daily open/close/min/max rollups, and Roblox public resale price/volume points.
- `stats_item_current_index`, `stats_item_price_movers_current_index`
  - Public `/stats/items` read models for fast item listings, rankings, price/resale deltas, thumbnails, and mover slices. Rebuild through `npm run stats:items:index:refresh`.
- `roblox_groups`
  - Group details used by the ID extractor.
- `roblox_universe_gamepasses`, `roblox_universe_badges`
  - ID extractor fallback/cache data.
- `roblox_virtual_events`
  - Event scheduling and event media linkage.
- `roblox_music_ids`, `roblox_music_ids_ranked_view`
  - Music ID catalog and ranking/search views.
- `roblox_music_id_game_usage`, `roblox_music_ids_game_view`
  - Source-backed audio-to-game associations for `/catalog/roblox-music-ids/games/*`. Compatibility evidence stays separate from canonical audio metadata; only `in_game_verified` means a row was tested inside the named experience.
- `roblox_decal_id_game_usage`, `roblox_decal_ids_game_view`
  - Source-backed decal/image-to-game associations for `/catalog/roblox-decal-ids/games/*`, including the submitted decal asset, optional underlying texture ID, use type, source, and compatibility status.
- `roblox_music_genres_view`, `roblox_music_artists_view`
  - Music filters and taxonomy views.
- `roblox_promo_rewards`
  - Service-role-only source and audit rows for `/catalog/roblox-promo-codes`. The weekly RobloxDen refresh stores factual offer fields, official Roblox asset metadata and thumbnails, conservative miss/retirement state, and an explicit `source_listed_unverified` or `verified_claimable` public status. Raw discovery evidence is never rendered publicly.
- `roblox_catalog_items`
  - Free-item and broad Roblox item and bundle ingestion data. Broad `/catalog/roblox-*` Marketplace pages use category/subcategory, item type, sale status, price, creator, favorite, limited, resale, and thumbnail rows from this table. Free-item candidates may originate from Roblox search, RobloxDen, or another source tagged in `raw_economy_json`; candidate origin does not control publication. `/catalog/free-roblox-items` requires a current Roblox verification result, `free_claimability = 'direct'`, and a `free_verified_at` value from the last 72 hours; zero-price experience rewards and resale-only rows remain excluded.
- `roblox_catalog_item_images`, `roblox_catalog_categories`, `roblox_catalog_subcategories`, `roblox_catalog_refresh_queue`
  - Avatar marketplace thumbnail cache, taxonomy cache, and enrichment queue for Roblox catalog item routes. Bundle thumbnails must come from the Roblox bundle thumbnail endpoint, while asset thumbnails use the asset endpoint.

## Supabase: User, Community, And Ops

- `app_users`
  - Account identity and Roblox-linked profile data.
- `app_sessions`
  - Stores server-managed session rows plus sanitized `login_source_path` and `login_return_path` from the Roblox OAuth flow.
  - Session storage for signed-in flows.
- `comments`
  - Comment threads for supported content types, including codes, articles, catalogs, events, tools, wiki pages, and wiki collection pages. Stores server-resolved `page_type` and `page_url` for operator review.
- `user_code_progress`
  - Used-code progress per user/game.
- `user_checklist_progress`
  - Checklist completion state.
- `user_quiz_progress`
  - Quiz history and seen-question state.
- `revalidation_events`
  - Publish-trigger queue for the revalidation edge function.
- `article_discovery_candidates`, `article_curation_runs`
  - Managed-dev raw publisher leads and the Groq/Llama batch decision audit. Candidate rows retain source name, reusable canonical source URL, headline/date, bounded headings/excerpt evidence, content hash, curation prompt version, rejection reason, model/confidence, and every promoted queue ID. Runs record repeated zero-approval degradation. Homelab automation owns these rows; production is checked through the GET-only editorial inventory endpoint.
- `article_generation_queue`, `article_generation_artifacts`
  - Article draft generation queue state and per-run model/source/validation audit artifacts. Source-discovered `agent_runner` work is eligible only after Groq curation and retains all grouped publisher links/evidence in `source_urls` and `source_items`; one source may support several distinct topic keys. `blocked` is retryable, `skipped` is an editorial stop, `completed` means the local article passed QA and awaits human review, `published` records a verified production URL, and `rejected` records a human decision not to publish. Blocked, published, and rejected topic keys remain deduplicated.
- RPC `search_site`
  - Site-wide search aggregation.

## Local Datasets

- Wiki/collection datasets should keep source-backed fields that players need for decisions, such as prices, currencies, shops, requirements, damage, chances, upgrade paths, locations, roles, limits, and availability, instead of storing only easy-to-scrape labels.

- `src/data/reports/roblox-june-2026.ts`
  - Frozen editorial snapshot for the public `/stats/reports/roblox-june-2026` report, written as a continuous player-facing feature rather than a dashboard.
  - Daily and same-weekday/rolling-window comparisons come from `roblox_universe_stats_daily`; event markers come from `roblox_virtual_events`; platform and community mentions keep attributable source URLs inline in the copy.
  - `featureImage` selects the approved headline, lead metric, accessible description, and real chart series used to generate `public/images/reports/roblox-june-2026.png` for the archive and social previews.
  - Keep each monthly report immutable after approval except for explicit corrections. New months should add a new dated module and route instead of mutating a prior edition.
- `src/data/reports/roblox-july-2026.ts`
  - Frozen editorial snapshot for the published `/stats/reports/roblox-july-2026` report, sourced from the dossier-approved analysis in `tmp/content-workspace/roblox/reports/2026-07/`. Chart UI lives in `src/components/reports/RobloxJuly2026ReportCharts.tsx`.
  - The route is indexed and included in the reports archive, Stats navigation, Stats sitemap, RSS feed, and report-aware stats revalidation.
  - `featureImage` selects the dossier-approved headline, lead metric, accessible description, and real Murder Mystery 2 chart series used to generate `public/images/reports/roblox-july-2026.png` for the archive and social metadata.
  - Keep this module immutable except for explicit corrections, and never edit the June module or route while working on July.
- `data/Admin commands/*.md`
  - Parsed by `src/lib/admin-commands.ts`.
- `data/roblox-dictionary/roblox-dictionary.json`
  - Local source-backed dictionary for `/catalog/roblox-dictionary`, with 251 searchable Roblox slang, acronym, platform, creator, and legacy entries and complete coverage of RobloxDen's 55-entry index plus the official Roblox Dictionary's 67 terms as audited on 2026-08-11.
  - Public definitions and examples are original. Per-item `sourceUrls`, `lastVerifiedAt`, and current/legacy status support later audits without exposing harmful bypass or exploit instructions.
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
  - Local Grow a Garden collection datasets collected from multiple external sources and intended for wiki/collection page work.
- `data/Grow a Garden/quiz.json`
  - Local Grow a Garden quiz question pool for `/quizzes/grow-a-garden`.
- `data/Steal a Brainrot/*.json`
  - Local Steal a Brainrot in-game datasets collected from the Steal a Brainrot Wiki for wiki/collection page work.
  - Matching images live under `apps/web/public/Steal a Brainrot/`.
- `data/Sailor Piece/*.json`
  - Local Sailor Piece in-game datasets collected from SailorPiece.org for wiki/collection page work.
  - Matching source-provided images live under `apps/web/public/Sailor Piece/`.
- `data/Brookhaven RP/*.json`
  - Local Brookhaven RP in-game datasets collected from the Official Brookhaven Wiki for wiki/collection page work.
  - Matching source-provided images live under `apps/web/public/Brookhaven RP/`.
- `data/Adopt Me/*.json`
  - Local Adopt Me in-game datasets collected from the Adopt Me Wiki and Roblox public APIs for wiki/collection page work.
  - Matching source-provided images live under `apps/web/public/Adopt Me/`.
- `data/Blox Fruits/*.json`
  - Local Blox Fruits in-game datasets collected from the Blox Fruits Wiki and Roblox public APIs for wiki/collection page work.
  - Matching source-provided images live under `apps/web/public/Blox Fruits/`.
- `data/Capybaras VS Plants/*.json`
  - Local Capybaras VS Plants datasets for wiki/collection page work, including the Plant Index and the Boss Summoner progression.
  - Keep Boss Summoner rows separate from ordinary plant drops: Pumpkin Tyrant is the sixth original boss, Carnivorous Plant is not a boss row, and Update 3 adds Conqueror Carrot after Pumpkin Tyrant.
- `data/Dress To Impress/*.json`
  - Local Dress To Impress game datasets for wiki/collection and quiz page work, including themes, free items, code items, currency items, pose packs, ranks, walk packs, runway effects, pattern packs, hairstyles, makeup, nails, reward items, Robux items, VIP items, and quiz content.
  - Matching source-provided images live under `apps/web/public/Dress To Impress/` where useful item, pack, salon, or unlock art exists. Themes stay text-only; the free-items collection has one documented image gap for Gingerbread Suit where no clean source image was available.
- `data/The Forge/*.json`
  - The Forge collection and calculator datasets consumed by `src/lib/forge/*` and wiki collection routes.
  - The Forge collection pages also use `quests.json`, `skills.json`, `blueprints.json`, and `npcs.json` through `src/app/(site)/wiki/collections/games/the-forge.tsx`.
- `data/RIVALS/*.json`
  - Local RIVALS game datasets for wiki/collection page work, including weapons, maps, skins, wraps, charms, finishers, emotes, official UGC items, and quiz content.
  - `quiz.json` is the local question pool for `/quizzes/rivals`; use the `QuizData` shape with 10 easy, 10 medium, and 10 hard questions when possible.
  - Keep RIVALS collection datasets limited to durable in-game item collections plus the official UGC exception. Do not store gamepasses, badges, servers, current event reward tracks, ranked-season reward lists, or manual active-code data here.
- `data/Wizard Alchemy/*.json`
  - Local Wizard Alchemy game datasets for wiki/collection page work, including materials, potions, races, wands, brooms, robes, wizard hats, enemies, chests, enchantments, locations, NPCs, and resource nodes.
  - `potions.json`, `materials.json`, and `races.json` also power the Wizard Alchemy potion planner and race reroll calculator through `src/lib/wizard-alchemy/data.ts`.
  - Do not store manual code-page payloads with active codes or dates here. Code pages should update the `code_pages` row with `roblox_link`, RobloxDen `source_url`, and Beebom `source_url_2`, then rely on `scripts/codes/update-codes.ts` to populate `codes`.
- `data/Slime RNG/*.json`
  - Local Slime RNG game datasets for wiki/collection page work, including slimes, zones, crafting recipes, items, Power Fruits, rebirths, and index rewards.
  - `quiz.json` is the local question pool for `/quizzes/slime-rng`; use `bloxodes-quiz-writing` when editing it.
  - Matching source-provided images live under `apps/web/public/Slime RNG/`. Rebirth and index reward rows are text-only because the source data is milestone-based rather than item-image based.
- `data/99 Nights in the Forest/*.json`
  - Local 99 Nights in the Forest game datasets for wiki/collection page work, including classes, crafting, materials, weapons, tools, food, tameable animals, entities, locations, and quiz content.
  - `quiz.json` is the local question pool for `/quizzes/99-nights-in-the-forest`; use the `QuizData` shape with 10 easy, 10 medium, and 10 hard questions when possible.
  - Keep quiz questions tied to stable survival, crafting, rescue, class, taming, weapon, material, and route facts. Do not store active codes, live event statuses, temporary reward tracks, or unresolved disputed facts here.
- `data/Sell Lemons/*.json`
  - Local Sell Lemons game datasets for wiki/collection and quiz page work, including income sources, active income methods, powers, secret unlocks, evolution stages, locations, orchard items, orchard mutations, tycoon upgrades, ascension rewards, companions, and quiz content.
  - `quiz.json` is the local question pool for `/quizzes/sell-lemons`; keep hard questions tied to stable progression, reset concepts, and named plot upgrades, not unstable exact costs or source-conflicted UFO/Purity/Sewer step sequences.
- `data/Kick a Lucky Block/*.json`
  - Local Kick a Lucky Block game datasets for wiki/collection page work, including brainrots, mutations, weights, and zones. Gamepasses are out of scope for Bloxodes game wiki collections.
  - Matching row images live under `apps/web/public/Kick a Lucky Block/` where reliable item art exists. Brainrot rows stay blank when only weak crops, edited graphics, or non-item substitutes are available; mutation rows stay text-only until clean in-game effect captures exist.
- `data/Catch And Tame/*.json`
  - Local Catch And Tame game datasets for wiki/collection page work, including mutations, pets, breeding recipes, weather events, traits, biomes, lassos, items, island keys, enchantments, and fishing gear.
  - Rows are source-backed to Catch And Tame wiki pages and stay text-only until clean local row images are collected. Island-key images are planned from Fandom inventory icons.
- `data/Untitled Boxing Game/*.json`
  - Local Untitled Boxing Game datasets for wiki/collection page work, including styles, gloves, emotes, knockout effects, titles, maps, and ranks.
  - Matching style, glove, and knockout effect images live under `apps/web/public/Untitled Boxing Game/` where clean item art exists. Emotes, titles, and ranks stay text-only unless clean row-level captures are available. Map row icons belong under `apps/web/public/Untitled Boxing Game/Maps/` after the image pass.
  - Keep UBG collections limited to durable style, cosmetic, title, and rank systems. Do not store live trade values, manual active-code data, gamepasses, badges, servers, or current event reward tracks here.
- `data/Push Rock for Brainrots/*.json`
  - Local Push Rock for Brainrots datasets for wiki/collection page work, including Brainrots, rocks/gates, and upgrades.
  - Matching row or system images live under `apps/web/public/Push Rock for Brainrots/` by collection folder. Keep gamepasses, badges, developer products, and generic Hunter mentions out of the datasets unless the row-level facts are source-backed and useful to players.
- `data/Practical Basketball/*.json`
  - Local Practical Basketball datasets for wiki/collection page work. `badges.json` stores source-backed My Player gameplay badges by Finishing, Shooting, Playmaking, and Defense & Rebounding, with text-only rows until source-backed badge icons are collected.
  - `takeovers.json` stores source-backed build takeover boosts by player role, including scoring, slashing, playmaking, and interior/rebounding utility sections. Requirements stay blank unless a source-backed unlock or attribute gate is found.
  - Keep each dataset limited to its source-backed Practical Basketball system. Do not mix Roblox achievement badges, takeovers, badges, animations, cosmetics, or invented thresholds into the wrong collection.
- `data/Restaurant Tycoon 3/*.json`
  - Local Restaurant Tycoon 3 datasets for wiki/collection page work, including food, drinks, ingredients, customers, workers, upgrades, build items, milestones, locations, objectives, music, restaurant templates, and rating categories.
  - Matching source-backed images live under `apps/web/public/Restaurant Tycoon 3/` by collection folder where useful row images are available.
- `data/Storage Hunters Open World/*.json`
  - Local Storage Hunters: Open World datasets for wiki/collection page work, including accessories, shop upgrades, titles, achievements, and auction zones.
  - Matching row images live under `apps/web/public/Storage Hunters Open World/` where clean item or achievement art exists. Titles and auction zones stay text-only until clean row-level images are available.
- `data/Volleyball Legends/*.json`
  - Local Volleyball Legends datasets for wiki/collection page work, including styles, abilities, and ball skins.
  - Matching row images live under `apps/web/public/Volleyball Legends/`. Ball skins use WebP files; Gamer Ball and Phonk Ball intentionally share one source-backed image.
- `data/DOORS/*.json`
  - Local DOORS datasets for wiki/collection page work, including released entities, permanent run items, released floors and subfloors, and fixed named locations.
  - Matching optimized WebP images live under `apps/web/public/DOORS/` by collection folder. Keep upcoming floors, temporary modes, events, modifiers, achievements, and generic procedural rooms outside these datasets.
- `data/Wizard Alchemy/quiz.json`
  - Local Wizard Alchemy quiz question pool for `/quizzes/wizard-alchemy`.
  - Quiz pools use `QuizData` shape with `easy`, `medium`, and `hard` arrays. Keep easy questions beginner-friendly, make hard questions pro-level, and vary question rhythm naturally.
- `data/Fisch/fish.json`
  - Fisch collection content.
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

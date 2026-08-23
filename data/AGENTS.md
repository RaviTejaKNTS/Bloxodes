# Local Data Guide

Scope: `data/` plus related static data under `src/data/`.

Environment boundaries and database-vs-dataset ownership are documented in `dev-docs/data/data-environments.md`. Global `/catalog` data belongs to `dev-docs/pipelines/catalog.md`; game wiki hubs and their game-specific collection datasets belong together in `dev-docs/pipelines/wiki-collections.md`.

When dataset ownership or a consuming pipeline changes, update that existing canonical file or the owning existing pipeline document in the same change. Do not create a replacement current-state doc.

These files back tools, game collections, and broad catalog sections that are not fully modeled in Supabase.

When turning a game dataset into public wiki or collection pages, use `agents/content-writing/agents.md` and the matching wiki or game collection skill. Use `bloxodes-game-collection-refresh` when checking and refreshing one existing collection dataset, one game's collection datasets, or every registered game collection.

## Dataset Map

- `apps/web/src/data/reports/roblox-june-2026.ts`
  - Frozen stats, event annotations, and attributable news context for the public June 2026 Roblox monthly report.
  - Its `featureImage` configuration drives the static, data-backed archive and social image at `apps/web/public/images/reports/roblox-june-2026.png`.
  - The published `/stats/reports/roblox-june-2026` route is indexed through the Stats sitemap and linked from the Stats home and RSS feed.
- `data/Admin commands/*.md`
  - Parsed by `src/lib/admin-commands.ts`.
  - Used by catalog admin-command routes.
- `data/game-specific-ids/source-backed.json`
  - Generated audio and decal associations used to seed the game-specific Music IDs and Decal IDs pages. Refresh through `npm run sync:game-specific-id-sources`, review the diff, then dry-run and run `npm run seed:game-specific-id-usage -- --replace-source-rows` against managed Supabase development so stale rows from the same source are removed.
  - Preserve source URL, checked time, use type, and compatibility status. A source-listed row is not an in-game verification result.
- `data/Grow a Garden/*`
  - Dataset-backed Grow a Garden collection content, including crops, seeds, pets, eggs, gears, mutations, weather, merchants, NPCs, shops, seed packs, crafting recipes, food, currencies, and `quiz.json`.
- `data/Grow a Garden 2/*`
  - Dataset-backed Grow a Garden 2 wiki/collection content, including seeds, crops, pets, gears, sprinklers, crates, mutations, shops, and night-stealing tools.
  - Keep rows source-backed to Grow a Garden 2 specifically. Do not fill crop sell values, sprinkler prices, mutation multipliers, guild rewards, or egg rows from Grow a Garden 1 or unverified calculator assumptions.
- `data/Steal a Brainrot/*`
  - Dataset-backed Steal a Brainrot wiki/collection content, including brainrots, rarities, mutations, traits, rebirths, gears, lucky blocks, rituals, machines, and fuse-machine entries.
- `data/Sailor Piece/*`
  - Dataset-backed Sailor Piece wiki/collection content, including fruits, swords, races, bosses, islands, accessories, melee specs, traits, runes, relics, bloodlines, clans, Haki, titles, dungeons, and guilds.
- `data/Brookhaven RP/*`
  - Dataset-backed Brookhaven RP wiki/collection content, including vehicles, houses, jobs, gamepasses, inventory items, roleplay outfits, map themes, weather/disasters, props, emotes, secrets, locations, and game info.
- `data/Adopt Me/*`
  - Dataset-backed Adopt Me wiki/collection content, including pets, eggs, vehicles, toys, strollers, food, potions, gifts, gift prizes, furniture, house surfaces, gamepasses, star rewards, accessory-shop entries, pet ages, and game info.
- `data/Blox Fruits/*`
  - Dataset-backed Blox Fruits wiki/collection content, including fruits, swords, guns, accessories, materials, fighting styles, quests, enemies, titles, boats, Aura, Instinct, bosses, NPCs, locations, races, sea events, abilities, item index entries, and game info.
- `data/Dress To Impress/*`
  - Dataset-backed Dress To Impress wiki/collection and quiz content, including themes, free items, code items, currency items, pose packs, ranks, walk packs, runway effects, pattern packs, hairstyles, makeup, nails, reward items, Robux items, VIP items, and `quiz.json`.
  - Theme rows are intentionally text-only. Other collection rows use matching item, pack, salon, or unlock images under `apps/web/public/Dress To Impress/` when a clean source image exists; the free-items catalog has one documented image gap for Gingerbread Suit.
  - Hairstyles are intentionally not seeded until the available source rows have player-readable names or a cleaner visual-identification dataset.
- `data/The Forge/*.json`
  - Structured collection and calculator data used by The Forge collection pages and Forge tools.
- `data/RIVALS/*`
  - Dataset-backed RIVALS wiki/collection content, including weapons, maps, skins, wraps, charms, finishers, emotes, official UGC items, and `quiz.json`.
  - `quiz.json` is the local question pool for `/quizzes/rivals`; use `bloxodes-quiz-writing` when editing quiz content.
  - Keep RIVALS collections focused on durable in-game item collections. Do not add gamepasses, badges, servers, current event reward tracks, or ranked-season reward lists as collection datasets.
- `data/Wizard Alchemy/*`
  - Dataset-backed Wizard Alchemy wiki/collection content, including materials, potions, races, wands, brooms, robes, wizard hats, enemies, chests, enchantments, locations, NPCs, and resource nodes.
  - `quiz.json` is the local question pool for `/quizzes/wizard-alchemy`; use `bloxodes-quiz-writing` when editing quiz content.
  - Code pages must not keep manual code seed payloads. For Wizard Alchemy or any other game, update the `code_pages` row with `roblox_link`, RobloxDen `source_url`, and Beebom `source_url_2`, then let `scripts/codes/update-codes.ts` populate `codes`.
- `data/Slime RNG/*`
  - Dataset-backed Slime RNG wiki/collection content, including slimes, zones, crafting recipes, items, Power Fruits, rebirths, and index rewards.
  - `quiz.json` is the local question pool for `/quizzes/slime-rng`; use `bloxodes-quiz-writing` when editing quiz content.
  - Matching source-provided images live under `apps/web/public/Slime RNG/` when the source file exists. Rebirths and index rewards are intentionally text-only catalogs.
- `data/99 Nights in the Forest/*`
  - Dataset-backed 99 Nights in the Forest wiki/collection content, including classes, crafting, materials, weapons, tools, food, tameable animals, entities, locations, and `quiz.json`.
  - `quiz.json` is the local question pool for `/quizzes/99-nights-in-the-forest`; use `bloxodes-quiz-writing` when editing quiz content.
  - Keep quiz and catalog facts source-backed. Do not add active code names, live event statuses, temporary reward tracks, or disputed exact values such as unresolved item costs.
- `data/Sell Lemons/*`
  - Dataset-backed Sell Lemons wiki/collection and quiz content, including income sources, active income methods, powers, secret unlocks, evolution stages, locations, orchard items, orchard mutations, tycoon upgrades, ascension rewards, companions, and `quiz.json`.
  - `quiz.json` is the local question pool for `/quizzes/sell-lemons`; use stable progression, power, secret, Evolution, location, orchard-mutation, and named plot-upgrade facts rather than unstable exact upgrade costs or source-conflicted secret-step sequences.
- `data/Kick a Lucky Block/*`
  - Dataset-backed Kick a Lucky Block wiki/collection content, including brainrots, mutations, weights, and zones. Gamepasses are out of scope for Bloxodes game wiki collections.
  - Matching item images live under `apps/web/public/Kick a Lucky Block/` for brainrots, weights, zones, and official Roblox page media. Brainrot rows stay blank when only weak crops, edited graphics, or non-item substitutes are available; mutation rows stay text-only until clean in-game effect captures exist.
- `data/Catch And Tame/*`
  - Dataset-backed Catch And Tame wiki/collection content, including mutations, pets, breeding recipes, weather events, traits, biomes, lassos, items, island keys, enchantments, and fishing gear.
  - Keep rows source-backed to game-specific wiki pages. Mutation rows are currently text-only until clean local row icons are collected. Island-key images are planned from Fandom inventory icons.
- `data/Untitled Boxing Game/*`
  - Dataset-backed Untitled Boxing Game wiki/collection content, including styles, gloves, emotes, knockout effects, titles, maps, and ranks.
  - Matching style, glove, and knockout effect images live under `apps/web/public/Untitled Boxing Game/` where clean row-level art exists. Emotes, titles, and ranks stay text-only unless clean row-level captures are available. Map row icons belong under `apps/web/public/Untitled Boxing Game/Maps/` after the image pass.
  - Keep collections focused on durable style/cosmetic/title/rank systems. Do not add live trade values, manual active-code lists, gamepasses, badges, servers, or current event reward-track planning here.
- `data/Push Rock for Brainrots/*`
  - Dataset-backed Push Rock for Brainrots wiki/collection content, including Brainrots, rocks/gates, and upgrades.
  - Matching source-backed images live under `apps/web/public/Push Rock for Brainrots/` by collection folder. Keep gamepasses and generic Hunter mentions out of these datasets unless row-level, player-useful facts are available.
- `data/Restaurant Tycoon 3/*`
  - Dataset-backed Restaurant Tycoon 3 wiki/collection content, including food, drinks, ingredients, customers, workers, upgrades, build items, milestones, locations, objectives, music, restaurant templates, and rating categories.
  - Matching source-backed images live under `apps/web/public/Restaurant Tycoon 3/` by collection folder where useful row images are available.
- `data/Storage Hunters Open World/*`
  - Dataset-backed Storage Hunters: Open World wiki/collection content, including accessories, shop upgrades, titles, achievements, and auction zones.
  - Matching row images live under `apps/web/public/Storage Hunters Open World/` where clean item or achievement art exists. Titles and auction zones are currently text-only because no clean row-level images were found.
- `data/Volleyball Legends/*`
  - Dataset-backed Volleyball Legends wiki/collection content for styles, abilities, and ball skins.
  - Matching row images live under `apps/web/public/Volleyball Legends/`. Ball skins use WebP files; Gamer Ball and Phonk Ball intentionally share the same source-backed image.
- `data/Fisch/fish.json`
  - Fisch collection content.
- `data/Color Codes/roblox-color-codes.json`
  - Color code catalog for the color-code pages.
- `data/decal-ids/*`
  - Decal ID datasets produced by the scrape/enrich scripts.
- `data/roblox-errors/roblox-errors.json`
  - Roblox error reference data behind `/catalog/roblox-errors-and-fixes`.
  - Loaded by `apps/web/src/app/(site)/catalog/roblox-errors-and-fixes/page-data.tsx`. `articleSlug` links a card to its `/articles/<slug>` fix guide; `surface` must match a section in that route's `ERROR_SECTIONS`.
- `data/roblox-dictionary/roblox-dictionary.json`
  - Source-backed Roblox slang, acronym, platform, creator, and legacy terminology behind `/catalog/roblox-dictionary`.
  - Keep definitions and examples original, retain per-term source URLs and verification dates, mark retired language as `legacy`, and never add filter-bypass, exploit, scam, or off-platform contact instructions.
- `src/data/slug_oldslugs.json`
  - Legacy slug redirect map for the public fallback route.

## Rules

- Treat local data files as content sources, not ad hoc dumps. Keep filenames and object shapes stable once routes depend on them.
- Collection refresh scope is defined by registered game collection config plus unregistered v2 collection-shaped files in that registered game's data directory. Non-collection files are outside the collection refresh workflow.
- Game wiki collection datasets must use the v2 separated shape: `{ "meta": {...}, "items": [{ "item": {...}, "system": {...} }] }`.
- In v2 game collection datasets, `items[].item` is public game data only. Do not put `collectionSection`, `section`, `sortOrder`, `slug`, `image`, source URLs, source pages, verification notes, raw text, image status, or workflow/debug fields there.
- In v2 game collection datasets, `items[].system` may contain only `slug`, `section`, `sortOrder`, and `image`. Use these for Bloxodes routing, grouping, ordering, and image rendering without interfering with real game fields that may have similar names.
- `meta.display` owns the public render contract for game collections: `groupLabel`, `sectionOrder`, `tableFields`, `cardFields`, optional badge/subtitle/description fields, and `fieldPresentation`. Every display field must exist in `meta.itemFields` and in public item data.
- Run `npm run audit:game-collection-datasets:v2 -- --game <game-slug> --collection <collection-slug>` before seeding or reviewing any game collection page.
- For wiki/collection datasets, include source-backed fields players need, such as prices, currencies, shops, requirements, damage, chances, upgrade paths, locations, roles, limits, and availability when those facts drive decisions.
- When changing a dataset, update the parser/helper in `src/lib/*` or the route-family helper in `src/app/(site)`.
- If a dataset powers a public route, verify SEO text, pagination, and revalidation behavior still make sense after the change.
- If a `quiz.json` file powers a public quiz route, validate the `QuizData` shape, difficulty counts, option IDs, answer IDs, and rendered `/quizzes/<slug>` page after editing.
- If a new dataset becomes long-lived, document it in `agents/data/agents.md`.
- Do not store manual active-code lists, expired-code lists, code dates, or code rewards in `data/`. Code data belongs to the source-driven codes refresh workflow.

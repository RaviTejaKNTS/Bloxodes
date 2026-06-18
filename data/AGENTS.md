# Local Data Guide

Scope: `data/` plus related static data under `src/data/`.

These files back tools and catalog sections that are not fully modeled in Supabase.

When turning a game dataset into public wiki or catalog pages, use `agents/content-writing/agents.md` and the matching wiki or game catalog skill.

## Dataset Map

- `data/Admin commands/*.md`
  - Parsed by `src/lib/admin-commands.ts`.
  - Used by catalog admin-command routes.
- `data/Grow a Garden/*`
  - Dataset-backed Grow a Garden catalog content, including crops, seeds, pets, eggs, gears, mutations, weather, merchants, NPCs, shops, seed packs, crafting recipes, food, currencies, and `quiz.json`.
- `data/Grow a Garden 2/*`
  - Dataset-backed Grow a Garden 2 wiki/catalog content, including seeds, crops, pets, gears, sprinklers, crates, mutations, shops, and night-stealing tools.
  - Keep rows source-backed to Grow a Garden 2 specifically. Do not fill crop sell values, sprinkler prices, mutation multipliers, guild rewards, or egg rows from Grow a Garden 1 or unverified calculator assumptions.
- `data/Steal a Brainrot/*`
  - Dataset-backed Steal a Brainrot wiki/catalog content, including brainrots, rarities, mutations, traits, rebirths, gears, lucky blocks, rituals, machines, and fuse-machine entries.
- `data/Sailor Piece/*`
  - Dataset-backed Sailor Piece wiki/catalog content, including fruits, swords, races, bosses, islands, accessories, melee specs, traits, runes, relics, bloodlines, clans, Haki, titles, dungeons, and guilds.
- `data/Brookhaven RP/*`
  - Dataset-backed Brookhaven RP wiki/catalog content, including vehicles, houses, jobs, gamepasses, inventory items, roleplay outfits, map themes, weather/disasters, props, emotes, secrets, locations, and game info.
- `data/Adopt Me/*`
  - Dataset-backed Adopt Me wiki/catalog content, including pets, eggs, vehicles, toys, strollers, food, potions, gifts, gift prizes, furniture, house surfaces, gamepasses, star rewards, accessory-shop entries, pet ages, and game info.
- `data/Blox Fruits/*`
  - Dataset-backed Blox Fruits wiki/catalog content, including fruits, swords, guns, accessories, materials, fighting styles, quests, enemies, titles, boats, Aura, Instinct, bosses, NPCs, locations, races, sea events, abilities, item index entries, and game info.
- `data/Dress To Impress/*`
  - Dataset-backed Dress To Impress wiki/catalog and quiz content, including themes, free items, code items, currency items, pose packs, ranks, walk packs, runway effects, pattern packs, hairstyles, makeup, nails, reward items, Robux items, VIP items, and `quiz.json`.
  - Theme rows are intentionally text-only. Other collection rows use matching item, pack, salon, or unlock images under `apps/web/public/Dress To Impress/` when a clean source image exists; the free-items catalog has one documented image gap for Gingerbread Suit.
  - Hairstyles are intentionally not seeded until the available source rows have player-readable names or a cleaner visual-identification dataset.
- `data/The Forge/*.json`
  - Structured catalog and calculator data used by Forge catalog pages and Forge tools.
- `data/RIVALS/*`
  - Dataset-backed RIVALS wiki/catalog content, including weapons, maps, skins, wraps, charms, finishers, emotes, official UGC items, and `quiz.json`.
  - `quiz.json` is the local question pool for `/quizzes/rivals`; use `bloxodes-quiz-writing` when editing quiz content.
  - Keep RIVALS catalogs focused on durable in-game item collections. Do not add gamepasses, badges, servers, current event reward tracks, or ranked-season reward lists as catalog datasets.
- `data/Wizard Alchemy/*`
  - Dataset-backed Wizard Alchemy wiki/catalog content, including materials, potions, races, wands, brooms, robes, wizard hats, enemies, chests, enchantments, locations, NPCs, and resource nodes.
  - `quiz.json` is the local question pool for `/quizzes/wizard-alchemy`; use `bloxodes-quiz-writing` when editing quiz content.
  - Code pages must not keep manual code seed payloads. For Wizard Alchemy or any other game, update the `code_pages` row with `roblox_link`, RobloxDen `source_url`, and Beebom `source_url_2`, then let `scripts/codes/update-codes.ts` populate `codes`.
- `data/Slime RNG/*`
  - Dataset-backed Slime RNG wiki/catalog content, including slimes, zones, crafting recipes, items, Power Fruits, rebirths, and index rewards.
  - `quiz.json` is the local question pool for `/quizzes/slime-rng`; use `bloxodes-quiz-writing` when editing quiz content.
  - Matching source-provided images live under `apps/web/public/Slime RNG/` when the source file exists. Rebirths and index rewards are intentionally text-only catalogs.
- `data/99 Nights in the Forest/*`
  - Dataset-backed 99 Nights in the Forest wiki/catalog content, including classes, crafting, materials, weapons, tools, food, tameable animals, entities, locations, and `quiz.json`.
  - `quiz.json` is the local question pool for `/quizzes/99-nights-in-the-forest`; use `bloxodes-quiz-writing` when editing quiz content.
  - Keep quiz and catalog facts source-backed. Do not add active code names, live event statuses, temporary reward tracks, or disputed exact values such as unresolved item costs.
- `data/Sell Lemons/*`
  - Dataset-backed Sell Lemons wiki/catalog and quiz content, including income sources, powers, secret unlocks, evolution stages, locations, and `quiz.json`.
  - `quiz.json` is the local question pool for `/quizzes/sell-lemons`; use stable progression, power, secret, Evolution, and location facts rather than unverified upgrade rows or source-conflicted secret-step sequences.
- `data/Kick a Lucky Block/*`
  - Dataset-backed Kick a Lucky Block wiki/catalog content, including brainrots, mutations, weights, and zones. Gamepasses are out of scope for Bloxodes game wiki catalogs.
  - Matching item images live under `apps/web/public/Kick a Lucky Block/` for brainrots, weights, zones, and official Roblox page media. Brainrot rows stay blank when only weak crops, edited graphics, or non-item substitutes are available; mutation rows stay text-only until clean in-game effect captures exist.
- `data/Catch And Tame/*`
  - Dataset-backed Catch And Tame wiki/catalog content, including mutations, pets, breeding recipes, weather events, traits, biomes, lassos, and items.
  - Keep rows source-backed to game-specific wiki pages. Mutation rows are currently text-only until clean local row icons are collected.
- `data/Untitled Boxing Game/*`
  - Dataset-backed Untitled Boxing Game wiki/catalog content, including styles, gloves, emotes, knockout effects, and titles.
  - Matching style, glove, and knockout effect images live under `apps/web/public/Untitled Boxing Game/` where clean row-level art exists. Emotes and titles stay text-only unless clean row-level captures are available.
  - Keep catalogs focused on durable style/cosmetic/title systems. Do not add live trade values, manual active-code lists, gamepasses, badges, servers, or current event reward-track planning here.
- `data/Push Rock for Brainrots/*`
  - Dataset-backed Push Rock for Brainrots wiki/catalog content, including Brainrots, rocks/gates, and upgrades.
  - Matching source-backed images live under `apps/web/public/Push Rock for Brainrots/` by collection folder. Keep gamepasses and generic Hunter mentions out of these datasets unless row-level, player-useful facts are available.
- `data/Fisch/fish.json`
  - Fisch catalog content.
- `data/Color Codes/roblox-color-codes.json`
  - Color code catalog for the color-code pages.
- `data/decal-ids/*`
  - Decal ID datasets produced by the scrape/enrich scripts.
- `data/roblox errros/roblox-errors.json`
  - Static Roblox error reference data.
- `src/data/slug_oldslugs.json`
  - Legacy slug redirect map for the public fallback route.

## Rules

- Treat local data files as content sources, not ad hoc dumps. Keep filenames and object shapes stable once routes depend on them.
- For wiki/catalog datasets, include source-backed fields players need, such as prices, currencies, shops, requirements, damage, chances, upgrade paths, locations, roles, limits, and availability when those facts drive decisions.
- When changing a dataset, update the parser/helper in `src/lib/*` or the route-family helper in `src/app/(site)`.
- If a dataset powers a public route, verify SEO text, pagination, and revalidation behavior still make sense after the change.
- If a `quiz.json` file powers a public quiz route, validate the `QuizData` shape, difficulty counts, option IDs, answer IDs, and rendered `/quizzes/<slug>` page after editing.
- If a new dataset becomes long-lived, document it in `agents/data/agents.md`.
- Do not store manual active-code lists, expired-code lists, code dates, or code rewards in `data/`. Code data belongs to the source-driven codes refresh workflow.

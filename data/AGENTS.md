# Local Data Guide

Scope: `data/` plus related static data under `src/data/`.

These files back tools and catalog sections that are not fully modeled in Supabase.

When turning a game dataset into public wiki and catalog pages, follow `agents/wiki-catalog-workflow.md`.

## Dataset Map

- `data/Admin commands/*.md`
  - Parsed by `src/lib/admin-commands.ts`.
  - Used by catalog admin-command routes.
- `data/Grow a Garden/*`
  - Dataset-backed Grow a Garden catalog content, including crops, seeds, pets, eggs, gears, mutations, weather, merchants, NPCs, shops, seed packs, crafting recipes, food, currencies, and `quiz.json`.
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
- `data/The Forge/*.json`
  - Structured catalog and calculator data used by Forge catalog pages and Forge tools.
- `data/RIVALS/*`
  - Dataset-backed RIVALS wiki/catalog content, including weapons, maps, skins, wraps, charms, finishers, emotes, official UGC items, and `quiz.json`.
  - `quiz.json` is the local question pool for `/quizzes/rivals`; follow `agents/content/page-types/quizzes.md` when editing it.
  - Keep RIVALS catalogs focused on durable in-game item collections. Do not add gamepasses, badges, servers, current event reward tracks, or ranked-season reward lists as catalog datasets.
- `data/Wizard Alchemy/*`
  - Dataset-backed Wizard Alchemy wiki/catalog content, including materials, potions, races, wands, brooms, robes, wizard hats, enemies, chests, enchantments, locations, NPCs, and resource nodes.
  - `quiz.json` is the local question pool for `/quizzes/wizard-alchemy`; follow `agents/content/page-types/quizzes.md` when editing it.
  - Code pages must not keep manual code seed payloads. For Wizard Alchemy or any other game, update the `games` row with `roblox_link`, RobloxDen `source_url`, and Beebom `source_url_2`, then let `scripts/codes/update-codes.ts` populate `codes`.
- `data/Slime RNG/*`
  - Dataset-backed Slime RNG wiki/catalog content, including slimes, zones, crafting recipes, items, Power Fruits, rebirths, and index rewards.
  - `quiz.json` is the local question pool for `/quizzes/slime-rng`; follow `agents/content/page-types/quizzes.md` when editing it.
  - Matching source-provided images live under `apps/web/public/Slime RNG/` when the source file exists. Rebirths and index rewards are intentionally text-only catalogs.
- `data/Kick a Lucky Block/*`
  - Dataset-backed Kick a Lucky Block wiki/catalog content, including brainrots, mutations, weights, and zones. Gamepasses are out of scope for Bloxodes game wiki catalogs.
  - Matching item images live under `apps/web/public/Kick a Lucky Block/` for brainrots, weights, zones, and official Roblox page media. Brainrot rows stay blank when only weak crops, edited graphics, or non-item substitutes are available; mutation rows stay text-only until clean in-game effect captures exist.
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
- For wiki/catalog datasets, include the source-backed fields required by the page's player-usefulness gate, such as prices, currencies, shops, requirements, damage, chances, upgrade paths, locations, roles, limits, and availability when those facts drive player decisions.
- When changing a dataset, update the parser/helper in `src/lib/*` or the route-family helper in `src/app/(site)`.
- If a dataset powers a public route, verify SEO text, pagination, and revalidation behavior still make sense after the change.
- If a `quiz.json` file powers a public quiz route, validate the `QuizData` shape, difficulty counts, option IDs, answer IDs, and rendered `/quizzes/<slug>` page after editing.
- If a new dataset becomes long-lived, document it in `agents/data/agents.md`.
- Do not store manual active-code lists, expired-code lists, code dates, or code rewards in `data/`. Code data belongs to the source-driven codes refresh workflow.

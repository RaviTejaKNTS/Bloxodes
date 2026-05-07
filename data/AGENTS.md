# Local Data Guide

Scope: `data/` plus related static data under `src/data/`.

These files back tools and catalog sections that are not fully modeled in Supabase.

When turning a game dataset into public wiki and catalog pages, follow `agents/wiki-catalog-workflow.md`.

## Dataset Map

- `data/Admin commands/*.md`
  - Parsed by `src/lib/admin-commands.ts`.
  - Used by catalog admin-command routes.
- `data/Grow a Garden/*`
  - Dataset-backed Grow a Garden catalog content, including crops, seeds, pets, eggs, gears, mutations, weather, merchants, NPCs, shops, seed packs, crafting recipes, food, currencies, and quiz content.
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
- When changing a dataset, update the parser/helper in `src/lib/*` or the route-family helper in `src/app/(site)`.
- If a dataset powers a public route, verify SEO text, pagination, and revalidation behavior still make sense after the change.
- If a new dataset becomes long-lived, document it in `agents/data/agents.md`.

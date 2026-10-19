# Catalog

Last verified: 2026-10-19

Global Roblox reference pages at `/catalog/<slug>`: item IDs, music IDs, decals, emotes, admin commands, color codes, error codes, the Roblox dictionary and more. Game-specific item lists are wiki collections, not catalog pages.

## Pages

- **Skills:** `bloxodes-catalog-workflow-runner`, `bloxodes-catalog-research`, `bloxodes-catalog-writing`. Made by hand when the owner asks.
- **Data:** `catalog_pages` holds copy, metadata and publication. 76 rows, 72 published on 2026-10-19.
- **Publish:** the `catalog` publisher (`seed:catalog-pages`, `verify:catalog-finals`). Copy-only changes publish through GitHub; renderer or data-file changes need a web deploy.

Each page's loader combines its copy with live database data or a small committed reference file.

## Data behind the pages

| Data | Source | Refresh |
| --- | --- | --- |
| Marketplace items, free items, promo rewards, music and decal IDs | `roblox_*` tables | VPS cron. See [data refreshes](data-refreshes.md). |
| Emote commands | `roblox_emote_commands`, seeded from `data/roblox-emotes/commands.json` | By hand: `seed:emote-commands`, `audit:emote-commands`. |
| Fonts and meshes | `roblox_font_ids`, `roblox_mesh_ids` | By hand: `collect:font-ids`, `collect:mesh-ids`. |
| Admin commands, color codes, error codes, dictionary | `data/Admin commands/*.md`, `data/Color Codes/`, `data/roblox-errors/`, `data/roblox-dictionary/` | By hand, shipped with web deploys. |

Emote commands come from verified sources, never from Marketplace names.

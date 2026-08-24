# Game Wiki and Collection Pipeline

Status: Active
Last verified: 2026-08-24
Evidence: wiki route/data contracts, workflow skills, game collection registry and v2 dataset rules, seed/verification scripts, and the latest production row-count sample

## Scope

Game wiki hubs and their game-specific collections are one editorial/data unit:

- `/wiki/<game-slug>` is backed by `wiki_pages`.
- `/wiki/<game-slug>/<collection-slug>` is backed by `wiki_collection_pages` plus a source-backed game dataset when the collection has item rows.
- The latest verified production sample contained 57 wiki hubs and 439 wiki collection pages.

These collections describe one game's durable systems and items—pets, weapons, crops, locations, NPCs, recipes, mutations, progression systems, and similar player-facing sets. They are not part of the global `/catalog` ingestion pipeline.

## Source and Data Ownership

- Structured collection datasets live under `data/<Game>/...` and follow the separated v2 `{ meta, items: [{ item, system }] }` contract in `data/AGENTS.md`.
- `wiki_pages` owns hub copy, controls, tips, metadata, and game identity.
- `wiki_collection_pages` owns collection page copy, route identity, display configuration, and publication state.
- Collection codes use `<game-slug>-<collection-slug>`; `wiki_slug` must use the editorial game slug, never a stats/universe slug.
- Roblox APIs may verify universe identity, metadata, and thumbnails. Collection item rows come from source research rather than assuming Roblox exposes a complete item endpoint.
- Flee the Facility's approved local datasets are `data/Flee the Facility/maps.json` and `data/Flee the Facility/beast-powers.json`; their exact row-level WebP assets live in `apps/web/public/Flee the Facility/Maps/` and `apps/web/public/Flee the Facility/Beast Powers/`. Hammers and gemstones remain research-only until a complete source-backed roster can be proven.

## Workflow

1. Research and approve the wiki hub or collection opportunity, production overlap, game identity, sources, scope, and route.
2. For a collection, gather the complete source-backed dataset and useful player fields.
3. Audit the v2 dataset and approve its rows/sections before collecting and wiring images.
4. Write the wiki or collection `final.json` only after the required research/data/image gates pass.
5. Seed into managed development and run `verify-wiki-final` or `verify-game-collection-finals` against the local web preview.
6. Review hub-to-collection navigation, item counts, cards/tables, images, metadata, structured data, search, sitemap, and revalidation behavior.
7. Promote through a controlled idempotent seed/upsert or forward-only migration, then verify production.

Use the matching wiki and game-collection workflow skills. For existing datasets, `bloxodes-game-collection-refresh` is the maintenance path for one collection, one game, or the registered collection set.

## Images and Renderer Readiness

Collection image manifests and local public assets are part of the data contract. A collection is not ready merely because its copy exists: every item count, image path, section, sort order, useful field, badge/subtitle/description mapping, pagination state, and responsive renderer must be checked.

Text-only rows are acceptable only when clean row-level media is unavailable and the decision is recorded in the owning dataset/documentation. Do not substitute unrelated crops, edited art, or generic game thumbnails for missing item images.

## Deployment Boundary

- Committed dataset or image changes require a web image deployment.
- `wiki_pages` and `wiki_collection_pages` copy can publish through controlled database writes plus revalidation.
- A wiki hub and its collections should be reviewed together when navigation, identity, collection registration, or shared game data changes.

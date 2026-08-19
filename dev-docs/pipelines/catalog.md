# Global Roblox Catalog Pipeline

Status: Active
Last verified: 2026-08-14
Evidence: `/catalog` route contracts, catalog/music/decal/free-item scripts, checked-in VPS schedules, local dataset ownership, and the latest production row-count sample

## Scope

This pipeline owns the global Roblox reference surfaces under `/catalog`. It is platform-wide data such as avatar/catalog items, music IDs, decal IDs, free items, promo rewards, admin-command references, colors, fonts, meshes, errors, and dictionary entries.

It does not own game-specific wiki collections. Those are children of a game wiki and are documented in `wiki-collections.md`, even when a renderer describes their item list as a catalog.

## Data Ownership

- `catalog_pages` stores global page copy, metadata, FAQ, and publication configuration. The latest verified production sample contained 63 page records.
- `roblox_catalog_items` stores the broad Roblox item corpus; the latest verified sample contained 69,370 rows.
- Music, decal, free-item, promo-reward, and item-stat domains use their dedicated tables and scripts rather than `wiki_collection_pages`.
- Some durable reference pages use committed datasets under `data/`, including Roblox colors, errors, dictionary terms, and admin-command source material. Follow `data/AGENTS.md` for their schema ownership.

## Collection and Refresh Jobs

- Global catalog discovery and enrichment live under `scripts/catalog/`.
- Music-ID collection, verification, ranking, and thumbnails live under `scripts/music/`.
- Decal-ID collection, candidate import, verification, ranking, and page seeding live under `scripts/decal-ids/`.
- Marketplace item statistics live under `scripts/items/` and share the public stats health model described in `stats.md`; they are not game collection content.
- VPS schedules run the production refreshes. Roblox-facing jobs share the `roblox-api` lock so catalog, item, music, decal, and related collectors do not create avoidable cross-pipeline throttling.

## Page Workflow

1. Research the global player need, production overlap, source/data availability, fields, and route behavior.
2. Use the catalog research/writing workflow for `catalog_pages` copy and metadata.
3. Validate the payload with `npm run verify:catalog-finals` against managed development.
4. Preview the actual `/catalog/<slug>` route, including metadata, structured data, tables, pagination, search, and useful fields.
5. Promote through a controlled idempotent seed/upsert or forward-only migration.
6. Revalidate the catalog path/index and verify the production page.

## Deployment Boundary

- Changes to committed datasets, public images, or renderers require a web image deployment.
- Database page copy or rows can publish through controlled database writes plus revalidation.
- Global catalog inputs must not be stored in rough `docs/` notes.

# Catalog and Collection Pipelines

Status: Active
Last verified: 2026-08-13
Evidence: scripts/manifests, production counts, data registry rules, and route contracts

## Global Roblox Catalog

- `roblox_catalog_items`: 69,370 rows at verification.
- `catalog_pages`: 63 published/configured page records.
- Scheduled VPS work covers bounded item discovery/enrichment, promo rewards, free-item candidates/refresh, music IDs, decal IDs, and item stats.
- Music IDs: 59,436 rows; decals: 38,430 rows at verification.
- Global page copy/metadata lives in Supabase; high-volume item rows live in their domain tables.

Roblox-facing scheduled jobs share the `roblox-api` lock to avoid cross-pipeline throttling.

## Game Collections

- Structured datasets live under `data/<Game>/...` and follow `data/AGENTS.md`.
- Page metadata/copy lives in `wiki_collection_pages` (439 rows at verification).
- Workflow order: research -> source-backed data -> image collection/wiring -> writing -> local seed/preview -> controlled production promotion.
- Collection codes use `<game-slug>-<collection-slug>`.
- Roblox APIs may verify identity/metadata/thumbnails, but item rows come from source research rather than assuming an API endpoint exists.

## Images

Collection image manifests and local public assets are part of renderer readiness. Verify every item count, path, useful card field, grouping, pagination, metadata, search, sitemap, and revalidation behavior before publication.

## Deployment Boundary

- Local dataset changes require a web image deploy.
- Database page copy can publish through controlled upserts/migrations and revalidation.
- Do not put machine-consumed source lists in rough `docs/` notes.

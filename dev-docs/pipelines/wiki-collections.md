# Game Wiki and Collection Pipeline

Status: Active
Last verified: 2026-09-01
Evidence: database-only web/mobile/tool loaders, immutable collection runtime tables, sync/readback scripts, managed-development and production parity audit, route tests, and production row counts

## Scope

Game wiki hubs and their game-specific collections are one editorial/data unit:

- `/wiki/<game-slug>` is backed by `wiki_pages`.
- `/wiki/<game-slug>/<collection-slug>` is backed by `wiki_collection_pages`, its `published_dataset_id`, `wiki_collection_datasets`, and `wiki_collection_items`.
- The verified production database contains 663 published collection pages with valid dataset pointers and 46,732 published item rows.

These collections describe one game's durable systems and items—pets, weapons, crops, locations, NPCs, recipes, mutations, progression systems, and similar player-facing sets. They are not part of the global `/catalog` ingestion pipeline.

## Source and Data Ownership

- Supabase is the only runtime source for collection page copy, display metadata, immutable dataset revisions, item rows, and media keys. Web, mobile, tools, sitemaps, and related-content loaders do not read collection JSON from the repository.
- Repository game-collection and quiz datasets are retired. Existing collection work starts by exporting the published database revision to `tmp/content-workspace/<game-slug>/collections/<collection-slug>/`; new work creates the same ignored workspace contract. Each collection workspace owns `dataset.json`, `media/`, `final.json`, and `runtime-manifest.json` until an immutable database/R2 revision is published.
- `wiki_pages` owns hub copy, controls, tips, metadata, and game identity.
- `wiki_collection_pages` owns collection page copy, route identity, display configuration, and publication state.
- Collection codes use `<game-slug>-<collection-slug>`; `wiki_slug` must use the editorial game slug, never a stats/universe slug.
- Roblox APIs may verify universe identity, metadata, and thumbnails. Collection item rows come from source research rather than assuming Roblox exposes a complete item endpoint.

## Workflow

1. Research and approve the wiki hub or collection opportunity, production overlap, game identity, sources, scope, and route.
2. For an existing collection, export its published database revision with `npm run export:game-collection-workspace`; for a new collection, create the same ignored workspace and runtime manifest. Gather the complete source-backed dataset and useful player fields there.
3. Audit the v2 dataset and approve its rows/sections before collecting and wiring images.
4. Write the wiki or collection `final.json` only after the required research/data/image gates pass.
5. Synchronize the approved page and immutable dataset revision from its explicit runtime manifest into managed development, publish its dataset pointer there, then run `verify-wiki-final` or `verify-game-collection-finals` against the managed-development web preview.
6. Review hub-to-collection navigation, item counts, cards/tables, images, metadata, structured data, search, sitemap, and revalidation behavior.
7. Promote through a controlled idempotent seed/upsert or forward-only migration, then verify production.

Use the matching wiki and game-collection workflow skills. For existing datasets, `bloxodes-game-collection-refresh` is the maintenance path for one collection, one game, or the registered collection set.

## Scheduled Top-100 Automation

- The homelab daily runner reads the exact production top 100 from `/api/stats/games`, excludes production wiki coverage and every durable queue result, and enqueues the highest-ranked remaining universe in managed development.
- One restricted Codex process runs collection suggestions, parent approval, each approved collection workflow, and the wiki workflow. It must produce a verified hub and at least one source-complete collection; otherwise the queue row is recorded as blocked rather than padded with guessed data.
- All authoring artifacts stay under ignored `tmp/wiki-automation/<queue-id>/`. Runtime publication uses explicit manifests with `sync-game-collection-runtime.ts` and `sync-game-wiki-runtime.ts`; no collection dataset or quiz payload is registered in code.
- The scheduled service uploads shared R2 media and publishes only to managed development, then records `managed_dev_ready`. Production release remains a separate reviewed operation.
- The wiki and article agents share one host lock. The daily wiki timer is persistent, and readiness retries transient managed-development, R2, and public API failures before failing the unit.

## Images and Renderer Readiness

Collection image manifests are authoring inputs. Runtime item media is stored by immutable R2 object key in `wiki_collection_items` and served through the wiki-media worker. A collection is not ready merely because its copy exists: every item count, media key, section, sort order, useful field, badge/subtitle/description mapping, pagination state, and responsive renderer must be checked.

Readable source-provided item names or labels baked into an otherwise valid row image are acceptable. Do not reject an exact item image solely because the source includes the item name; provenance and reuse concerns should be recorded separately in the collection brief.

Text-only rows are acceptable only when clean row-level media is unavailable and the decision is recorded in the owning dataset/documentation. Do not substitute unrelated crops, edited art, or generic game thumbnails for missing item images.

## Deployment Boundary

- Collection row, display, and media changes publish through a new immutable database revision, pointer update, and revalidation. They do not require the web container to read repository data or public collection assets.
- `wiki_pages` and `wiki_collection_pages` copy publish through controlled database writes plus revalidation.
- A wiki hub and its collections should be reviewed together when navigation, identity, collection registration, or shared game data changes.

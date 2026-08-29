# Game Wiki and Collection Pipeline

Status: Active
Last verified: 2026-08-29
Evidence: wiki route/data contracts, workflow skills, game collection registry and v2 dataset rules, seed/verification scripts, and the latest production row-count sample

## Scope

Game wiki hubs and their game-specific collections are one editorial/data unit:

- `/wiki/<game-slug>` is backed by `wiki_pages`.
- `/wiki/<game-slug>/<collection-slug>` is backed by `wiki_collection_pages`, an immutable published revision in `wiki_collection_datasets`, and normalized rows in `wiki_collection_items`.
- The 2026-08-27 production migration inventory contains 622 published wiki collection pages backed by registered v2 datasets; five registered collections without approved published page rows remain intentionally excluded.

These collections describe one game's durable systems and items—pets, weapons, crops, locations, NPCs, recipes, mutations, progression systems, and similar player-facing sets. They are not part of the global `/catalog` ingestion pipeline.

## Source and Data Ownership

- New collection work uses a task-local v2 `{ meta, items: [{ item, system }] }` dataset and `runtime-manifest.json`. The guarded sync normalizes that dataset into Supabase; the task files are migration inputs, not production runtime files.
- Compatibility files remain only for games not yet cleared through the database-only gate. The first completed cleanup covers 152 collections and 10,574 rows across `1-speed-keyboard-escape`, `99-nights-in-the-forest`, `brookhaven-rp`, `dress-to-impress`, `grow-a-garden`, `jujutsu-shenanigans`, `murderers-vs-sheriffs`, `rivals`, `sell-lemons`, `slime-rng`, `survive-zombie-arena`, `the-forge`, and `wizard-alchemy`.
- Those 13 groups are hard-coded database-only. Their generic, specialized, mobile, image, Forge, Grow a Garden, and Wizard Alchemy tool consumers fail fast when a published revision is unavailable. Refreshes use task-local datasets and runtime manifests; they do not recreate `data/<Game>/`.
- `wiki_pages` owns hub copy, controls, tips, metadata, and game identity.
- `wiki_collection_pages` owns collection page copy, route identity, publication state, and the `published_dataset_id` pointer.
- `wiki_collection_datasets` owns immutable content-addressed revisions and their validation/source manifests. `wiki_collection_items` owns normalized item rows and R2 object metadata. Only the service role can read or write these runtime tables; public routes load them on the server.
- Collection codes use `<game-slug>-<collection-slug>`; `wiki_slug` must use the editorial game slug, never a stats/universe slug.
- Roblox APIs may verify universe identity, metadata, and thumbnails. Collection item rows come from source research rather than assuming Roblox exposes a complete item endpoint.
- Flee the Facility's approved local datasets are `data/Flee the Facility/maps.json` and `data/Flee the Facility/beast-powers.json`; their exact row-level WebP assets live in `apps/web/public/Flee the Facility/Maps/` and `apps/web/public/Flee the Facility/Beast Powers/`. Hammers and gemstones remain research-only until a complete source-backed roster can be proven.
- Blade Ball is a hub-only game group with zero registered collections (`collections: []`). Sword Skins, Explosion Skins, Emotes, and Maps are blocked because independent current-complete roster proof was unavailable after the 2026-08-23 Roblox experience update; Abilities is blocked because its roster conflict remains unresolved.

### Managed-development database/R2 canary

The 2026-08-27 canary began with Flee the Facility Beast Powers and The Forge Ores, then expanded to every published managed-development page: 184 published pointers and immutable revisions, 12,354 rows, and 9,225 R2 images. Representative generic, Grow-a-Garden-era, Forge, and recent collection routes passed in `database-only` mode while all collection and related-card media resolved through canonical `media.bloxodes.com/wiki/*` URLs. A required but unmigrated collection returned a hard 500 with local fallback disabled, confirming that the strict canary cannot silently read `data/`.

## Workflow

1. Research and approve the wiki hub or collection opportunity, production overlap, game identity, sources, scope, and route.
2. For a collection, gather the complete source-backed dataset and useful player fields in its content workspace.
3. Audit the v2 dataset and approve its rows/sections before collecting and wiring images.
4. Write the wiki or collection `final.json` only after the required research/data/image gates pass.
5. Build the collection runtime manifest. Dry-run `sync:game-collection-runtime`, then upload content-addressed media once to `bloxodes-wiki`, insert the immutable revision in managed development, verify every object/row, and publish the page pointer.
6. Run `verify-wiki-final` or `verify-game-collection-finals` against the local web preview.
7. Review hub-to-collection navigation, item counts, cards/tables, images, metadata, structured data, search, sitemap, and revalidation behavior.
8. Before deleting any local compatibility file, inventory every web, mobile, tool, quiz, report, and script consumer. Migrate or explicitly retain each consumer and run output-parity checks against the published revision.
9. After explicit approval, run the same manifest against production. Existing shared R2 objects are verified rather than uploaded again. Production row verification must pass before the single published pointer changes.

Use the matching wiki and game-collection workflow skills. For existing datasets, `bloxodes-game-collection-refresh` is the maintenance path for one collection, one game, or the registered collection set.

### Homelab top-100 automation

`wiki_generation_queue` is the managed-development control plane for unattended top-100 coverage. The temporary continuous runner uses two database-enforced processing slots with renewable, token-bound leases. Each free lane claims the next universe immediately after its prior game reaches a durable result. Selection uses the live production top-100 playing order and published editorial inventory; it does not use the older six-hour-growth scout or local progress Markdown. One permanent queue row per universe prevents repeated work, while evidence-blocked games remain terminal and let the next rank proceed. The runtime can be reduced to one lane through `WIKI_AUTOMATION_CONCURRENCY=1` without changing the database contract.

The Luna Max parent runs collection suggestions first, approves only evidence-complete `[create]` decisions, delegates each collection through research/data/images/writing, then runs the wiki hub workflow. New output stays task-local and publishes to managed-development database/R2 without registry, `data/`, or public-media changes. The runner validates exact identity and artifact containment and records `managed_dev_ready`. A separate reviewed release publishes those exact manifests and the hub final to production, so release failures do not rerun research.

## Images and Renderer Readiness

Collection image manifests and task-local media are part of the authoring contract. Managed development and production share `bloxodes-wiki` and use `media.bloxodes.com/wiki/<object-key>` through the read-only Worker. Object keys are content-addressed by universe, collection, item slug, and SHA-256 prefix. Uploading an object does not publish its page. Each database controls publication through its own `published_dataset_id`. A collection is not ready merely because its copy exists: every item count, image key or documented text-only exception, section, sort order, useful field, badge/subtitle/description mapping, pagination state, and responsive renderer must be checked.

Text-only rows are acceptable only when clean row-level media is unavailable and the decision is recorded in the owning dataset/documentation. Do not substitute unrelated crops, edited art, or generic game thumbnails for missing item images.

Readable source-provided item names or labels baked into an otherwise valid row image are acceptable. Do not reject an exact item image solely because the source includes the item name; provenance and reuse concerns should be recorded separately in the collection brief.

## Deployment Boundary

- New database/R2 collection content does not require a Git commit or web deployment.
- The Worker, schema, server loader, and tooling are deployed infrastructure. Collection revisions publish through controlled R2/database writes plus the existing revalidation event.
- `WIKI_COLLECTION_DATA_SOURCE=database-first` remains the compatibility posture for unmigrated groups. Built-in database-only groups and exact codes in `WIKI_COLLECTION_DATABASE_REQUIRED_CODES` always fail fast instead of using local datasets; global `database-only` disables every compatibility fallback.
- Wiki hub and mobile preview images use the published revision's R2 keys when available, then fall back to local dataset images during migration.
- `database-only` must not be enabled and local shared datasets must not be deleted until the tool-consumer parity gate above passes.
- A wiki hub and its collections should be reviewed together when navigation, identity, collection registration, or shared game data changes.

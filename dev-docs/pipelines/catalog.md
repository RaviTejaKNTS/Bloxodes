# Global Roblox Catalog Pipeline

Status: Active
Last verified: 2026-08-29
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
- Game-specific Music ID and Decal ID associations are refreshed by `scripts/catalog/sync-game-specific-id-sources.ts` and seeded into the dedicated game-usage tables. Music refreshes combine official Roblox Music Discovery associations with dedicated game-wiki parsers for 3008, Retail Tycoon 2, and Nico's Nextbots where the official feed is sparse or empty. The source file supports `--only-music-game <slug>` for a bounded experience-song refresh when another source is unavailable; source association and in-game compatibility remain separate evidence levels.
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

## Roblox emote IDs and commands

Last verified: 2026-09-15 (managed-development schema, data readback, route verifier, and rendered HTML/metadata QA; production publication is pending).

- `/catalog/roblox-items-and-bundles/roblox-emotes` owns Marketplace emote IDs, prices, creators, images, search, filters, and pagination. Its H1 is `Roblox Emote IDs`. The legacy `/catalog/roblox-emotes` redirect remains.
- `/catalog/roblox-emote-commands` owns the separate chat-command intent. Its primary section renders compact copyable command cards before supporting content. It has its own metadata, canonical, WebPage, ItemList, breadcrumb schema, comments, sitemap entry, and catalog revalidation path. Catalog pages are not added to the article RSS feed.
- Marketplace facts and thumbnails remain in `roblox_catalog_items` and `roblox_catalog_item_images`. Discovery stays with `collect:avatar-animation-items` scoped to `EmoteAnimations`, and existing queue/enrichment jobs retain ownership. Bounded discovery cannot prove a complete Marketplace census; missing search results do not establish deletion.
- `roblox_emote_commands` stores reviewed command references, requirements, source URLs, evidence method, verification date, and publication state. It has RLS and server-only grants. The public roster initially contains only the seven defaults listed by current Roblox Support documentation. Additional historical references remain unpublished until current behavior is verified. Migration `20260915045100_add_roblox_emote_commands.sql` created the table in managed development; `20260915061528_retarget_emote_command_revalidation.sql` moves its trigger to the dedicated page. Production application must precede deploying the reader.
- `data/roblox-emotes/commands.json` is reviewed seed input, never a runtime fallback. `npm run seed:emote-commands` validates without writes; `--apply` upserts changed rows only. It defaults to managed development; production additionally requires `--allow-prod`. Missing references are not deleted automatically. Page copy still uses `seed:catalog-pages`.
- Marketplace item names are never converted into commands. Item IDs identify listings and are not accepted as `/e` arguments. Numbered wheel-slot syntax and historical named commands stay out of the initial public roster because they lack the same current primary-source confidence.
- `npm run audit:emote-commands -- --baseline <inventory.json>` is read-only and writes `tmp/emotes/coverage.json`, including published references, linked Marketplace rows, duplicate-name groups, missing thumbnails, and items absent from an optional earlier inventory. It does not create command candidates.
- Statement triggers on command changes enqueue `roblox-emote-commands`. Item names, prices, and thumbnails retain the avatar-catalog triggers for the separate IDs route.
- September 15 evidence boundary: source review supports the seven default commands. No original motion previews or in-game validation were completed, so the page does not promise universal experience compatibility or publish additional named commands.

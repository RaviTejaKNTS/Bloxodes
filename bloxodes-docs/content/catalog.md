# Catalog

Last verified: 2026-10-30

Global Roblox reference pages at `/catalog/<slug>`: item IDs, music IDs, decals, emotes, admin commands, color codes, error codes, the Roblox dictionary and more. Game-specific item lists are wiki collections, not catalog pages.

## Pages

- **Skills:** `bloxodes-catalog-workflow-runner`, `bloxodes-catalog-research`, `bloxodes-catalog-writing`. Made by hand when the owner asks.
- **Data:** `catalog_pages` holds copy, metadata and publication. 76 rows, 72 published on 2026-10-19.
- **Publish:** the `catalog` publisher (`seed:catalog-pages`, `verify:catalog-finals`). Copy-only changes publish through GitHub; renderer or data-file changes need a web deploy.

Each page's loader combines its copy with live database data or a small committed reference file.

- **Music, decal and mesh IDs fail closed.** Runtime database failures propagate instead of becoming empty 200s or false 404s. The unfiltered main lists and daily top 500 also reject unexpectedly empty data. Failed ISR regeneration preserves an existing good page; cold renders can still fail. Music, decal and mesh loaders return an empty list only while `next build` runs (`NEXT_PHASE=phase-production-build`), so an empty managed-development table never fails a build. Their browser APIs return 503 with `Cache-Control: no-store`. Proven positive-offset exhaustion preserves the exact total, and paginated HTML returns 404 beyond its last page. Empty filtered searches remain valid. Avatar marketplace and free items still return empty data on errors.
- **Catalog HTML is keyed by path.** Music/decal game pages and mesh pages keep six-hour ISR and seed the default list. Their Suspense client browsers apply URL search and sorting through the APIs. Game mapping presence is checked before search, eligibility and pagination; only a successful empty mapping lookup selects the preset fallback. Texture eligibility and deterministic sort order stay aligned between HTML and APIs.
- **Catalog filters and page-one navigation.** Music, decal and mesh browsers update base-path Apply/Clear filters through Next's native History API integration. From numbered pages, those controls load the first-page document to refresh server props. Their Prev and numbered 1 links also load the document whenever the destination is page one, preserving query and sort; links to pages two and above retain Next Link. These document boundaries avoid Next 16.2 reusing a cached first-page canonical URL with prior filters. Query-only history does not invalidate that cache entry. Returning to page one remounts the page shell and ads. Other pagination consumers retain their existing navigation.
- **Retired game music page.** `/catalog/roblox-music-ids/games/work-at-a-pizza-place` had only 1 song tied to the game, so it 308-redirects (with sub-paths) to `/catalog/roblox-music-ids`. Its `catalog_pages` row is still published, so `isRetiredMusicGameCatalogCode` and `isRetiredMusicGameCatalogUrl` in `game-specific-id-pages.ts` hide it from the sitemap, catalog listings, stats links, editorial inventory and site search. The homepage catalog count still includes it.
- **Publication dates stay put.** `seed:catalog-pages` keeps the existing `published_at` for rows that are already published, so a copy fix doesn't move `datePublished`.
- The catalog sitemap keeps the database `lastmod` for the core catalog paths.

## Data behind the pages

| Data | Source | Refresh |
| --- | --- | --- |
| Marketplace items, free items, promo rewards, music and decal IDs | `roblox_*` tables | VPS cron. See [data refreshes](data-refreshes.md). |
| Emote commands | `roblox_emote_commands`, seeded from `data/roblox-emotes/commands.json` | By hand: `seed:emote-commands`, `audit:emote-commands`. |
| Fonts and meshes | `roblox_font_ids`, `roblox_mesh_ids` | By hand: `collect:font-ids`, `collect:mesh-ids`. |
| Admin commands, color codes, error codes, dictionary | `data/Admin commands/*.md`, `data/Color Codes/`, `data/roblox-errors/`, `data/roblox-dictionary/` | By hand, shipped with web deploys. |

Emote commands come from verified sources, never from Marketplace names.

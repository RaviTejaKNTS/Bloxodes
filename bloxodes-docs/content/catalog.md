# Catalog

Last verified: 2026-11-16

Global Roblox reference pages at `/catalog/<slug>`: item IDs, music IDs, decals, emotes, admin commands, color codes, error codes, the Roblox dictionary and more. Game-specific item lists are wiki collections, not catalog pages.

## Pages

- **Skills:** `bloxodes-catalog-workflow-runner`, `bloxodes-catalog-research`, `bloxodes-catalog-writing`. Made by hand when the owner asks.
- **Data:** `catalog_pages` holds copy, metadata and publication. 76 rows, 72 published on 2026-10-19.
- **Publish:** the `catalog` publisher (`seed:catalog-pages`, `verify:catalog-finals`). Copy-only changes publish through GitHub; renderer or data-file changes need a web deploy.

Each page's loader combines its copy with live database data or a small committed reference file.

- **Music, decal and mesh IDs fail closed.** Runtime database failures propagate instead of becoming empty 200s or false 404s. The unfiltered main lists and daily top 500 also reject unexpectedly empty data. Failed ISR regeneration preserves an existing good page; cold renders can still fail. Music, decal and mesh loaders return an empty list only while `next build` runs (`NEXT_PHASE=phase-production-build`), so an empty managed-development table never fails a build. Their browser APIs return 503 with `Cache-Control: no-store`. Proven positive-offset exhaustion preserves the exact total, and paginated HTML returns 404 beyond its last page. Empty filtered searches remain valid. Avatar marketplace and free items still return empty data on errors.
- **Catalog HTML is keyed by path.** Music/decal game pages and mesh pages keep six-hour ISR and seed the default list. Their Suspense client browsers apply URL search and sorting through the APIs. Game mapping presence is checked before search, eligibility and pagination; only a successful empty mapping lookup selects the preset fallback. Texture eligibility and deterministic sort order stay aligned between HTML and APIs.
- **Catalog filters and page-one navigation.** Music, decal and mesh browsers update base-path Apply/Clear filters through Next's native History API integration. From numbered pages, those controls load the first-page document to refresh server props. Their Prev and numbered 1 links also load the document whenever the destination is page one, preserving query and sort; links to pages two and above retain Next Link. These document boundaries avoid Next 16.2 reusing a cached first-page canonical URL with prior filters. Query-only history does not invalidate that cache entry. Returning to page one remounts the page shell and ads. Other pagination consumers retain their existing navigation.
- **Retired game music page.** `/catalog/roblox-music-ids/games/work-at-a-pizza-place` had only 1 song tied to the game, so it 308-redirects (with sub-paths) to `/catalog/roblox-music-ids`. Its `catalog_pages` row is still published, so `isRetiredMusicGameCatalogCode` and `isRetiredMusicGameCatalogUrl` in `game-specific-id-pages.ts` hide it from the sitemap, catalog listings, stats links, editorial inventory, site search and the homepage catalog count (`RETIRED_MUSIC_GAME_CATALOG_CODES`).
- **Publication dates stay put.** `seed:catalog-pages` keeps the existing `published_at` for rows that are already published, so a copy fix doesn't move `datePublished`.
- The catalog sitemap keeps the database `lastmod` for the core catalog paths.
- **Title counts are live.** `catalogTitleCount` (`apps/web/src/lib/catalog-title-count.ts`) replaces the count in a saved title with the page reader's live total: exact below 1,000, otherwise rounded down to thousands with `K+` (38,657 becomes `38K+`). It only touches a count inside `[...]` or `(...)` with list wording, or a leading `N`/`N+` before "Roblox ...". Years, dates, `Page N` and numbers in names (`3008`, `Murder Mystery 2`, `Color3`) stay. An unknown or zero total keeps the saved title. So write titles with a count, and don't edit them just to refresh the number.
- **Music chart pages** (`/catalog/roblox-music-ids/trending` and the weekly, monthly and yearly charts) are titled as song charts ("Top 500 Trending Roblox Songs Today"), not as music ID lists, so they don't compete with `/catalog/roblox-music-ids` in search. Each links to the full list with the anchor "Roblox music IDs" and has no ` | Bloxodes` title suffix.
- **Every catalog page has an image.** `resolveCatalogImage` (`apps/web/src/lib/catalog-image.ts`) gives the social preview and the `/catalog` card one image: a saved `thumb_url` wins, otherwise a generated 1200x630 PNG at `/catalog-image/<code>.png`. Game pages (`roblox-music-ids/games/*`, `roblox-decal-ids/games/*`) use the game's official universe thumbnail; item pages (items and bundles, decals, free items) show up to 6 of the page's own first item thumbnails; the rest get a title card. Database failures make the route return an uncached 500; a missing row or malformed code is an uncached 404. Only Roblox CDN thumbnails are fetched (HTTPS, no redirects, size-capped), and a failed thumbnail just leaves it out.

## Data behind the pages

| Data | Source | Refresh |
| --- | --- | --- |
| Marketplace items, free items, promo rewards, music and decal IDs | `roblox_*` tables | VPS cron. See [data refreshes](data-refreshes.md). Decal discovery health is the `decal_ids_refresh` row in `stats_job_runs`; `first_seen_at` is discovery, `verified_at` is only the recheck. |
| Emote commands | `roblox_emote_commands`, seeded from `data/roblox-emotes/commands.json` | By hand: `seed:emote-commands`, `audit:emote-commands`. |
| Fonts and meshes | `roblox_font_ids`, `roblox_mesh_ids` | By hand: `collect:font-ids`, `collect:mesh-ids`. |
| Admin commands, color codes, error codes, dictionary | `data/Admin commands/*.md`, `data/Color Codes/`, `data/roblox-errors/`, `data/roblox-dictionary/` | By hand, shipped with web deploys. |

Emote commands come from verified sources, never from Marketplace names.

Data-backed pages read their date from `catalog_pages_view.content_updated_at`; curated decals and music charts read their own `catalog_membership_snapshots` date. A scheduled job moves these dates when items are added or removed. See [catalog page dates](data-refreshes.md#catalog-page-dates).

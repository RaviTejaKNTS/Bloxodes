# Local Data Guide

Scope: `data/` plus related static data under `src/data/`.

Environment boundaries and database-vs-dataset ownership are documented in `dev-docs/data/data-environments.md`. Global `/catalog` data belongs to `dev-docs/pipelines/catalog.md`; game wiki hubs and their game-specific collection datasets belong together in `dev-docs/pipelines/wiki-collections.md`.

When dataset ownership or a consuming pipeline changes, update that existing canonical file or the owning existing pipeline document in the same change. Do not create a replacement current-state doc.

The documented files below back only file-driven tools and catalog sections that are not modeled in Supabase. Existing game-collection JSON and `quiz.json` files are inert archives pending explicit deletion approval; they are not authoring or runtime inputs. Public wiki collections, collection-backed tools, mobile collection APIs, sitemaps, and quizzes read Supabase only; temporary collection authoring belongs under ignored `tmp/content-workspace/`.

When turning a game dataset into public wiki or collection pages, use `agents/content-writing/agents.md` and the matching wiki or game collection skill. Use `bloxodes-game-collection-refresh` when checking and refreshing one existing collection dataset, one game's collection datasets, or every registered game collection.

## Dataset Map

- `apps/web/src/data/reports/roblox-june-2026.ts`
  - Frozen stats, event annotations, and attributable news context for the public June 2026 Roblox monthly report.
  - Its `featureImage` configuration drives the static, data-backed archive and social image at `apps/web/public/images/reports/roblox-june-2026.png`.
  - The published `/stats/reports/roblox-june-2026` route is indexed through the Stats sitemap and linked from the Stats home and RSS feed.
- `data/Admin commands/*.md`
  - Parsed by `src/lib/admin-commands.ts`.
  - Used by catalog admin-command routes.
- `data/game-specific-ids/source-backed.json`
  - Generated audio and decal associations used to seed the game-specific Music IDs and Decal IDs pages. Music associations use official Roblox Music Discovery where available and dedicated game-wiki parsers for 3008, Retail Tycoon 2, and Nico's Nextbots where that feed is sparse or empty. Refresh through `npm run sync:game-specific-id-sources`, review the diff, then dry-run and run `npm run seed:game-specific-id-usage -- --replace-source-rows` against managed Supabase development so stale rows from the same source are removed. Use `npm run sync:game-specific-id-sources -- --only-music-game <slug>` for a bounded experience-song refresh that preserves other generated groups when an unrelated source is unavailable.
  - Preserve source URL, checked time, use type, and compatibility status. A source-listed row is not an in-game verification result.
- `data/Color Codes/roblox-color-codes.json`
  - Color code catalog for the color-code pages.
- `data/decal-ids/*`
  - Decal ID datasets produced by the scrape/enrich scripts.
- `data/roblox-errors/roblox-errors.json`
  - Roblox error reference data behind `/catalog/roblox-errors-and-fixes`.
  - Loaded by `apps/web/src/app/(site)/catalog/roblox-errors-and-fixes/page-data.tsx`. `articleSlug` links a card to its `/articles/<slug>` fix guide; `surface` must match a section in that route's `ERROR_SECTIONS`.
- `data/roblox-dictionary/roblox-dictionary.json`
  - Source-backed Roblox slang, acronym, platform, creator, and legacy terminology behind `/catalog/roblox-dictionary`.
  - Keep definitions and examples original, retain per-term source URLs and verification dates, mark retired language as `legacy`, and never add filter-bypass, exploit, scam, or off-platform contact instructions.
- `src/data/slug_oldslugs.json`
  - Legacy slug redirect map for the public fallback route.

## Rules

- Treat local data files as content sources, not ad hoc dumps. Keep filenames and object shapes stable once routes depend on them.
- Routine collection refresh scope is limited to registered game collection config and datasets that already exist. Unregistered v2-shaped files are outside this fast refresh and require an explicit collection-creation or discovery workflow. Non-collection files are outside the collection refresh workflow.
- Game wiki collection datasets must use the v2 separated shape: `{ "meta": {...}, "items": [{ "item": {...}, "system": {...} }] }`.
- In v2 game collection datasets, `items[].item` is public game data only. Do not put `collectionSection`, `section`, `sortOrder`, `slug`, `image`, source URLs, source pages, verification notes, raw text, image status, or workflow/debug fields there.
- In v2 game collection datasets, `items[].system` may contain only `slug`, `section`, `sortOrder`, and `image`. Use these for Bloxodes routing, grouping, ordering, and image rendering without interfering with real game fields that may have similar names.
- `meta.display` owns the public render contract for game collections: `groupLabel`, `sectionOrder`, `tableFields`, `cardFields`, optional badge/subtitle/description fields, and `fieldPresentation`. Every display field must exist in `meta.itemFields` and in public item data.
- Run `npm run audit:game-collection-datasets:v2 -- --game <game-slug> --collection <collection-slug> --file <workspace>/dataset.json` before reviewing any game collection page.
- For wiki/collection datasets, include source-backed fields players need, such as prices, currencies, shops, requirements, damage, chances, upgrade paths, locations, roles, limits, and availability when those facts drive decisions.
- When changing a dataset, update the parser/helper in `src/lib/*` or the route-family helper in `src/app/(site)`.
- If a dataset powers a public route, verify SEO text, pagination, and revalidation behavior still make sense after the change.
- Before importing quiz data, validate the `QuizData` shape, difficulty counts, option IDs, and answer IDs. Then verify the saved `quiz_pages.quiz_data` readback and rendered `/quizzes/<slug>` page.
- If a new dataset becomes long-lived, document it in `agents/data/agents.md`.
- Do not store manual active-code lists, expired-code lists, code dates, or code rewards in `data/`. Code data belongs to the source-driven codes refresh workflow.

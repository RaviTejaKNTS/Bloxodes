# Scripts Guide

Scope: `scripts/`.

These files are operational jobs, imports, backfills, collectors, and automation workers. Many are side-effectful.

## Default Rules

- Prefer the stable `package.json` alias when one exists.
- Keep shared helpers in `scripts/shared/`.
- Group new scripts by task area instead of adding everything at the top level.
- Document required env vars and downstream side effects when introducing a new script.
- For script env loading, prefer `scripts/shared/load-env.ts` instead of importing `dotenv/config` directly.

## Folder Map

- `ads/`: build-time ad and policy helpers.
- `articles/`: article generation and article refresh.
- `automation/`: queue runners, IndexNow/bootstrap helpers, Google Indexing API submitter, cache warming, reporting.
  - `google-indexing-submit.ts` is a guarded Google Indexing API job. It loads `.env.indexing*`, requires `--apply` plus `GOOGLE_INDEXING_API_ENABLED=true` before calling Google, and should use Supabase state in recurring production/GitHub runs so the daily cap and URL rotation persist.
  - `warm-cloudflare-cache.mjs` warms public pages from the sitemap after deploy. Default `CACHE_WARM_MODE=deploy` warms the sitemap files, main/index/legal pages, all wiki/catalog/tool URLs, and a recent slice from DB-backed detail sitemaps. Use `CACHE_WARM_MODE=full` only for an intentional full-site warm. Use `CACHE_WARM_DRY_RUN=true` to inspect selection without page requests. Do not send cache-bypass request headers because the goal is to fill Cloudflare.
  - `audit-sitemap-seo.ts` crawls the sitemap index, checks each page response, and writes SEO/indexability reports to `tmp/seo-audits/`. It is read-only, uses live HTTP requests only, and can be limited with `npm run audit:seo -- --limit 100` for smoke tests.
  - `enqueue-revalidation-events.ts` inserts coalesced rows into `revalidation_events` for the Supabase revalidation worker. Use `npm run enqueue:revalidation -- --event stats:stats --event stats:games` for script/workflow-driven events that should follow the same queue as table triggers.
- `backfill/`: repair jobs for existing content/data.
- `catalog/`: Roblox item and bundle collection plus enrichment.
  - Broad Roblox Marketplace collectors write to `roblox_catalog_items` and enqueue `roblox_catalog_refresh_queue`. Use `npm run collect:catalog-items` for accessories, body, clothing, avatar animations, and makeup. The live Roblox catalog search API only accepts `limit` values `10`, `28`, or `30`; keep collectors clamped to those values. Bundle-returning categories such as full bodies, shoes, and animation bundles must preserve `item_type = 'Bundle'` so the enrichment job can request bundle thumbnails.
  - `collect-roblox-makeup-items.ts` discovers Makeup items through keyword searches and filters asset type IDs `76`, `77`, `88`, `89`, and `90`, because Makeup is not exposed in the normal category list.
  - `enrich-roblox-catalog-items.ts` refreshes metadata/history and caches thumbnails. It must call the asset thumbnail endpoint for assets and the bundle thumbnail endpoint for bundles.
  - `collect-slime-rng-data.ts` collects Slime RNG wiki source data into `data/Slime RNG/` and downloads available source images into `apps/web/public/Slime RNG/`. It is a local dataset collector and does not mutate Supabase.
  - `seed-game-catalog-pages.ts` upserts local game dataset collection copy into `wiki_catalog_pages`; use `--dry-run` before writing and `--draft` when pages should stay unpublished. Pass `--final-json-root tmp/content-workspace/<game-slug>/catalogs` when approved per-page `final.json` files should override generated copy during local review/import. The script accepts both the new game-first `<collection-slug>/final.json` layout and older `<catalog-code>/final.json` folders.
  - `seed-catalog-pages.ts` upserts reviewed broad `/catalog` page `final.json` rows into `catalog_pages`; use `--dry-run` before writing and `--draft` when pages should stay unpublished. Content rows should be local-db imports first, not schema migrations.
  - `seed-game-wiki-pages.ts` upserts game hub rows into `wiki_pages` and links them to matching `roblox_universes`; use `--dry-run` before writing and `--draft` when pages should stay unpublished.
  - Both seed scripts accept `--game <slug>` for narrow production publishes. Catalog seeding also accepts `--collection <slug>` for single-page retries.
  - For production runs, use `NODE_ENV=production` plus `--allow-prod` only after a clean production dry-run. Confirm the scripts are targeting the production Supabase host, not local Supabase.
  - For wiki/catalog production publishes, confirm the production `roblox_universes` row exists first. If it is missing, collect/import/enrich the universe before seeding `wiki_pages` or `wiki_catalog_pages`.
  - Before writing production wiki/catalog rows, read existing production `wiki_pages` and `wiki_catalog_pages` rows for the target game/code so you know whether this is a create or update and can catch duplicates or wrong slugs.
  - Publish game wiki/catalog pages in order: universe first when needed, `seed-game-wiki-pages` second, production wiki readback third, `seed-game-catalog-pages` last so catalog rows can link to the production `wiki_page_id`.
  - After DB publish, push/deploy only the current game's repo artifacts required by the pages: `data/<Game>/`, `apps/web/public/<Game>/`, game dataset config/rendering code, and approved seed-script changes for that game. Do not include unrelated docs, other game data, temporary workspace files, or unrelated code in the game release commit.
  - Do not manually enqueue revalidation by default after wiki/catalog production publishes. The app/database revalidation path should handle it; poll live pages for up to 5 minutes, then inspect the queue/worker if pages are still stale.
  - A wiki/catalog production publish is not complete until the live production wiki and catalog URLs return 200 and render the expected title, content, data, and images. If live routes or images 404, check whether the production deploy includes the route/config changes, `data/<Game>/`, and `apps/web/public/<Game>/`.
  - Scripts that match against `roblox_universes` must page through production rows explicitly; do not assume the default Supabase result limit is enough.
  - Keep reusable seed/upsert scripts for repeated wiki/catalog work. Delete temporary collector/import scripts after their data is stable and committed.
- `content/`: local content QA helpers.
  - `check-public-copy.ts` blocks self-referential public copy such as `Use the X catalog`, `this catalog`, `dataset`, and `Bloxodes`, weak field-command copy such as `Read category first`, and AI-ish contrast filler such as `not just`; run it against generated `final.json` files before local Supabase import.
  - `import-content-final.ts` upserts reviewed article, checklist, and quiz `final.json` files into Supabase. Article imports write only to the `articles` table, pick a random author when missing, create an edited 16:9 cover from the linked Roblox universe thumbnail when no cover image is provided, and inject the feature image before the first H2 like generated articles. After article imports, verify both `/articles` and `/articles/<slug>` show the same title, author, and cover from the saved article row. It is local-first by default and refuses production writes unless `NODE_ENV=production` is paired with `--allow-prod`.
- `codes/`: code refresh and code-article rewrite jobs.
  - Code rows must come from `scripts/codes/update-codes.ts`, not from manual JSON, SQL, Supabase edits, or hand-written script payloads.
  - For a code page, insert or update the `games` row first: `slug` is the editorial game slug only, not `roblox_universes.slug`; `roblox_link` is the Roblox experience URL, `source_url` is the RobloxDen codes page, `source_url_2` is the Beebom codes page, and `seo_title` stays empty or null unless the user explicitly asks otherwise.
  - After source URLs are set, run `npm run refresh:codes -- --slug <game-slug>` so the scraper reads RobloxDen and Beebom, upserts active codes, and expires missing codes.
  - Code-page article fields and metadata must be evergreen. Do not write active code names, current-code reward mappings, active counts, exact dates, month/year labels, or freshness claims such as `latest`, `current`, `fresh`, or `updated daily` into prose or metadata.
- `decal-ids/`: decal scraping and enrichment.
- `events/`: event ingestion, page seeding, event detail hydration, event guide generation.
- `games/`: import jobs and single-game article generation.
- `lists/`: curated and trending list refresh jobs.
- `music/`: music ID collection, import, enrichment, verification, thumbnails.
- `posts/`: outbound posting jobs.
- `puzzles/`: daily puzzle answer collectors for `/puzzles`, writing durable answer rows into `puzzle_answers`.
  - `sync-puzzles.ts` syncs Wordle, Connections, Strands, Spelling Bee, Letter Boxed, NYT Sudoku, NYT Pips, Contexto, Letroso, and LinkedIn puzzle answers. Use `npm run sync:puzzles -- --dry-run` before writing. Pass `-- --skip-linkedin` when `LINKEDIN_LI_AT` is unavailable or stale.
- `shared/`: helpers reused by multiple scripts.
- `trading/`: trading-related collection.
- `universes/`: universe collection, enrichment, stats route slugs, tiered stats, media, and descriptions.
  - `collect-roblox-universes.ts` is the lean Explore discovery collector. It upserts newly seen Roblox universe IDs into `roblox_universes` only; it no longer stores Explore sort history, search snapshots, or discovery queue rows.
  - Public stats use one `stats_tier`: `NEW`, `HOT`, `WARM`, or `COLD`. `HOT` means `playing >= 100` or `visits >= 250M`; `WARM` means `playing >= 30` or `visits >= 10M`; `NEW` means newly discovered/never refreshed/missing basic stats; all other valid games are `COLD`.
  - Keep NEW refresh in its own workflow so discovery/backlog rows move quickly into HOT, WARM, or COLD without blocking HOT hourly freshness.
  - `update-universe-hourly-stats.ts` is the tiered public stats collector for `/stats`; run it through `npm run stats:refresh -- --tier HOT|WARM|COLD|NEW` or the dedicated aliases `stats:refresh:hot`, `stats:refresh:warm`, and `stats:refresh:cold`. It fetches Roblox public game details for playing/visits/favorites, fetches the separate votes API for likes/dislikes/rating, updates latest non-null values on `roblox_universes`, upserts `roblox_universe_stats_hourly`, records Roblox `updated_at_api` changes in `roblox_universe_update_events`, assigns `stats_tier`, and can roll up today's row in `roblox_universe_stats_daily`. Use `--universe-id <id>` for targeted repairs.
  - Keep WARM and COLD refreshes in separate workflows. COLD rotating batches can run longer and should not block WARM freshness.
  - `assign-universe-stats-tier.ts` backfills or repairs `stats_tier`; use `npm run stats:tier`.
  - `audit-universe-stats-workflow.ts` reports tier counts, stale stats, missing media, and latest hourly coverage; use `npm run stats:audit`.
  - `rollup-universe-daily-stats.ts` rolls hourly rows into the existing daily table. Use `npm run stats:rollup-daily -- --date yesterday --finalize` after the UTC day ends so daily `playing` means the highest recorded CCU for that day.
  - `rank-universe-stats.ts` snapshots public rankings into `roblox_universe_rank_snapshots_hourly` or `roblox_universe_rank_snapshots_daily`; it pages through all eligible universes by default. Hourly runs should use `--granularity hourly --rank-set playing --snapshot-scope relevant` so global/genre/subgenre playing ranks are computed for all games but only rank-relevant hourly rows are stored. Daily runs should use `--granularity daily --rank-set all --snapshot-scope all` for complete all-game rank history, including visits, favorites, and rating.
  - `prune-universe-hourly-history.ts` trims short-range history through `npm run stats:prune-hourly -- --days 90 --apply`; it deletes only `roblox_universe_stats_hourly` and `roblox_universe_rank_snapshots_hourly` rows older than the cutoff.
  - `enrich-roblox-universes.ts` preserves existing non-null universe data and stores every distinct icon/screenshot URL in `roblox_universe_media`; it should not delete previous media or replace existing media fields with `null`.
  - Universe slugs are stats route identifiers. They should be generated and maintained independently from editorial page slugs, and no script should sync them to or from `games.slug`.
  - `backfill-clean-display-names.ts` cleans `roblox_universes.display_name` from raw Roblox titles while leaving `name` as the raw source value. It is dry-run by default; use `--apply` locally, and pair `NODE_ENV=production` with `--allow-prod` only after a clean production dry-run.

## Operational Expectations

- Treat scripts as data pipelines: know whether the job reads only, mutates Supabase, writes local files, calls external APIs, or triggers revalidation.
- If a script creates or updates publishable content, review `/api/revalidate` coverage and any relevant Supabase revalidation trigger flow.
- If a job becomes part of the normal workflow, add a package script and update `agents/scripts/agents.md`.
- Keep editorial page slugs separate from stats slugs. `roblox_universes.slug` belongs to `/stats/games/*`; scripts must not copy it into `games.slug`, `wiki_pages.slug`, `events_pages.slug`, `checklist_pages.slug`, `quiz_pages.code`, or `wiki_catalog_pages.wiki_slug`.

## Script Authoring Checklist

1. Put the file in the correct folder.
2. Reuse a helper from `scripts/shared/` or `apps/web/src/lib/*` if one already exists.
3. Add a `package.json` command if people will run it regularly.
4. Document the script in `agents/scripts/agents.md`.

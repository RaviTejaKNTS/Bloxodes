# Script Inventory

Authoritative workflow guidance lives in `scripts/AGENTS.md`.
This file is the quick reference for what exists today and how to invoke it.

## Preferred Entry Point

- Prefer `npm run <name>` when a package script exists.
- Fall back to direct `tsx scripts/...` or `python scripts/...` only for scripts that do not have a package alias yet.

## Worktree setup

`npm run setup:worktree` prepares an existing linked worktree; it never creates another worktree. It symlinks ignored root `.env*` files or directories from the main checkout without replacing worktree-specific paths, installs dependencies only when needed for the current `package-lock.json`, and creates ignored temp/report directories. It exits immediately in the main checkout. Codex invokes it through `.codex/environments/environment.toml`; Claude and Grok share the `.claude/settings.json` `SessionStart` hook.

## Stability and SEO verification

| Purpose | Preferred command |
| --- | --- |
| Fast source-only check | `npm run verify:deterministic` |
| Verify one published or intentionally absent route | `npm run verify:published-url -- --path /wiki/<game>/<collection>` |
| Manual local candidate crawl and Chromium verification | `npm run verify:predeploy` |
| Manual live read-only audit | `TEST_BASE_URL=https://bloxodes.com EXPECTED_BUILD_SHA=<sha> npm run verify:postdeploy` |

Automatic daily workflows use fast code/build/dataset checks and tiny targeted smoke requests only. Broad crawls are manual. The implementation is documented in `docs/testing/stability-and-seo.md`; reports belong under ignored `tmp/test-reports/`.

## Content Generation And Editing

| Purpose | File | Preferred command |
| --- | --- | --- |
| Batch article generation | `scripts/articles/generate-articles.ts` | `npm run generate:articles` |
| Draft code page generation | `scripts/codes/generate-code-page-copy.ts` | `npm run generate` |
| Reviewed code page upsert with provider-owned source fields | `scripts/codes/upsert-code-page.ts` | `npm run upsert:code-page -- --file <payload.json> --dry-run` before the approved write |
| Beebom code-page discovery and immediate draft generation | `scripts/codes/discover-beebom-code-pages.ts` | `npm run discover:beebom-codes -- --apply` |
| Event guide generation | `scripts/events/generate-events-articles.ts` | `npm run generate:events-articles` |
| Article generation queue worker | `scripts/automation/run-article-generation-queue.ts` | `npm run articles:queue` |
| Discover recent non-codes article leads | `scripts/articles/discover-article-topics.ts` | `npm run articles:discover` for an 18-hour dry run; the window is uniform across sources and cannot be 24 hours or more. The funnel table explains raw, stale, malformed, code, duplicate, capped, and eligible counts. Eligible pages are fetched directly for bounded headings/excerpts. Homelab managed-dev `--apply` inserts, refreshes, or requeues reusable source provenance without creating generation jobs. |
| Curate source leads into article jobs | `scripts/articles/curate-article-topics.ts` | `npm run articles:curate` for a read-only Groq preview; homelab managed-dev writes use `-- --apply`. The default batch is 12, source evidence and the intent-matched production inventory are capped, and output tokens scale with batch size. One update lead may produce multiple distinct source-backed guide/explainer/tier-list angles, while interchangeable multi-publisher coverage still merges. Prompt upgrades selectively re-curate retryable old decisions; three current-prompt zero-approval runs mark the service degraded. |
| List article-runner queue leads | `scripts/articles/list-article-queue.ts` | `npm run articles:queue:list -- --limit <n> --json`; read-only, Groq-curated `agent_runner` rows only, newest source publication first |
| List completed articles for release review | `scripts/articles/list-article-release-review.ts` | `npm run articles:review:list -- --base-url http://127.0.0.1:<port> --json`; read-only and includes result paths, localhost links, queue IDs, and source provenance |
| Update an article-runner queue row | `scripts/articles/update-article-queue-item.ts` | `npm run articles:queue:update -- --queue-id <uuid> --status <processing|blocked|completed|published|rejected|skipped|failed> --apply`; the command accepts only managed-dev article credentials, retryable `blocked` requires `--reason` and supports `--retry-after-minutes`, completion requires `--result-path`, publication requires `--production-url`, and rejection requires `--reason` |
| Inspect published production editorial coverage without production credentials | `scripts/articles/list-production-editorial-inventory.ts` | `npm run articles:inventory:production -- --search <topic>` reads the GET-only production inventory endpoint; filter by family or universe ID for research overlap and internal links |
| Write one curated managed-dev article on the homelab with Grok | `scripts/articles/run-local-article-writer.ts` | `npm run articles:writer:homelab` is a dry run; add `-- --apply` to claim one managed-dev job, run the existing article workflow, import to managed dev, and close the same dev queue row after verification |
| Write a capped managed-dev article batch on the homelab with Grok subagents | `scripts/articles/run-homelab-article-batch.ts` | `npm run articles:writer:batch` checks the queue without invoking Grok; add `-- --apply --limit 6` to requeue due blocked rows and run one auto-approved Grok 4.5 parent for at most six articles. A non-empty batch with zero completed rows exits degraded. Systemd triggers it only after successful discovery and curation. |
| Validate homelab article automation | `scripts/ops/check-homelab-article-automation.ts` | `npm run articles:homelab:check` is read-only and checks the dev schema, production inventory, Groq key, Grok CLI, and browser before the systemd timers are enabled |
| Install inactive homelab article units | `scripts/ops/install-homelab-article-automation.sh` | Run with sudo only from `/home/teja/projects/Bloxodes`; installs the root-owned env placeholder plus discovery/writer units and leaves the discovery timer disabled until readiness passes |
| Generic generation queue worker | `scripts/automation/run-generation-queue.ts` | `npm run generate:queue` |
| Article refresh/update | `scripts/articles/update-articles.ts` | `npm run articles:update` |
| Code-article rewrite | `scripts/codes/rewrite-codes-articles.ts` | `npm run rewrite:codes` |
| Universe description generation | `scripts/universes/generate-universe-description.ts` | `npm run generate:universe-description` |
| Queue event guides | `scripts/events/queue-event-guides.ts` | `npm run queue:event-guides` |
| Public copy quality check | `scripts/content/check-public-copy.ts` | `npm run content:check-copy -- <final.json>` |
| Collect and host an approved article visual set | `scripts/content/collect-article-images.ts` | `npm run collect:article-images -- --manifest <media.json>` for dry run; add `-- --apply` after exact-match/source approval |
| Check article visual-set readiness | `scripts/content/check-article-image-readiness.ts` | `npm run check:article-image-readiness -- --manifest <media.json> --file <final.json>` |
| Sync article image provenance | `scripts/content/sync-article-image-provenance.ts` | Dry-run `npm run sync:article-image-provenance -- --manifest <media.json>`; add `-- --apply` after article import. Production also requires `NODE_ENV=production` and `--allow-prod` |
| Save hosted article image (legacy local-file path) | `scripts/content/save-article-image.ts` | Do not use for new article source images; use the Supabase-backed manifest collector |
| Article media checks (YouTube + images) | `scripts/content/check-article-media.ts` | used by `npm run verify:article-finals` |
| Article final writing | `.agents/skills/bloxodes-article-workflow-runner` | Research subagent → brief approval → mandatory article-image subagent with nonzero target set → image readiness approval → writing subagent → `verify:article-finals` (sibling `media.json` required) |
| Game collection final writing | `.agents/skills/bloxodes-game-collection-workflow-runner` | Collection subagent (research → data → images) → writing subagent (`bloxodes-game-collection-writing`) → `verify:game-collection-finals` |
| Import reviewed tool final JSON into Supabase | `scripts/content/import-tool-finals.ts` | `npm run import:tool-finals -- --file tmp/content-workspace/<topic-slug>/tools/<tool-code>/final.json --dry-run`; production writes require `NODE_ENV=production` plus `--allow-prod` and verify the saved `tools` row |
### Code Page Workflow Hard Rules

`scripts/codes/update-codes.ts` is the source of truth for active and expired code rows. It reads `code_pages.source_url` and `code_pages.source_url_2`, detects supported providers, scrapes the source pages, upserts active codes, and expires codes that disappear from the supported sources.

For new or corrected code pages:

- Use the editorial game slug only, such as `wizard-alchemy`, because the route is already `/codes/<slug>`. Do not use `roblox_universes.slug`.
- Store the Roblox experience URL in `roblox_link`, not in `source_url`.
- Store the RobloxDen codes page in `source_url`.
- Store the Beebom codes page in `source_url_2`.
- Keep `seo_title` empty or null unless the user explicitly asks for a custom title.
- Do not manually insert `codes` rows, `expired_codes`, code names, rewards tied to current code names, or `first_seen_at` dates.
- After the code page row is ready, run `npm run refresh:codes -- --slug <game-slug>`.

Code-page article copy must be long-term. Metadata and prose should explain reward types, redemption steps, troubleshooting, and official source locations without naming active codes, exact dates, month/year labels, active-code counts, or freshness claims such as `latest`, `current`, `fresh`, or `updated daily`.

## Codes Refresh And Posting

| Purpose | File | Preferred command |
| --- | --- | --- |
| Refresh active/expired codes | `scripts/codes/update-codes.ts` | `npm run refresh:codes` |
| Post code updates | `scripts/posts/post-codes.ts` | `npm run post:codes` |
| Post one game update | `scripts/posts/post-online.ts` | `npm run post:online` |

## Universe And Metadata Jobs

| Purpose | File | Preferred command |
| --- | --- | --- |
| Import code pages into Supabase | `scripts/codes/import-code-pages.ts` | `npm run import:code-pages` |
| Discover priority Roblox universes from Explore | `scripts/universes/discover-priority-roblox-universes.ts` | `npm run discover:universes:priority` |
| Collect Roblox universes from Explore | `scripts/universes/collect-roblox-universes.ts` | `npm run collect:universes` |
| Discover Roblox universes from omni-search | `scripts/universes/search-roblox-universes.ts` | `npm run discover:universes:search`; defaults to a rotating 24-query/one-page slice with a ten-minute budget and three-429 circuit breaker, while an explicit `--limit 0` is required for all queries |
| Discover Roblox universes from known creators/groups | `scripts/universes/expand-roblox-creators.ts` | `npm run discover:universes:creators` |
| Discover read-only wiki candidates from prod stats | `scripts/universes/discover-wiki-candidates.ts` | `npm run discover:wiki-candidates`; ranks 15K+ CCU games by positive 6-hour CCU growth and excludes exact universe IDs already covered in `wiki_pages`, `wiki_collection_pages`, registered local game collections, or `Writing plans/wiki-pages-progress.md` |
| Migrate game collection datasets to v2 | `scripts/collections/migrate-game-collection-datasets-v2.ts` | `npm run migrate:game-collection-datasets:v2` for dry-run; add `-- --apply` only after there are no blocking issues. Writes separated `{ meta, items[].item, items[].system }` datasets with public game fields kept apart from `slug`, `section`, `sortOrder`, and `image` system fields |
| Audit v2 game collection datasets and renderer | `scripts/collections/audit-game-collection-datasets-v2.ts` | `npm run audit:game-collection-datasets:v2`; fails on bare arrays, legacy renderer overrides, dev/source/raw public item fields, unsupported system keys, missing display metadata, or display fields that are not public item fields |
| Plan collection refresh scope | `scripts/collections/plan-game-collection-refresh.ts` | `npm run plan:game-collection-refresh -- [--game <name-or-slug>] [--collection <slug-or-file>] [--output <manifest.json>]`; reads registered config and v2 collection-shaped candidates, writes only the optional resumable manifest |
| Export existing collection page copy | `scripts/collections/export-game-collection-final.ts` | `npm run export:game-collection-final -- --game <game-slug> --collection <collection-slug> --output-root tmp/content-workspace/<game-slug>/collections`; read-only Supabase snapshot, with `--allow-remote-read` required for a non-local target and `--force` required to replace a file |
| Run local-safe universe pipeline | `scripts/universes/run-universe-pipeline.ts` | `npm run pipeline:universes` |
| Backfill missing universe IDs | `scripts/backfill/backfill-game-universes.ts` | `npm run backfill:universes` |
| Enrich universes | `scripts/universes/enrich-roblox-universes.ts` | `npm run enrich:universes`, `npm run enrich:universes:light`, `npm run enrich:universes:deep`; deep mode refreshes media, Open Cloud metadata, social links, groups, game passes, badges, and recent public server snapshots |
| Backfill clean universe display names | `scripts/universes/backfill-clean-display-names.ts` | `npm run backfill:universe-display-names`; write locally with `-- --apply`, write production only with `NODE_ENV=production npm run backfill:universe-display-names -- --apply --allow-prod` after a clean production dry-run |
| Refresh tiered public stats | `scripts/universes/update-universe-hourly-stats.ts` | `npm run stats:refresh:hot`, `npm run stats:refresh:warm`, `npm run stats:refresh:cold`; uses bounded 500-row atomic claims and a cross-host tier lease. Use `--skip-index-refresh` for scheduled jobs when the hourly serialized index job owns rebuilding, `npm run stats:refresh -- --tier NEW` for NEW rows, or `--universe-id <id>` for one-game repairs. |
| Assign stats tiers | `scripts/universes/assign-universe-stats-tier.ts` | `npm run stats:tier` |
| Audit stats workflow | `scripts/universes/audit-universe-stats-workflow.ts` | `npm run stats:audit -- --strict`; calls one service-role health RPC, fails on public freshness/scheduler/lease/read-model SLAs, and records `stats_universe_audit` in `stats_job_runs` |
| Roll hourly stats into daily rows | `scripts/universes/rollup-universe-daily-stats.ts` | `npm run stats:rollup-daily -- --date today`; use `-- --date yesterday --finalize` after the UTC day ends; records `stats_universe_daily_rollup` in `stats_job_runs` |
| Snapshot public stats rankings | `scripts/universes/rank-universe-stats.ts` | Hourly: `npm run stats:rank -- --all --granularity hourly --rank-set playing --snapshot-scope relevant`; daily full: `npm run stats:rank -- --all --granularity daily --rank-set all --snapshot-scope all`. Full-population runs use the database-side `refresh_universe_rank_snapshots()` function; custom limited/tier/dry runs use the application fallback. Playing ranks exclude observations older than 24 hours. |
| Refresh platform stats aggregates | `scripts/universes/refresh-platform-stats.ts` | `npm run stats:platform:refresh`; refreshes `roblox_platform_stats_hourly` and `roblox_platform_stats_daily`, and records `stats_platform_refresh` in `stats_job_runs` |
| Prune short-range hourly history | `scripts/universes/prune-universe-hourly-history.ts` | `npm run stats:prune-hourly -- --days 90 --apply`; deletes old hourly stats and hourly rank snapshots only; records `stats_universe_hourly_prune` in `stats_job_runs` |

`enrich-roblox-universes.ts` should not be the normal source for `roblox_universe_stats_daily` now that public stats use hourly rollups. It writes same-day daily stat rows only when `ROBLOX_ENRICH_WRITE_DAILY_STATS=true` is set for a legacy one-off.

| Sync daily puzzle answers | `scripts/puzzles/sync-puzzles.ts` | `npm run sync:puzzles`; use `-- --group early-nyt`, `-- --group beebom-with-early`, `-- --group late-nyt-and-linkedin`, `-- --group all`, `-- --puzzle wordle`, `-- --date YYYY-MM-DD`, `-- --backfill-days 30`, `-- --dry-run`, `-- --skip-linkedin`, or `-- --skip-linkedin-if-missing` as needed. LinkedIn puzzle sync requires `LINKEDIN_LI_AT` unless the skip flag is set. Recurring puzzle sync now belongs on the VPS stats worker; GitHub is manual fallback only. |
| Fix code pages with article content but missing Roblox link/universe ID | `scripts/codes/fix-missing-code-page-roblox-links-and-universes.ts` | `npm run fix:code-page-links` local dry run, `npm run fix:code-page-links -- --prod --apply` to write prod |
| Backfill social links | `scripts/backfill/backfill-social-links.ts` | `npm run links:backfill` |
| Backfill missing cover images | `scripts/backfill/backfill-missing-cover-images.ts` | `npm run cover:backfill` |
| Backfill interlinking copy | `scripts/backfill/backfill-interlinking.ts` | `npm run backfill:interlinking` |
| Audit or repair non-canonical Supabase media | `scripts/backfill/repair-legacy-supabase-media.ts` | Scans both the retired managed origin and `database.bloxodes.com` Storage URLs. `npm run audit:legacy-media` is read-only and requires `-- --allow-remote-read` for a remote target. Use `npm run repair:legacy-media -- --recovery-root <path> --remove-unrecoverable-body-images --replace-missing-covers-from-roblox --apply --allow-prod` only after a clean dry run; uploads and verifies media before updating rows and writes an ignored rollback snapshot under `tmp/legacy-media-repair/`. |

## Events

| Purpose | File | Preferred command |
| --- | --- | --- |
| Collect Roblox virtual events | `scripts/events/collect-roblox-virtual-events.ts` | `npm run collect:virtual-events` |
| Seed event pages | `scripts/events/seed-events-pages.ts` | `npm run seed:events-pages` |
| Seed event details | `scripts/events/seed-event-details.ts` | `npm run seed:event-details` |
| Shared event revalidation helper | `scripts/shared/revalidate-events.ts` | imported helper |

## Music IDs, Catalog, And Related Ingestion

| Purpose | File | Preferred command |
| --- | --- | --- |
| Collect Roblox music IDs | `scripts/music/collect-roblox-music-ids.ts` | `npm run collect:music-ids` |
| Collect curated music IDs | `scripts/music/collect-curated-roblox-music-ids.ts` | `npm run collect:music-ids-curated` |
| Collect top songs | `scripts/music/collect-top-100-songs.ts` | `npm run collect:top-songs` |
| Rerank music IDs | `scripts/music/rerank-roblox-music-ids.ts` | `npm run rerank:music-ids`; recomputes `popularity_score` from source, rank, recency, votes, creator/metadata quality, and chart rank |
| Import music ID seeds | `scripts/music/import-roblox-music-id-seeds.ts` | `npm run import:music-id-seeds` |
| Scrape music ID seeds | `scripts/music/scrape-roblox-music-id-seeds.ts` | direct `tsx scripts/music/scrape-roblox-music-id-seeds.ts` |
| Enrich music IDs | `scripts/music/enrich-roblox-music-ids.ts` | `npm run enrich:music-ids` |
| Backfill music thumbnails | `scripts/music/backfill-roblox-music-thumbnails.ts` | `npm run thumbnails:music-ids` |
| Verify music IDs | `scripts/music/verify-roblox-music-ids.ts` | `npm run verify:music-ids` |
| Collect accessory catalog items | `scripts/catalog/collect-roblox-catalog-items.ts` | `npm run collect:accessory-items` |
| Collect body catalog items | `scripts/catalog/collect-roblox-body-items.ts` | `npm run collect:body-items` |
| Collect clothing catalog items | `scripts/catalog/collect-roblox-clothing-items.ts` | `npm run collect:clothing-items` |
| Collect avatar animation items | `scripts/catalog/collect-roblox-avatar-animation-items.ts` | `npm run collect:avatar-animation-items` |
| Collect Roblox makeup avatar items | `scripts/catalog/collect-roblox-makeup-items.ts` | `npm run collect:makeup-items` |
| Collect Grow a Garden local catalog images | `scripts/catalog/collect-grow-a-garden-images.ts` | `npm run collect:grow-a-garden-images` |
| Collect Slime RNG local collection data and images | `scripts/collections/collect-slime-rng-data.ts` | `npm run collect:slime-rng-data` |
| Seed gathered game collection pages into Supabase | `scripts/collections/seed-game-collection-pages.ts` | `npm run seed:game-collection-pages`, add `-- --dry-run` to preview; add `-- --final-json-root tmp/content-workspace/<game-slug>/collections` when approved page `final.json` files should override generated copy; supports new `<collection-slug>/final.json` and older `<catalog-code>/final.json` folders |
| Register game collection | `scripts/collections/register-game-collection.ts` | `npm run register:game-collection -- --game <game-slug> --collection <collection-slug> --dry-run` first; edits existing game groups only and prints a manual block when the game group is missing |
| Check game collection dataset readiness | `scripts/collections/check-game-collection-data.ts` | `npm run check:game-collection-data -- --game <game-slug> --collection <collection-slug> --final-json <final.json>`; validates sections, card fields, card summaries, images, config, and `description_json` section keys |
| Collect game collection images from manifest | `scripts/collections/collect-collection-images.ts` | `npm run collect:collection-images -- --manifest <images.json> --dataset data/<Game>/<collection>.json --game-name "<Game>" --collection-name "<Collection>" --dry-run` first |
| Seed broad catalog pages into Supabase | `scripts/catalog/seed-catalog-pages.ts` | `npm run seed:catalog-pages -- --file tmp/content-workspace/<topic>/catalogs/<batch>/final.json --dry-run`; writes to local Supabase by default and refuses production unless `--allow-prod` is supplied |
| Refresh game-specific ID source mappings | `scripts/catalog/sync-game-specific-id-sources.ts` | `npm run sync:game-specific-id-sources`; rewrites `data/game-specific-ids/source-backed.json` from the bounded source adapters and must be diff-reviewed before seeding |
| Seed game-specific ID usage | `scripts/catalog/seed-game-specific-id-usage.ts` | `npm run seed:game-specific-id-usage -- --dry-run` first, then run locally; use `--replace-source-rows` to reconcile only rows owned by matching game/source pairs, while non-local writes require `--allow-prod` |
| Seed gathered game wiki pages into Supabase | `scripts/catalog/seed-game-wiki-pages.ts` | `npm run seed:game-wiki-pages`, add `-- --dry-run` to preview |
| Import reviewed content final JSON into Supabase | `scripts/content/import-content-final.ts` | `npm run import:content-final -- --file tmp/content-workspace/<game-or-topic-slug>/<page-folder>/final.json --dry-run`; article imports write only to `articles`, fill missing authors randomly, create edited game-thumbnail covers when needed, inject the feature image before the first H2, and require `/articles` plus `/articles/<slug>` verification against the same saved row |
| Write one article final | `.agents/skills/bloxodes-article-writing` via workflow runner | After brief approval, spawn a writing subagent; use tech skill for platform/troubleshooting |
| Write one game collection final | `.agents/skills/bloxodes-game-collection-writing` via workflow runner | After image approval, spawn a writing subagent for `final.json` |
| Collect all catalog item families | `scripts/catalog/run-roblox-catalog-discovery.ts` plus family collectors | `npm run collect:catalog-items`; runs families sequentially, rotates subcategory/sort/keyword slices, honors global per-family query/page/asset budgets, and records partial failures without skipping later families |
| Enrich catalog items | `scripts/catalog/enrich-roblox-catalog-items.ts` | `npm run enrich:catalog-items`; atomically leases queue rows and always refreshes authoritative metadata plus thumbnails |
| Assign public item stats tiers | `scripts/items/assign-item-stats-tier.ts` | `npm run stats:items:tier -- --apply`; dry-run by default without `--apply` |
| Refresh hourly public item stats | `scripts/items/update-item-hourly-stats.ts` | `npm run stats:items:refresh -- --tier TRADE --limit 180`; refreshes Roblox catalog details, thumbnails, hourly snapshots, and optionally item indexes. Recurring runs belong on the VPS stats worker; GitHub is manual fallback only. |
| Sync item resale history | `scripts/items/sync-item-resale-history.ts` | `npm run stats:items:resale -- --limit 60 --max-age-hours 24`; fetches public Roblox resale price and volume points for resale-capable asset rows |
| Roll up item daily stats | `scripts/items/rollup-item-daily-stats.ts` | `npm run stats:items:rollup-daily -- --date yesterday --finalize` |
| Refresh item stats indexes | `scripts/items/rebuild-stats-item-indexes.ts` | `npm run stats:items:index:refresh`; advisory-locked 2,000-row incremental refresh using daily 24h/7d baselines, then queues stats revalidation |
| Audit item stats workflow | `scripts/items/audit-item-stats-workflow.ts` | `npm run stats:items:audit -- --strict`; verifies end-to-end discovery, stale discovery/job-run records, enrichment queue, free items, tier freshness, hourly/daily/resale, and index SLAs |
| Refresh universe stats | `scripts/universes/update-universe-hourly-stats.ts` | Tiered NEW/HOT/WARM/COLD refresh with atomic due-row claims, 23-hour healthy COLD scheduling ahead of the 24-hour public cutoff, exponential error/all-null backoff, and recoverable quarantine after three confirmed missing Roblox detail responses |
| Enrich universes | `scripts/universes/enrich-roblox-universes.ts` | Rotating light/deep enrichment; filters Roblox `id = 0` placeholder responses and defers unavailable rows instead of repeatedly selecting them |
| Audit universe stats | `scripts/universes/audit-universe-stats-workflow.ts` | Uses the timeout-safe `get_roblox_universe_pipeline_health_v3()` for a single-statement snapshot of tier/data coverage, public 24-hour visibility, recent NEW/WARM/COLD worker starts, universe-only stale runs, leases, overdue rows, and read-index freshness; `--strict` exits non-zero on failed SLAs |
| Import RobloxDen free-item candidates | `scripts/catalog/import-robloxden-free-items.py` | `npm run import:free-item-candidates`; defaults to local env, non-local writes require `ALLOW_PROD_FREE_ITEMS_IMPORT=true`, and rows still require the Roblox verification collector before publication |
| Collect and verify free items from all candidate sources | `scripts/catalog/collect-roblox-free-items.ts` | `npm run collect:free-items` merges live Roblox search, source-tagged table rows (including RobloxDen), and prior candidates, then verifies claimability through Roblox; dry run by default, add `-- --apply` to write |
| Keep Free Items main page only | `scripts/catalog/set-free-items-main-only.ts` | `npm run catalog:free-items-main-only` (dry run; add `-- --apply` to unpublish subpages) |
| Refresh Roblox promo rewards | `scripts/catalog/refresh-roblox-promo-rewards.ts` | `npm run refresh:promo-rewards` is a read-only preview; add `-- --apply` for local writes and `-- --apply --allow-prod` for production. Validates a nonempty complete RobloxDen list, distinguishes official Roblox assets/bundles and thumbnails, applies seen rows plus miss retirement in one locked transaction, retires after two complete-source misses by default, updates the catalog-page timestamp only for material changes, and audits apply runs in `stats_job_runs`. The VPS manifest runs it Wednesdays at 09:40. |
| Trading limiteds collection | `scripts/trading/collect-all-limiteds.ts` | `npm run trading:collect` |
| Collect Roblox decal IDs | `scripts/decal-ids/collect-roblox-decal-ids.ts` | `npm run collect:decal-ids`; primary Roblox Toolbox/Creator Store discovery into `roblox_decal_ids` |
| Collect Roblox font IDs | `scripts/catalog/collect-roblox-font-ids.ts` | `npm run collect:font-ids`; dry-run by default, reads the complete official Creator Store FontFamily set plus manifests and preview thumbnails, and upserts `roblox_font_ids` only with `-- --apply` (`--allow-prod` is also required outside local Supabase) |
| Collect Roblox mesh IDs | `scripts/catalog/collect-roblox-mesh-ids.ts` | `npm run collect:mesh-ids`; dry-run by default, reads the public 1,000-result Creator Store MeshPart selection plus square previews, and upserts `roblox_mesh_ids` only with `-- --apply` (`--allow-prod` is also required outside local Supabase) |
| Import decal ID candidates | `scripts/decal-ids/import-decal-id-candidates.ts` | `npm run import:decal-id-candidates`; imports legacy JSON/files/external-page candidates before Roblox verification |
| Verify decal IDs | `scripts/decal-ids/verify-roblox-decal-ids.ts` | `npm run verify:decal-ids`; validates asset type `13`, thumbnails, metadata, status, and rank fields |
| Rerank decal IDs | `scripts/decal-ids/rerank-roblox-decal-ids.ts` | `npm run rerank:decal-ids`; recomputes active-row popularity, curation, category, and curated-rank fields |
| Seed decal catalog page | `scripts/decal-ids/seed-decal-catalog-page.ts` | `npm run seed:decal-ids-page`; upserts local `catalog_pages` copy/FAQ for `/catalog/roblox-decal-ids` |
| Refresh decal IDs | `scripts/decal-ids/run-decal-id-refresh.ts` | `npm run refresh:decal-ids`; guarded collect → import → verify → rerank runner for scheduled refreshes |
| Legacy scrape decal IDs | `scripts/decal-ids/scrape-decal-ids.ts` | `npm run scrape:decal-ids` |
| Legacy enrich decal IDs | `scripts/decal-ids/enrich-decal-ids.ts` | `npm run enrich:decal-ids` |

## Ads, Reporting, And Automation Utilities

| Purpose | File | Preferred command |
| --- | --- | --- |
| Update `ads.txt` | `scripts/ads/update-ads-txt.ts` | `npm run ads:update` |
| Audit Journey catalog DOM | `scripts/ads/audit-journey-catalog-dom.ts` | Start the local web app, then run `npm run audit:journey-dom -- --base-url http://127.0.0.1:<port>`; read-only guard for one `#article-body`, direct Music/Decal item children, redirects, pagination, charts, and no manual content hints |
| Audit hydrated Journey catalog DOM | `scripts/ads/audit-journey-catalog-browser.ts` | Run `npm run audit:journey-browser -- --base-url http://127.0.0.1:<port>` against a local build; checks desktop/mobile hydration and a synthetic full-width in-content placement |
| IndexNow bootstrap | `scripts/automation/indexnow-bootstrap.ts` | `npm run indexnow:bootstrap` |
| Google Indexing API submitter | `scripts/automation/google-indexing-submit.ts` | `npm run indexing:google -- --dry-run`, live only with `--apply` and `GOOGLE_INDEXING_API_ENABLED=true` |
| Warm Cloudflare cache | `scripts/automation/warm-cloudflare-cache.mjs` | `CACHE_WARM_SITE_URL=https://bloxodes.com npm run cache:warm`; default deploy mode warms main/index/legal URLs, all wiki/catalog/tool URLs, sitemap files, and a recent slice from DB-backed detail sitemaps; use `CACHE_WARM_MODE=full` only for intentional full-site warming |
| Audit sitemap SEO and indexability signals | `scripts/automation/audit-sitemap-seo.ts` | `npm run audit:seo`; add `-- --limit 100` for a quick smoke test, `-- --site https://bloxodes.com` to force the live origin, and `-- --fail-on-error` for CI-style failures. Writes JSON and CSV reports under `tmp/seo-audits/` |
| Audit uncompressed HTML size | `scripts/automation/audit-html-size.ts` | `npm run audit:html-size -- --url <url> --fail-on-limit`; use `--sitemap <url>` for batches and `--rewrite-origin https://bloxodes.com http://127.0.0.1:<port>` for localhost sitemap checks. Writes TSV and JSON reports under `tmp/html-size-audits/` |
| Queue revalidation events | `scripts/automation/enqueue-revalidation-events.ts` | `npm run enqueue:revalidation -- --event stats:stats --event stats:games --event stats:creators --event stats:items`; writes coalesced rows to `revalidation_events` for the Supabase worker |
| Automation reporting | `scripts/automation/report-automation.mjs` | direct `node scripts/automation/report-automation.mjs` |
| Report redeem markdown image gaps | `scripts/backfill/report-redeem-md-missing-images.ts` | direct `tsx scripts/backfill/report-redeem-md-missing-images.ts` |
| Shared Tavily helper | `scripts/shared/tavily.ts` | imported helper |
| VPS scheduled automation manifest | `scripts/ops/vps-scheduled-automation.crontab` | Install into the VPS `codex-admin` crontab beside existing stats-worker blocks. This is the scheduled source for universe daily rollup/prune/audit, platform aggregate refresh, codes refresh, the weekly Wednesday 09:40 promo-reward refresh, Google Indexing, events refresh, puzzle sync, music IDs, and decal IDs. GitHub workflows for those jobs are manual fallback only. Its `vps-run-job.sh` wrapper uses the local `supabase_default` Docker network and `http://supabase-kong:8000` API by default so worker database calls do not traverse Cloudflare; the host shell owns routing overrides, and the live wrapper must be installed separately with executable mode. |
| Check production data explicitly | `scripts/ops/check-production-data-readiness.mjs` | `node --env-file-if-exists=.env scripts/ops/check-production-data-readiness.mjs`; manual read-only Supabase HEAD probe with five attempts, not part of the daily Docker build |
| Run a command with production build variables | `scripts/ops/run-with-production-build-env.mjs` | Loads `/run/secrets/production_env` from BuildKit, falling back to local `.env`, then executes the supplied command without printing secret values |

### Wiki And Game Collection Production Publish

Use this only after local content, data, images, DB readback, and rendered routes are clean.

1. Confirm production env:
   - `NODE_ENV=production`
   - Supabase host is production, not local.
2. Confirm or create the production `roblox_universes` row first. Prefer universe ID, root place ID, display name, creator, and Roblox URL. Treat `roblox_universes.slug` as a stats-only URL slug, not as the source for page slugs.
3. Check existing production rows before writing:
   - `wiki_pages.slug = <editorial-game-slug>`
   - `wiki_collection_pages.code in (<game-slug>-<collection-slug>...)`
   - `wiki_collection_pages.wiki_slug = <editorial-game-slug>` and `collection_slug`
4. Run production dry-runs:

```bash
NODE_ENV=production npm run seed:game-wiki-pages -- --dry-run --game <game-slug>
NODE_ENV=production npm run seed:game-collection-pages -- --dry-run --game <game-slug> --final-json-root tmp/content-workspace/<game-slug>/collections
```

5. Push in order:

```bash
NODE_ENV=production npm run seed:game-wiki-pages -- --game <game-slug> --allow-prod
NODE_ENV=production npm run seed:game-collection-pages -- --game <game-slug> --final-json-root tmp/content-workspace/<game-slug>/collections --allow-prod
```

Read back the production wiki row after the wiki push, before collection seeding, so collection rows can link to the production `wiki_page_id`.

After DB publish, push and deploy only the current game's repo artifacts required by those pages: `data/<Game>/`, `apps/web/public/<Game>/`, game dataset config/rendering code, and approved seed-script changes for that game. Do not include unrelated docs, other game data, temporary workspace files, or unrelated code in the game release commit.

Do not manually queue revalidation by default. Wait and poll live pages for up to 5 minutes because the app/database revalidation path should handle the update. If pages are still stale after that, inspect the revalidation queue or worker and report the blocker.

The publish is done only when live production pages return 200 and render the expected content:

- `/wiki/<game-slug>`
- `/wiki/<game-slug>/<collection-slug>` for every pushed collection
- item names, counts, sections, fields, descriptions, FAQs, and wired images
- sitemap entries when applicable

If live routes or images 404, the DB publish is not a completed site release. Confirm the deployed app includes route/config changes, `data/<Game>/`, and `apps/web/public/<Game>/`.

### Google Indexing API Workflow

The Google Indexing API job is separate from analytics. Local settings belong in ignored `.envs/pipelines/indexing.env`; production/GitHub settings should be injected as secrets or variables. The script is guarded twice: it needs `--apply`, and it still exits without submitting unless `GOOGLE_INDEXING_API_ENABLED=true`.

For recurring runs, use Supabase state by setting `GOOGLE_INDEXING_STATE_BACKEND=supabase` with `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE`. That lets the job persist the daily submission count and rotate through older URLs instead of hitting the same sitemap URLs every run.

Minimum production settings:

- `GOOGLE_INDEXING_API_ENABLED=true`
- `GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON_BASE64=<service account JSON as base64 secret>`
- `GOOGLE_INDEXING_DAILY_LIMIT=50`
- `GOOGLE_INDEXING_BATCH_LIMIT=10`
- `GOOGLE_INDEXING_REQUEST_DELAY_MS=1000`
- `GOOGLE_INDEXING_RESUBMIT_AFTER_HOURS=168`
- `GOOGLE_INDEXING_STATE_BACKEND=supabase`

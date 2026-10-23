# Database

Last verified: 2026-10-20

Two Supabase databases: production (self-hosted on the VPS) and managed development (Supabase cloud). There is no local Supabase.

## Production

- **API:** `https://database.bloxodes.com`. Studio at `https://studio.bloxodes.com` (basic auth). Media at `https://media.bloxodes.com`.
- **Stack:** Compose project in `/home/ravitejaknts/bloxodes-supabase` on the VPS. Postgres 17.6, PostgREST 14.12 (behind the `supabase-rest-proxy` socat bridge), Kong 3.9.1, GoTrue 2.189, Storage 1.60.4 (file backend, public bucket `bloxodes-media`), Realtime, Supavisor, Edge Runtime 1.74, Studio, postgres-meta, imgproxy.
- **Edge Functions:** `revalidate` and `cache-warm` are ours. `main` and `hello` are vendor defaults.
- **Extensions:** `pg_net` and `supabase_vault`. No `pg_cron`; the minute workers are called from VPS cron.
- Postgres stays private inside the VPS. Schema changes reach it only through GitHub over HTTPS Studio.

## Managed development

- A Supabase cloud project at HTTPS `*.supabase.co` (project `bbtcaurrtyoukvjbxbbj`). Credentials in `.envs/targets/managed-dev.env`.
- All workstation, agent and CI authoring work happens here: previews, imports, article queues, content QA.
- It's remote but not production. Don't call it "local".

## Moving data between them

- **Schema** moves forward only, as migrations in `supabase/migrations/`, through GitHub. See [release](../operations/release.md#schema).
- **Content** moves to production only through the selected publishers in `publish-content.yml`, or `content:publish` for Roblox and franchise wiki bundles. Rows are never copied by cloning a database.
- `npm run sync:managed-dev-public-sample` copies a public production sample into development (dry run unless `--apply`).
- `sync:production-collection-runtime:managed-dev` copies missing published collection revisions from production into development. It never writes production.

## Table families

| Area | Main tables |
| --- | --- |
| Codes | `code_pages`, `codes` |
| Articles | `articles`, authors, `article_source_images` |
| Roblox wiki | `roblox_wiki_registry`, `wiki_pages`, `wiki_collection_pages`, `wiki_collection_datasets`, `wiki_collection_items` |
| Non-Roblox games | `games` and `game_*` (see [franchise](../content/franchise.md#data)) |
| Engagement | `quiz_pages`, `checklist_pages`, `checklist_items`, `events_pages`, `tools` |
| Catalog | `catalog_pages` and the `roblox_*` ID and item tables |
| Stats | `roblox_universes`, `roblox_universe_stats_*`, rank snapshots, current indexes, `stats_job_runs` |
| Puzzles | `puzzle_pages`, `puzzle_answers`, `puzzle_sync_runs` |
| Users | accounts and sessions, `comments`, `user_*_progress`, `game_*_progress` |
| Cache | `revalidation_events`, `cache_warm_events` and their worker run tables |

Generated types for the shared game tables live in `supabase/types/shared-games.ts`. `supabase/schema.sql` is a dump of the production public schema.

## Prepared chart storage

The `stats_prepared_*` tables hold platform and visit-share chart generations, frozen source buckets, positive visit contributions, pending changes and worker receipts. All use RLS and service-only grants. Internal helpers live in the unexposed `stats_prepared_private` schema; the chart RPCs return one JSON value so long hourly series are not truncated at the REST row limit. The wire contract is `types/stats-prepared.ts`.

Ready generations are immutable. Publication changes the active pointer only after a complete result passes validation. Failed work preserves the last ready generation. Source triggers record changes without rebuilding charts in the ingestion transaction. Existing source and legacy aggregate tables retain their own writers.

The claim's membership replacement uses an explicit `universe_id is not null` predicate, matching its non-null primary key, so pg-safeupdate accepts the full replacement through PostgREST. Its forward correction preserves invoker security, grants and deadlines. Isolated QA installs the original migration followed by its correction and records each file's exact path and hash before creating test RPC aliases.

Changed empty platform payloads replace an existing active generation through that same atomic publication path. The former generation keeps its original payload and dates under normal retained-pointer protection and cleanup. Processed-empty buckets describe missing coverage, not public zero observations.

Hourly TRUNCATE capture invalidates through the current UTC hour; daily capture through the current UTC day. Hourly truncation also marks retained coverage outside the reconstructible horizon uncertain. Rebuild enumeration stays finite and ordered. This describes invalidation behavior, not an instruction to truncate production history.

Prepared storage includes contribution rows and indexes, beyond the chart JSON size limits. Measure bootstrap, membership rebuilds and cleanup with the isolated managed-development benchmark before activation. Deploy schema and the fixed worker first; verify actual chart coverage before switching public readers. See [stats](../content/stats.md) and the [runtime release contract](../operations/release.md#prepared-chart-runtime).

Managed development's organization is on the Free plan. Its 500 MB database billing quota differs from the fixed 2 GB project disk. Supabase's disk safeguard switches to read-only at 95% disk usage; WAL and other system files consume disk beyond `pg_database_size`. A database size below 2 GB therefore does not establish write headroom. Full chart-scale fixtures need an approved capacity solution before population; never disable read-only globally or change spending as a cleanup shortcut. See [Supabase's disk documentation](https://supabase.com/docs/guides/platform/database-size#free-plan-behavior).

## Rules

Code-lookup GitHub QA temporarily creates only `public.qa_cl_<run-derived-suffix>_{pages,codes,universes,oracle}`. The tables use RLS and service-only SELECT grants, with explicit foreign keys between owned clones. The oracle copies the canonical old view against those clones. Finally and independent always-run cleanup verify ownership and remove the finite allowlist; this is not a schema-exposure change, migration, content import or production contract.

The separately dispatched [historical reconciliation job](../operations/release.md) targets only four pinned failed-run artifacts and their exact sixteen possible relations. It verifies artifact provenance and all identities before applying the existing cleanup guards, then records absence separately from the unchanged historical failures.

- Migrations are immutable once committed. CI rejects edits and deletions.
- A new migration must work with the currently running app. Drop old tables or columns only in a later migration, after the app stops using them.
- Never expose the service role or `sb_secret_*` keys to the browser, mobile app or extension.
- Collection and quiz data lives only in the database. The repo holds no runtime content JSON.

## Known issues

- `supabase-meta` has its health check turned off on purpose (it used to leak processes). It's running fine.
- `supabase/config.toml` still has the old local project ID `roblox-codes`. It's harmless.
- `game_generation_queue` and `article_generation_artifacts` have no code left. Drop them in a later migration.

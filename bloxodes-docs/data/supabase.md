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

## Rules

- Migrations are immutable once committed. CI rejects edits and deletions.
- A new migration must work with the currently running app. Drop old tables or columns only in a later migration, after the app stops using them.
- Never expose the service role or `sb_secret_*` keys to the browser, mobile app or extension.
- Collection and quiz data lives only in the database. The repo holds no runtime content JSON.

## Known issues

- `supabase-meta` has its health check turned off on purpose (it used to leak processes). It's running fine.
- `supabase/config.toml` still has the old local project ID `roblox-codes`. It's harmless.
- `game_generation_queue` and `article_generation_artifacts` have no code left. Drop them in a later migration.

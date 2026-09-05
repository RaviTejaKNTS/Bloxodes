# Supabase

Status: Active; production and managed development include the GTA and Roblox collection page-type schema
Last verified: 2026-09-05
Evidence: official Supabase documentation, managed-development migration/readiness/advisor checks, production transactional release/readback, VPS container/process inspection, Edge Function checksum/smoke, and public health

## Managed Development

All workstation web development, content imports, script writes, migration validation, and article queue/writer work use the managed HTTPS `*.supabase.co` development project. Its private credentials live only in `.envs/targets/managed-dev.env` and workload-specific private overlays. Shared guards reject localhost and production when a development-only command runs.

The local Supabase CLI database is retired. Do not start it, generate/store a `local.env`, or use its Postgres/API endpoints for Bloxodes work.

## Production Topology

The self-hosted stack lives under `/home/codex-admin/bloxodes-supabase` and is reached through Traefik/Cloudflare hostnames.

- PostgreSQL: 17.6, ~59 GB.
- API gateway: Kong 3.9.1.
- REST: PostgREST 14.12 plus `supabase-rest-proxy` because direct sibling traffic historically timed out.
- Auth: GoTrue 2.189.0.
- Storage: storage-api 1.60.4.
- Edge Runtime: 1.74.0.
- Studio: 2026.06.03 build.
- Pooler: Supavisor 2.9.5.
- Deployed Bloxodes Edge Functions: `revalidate` and `cache-warm`; vendor/default folders also include `hello` and `main`.

Public unauthenticated health-shaped routes returning `401` is expected where an API key/basic auth is required. Storage status returned `200`; application `/api/health` database check returned healthy.

## Health Caveats

- On 2026-08-15, the `supabase-meta` image-level health probe had accumulated about 19,000 unreaped Node child processes over two months and was using about one CPU continuously. Recreating only Meta cleared the processes; Compose now explicitly disables that probe so it cannot recur. Meta remained running and public database traffic was not restarted.
- `supabase-rest` is Docker-unhealthy because the configured probe calls `localhost:3001/ready`, which refuses the connection.
- Public REST returns the expected authenticated boundary and the app reads production successfully through Kong/proxy.

The remaining REST state is a monitoring defect, not a data-plane outage. Align its probe with the proxy topology in a separate tested change.

## Retired Local Stack

The old Bloxodes CLI project was named `roblox-codes` and leftover containers were observed on the verification date. They are historical workstation state, not an active environment. Removal can happen separately after confirming no unrelated work depends on them.

## 2026 Upgrade Watch

Official changelog items relevant to this self-hosted installation:

- Envoy became the default gateway in August 2026. Production still uses Kong and a custom REST proxy, so upgrades must deliberately retain/test this topology or migrate it.
- `API_EXTERNAL_URL` now includes `/auth/v1` in current self-hosted defaults. Verify OAuth/SAML callback assumptions before adopting vendor env changes.
- Analytics and Vector became opt-in. Current production container inventory does not include those vendor services; Umami is a separate application stack.
- Studio/Postgres Meta moved from `supabase_admin` to `postgres`; review ownership and re-enable a proven bounded Meta probe before vendor upgrades.
- Default self-hosted Postgres moved to 17. Production is already on Postgres 17; do not remove the production PG17 override without reviewing the vendor compose.
- Current Supabase client libraries require Node 22+; Bloxodes builds/runs with Node 24.

## Schema and Security

- Add forward-only migrations under `supabase/migrations/` using the current CLI workflow in `supabase/AGENTS.md`.
- `supabase/migration-policy.json` preserves the audited reconciliation record. Managed development received the four pre-cutoff stats migrations under a recorded baseline; production received the genuine pending wiki/article migrations and four object-proven ledger repairs. Both environments were then converged through `20260920000013_harden_internal_security_definer_execution.sql` on 2026-08-14.
- The convergence migration moves the privileged admin implementation into a private schema and narrows queue, worker, chart, and pipeline-health RPC execution. Readback confirmed the private admin function, expected service-role execution, and removal of anonymous execution for the protected RPCs in both environments.
- Migration `20260920000014_repair_wiki_pages_view.sql` corrects an object-level production drift where the ledger recorded the earlier view migration but the live view still lacked `universe_game_description_md` and `last_playing_refreshed_at`. It recreates only the read view and grants, without changing source-table data.
- Managed-development migrations use the authenticated Supabase connector, followed by migration listing, readiness, and advisors; its database password is deliberately not duplicated into workstation or CI env. Self-hosted production uses the exact-SHA `supabase:production:release` operator command, which streams one atomic transaction into the existing database container. SSH is the default transport; the explicit `--transport dokploy` fallback uses Dokploy's owner-authenticated terminal WebSocket and is hard-coded to `supabase-db` when the dedicated SSH key is unavailable. Plan mode rolls the transaction back; apply mode requires separate explicit confirmation and commits atomically. SSH forwarding and public Postgres remain disabled.
- `npm run supabase:production:release -- --approved-sha <full-sha>` is now also the repeatable read-only proof that production remains converged: when no repository migration is pending, it completes its transaction plan and rolls back without applying changes.
- The production `revalidate` Edge Function matches the checked-in source as of 2026-08-14. Use `npm run supabase:production:function:release -- --function revalidate --approved-sha <full-sha>` for checksum-only planning; applying a changed function additionally requires `--apply --confirm "APPLY revalidate"`, performs an authenticated smoke test, and rolls back the function file if restart/smoke fails.
- Keep RLS on exposed tables and never expose service-role keys to clients.
- Views exposed to anon/authenticated roles need security-invoker behavior or explicit privilege review.
- Revalidation/cache queues are part of runtime freshness; schema changes affecting public content must update their event mapping.
- The GTA vertical is intentionally separate from Roblox data: `gta_games`, `gta_wiki_pages`, `gta_wiki_collection_pages`, and immutable `gta_wiki_collection_datasets`/`gta_wiki_collection_items`. GTA collection pages use `page_type` (`database` or `checklist`), while signed-in checklist progress is stored separately in `user_gta_collection_progress` and accessed only through the server-side `/api/gta/collections/progress` route; signed-out progress remains in the browser. GTA hub media uses distinct `gta_games.cover_image` (card/social artwork) and `gta_games.hero_image` (enforced-square title thumbnail) values, with the active URLs pointing to canonical Bloxodes wiki-media R2 objects after `sync:gta-wiki-media`. Roblox collection pages use the same `page_type` contract on `wiki_collection_pages`, but reuse the existing `user_checklist_progress` table under the `wiki-collection:<code>` namespace through `/api/wiki/collections/progress`. Public web reads remain server-side through the service role; base-table grants are revoked from `anon` and `authenticated`, RLS stays enabled, and read views use security-invoker behavior. Managed development and production both have the GTA and Roblox collection page-type schema. Production verification found 173 published GTA collection pages, 7,529 active GTA items, and the exact 19 approved Roblox checklist conversions with 1,134 items. GTA VI remains unpublished, and the excluded Red Dead migration/table counts are both zero. No GTA tools table or route is present until there is a real tool to publish.

## Backups

Database and Storage backup/recovery work is explicitly deferred by the owner. The VPS retains original 2026-06-12 managed-to-self-hosted dump/restore artifacts, but this change does not inspect, modify, validate, or automate them. A later dedicated run must own retention, off-host copies, and tested restores.

# Supabase

Status: Active with known degraded health probes
Last verified: 2026-08-13
Evidence: official Supabase changelog, local CLI 2.75.0/Docker, VPS containers, production PostgreSQL queries, and public endpoints

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

## Known Health Caveats

- `supabase-meta` is Docker-unhealthy and its health command aborts/core-dumps.
- `supabase-rest` is Docker-unhealthy because the configured probe calls `localhost:3001/ready`, which refuses the connection.
- Public REST returns the expected authenticated boundary and the app reads production successfully through Kong/proxy.

These are not reasons to call the whole data plane down, but they are real monitoring defects. Fix the underlying Meta failure and align the REST health check with the proxy topology.

## Local Stack

The Bloxodes CLI project is `roblox-codes`; it was running on verification date. CLI `supabase status` hung against the local Docker backend during this audit, while a direct Docker listing confirmed the main containers. Use `npx supabase --help` before CLI operations because the installed version is 2.75.0 and command availability varies.

## 2026 Upgrade Watch

Official changelog items relevant to this self-hosted installation:

- Envoy became the default gateway in August 2026. Production still uses Kong and a custom REST proxy, so upgrades must deliberately retain/test this topology or migrate it.
- `API_EXTERNAL_URL` now includes `/auth/v1` in current self-hosted defaults. Verify OAuth/SAML callback assumptions before adopting vendor env changes.
- Analytics and Vector became opt-in. Current production container inventory does not include those vendor services; Umami is a separate application stack.
- Studio/Postgres Meta moved from `supabase_admin` to `postgres`; ownership and the current Meta crash must be checked before vendor upgrades.
- Default self-hosted Postgres moved to 17. Production and local are already on Postgres 17; do not remove the production PG17 override without reviewing the vendor compose.
- Current Supabase client libraries require Node 22+; Bloxodes builds/runs with Node 24.

## Schema and Security

- Add forward-only migrations under `supabase/migrations/` using the current CLI workflow in `supabase/AGENTS.md`.
- Keep RLS on exposed tables and never expose service-role keys to clients.
- Views exposed to anon/authenticated roles need security-invoker behavior or explicit privilege review.
- Revalidation/cache queues are part of runtime freshness; schema changes affecting public content must update their event mapping.

## Backups

The VPS retains original 2026-06-12 managed-to-self-hosted dump/restore artifacts under the Supabase `backups/` directory. This audit verified their presence, not restore viability. A future backup/recovery runbook must record current recurring backup ownership, retention, off-host copies, and a tested restore date.

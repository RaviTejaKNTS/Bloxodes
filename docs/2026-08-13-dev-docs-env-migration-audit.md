# Developer Docs and Environment Migration Audit

Date: 2026-08-13
Status: Implemented in `codex/dev-docs-env-structure` worktree; not yet merged or deployed

## Decision

- `dev-docs/` is the stable, current-state documentation home. Each page covers one architecture, infrastructure, operation, data environment, or pipeline concern and records `Last verified` plus its evidence boundary.
- `docs/`, `Writing plans/`, and legacy `agents/` narratives are rough notes, plans, reports, and historical evidence. New rough Markdown notes use `YYYY-MM-DD-topic.md` names.
- Real workstation values live only in ignored `.envs/`. Safe committed variable contracts live under `env/examples/`.
- Development defaults to the managed HTTPS `*.supabase.co` project. The local Supabase CLI target is retired; `dev:local` is only a compatibility alias for a local Next.js process using managed development. Production preview remains explicit, while production and tests are process-only.

## Losslessness Proof

Before removing legacy worktree links, `npm run env:verify` found 126 unique key/value pairs across the legacy dotenv sources and confirmed every pair existed in the new tree. The Google indexing service-account JSON matched byte-for-byte. Its configured path was intentionally changed from `.env.secrets/` to `.envs/secrets/`.

`npm run env:check` then confirmed 119 stored variable names were covered by 16 committed example files and checked private-file permissions. Legacy source files remain available in the main checkout and the original pre-migration backup. The isolated worktree no longer contains a local-database target, and a separate managed-dev-only fallback snapshot was created without modifying the original backup.

## Live Evidence Sample

- Public app health returned 200 with database health, cache/revalidation flags, a current stats index, and deployed SHA `0c6b5f66…`.
- Production PostgreSQL was 17.6 at roughly 59 GB with 100 public tables. REST/auth/storage endpoints behaved as expected through the public gateway.
- VPS was Ubuntu 24.04 with 4 CPU, 15 GiB RAM, a 193 GB filesystem at 57%, and near-full 2 GiB swap. Web, Dokploy, Traefik, Supabase, Umami, and scheduled worker containers were present.
- Homelab discovery/curation timers were healthy; article writing was blocked externally by a Grok Build 402 balance error.
- Production `supabase-meta` and the direct `supabase-rest` health probe were degraded even though Studio authentication, public REST, and application database checks responded.
- The stats pipeline remained operational but degraded by the scheduler/capacity/index-ordering defects summarized in `dev-docs/pipelines/stats.md`.

## Verification Boundary

All infrastructure inspection was read-only. No production database rows, containers, cron schedules, Cloudflare configuration, Dokploy configuration, or homelab services were changed by this migration.

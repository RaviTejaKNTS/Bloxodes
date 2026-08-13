# Data Environments

Status: Active
Last verified: 2026-08-13
Evidence: env target inspection, managed-development URL guard, local web health, homelab readiness output, public health, and production read-only counts

## Workstation Development

- Database target: managed Supabase development at HTTPS `*.supabase.co`.
- Web runtime: the Next.js process runs on the workstation; both `npm run dev` and `npm run dev:managed` load `.envs/targets/managed-dev.env`.
- Purpose: schema/migration development, content preview/import verification, mutation tests, and safe page work.
- Write rule: managed-development-first for content and migration work. Production remains explicit and separately guarded.
- Retired boundary: do not start, target, synchronize, or store credentials for a local Supabase CLI database.

## Managed Development

- Endpoint class: HTTPS `*.supabase.co`.
- Stored as `.envs/targets/managed-dev.env` and article-prefixed credentials in `.envs/pipelines/articles.env`.
- Purpose: shared development database, article discovery queue, and Grok writer staging from the homelab.
- Guard: shared target validation and `scripts/articles/article-queue-env.ts` accept only HTTPS managed Supabase project URLs and reject localhost and production.
- It is remote but non-production. Do not call it “local.”

## Production

- API: `https://database.bloxodes.com`.
- Media: `https://media.bloxodes.com`.
- Runtime: self-hosted Supabase/Postgres 17 on the VPS.
- Workstation storage: `.envs/targets/production.env` exists for explicit operator reads/previews and migration tools; it is never an implicit production fallback.
- Deployed storage: GitHub/Dokploy/VPS/Supabase host secret stores.
- Write rule: explicit command flag/profile plus the script's production guard; content publication uses controlled idempotent upsert/seed/migration workflows.

## Local Datasets

`data/` and `apps/web/src/data/` are committed application data, not env targets. They power game collections, catalog/tool datasets, error/dictionary data, and other structured content. Follow `data/AGENTS.md` for schema/renderer ownership.

Machine-consumed inputs should live under `data/` or a pipeline-specific input folder. Do not add new executable inputs to rough `docs/` notes.

## Sync Boundaries

- `npm run sync:managed-dev-public-sample` reads the public production projection and targets only verified managed development. It is dry-run by default and writes only with `--apply`.
- Article production inventory is a read-only public projection at `/api/articles/editorial-inventory`; the writer queue itself stays in managed development.
- Production storage URLs must use `media.bloxodes.com`, including when jobs connect to Supabase through the VPS-private Kong network.
- Database schema flows forward as a reviewed migration: repository integrity check, managed-development plan/apply/readiness/advisors, explicit production approval, production plan/apply/readback/health/advisors. Database rows are not synchronized by cloning one environment over another.

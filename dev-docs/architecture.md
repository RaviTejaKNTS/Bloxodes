# Architecture

Status: Active; production has documented degraded components
Last verified: 2026-08-27
Evidence: repository architecture/configuration, exact-SHA public health, managed-development/production migration readback, VPS Docker/Swarm and Edge Function checks, homelab synchronization checks, and local wiki database/R2 runtime tests

## Product Surfaces

- Web: Next.js App Router in `apps/web`; the production image is built from the root `Dockerfile` and runs the standalone server at `apps/web/server.js`.
- Extension: Chrome MV3 in `apps/extension`; it calls Bloxodes `/api/extension/*` routes and never receives Supabase private keys.
- Admin extension: personal unpacked-only Chrome MV3 popup in `apps/admin-extension`; it calls `/api/admin/*` on the origin of the current tab with a bearer `ADMIN_API_TOKEN` and is never packaged, published, or deployed.
- Mobile: Expo Router in `apps/mobile`; it calls `/api/mobile/*`, uses optional bearer authentication, and does not connect directly to Supabase.
- Data/content jobs: root `scripts/` grouped by pipeline, with stable npm aliases in `package.json`.
- Database functions: migrations and Edge Functions under `supabase/`.

## Production Request Path

1. `bloxodes.com` is proxied by Cloudflare.
2. Cloudflare reaches Traefik on the Hostinger VPS.
3. Traefik routes to the Dokploy Swarm service `bloxodes-web-ujegas`.
4. The healthy web container serves Next.js on internal port 3000.
5. Server-side reads and mutations use self-hosted Supabase through `https://database.bloxodes.com`.
6. Public storage URLs use `https://media.bloxodes.com`.

The wiki-collection runtime uses the shared private `bloxodes-wiki` R2 bucket through the exact path-scoped `media.bloxodes.com/wiki/*` Worker. All other production media paths continue to use the Supabase media origin. Managed development and production store the same canonical immutable media URLs while using separate database publication pointers.

Verified live on 2026-08-14:

- `/api/health` returned `200`, database `ok`, an immutable production commit SHA, tag purge enabled, and a fresh stats index.
- The public home page returned Cloudflare `HIT` with the current cache/security headers.
- Direct public access to VPS port 3000 timed out; Docker publishes it for Dokploy, while the host `DOCKER-USER` chain drops inbound traffic to that port.

## Production Data Plane

The primary production store is self-hosted Supabase on the same VPS:

- PostgreSQL 17.6, approximately 59 GB on verification date.
- Kong 3.9.1 remains the API gateway; the stack has not adopted Supabase's 2026 Envoy default.
- PostgREST 14.12 plus a `supabase-rest-proxy` bridge.
- GoTrue, Storage, Realtime, Studio, Meta, Supavisor, Edge Runtime, and Imgproxy.
- Public API: `database.bloxodes.com`.
- Studio: `studio.bloxodes.com`, protected and returning `401` without credentials.
- Media: `media.bloxodes.com`.
- Legacy `bloxodesdb.ravitejaknts.com` and `bloxodesstudio.ravitejaknts.com` still respond and should be treated as compatibility aliases, not preferred docs URLs.

Current scale sampled read-only on 2026-08-13:

- 4,024 code pages and 58,633 code rows.
- 419 articles, 57 wiki hubs, and 439 wiki collection pages.
- 63 global catalog pages, 13 tools, 22 events pages, 14 checklists, and 13 quizzes.
- 100,082 tracked universes, 69,370 catalog items, 59,436 music IDs, and 38,430 decal IDs.

## Automation Plane

- VPS `codex-admin` crontab owns universe stats, item stats, codes, indexing, events, puzzles, catalog, music IDs, decals, promo rewards, free items, revalidation, and cache warming.
- The worker runs ephemeral `bloxodes-stats-worker:production` containers on the private `supabase_default` network and normally points database traffic at `http://supabase-kong:8000`.
- Managed Supabase development owns all workstation/non-production database work; homelab systemd owns article discovery/curation and managed-dev article writing.
- GitHub Actions owns immutable web image build/deploy and retains manual fallback workflows for several scheduled pipelines.
- Production database events flow through `revalidation_events` and `cache_warm_events`; VPS minute cron invokes the two Edge Function workers.

## Wiki Collection Data Plane

- `wiki_collection_pages.published_dataset_id` selects one immutable `wiki_collection_datasets` revision; normalized item rows live in `wiki_collection_items`.
- Public web and mobile responses read collection runtime rows server-side with the service role. The new tables have no anonymous/authenticated grants.
- Content-addressed item media lives in one shared R2 bucket. Managed development and production use the same GET/HEAD/OPTIONS Worker URLs; separate database pointers control publication.
- The publisher verifies local data/media, every R2 object, inserted item count, and revision ownership before it changes the page pointer. New content publication is therefore database/R2-only and does not require a web build.
- `database-first` retains the registered local datasets as a migration fallback. Production activation requires managed-development schema/route verification first and separate production approvals for schema, Worker routing, and content publication.

## Caching

Cloudflare is the long-lived public cache. The origin uses Next.js ISR-style responses and public cache tags. Supabase-backed public content is not wrapped in a second long-lived application data cache. Mutation/release flows enqueue revalidation events, purge targeted Cloudflare tags, and defer page warming to a separate queue.

## Known Degraded State

- The `supabase-meta` image-level health probe is explicitly disabled after it accumulated unreaped Node processes and overloaded the shared host; Meta itself remains running and Studio still responds behind authentication.
- `supabase-rest` is marked unhealthy because its probe targets `localhost:3001/ready`; public REST and application database checks work through the proxy/gateway topology.
- VPS swap was effectively full (2 GiB used) with 15 GiB RAM and about 8.7 GiB available memory.
- The earlier homelab Grok Build `402 Payment Required` failure is historical; the latest audited discovery and writer services succeeded.
- Universe stats had an active end-to-end incident audit started 2026-08-12. Current public health was green, but the audit identified scheduler/index ordering, capacity, NEW quarantine, growth-baseline, daily-rank, and alerting defects. See `pipelines/stats.md`.

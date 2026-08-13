# Bloxodes Developer Documentation

Status: Active
Last verified: 2026-08-13
Evidence: current worktree code/configuration plus read-only production, VPS, homelab, Cloudflare, Docker, managed-development, and Supabase checks performed on 2026-08-13

## Authority

Use these sources in this order:

1. Running code and deployed configuration are the source of truth.
2. The closest path-scoped `AGENTS.md` contains mandatory working rules.
3. `dev-docs/` describes the currently verified architecture and operations.
4. `docs/`, `Writing plans/`, and `agents/` are historical notes, plans, audits, reports, and legacy inventories. They are evidence leads, not current-state authority unless a canonical file links to them.

Every canonical document includes a `Last verified` date and evidence boundary. If that date is old or the described system changed, recheck the code and live service before acting.

## Maintenance Contract

- Update the existing owning document in place whenever its code, configuration, live topology, or operational behavior changes.
- Keep canonical filenames stable. Do not create `v2`, `new`, replacement, or dated copies for the same current-state subject.
- Refresh `Last verified` only for evidence actually rechecked; record unavailable boundaries and degraded state honestly.
- Create a new canonical page only for a genuinely new system or pipeline with no existing owner, and add it to this index immediately.
- Use `docs/YYYY-MM-DD-topic.md` for plans, investigations, incident records, and point-in-time audits. Fold verified current-state conclusions back into the existing canonical page.

## Current System Map

```text
Visitors / mobile / extension
            |
       Cloudflare
            |
   Dokploy Traefik on VPS
            |
      Next.js web app
            |
  self-hosted Supabase API
            |
      PostgreSQL 17

VPS codex-admin cron ----> stats, codes, catalog, indexing, puzzles, events
VPS Postgres cron bridge -> revalidation and cache-warm Edge Functions
Homelab systemd ---------> article discovery and managed-dev article queue
GitHub Actions ----------> web image build/deploy and manual fallback jobs
```

## Canonical Documents

- [Architecture](architecture.md): deployed components, applications, data boundaries, and request/data flows.
- [Environment system](environment.md): profiles, overlays, storage, loading precedence, examples, migration, and external secret owners.
- [Data environments](data/data-environments.md): managed workstation development, production, datasets, and write safety.
- [Production Supabase](data/supabase.md): managed-development boundary, live self-hosted topology, migration convergence, current versions, known health caveats, and upgrade watch items.
- [VPS](infrastructure/vps.md): host, security, resources, containers, schedules, and operational risks.
- [Docker](infrastructure/docker.md): web/worker images, build-secret boundary, local containers, and Compose.
- [Dokploy](infrastructure/dokploy.md): Swarm deployment ownership, access, runtime env, and health gates.
- [Cloudflare](infrastructure/cloudflare.md): DNS/proxy, caching, revalidation, origin policy, and emergency cache.
- [Homelab](infrastructure/homelab.md): article automation host and current service health.
- [Deployment](operations/deployment.md): production branch through GHCR, Dokploy, schema release controls, platform synchronization, health verification, purge, and smoke tests.
- [Revalidation and cache](operations/revalidation-cache.md): database events through Edge Functions, Next revalidation, Cloudflare purge, and deferred warm.
- [Stats pipeline](pipelines/stats.md): universe and item stats workers, cron ordering, reads, and current incident state.
- [Codes pipeline](pipelines/codes.md): page ownership, source fields, refresh schedule, publication, and safety.
- [Article pipeline](pipelines/articles.md): discovery, curation, managed-dev writing, review, media, and production publication.
- [Catalog and collection pipelines](pipelines/catalog-collections.md): Roblox global catalog, local game collections, images, and page records.
- [Content and engagement pipelines](pipelines/content.md): wiki, tools, events, quizzes, checklists, puzzles, and generic final import flow.
- [Indexing and distribution](pipelines/indexing-distribution.md): Google Indexing, IndexNow, sitemaps/feeds, analytics, and social posting.

## Verification Policy

When updating the existing canonical document:

1. Check code and checked-in deployment manifests.
2. Check the relevant live service read-only when access exists.
3. Record the date, evidence, and any unavailable boundary.
4. State degraded conditions explicitly; do not rewrite them as intended behavior.
5. Update the closest `AGENTS.md` only when an enduring working rule or ownership link changed.

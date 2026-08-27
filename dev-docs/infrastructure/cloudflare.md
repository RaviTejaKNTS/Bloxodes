# Cloudflare

Status: Active
Last verified: 2026-08-27
Evidence: public DNS/headers, app health features, deployment workflow, cache code, VPS firewall, shared R2 bucket setup, and the local wiki-media Worker contract/tests

## Role

Cloudflare proxies public web, database, Studio, and media hostnames. It is the long-lived public HTML cache and supports tag-based invalidation.

The existing `media.bloxodes.com` Supabase media origin remains unchanged outside `/wiki/*`. The exact path-scoped Worker route `media.bloxodes.com/wiki/*` serves the shared `bloxodes-wiki` R2 bucket. Managed development and production store the same canonical wiki media URLs; their separate database publication pointers decide which revisions are visible.

## Wiki R2 Media

- `bloxodes-wiki` is the only wiki collection media bucket. Only the guarded publisher has its bucket-scoped S3 credential. Web and mobile runtimes receive public URLs, never R2 credentials.
- `workers/wiki-media` exposes GET, HEAD, and OPTIONS only. PUT/DELETE are rejected; uploads happen only through the guarded server-side sync script.
- R2 keys are immutable and content-addressed. Responses use exact MIME metadata, `nosniff`, CORS, ETag, and one-year immutable caching.
- The Worker caches successful GET responses and returns uncached 404s. The database page pointer is updated only after the publisher verifies every referenced object.
- The deployed route is exactly `media.bloxodes.com/wiki/*`; never route the whole production media hostname to this Worker. Existing Supabase Storage paths such as `/storage/*` remain on the original media origin.
- The 2026-08-27 managed-development migration stored and served 9,225 collection objects across 184 published revisions. Representative canonical objects returned the declared MIME type with immutable caching; missing objects returned 404 and public PUT was rejected.

Verified public home response:

- `cf-cache-status: HIT`;
- `cache-control: s-maxage=3600, stale-while-revalidate=31532400`;
- security/CSP headers present;
- HTTP/3 advertised;
- Next cache metadata visible behind the edge.

## Cache Contract

- Cache anonymous public HTML only for successful origin responses.
- Bypass APIs, auth/account/session/mutation paths, and errors.
- Public route families emit Cloudflare cache tags from `apps/web/src/lib/public-cache-tags.ts`.
- `/api/revalidate` maps database events to Next paths and Cloudflare tags.
- Warm requests are queued and processed separately so purge/revalidation does not block on page fetches.

## Deployment Purge

The production workflow uses the deployment-scoped Cloudflare token and zone ID to purge targeted tags after runtime changes. A full purge requires explicit workflow input.

## Operator Emergency Cache

`npm run cloudflare:emergency-cache:*` loads the separate operator token from `.envs/infrastructure/cloudflare.env`. The emergency public HTML rule must remain off during normal operation and is only for an origin/database incident.

## Origin Security Caveat

The VPS has Cloudflare network allow rules but also public-anywhere 80/443 rules. Treat “Cloudflare-only origin” as not fully verified until the effective `bloxodes-origin-firewall.sh` behavior is audited and public rules are reconciled.

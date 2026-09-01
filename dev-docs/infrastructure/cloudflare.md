# Cloudflare

Status: Active
Last verified: 2026-08-13
Evidence: public DNS/headers, app health features, deployment workflow, cache code, and VPS firewall

## Role

Cloudflare proxies public web, database, Studio, and media hostnames. It is the long-lived public HTML cache and supports tag-based invalidation.

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

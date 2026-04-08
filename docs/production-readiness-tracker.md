# Production Readiness Tracker

This document tracks the remaining work to get the VPS deployment to a strong production level and as close as practical to the current Vercel experience.

## Current State

- `bloxodes.com` is live from the VPS through Dokploy and Cloudflare.
- `www.bloxodes.com` now redirects to `https://bloxodes.com` through the VPS deployment.
- `ravitejaknts.com` is still available as the test host, but because the canonical host is now `bloxodes.com` it redirects to the production domain.
- `bloxodes.ravitejaknts.com` is live as the Dokploy admin panel over HTTPS.
- The repo deploy source of truth is `RaviTejaKNTS/Bloxodes`.
- Dokploy deploys from the `production` branch.
- GitHub Actions can trigger Dokploy deploys automatically on `production`.
- `bloxodes.com` and `www.bloxodes.com` have been cut over from Vercel to the VPS.
- The Cloudflare zone has been cleaned up to a normalized production shape:
  - `A @ -> 187.124.68.197` proxied
  - `CNAME www -> bloxodes.com` proxied
  - Vercel-origin apex and `www` records have been removed
- Cloudflare SSL/security baseline is now verified:
  - `ssl = full` temporarily while the origin serves Traefik's default certificate for `bloxodes.com`
  - `always_use_https = on`
  - `min_tls_version = 1.2`
  - `automatic_https_rewrites = on`
  - `tls_1_3 = on`
  - `http3 = on`
  - `brotli = on`
  - `rocket_loader = off`
- `Smart Tiered Cache` is enabled.
- One Cloudflare Cache Rule is active:
  - `Cache public content by origin headers`
  - action: `Eligible for cache`
  - edge TTL mode: `bypass_by_default`
- The rule is working on cache-friendly routes now:
  - `https://bloxodes.com/` is returning `cf-cache-status: HIT`
  - `https://bloxodes.com/codes/99-nights-in-the-forest` warms from `MISS` to `HIT`
- A scoped Cloudflare purge token has been created and verified against the `bloxodes.com` zone.
- The Dokploy app now has `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ZONE_ID` configured and has been redeployed once to pick them up.
- GitHub repository Actions secrets are now populated for the current automation workflows, including Dokploy deploy, Cloudflare purge, Supabase, OpenAI, Roblox Open Cloud, Telegram, Twitter, Google Custom Search, and revalidation.
- GitHub repository Actions variables now include the Dokploy target, Cloudflare zone id, the production health-check host (`https://bloxodes.com`), and public runtime values such as `NEXT_PUBLIC_SITE_URL` and Supabase public keys.
- Dokploy runtime values now use the production domain:
  - `SITE_URL=https://bloxodes.com`
  - `NEXT_PUBLIC_SITE_URL=https://bloxodes.com`
  - `REVALIDATE_ENDPOINT=https://bloxodes.com/api/revalidate`
- Canonicals and robots on `bloxodes.com` are verified back in production mode:
  - content pages emit `index, follow`
  - canonical URLs point at `https://bloxodes.com/...`

## What Is Still Needed

### 1. Restore `Full (strict)` SSL

- The VPS origin is still serving Traefik's default certificate for `bloxodes.com` and `www.bloxodes.com`.
- Cloudflare is temporarily running in `Full` mode so production traffic can stay up while the main domain uses the VPS origin.
- We still need to:
  - confirm Dokploy/Traefik issues a valid origin certificate for `bloxodes.com` and `www.bloxodes.com`
  - switch Cloudflare SSL mode back to `Full (strict)`
  - re-test both the apex and `www` hosts after the change

Status:

- DNS normalization: done
- production DNS cutover to VPS: done
- `Full (strict)`: pending
- temporary `Full`: done
- `Always Use HTTPS`: done
- `Minimum TLS Version 1.2`: done
- `Automatic HTTPS Rewrites`: done
- `HTTP/3`: done
- `Brotli`: done
- `Rocket Loader off`: done
- `Tiered Cache / Smart Topology`: done

Reference: `docs/cloudflare-setup.md`

### 2. Cache rules for Vercel-like speed

- Cache public HTML pages at the edge.
- Cache static assets aggressively.
- Bypass cache for `/api/*`, auth, login, account, and any user-specific routes.
- Keep Cloudflare purge wired for both code deployments and content revalidation events.

This is the main speed lever. Without Cloudflare HTML caching, the VPS will not feel close to Vercel on public content pages.

Repo status:

- code-deploy purge is now wired in `.github/workflows/dokploy-production-deploy.yml`
- runtime content purge is now wired in `src/app/api/revalidate/route.ts`
- Dokploy now has `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ZONE_ID`
- GitHub Actions now has the Cloudflare token and zone id needed for post-deploy purge automation
- `PRODUCTION_SITE_URL` now points to `https://bloxodes.com`

Cloudflare status:

- the first production Cache Rule is live and verified in the Cloudflare ruleset API
- public VPS HTML is now cacheable on the production host
- runtime Cloudflare purge is configured on the VPS app and now targets `bloxodes.com`
- no Cache Response Rules are configured

### 3. Lock the origin down

- Now that `bloxodes.com` is live on Cloudflare, restrict origin traffic on `80/443` to Cloudflare IPs only.
- Do not leave the VPS directly reachable from the public internet once the production domain is cut over.
- Keep SSH restricted separately.

### 4. Protect the admin surface

- Keep Dokploy on `bloxodes.ravitejaknts.com`.
- Put that admin domain behind Cloudflare Access, or keep SSH tunnel access as the fallback path.
- Do not rely on Dokploy itself as a read-only viewer panel.

### 5. Rotate exposed credentials

These values were shared during setup and should be rotated:

- VPS `root` password
- VPS `codex-admin` password
- Dokploy password
- any temporary API tokens created during setup

### 6. Add backups and restore testing

- Dokploy app config backup
- database backup strategy
- Docker volume backup strategy
- env/secrets recovery process
- one actual restore test

### 7. Add monitoring and alerts

- uptime checks for `/`
- uptime checks for `/api/health`
- CPU, memory, disk, and swap monitoring
- container restart/failure alerts
- failed deploy alerts

## Historical Note: Split-Host Freshness

This applied during the transition window when `bloxodes.com` was still on Vercel and `ravitejaknts.com` was the VPS test domain.

- `bloxodes.com` and `ravitejaknts.com` are two different live deployments.
- They share the same content source in Supabase.
- They do **not** share the same Next.js ISR/data cache.

Important repo details:

- article detail pages are set to weekly ISR in `src/app/(site)/articles/[slug]/page.tsx`
- the articles index page is also set to weekly ISR in `src/app/(site)/articles/page.tsx`
- article data is cached in `src/lib/db.ts` with multi-hour or weekly revalidation
- on-demand revalidation exists at `src/app/api/revalidate/route.ts`
- Supabase database triggers enqueue revalidation events in `public.revalidation_events`
- the Supabase edge function at `supabase/functions/revalidate/index.ts` drains that queue and POSTs to a single `REVALIDATE_ENDPOINT`

That means the current system already supports automatic publish revalidation, but only for one live host at a time.

Today, if `REVALIDATE_ENDPOINT` in Supabase points to `https://bloxodes.com/api/revalidate`, then the Vercel production site refreshes immediately and the VPS test deployment stays stale until:

- the VPS deployment's own `/api/revalidate` endpoint is called, or
- its ISR/data cache expires naturally

## What To Change For Content Freshness

The app on the VPS can revalidate the same way Vercel does. There is nothing Vercel-only about `src/app/api/revalidate/route.ts`.

The important part is keeping the Supabase edge function pointed at the production domain:

- `https://bloxodes.com/api/revalidate`

If the Supabase function already points to `https://bloxodes.com/api/revalidate`, then once DNS moves `bloxodes.com` from Vercel to the VPS, the same revalidation flow will continue to work without any code or architecture change. Only the destination host changes.

Decision for this migration:

- do not add dual-host revalidation
- keep `REVALIDATE_ENDPOINT` on `https://bloxodes.com/api/revalidate`
- accept that `ravitejaknts.com` may be stale between publish events and final cutover
- verify the endpoint one more time during cutover testing

## Cutover Result

`bloxodes.com` has now been cut over to the VPS successfully. The remaining execution order is:

1. restore `Full (strict)` once the origin certificate is valid
2. restrict `80/443` on the VPS to Cloudflare IPs
3. rotate exposed credentials
4. add backups and run one restore test
5. add monitoring and alerts
6. decide whether `ravitejaknts.com` remains a non-indexed staging host or is retired

## Related Docs

- `docs/vps-deploy.md`
- `docs/cloudflare-setup.md`
- `docs/vps-security-hardening.md`
- `docs/bloxodes-main-domain-cutover.md`

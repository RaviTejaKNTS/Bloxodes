# Production Readiness Tracker

This document tracks the remaining work to get the VPS deployment to a strong production level and as close as practical to the current Vercel experience.

## Current State

- `ravitejaknts.com` is live from the VPS through Dokploy.
- `bloxodes.ravitejaknts.com` is live as the Dokploy admin panel over HTTPS.
- The repo deploy source of truth is `RaviTejaKNTS/Bloxodes`.
- Dokploy deploys from the `production` branch.
- GitHub Actions can trigger Dokploy deploys automatically on `production`.
- `bloxodes.com` is still serving the Vercel deployment.

## What Is Still Needed

### 1. Cloudflare for the production domain

- Put `bloxodes.com` and `www.bloxodes.com` behind Cloudflare.
- Use proxied DNS.
- Use `Full (strict)` SSL.
- Enable Brotli, HTTP/3, Tiered Cache, and Automatic HTTPS Rewrites.
- Keep Rocket Loader disabled because of Mediavine Journey.

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
- remaining step is to provide `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ZONE_ID`, and Cloudflare dashboard setup

### 3. Lock the origin down

- After Cloudflare is live for `bloxodes.com`, restrict origin traffic on `80/443` to Cloudflare IPs only.
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

## Why Vercel Updated But The VPS Did Not

This is expected with the current split setup.

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

## Do We Need To Move To `bloxodes.com` Before Cloudflare?

No.

Recommended order:

1. Set up Cloudflare for `bloxodes.com` first.
2. Keep the current live site working while Cloudflare DNS, SSL, cache rules, and WAF are prepared.
3. Test the production domain configuration carefully.
4. Cut `bloxodes.com` over to the VPS only after the app, cache rules, and revalidation flow are ready.

You do **not** need to move the app to `bloxodes.com` first before starting the Cloudflare work.

## Recommended Execution Order

1. Add Cloudflare for `bloxodes.com`.
2. Set up cache rules and add the Cloudflare credentials/zone values for the purge flow that is already wired in code.
3. Verify Supabase `REVALIDATE_ENDPOINT` stays on `https://bloxodes.com/api/revalidate`.
4. Protect Dokploy with Cloudflare Access.
5. Rotate exposed credentials.
6. Add backups and monitoring.
7. Cut `bloxodes.com` over to the VPS.
8. Re-enable indexing on `bloxodes.com`.
9. Retire or keep `ravitejaknts.com` as a non-indexed test/staging host.

## Related Docs

- `docs/vps-deploy.md`
- `docs/cloudflare-setup.md`
- `docs/vps-security-hardening.md`
- `docs/bloxodes-main-domain-cutover.md`

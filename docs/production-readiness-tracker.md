# Production Readiness Tracker

This document tracks the remaining work to get the VPS deployment to a strong production level and as close as practical to the current Vercel experience.

## Current State

- `ravitejaknts.com` is live from the VPS through Dokploy.
- `bloxodes.ravitejaknts.com` is live as the Dokploy admin panel over HTTPS.
- The repo deploy source of truth is `RaviTejaKNTS/Bloxodes`.
- Dokploy deploys from the `production` branch.
- GitHub Actions can trigger Dokploy deploys automatically on `production`.
- `bloxodes.com` is live with Cloudflare nameservers active and is still serving the Vercel deployment.
- The Cloudflare zone has been cleaned up to a normalized production shape:
  - `A @ -> 76.76.21.21` proxied
  - `CNAME www -> cname.vercel-dns.com` proxied
  - duplicate imported Vercel `A` records and wildcard records have been removed
- Cloudflare SSL/security baseline is now verified:
  - `ssl = strict`
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
  - `https://bloxodes.com/robots.txt` returns `cf-cache-status: HIT`
- Public HTML on the current Vercel deployment is still `cf-cache-status: BYPASS` because the live Vercel app still sends `Set-Cookie` on those pages.
- The VPS test deployment does **not** send `Set-Cookie` on public HTML, so this cache rule should become effective for public pages after the final `bloxodes.com` cutover.
- A scoped Cloudflare purge token has been created and verified against the `bloxodes.com` zone.
- The Dokploy app now has `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ZONE_ID` configured and has been redeployed once to pick them up.
- GitHub repository Actions secrets are now populated for the current automation workflows, including Dokploy deploy, Cloudflare purge, Supabase, OpenAI, Roblox Open Cloud, Telegram, Twitter, Google Custom Search, and revalidation.
- GitHub repository Actions variables now include the Dokploy target, Cloudflare zone id, the current health-check host (`https://ravitejaknts.com`), and public runtime values such as `NEXT_PUBLIC_SITE_URL` and Supabase public keys.

## What Is Still Needed

### 1. Cloudflare for the production domain

- Keep `bloxodes.com` and `www.bloxodes.com` on Cloudflare and clean the imported DNS records down to the intended set.
- Normalize apex and `www` records before the VPS origin cutover so routing stays predictable.
- Use proxied DNS for the final production state.
- Use `Full (strict)` SSL.
- Enable Brotli, HTTP/3, Tiered Cache, and Automatic HTTPS Rewrites.
- Keep Rocket Loader disabled because of Mediavine Journey.

Status:

- DNS normalization: done
- `Full (strict)`: done
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
- `PRODUCTION_SITE_URL` intentionally remains `https://ravitejaknts.com` until the final `bloxodes.com` cutover, so deploy health checks still target the current VPS host

Cloudflare status:

- the first production Cache Rule is live and verified in the Cloudflare ruleset API
- current Vercel public HTML still bypasses due to `Set-Cookie`
- VPS public HTML is cache-friendly and ready for this rule after cutover
- runtime Cloudflare purge is configured on the VPS app, but it will only target the final production URLs after `SITE_URL` is switched from `ravitejaknts.com` to `bloxodes.com`
- no Cache Response Rules are configured

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

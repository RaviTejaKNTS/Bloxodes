## Deploying to a VPS with Docker and Cloudflare

This repo is set up as an npm-workspaces monorepo. The production web app lives in `apps/web`, while the root `Dockerfile` remains Dokploy-compatible and builds the web workspace from the repository root.

### Branch strategy

- Keep `main` for general development flow.
- Use `production` as the dedicated Dokploy deploy branch.
- Point Dokploy at the `production` branch in the `Bloxodes` repo.

### 1. Prepare the server

- Install Docker Engine and the Compose plugin.
- Keep this app as a single replica unless you add a shared Next cache handler later.
- Leave the scheduled content jobs in GitHub Actions for now so article generation and scraping do not compete with the web app.

### 2. Prepare environment variables

1. Copy `.env.example` to `.env.production`.
2. Set at minimum:
   - `NEXT_PUBLIC_SITE_URL`
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE`
   - `AUTH_SESSION_SECRET`
   - `REVALIDATE_SECRET`
   - `ROBLOX_OAUTH_CLIENT_ID`
   - `ROBLOX_OAUTH_CLIENT_SECRET`
   - `ROBLOX_OAUTH_LOGIN_REDIRECT_URI`
3. Add any optional integration secrets you already use in GitHub Actions or production.
4. Keep the build-time env file on the server before running `docker compose build`, because the Next.js build reads it while prerendering pages.
5. For plain Docker Compose, this is usually `.env.production`.
6. For Dokploy, keep using the env file shape Dokploy provides in the build workspace. In this repo, both `.env` and `.env.production` are intentionally allowed into the Docker build context because `next build` talks to Supabase during static generation.

### 3. Run the app

```bash
docker compose build
docker compose up -d
```

The app listens on port `3000` inside the container and exposes `/api/health` for health checks.

### 4. Cloudflare settings

- Proxy the DNS record through Cloudflare.
- Use `Full (strict)` SSL.
- Enable compression and Tiered Cache.
- Disable Rocket Loader globally, or at minimum keep it off for the Mediavine Journey script.
- Do not use blanket script deferral/minification on the Journey wrapper.

### 5. Cache rules

Use Cloudflare cache rules that respect the origin `Cache-Control` headers from `apps/web/next.config.js`.

- Cache public HTML using the origin headers.
- Cache static assets aggressively: `/_next/static/*`, images, icons, fonts, `robots.txt`, and sitemap files.
- Bypass cache for `/api/*`, `/auth/*`, `/account*`, `/login*`, and any other user-specific or mutation routes.
- Keep a persistent Docker volume mounted at `/app/apps/web/.next/cache` so ISR output survives restarts.

### 6. Ads and consent

- Journey and Google Analytics now load client-side after consent is resolved.
- The public HTML is consent-neutral, so CDN caching does not conflict with GDPR-region behavior.
- Keep `ads.txt` reachable and unchanged after cutover.

### 7. Cutover checklist

1. Deploy on a staging subdomain first.
2. Confirm `/api/health` returns `200`.
3. Confirm `/api/revalidate` still refreshes content after a publish event.
4. Verify `cf-cache-status: HIT` on cacheable public pages.
5. Check Journey ad loading, GDPR consent flow, and GA events in production mode.
6. Switch the primary DNS record only after those checks pass.

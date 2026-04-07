# Bloxodes Main Domain Cutover

This checklist is for the final move from the test domain `ravitejaknts.com` to the production domain `bloxodes.com`.

## Before DNS Cutover

- Confirm the Dokploy app is healthy on the current deploy and `https://ravitejaknts.com/api/health` returns `200`.
- Confirm Supabase-backed pages, ISR, and revalidation are working on the test domain.
- Keep Cloudflare proxy enabled for the production domain.
- Add `bloxodes.com` and `www.bloxodes.com` in Dokploy before switching traffic.
- Make sure the SSL certificates are issued successfully in Dokploy/Traefik.

## Update Dokploy Environment Variables

Change these values in Dokploy for the production app:

- `SITE_URL=https://bloxodes.com`
- `NEXT_PUBLIC_SITE_URL=https://bloxodes.com`
- `REVALIDATE_ENDPOINT=https://bloxodes.com/api/revalidate`

Review these related values while you are there:

- `REVALIDATE_SECRET`
- `AUTH_SESSION_SECRET`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE`

## DNS And Traffic Switch

- Point `bloxodes.com` to the VPS.
- Point `www.bloxodes.com` to the VPS or redirect it to the apex domain.
- Keep `ravitejaknts.com` live until the production domain is verified.
- Redeploy the Dokploy app after the env update.

## Re-Enable Indexing

Indexing is intentionally blocked on non-production hosts in the app code. Once `SITE_URL` or `NEXT_PUBLIC_SITE_URL` is switched to `https://bloxodes.com`, the site will automatically:

- remove the global `noindex` response header
- switch page metadata back to `index, follow`
- serve an indexable `robots.txt`
- publish the production sitemap URL again

After the production deploy:

- verify `https://bloxodes.com/robots.txt` allows crawling
- verify page source shows indexable robots metadata
- verify `https://bloxodes.com/sitemap.xml` loads correctly
- submit the sitemap in Google Search Console
- submit the sitemap in Bing Webmaster Tools
- request indexing for the homepage and a few key pages

## SEO And Analytics Checks

- Verify canonical URLs use `https://bloxodes.com`
- Verify Open Graph and Twitter URLs use `https://bloxodes.com`
- Verify the RSS feed points to `https://bloxodes.com/feed.xml`
- Recheck Search Console verification if needed
- Recheck Bing Webmaster Tools verification if needed
- Confirm GA, Journey, and consent behavior still work correctly on the production domain

## Ads And Compliance Checks

- Confirm the Journey script still loads only after consent where required
- Keep Cloudflare Rocket Loader disabled
- Verify `ads.txt` is reachable on `https://bloxodes.com/ads.txt`
- Verify any domain-specific Mediavine settings are updated to `bloxodes.com`

## Final Cleanup

- Keep `ravitejaknts.com` blocked from indexing
- Decide whether `ravitejaknts.com` should continue serving the app, redirect to `bloxodes.com`, or be retired
- If the test domain will remain accessible, keep it on the non-indexable setup for future staging use

# Performance & Egress Optimization Plan

Current direction: Cloudflare is the long-lived public-page cache. The VPS renders fresh HTML whenever Cloudflare misses, and Supabase revalidation events purge plus warm affected Cloudflare URLs.

- **Public HTML cache:** Keep `Cache-Control: public, max-age=0, s-maxage=31536000, stale-while-revalidate=31536000` on public pages, sitemaps, robots, and feed. Browser HTML should not sit stale; Cloudflare can cache until purged.
- **Origin freshness:** Do not add `unstable_cache` around public Supabase reads. Use `public-content-cache.ts` only as a no-op compatibility wrapper for older cache-shaped loaders.
- **Build speed:** Public dynamic routes should return `[]` from `generateStaticParams()` so the build does not pre-render Supabase-backed content. Use post-deploy Cloudflare warming instead.
- **Revalidation:** Keep `/api/revalidate` as the single content-update entrypoint. It should expand each content event into affected detail pages, indexes, paginated indexes, homepage, feed, sitemap, and related wiki URLs.
- **Deploy warmup:** After deployment and any broad purge, run `CACHE_WARM_SITE_URL=https://bloxodes.com npm run cache:warm`, or manually dispatch the Dokploy production workflow with `trigger_dokploy=false` after a Dokploy-only manual deploy.
- **Image efficiency:** Re-enable Next image optimization only if the VPS can support it reliably, or continue shipping compressed WebP/AVIF assets and let Cloudflare Polish handle edge image cleanup.
- **Search/API payloads:** Keep private/session APIs uncached. Public APIs can use short explicit headers, but Cloudflare page HTML should remain the main traffic shield.
- **Markdown HTML:** Consider storing sanitized rendered HTML in Supabase if origin render time becomes the bottleneck after cache simplification.

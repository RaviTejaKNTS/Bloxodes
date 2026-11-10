# Cloudflare and media

Last verified: 2026-11-09

Cloudflare proxies every public hostname and is the long-lived HTML cache. R2 stores wiki collection images.

## Hostnames

| Host | Points to |
| --- | --- |
| `bloxodes.com`, `www` | The website. |
| `database.bloxodes.com` | Supabase API (Kong). |
| `studio.bloxodes.com` | Supabase Studio, behind basic auth. |
| `media.bloxodes.com` | Public media: Supabase Storage bucket `bloxodes-media`, and `/wiki/*` from R2. |

Old `bloxodesdb.ravitejaknts.com` and `bloxodesstudio.ravitejaknts.com` still answer. Don't use them in code or docs.

## Caching

- Only anonymous, successful public HTML is cached. APIs (except `/api/game-top-nav`), auth, account and mutation paths bypass the cache.
- Public pages send `cache-control: s-maxage=3600, stale-while-revalidate=31532400`. Next sends the same header on a 404, so Cloudflare must not follow it for errors.
- **Error pages are never stored.** Every cache rule ("Bloxodes public HTML cache", "Bloxodes game top nav API cache" and the emergency rule) sets Edge TTL status code TTLs 400–499 and 500–599 to `-1` (no store). The two live rules follow the origin header (`respect_origin`) for everything else; the emergency rule overrides it (fixed 2xx TTL, 3xx not stored). Search engines, Bing first, drop a page that returns an error, and a stored error keeps being served after the site recovers. Set on 2026-11-09 after cached 404s hit published wiki pages on Nov 1–4. If you change a cache rule, keep these two entries. The homelab health check (`scripts/ops/site-health-monitor.mjs`) requests made-up URLs every 5 minutes and opens an `[error-page-cache]` GitHub issue if Cloudflare serves one from cache.
- Pages carry cache tags from `apps/web/src/lib/public-cache-tags.ts`. Content changes purge by tag. See [cache](../operations/cache.md).
- Deploys purge the changed tags. Changes to the shared site shell (layout, `globals.css`, `next.config.js`, `apps/web/src/config/*`, `Site*`, consent and `ui` components, `PublicSiteProviders.tsx`) also purge the `site` tag, which every page has. A full purge needs an explicit workflow input.
- Keep Rocket Loader and script deferral off; they break the ad script.

## Emergency cache

`npm run cloudflare:emergency-cache:*` uses the operator token in `.envs/infrastructure/cloudflare.env`. The emergency HTML rule stays off unless the origin or database is down.

## Wiki media (R2)

- Collection and hub images live in R2 bucket `bloxodes-wiki`.
- `workers/wiki-media` (Cloudflare Worker, `wrangler.jsonc`) serves them at `https://media.bloxodes.com/wiki/<key>` with one-year immutable caching.
- Uploads use the S3 API with `WIKI_R2_ENDPOINT`, `WIKI_R2_ACCESS_KEY_ID`, `WIKI_R2_SECRET_ACCESS_KEY` and `WIKI_R2_BUCKET` (`scripts/shared/r2-client.ts`). GitHub publication jobs have these.
- Keys are immutable. A new image means a new key in a new dataset revision.

## Known issues

- `CLOUDFLARE_API_TOKEN` only purges cache. `CLOUDFLARE_BLOXODES_API` (an account token, verify with `/accounts/<id>/tokens/verify`) reads analytics, settings, DNS and rulesets and can edit cache rules, but its IP allow-list only accepts the VPS over IPv4: SSH to the VPS and run `curl -4` there, passing the header over stdin.

# Cloudflare and media

Last verified: 2026-11-27

Cloudflare proxies every public hostname and is the long-lived HTML cache. R2 stores wiki collection images.

## Hostnames

| Host | Points to |
| --- | --- |
| `bloxodes.com`, `www` | The website. |
| `database.bloxodes.com` | Supabase API (Kong). |
| `studio.bloxodes.com` | Supabase Studio, behind basic auth. |
| `media.bloxodes.com` | Public media: Supabase Storage bucket `bloxodes-media`. `/wiki/*` permanently redirects to `wiki-media.bloxodes.com`. |
| `wiki-media.bloxodes.com` | R2 custom domain for bucket `bloxodes-wiki` (wiki hub and collection images). No Worker. |

Old `bloxodesdb.ravitejaknts.com` and `bloxodesstudio.ravitejaknts.com` still answer. Don't use them in code or docs.

## Caching

- Only anonymous, successful public HTML is cached. APIs (except `/api/game-top-nav`), auth, account and mutation paths bypass the cache.
- Public pages send `cache-control: s-maxage=3600, stale-while-revalidate=31532400`. Next sends the same header on a 404, so Cloudflare must not follow it for errors.
- **Error pages are never stored.** Every cache rule ("Bloxodes public HTML cache", "Bloxodes game top nav API cache" and the emergency rule) sets Edge TTL status code TTLs 400–499 and 500–599 to `-1` (no store). The two live rules follow the origin header (`respect_origin`) for everything else; the emergency rule overrides it (fixed 2xx TTL, 3xx not stored). Search engines, Bing first, drop a page that returns an error, and a stored error keeps being served after the site recovers. Set on 2026-11-09 after cached 404s hit published wiki pages on Nov 1–4. If you change a cache rule, keep these two entries. The homelab health check (`scripts/ops/site-health-monitor.mjs`) requests made-up URLs every 5 minutes and opens an `[error-page-cache]` GitHub issue if Cloudflare serves one from cache.
- **React Server Components requests are never stored without their cache-buster.** Next sends in-site navigation as `RSC: 1` plus `?_rsc=<code>`, and the response is `text/x-component`, not HTML. Cloudflare ignores `Vary`, so a request with the header and no `_rsc` would be stored under the page's own key and served to every visitor. The public HTML rule and the emergency rule skip the cache for that case (`not (any(http.request.headers["rsc"][*] == "1") and not any(http.request.uri.args.names[*] == "_rsc"))`). Keep that clause if you change either rule. To clear a page that got stored this way, purge its `page:<path>` tag; a URL purge doesn't clear it.
- **`/stats/games` is cached for 5 minutes.** The page reads `searchParams`, so Next renders it on every request and sends `private, no-store`. Rule "Bloxodes stats games 5 minute cache" (last in the cache phase) overrides that for the exact path `/stats/games`: 2xx for 300 seconds, errors never stored, same `RSC` guard, browser header unchanged. Every query (`?sort=`, `?page=`, `?q=`) is its own cache entry. Other pages that read `searchParams` (`/stats/items`, `/stats/creators`, the catalog filter pages) still bypass the cache.
- Pages carry cache tags from `apps/web/src/lib/public-cache-tags.ts`. Content changes purge by tag. See [cache](../operations/cache.md).
- Deploys purge the changed tags. Changes to the shared site shell (layout, `globals.css`, `next.config.js`, `apps/web/src/config/*`, `Site*`, consent and `ui` components, `PublicSiteProviders.tsx`) also purge the `site` tag, which every page has. A full purge needs an explicit workflow input.
- Keep Rocket Loader and script deferral off; they break the ad script.

## Query strings

Rule "Bloxodes strip query strings from cacheable HTML" (phase `http_request_transform`, set in the dashboard) removes the query string from public HTML requests before the cache and the origin. Every link ending (`?utm_source=`, `?fbclid=`, a client-side `?q=` or `?sort=`, and the `?_rsc=` links Bing crawls without the `RSC` header) shares the clean page's cached copy. The browser still shows the full URL, so client components read it with `useSearchParams()`.

- It skips any request with an `RSC` header, so in-site navigation keeps its `_rsc` key.
- It skips paths whose server pages read `searchParams`: `/catalog/roblox-{accessories,animations,avatar-items,body-parts,clothing,emotes,items-and-bundles,makeup,dictionary}`, `/catalog/roblox-music-ids/charts`, `/stats/games`, `/stats/items`, `/stats/creators`, `/wiki` and `/wiki/page/`. It also skips the paths the cache rule bypasses (`/api`, `/auth`, `/account`, `/login`, `/admin`, `/dashboard`, `/_next/`, `/cdn-cgi/`).
- A page whose server output starts depending on the query needs its path added to the rule and to `apps/web/src/lib/__tests__/cloudflare-query-strip-contract.test.ts`. That test only catches a `page.tsx` that names `searchParams` directly. A page that passes its props to a helper which reads the query, a layout, a route handler or new proxy logic isn't caught, so check those by hand in review.
- Redirects from stripped paths drop the incoming query, so an old link's tracking tags don't reach the new page.

## Emergency cache

`npm run cloudflare:emergency-cache:*` uses the operator token in `.envs/infrastructure/cloudflare.env`. The emergency HTML rule stays off unless the origin or database is down.

## Wiki media (R2)

- Collection and hub images live in R2 bucket `bloxodes-wiki`.
- The bucket's R2 custom domain `wiki-media.bloxodes.com` serves them at `https://wiki-media.bloxodes.com/<key>` (bucket root is the host root). No Worker runs, so image views don't count toward the Workers Free daily limit (100,000 requests). Objects carry `cache-control: public, max-age=31536000, immutable` from `scripts/shared/r2-client.ts`, and Cloudflare caches them at the edge.
- Old links `media.bloxodes.com/wiki/*` get a 301 from the zone redirect rule "Wiki media to R2 domain" (phase `http_request_dynamic_redirect`) to `https://wiki-media.bloxodes.com/*`. No Worker route is left on the zone. Code builds only the new host (`apps/web/src/lib/wiki-media.ts`). Publishers accept old-prefix URLs and store the new host, and the web app's database client rewrites old-prefix URLs it reads.
- Don't serve public media through a Worker. The account is on Workers Free, every view would count, and going over the daily limit breaks images with HTTP 429 `error code: 1027` until midnight UTC.
- Uploads use the S3 API with `WIKI_R2_ENDPOINT`, `WIKI_R2_ACCESS_KEY_ID`, `WIKI_R2_SECRET_ACCESS_KEY` and `WIKI_R2_BUCKET` (`scripts/shared/r2-client.ts`). GitHub publication jobs have these.
- Keys are immutable. A new image means a new key in a new dataset revision.

## Known issues

- `CLOUDFLARE_API_TOKEN` only purges cache. `CLOUDFLARE_BLOXODES_API` (an account token, verify with `/accounts/<id>/tokens/verify`) reads zone analytics, settings, DNS and rulesets and can edit cache rules, redirect rules and Worker routes. It can't manage R2 custom domains or read Worker analytics. Its IP allow-list only accepts the VPS over IPv4: SSH to the VPS and run `curl -4` there, passing the header over stdin.
- Worker scripts `bloxodes-wiki-media` and `bloxodes-wiki-media-development` are still on the account with no route, so they get no traffic. Delete them in the dashboard (Workers & Pages).

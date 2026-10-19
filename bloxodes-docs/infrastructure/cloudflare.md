# Cloudflare and media

Last verified: 2026-10-19

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

- Only anonymous, successful public HTML is cached. APIs, auth, account, mutation paths and errors bypass the cache.
- Public pages send `cache-control: s-maxage=3600, stale-while-revalidate=31532400`.
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

- The two Cloudflare tokens we have can't read DNS, rulesets or R2 bucket lists (403 and 401). Origin DNS records, the live `/wiki` routing rule and bucket inventory couldn't be checked.

# Codes Pipeline

Status: Active
Last verified: 2026-08-13
Evidence: code/schema rules, installed VPS cron, production read-only counts, and route/revalidation contracts

## Ownership

- Page records: `code_pages` (4,024 rows at verification).
- Code records: `codes` (58,633 rows at verification).
- Public routes: `/codes` and `/codes/<game-slug>`.
- Refresh implementation: `scripts/codes/update-codes.ts`, stable alias `npm run refresh:codes`.

## Codes landing page

Local implementation checked 2026-09-05; production publication is separate. `/codes` combines its existing 20-game card directory with a short introduction, section navigation, and server-rendered guidance about redemption, failed codes, platform promo codes, and source-based updates. Copy and index metadata live in `apps/web/src/app/(site)/codes/index-content.tsx`; layout and list structured data live in `page-data.tsx`. This editorial copy ships with the web application and does not write code rows.

The full guide appears only on `/codes`. Continuation pages use their own canonical and social URLs, inherit the environment's indexing policy, and link back to the landing page. `/codes/page/1` redirects permanently to `/codes`; invalid and out-of-range page numbers return not-found. The main sitemap already includes `/codes`, the codes sitemap retains detail URLs, and RSS remains a feed of content updates rather than index copy. Existing codes index revalidation covers the directory.

## Source Contract

- `code_pages.slug` is the editorial game slug; never append `-codes` and never copy the stats universe slug.
- `roblox_link` stores the Roblox experience URL.
- `source_url` stores RobloxDen.
- `source_url_2` stores Beebom.
- Other source fields are legacy/additional sources and must not displace the two refresh-owner fields.

## Flow

1. Research/setup inserts or updates durable page fields and source URLs.
2. The refresh worker fetches source pages and owns active/expired code rows.
3. Page copy remains evergreen and avoids current code names/counts/dates.
4. Database changes enqueue revalidation for codes indexes/details and downstream clients.
5. Website, extension, and mobile share code freshness/progress logic from web library helpers.

## Schedule

The VPS worker runs `refresh:codes` every six hours at minute 0 with configured concurrency and batch delay. GitHub schedules should remain disabled where the VPS manifest owns the recurring job.

## Safety

- Never manually seed active/expired codes or code dates.
- Do not run a production refresh using the managed-development target.
- New page publication must preserve metadata, sitemap/search/feed/revalidation behavior.

## October 2 reliability repairs

The refresh retries individual existing-code reads, touches and idempotent upserts after transient Data API failures. Exact stored code text is used for touches, so `_` and `%` cannot act as wildcard matches. Reactivation timestamps belong to the database upsert rather than a second unguarded update.

The prepared `20261002105551` migration targets the existing case-insensitive unique index atomically and applies provider precedence inside the conflict update. Lower-priority observations only refresh last-seen time. Equal priority preserves existing redemption text; higher priority may replace it. Managed-development SQL verification and production application remain pending.

A failed provider no longer prevents trying another configured source in scheduled refresh. An incomplete scrape preserves missing active codes and reports a degraded refresh. If all sources return 404/410, the page is skipped with an explicit unavailable-source reason and existing observations remain unchanged. Other HTTP/network failures still fail the refresh. Strict admin imports retain their existing all-sources contract.

The October 2 checks confirmed that Mining Simulator 2 and the original PLS Donate But Infinite Robux RobloxDen URLs return 404. RobloxDen's public search has no source matching their original place IDs. Similarly named replacements point to different experiences, so no replacement URL or code was entered manually.

The case-insensitive upsert migration is verified in managed development at version `20261002105551`. Lower-priority observations preserve stronger data, equal-priority case variants preserve the stored code spelling, and higher-priority reactivation updates exactly one row and its timestamp. Production schema application is pending. The scraper/runtime fixes are deployed in the web and worker at `34b925cca7788e7db83e58d640031e89ffe01cec`.

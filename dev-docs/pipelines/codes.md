# Codes Pipeline

Status: Active
Last verified: 2026-08-13
Evidence: code/schema rules, installed VPS cron, production read-only counts, and route/revalidation contracts

## Ownership

- Page records: `code_pages` (4,024 rows at verification).
- Code records: `codes` (58,633 rows at verification).
- Public routes: `/codes` and `/codes/<game-slug>`.
- Refresh implementation: `scripts/codes/update-codes.ts`, stable alias `npm run refresh:codes`.

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
- Do not run a production refresh using the local or managed-dev target.
- New page publication must preserve metadata, sitemap/search/feed/revalidation behavior.

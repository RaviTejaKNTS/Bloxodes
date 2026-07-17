# Bloxodes Analytics Operations

This is the source of truth for accessing, extending, verifying, and reporting on Bloxodes analytics.

## Advertising implementation records

- [`journey-auto-ads-dom-refactor-2026-07-14.md`](journey-auto-ads-dom-refactor-2026-07-14.md): root cause, DOM contract, route coverage, code changes, local/browser audits, production release evidence, and the reuse checklist for Journey automatic in-content placement.

## Current setup

As of 2026-07-11, Bloxodes runs two web analytics systems:

- **Umami:** the preferred source for routine traffic-quality analysis, privacy-conscious page measurement, Core Web Vitals, and new outcome-level events.
- **Google Analytics 4:** retained for Google ecosystem integration, historical comparison, and existing GA4 reporting. Do not automatically reproduce its event taxonomy in Umami.

Umami deployment details:

- Dashboard: `https://umami.ravitejaknts.com`
- Website: `Bloxodes`
- Domain: `bloxodes.com`
- Umami app service: `umami-selfhost-svdgnp-umami-1`
- Umami PostgreSQL service: `umami-selfhost-svdgnp-postgres-1`
- Production web and Umami run on the same VPS. Umami is therefore a separate analytics system, but not an infrastructure-independent outage backup.

Do not store Umami passwords, VPS passwords, database URLs, API tokens, or other secrets in this directory.

## Access and configuration

Use the Umami dashboard for normal analysis. Select the `Bloxodes` website after signing in.

The website ID is a public tracker identifier, but the repo still keeps operational values in environment configuration rather than duplicating them in reports:

- Local operator source: `.env.codex`, currently under `Umami_website_id`.
- Production build variables:
  - `NEXT_PUBLIC_UMAMI_HOST_URL`
  - `NEXT_PUBLIC_UMAMI_WEBSITE_ID`
- GitHub Actions passes those variables into the immutable production image through `.github/workflows/dokploy-production-deploy.yml`.
- Public configuration examples live in `.env.example`.

Before using an ID for a production change, confirm that the Umami `website` row resolves to `Bloxodes | bloxodes.com`. Never print unrelated environment values while checking it.

## What Umami collects

The tracker is loaded once in the public site layout with these rules:

- Only `bloxodes.com` and `www.bloxodes.com` are accepted.
- URL search parameters are excluded to avoid noisy, high-cardinality URLs.
- Browser Do Not Track is respected.
- Umami performance collection is enabled for Core Web Vitals.
- Admin routes do not use the public site layout and are not tracked.
- If Bloxodes local analytics consent gating is enabled, the Umami tracker is placed behind the analytics consent category.

Umami automatically records ordinary pageviews and client-side route changes. Do not add manual pageview calls unless the automatic behavior is proven insufficient, because that would create duplicates.

## Custom event taxonomy

Keep Umami events few, outcome-oriented, low-cardinality, and useful for a product or editorial decision.

| Event | Trigger | Properties | Purpose |
| --- | --- | --- | --- |
| `engaged_visit` | Once after at least 30 active seconds and 50% page scroll | `content_type`, `seconds`, `scroll_percent` | Separates meaningful consumption from shallow pageviews and compares engagement by page family. |
| `quiz_finished` | Once when a quiz attempt first reaches its final summary | `quiz_code`, `score`, `total` | Measures actual quiz completion and outcome without logging every answer click. |

The current `content_type` values are `home`, `article`, `codes`, `wiki`, `tool`, `catalog`, `event`, `checklist`, `quiz`, `stats`, and `other`.

Intentionally do **not** mirror the current GA4 events for searches, result clicks, code copies, checklist toggles, theme changes, generic outbound clicks, social clicks, related-content clicks, or every calculator input. Add a new Umami event only when its decision, trigger, properties, and expected cardinality are clear.

## Code ownership

- Tracker script and privacy options: `apps/web/src/components/UmamiAnalytics.tsx`
- Meaningful engagement definition: `apps/web/src/components/UmamiEngagementTracker.tsx`
- Typed event names, payload cleanup, and page-family classification: `apps/web/src/lib/umami.ts`
- Public provider and consent composition: `apps/web/src/components/PublicSiteProviders.tsx`
- Production environment handoff: `apps/web/src/app/(site)/layout.tsx`
- Quiz completion event: `apps/web/src/components/QuizRunner.tsx`
- Focused tests: `apps/web/src/lib/__tests__/umami.test.ts`
- Reader-facing disclosure: `apps/web/src/app/(site)/privacy-policy/page.tsx`

When changing the event taxonomy, update this document, the typed `UmamiEventName` union, the focused tests, and the privacy disclosure if the collected data materially changes.

## Verification checklist

For a code or configuration change:

1. Confirm the local/operator website ID is UUID-shaped without printing it alongside other secrets.
2. Confirm the ID belongs to the `Bloxodes` website and `bloxodes.com` domain.
3. Run `npm run typecheck:web`.
4. Run the Umami and CSP focused tests.
5. Run `npm run build:web` with the production Umami host and website ID available at build time.
6. After deployment, confirm `/api/health` reports the expected Git SHA.
7. Inspect the hydrated live page and confirm the Umami script has the expected website ID, domains, search exclusion, Do Not Track, and performance attributes.
8. Confirm a fresh pageview reaches Umami. For event changes, perform the real trigger and verify that exact event name and properties.
9. Check both the Bloxodes web container and the Umami/PostgreSQL services if data stops arriving, because they share the VPS.

The initial production release was commit `cc9e5d27` on 2026-07-11. GitHub Actions run `29154267383` completed successfully, the live health endpoint returned that SHA, and direct readback confirmed pageviews, performance rows, and `engaged_visit` events for Bloxodes.

## Analytics reports

All future analytics reports belong in `docs/analytics/reports/`.

That directory is intentionally empty of reports for now; its `.gitkeep` file only preserves the directory in Git. Do not treat `.gitkeep` as a report.

Use filenames such as:

```text
YYYY-MM-DD-topic-slug.md
```

Every report should state:

- question or decision being supported;
- analytics source and website/property;
- exact date range and timezone;
- generation timestamp;
- page, event, segment, and bot filters;
- metric definitions;
- comparison period when applicable;
- measured findings separated from inference;
- known data-quality gaps or blocked access;
- a concise recommendation or next action.

Prefer aggregate tables and reproducible query notes. Do not commit raw visitor-level exports, session identifiers, IP-derived data, credentials, access tokens, or unnecessarily large generated datasets.

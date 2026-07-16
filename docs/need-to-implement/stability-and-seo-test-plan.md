# Bloxodes Stability and SEO Test Plan

Created: 2026-07-02

Implementation status: complete on 2026-07-16. The protected `production` branch now requires deterministic and production-build checks, while the production workflow fails closed on candidate sitemap, SEO, route, rendering, and published-content defects before image publication. Successful candidates deploy as immutable images through Dokploy, verify the live SHA and postdeploy contracts, then purge and warm Cloudflare.

## Why this exists

Bloxodes is now large enough that manual checking is not enough. A small code or data change can affect search indexing, structured data, sitemap output, page rendering, page speed, Cloudflare behavior, Supabase reads, and production availability.

The goal is simple: no update should reach production unless the important technical, SEO, rendering, and page-consistency checks pass first.

## Target outcome

- Production pages should not return internal server errors.
- Sitemap URLs should return the expected status codes.
- Money pages should not accidentally become `noindex`.
- Duplicate and paginated pages should follow the expected index policy.
- `datePublished`, `dateModified`, visible updated dates, sitemap `lastmod`, and JSON-LD dates should be logically correct.
- New tools, catalogs, wiki pages, codes pages, articles, quizzes, checklists, and events should follow the same structure as existing good pages.
- Page rendering should be stable, consistent, and fast enough.
- Deployments should fail before production when a breaking issue is detected.
- Post-deploy checks should prove the live site is serving the expected build.

## Current useful commands

These already exist and should become part of the final guardrail system:

- `npm run typecheck:web`
- `npm run typecheck`
- `npm run build:web`
- `npm run test:web`
- `npm run audit:seo`
- `npm run audit:html-size`
- `npm run content:check-copy`
- `npm run verify:article-finals`
- `npm run verify:catalog-finals`
- `npm run verify:engagement-finals`
- `npm run verify:game-collection-finals`
- `npm run verify:simple-page-finals`
- `npm run verify:wiki-final`
- `npm run cache:warm`

## New commands to implement

These should be added gradually:

- `npm run test:unit:web`
- `npm run test:seo`
- `npm run test:sitemaps`
- `npm run test:routes`
- `npm run test:page-contracts`
- `npm run test:dates`
- `npm run test:structured-data`
- `npm run test:render`
- `npm run test:production-smoke`
- `npm run verify:predeploy`
- `npm run verify:postdeploy`

The final predeploy command should run the checks we trust before every production push. The final postdeploy command should check the live site after Dokploy switches to the new build.

## Phase 1: Baseline safety gates

Implement first. These should block deploys.

### TypeScript and build

- Run `npm run typecheck:web`.
- Run `npm run build:web`.
- Treat build-time page-data errors as blocking unless explicitly marked as safe fallback.
- Track and reduce existing build warnings separately instead of ignoring them forever.

### Unit tests for shared logic

Add focused Vitest tests for:

- date helpers;
- metadata helpers;
- canonical URL helpers;
- robots/indexing helpers;
- JSON-LD builders;
- sitemap URL builders;
- pagination helpers;
- page-data fallback behavior;
- Supabase row-to-page mappers.

### Fast failure rule

If required data is missing for a public page, the app should fail in a controlled way during build or test, not quietly render broken production HTML.

Examples:

- Missing required title should fail.
- Missing canonical should fail.
- Invalid `datePublished` should fail.
- Invalid JSON-LD should fail.
- Missing route data for a required static page should fail.

## Phase 2: Sitemap and route checks

Implement a sitemap crawler that can run locally, in CI, and against production.

### Sitemap checks

For every sitemap:

- `/sitemap.xml` returns `200`.
- every listed sitemap returns `200`.
- every URL in each sitemap returns the expected status.
- sitemap XML is valid.
- URLs use the canonical host.
- no duplicate URLs.
- no staging/local/private URLs.
- `lastmod` is valid ISO date/time when present.
- `lastmod` is not accidentally set to the current deploy time unless the page content really changed.

### Route status checks

For sampled or all important URLs:

- main public pages return `200`;
- pages that should redirect return the expected `3xx`;
- missing pages return `404`, not `500`;
- bots should not receive Cloudflare challenge pages on SEO-critical URLs;
- search bots should not receive different broken HTML from normal browser requests.

### Required user agents

Run route checks as:

- normal browser user agent;
- Googlebot user agent;
- Bingbot user agent;
- simple curl user agent for detecting Cloudflare challenge behavior.

## Phase 3: SEO metadata checks

Implement HTML parsing checks for public pages.

### Required metadata

For indexable pages:

- exactly one `<title>`;
- title length within a reasonable range;
- meta description exists;
- canonical URL exists and matches expected route;
- robots policy allows indexing;
- Open Graph title and description exist;
- Twitter metadata exists when expected;
- no accidental duplicate canonical;
- no accidental `noindex`;
- no blocked assets required for primary rendering.

### Robots policy

Expected policy by page family:

- main catalog pages: `index, follow`;
- high-value tool pages: `index, follow`;
- articles: `index, follow`;
- codes detail pages: `index, follow`;
- wiki hubs and valid collection pages: `index, follow`;
- duplicate pagination pages: usually `noindex, follow`;
- internal/admin/auth pages: not indexable;
- search/filter variants: only indexable if explicitly approved.

### Structured data checks

Parse every `application/ld+json` block:

- JSON must parse.
- `@context` and `@type` must be valid.
- URL fields must use canonical URLs.
- dates must be valid.
- `datePublished` must not use `updated_at`.
- `dateModified` should reflect actual modification date.
- FAQ JSON-LD should match visible FAQ when used.
- Breadcrumb JSON-LD should match visible hierarchy when used.

## Phase 4: Date consistency tests

This is critical because wrong dates can hurt search trust.

### Dates to verify

For each public page where dates exist:

- database `created_at`;
- database `published_at`;
- database `updated_at`;
- page visible updated date;
- JSON-LD `datePublished`;
- JSON-LD `dateModified`;
- sitemap `lastmod`;
- feed dates where relevant.

### Rules

- `datePublished` should come from `published_at` or `created_at`, never from `updated_at`.
- `dateModified` may come from `updated_at`.
- `dateModified` must be greater than or equal to `datePublished`.
- sitemap `lastmod` should reflect real content changes.
- catalog pages should not look freshly published just because an admin row or crawler count updated.
- generated listing/filter pages should not invent a publish date unless the content has a real publish source.

### Page families needing date tests

- articles;
- catalog pages;
- catalog child pages;
- codes pages;
- checklists;
- quizzes;
- tools;
- events;
- wiki hubs;
- wiki collection pages;
- stats pages;
- feed routes;
- sitemap routes.

## Phase 5: Page-family contracts

Create contract tests for each page family. These should prevent new pages from acting weird compared to existing pages.

### Catalog pages

Required checks:

- canonical route is correct;
- main page index policy is correct;
- child page index policy is correct;
- intro/content sections render in the expected order;
- cards or tables render with stable fields;
- JSON-LD has correct dates;
- sitemap includes only approved indexable URLs;
- page does not duplicate main-page content onto pagination/filter pages unless intended.

### Tools

Required checks:

- tool page has the standard layout sections;
- input controls render;
- result state renders;
- metadata follows tool pattern;
- FAQ and explanatory sections are present when expected;
- canonical is correct;
- tool does not depend on client-only data for primary SEO content;
- no hydration-only blank page for bots.

### Codes pages

Required checks:

- game slug is the editorial slug, not stats universe slug;
- active/expired code blocks behave consistently;
- page does not hardcode freshness claims in evergreen copy;
- source URLs are present in the expected fields;
- Roblox experience URL is not stored as a source URL;
- metadata and JSON-LD follow codes pattern.

### Wiki and collection pages

Required checks:

- wiki hub exists before collection pages depend on it;
- collection code format is consistent;
- local dataset fields match renderer fields;
- collection item count is nonzero unless the page is intentionally empty;
- images resolve;
- missing images have safe fallbacks;
- structured data and metadata are valid.

### Articles, events, quizzes, and checklists

Required checks:

- title, description, slug, and canonical exist;
- body content renders;
- author/date data is valid where used;
- FAQ JSON is valid where used;
- related links do not point to missing pages;
- sitemap and feed behavior is correct.

### Stats pages

Required checks:

- stats index pages render when current-index tables are missing only if there is an approved fallback;
- chart data endpoints return valid JSON;
- old/stale data is detected;
- page does not silently show misleading empty charts;
- health checks include the worker/index freshness needed by public pages.

## Phase 6: Rendering and browser tests

Add Playwright checks for important pages.

### Browser smoke pages

At minimum:

- home page;
- `/catalog`;
- `/catalog/roblox-music-ids`;
- `/catalog/roblox-decal-ids`;
- `/catalog/free-roblox-items`;
- `/tools`;
- one major tool page;
- `/codes`;
- one codes page;
- `/wiki`;
- one wiki page;
- one wiki collection page;
- `/articles`;
- one article;
- `/quizzes`;
- one quiz;
- `/checklists`;
- one checklist;
- `/stats`;
- one stats game page.

### Browser assertions

- no browser console errors from app code;
- no blank main content;
- no visible internal server error text;
- title/header renders;
- primary navigation renders;
- page content appears above the fold;
- no obvious layout overlap at mobile and desktop widths;
- important interactive controls are usable.

## Phase 7: Performance and stability checks

### HTML size

Use and expand `npm run audit:html-size`.

Checks:

- important pages stay below agreed HTML size limits;
- sitemap crawls do not expose giant accidental pages;
- catalog pages do not ship huge duplicated payloads;
- pagination pages stay lean.

### Response time

For production smoke checks:

- health endpoint should be fast;
- main pages should respond within agreed thresholds;
- API endpoints used by top navigation should not delay page usability;
- Supabase-heavy routes should have either caching, fallback, or explicit failure behavior.

### Cache behavior

Check:

- expected Cloudflare cache headers;
- no accidental no-store on pages that should be cached;
- no stale deploy after health SHA changes;
- revalidation paths work;
- cache warming does not trigger bot rules or rate limits.

## Phase 8: Production deploy gate

Before pushing to `production`:

1. Confirm staged files are scoped to the request.
2. Run `npm run typecheck:web`.
3. Run `npm run test:web`.
4. Run `npm run build:web`.
5. Run SEO/date/page-contract tests once implemented.
6. Run affected route smoke tests.
7. Commit only the intended files.
8. Push only after the checks pass.

After deployment:

1. Check `/api/health`.
2. Confirm live SHA matches the pushed commit.
3. Check live status for affected pages.
4. Parse live metadata and JSON-LD for affected pages.
5. Check the relevant sitemap.
6. Check Googlebot/Bingbot access for affected pages.
7. Watch deploy logs for errors.

## Blocking vs warning

### Always blocking

- TypeScript errors.
- Production build failure.
- Any public money page returns `500`.
- Sitemap URL returns unexpected non-`200`.
- Main indexable page accidentally has `noindex`.
- JSON-LD does not parse.
- `datePublished` is newer than `dateModified`.
- `datePublished` comes from `updated_at`.
- Canonical points to the wrong URL.
- Production health SHA does not match deployed commit.
- Search bot receives a challenge or broken page for important indexable URLs.

### Warning first, then later blocking

- title too long;
- meta description too short;
- HTML size above soft threshold;
- non-critical console warnings;
- missing optional Open Graph image;
- slow but still successful route;
- old but explainable stats data.

## CI workflow changes to implement

Create a GitHub Actions workflow for pull requests and production pushes:

- checkout;
- install dependencies;
- run typecheck;
- run unit tests;
- run build;
- run static SEO/page-contract tests;
- upload reports as artifacts.

Update the existing Dokploy production workflow:

- do not trigger deploy if predeploy checks fail;
- after Dokploy deploy, wait for `/api/health` SHA;
- run postdeploy smoke checks;
- only then purge/warm Cloudflare;
- fail loudly if live verification fails.

## Reports to generate

Every full verification should write machine-readable and human-readable reports:

- `tmp/test-reports/seo-summary.json`;
- `tmp/test-reports/seo-summary.md`;
- `tmp/test-reports/sitemap-status.tsv`;
- `tmp/test-reports/date-audit.tsv`;
- `tmp/test-reports/structured-data-errors.json`;
- `tmp/test-reports/render-smoke.md`;
- `tmp/test-reports/production-smoke.md`.

Reports should not be committed by default.

## Implementation order

### Step 1

Create unit tests for date helpers, metadata helpers, JSON-LD helpers, and sitemap builders.

### Step 2

Create route and sitemap crawler scripts that can run against localhost and production.

### Step 3

Create page-family contract tests for catalog and tools first, because these are high-risk and high-SEO surfaces.

### Step 4

Add Playwright smoke tests for the most important public page families.

### Step 5

Wire the tests into `verify:predeploy` and GitHub Actions.

### Step 6

Wire postdeploy live checks into the Dokploy production workflow.

### Step 7

Move warnings to blockers once the existing site is clean enough.

## First pages to protect

Start with the highest traffic and highest risk routes:

- `/catalog/roblox-music-ids`;
- `/catalog/roblox-decal-ids`;
- `/catalog/free-roblox-items`;
- `/catalog/roblox-color-codes`;
- `/tools`;
- top tool pages;
- `/codes`;
- top codes pages;
- `/articles`;
- `/wiki`;
- `/stats`;
- `/sitemap.xml`;
- `/sitemaps/catalog.xml`;
- `/sitemaps/tools.xml`;
- `/sitemaps/codes.xml`;
- `/sitemaps/articles.xml`;

## Open decisions

Resolved for the first enforceable version:

- Response time over 2 seconds is a warning; availability, status, and contract failures block.
- Uncompressed HTML over 1 MB warns and over 2 MB blocks.
- Pull requests run deterministic checks and a production build. Candidate and postdeploy gates request every sitemap URL.
- Postdeploy runs full sitemap status plus representative SEO, four-user-agent route checks, critical APIs, RSS/robots, and desktop/mobile Chromium before cache changes.
- Challenge or internal-error HTML blocks on every sitemap URL and every audited public page.
- Titles outside 20–65 characters and descriptions outside 50–170 characters warn initially; missing or duplicate metadata blocks.

## Definition of done

This plan is done when:

- every production push runs predeploy tests;
- every deployment verifies live SHA;
- affected pages are checked after deploy;
- sitemap and route checks catch `500` errors before search engines do;
- date logic is covered by automated tests;
- catalog and tool pages have enforceable contracts;
- SEO metadata and JSON-LD are parsed automatically;
- reports are generated for debugging;
- no change reaches production without a clear pass/fail signal.

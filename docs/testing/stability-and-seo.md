# Stability and SEO verification

The web release gate is designed to fail on the candidate build before an image is published or Dokploy changes production. It combines deterministic source checks, read-only content contracts, a production build, HTTP/SEO crawling, and real Chromium rendering.

## Commands

| Command | Purpose | Data or side effects |
| --- | --- | --- |
| `npm run verify:deterministic` | ESLint, web typecheck, unit tests, coverage, dates, route-family, sitemap-builder, and JSON-LD contracts | No database and no writes outside ignored reports |
| `npm run verify:build` | Deterministic gate, all registered collection datasets, read-only published-content validation, and the Next production build | Reads local Supabase by default; writes ignored reports and build output |
| `npm run verify:predeploy` | Builds, starts the exact local candidate, crawls it, and runs desktop/mobile Chromium | Reads local Supabase; writes ignored reports and build output |
| `npm run verify:postdeploy` | Proves live build SHA, DB health, stats freshness, sitemaps, SEO, bot parity, cache contracts, APIs, RSS/robots, and Chromium rendering | Live read-only HTTP requests; requires an explicit production target |

Focused commands are available as `test:sitemaps`, `test:seo`, `test:routes`, `test:render`, `test:production-smoke`, and `validate:published-content`.

`validate:published-content` refuses a non-local Supabase URL unless `--allow-remote-read` is supplied. It never mutates data. `verify:postdeploy` refuses to run without `TEST_BASE_URL` or `POSTDEPLOY_BASE_URL`.

## What blocks a release

- ESLint, TypeScript, unit, coverage, dataset, published-content, or production-build failure.
- Invalid sitemap XML, wrong hosts, duplicates, private/unknown routes, invalid dates, redirects, non-200 URLs, challenge pages, or noindex sitemap pages.
- Missing or conflicting title, description, canonical, H1, main content, required JSON-LD, cache tag, or expected robots policy.
- Invalid JSON-LD, FAQ markup that is not visible, wrong canonical URLs, or inconsistent database/visible/JSON-LD/sitemap dates.
- A bot response that differs materially from a browser response.
- Broken redirect, real-404, robots.txt, RSS, top-navigation API, or stats chart API contracts.
- Public HTML over 2 MB uncompressed.
- Desktop/mobile blank pages, app console errors, first-party request failures, horizontal overflow, off-screen headings, broken navigation, or unusable calculator controls.
- A postdeploy SHA mismatch, unhealthy DB, or missing/dynamic/bypassed Cloudflare cache status on audited public HTML.

Warnings remain visible but do not block for title outside 20–65 characters, description outside 50–170 characters, missing optional Open Graph image or Twitter card, HTML over 1 MB, response over 2 seconds, empty/stale stats data, and known legacy published-content relationships.

## Coverage and sampling

- Predeploy sitemap verification requests every URL in every sitemap with four workers, response backoff, and a low-pressure retry pass after an origin cooldown. This keeps full coverage without turning the release gate into sustained load against the shared production database.
- SEO verification covers every critical index and representative detail pages from every public route family.
- Route verification repeats those pages as a browser, Googlebot, Bingbot, and curl, then checks redirect, pagination, private-route, API, robots, and feed contracts.
- Chromium renders every critical index on desktop and mobile, plus one detail page per sitemap family and explicit navigation/control tests.
- Postdeploy repeats full sitemap status checks and the representative multi-user-agent/browser suite before Cloudflare purge or warming.

## Reports

All reports are generated in ignored `tmp/test-reports/`:

- `published-content.json` and `published-content.md`
- `seo-summary.json` and `seo-summary.md`
- `sitemap-status.tsv`
- `route-status.tsv`
- `date-audit.tsv`
- `structured-data-errors.json`
- `render-smoke.md` and the Playwright HTML report
- `production-smoke.md` for live verification

GitHub workflows upload these files even when a check fails.

## Release flow

1. A pull request runs the deterministic gate and a production build.
2. The production workflow builds an image locally in Actions but does not publish it.
3. The candidate container must pass sitemap, SEO, route, API, feed, robots, and Chromium checks.
4. Only a passing image is pushed to GHCR and handed to Dokploy.
5. The workflow waits for `/api/health` to return the expected SHA and healthy database state.
6. Live postdeploy verification must pass before Cloudflare purge and warming.

The production job has a 90-minute fail-closed budget so the full candidate crawl and the full live postdeploy crawl can both complete on the production-sized sitemap without bypassing either gate. Stats detail metadata uses one lightweight row read instead of loading charts, and both the stats sitemap and page robots policy use the same hourly `global_playing_rank` top-1000 cutoff so ranking churn cannot make a sitemap URL turn `noindex` mid-crawl. Stats sitemap detail URLs are always built with `statsUniverseSlug`, including the universe ID, so duplicate raw slugs cannot redirect or resolve to the wrong game.

Repository workflow files and branch-protection settings do not become active until the local changes are approved, pushed, and the required GitHub checks are configured.

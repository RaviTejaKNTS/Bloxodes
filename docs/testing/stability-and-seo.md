# Stability and SEO verification

Bloxodes uses a fast automatic release path for daily publishing and keeps broad crawl/render tools available for explicit manual audits.

## Automatic pull-request checks

`.github/workflows/web-quality.yml` runs for every pull request so the required status is always reported.

- Web code or quality tooling: ESLint, web TypeScript, and one coverage run.
- Image-shipped web code: production build in parallel with the code checks.
- Bundled datasets or public assets: local dataset validation plus a production build.
- Docs, mobile, extension, scripts, and other non-web changes: fast successful no-op for web-only jobs.
- `quality` is the final required status. It fails if any selected job fails.

The automatic PR path does not crawl production, run Playwright, or validate every published database row.

## Automatic deployment

`.github/workflows/dokploy-production-deploy.yml` classifies each `production` push.

- Docs, mobile, extension, Supabase, and script-only pushes do not build or deploy the web image.
- Web code and bundled dataset/assets changes build and publish one immutable image, then deploy it through Dokploy.
- The image build performs the production Next.js build only. Lint, type checks, coverage, and dataset contracts belong to the already-required pull-request jobs and are not repeated inside Docker.
- The workflow verifies the exact live SHA and database health.
- Runtime code changes may purge Cloudflare once. Dataset-only deploys do not flush the site cache.
- A maximum of five affected family/index pages plus `/sitemap.xml` receive one lightweight smoke request each.
- There is no automatic full crawl, browser installation, sitemap-wide warming, or broad postdeploy audit.
- Superseded queued pushes exit before building or deploying.

## Code first, database second

Dynamic detail sitemaps only include published database rows. Deploying a renderer, tool, collection configuration, dataset, or other code before its database row therefore does not add a broken URL to a sitemap.

Use this order:

1. Validate and deploy code/datasets.
2. Confirm the exact live SHA and health.
3. Dry-run and publish the database row.
4. Let the database revalidation event purge and warm only affected paths.
5. Verify the exact new/updated URL:

```bash
npm run verify:published-url -- \
  --path /wiki/example-game/example-collection
```

The verifier makes only the detail-page and family-sitemap requests. It checks `200`, title, canonical, indexability, and sitemap membership. Use `--expect absent` before database publication when a known future route must remain a `404` and absent from its sitemap.

For an existing bundled dataset page, rerun its idempotent seed/upsert after the code deploy so normal revalidation purges that exact page.

## Manual audit tools

These remain available but never block normal publishing:

- `npm run test:sitemaps`
- `npm run test:seo`
- `npm run test:routes`
- `npm run test:render`
- `npm run test:production-smoke`
- `npm run validate:published-content -- --allow-remote-read`
- `npm run verify:predeploy`
- `npm run verify:postdeploy`

`.github/workflows/manual-web-audit.yml` exposes explicit manual choices for a representative sample, full sitemap crawl, browser rendering, or published-content validation.

Full sitemap crawls require the exact confirmation `RUN FULL AUDIT`, run with one or two workers, are never scheduled, and never overlap.

## Expected timing

- Pull-request quality: approximately 2–3 minutes for web code; faster for non-web changes.
- Production deployment: approximately 8–10 minutes with the current Docker build.
- Database-only publication and targeted verification: normally under a few minutes with no web build.

A true five-minute merge-to-live web deployment requires separate Docker build/push optimization; it is not achieved by weakening or expanding tests.

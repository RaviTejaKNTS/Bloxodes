# Stability and SEO verification

Bloxodes keeps normal releases narrow and fast. Broad crawl, rendering, and database-wide tools remain available for deliberate troubleshooting. Use `docs/testing/content-release-runbook.md` for the release decision tree.

## Targeted pull-request checks

Pull requests are optional for focused routine work. When a relevant PR is used, `.github/workflows/web-quality.yml` runs one `quality` job only for web, dataset, dependency, Docker, or quality-tooling paths.

The `production` branch should allow reviewed direct pushes while continuing to reject force pushes and branch deletion. It should not require a PR or one global status for internal docs and routine focused work.

- Lint changed JavaScript/TypeScript files only.
- Run Vitest tests related to changed web source, with no coverage collection.
- Keep the existing dataset audit when bundled data or public assets change.
- Check non-Markdown patch formatting.
- Do not run a production build, full-project lint/typecheck/coverage, or no-op jobs for docs/skills.

## Automatic deployment

`.github/workflows/dokploy-production-deploy.yml` classifies each `production` push.

- Docs, mobile, extension, Supabase, and script-only pushes do not deploy a web image.
- Web code and bundled data/assets build one immutable production image. Dokploy switches only after the build succeeds.
- The workflow verifies the exact live SHA and database health.
- Runtime changes invalidate targeted Cloudflare cache tags. Full purge remains an explicit manual recovery option.
- Smoke requests cover only mapped affected families; sitemap smoke runs only for sitemap-related changes.
- Superseded queued pushes exit before building or deploying.

## Code first, database second

For a page that needs new code, datasets, or assets:

1. Release and verify the repository work.
2. Dry-run and publish the database row.
3. Let targeted revalidation handle affected paths.
4. Verify the exact URL with `npm run verify:published-url -- --path <path>`.

A future unpublished route may correctly return `404` and remain absent from its sitemap until the row is published. Schema migrations use the expansion-first sequence in the release runbook.

## Diagnostic tools

The sitemap, SEO/route, Playwright, published-content, pre/postdeploy, and cache-warming tools are not normal release gates. Agents may use them when troubleshooting evidence makes them useful.

Start with the smallest relevant target. Before expanding, consider runtime, network traffic, and load on the shared web/Supabase VPS. Full sitemap crawls remain low-concurrency, unscheduled, non-overlapping, and explicitly confirmed in the manual GitHub workflow.

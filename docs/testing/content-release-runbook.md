# Bloxodes Content Release Runbook

Keep publishing fast. Content workflows own their final checks; release publishes the approved result without repeating them.

## Default workflow

1. Complete the content or code work in its task worktree.
2. Run that workflow's final checks once.
3. After user approval, invoke `$bloxodes-release-e2e`.
4. E2E confirms the file allowlist, runs `git diff --check`, and pushes directly to `production` without force.
5. Wait only for the required deployment or database publication.
6. Verify the exact live result and synchronize the main local `production` worktree.
7. Keep the task worktree open for immediate follow-up. Clean it only when the user asks.

Do not require a planning tracker, PR, status check, second verifier run, second Browser review, or second dataset audit.

## Choose the release path

| Change | Release |
| --- | --- |
| Existing database content or page using code/assets already live | Production dry-run, database write, readback, exact URL verification. No web build. |
| Web code, route, renderer, SEO, sitemap, Docker, bundled data, or public assets | Direct push to `production`, automatic build/deploy, exact SHA health check. |
| New DB page needing new code/data/assets | Deploy repository files first, then publish the DB row and verify its URL. |
| Docs, skills, scripts, mobile, extension, or Supabase-only repository files | Direct push; production classifier skips the web deploy. |
| Schema needed by new code | Apply a backward-compatible migration first, verify it, then deploy dependent code. |

Until a new database row is published, its future route may correctly return `404` and stay out of the sitemap.

## Final checks happen once

The page-type workflow owns verifier, dataset, image, HTML-size, pagination, Browser, lint, or related-test checks needed to call the work complete.

E2E treats the explicit release request as confirmation those checks passed. It does not search for proof files or rerun them. Return to final checks only if the user says they are incomplete or the release process changes an approved artifact.

## Repository publication

- Work only from the current task worktree.
- Stage an explicit allowlist; never use `git add .` or `git add -A`.
- Ignore unrelated worktrees, temp output, environment files, dependencies, caches, and reports.
- Fetch `origin/production` and update it only by a normal non-force fast-forward.
- Push directly with `git push origin HEAD:production`.
- Open a PR only when the user explicitly asks for one.

GitHub `production` should allow normal direct pushes while continuing to reject force pushes and branch deletion.

## Automatic production behavior

`.github/workflows/dokploy-production-deploy.yml` classifies each `production` push.

- Web code or bundled data/assets: build and deploy one production image, verify the exact SHA and database health, and run only mapped smoke checks.
- Docs, skills, scripts, mobile, extension, and Supabase-only changes: classify successfully and skip web deployment.
- Runtime cache handling uses targeted Cloudflare tags. Full purge is manual recovery only.

Do not add automatic sitemap crawls, Playwright suites, database-wide audits, broad SEO scans, full cache purges, or sitemap-wide warming.

## Database publication

For prepared content:

1. Confirm the exact production slug/row.
2. Run the existing seed/import command's production dry-run.
3. Apply only the approved idempotent write.
4. Read the row back.
5. Verify the exact path:

```bash
npm run verify:published-url -- --path /wiki/example-game/example-page
```

For mixed releases, never publish the database row before required code, datasets, and assets are live.

## Manual diagnostics

These remain available for actual troubleshooting, not normal release:

- `npm run test:sitemaps`
- `npm run test:seo`
- `npm run test:routes`
- `npm run test:render`
- `npm run validate:published-content -- --allow-remote-read`
- `npm run verify:predeploy`
- `npm run verify:postdeploy`
- `.github/workflows/manual-web-audit.yml`

Start with the smallest relevant target. Full sitemap crawls stay explicit, low-concurrency, unscheduled, and non-overlapping.

## Failure handling

- Direct push rejected: report the branch-protection or divergence blocker; do not silently open a PR.
- Deploy failed: inspect only the failed build, Dokploy, health, cache, or mapped-smoke stage.
- Exact URL failed: check its row, slug, required deployed files, and targeted revalidation.
- Migration ordering unclear: stop before production mutation.

Do not respond to one failed URL by launching a full-site audit.

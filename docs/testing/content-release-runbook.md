# Bloxodes Content Release and Testing Runbook

Use this runbook for normal content publishing, code releases, dataset releases, and testing decisions. The goal is to protect production without slowing daily publishing or placing broad load on the shared web and Supabase VPS.

## Non-negotiable rules

- Do not run a full sitemap crawl, broad production SEO/route scan, Playwright suite, published-content audit, deep pre/postdeploy suite, or sitemap-wide cache warm as part of a normal push. Use them deliberately when troubleshooting evidence justifies their time and VPS/origin load.
- Pull requests are optional for focused routine work in this solo-maintainer repository. Use one when the user requests it or review isolation materially helps a high-risk change.
- For a new DB-backed page, deploy its code, renderer, dataset, and images before publishing its database row.
- Treat schema dependencies separately: apply and verify a backward-compatible expansion migration before deploying web code that requires it.
- After publishing a database row, verify the exact page and its family sitemap.
- A future unpublished page returning `404` and remaining absent from its sitemap is correct.
- Do not publish a database row first when its route needs new bundled code or data.
- Production web and Supabase share one VPS. Keep live verification narrow.
- Preserve unrelated worktree changes and never include them in a release silently.

## Decide which release path applies

| Change | Required path | Web image deployment |
| --- | --- | --- |
| Existing DB content, prose, metadata, FAQ, codes refresh, or database-owned page update | Production dry-run, approved DB write, exact URL verification | No |
| New DB-backed page using code and data already live | Production dry-run, approved DB write, exact URL verification | No |
| React, Next.js, route, renderer, shared library, SEO, sitemap, or Docker change | Changed-file lint/related tests, optional PR by risk, production build and deployment verification | Yes |
| Bundled `data/`, `apps/web/src/data/`, or `apps/web/public/` change | Existing dataset checks, optional PR by risk, production build, then targeted DB revalidation when applicable | Yes |
| New collection, catalog, quiz, or tool needing bundled code/data | Release code and data first, database publication second | Yes, before DB publication |
| Supabase schema migration with no dependent web code | Migration-only PR, focused migration validation, merge, production dry-run, exact migration apply and verification | No |
| Supabase migration plus dependent web code | Expansion migration PR and production apply first; dependent code PR and deployment second | Only for the code phase |
| Docs, skills, mobile, extension, scripts, or Supabase-only repository change | Focused commit; use an optional PR or domain-specific process when risk justifies it | No web image deployment |

## Repository publication policy

- Focused routine changes may push a reviewed commit directly to `production` without force.
- Use a PR when the user requests one or review isolation materially helps migrations, security/auth, deployment workflows, or broad shared-runtime changes.
- Do not require one global status check for every tracked file. When a relevant PR starts targeted checks, do not merge it while those selected checks are failing.
- Continue to prohibit force pushes and branch deletion.

## Database-only content publication

Use this for content whose renderer and required assets already exist in production.

1. Follow the relevant page-type skill, `AGENTS.md`, or seed/import script.
2. Run the script's production dry-run.
3. Confirm the target production row, slug, and create/update behavior.
4. Perform the explicitly approved production write.
5. Allow the normal database revalidation event to purge and warm affected paths.
6. Verify the exact public URL:

```bash
npm run verify:published-url -- --path /articles/example-slug
```

The verifier requests only the page and its family sitemap. It checks the response, title, canonical, robots policy, and sitemap membership.

For a known future page before publication:

```bash
npm run verify:published-url -- \
  --path /wiki/example-game/example-collection \
  --expect absent
```

Do not start a web build or full crawl for a DB-only publication.

## Schema migration release

The normal code-first/database-second order applies to content rows. When runtime code needs a new column, table, view, function, policy, or constraint, use schema-first expansion instead:

1. Create a forward-only, backward-compatible expansion migration. The currently live app must continue working after it is applied.
2. Put the migration in its own PR, complete its focused migration validation, merge it, and confirm the Supabase-only change did not deploy a web image.
3. Compare local and production migration history and run the production dry-run.
4. Continue only when the dry-run shows exactly the migration versions approved for this release. Never use `--include-all` to sweep in unrelated pending migrations.
5. Have only one operator apply the reviewed migration.
6. Verify the migration-history entry, resulting schema, RLS/permissions, a representative query or API call, and database health.
7. Create the dependent code PR from updated `production`, then merge, deploy, and verify its exact image SHA.
8. If old schema must be removed, renamed, restricted, or made non-null, do that in a later contract migration after all live code has stopped relying on it.
9. Regenerate `supabase/schema.sql` from live production through a controlled follow-up; never hand-edit the snapshot.

Stop if histories differ unexpectedly, another migration is pending, the old app would break, or the change cannot be made backward-compatible. Get an explicit maintenance/rollout decision instead of guessing.

## Code or renderer release

1. Work on a focused branch/worktree and select only the intended files.
2. Lint changed source files and run related tests. Use a PR when requested or justified by risk.
3. Publish the reviewed commit to `production` without force.
4. The production workflow performs the one deployable build and publishes one immutable image.
5. Dokploy switches to that image only after the build succeeds.
6. The workflow requires the exact deployed image SHA and a healthy database.
7. Runtime code changes receive targeted Cloudflare cache-tag invalidation; a full purge is an explicit manual action.
8. Only the affected page-family smoke paths are requested. The sitemap is checked only when sitemap-related files changed.

The automatic path does not install Chromium, start a candidate container, crawl every sitemap URL, or run broad production data validation.

## Dataset and public asset release

1. Add only the required dataset, configuration, and public assets.
2. Run the existing dataset checks. Use a PR only when requested or justified by risk.
3. Publish the reviewed commit and let the production workflow perform the single deployable build.
4. Wait for the exact deployed SHA and healthy database.
5. Do not publish a new database page until this deployment is live.
6. Run the relevant idempotent seed/upsert so normal revalidation targets the exact page.
7. Verify the exact page URL.

Dataset-only deployments do not perform a full Cloudflare purge. Prefer new asset filenames when replacing public images. Replacing an existing asset at the same URL may require an explicitly approved Cloudflare cache action.

## New code-backed database page

Use this order for new collections, catalogs, tools, quizzes, or other pages that depend on bundled files:

1. Validate the content, dataset, images, and renderer locally.
2. Optionally confirm the future URL is absent.
3. Publish and deploy the selected code/data release.
4. Confirm the exact image SHA and healthy database.
5. Run the production DB dry-run.
6. Publish the database row.
7. Wait for targeted revalidation.
8. Verify the exact URL and sitemap membership.

Until step 6, the route may return `404` and must not appear in its sitemap.

## How automatic checks react

### Pull requests

`.github/workflows/web-quality.yml` starts only for web, dataset, dependency, Docker, or quality-tooling changes. Docs and skills do not start it.

- Web code: lint only changed JavaScript/TypeScript files and run Vitest tests related to changed web source.
- Dataset/public assets: retain the existing dataset audit.
- Formatting: check changed non-Markdown patches.
- Production build, full typecheck, full lint, and full coverage are not repeated in normal PR checks.
- There is one `quality` job, not a fan-out plus aggregation job.

### Production pushes

`.github/workflows/dokploy-production-deploy.yml` classifies each published `production` change.

- Web code or bundled data/assets: build one deployable image and deploy it.
- Docs, workflow, mobile, extension, scripts, and Supabase-only changes: classifier succeeds and the deploy job is skipped.
- Superseded queued web deployments exit before building.

A docs/workflow-only merge can make the `production` Git commit newer than the SHA shown by `/api/health`. This is expected because `/api/health` reports the latest deployed web image SHA, not the latest non-web commit.

## Testing options

| Test | Use it when | Normal daily gate |
| --- | --- | --- |
| `verify:published-url` | After every DB publication or targeted content update | Yes, targeted |
| Targeted PR `quality` | Relevant PRs when the PR path is selected | Yes for that PR |
| Automatic deploy smoke | Every selected web image deployment | Yes |
| Manual `sample` audit | Investigating a route-family or SEO concern | No |
| Manual `render` audit | Changing interactive UI, hydration, responsive behavior, or calculators | No |
| Manual `published-content` audit | Investigating a batch or database-wide content-contract concern | No |
| Manual `full-sitemap-crawl` | Explicit periodic audit or incident investigation | No |
| `verify:predeploy` / `verify:postdeploy` | Deep local/live release diagnosis | No |

### Manual GitHub workflow

Run `.github/workflows/manual-web-audit.yml` through GitHub Actions and choose:

- `sample`: representative SEO and route checks.
- `render`: Playwright/Chromium rendering checks.
- `published-content`: read-only published database content validation.
- `full-sitemap-crawl`: every sitemap URL.

Full crawls require the exact confirmation `RUN FULL AUDIT`, allow only one or two request workers, never run on a schedule, and never overlap.

### Manual local commands

```bash
npm run test:seo
npm run test:routes
npm run test:sitemaps
npm run test:render
npm run validate:published-content -- --allow-remote-read
npm run verify:predeploy
TEST_BASE_URL=https://bloxodes.com \
EXPECTED_BUILD_SHA=<sha> \
npm run verify:postdeploy
```

These commands are investigation tools. Do not add them to normal PR or production workflows. Agents may use them when troubleshooting makes them useful, but should start with the narrowest diagnostic, account for time/origin/VPS load, and expand only when the evidence warrants it.

## Failure handling

### Pull-request failure

- Read the failing selected job.
- Fix only the selected changed-file, related-test, migration, or dataset problem.
- Do not start a production crawl.

### Deployment failure

- Check whether the image build, Dokploy handoff, exact-SHA health check, Cloudflare purge, or tiny smoke failed.
- If the expected SHA is not live, do not assume the new deployment is healthy; use the last known-good SHA as the reference.
- Do not publish a database row that depends on the failed deployment.
- Retry or repair only the failed stage; do not run a broad audit by default.

### Exact URL verification failure

- Confirm the database row is published and uses the correct editorial slug.
- Confirm required code, datasets, and images are already deployed.
- Allow the verifier's bounded retries to cover normal revalidation delay.
- If still stale, inspect the relevant revalidation event and worker.
- Do not use a full crawl to diagnose one failed URL.

### Database row published before required code

- Treat this as a release-order error.
- Prevent the broken URL from remaining published or in the sitemap until its required web image is live.
- Restore the normal code-first, DB-second sequence.

### Dependent code released before its schema migration

- Stop the rollout or restore compatibility; do not keep retrying a code deployment against missing schema.
- Verify the exact production migration history and schema before taking another release action.
- Resume with the split expansion-migration-first sequence above.

## Expected operating speed

- Docs/skill release: no GitHub test workflow or web build.
- Relevant pull request: targeted lint/tests or dataset validation only.
- Database-only publication: normally a few minutes, with no image build.
- Web deployment: dominated by Docker build and image transfer, not tests or crawling.

The Docker workflow uses the minimum GitHub Actions cache export because the previous full intermediate cache export took longer than the application build itself. Measure the next real web deployment before making further build-cache changes.

## Agent completion checklist

Before declaring a release complete, report:

- which release path was used;
- the passing targeted result when a relevant PR was used;
- the merge commit or deployed image SHA when code/data changed;
- database health for a web deployment;
- the exact published URL verification result for DB content;
- any manual audit that was intentionally run;
- confirmation that no broad production crawl or warm ran automatically.

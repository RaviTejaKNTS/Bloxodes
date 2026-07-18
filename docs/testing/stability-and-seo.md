# Stability and SEO verification

Bloxodes checks content once before approval and keeps release fast.

## Before approval

The relevant content or code workflow runs its own final checks. For wiki/collection work this can include the verifier, dataset/images, HTML size, pagination, and Browser preview.

Once the user approves the work and asks for E2E publication, do not repeat those checks.

## During release

E2E performs only release integrity:

- explicit file allowlist;
- staged-diff review;
- `git diff --check`; and
- at most one tiny syntax/smoke check when the release process itself changed an approved file.

Push directly to `production`. There is no automatic PR quality workflow. The production workflow performs the required application build only when web code, bundled data, or public assets changed.

## After publication

- Web deployment: verify the exact image SHA and database health.
- Database content: read back the exact row and verify the exact public URL.
- Docs/non-web repository change: confirm deployment was skipped.
- Keep the task worktree open for immediate follow-up.

## Manual diagnostics

Sitemap crawls, SEO/route audits, Playwright rendering, published-content audits, deep pre/postdeploy checks, and cache warming remain available for troubleshooting. They are not normal release gates.

Start narrow and consider time plus shared VPS/origin load before expanding. Full sitemap crawls remain explicit, low-concurrency, unscheduled, and non-overlapping.

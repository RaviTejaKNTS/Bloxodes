# Content and Engagement Pipelines

Status: Active
Last verified: 2026-08-29
Evidence: page tables/counts, workflow skills, final validators/importers, routes, sitemap/feed/revalidation code, and explicit wiki/collection ownership separation

## Page Families

- Tools: 13 rows.
- Events: 22 page rows.
- Checklists: 14 rows.
- Quizzes: 13 rows.
- Articles: 419 rows.

Game wiki hubs and game-specific collections are a separate cohesive pipeline owned by `wiki-collections.md`. Global Roblox catalog pages are owned independently by `catalog.md`.

## Standard Workflow

1. Suggest or receive an approved opportunity.
2. Research production overlap, identity, sources, scope, and route expectations.
3. Write a typed `final.json` using the page-family skill.
4. Validate with the relevant `verify:*` command.
5. Import/seed into managed development and preview through the local Next.js process.
6. Promote with a controlled idempotent script or forward-only migration.
7. Revalidate public paths/tags and verify the published URL.

Content routes are server-first. Shared typed reads belong in `apps/web/src/lib/*`; page-family loaders belong in `page-data.tsx` where appropriate.

Quiz page metadata and all easy/medium/hard question pools live together in `quiz_pages`; `quiz_data` is a validated JSONB payload. Web and mobile query that column directly and fail fast when a published quiz has no valid payload. `import-content-final` and `verify-engagement-finals` validate and read back the full pool, while `sync:quiz-data` owns guarded backfill manifests. Quiz list queries deliberately exclude `quiz_data`.

## Events and Puzzles

- VPS cron refreshes virtual events daily and seeds event details.
- Puzzle sync runs multiple source-time windows plus a strict daily audit.
- Puzzle source freshness, group rules, and LinkedIn availability are controlled through schedule env/process settings; do not move non-secret schedule defaults into secret files.

## Publication Contract

Every public family must account for metadata, canonical/JSON-LD, pagination, search, sitemap, feed where relevant, revalidation mapping, Cloudflare tags, and mobile/extension payload compatibility where relevant.

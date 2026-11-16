# Release

Last verified: 2026-11-16

How code and content reach production. GitHub does the checking, building and deploying for code. Content Factory content (Roblox and franchise wikis, articles, codes pages, stats reports) publishes straight to production with its own guarded commands, `content:publish` and `codes:publish`, with no managed-development step: when the production dry run passes, it publishes ([roblox wiki](../content/roblox-wiki.md#publishing), [articles](../content/articles.md#direct-publishing), [codes](../content/codes.md), [stats](../content/stats.md#monthly-reports)). The GitHub content jobs below remain for other selected content. Agents don't run checks or builds locally.

## Code: PR to production

1. **Work in the T3 worktree.** T3 gives each task one worktree and branch from fresh `origin/production`. Setup links `.envs` and creates an empty `tmp/`; it installs nothing.
2. **Independent review.** Before opening a code PR, a `reviewer` reviews the diff.
3. **Open a PR to `production`** and link it to T3. Use T3's PR watcher while checks run.
4. **`pull-request.yml`** sorts the diff. Docs and skills skip the heavy jobs. Code runs migration integrity, env contracts, script tests and the affected app checks. Web changes get a production build, browser tests with screenshots on desktop and mobile, and, when catalog or shared code changes, cold/warm catalog pagination and filter/failure regression. Manual runs compare the branch against `origin/production`.
   - **No managed development.** The `checks` job gets no `MANAGED_DEV_*` secrets and blocks the managed-development host. The build, unit tests and browser tests read a CI-only read server on `127.0.0.1:54321` (`scripts/ci/data-server.mjs`) that answers Supabase REST, RPC and storage reads from committed samples in `scripts/ci/fixtures/`. It checks every query before reading rows against `scripts/ci/fixtures/schema.json`, a copy of the real tables, views, columns, types, foreign keys and RPCs. An unknown column, embed or order, a value of the wrong type, an operator that doesn't fit the column type, or an embed with no matching foreign key (or an ambiguous one without a `!hint`) fails even on an empty result, and every sample row must use real columns. Views have no foreign keys of their own; `scripts/ci/fixtures/view-relations.json` maps each embedded view to its base table's constraint, which is checked against the manifest. Writes, reads of tables with no samples, malformed `Range` headers and unknown queries fail, and a final audit fails the job if any request wasn't served. In this mode route parity needs at least one sample per page type that returns 200. It runs only in GitHub with `BLOXODES_CI_DATA=1`; production builds never load it. When a change reads a new table, column, relation or RPC, add it and a sample to `scripts/ci/fixtures/` in the same PR. Postgres 17 is still there for the SQL transaction tests.
   - **Parallel.** PRs check side by side; there is no shared lane. A full web run of `checks` takes about 9 minutes.
   - **Browser tests by change.** `scripts/ci/change-scope.mjs` picks the specs. Every web change runs `release-smoke`, `ci-data-source` and cold-start redirects. Article, author, event, puzzle and stats routes add `site-route-parity`. Wiki, game, codes, tool, map, quiz, checklist and slug routes add the four route and registry specs. Catalog routes, shared code (libraries, components, layouts, root config, dependencies, CI, fixtures) and any path it doesn't recognize run every spec and the catalog regression.
   - **Content batches** changed under `content/releases/` get a static contract check with no database. Managed QA runs when they publish.
   - **`public-data-errors`** runs the web unit tests (including the data-error guard and the loader, route and sitemap failure tests) and the web typecheck in its own job, and `Required PR checks` needs it for web changes.
   - **Migrations.** Only a PR that changes `supabase/migrations/`, `supabase/migration-policy.json` or `scripts/ci/fixtures/schema.json` runs the managed-development schema job, beside `checks` (see [Schema](#schema)).
5. **`Required PR checks`** is the single required check. Branch protection enforces it, including for admins, and blocks force pushes. No human approval is required by GitHub; release permission comes from the owner.
6. **`codex-review.yml`** (Selective Claude review) runs a read-only Claude Haiku 5.5 code review through the Claude Code CLI when a ready, same-repo code PR opens. It may only read files and run `git diff/show/log`. It isn't a required check. Pushes cancel stale reviews but don't start new ones. After fixes: `gh workflow run codex-review.yml --ref production -f pull_request=<number>`. It doesn't replace the required checks.
7. **Merge** with a merge commit, only after `Required PR checks` passes and the owner has approved the release. Never push to `production` directly. Follow [merge order](#merge-order) when other PRs are open.
8. **Sync.** GitHub deletes the remote branch. Fast-forward the clean main checkouts (homelab and Mac) to the released SHA. Agents don't delete worktrees. `t3-worktree-reaper` runs on the homelab and the MacBook Pro and removes a clean worktree after its thread has been settled for 3 days. It keeps the local branch and refuses a worktree with uncommitted changes.

Use `bloxodes-release-e2e` for the full release flow.

### Merge order

Branch protection is strict: a PR merges only when its branch is up to date with `production` and its checks passed on that exact head. Every merge makes all other open PRs fall behind, and each catch-up costs a full check run (about 10 minutes; PRs no longer wait for each other's checks). When threads update their branches at the same time, they keep pushing each other behind and never merge. Keep strict mode on: it is the only full test of each PR as it will land, because the deploy only rebuilds and smoke-tests a few pages.

1. **Merge one PR at a time.** Merge as soon as the checks pass on an up-to-date head.
2. **Check before you update.** Before `gh pr update-branch <n>`, list the open PRs (`gh pr list --base production`) and the running and queued `Pull request checks` runs (`gh run list --workflow pull-request.yml --status in_progress` and `--status queued`). If another PR's checks are running or waiting, don't update yours. Wait until that PR merges or its checks fail, then update once.
3. **Cancel stale runs.** A run that will be behind once the PR ahead merges is wasted. Cancel it with `gh run cancel <run-id>`.
4. **The lead sets the order.** When more than one PR is ready, the lead thread picks the order (usually the one whose checks are furthest along goes first) and tells the other threads to wait. Threads that own a PR follow that order.

## Deploy

On push to `production`, `dokploy-production-deploy.yml`:

1. compares the live SHA with the release and decides what changed;
2. runs the schema release first if migrations changed;
3. builds the web image, pushes `:<sha>` and `:production` to GHCR, and points Dokploy at the SHA image;
4. waits for `/api/health?scope=deploy` to report that SHA with a healthy database;
5. purges the changed Cloudflare tags and checks a few public pages.

Docs-only merges don't build an image, so a green run doesn't always mean a new deploy. Check the live SHA in `/api/health?scope=deploy`.

Schema, deploy and content jobs share the `bloxodes-production` concurrency lane with `queue: max`, so releases wait their turn instead of cancelling each other.

**Rollback:** deploy the previous immutable image. Database changes only go forward; fix them with a new migration.

## Schema

`schema-release.yml` (called by the PR and deploy workflows):

- **Development:** applies pending migrations to managed development over the Management API with a rollback plan first, checks the ledger and records a SHA-bound receipt.
- **Production:** after merge, the deploy runs the development step first at the released SHA, then `release-production-schema.ts` connects over HTTPS Studio as `supabase_admin`. It needs that matching development receipt, plans with rollback, applies atomically and reads the ledger back.
- **PRs:** the development step runs only when a PR changes `supabase/migrations/`, `supabase/migration-policy.json` or `scripts/ci/fixtures/schema.json`, so a migration fails on real development data before merge. After applying, it runs `scripts/ci/schema-manifest.ts --check`. It fails when `schema.json` claims a table, view, column, type, nullability, foreign key or RPC signature that managed development lacks or has differently, since CI would then accept queries the real database rejects. Objects only in managed development (for example another open PR's migration) are a warning. On a failure or warning the job uploads a fresh manifest as the `ci-schema-manifest-<sha>` artifact; copy its `ci-schema-manifest.json` to `scripts/ci/fixtures/schema.json` and commit it with the migration, keeping only your migration's changes. Locally, `node --import tsx scripts/ci/schema-manifest.ts --write` does the same (managed-dev env with `MANAGED_DEV_SUPABASE_ACCESS_TOKEN`, read-only). The step runs beside `checks`, and `Required PR checks` needs it to pass for those PRs. The deploy's schema release skips the manifest check. Other PRs never touch managed development. Every code PR still runs `supabase:migrations:check`.

## Wiki bundles

Roblox and franchise wiki hubs and collections, articles and monthly stats reports publish with `npm run content:publish`, which owns the `roblox-wiki@1`, `game-wiki@1`, `article@1`, `game-article@1` and `stats-report@1` contracts and every check. It runs from an up-to-date checkout with no local changes whose publish code matches what's live, refuses pending production migrations, and needs `--target production --apply --allow-prod` to write production. No PR, build or GitHub run is involved, and new games need no code change. The Content Factory runs it from each device's main checkout. Full detail: [Roblox wiki](../content/roblox-wiki.md#publishing), [franchise](../content/franchise.md#publishing), [stats reports](../content/stats.md#monthly-reports).

## Content publication

Other database content, and existing Roblox CI batches, go out through `publish-content.yml` (Publish selected content), dispatched by `bloxodes-release-e2e` or an automation:

1. **Input:** either a committed batch at `content/releases/<batch>/batch.json`, or a private bundle in the managed-development `ci-release-bundles` bucket, addressed by SHA-256.
2. **Managed QA:** `managed-content-qa.yml` stages the exact content in managed development, builds a preview, runs desktop and mobile browser checks and writes a receipt bound to the SHA and input bytes.
3. **Checks:** the production schema ledger must have no pending migrations, and the live code must be current and compatible.
4. **Publish** (`apply=true`): runs the selected publishers, reads back, revalidates and checks the exact URLs, text, metadata and sitemap. `apply=false` only verifies.

Publishers: `events-final`, `roblox-codes-page`, `game-pages`, `content-final`, `roblox-wiki`, `roblox-collection`, `franchise-wiki`, `franchise-collection`, `minecraft-tools`, `catalog`, `tool-finals` (see `scripts/ci/content-contract.mjs`). `content-final` refuses article files; articles publish with `content:publish`.

`content/releases/verify-existing/batch.json` is a read-only canary. Dispatch it with `apply=false` to test the pipeline. Never test by creating junk content.

### Managed-development content QA

- Checklist QA builds temporary boards and compares every field and task, then removes only its own boards, tasks and test accounts. If cleanup fails, production is blocked.
- Browser QA ticks, reloads and unticks checklist tasks with a runner-only account on desktop and mobile.
- **Selected franchise QA:** for franchise hubs, collections and quizzes, dispatch `pull-request.yml` on the task branch with `selected_franchise_bundle_hash=<sha256>` (`scripts/ci/selected-franchise-qa.ts`). `selected_franchise_stage=false` is the default and verifies content already staged in development; set it to `true` to stage first. It audits datasets, compares rows and media, builds a preview, checks desktop and mobile with isolated accounts and cleans up its fixtures.
- **Selected Roblox QA:** for Roblox wiki hubs and collections, dispatch `pull-request.yml` on the task branch with `selected_roblox_bundle_hash=<sha256>` (`scripts/ci/selected-roblox-qa.ts`). It only verifies content already staged in development; it stages nothing and uploads no media. It compares every stored row, revision hash, copy field and public media byte before and after the browser run, checks Cards/List fields, images, metadata, sitemap entries, pagination and saved progress on desktop and mobile with isolated accounts, then removes those accounts. For each hub, keep `cover_image: null` in the authoring final and freeze `<operation.file>.qa-cover.json` with `file` (bundle-relative cover path), `sha256` (full lowercase hash) and `format` (`png`, `jpeg`, `webp` or `avif`), plus the exact already-staged R2 cover bytes. QA verifies the hosted URL and hash, fully decodes the 768×432 cover and separate 512×512 official icon, and checks the cover in social metadata and directory cards. Its report is development evidence, not a production receipt.
- You can run `managed-content-qa.yml` on its own with the exact `approved_sha` and a `batch` or `bundle_hash`. It only writes development.

## Edge Functions

Edge Function code isn't shipped with the web image. `scripts/ops/release-production-edge-function.ts` releases one function from an exact approved SHA, by hand.

## Separate runtimes

These don't change when code merges:

- **Homelab article runtime:** package with `automation-runtime.yml`, then prepare and install. See [articles](../content/articles.md#runtime-releases).
- **Stats worker:** build an approved SHA on the VPS, and Northflank rebuilds on worker paths. See [stats](../content/stats.md#the-stats-worker).

## CI credentials

- All CI runs with `BLOXODES_ENV_PROFILE=process-only`.
- PR jobs use `MANAGED_DEV_SUPABASE_URL`, `_ANON_KEY`, `_SERVICE_ROLE` and `_ACCESS_TOKEN`.
- The `production` GitHub environment (only the `production` branch can use it) holds Studio credentials and the four `WIKI_R2_*` keys. Database, media, revalidation, Dokploy and GHCR secrets are repository secrets.
- `codex-review.yml` gets `ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN` only in its review job, with no database or deploy credentials. The manual `generate-queue.yml` and `discover-beebom-codes.yml` use the same secret for page copy.
- `env/examples/ci.env.example` lists CI-only names.

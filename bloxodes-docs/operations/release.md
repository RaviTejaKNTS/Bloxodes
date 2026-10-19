# Release

Last verified: 2026-10-19

How code and content reach production. GitHub does the checking, building, deploying and publishing. Agents don't run checks or builds locally.

## Code: PR to production

1. **Work in the T3 worktree.** T3 gives each task one worktree and branch from fresh `origin/production`. Setup links `.envs` and creates an empty `tmp/`; it installs nothing.
2. **Independent review.** Before opening a code PR, an independent Codex agent reviews the diff.
3. **Open a PR to `production`** and link it to T3. Use T3's PR watcher while checks run.
4. **`pull-request.yml`** sorts the diff. Docs and skills skip the heavy jobs. Code runs migration integrity, env contracts, script tests and the affected app checks. Web changes get a production build and desktop and mobile browser smoke tests with screenshots.
5. **`Required PR checks`** is the single required check. Branch protection enforces it, including for admins, and blocks force pushes. No human approval is required by GitHub; release permission comes from the owner.
6. **`codex-review.yml`** (Selective Codex review) runs a paid code review when a ready, same-repo code PR opens. It isn't a required check. Pushes cancel stale reviews but don't start new ones. After fixes: `gh workflow run codex-review.yml --ref production -f pull_request=<number>`. It doesn't replace the required checks.
7. **Merge** with a merge commit, only after `Required PR checks` passes and the owner has approved the release. Never push to `production` directly.
8. **Clean up.** GitHub deletes the remote branch. Fast-forward the clean main checkouts (homelab and Mac) to the released SHA. On the homelab, once the thread is finished in T3, run `cleanup:task-worktree` from another checkout with `--inactive-confirmed`. On the Mac, the hourly `com.ravitejaknts.t3-worktree-reaper` removes settled T3 worktrees; the helper doesn't accept Mac paths.

Use `bloxodes-release-e2e` for the full release flow.

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
- **Production:** after merge, `release-production-schema.ts` connects over HTTPS Studio as `supabase_admin`. It needs a matching development receipt, plans with rollback, applies atomically and reads the ledger back.

## Content publication

Database content goes out through `publish-content.yml` (Publish selected content), dispatched by `bloxodes-release-e2e` or an automation:

1. **Input:** either a committed batch at `content/releases/<batch>/batch.json`, or a private bundle in the managed-development `ci-release-bundles` bucket, addressed by SHA-256.
2. **Managed QA:** `managed-content-qa.yml` stages the exact content in managed development, builds a preview, runs desktop and mobile browser checks and writes a receipt bound to the SHA and input bytes.
3. **Checks:** the production schema ledger must have no pending migrations, and the live code must be current and compatible.
4. **Publish** (`apply=true`): runs the selected publishers, reads back, revalidates and checks the exact URLs, text, metadata and sitemap. `apply=false` only verifies.

Publishers: `events-final`, `roblox-codes-page`, `article-queue`, `game-pages`, `content-final`, `roblox-wiki`, `roblox-collection`, `franchise-wiki`, `franchise-collection`, `minecraft-tools`, `catalog`, `tool-finals` (see `scripts/ci/content-contract.mjs`).

`content/releases/verify-existing/batch.json` is a read-only canary. Dispatch it with `apply=false` to test the pipeline. Never test by creating junk content.

### Managed-development content QA

- Checklist QA builds temporary boards and compares every field and task, then removes only its own boards, tasks and test accounts. If cleanup fails, production is blocked.
- Browser QA ticks, reloads and unticks checklist tasks with a runner-only account on desktop and mobile.
- Article QA also checks that body images load and videos embed.
- **Selected franchise QA:** for franchise hubs, collections and quizzes, dispatch `pull-request.yml` on the task branch with `selected_franchise_bundle_hash=<sha256>` (`scripts/ci/selected-franchise-qa.ts`). `selected_franchise_stage=false` is the default and verifies content already staged in development; set it to `true` to stage first. It audits datasets, compares rows and media, builds a preview, checks desktop and mobile with isolated accounts and cleans up its fixtures.
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
- `codex-review.yml` gets `OPENAI_API_KEY` only in its review job, with no database or deploy credentials.
- `env/examples/ci.env.example` lists CI-only names.

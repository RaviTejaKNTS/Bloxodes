# Release

Last verified: 2026-10-22

How code and content reach production. GitHub does the checking, building and deploying, and publishes most content. Roblox wiki bundles publish with their own versioned command (below). Agents don't run checks or builds locally.

## Code: PR to production

1. **Work in the T3 worktree.** T3 gives each task one worktree and branch from fresh `origin/production`. Setup links `.envs` and creates an empty `tmp/`; it installs nothing.
2. **Independent review.** Before opening a code PR, an independent Codex agent reviews the diff.
3. **Open a PR to `production`** and link it to T3. Use T3's PR watcher while checks run.
4. **`pull-request.yml`** sorts the diff. Docs and skills skip the heavy jobs. Code runs migration integrity, env contracts, script tests and the affected app checks. Web changes get a production build, cold/warm catalog pagination and filter/failure regression, and desktop and mobile browser smoke tests with screenshots. The PR build uses a GitHub-only read fixture for music, decal and mesh REST queries; other content still reads managed development. Catalog regression writes no database rows and saves its SHA-bound report under `tmp/test-reports/`. Production image builds do not load this fixture.
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

## Wiki bundles

Roblox and franchise wiki hubs and collections publish with `npm run content:publish`, which owns the `roblox-wiki@1` and `game-wiki@1` contracts and every check. It runs from an up-to-date checkout with no local changes whose publish code matches what's live, refuses pending production migrations, and needs `--target production --apply --allow-prod` to write production. No PR, build or GitHub run is involved, and new games need no code change. The Content Factory runs it from each device's main checkout. Full detail: [Roblox wiki](../content/roblox-wiki.md#publishing), [franchise](../content/franchise.md#publishing).

## Content publication

Other database content, and existing Roblox CI batches, go out through `publish-content.yml` (Publish selected content), dispatched by `bloxodes-release-e2e` or an automation:

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
- **Selected Roblox QA:** for Roblox wiki hubs and collections, dispatch `pull-request.yml` on the task branch with `selected_roblox_bundle_hash=<sha256>` (`scripts/ci/selected-roblox-qa.ts`). It only verifies content already staged in development; it stages nothing and uploads no media. It compares every stored row, revision hash, copy field and public media byte before and after the browser run, checks Cards/List fields, images, metadata, sitemap entries, pagination and saved progress on desktop and mobile with isolated accounts, then removes those accounts. Its report is development evidence, not a production receipt.
- You can run `managed-content-qa.yml` on its own with the exact `approved_sha` and a `batch` or `bundle_hash`. It only writes development.

## Edge Functions

Edge Function code isn't shipped with the web image. `scripts/ops/release-production-edge-function.ts` releases one function from an exact approved SHA, by hand.

## Separate runtimes

These don't change when code merges:

- **Homelab article runtime:** package with `automation-runtime.yml`, then prepare and install. See [articles](../content/articles.md#runtime-releases).
- **Homelab prepared-chart runtime:** release with `stats-chart-runtime.yml` at an approved, deployed production SHA. Activate its dedicated user timer only after the package, schema and worker checks pass. See below.
- **Stats worker:** build an approved SHA on the VPS, and Northflank rebuilds on worker paths. See [stats](../content/stats.md#the-stats-worker).

### Prepared-chart runtime

This is a GitHub-released operational data pipeline. An owner-approved runtime release authorizes its fixed recurring chart-preparation RPCs on production; it does not authorize arbitrary SQL, content publication or other runtime changes. Schema still ships through the protected schema job. The worker requires `--apply --allow-prod --expected-sha`, an installed release authorization and matching schema/RPC contracts. Its service-role key remains broad; the fixed RPC list is enforced by the reviewed runtime, not a restricted database credential.

Dispatch `stats-chart-runtime.yml` on `production` with `approved_sha`. GitHub checks the deployed SHA, database compatibility, Node 22 worker guards and package tests, then publishes `stats-chart-runtime-<sha>` for 30 days. The package contains only its fixed Node entrypoint, built-in-only imports, operating helpers and two user units. No dependencies are installed on homelab.

Before the first activation, required PR database QA must prove the migrated SQL, service-only permissions, worker bootstrap and real API deadlines in isolated managed-development schemas. Dispatch `pull-request.yml` on the reviewed task SHA with `stats_prepared_benchmark=true` for the representative all-game bootstrap, late-change and membership-rebuild benchmark. Inspect its timing, prepared-table storage and cleanup receipt; a failed budget is a failed release gate. Mock worker tests in the packaging workflow do not replace these database results.

Isolated QA receipts retain fixed setup/cleanup phase labels, successful and failed request timings, validated SQLSTATE codes and bounded numeric locations. Raw Management API errors and SQL excerpts are never logged. Explicit cleanup appends its evidence without replacing the original failure or timing history. A cleaned fixture with `completed=false` is still a failed QA run.

Deploy schema/producer/runtime before the prepared-only public reader. Empty prepared tables have no legacy aggregate seed. Keep the existing public reader live until bootstrap has produced usable outputs for every intended range/resolution, with honest current/previous coverage. Check source age separately from generation age before reader cutover.

On homelab, `scripts/ops/stats-chart-runtime.mjs inspect` and `install --apply --allow-prod --expected-sha <sha> --run-id <id> --artifact-id <id>` fetch the exact successful GitHub artifact and verify its digest, source/run identity and complete file manifest. Installation uses `/srv/data/bloxodes-stats-chart-runtime`, an atomic `current` pointer and only the two `bloxodes-stats-chart-refresh` user units. It reads existing production HTTP credentials in place. Article units, env sources, VPS image pins and Northflank are separate releases.

Installation and invocations share a nonblocking lock. The worker has a bounded deadline and a database lease; a busy install must not stop a running job. A later web deployment may descend from the pinned runtime SHA without moving that pin. Rollback requires the recorded previous package, `--from-sha`, the expected previous SHA and compatible live schema. It changes only this runtime and its units, never schema.

The installer's 260-second internal budget reserves 65 seconds for recovery inside a 270-second hard deadline. It refuses activation without enough remaining time. Before changing units, pointer or retained state, it durably saves `state/activation-pending.json`. TERM/INT routes through bounded restoration of files, pointer and all three chart timer controls. Hard interruption may leave only that snapshot. Its presence blocks further activation and recurring runs until an operator reconciles the recorded state; do not delete it merely to retry.

Completion requires actual timer-run receipts, prepared generation/source timestamps, public chart readbacks and external heartbeat monitoring. A successful installer or schema-compatible health response does not prove charts are ready. Failed bootstrap retains last-good results or an explicit unavailable state. Preserve both packages. On interrupted activation, inspect `activation-pending.json` and `activation-failure.json`, including `restoredFiles`, `restoredSystemd`, `needsReconciliation` and each restoration attempt. An old successful `activation.json` alone does not prove the current state is reconciled.

## CI credentials

- All CI runs with `BLOXODES_ENV_PROFILE=process-only`.
- PR jobs use `MANAGED_DEV_SUPABASE_URL`, `_ANON_KEY`, `_SERVICE_ROLE` and `_ACCESS_TOKEN`.
- The `production` GitHub environment (only the `production` branch can use it) holds Studio credentials and the four `WIKI_R2_*` keys. Database, media, revalidation, Dokploy and GHCR secrets are repository secrets.
- `codex-review.yml` gets `OPENAI_API_KEY` only in its review job, with no database or deploy credentials.
- `env/examples/ci.env.example` lists CI-only names.

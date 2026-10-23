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

Selected-page code-lookup changes also require a GitHub-only managed-development PostgREST probe. It creates run-owned, service-only public table clones and the canonical old aggregate view, verifies complete results and pagination, then removes only its four owned relations. Actual editorial rows and publication triggers are untouched. Finally cleanup and an independent always-run cleanup step retain a SHA/run identity and sanitized backend receipt together; failed or unfinished verification and failed cleanup block the required check. Whole-job cancellation can prevent cleanup, so retain the exact identity for any needed reconciliation.

Missing cleanup identity fails when backend evidence exists and preserves that evidence. When both files are absent, cleanup reports an explicit not-started no-op. Saved passing verification requires an exact fixture identity match, including nonce and relation allowlist, and the completed compatibility check. Mismatched verification remains failed and is retained as history while cleanup uses only the independently validated durable identity.

Failed code-fixture SQL retains only a fixed phase, validated SQLSTATE, fixed error class and bounded numeric locations, including wrapped Management API failures. A successful new fixture does not establish removal of an older run's retained objects. Keep the older durable identity and failure evidence until separate reconciliation proves those exact objects absent.

Historical code-fixture reconciliation is a separate manual `pull-request.yml` job. Its optional `code_lookups_recovery` input must equal `reconcile-39955744530-39956105978-39957597153-39958648149`. The runner pins those four failed runs and artifact IDs/digests, validates every original identity before database access, and uses the same guarded four-name cleanup for each. It accepts no arbitrary SQL, target or artifact list. The job receives only development Management credentials and an Actions-read GitHub token. Original failure bytes remain immutable; a separate recovery receipt needs all four absence proofs. Dispatch only after the runner, its helper correction and the final SHA have passed review and GitHub verification. Normal PR checks run its tests without enabling reconciliation.

Historical revisions must match the pinned top-level workflow-run SHA and artifact workflow-run SHA. Nested pull-request head SHAs can advance after a run. Validate their full SHA shape and exact PR number, head/base refs and same-repository IDs as association metadata; do not require that nested SHA to equal the historical or execution SHA.

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

Check available database, disk and WAL headroom before creating the full benchmark. The Free development project's capacity does not fit its intended 100,000 games and 25,108,320 source-history rows. Do not retry a failed population run without an approved capacity solution. Retain setup progress and storage checkpoints; distinguish database bytes from disk/WAL usage. Neither a smaller fixture nor an ephemeral PostgreSQL result replaces this managed-development gate.

For a no-database runner inventory, dispatch `pull-request.yml` with only `stats_prepared_capacity_probe=true`. Its isolated job records SHA/run identity, filesystem bytes/inodes and Docker storage inventory without managed credentials, services or population. The selection suppresses chart fixture creation. A green probe proves the inventory completed, not that a full benchmark fits or that a different benchmark environment satisfies the release gate.

Manual selections are validated in `scope` before selected actions can run. Capacity, recovery, database and both selected-content jobs depend on that successful validation. Conflicting purposes, including diagnostics, selected content, capacity and recoveries, fail before those actions; a skipped diagnostic cannot be treated as a passing diagnostic.

Exact-artifact recovery of failed benchmark run `39973670048` is a separate manual `pull-request.yml` job. Set `stats_prepared_recovery=reconcile-39973670048`; this selection suppresses ordinary chart fixture creation. The job tests its helper before exposing development Management credentials, validates the pinned source run, artifact digest and original failed receipt, then removes only that identity's recorded objects. Cleanup uses bounded metadata-only `DROP ... RESTRICT` in one explicitly read-write transaction; it changes no database, role or project settings. A separate read-only request must prove both exact schemas and all recorded public aliases absent. Preserve original failure bytes beside the recovery receipt. Recovery success cannot make the original benchmark complete or prove capacity for another run.

Before receiving managed credentials, the recovery test step executes the generated cleanup SQL against a disposable PostgreSQL 17 service on GitHub. It rejects foreign keys crossing the owned table set in either direction, then drops the validated tables together with RESTRICT so internal cycles can be removed. The tests require atomic rollback, external object survival, idempotence and transaction-only read-write access. This cleanup proof does not replace the managed-development benchmark, capacity or worker-deadline evidence.

The representative REST drain also needs evidence from repeated actual worker invocations with its unchanged 210-second total, 10-second advance and 8-second control deadlines. Record the phase associated with slow or failed calls, peak source/prepared storage and cleanup backlog. A 12-second QA transport allowance or grouped fixture SQL success alone does not establish those worker limits. Verify bootstrap readiness separately from steady-state source lag and collector-trigger overhead.

Isolated QA receipts retain fixed setup/cleanup phase labels, successful and failed request timings, validated SQLSTATE codes and bounded numeric locations. Raw Management API errors and SQL excerpts are never logged. Explicit cleanup appends its evidence without replacing the original failure or timing history. A cleaned fixture with `completed=false` is still a failed QA run.

A claim cardinality failure retains the original REST status, validated SQLSTATE, fixed error class and bounded claim line when available. One separate service-role SQL probe rolls back both successful and failed claim work and returns only sanitized diagnostics. Probe success never replaces the failed API result; `completed=false` remains failed QA after cleanup.

Claim diagnostics distinguish exact pg-safeupdate UPDATE/DELETE guard messages from other cardinality errors. Failure receipts retain only fixed error classes and field-type tags. Observe the HTTP guard rejection before authoring a forward migration; successful SQL probe rollback does not establish a successful HTTP request.

Prepared claim QA replays the frozen original migration followed by its membership-delete correction from exact checkout bytes. The receipt records each ordered path, SHA-256 and byte count, successful installs and preserved claim identity, owner, permissions and settings. The legacy single migration hash alone is insufficient. Build aliases only after both migrations succeed; require the real HTTP pipeline, representative benchmark and cleanup before release.

Fixture-only drains may group real bounded advance calls inside one explicitly timed SQL SELECT. Each attempt saves its scenario, first step UUID and bounded cursor state before dispatch. Successful batch and drive receipts retain the maximum's exact phase/UUID/cursor, up to eight calls taking at least one second, and counts, SQL sums and maxima for every phase. Individual timings cover the outer advance, including shared cleanup; they do not identify individual helper costs. State sampling and bookkeeping remain inside the unchanged batch/drive budgets but outside the individual advance timer. REST receipts retain the requested UUID, returned phase and labelled snapshot age without another read per advance. Pending SQL batches identify their first UUID, not an unobserved later failing call. Failed or interrupted attempts remain incomplete after cleanup. These receipts do not establish the representative REST benchmark or actual worker limits.

For targeted daily profiling, dispatch only `stats_prepared_daily_diagnostic=true`. It uses the unchanged small fixture and real advances to reach cursors 0 and 256, then obtains twelve rollback-only plans comparing the full advance, daily helper/CTE and shared cleanup/candidate searches. Each probe uses a fresh normal claim after a normal yielded finish. Admission reserves the full request, state read, finish and margin against the actual lease expiry and the unchanged twenty-minute total. Each lease establishes a new full baseline; source and prepared rows remain unchanged across renewal, while only verified normal control and finish-receipt changes are allowed. UTC-hour rollover, clock drift and unexpected source, membership or cursor changes reject the run. Complete row counts and fingerprints verify logical rollback for every probe; physical cache/WAL effects remain. Extracted SQL uses typed custom plans and can differ from cached function plans. The diagnostic neither changes production deadlines nor proves their fit. Its receipt keeps `completed=false`, `acceptance=false`; success means plans were collected and owned cleanup completed. The always-run cleanup step and SHA-bound artifact remain mandatory. Do not combine this mode with another diagnostic, benchmark, selected content, recovery or capacity selection.

For prepared-reader investigation, dispatch only `stats_prepared_reader_diagnostic=true`. After exact frozen migration replay and installed definition/ACL proof, one service-role schema-document request verifies alias visibility without retry. This installation discovery is separate from measured reads. The diagnostic then runs before source population or producer calls. Eight fixed synthetic cases produce 44 estimated/analyzed profiles, scalar coverage checks and nine REST reads. The original failed payload was not captured; these cases do not claim to replay it. All measured reader SELECTs retain the top-level 2s statement and 500ms lock limits; REST retains a single 3s budget including body read and parse, with no retry. A private finite SECURITY INVOKER profiler catches query cancellation inside a subtransaction so the same completed Management request can reach its outer ROLLBACK. Unknown or incomplete HTTP outcomes stop; a separate pooled ROLLBACK cannot prove cleanup of a failed session. The profiler changes instrumentation and does not establish cached-plan equivalence. Positive bounded projections and pending request identity are saved before subsequent work. `completed=false` and `acceptance=false` remain fixed even after all cases validate; owned cleanup and SHA-bound evidence remain mandatory. Do not combine it with another selected purpose.

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

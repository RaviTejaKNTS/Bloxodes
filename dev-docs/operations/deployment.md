# Production Deployment

Status: Active; environment, schema, Edge Function, and platform synchronization controls verified
Last verified: 2026-10-08
Path layout rechecked 2026-10-08 against live T3 registrations, Git worktree metadata, service paths and env links. Other component verification boundaries remain as documented.
Evidence: inspected GitHub workflow/configuration, protected PR checks, managed-development readiness and SQL byte proof, guarded production ledger readback, exact-SHA deployment/database health, and verification-only content/browser checks. Installed homelab runtime, HDD state aliases, protected env metadata and timer preservation were also verified. Historical VPS and Edge Function observations retain their recorded dates below.

## Task and release workflow

Status: Protected PR flow, production schema/web release and verification-only content flow verified.

PR checks validate changed workflow syntax before heavier jobs start. The GitHub runner downloads a pinned, checksum-verified actionlint release. Its only schema exception accepts GitHub's supported `concurrency.queue` field, which that release does not yet recognize. Publication passes the managed QA receipt path through the consuming step's environment, where the runner context is available.

T3 assigns one task worktree and branch. Agents stay there, edit the task's files and push a PR targeting `production`. The main checkout stays clean on `production`. Configure T3 for worktree mode and register the actions in `t3.json`. New tasks start from a fresh `origin/production`. The automatic setup action waits before the agent starts; it installs no dependencies and runs no local checks or builds. See the HDD and shared-files contract below.

`Pull request checks` classifies the diff. Guidance-only PRs skip dependency installs and builds. Code PRs run migration integrity, CI env contracts, script/runtime tests and affected app checks. Web changes get a development-backed production build and desktop/mobile Chromium smoke with screenshots. CI starts the standalone server with the same public/static/data layout as Docker and waits for the deployment database-health endpoint. It does not require a fresh production stats pipeline in development. Browser reports last one day. Superseded check jobs cancel; database jobs serialize and do not cancel an active transaction.

`Required PR checks` is the single protection check. It requires the real managed-development job and affected checks to succeed. A failed, cancelled or missing required job cannot turn green. Fork PRs cannot run credentialed development mutations; maintainers must bring approved work into an owned task branch. Production protection requires this check from GitHub Actions, enforces it for administrators, rejects force pushes/deletion and requires PR flow. Required approval count is zero so the owner can release through a checked PR without a second account. This repository is public; protection is available on its current plan.

Use T3's PR watcher while waiting. Merge approved work with a merge commit to keep ancestry for cleanup. GitHub deletes the remote branch after merge. After a finished task is settled in T3 with no active run, the exact-worktree cleanup helper removes only its clean merged branch/checkout. Apply requires `--inactive-confirmed`, refuses outstanding game claims and archives private scratch files with SHA-256 readback first. Detached automation and rollback runtimes are preserved. Fast-forward the clean main checkout to the released SHA, without installing dependencies or altering installed services.

Protected PR checks, managed/production schema verification, exact-SHA web/database health and the verification-only content flow have passed. The `/games` canary verifies migration history, compatible live code, metadata, sitemap membership and desktop/mobile rendering with zero content operations and zero cache events. It does not prove a real content write. Detailed execution receipts belong to the [October 7 release audit](../../docs/2026-10-07-github-release-audit.md).

## HDD worktrees and shared files

The saved T3 project uses `/srv/data/projects/Bloxodes`, defaults to worktree mode and has Setup worktree, Open GitHub checks and Open pull request actions. Setup runs on worktree creation with `async: false`, so T3 waits before the first agent turn. The active checkout also has its env and shared-draft links. Updating these project settings through T3 requires a live Full access/default caller.

The homelab main checkout and Git history live at `/srv/data/projects/Bloxodes`. T3 project and thread registrations use canonical HDD paths; the home-project compatibility link has been removed. New T3 worktrees use `/srv/data/t3code/worktrees/Bloxodes/`. T3 owns task creation and thread binding; do not move an attached thread by creating a second branch or thread. Keep main on `production` and preserve edits in existing tasks when fetching production for new tasks.

Setup links `.envs/` and four authoring folders from the main checkout: `tmp/content-workspace`, `tmp/game-plans`, `tmp/game-collection-suggestions` and `tmp/game-collection-runs`. A change to shared draft files is visible in every worktree. They remain ignored and are not copied into a code PR. Selected publication still needs its exact reviewed CI bundle and authorization.

Before editing shared game drafts, run `npm run claim:shared-content -- --game <slug>`. The exclusive claim belongs to the current checkout and persists between agent turns. The same checkout releases it with `--release` after its work is finished. Do not delete another checkout's claim. Operators resolve abandoned claims only after checking that task in T3 and preserving its artifacts.

`tmp/shared-history` exposes existing article briefs/finals/media/reviews and selected source/media folders as historical references. Keep those originals unchanged. New pipeline runs, reports, logs and preview state belong in each task's own scratch directory. Never link the entire `tmp`, `node_modules` or `.next` between checkouts. The setup script checks all destinations before adding links and stops on conflicts without replacing local files. Missing or dangling optional reference sources and dangling links under `tmp/worktree-reference` produce one warning per skipped reference and stay intact. Required env, shared-folder and content-claim links remain strict.

Installed automation releases, `/etc` env files, timers and runtime state retain their existing ownership. The shared article/wiki lease keeps its original directory inode at the canonical path under `/srv/data/projects/Bloxodes-runtime-legacy/tmp/article-writer`. The retained legacy runtime directory is also on HDD; installed automation releases keep their existing locations. Saved T3 worktree paths and Git pointers now use their canonical HDD locations. This path update does not activate a new automation release or alter credentials.

Cleanup accepts the actual T3 HDD task directory and old nested task paths. Run it from another checkout only after checking T3 inactivity. It preserves detached releases, dirty/unmerged/locked tasks and claimed drafts. Its private archive under main `tmp/finished-worktrees/` retains regular scratch files and hashes, without following shared-folder symlinks or copying caches. Link targets are recorded in the private manifest. Checkout-owned env files and unknown ignored data outside scratch block cleanup until preserved.

## Selective code review

`Selective Codex review` uses `openai/codex-action`, pinned to a reviewed commit, with the existing repository `OPENAI_API_KEY`. It reviews application code, scripts, migrations, dependencies, CI and runtime configuration. Documentation, skills and authoring content alone skip the paid action. Mixed PRs receive a code review. `scripts/ci/review-scope.mjs` owns this decision and GitHub runs its policy tests.

A same-repository PR targeting `production` gets a review when opened ready, reopened or changed from draft to ready. Drafts and forks cannot use the API credential. Follow-up pushes cancel outdated review runs without starting another paid review. Once fixes are ready, request a fresh review through Actions > Selective Codex review, or run:

```bash
gh workflow run codex-review.yml --ref production -f pull_request=<number>
```

The reviewer uses a read-only permission profile on a disposable Linux runner. It receives no database or production credentials, performs no builds or tests and returns bounded structured findings. A separate job posts one reusable PR comment only while the reviewed head is still current and ready. The comment names the reviewed SHA. Old feedback remains historical after a push until a fresh review replaces it. A failed review job is visible in Actions and must be inspected, not interpreted as a clean review. It does not replace the required deterministic PR checks or grant merge/release permission.

Agents use an independent internal Codex review before opening a code PR. The repository's separate automatic all-PR review setting in ChatGPT is off, as confirmed by the operator. That account setting is outside GitHub workflow control. Keep it off to avoid duplicate reviews. The selected action uses billable API calls; draft and docs-only work do not consume review calls.

## Schema before deployment

`schema-release.yml` is the shared schema job. Development uses HTTPS Management API SQL with `MANAGED_DEV_SUPABASE_ACCESS_TOKEN`, scoped by the script to project `bbtcaurrtyoukvjbxbbj`. The managed database password stays absent. It executes a rollback plan, applies pending forward migrations in one transaction, checks the ledger and runs managed readiness. It produces a SHA/hash receipt.

New applications store their exact SQL file bytes in the development ledger within the same transaction. Before issuing a receipt, CI compares every included migration with the stored SQL hash. An existing version with changed or missing SQL evidence fails. Audited old aliases and three historical comment/formatting differences use pinned source/local hashes in the policy. Their exceptions cannot certify changed files. A receipt contains only proven versions, including verified pre-convergence production candidates when present.

The audited `managed_dev_history_aliases` cover 13 connector timestamps that differ from committed migration versions. They pin the original SQL and local file hashes. CI also proves current shared objects and legacy retirement before copying the original SQL evidence into canonical history records. It preserves the old records and never replays their schema or content changes. The GTA differences were removed by the verified tools-removal migration and later shared-table retirement. New pending migrations still execute normally.

After merge, the production workflow classifies schema changes separately from web changes. Schema-only releases apply without a web rebuild. For mixed changes, the schema job succeeds before the web job starts.

Production uses the existing `release-production-schema.ts` and HTTPS Studio transport as `supabase_admin`. Postgres stays private inside the VPS. The job requires clean exact HEAD and current `origin/production`, a matching managed-development receipt for every pending migration, historical object proof, rollback planning, atomic application and ledger readback. Transactions use an advisory lock and bounded lock/statement timeouts. Do not copy Stack127's direct `supabase db push` into this project.

Migration files remain immutable. CI rejects edits/deletions and runs the existing integrity policy. Additions must work with the old running app. Remove obsolete tables/columns only in a later migration after the app stops using them. A table-removal migration is not an ordinary first-step deploy.

## Web deployment

The existing Dokploy workflow still builds a Node 24 image through BuildKit, publishes an immutable SHA image to GHCR, updates Dokploy and requires `/api/health?scope=deploy` to report that SHA with a healthy database. It then purges mapped Cloudflare tags and checks a small set of public paths. Guidance-only changes skip the image build. The health gate stays lightweight and does not run the deeper stats pipeline checks.

Schema, deployment and selected content jobs share the `bloxodes-production` concurrency lane with `queue: max`. Up to 100 pending runs wait without replacing one another, and active releases are not cancelled. Managed schema jobs use the same queue policy in their separate lane. Production classification compares the healthy live build SHA with the release SHA, so a later guidance commit still deploys earlier changes that are not live. An unknown or unrelated live SHA selects a full guarded schema/web release. Superseded SHAs still fail the exact-current-production gate rather than applying an older plan to a newer release. Queue capacity and ordering follow [GitHub concurrency rules](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency).

## CI credentials

GitHub owns CI credentials. Dokploy owns application runtime env. Workstation `.envs` remains ignored and is not copied into images. All CI processes use `BLOXODES_ENV_PROFILE=process-only`.

- PR/development jobs need `MANAGED_DEV_SUPABASE_URL`, `MANAGED_DEV_SUPABASE_ANON_KEY`, `MANAGED_DEV_SUPABASE_SERVICE_ROLE` and `MANAGED_DEV_SUPABASE_ACCESS_TOKEN`. OAuth connector sessions cannot authenticate GitHub jobs.
- The production environment contains Studio credentials and the four collection R2 keys. Existing database/media/revalidation and Dokploy/GHCR credentials remain repository secrets for existing workflows. The environment deployment policy allows only the `production` branch. Remove older repository-wide privileged copies only after replacement jobs and dependent scheduled jobs are verified.
- Collection publication needs `WIKI_R2_ENDPOINT`, `WIKI_R2_ACCESS_KEY_ID`, `WIKI_R2_SECRET_ACCESS_KEY` and `WIKI_R2_BUCKET`. Copy only the approved existing keys. Do not edit installed runtime env or stop jobs to obtain them.
- `env/examples/ci.env.example` documents CI-only names. `env:doctor -- --ci` validates the committed profiles and injected development target without requiring workstation files on the runner.

## Managed-development content QA

`Managed content QA` runs before selected production publication. It uses the exact committed batch or private immutable bundle and managed-development credentials. It stages selected content, builds a runner-only preview and records desktop/mobile screenshots. Production requires a successful receipt for the same source SHA, GitHub run and input bytes.

Checklist QA creates unique temporary boards, so it does not replace an existing development board. It compares every page field and every task's section code, title, description and required flag, including duplicate counts and publisher defaults. Shared updates must include all retained tasks and preserve their IDs. The publisher checks this against the actual development or production target before writing. Roblox updates retain unchanged task IDs so saved progress survives description edits.

Browser QA checks the complete board, ticking, reload, unticking and account-saved progress on desktop and mobile. A runner-only account/session is separate for each browser project. Chromium maps `bloxodes.test` to runner loopback. The proxy accepts that test host only with both GitHub and managed-QA flags. Normal origin validation accepts matching account requests, while canonicals stay on `bloxodes.com`. The job repeats data comparison after browser QA, writes a hash-bound receipt and removes only its temporary boards, tasks and accounts. Cleanup failures block production too. Screenshots and receipts remain for one day. Reruns replace that run's artifacts, so retrying all jobs or just failed production jobs remains supported.

Manual review can dispatch `managed-content-qa.yml` on `production` with the exact `approved_sha` and selected `batch` or `bundle_hash`. This applies development content only. Its `self_test=true` option creates isolated development checklist fixtures and cleans them up. It cannot publish test content to production. Selected article QA also checks loaded body images and expected video embeds before production publication.

## Selected content publication

`Publish selected content` is a database-only dispatch. Its first job stages and checks selected content in managed development. That job builds a temporary preview, but no Docker image. It installs locked development dependencies explicitly because its publishers need TypeScript and browser tooling even in production mode. It requires the reviewed current production SHA and checks that any required web/data changes are already live.

Before loading inputs or writing content, it runs `supabase:production:release` with `--check-ledger`. This mode reads production migration history only and refuses publication if migrations or audited repairs are pending. It never applies SQL or waits while holding the release lane. Retry the batch after the protected production schema release succeeds.

A small reviewed batch can live at `content/releases/<batch>/batch.json`. Its operations select fixed publishers and exact input files. Changed batches receive development dry-runs in PR CI. For larger/manual or automated work, `dispatchContentBundle` stores only selected authoring inputs in the private managed-development `ci-release-bundles` bucket. The immutable object is addressed by SHA-256. GitHub fetches that exact hash and accepts only bounded data/image files inside the bundle. It never executes bundled code or SQL. Keep failed bundles for retry and clean up expired successful bundles through a controlled storage operation.

The registry covers shared non-Roblox page batches, queued articles, article/checklist/quiz finals, Roblox wiki hubs and collections, franchise hubs and collections, Minecraft tools, Roblox catalog/tool finals, codes-page setup and events finals. Shared pages cover maps, checklists, quizzes, catalogs, tools and codes. Specialist GTA maps keep their frozen engine/import contract; changes to those snapshots use reviewed migrations, not ordinary page publication.

After successful managed QA, the production job proves every selected publisher before its first production write, then uses the established publisher's media/data operations and readback. Roblox collections use the same legacy-media normalization during proof and publication as managed-development automation. Codes setup refreshes only the reviewed slug. It revalidates explicit events and verifies exact public URLs, expected text, metadata and sitemap membership. Public text readback allows six attempts with ten-second request timeouts and five-second delays for temporary propagation failures. Sitemap verification also retains its bounded retry policy. Desktop/mobile Chromium checks the selected pages and saves screenshots for one day. Article queue acknowledgement and the exact wiki request close only after these checks pass. No other drafts, tables or user progress are copied.

New wiki builders move authored work to the existing durable `publishing` status and release their builder lease/slot. The release hook dispatches its exact request once, then leaves queued work alone. CI records `published` after all readback passes, or retains a failed receipt for up to three dispatch attempts with a 15-minute delay. Legacy saved requests retain their live-lease receipt contract. The publisher records a preparation phase before uploading and a submitted phase immediately before calling GitHub. After 15 minutes, a stale preparation claim becomes retryable. The dispatch callback checks the exact claim timestamp and phase, so an older publisher cannot dispatch after recovery. For submitted claims, recovery checks bounded GitHub run history for the exact bundle hash, production branch and attempt time, then records the run ID. Each recovery pass also reads recorded runs. A completed run with an unsuccessful conclusion becomes a failed receipt even when CI stopped before the publisher started. Queued, waiting and running jobs remain pending. A successful run cannot replace the required public publication receipt. Failed attempts still wait 15 minutes and stop after three dispatches. Recovery reads all receipt pages by ID; dispatch selection reads past exhausted, delayed and expired requests, so older rows cannot hide newer work. A queued run never triggers another dispatch. An unknown submission outcome still requires manual inspection; missing results from a bounded API read do not prove that GitHub rejected it. Legacy receipts without a phase also require inspection. GitHub run titles use the bundle hash through [run-name](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#run-name), and recovery uses the documented [workflow run filters](https://docs.github.com/en/rest/actions/workflow-runs#list-workflow-runs-for-a-workflow).

The dispatcher binds each wiki request to its stored result paths, exact final/manifest hashes and full immutable private bundle hash before dispatch. CI checks the queue's universe, wiki slug and approved collections against the selected artifacts, exact URLs and cache events before writing and acknowledging. Queue-backed wiki publication requires that frozen bundle; manual publications without a queue ticket can use normal reviewed batches. Failures for legacy processing requests use the same original live-lease check as success. A mismatched batch cannot close or fail another request.

Each article operation must select its queue row's exact `result_path`, approved real file, slug and bytes. Pipeline approval hashes remain mandatory. Its canonical URL and article cache event must be selected before any writes. A queue ID appears once per batch; another article's final or URL cannot acknowledge it.

`content/releases/verify-existing/batch.json` is a read-only `/games` canary. Dispatch it with `apply=false`. It publishes no game/page/row. Do not test CI by creating junk content or modifying a real page.

### GTA release cache configuration finding — 2026-09-26

The GTA code release at `d62e52ee597b07b91893bd99d49eec896bf12fc9` passed exact-SHA deploy/database health and controlled content readback. Automatic content revalidation was then found to fail its Cloudflare purge because the Dokploy runtime zone-ID assignment contains a control character and the following warm-after-purge assignment. This is a runtime environment value problem, not an approved schema or Edge Function change.

For this release, authenticated requests inside the exact deployed web container revalidated only the approved GTA origin routes and pagination; a separate operator purge refreshed only the GTA cache tags. All live routes, sitemap/search and hosted hub artwork were checked after that refresh. The prepared repair is a line-break correction between two existing assignments, preserving every other environment/build value and redeploying the same immutable image. It remains pending explicit production environment approval. Verify HTTP 200 plus `cloudflare.ok` after repair; an origin-only HTTP 502 is not a passing automatic revalidation result.

## Stats Worker Release

The stats worker is a separate production artifact shared by the VPS jobs and
Northflank HOT. `Dockerfile.stats-worker` must pass its build-time smoke before
either environment can deploy it.

For the VPS, install the released `scripts/ops/vps-build-stats-worker.sh` as
`/home/codex-admin/bloxodes-stats-worker/bin/build-image.sh`, then invoke it
with `--approved-sha <full-production-sha>`. The script fetches that exact
commit, builds a candidate, repeats the smoke, preserves a healthy current image
as last-known-good, promotes the candidate, and records the approved SHA for
future pinned nightly rebuilds. Never restore the old `reset --hard
origin/production` builder.

Northflank continuous deployment uses an allowlist covering the worker
Dockerfile, root/workspace package manifests, `scripts/`, required web source,
`types/`, `data/`, and `env/config.json`. Unrelated documentation/content-only
commits must not rebuild HOT. A worker-runtime commit is complete only after the
Northflank build succeeds, one scheduled or bounded HOT run succeeds, the VPS
candidate is promoted, and a bounded VPS collector plus current-index rebuild
advance production health.

## Platform synchronization

GitHub owns release checks, schema application, build/deploy and selected content verification. The agent inspects their results and fast-forwards clean local production to the released SHA. It does not run local platform checks or dependency installs.

Installed automation release pointers, env files and services stay on their existing release until a separately authorized activation. The source publication hooks now dispatch exact CI batches, but merging source alone does not activate installed runtimes. Preserve active jobs and detached rollback checkouts. Existing runtime health evidence below retains its original dates.

## Known Release Caveats

- The docs/env migration does not change `package.json` dependency versions or `package-lock.json`, but the 2026-08-13 `npm audit --omit=dev` result for the whole monorepo reported 16 high and 6 moderate advisories. Many traverse the non-deployed Expo/mobile toolchain; direct root findings also include Next.js 16.2.0, PostCSS 8.4.35, and Sharp 0.33.x.
- The official July 2026 Next.js security release recommends 16.2.11 for the active 16.2 LTS line. Upgrade and regression-test web dependencies in a separate focused change before describing the entire repository as dependency-security clean: <https://nextjs.org/blog/july-2026-security-release>.
- The split env profile and full Next production build passed both directly and inside the Compose builder. Final local Compose image export/runtime smoke testing remains pending because the workstation reached 99% disk use and OrbStack stopped during export; see `dev-docs/infrastructure/docker.md`.

## Failure Handling

- If the expected SHA never becomes healthy, do not purge/warm as if deployment succeeded.
- Inspect the Swarm task, app logs, database health, and shared VPS pressure.
- Deploy immutable previous images for application rollback; database changes remain forward-only and require compensating migrations/scripts.
- Never force-push production or include another worktree's changes.

### Cache configuration repair — October 1, 2026

The user-authorized automation repair rechecked the September 26 environment defect and confirmed it still existed. The malformed control-character separator was replaced with a newline under an exact environment/image snapshot guard. Every other parsed environment value and all build settings were preserved. Dokploy redeployed the same immutable `64dd8684bbc9023aa85c377009f19c8c76007bda` image; deploy health returned healthy database readiness at that SHA. Authenticated revalidation of the already-published Dusty Trip article then returned HTTP 200 with `cloudflare.ok=true`, nine successful tag purges and no purge errors. This supersedes the pending cache-environment repair above; it is a scoped revalidation check, not a broad production audit.

## October 2 operator and pipeline repair

The dedicated homelab Bloxodes public key was appended to the existing `codex-admin` authorized keys without removing prior keys. Direct key-based SSH to the VPS now succeeds. The workstation operator profile uses `codex-admin`; no private key or application secret was copied to the VPS.

This repair must preserve disabled services and current cron ownership. Install only the changed wrapper and active job entries, retaining owner-disabled entries and unrelated crontab blocks. Build the worker with the explicit released SHA and smoke its candidate before promotion. Homelab runtime activation waits for all existing jobs to finish and preserves the optional recovery timer state. Event runners and GitHub monitoring are excluded.

October 2 repairs released as `34b925cca7788e7db83e58d640031e89ffe01cec`. The production deploy succeeded and `/api/health?scope=deploy` returned that SHA with a healthy database. The VPS worker candidate passed the expanded smoke check and promoted at the same SHA. Its wrapper and selected WARM/ledger cron changes are installed; unrelated jobs and legacy event entries stayed unchanged. The active REST readiness listener now binds IPv4 loopback and is healthy. Schema release accepts explicit `--database-role supabase_admin` for functions owned by that administrator; the default stays `postgres`.

The existing `alpine/socat` REST proxy is now Compose-owned as `rest-proxy`, sharing the REST service namespace with an explicit healthy/restart dependency. Reconcile the pair with `docker compose -f docker-compose.yml -f docker-compose.pg17.yml up -d rest rest-proxy`; do not replace REST alone with `--no-deps`. Verify that proxy `HostConfig.NetworkMode` is `container:<current REST container ID>`, `postgrest --ready` succeeds, an authenticated public REST read succeeds, and the web health check is healthy. The declaration avoids leaving a manually launched proxy attached to a removed container. This operation controls the existing active pair only.

Worker launches explicitly enforce `BLOXODES_ENV_PROFILE=process-only`, matching the image default. This is required for the Python candidate importer as well as Node jobs. The wrapper test rejects real execution commands that omit it.

The stats worker installs Python system CA certificates and fails its image build when Python's HTTPS trust store is empty. Node's built-in roots alone do not cover the Python candidate importer.

Final VPS worker image and approved-worker-sha: `69b47e4f888896c66cfe1524978926fc0de009ae`. The host wrapper matches committed checksum `2abf4878d00c209cf90adebea9e117bfacf8fcf086c152607af0c905c90bdc52`. Full candidate import and bounded official verification succeeded. Web/homelab remain at the code-equivalent pipeline runtime `34b925cca7788e7db83e58d640031e89ffe01cec`; subsequent commits concern the worker, operations and schema snapshot.


## Minecraft release, October 3, 2026

The owner-approved Minecraft release deployed commit `a9cc2a01bb0f41adadcd4e5349bfd776df9f85b6` through [GitHub run 37116355973](https://github.com/RaviTejaKNTS/Bloxodes/actions/runs/37116355973). Exact-SHA web/database health passed. The production rollback-only schema plan contained only the two approved Minecraft migrations; atomic application and a later zero-pending convergence check passed. The operator SSH key was unavailable, so schema release used the documented Dokploy transport. The revalidation artifact used the authenticated Dokploy container terminal and restart API with checksum, ownership/mode and rollback guards. Its final smoke passed after the web deployment.

Controlled publication and full readback matched one hub, 25 revisions with 9,070 rows, 13 tools and two release anchors. All 93 live HTTP checks and four crawler-agent requests passed. The current web and Supabase containers were running with healthy probes where configured. Stopped older Swarm web tasks remained historical deployment entries. The regenerated schema snapshot and release documentation are a follow-up commit with no web-runtime changes, so the deployed image remains the exact Minecraft implementation SHA. The task checkout and unrelated primary-checkout edits are retained.


## Minecraft edition split, October 3, 2026

The Java/Bedrock split deployed `34541eb14b0fb5d2138539d01314a1597edc2105` through [GitHub run 37122762324](https://github.com/RaviTejaKNTS/Bloxodes/actions/runs/37122762324). The workflow succeeded and deploy health returned the exact SHA with healthy database readiness. Two backward-compatible migrations passed the rollback-only plan and were applied through the established Dokploy transport before deployment. Prepared hubs and revisions were staged unpublished. After exact-SHA health passed, service-only atomic activation published both hubs and 48 exact revisions while hiding the legacy parent. All 50 exact wiki URLs, three legacy redirects, sitemap coverage and complete affected data/media/copy readback passed. Scoped revalidation processed 53 events with 64 successful Cloudflare tag purges. The deployed web container and production Supabase stack remained running and healthy where probes are configured.

Local production synchronized to the release while preserving unrelated edits. Publication ran on the primary homelab, so separate homelab synchronization was unnecessary. The task worktree and branch remain available. The live schema snapshot and these release receipts are a documentation-only follow-up and do not require another web deployment.

## Shared game production release

Last verified: 2026-10-06
Evidence: production workflow `37448331294`, exact runtime SHA and healthy database, guarded migration receipts, private backup hashes and affected live URL readback.

The shared-game release applied five backward-compatible migrations first, deployed web SHA `49cbe765bb1a8f13b6967e6fcee800960534760a`, then applied eight retirement and integrity migrations. Each migration flushes deferred constraints before its ledger entry. The retirement compares every original field while locking the 21 source tables, then removes those tables and eight views without `CASCADE`. Production retains 49,197 collection items, 756 revisions, 116 comments and 12 saved checklist-progress records. The schema snapshot is a native post-retirement dump.

The three owned namespace revalidation events passed through the existing production worker. Its compiled JavaScript is identical to the previous source; the added event type is only a TypeScript annotation. No worker restart was needed. This release ran on the primary homelab, so no separate homelab checkout synchronization was needed. The task worktree remains available for follow-up.

## Shared reference-page release

Last verified: 2026-10-06
Evidence: schema workflow `37492031155`, deployment workflow `37492747348`, atomic migration receipts, map snapshot readback, exact-SHA health and scoped public URL checks.

The schema-only push `048123eda0ed18f813da5fa6f7f776a7d6a8fc8e` skipped web deployment. The rollback-only production plan passed, then the eight reviewed migrations applied atomically through the existing Studio transport. The importer preserved and published all nine GTA map snapshots before dependent code reached production.

The web deployed `118b66d471623c520b1e9ae4457523c5d51fdf09` with healthy database readiness. All nine owned map URLs passed canonicals and sitemap checks. The current web and Supabase containers are running and healthy where probes are configured. The native schema snapshot and current-state guidance follow in a documentation-only commit.

The release ran on the primary homelab, so no separate homelab checkout synchronization was needed. The task worktree and branch remain available. Local env checks reported four undocumented article automation keys outside this release. Those runtime values were not changed.

## Automation activation

The GitHub QA runtime is installed and active at `/srv/data/bloxodes-automation-runtime/current`. All seven service files match the released source. The five timer files, their enablement and their active states are unchanged. Protected env contents and access controls, saved state, the original shared lease inode and rollback releases are preserved. See the [October 7 release audit](../../docs/2026-10-07-github-release-audit.md#checklist-qa-and-automation-release) for the installed SHA and activation receipts.

Installed article/wiki workers author and review content. Their units set `BLOXODES_CI_QA=1`, so they delegate previews and final checks to GitHub, except the file-only article image readiness check. Writing reconciles placed images' headings and alt text. Unused verified images pass readiness and stay out of promotion and provenance sync. Completed authoring remains pending technical QA until GitHub verifies its frozen batch. Article outbox records the bundle hash before dispatch and reconciles its exact GitHub run. Pending runs do not consume another retry. Failed runs retain bounded retry limits; successful runs still need the verified queue receipt.

Runtime activation needs an explicit operator request. First release the reviewed source through a protected PR. Dispatch `automation-runtime.yml` on that exact production SHA, download its SHA-named dependency artifact to HDD and verify the successful run's source SHA. The packaging runner uses Node 22 to match the homelab services and records its actual Node major. Run `automation:runtime:prepare -- --sha <sha> --artifact-dir <download-directory>`. It verifies the lockfile, archive hash and host compatibility, then extracts GitHub-installed dependencies without a local install or build.

The unified installer accepts only that released, clean candidate. It refuses active workers, suspends only timers that were active, and takes the shared lease before switching. Persistent state moves to `/srv/data/bloxodes-automation-runtime/state` through a staged copy with file hash, owner, mode and alias readback. The old paths remain compatibility links. Units and the current pointer switch with rollback backups; timer cadence and enablement stay unchanged. Protected env files and saved work are preserved. Resume activation after active jobs finish, never stop a job to make it fit.

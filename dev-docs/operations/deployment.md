# Production Deployment

Status: Active; environment, schema, Edge Function, and platform synchronization controls verified
Last verified: 2026-10-03
Evidence: GitHub workflow, Dockerfile, exact-SHA Dokploy deployment health, managed-development/production migration readback, VPS incident evidence, Edge Function release smoke, guarded e2e homelab synchronization contract, and platform checks

## Local agent checkout

Last verified: 2026-10-07
Evidence: fetched `origin/production`, checked local status and commit ancestry, verified recovery archives and bundle, and inspected registered worktrees and runtime pointers.

Agent work uses `/home/teja/projects/Bloxodes` on `production`. Agents must not create branches or worktrees unless the user explicitly requests one, including during releases. Commit and publish only the current task's authorized files. The branch name does not grant production deployment or database permission; ordinary development keeps using managed Supabase development.

The October 7 cleanup removed the completed `shared-game-page-types` and `top7-wiki-canonical` development worktrees. Their commits were already in production. Uncommitted main-checkout work and task artifacts are preserved in a private recovery directory under `tmp/worktree-cleanup-*`, with its path recorded in `tmp/worktree-cleanup-latest.txt`. The full working-tree snapshot also has a local `refs/cleanup-backups/20261007-main-checkout` recovery ref. Existing article and shared automation release checkouts and their runtime pointers remain unchanged.

## Normal Path

1. Approved code/data reaches `production`.
2. GitHub classifies the changed paths and skips unrelated changes.
3. A Node 24 BuildKit build receives production build variables through a secret mount.
4. GHCR receives an immutable commit-SHA image and the moving `production` tag.
5. GitHub updates Dokploy to the immutable image and triggers deployment.
6. The workflow waits until `/api/health?scope=deploy` reports that exact SHA and a healthy database.
7. It purges route-family Cloudflare tags, optionally performs an explicit full purge, and checks selected public paths.

The classifier skips `AGENTS.md` guidance files under `apps/web`. Updating route or library instructions alone does not rebuild the web image.

The public `/api/health?scope=deploy` response is the container/deploy gate. It performs one lightweight database-readiness request and returns build SHA plus cache feature flags; it does not run stats freshness or pipeline RPCs. The default `/api/health` response remains the deeper operational check and includes stats freshness and pipeline health. Keeping these scopes separate prevents a slow stats query from replacing the only healthy web replica.

## Secrets

- GitHub Actions owns CI build/deploy secrets and public build variables. Production-capable workflow jobs declare the `production` GitHub environment so its approvals/secrets can become the single CI production boundary after this change is released and configured.
- Dokploy owns application runtime env.
- Workstation `.envs/targets/production.env` is for explicit local operator preview/tools, not the deployment source of truth.
- The Docker image must not contain the BuildKit env secret.

## Data-Only Publication

GTA standalone checklist releases apply the additive checklist schema and seeds before deploying dependent web code. The production classifier includes `/gta/checklists` and GTA checklist cache tags for GTA routes and shared checklist component changes. Verify each released detail URL and the GTA sitemap after deployment; do not infer GTA coverage from the Roblox checklist index smoke.

The ads.txt prebuild refresh has a 15-second timeout. Network/provider connection failures retain an existing non-empty public ads.txt file; they still fail the build if no usable local file exists. This preserves the last shipped provider file during an outage without producing an empty replacement.

Database-backed content normally publishes through controlled scripts/migrations and revalidation rather than requiring a web image. Local datasets under `data/` or `apps/web/src/data/` require a code/image deploy.

Schema changes use the authenticated Supabase connector for managed development, followed by migration listing, readiness, and advisors. Production is self-hosted and its Postgres port stays private: `npm run supabase:production:release -- --approved-sha <full-sha>` streams a transaction through SSH into the existing database container and rolls it back after proving the full plan. The publisher removes only migration-file boundary `BEGIN/COMMIT` wrappers before composing its single outer transaction, so a dry run cannot retain a partially committed migration. If host SSH is unavailable, load the `dokploy` env overlay and pass `--transport dokploy`; this uses Dokploy's authenticated owner-only terminal for the same fixed `supabase-db` container while preserving every release guard. If both SSH and Dokploy are unreachable, `--transport studio --database-role supabase_admin` uses the configured HTTPS Studio query API and verifies its database role. It retains the same clean-checkout, exact-SHA, transaction and ledger guards. Apply additionally requires the exact released SHA on `origin/production`, `--apply`, and `--confirm "APPLY production"`. It runs the checked-in object proof, repairs only policy-listed schema-present ledger gaps, applies only expected migrations, finishes deferred constraint checks between migrations, commits atomically, and verifies the ledger. Managed development must pass first; production remains a separate explicit approval.

Production Edge Functions use the same immutable-SHA boundary. `npm run supabase:production:function:release -- --function <name> --approved-sha <full-sha>` compares local and deployed checksums without mutation. Apply requires `--apply --confirm "APPLY <name>"`, preserves the host file ownership/mode, restarts only Edge Runtime, performs an authenticated smoke request, and restores the previous function on failure.

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

## Platform Synchronization

1. Run `npm run env:doctor`, `npm run env:check`, and `npm run supabase:migrations:check` locally.
2. Run `npm run platform:sync:check -- --local-only` before release.
3. After an approved repository release, require the public deploy health SHA and database health to match.
4. Apply approved schema changes to managed development through the Supabase connector, then list migrations and run readiness/advisors.
5. Obtain separate production permission before production schema, Edge Function, VPS, or homelab mutations other than the guarded checkout synchronization included in an explicit e2e release. That checkout-only authorization does not include env changes, unit installation, job interruption, or service control.
6. The homelab is the primary development workspace (user-confirmed and host identity verified September 7, 2026). When releasing on `teja-homelab`, use the main `production` checkout, preserve unrelated working files, and skip separate homelab checkout synchronization and SSH-to-self checks. Do not create a temporary release branch or worktree. When releasing from another machine, synchronize the remote homelab only for article automation changes or an explicit request, using the released `scripts/ops/sync-homelab-checkout.sh` dry-run and exact-SHA apply. Remote preflight failures remain blockers for that remote sync; they do not apply to the active primary workspace. Env, installed-unit, and service changes retain separate authorization.
7. Run the full read-only platform check only for an in-scope remote homelab synchronization or an explicit platform-check request. Releases made on the homelab use the local-only check and required live deployment/content verification, including article automation releases; they do not invoke SSH-based self-inspection.

The check reports drift; it never fixes drift. Database/Storage backup work is intentionally outside this sequence for now.

The final platform check treats the live web image as synchronized when it is the exact production SHA. It may also accept an older ancestor when the intervening commits contain no web-runtime path according to the same classifier used by the deployment workflow.

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

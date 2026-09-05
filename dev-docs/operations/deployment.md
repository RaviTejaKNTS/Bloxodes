# Production Deployment

Status: Active; environment, schema, Edge Function, and platform synchronization controls verified
Last verified: 2026-08-15
Evidence: GitHub workflow, Dockerfile, exact-SHA Dokploy deployment health, managed-development/production migration readback, VPS incident evidence, Edge Function release smoke, guarded e2e homelab synchronization contract, and platform checks

## Normal Path

1. Approved code/data reaches `production`.
2. GitHub classifies the changed paths and skips unrelated changes.
3. A Node 24 BuildKit build receives production build variables through a secret mount.
4. GHCR receives an immutable commit-SHA image and the moving `production` tag.
5. GitHub updates Dokploy to the immutable image and triggers deployment.
6. The workflow waits until `/api/health?scope=deploy` reports that exact SHA and a healthy database.
7. It purges route-family Cloudflare tags, optionally performs an explicit full purge, and checks selected public paths.

The public `/api/health?scope=deploy` response is the container/deploy gate. It performs one lightweight database-readiness request and returns build SHA plus cache feature flags; it does not run stats freshness or pipeline RPCs. The default `/api/health` response remains the deeper operational check and includes stats freshness and pipeline health. Keeping these scopes separate prevents a slow stats query from replacing the only healthy web replica.

## Secrets

- GitHub Actions owns CI build/deploy secrets and public build variables. Production-capable workflow jobs declare the `production` GitHub environment so its approvals/secrets can become the single CI production boundary after this change is released and configured.
- Dokploy owns application runtime env.
- Workstation `.envs/targets/production.env` is for explicit local operator preview/tools, not the deployment source of truth.
- The Docker image must not contain the BuildKit env secret.

## Data-Only Publication

Database-backed content normally publishes through controlled scripts/migrations and revalidation rather than requiring a web image. Local datasets under `data/` or `apps/web/src/data/` require a code/image deploy.

Schema changes use the authenticated Supabase connector for managed development, followed by migration listing, readiness, and advisors. Production is self-hosted and its Postgres port stays private: `npm run supabase:production:release -- --approved-sha <full-sha>` streams a transaction through SSH into the existing database container and rolls it back after proving the full plan. The publisher removes only migration-file boundary `BEGIN/COMMIT` wrappers before composing its single outer transaction, so a dry run cannot retain a partially committed migration. If host SSH is unavailable, load the `dokploy` env overlay and pass `--transport dokploy`; this uses Dokploy's authenticated owner-only terminal for the same fixed `supabase-db` container while preserving every release guard. Apply additionally requires the exact released SHA on `origin/production`, `--apply`, and `--confirm "APPLY production"`. It runs the checked-in object proof, repairs only policy-listed schema-present ledger gaps, applies only expected migrations, commits atomically, and verifies the ledger. Managed development must pass first; production remains a separate explicit approval.

Production Edge Functions use the same immutable-SHA boundary. `npm run supabase:production:function:release -- --function <name> --approved-sha <full-sha>` compares local and deployed checksums without mutation. Apply requires `--apply --confirm "APPLY <name>"`, preserves the host file ownership/mode, restarts only Edge Runtime, performs an authenticated smoke request, and restores the previous function on failure.

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
6. After an explicit e2e release, synchronize the homelab only when the release changes homelab-owned article automation (`scripts/articles/**`, the article systemd units/checks/installers, or the guarded sync script) or the user explicitly requests it. Use the released `scripts/ops/sync-homelab-checkout.sh` dry-run and then apply against the exact `origin/production` SHA. If the production delta changes installed units, article automation is active, or preflight fails, leave the checkout unchanged and report synchronization pending instead of forcing it. If apply fails after starting, stop and report the exact resulting remote state.
7. Run the full read-only platform check only for an in-scope homelab synchronization or an explicit platform-check request. Ordinary web/data/editorial releases use the local-only check and do not perform remote homelab/VPS inspection.

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

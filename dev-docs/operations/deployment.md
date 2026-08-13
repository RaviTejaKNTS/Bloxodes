# Production Deployment

Status: Active; environment/schema release controls prepared locally
Last verified: 2026-08-13
Evidence: GitHub workflow, Dockerfile, live Dokploy service/image, public health, production build, and `npm audit --omit=dev`

## Normal Path

1. Approved code/data reaches `production`.
2. GitHub classifies the changed paths and skips unrelated changes.
3. A Node 24 BuildKit build receives production build variables through a secret mount.
4. GHCR receives an immutable commit-SHA image and the moving `production` tag.
5. GitHub updates Dokploy to the immutable image and triggers deployment.
6. The workflow waits until `/api/health` reports that exact SHA and a healthy database.
7. It purges route-family Cloudflare tags, optionally performs an explicit full purge, and checks selected public paths.

The public `/api/health` response is the deploy gate. It includes build SHA, database health, stats freshness, and cache feature flags.

## Secrets

- GitHub Actions owns CI build/deploy secrets and public build variables. Production-capable workflow jobs declare the `production` GitHub environment so its approvals/secrets can become the single CI production boundary after this change is released and configured.
- Dokploy owns application runtime env.
- Workstation `.envs/targets/production.env` is for explicit local operator preview/tools, not the deployment source of truth.
- The Docker image must not contain the BuildKit env secret.

## Data-Only Publication

Database-backed content normally publishes through controlled scripts/migrations and revalidation rather than requiring a web image. Local datasets under `data/` or `apps/web/src/data/` require a code/image deploy.

Schema changes use the authenticated Supabase connector for managed development, followed by migration listing, readiness, and advisors. Production is self-hosted and its Postgres port stays private: `npm run supabase:production:release -- --approved-sha <full-sha>` streams a transaction through SSH into the existing database container and rolls it back after proving the full plan. Apply additionally requires the exact released SHA on `origin/production`, `--apply`, and `--confirm "APPLY production"`. It runs the checked-in object proof, repairs only policy-listed schema-present ledger gaps, applies only expected migrations, commits atomically, and verifies the ledger. Managed development must pass first; production remains a separate explicit approval.

## Platform Synchronization

1. Run `npm run env:doctor`, `npm run env:check`, and `npm run supabase:migrations:check` locally.
2. Run `npm run platform:sync:check -- --local-only` before release.
3. After an approved repository release, require the public deploy health SHA and database health to match.
4. Apply approved schema changes to managed development through the Supabase connector, then list migrations and run readiness/advisors.
5. Obtain separate production permission before production schema, Edge Function, VPS, or homelab mutations.
6. Synchronize the homelab to the exact approved production SHA and run the full read-only platform check.

The check reports drift; it never fixes drift. Database/Storage backup work is intentionally outside this sequence for now.

## Known Release Caveats

- The docs/env migration does not change `package.json` dependency versions or `package-lock.json`, but the 2026-08-13 `npm audit --omit=dev` result for the whole monorepo reported 16 high and 6 moderate advisories. Many traverse the non-deployed Expo/mobile toolchain; direct root findings also include Next.js 16.2.0, PostCSS 8.4.35, and Sharp 0.33.x.
- The official July 2026 Next.js security release recommends 16.2.11 for the active 16.2 LTS line. Upgrade and regression-test web dependencies in a separate focused change before describing the entire repository as dependency-security clean: <https://nextjs.org/blog/july-2026-security-release>.
- The split env profile and full Next production build passed both directly and inside the Compose builder. Final local Compose image export/runtime smoke testing remains pending because the workstation reached 99% disk use and OrbStack stopped during export; see `dev-docs/infrastructure/docker.md`.

## Failure Handling

- If the expected SHA never becomes healthy, do not purge/warm as if deployment succeeded.
- Inspect the Swarm task, app logs, database health, and shared VPS pressure.
- Deploy immutable previous images for application rollback; database changes remain forward-only and require compensating migrations/scripts.
- Never force-push production or include another worktree's changes.

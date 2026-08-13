# Docker

Status: Active
Last verified: 2026-08-13
Evidence: root Dockerfiles, compose file, local Docker inventory, and live container images

## Web Image

The root multi-stage `Dockerfile` installs npm workspace dependencies on Node 24, builds `@bloxodes/web`, and copies the standalone Next output, static assets, public files, datasets, and build SHA into a non-root runtime image. The container serves port 3000 and health-checks `/api/health`.

GitHub production builds receive one aggregate BuildKit secret at `/run/secrets/production_env`. Local Compose builds mount the four split production-profile files as separate BuildKit secrets. A direct workstation build reads the same four files from `.envs/`: shared application, content integrations, distribution integrations, then the production target. None is copied into the image; `.dockerignore` excludes `.env*`, `.envs/`, and safe examples as unnecessary build context.

## Stats Worker Image

`Dockerfile.stats-worker` packages scripts, relevant web libraries, types, and datasets with Node 24 and Python. The VPS cron wrapper starts ephemeral `bloxodes-stats-worker:production` containers with a selected `STATS_WORKER_COMMAND`, a private Supabase network, the root-owned worker env file, locks, and per-job logs.

## Local Containers

The local Supabase CLI project is `roblox-codes`. On verification it ran PostgreSQL 17.6.1.075, Kong 2.8.1, GoTrue 2.186, and PostgREST 14.3. Regenerate `.envs/targets/local.env` from the running Kong config with `npm run env:sync-local`; never paste printed keys into docs.

## Compose

`compose.yml` is a plain-Docker local/alternate production runner. At build time it mounts the four split production-profile files as BuildKit secrets; at runtime it loads those same files through `env_file`. It persists Next cache in `next-cache` and maps `${APP_PORT:-3000}`. The normal Dokploy deployment does not use these workstation files as its secret source.

## Local Verification Boundary

On 2026-08-13, `docker compose config --quiet` passed and the real Compose build loaded the four split BuildKit secrets, completed the full Next.js production build, TypeScript, static generation, and trace collection. The local host then reached 99% disk use and OrbStack stopped during final image export, so the final local image/container runtime check could not be completed. This does not affect the normal GitHub/Dokploy path, which uses the already-supported aggregate `production_env` secret, but repeat the final Compose export/runtime smoke test after local disk space is available.

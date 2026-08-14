# Docker

Status: Active; stats-worker packaging guard release in verification
Last verified: 2026-08-14
Evidence: root Dockerfiles, compose file, production container inventory, live image inspection, and stats-worker smoke tests

## Web Image

The root multi-stage `Dockerfile` installs npm workspace dependencies on Node 24, builds `@bloxodes/web`, and copies the standalone Next output, static assets, public files, datasets, and build SHA into a non-root runtime image. The container serves port 3000 and health-checks `/api/health`.

GitHub production builds receive one aggregate BuildKit secret at `/run/secrets/production_env`. Local Compose builds mount the four split production-profile files as separate BuildKit secrets. A direct workstation build reads the same four files from `.envs/`: shared application, content integrations, distribution integrations, then the production target. None is copied into the image; `.dockerignore` excludes `.env*`, `.envs/`, and safe examples as unnecessary build context.

## Stats Worker Image

`Dockerfile.stats-worker` packages scripts, relevant web libraries, types,
datasets, and the non-secret `env/config.json` routing manifest with Node 24 and
Python. The build runs `npm run stats:worker:smoke`; a missing imported runtime
asset therefore fails image construction instead of every scheduled job after
deployment.

The VPS builder accepts an exact approved repository SHA, builds a candidate
tag, repeats the smoke in a disposable container, and promotes it only after a
pass. A healthy previous production image is retained as
`bloxodes-stats-worker:last-known-good`. The cron wrapper starts ephemeral
`bloxodes-stats-worker:production` containers with a selected
`STATS_WORKER_COMMAND`, private Supabase network, host-owned worker env file,
locks, per-job logs, and a pre-command smoke/last-known-good restoration guard.

## Retired Local Supabase Containers

The Supabase CLI project `roblox-codes` was observed on this workstation during the 2026-08-13 audit, but it is no longer part of the active Bloxodes workflow. Do not start it, generate credentials from it, or point application/scripts at it. Local Next.js development uses `.envs/targets/managed-dev.env`; leftover Docker containers may be removed separately when no other work depends on them.

## Compose

`compose.yml` is a plain-Docker local/alternate production runner. At build time it mounts the four split production-profile files as BuildKit secrets; at runtime it loads those same files through `env_file`. It persists Next cache in `next-cache` and maps `${APP_PORT:-3000}`. The normal Dokploy deployment does not use these workstation files as its secret source.

## Local Verification Boundary

On 2026-08-13, `docker compose config --quiet` passed and the real Compose build loaded the four split BuildKit secrets, completed the full Next.js production build, TypeScript, static generation, and trace collection. The local host then reached 99% disk use and OrbStack stopped during final image export, so the final local image/container runtime check could not be completed. This does not affect the normal GitHub/Dokploy path, which uses the already-supported aggregate `production_env` secret, but repeat the final Compose export/runtime smoke test after local disk space is available.

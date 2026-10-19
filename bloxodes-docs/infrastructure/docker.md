# Docker

Last verified: 2026-10-19

## Website image (`Dockerfile`)

- Node 24 multi-stage build. Runs `apps/web/server.js` on port 3000 as a non-root user.
- Health check: `/api/health?scope=deploy`.
- Build secrets come in through BuildKit secret mounts. `.dockerignore` keeps `.env*`, `.envs`, dependencies, scratch files and build output out of the context, so no secret ends up in the image.
- GitHub builds `linux/amd64` and pushes `ghcr.io/ravitejaknts/bloxodes-web:<sha>` plus `:production`. Dokploy runs the SHA tag. See [release](../operations/release.md).

## Stats worker image (`Dockerfile.stats-worker`)

- Node 24 with Python and CA certificates. Copies only scripts, libraries, data and the env manifest.
- Runs `STATS_WORKER_COMMAND` under the `process-only` env profile.
- Runs `npm run stats:worker:smoke` during the build.
- Built on the VPS from an approved SHA and on Northflank. See [stats](../content/stats.md#the-stats-worker).

## `compose.yml`

A plain-Docker way to run the website locally or standalone. It mounts four env profile files as build secrets and runtime env files. Production doesn't use it.

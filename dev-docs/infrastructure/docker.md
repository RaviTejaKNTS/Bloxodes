# Docker

Status: Active; stats-worker packaging guard deployed and verified
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

### VPS boot failures on the Dokploy overlay

The October 16 incident investigation supplied by the parent agent found that a remembered dynamic `IPAMConfig.IPv4Address` on `supabase-kong` collided with the `dokploy-network` overlay load balancer after a hypervisor shutdown. The Compose files did not configure a fixed IP. The stack uses `/home/codex-admin/bloxodes-supabase/docker-compose.yml` with `docker-compose.pg17.yml`, `docker-compose.rest-proxy.yml` and `docker-compose.dokploy-proxy.yml`. This incident evidence does not refresh the broader verification date above.

Docker can reapply a saved address when starting a stopped container and fail if that address is unavailable. See [Docker network restart behavior](https://docs.docker.com/reference/cli/docker/network/connect/#network-implications-of-stopping-pausing-or-restarting-containers). A failed initial start also falls outside normal [restart-policy monitoring](https://docs.docker.com/engine/containers/start-containers-automatically/#restart-policy-details).

The separate `codex-admin` boot-recovery job is ready for operator installation. It retries eligible failed starts, then permits a dynamic overlay reconnect only after an address collision and read-only Compose verification. It keeps every recorded alias and retains a journal across interrupted reconnects. It skips Swarm tasks and never applies Compose or recreates containers. [VPS operations](vps.md#boot-recovery) owns the decision rules, installation status, logs and verification commands.

## Local Verification Boundary

On 2026-08-14, a real local `Dockerfile.stats-worker` image build completed and
its runtime `npm run stats:worker:smoke` passed with the expected build SHA and
process-only environment profile. The production VPS candidate repeated the
same smoke before exact-SHA promotion, and Northflank deployed that SHA before
both a bounded and a normally scheduled HOT run.

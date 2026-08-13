# Dokploy

Status: Active
Last verified: 2026-08-13
Evidence: deployment workflow, VPS Swarm services, Dokploy containers, and public health SHA

## Ownership

Dokploy manages the Bloxodes web Docker provider on the Hostinger VPS. The live Swarm service was `bloxodes-web-ujegas`, with one healthy replica serving immutable image SHA `0c6b5f66…` on verification.

The `production` branch triggers `.github/workflows/dokploy-production-deploy.yml`. GitHub builds and pushes immutable `ghcr.io/ravitejaknts/bloxodes-web:<sha>` plus the moving `:production` tag, updates Dokploy to the immutable image, triggers the deployment, and waits for `/api/health` to return that exact SHA with database health.

## Runtime and Access

Dokploy owns application runtime env. GitHub owns build/deploy secrets and public build variables. Workstation `.envs/targets/production.env` is not either system's source of truth.

Dokploy itself runs in Docker Swarm with Postgres and Redis. Its port 3000 is Docker-published but blocked from the public internet by the host `DOCKER-USER` chain. Use the configured private/local route or an SSH tunnel for operator access rather than exposing that port.

## Verification

After a deploy, require the expected build SHA and database status from `https://bloxodes.com/api/health`, then check selected public routes and both web and Supabase containers. They share the same VPS resource envelope.

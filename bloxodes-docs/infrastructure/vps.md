# VPS

Last verified: 2026-10-19

Production runs on one Hostinger VPS: the website, self-hosted Supabase, Dokploy and the stats worker. They all share its CPU, memory and disk, so heavy jobs, builds and database work compete with live traffic.

## Host and access

- Hostname `srv1432019`, Ubuntu 24.04, 4 CPUs, 15 GiB RAM, 2 GiB swap.
- SSH `ravitejaknts@187.124.68.197`, keys only. Use the homelab's `~/.ssh/bloxodes_deploy_ed25519` (see [machines](machines.md#homelab)). Login details are in `.envs/infrastructure/vps.env`.
- `/home/codex-admin` is a symlink to `/home/ravitejaknts` (the account was renamed). Running containers and some scripts still use the old path, so keep the symlink.
- Root login and password SSH are off. UFW and Fail2ban are on. The `DOCKER-USER` chain blocks public access to port 3000.

## What runs here

| Service | Notes |
| --- | --- |
| Traefik 3.6.7 | Serves 80/443. |
| Dokploy | Docker Swarm with its own Postgres 16 and Redis 7. Dashboard on loopback port 3000; reach it over an SSH tunnel. Server entry `production-vps` uses `ravitejaknts`. |
| Website | Dokploy app `Web`, Swarm service `bloxodes-web-ujegas`, one replica, image `ghcr.io/ravitejaknts/bloxodes-web:<sha>`. |
| Supabase | Compose stack in `/home/ravitejaknts/bloxodes-supabase`. See [database](../data/supabase.md). |
| Stats worker | Short-lived `bloxodes-stats-worker:production` containers started by cron. See [stats](../content/stats.md#the-stats-worker). |
| Not Bloxodes | Vaultwarden, Umami (and its Postgres), an Umami GitHub collector. |

Dokploy owns the website's runtime env. GitHub owns build and deploy. See [release](../operations/release.md).

## Schedules

Everything Bloxodes on this host runs from the `ravitejaknts` crontab, not systemd timers. Root has no crontab. The full list is in [schedules](../automation/schedules.md#vps-cron-user-ravitejaknts). Checked-in copies: `scripts/ops/vps-universe-stats.crontab`, `scripts/ops/vps-scheduled-automation.crontab`, `scripts/ops/vps-boot-recovery.crontab`.

## Boot recovery

After a Hostinger reboot in October 2026, Kong couldn't start because of a stale overlay IP, which took the site down. `scripts/ops/vps-boot-recovery.py` now runs at `@reboot` as `/home/ravitejaknts/bloxodes-supabase/bin/boot-recovery.py`.

- It waits up to 10 minutes for Docker and Swarm, then retries containers that failed to start at boot.
- It only touches non-Swarm containers with `unless-stopped` or `always` restart policies and a recorded start error. Add the label `com.bloxodes.boot-recovery.disabled=true` to opt a container out.
- For an `Address already in use` overlay clash, it reconnects the container to the network without a fixed IP, keeping its aliases.
- It never removes or recreates containers, volumes or Compose config.

To update it, stage `vps-boot-recovery.py`, `vps-boot-recovery.crontab` and `install-vps-boot-recovery.sh` in `/home/ravitejaknts/boot-recovery-review/`, run the script with `--dry-run`, then `sh install-vps-boot-recovery.sh --apply` as `ravitejaknts` (not root).

## Known issues

- UFW still allows public 80/443 alongside the Cloudflare ranges, so the origin isn't Cloudflare-only.
- The Umami GitHub collector container is in a restart loop. It isn't Bloxodes.
- `docker-compose.logs.yml` and `docker-compose.s3.yml` are unused vendor variants, kept because the active Compose file mentions them. Only the base, `pg17`, `rest-proxy` and `dokploy-proxy` Compose files are in use.

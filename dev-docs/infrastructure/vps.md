# VPS

Status: Active; application, migration ledger, and revalidate function synchronized
Last verified: 2026-08-14
Evidence: SSH/container inspection, transactional production migration release/readback, deployed Edge Function checksum/smoke, and exact-SHA application health

## Host

- Hostname: `srv1432019`.
- Provider: Hostinger VPS.
- OS: Ubuntu 24.04.
- Kernel: 6.8.0-124-generic.
- CPU: 4 logical CPUs.
- Memory: 15 GiB; ~8.7 GiB available at check time.
- Swap: 2 GiB and effectively fully used at check time.
- Root disk: capacity pressure must be checked immediately before any approved build, database migration, or vendor-stack work; the later 2026-08-13 read-only check observed approximately 67% used.
- Uptime: about 8 weeks.

The web app, Supabase, Dokploy, Umami, and other services share this host. Heavy crawls, builds, database jobs, and cache operations compete for the same resources.

## Security

Verified effective SSH settings:

- root login disabled;
- password and keyboard-interactive authentication disabled;
- public-key authentication enabled;
- X11, TCP forwarding, and agent forwarding disabled;
- max auth tries 3 and login grace 30 seconds.

UFW is active with default incoming/routed deny. SSH 22 is publicly allowed. HTTP/HTTPS/HTTP3 include Cloudflare network rules but also contain restored public-anywhere rules; therefore the host is not currently Cloudflare-only at UFW level. The `bloxodes-origin-firewall.service` applies additional Docker/origin policy.

Fail2ban `sshd` is active. The `DOCKER-USER` chain drops inbound TCP 3000, confirmed by an external timeout.

## Docker and Services

- Docker 29.4.1, Swarm active.
- Traefik 3.6.7 publishes 80/443.
- Dokploy and its Postgres/Redis services are active.
- Bloxodes web Swarm service is healthy.
- Supabase stack contains 12 core containers plus the REST bridge.
- Umami and unrelated application stacks share the server.

See `data/supabase.md` for Supabase versions and degraded probes.

## Schedulers

- Root crontab: empty for Bloxodes.
- `codex-admin` crontab: authoritative installed schedules for revalidation/cache warm and the stats/scheduled-automation blocks.
- Systemd: `bloxodes-origin-firewall.service`; Bloxodes pipeline jobs are cron/Docker based on this host, not timers.
- Checked-in sources: `scripts/ops/vps-universe-stats.crontab` and `scripts/ops/vps-scheduled-automation.crontab`.

Worker ownership:

- `/home/codex-admin/bloxodes-stats-worker`, owner `codex-admin`, mode 700.
- Runtime env `env.stats-worker`, mode 600.
- Wrapper and build scripts under `bin/`.
- Logs show active jobs through the verification time.

## Operational Risks

- Full swap usage warrants investigation even with available RAM; check pressure, swappiness, and long-lived containers before large jobs.
- Public-anywhere UFW rules on 80/443 weaken the intended Cloudflare-only origin model. Confirm the origin-firewall script's effective policy and remove redundant public rules only through a tested, recoverable change.
- Meta/REST unhealthy probes reduce Docker health signal quality.
- Production migration history was reconciled and converged through repository migration `20260920000013` on 2026-08-14. The deployed `revalidate` Edge Function also matches the checked-in source and passed an authenticated production smoke run.
- Database and Storage backup/recovery work is owner-deferred and excluded from this change.
- Several unrelated workloads share CPU, disk, and Docker; incident triage must inspect the whole host.

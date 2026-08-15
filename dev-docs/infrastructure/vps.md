# VPS

Status: Active; Supabase Meta runaway contained and web stability protections verified
Last verified: 2026-08-15
Evidence: SSH/container/process inspection, repeated public latency checks, transactional production migration release/readback, and exact-SHA application health

## Host

- Hostname: `srv1432019`.
- Provider: Hostinger VPS.
- OS: Ubuntu 24.04.
- Kernel: 6.8.0-124-generic.
- CPU: 4 logical CPUs.
- Memory: 15 GiB; ~7.6 GiB available during the incident check.
- Swap: 2 GiB and effectively fully used at check time.
- Root disk: 59% used during the 2026-08-15 incident check; recheck before large builds, migrations, or vendor-stack work.
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

See `data/supabase.md` for Supabase versions and probe state. The Meta image-level health check is explicitly disabled in production Compose after it caused runaway child processes; the service itself remains running.

## Schedulers

- Root crontab: empty for Bloxodes.
- `codex-admin` crontab: authoritative installed schedules for revalidation/cache warm and the stats/scheduled-automation blocks.
- Systemd: `bloxodes-origin-firewall.service`; Bloxodes pipeline jobs are cron/Docker based on this host, not timers.
- Checked-in sources: `scripts/ops/vps-universe-stats.crontab` and `scripts/ops/vps-scheduled-automation.crontab`.

Worker ownership:

- `/home/codex-admin/bloxodes-stats-worker`, owner `codex-admin`, mode 700.
- Runtime env `env.stats-worker`, mode 600.
- Wrapper and build scripts under `bin/`.
- The source-controlled build implementation is
  `scripts/ops/vps-build-stats-worker.sh`; install it as `bin/build-image.sh`.
- `approved-worker-sha` pins recurring image rebuilds to the last explicitly
  released worker commit instead of arbitrary branch HEAD.
- Candidate images must pass the process-only worker smoke before promotion;
  the wrapper can restore a verified `last-known-good` image automatically.
- Logs show active jobs through the verification time.

## Operational Risks

- Full swap usage warrants investigation even with available RAM; check pressure, swappiness, and long-lived containers before large jobs.
- On 2026-08-15 the 4-core host sustained load well above capacity, with CPU steal and a two-month-old `supabase-meta` container holding about 19,000 zombie Node processes. Swarm then replaced the only web replica after five 10-second deploy-health timeouts, causing a complete site outage during each replacement. Recreating only Meta and disabling its image-level probe dropped Meta from about 108% CPU to under 1% without restarting the public data plane.
- The August 14 universe-stats collapse was not caused by this pressure: both
  VPS and Northflank jobs failed before work because the worker image omitted
  `env/config.json`. The packaging/promotion guards above own that failure mode.
- Public-anywhere UFW rules on 80/443 weaken the intended Cloudflare-only origin model. Confirm the origin-firewall script's effective policy and remove redundant public rules only through a tested, recoverable change.
- The Meta image-level probe is disabled until a bounded replacement is proven. The REST probe still reduces Docker health signal quality because it targets the wrong internal endpoint.
- Production migration history was reconciled and converged through repository migration `20260920000013` on 2026-08-14. The deployed `revalidate` Edge Function also matches the checked-in source and passed an authenticated production smoke run.
- Database and Storage backup/recovery work is owner-deferred and excluded from this change.
- Several unrelated workloads share CPU, disk, and Docker; incident triage must inspect the whole host.

# VPS

Status: Active; Supabase Meta runaway contained and web stability protections verified
Last verified: 2026-10-17
Evidence: operator account and primary group migration with unchanged UID/GID, new SSH and password-authenticated sudo, cron readback, SSH configuration validation/reload, container continuity, public and origin deploy/database health, dashboard connectivity, and matching read-only env copies on both Macs. Hardware, firewall and August incident findings below retain their earlier verification boundaries.

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
- X11 and agent forwarding disabled; TCP forwarding disabled except the existing operator exceptions for `ravi` and `ravitejaknts`, restricted to `127.0.0.1:3000`;
- max auth tries 3 and login grace 30 seconds.

UFW is active with default incoming/routed deny. SSH 22 is publicly allowed. HTTP/HTTPS/HTTP3 include Cloudflare network rules but also contain restored public-anywhere rules; therefore the host is not currently Cloudflare-only at UFW level. The `bloxodes-origin-firewall.service` applies additional Docker/origin policy.

Fail2ban `sshd` is active. The `DOCKER-USER` chain drops inbound TCP 3000, confirmed by an external timeout.

### Operator account

The operator login is `ravitejaknts`, renamed from `codex-admin` on October 17, 2026. Its UID and primary GID remain `1001`; the primary group is also `ravitejaknts`. Membership in `sudo`, `users` and `docker` is preserved, including `ravi`'s supplementary membership in the renamed group. Existing SSH authorized keys are unchanged. The new local account password was verified with sudo; SSH continues to require keys.

The home directory is `/home/ravitejaknts`. Keep `/home/codex-admin` as a symlink to it. Existing Docker bind sources and released operator scripts still use the compatibility path, so removing it would break container recreation and historical tooling. Running application and database containers were not restarted for the rename.

The account and SSH configuration, cron and affected installed scripts were backed up under the root-only `/root/account-migrations/20261017T021405Z`. Account validation retained the pre-existing `pwck` warnings; `grpck` and SSH configuration validation passed. The SSH account exception now lives in `11-ravitejaknts-tunnel.conf`.

Authoritative credentials are in the homelab's ignored `.envs/infrastructure/vps.env`: `VPS_ADMIN_USER`, `VPS_ADMIN_PASSWORD` and the equal legacy alias `VPS_ADMIN_PASSWORD1`. Read them without logging values. Both Mac mirrors were verified byte-identical and mode `0400`; the homelab source remains mode `0600`. The automation dashboard now connects as `ravitejaknts`.

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
- `ravitejaknts` crontab: authoritative installed schedules for revalidation/cache warm, stats/scheduled automation and boot recovery. All 41 scheduled entries and both environment assignments were retained, with installed home paths changed to `/home/ravitejaknts`.
- Systemd: `bloxodes-origin-firewall.service`; Bloxodes pipeline jobs are cron/Docker based on this host, not timers.
- Checked-in sources: `scripts/ops/vps-universe-stats.crontab` and `scripts/ops/vps-scheduled-automation.crontab`.
- The separate `scripts/ops/vps-boot-recovery.crontab` is ready for operator installation. Its `@reboot` job and installation boundary are described below; this implementation does not establish that it is installed.

Worker ownership:

- `/home/ravitejaknts/bloxodes-stats-worker`, owner `ravitejaknts`, mode 700. The old home path remains an alias for existing released scripts and cron templates; install those templates into the new account's crontab.
- Runtime env `env.stats-worker`, mode 600.
- Wrapper and build scripts under `bin/`.
- The source-controlled build implementation is
  `scripts/ops/vps-build-stats-worker.sh`; install it as `bin/build-image.sh`.
- `approved-worker-sha` pins recurring image rebuilds to the last explicitly
  released worker commit instead of arbitrary branch HEAD.
- Candidate images must pass the process-only worker smoke before promotion;
  the wrapper can restore a verified `last-known-good` image automatically.
- Logs show active jobs through the verification time.

## October 16 shutdown and recovery

Evidence, checked 2026-10-17: guest journal and `last -x`, Docker container and network inspection, Hostinger VM actions and metrics, and public health checks after the repair. The broader verification date above stays unchanged.

On 2026-10-16 at 21:14 UTC, Hostinger's hypervisor shut down the VPS. The guest recorded `qemu-ga: guest-shutdown called` and logind reported a hypervisor-initiated shutdown. It booted again at 21:43 UTC. The site outage lasted about three and a half hours because a failed container start persisted after the host returned.

`supabase-kong` failed with `failed to set up container networking: Address already in use`. Its saved endpoint on the attachable Swarm overlay `dokploy-network` requested `10.0.1.12`, now held by the overlay's own `dokploy-network-endpoint` load balancer. The Compose files did not pin that IP. Docker did not retry the failed boot start despite the `unless-stopped` policy. Kong's absence broke the database-dependent `/api/health?scope=deploy` probe, so Swarm repeatedly replaced tasks for `bloxodes-web-ujegas`.

The operator repaired only Kong's overlay attachment, retaining its aliases, then started it:

```sh
docker network disconnect dokploy-network supabase-kong
docker network connect --alias supabase-kong --alias kong dokploy-network supabase-kong
docker start supabase-kong
```

Kong received `10.0.1.82` and became healthy. Docker then saved `10.0.1.82` as Kong's remembered `IPAMConfig` address, so the same clash can recur on a later boot. The web service recovered on its own. The unrelated `vault-k0kvgn-vaultwarden-1` Compose container also failed during boot with `attaching to network failed ... context deadline exceeded`; a plain `docker start` recovered it.

## Boot recovery

`scripts/ops/vps-boot-recovery.py` adds a bounded retry after boot. It runs as `codex-admin` through its own managed crontab block, using that account's Docker group access. It needs Python 3, the Docker CLI, the Compose plugin, and readable original Compose files. It uses the local `/var/run/docker.sock` explicitly and loads no Bloxodes credential files. No sudo or root systemd unit is needed.

The job waits up to 600 seconds for the daemon and active Swarm state, because cron starts `@reboot` jobs before Docker finishes starting containers, then scans every 20 seconds for up to 600 seconds. Each Docker command has a timeout of at most 30 seconds within the current deadline. It keeps scanning even after an empty pass, allowing Docker's initial restart attempts to finish. A lock prevents overlapping real runs and installation during a run. It never removes or recreates containers or volumes, applies Compose configuration, changes restart policies, or operates on Swarm services.

### Which containers should be running

A container is eligible only when all of these hold:

- Its restart policy is `unless-stopped` or `always`, and its state is `exited` or `created`.
- Docker records a nonempty `State.Error`, which is evidence of a failed start. A plain stopped container with no error is left alone.
- It was created at or before the host boot time from `/proc/stat`, and its `StartedAt` is at or before boot or is Docker's zero timestamp for a container that never started. `FinishedAt` may be after boot, because after an unclean shutdown dockerd stamps it while restoring containers. Invalid or missing timestamps are rejected.
- It has no `com.docker.swarm.*` label and no `com.bloxodes.boot-recovery.disabled=true` label.

Selection is rechecked immediately before actions. Containers started after boot are left alone, including a recovered container that later exits. This is a conservative heuristic: Docker inspect does not expose the daemon's internal manual-stop flag. A nonempty old start error cannot prove operator intent, and a failure with no recorded error is deliberately skipped. Do not run recovery concurrently with maintenance; add the opt-out label in a service's Compose definition when persistent exclusion is needed.

The job first tries `docker start`. Only an `Address already in use` network failure permits a network repair; host-port bind errors are excluded. It requires exactly one remembered `IPAMConfig.IPv4Address` across all the container's networks, on an attachable, non-ingress Swarm overlay. The original Compose files and service labels must resolve successfully through read-only `docker compose config --format json`, both with `--no-interpolate` and with interpolation. That exact service/network must have no IPv4 or IPv6 address key in either output, so an unset environment variable cannot hide a configured static address. Missing files, missing labels, unresolved network names, pinned IPs, multiple remembered endpoints, configured MAC addresses or interface names, links, driver options, gateway priorities or other IPAM settings stop automatic network repair. Resolved Compose output is kept in memory and never logged.

Before disconnecting, the job saves every existing alias in a private write-ahead journal under `boot-recovery-state/`. It does not start a disconnect with less than 90 seconds of the window left, and the reconnect gets its own 60-second budget, so a slow disconnect cannot leave the container off the network. It reconnects without an IP request, verifies aliases, and retries the start. If interrupted, a later pass or manual invocation resumes that attachment from the journal. A changed endpoint, network identity or container state requires operator review instead of another disconnect. Retain unresolved journals until the attachment and all aliases have been checked; do not delete them to silence a warning.

### Install and verify

Installation is pending until an operator reviews and installs this change. Stage these three reviewed files together in `/home/codex-admin/boot-recovery-review/` on the VPS: `vps-boot-recovery.py`, `vps-boot-recovery.crontab` and `install-vps-boot-recovery.sh`. As `codex-admin`, run:

```sh
/usr/bin/python3 --version
docker --host unix:///var/run/docker.sock version
docker --host unix:///var/run/docker.sock compose version
/usr/bin/python3 /home/codex-admin/boot-recovery-review/vps-boot-recovery.py --dry-run
sh /home/codex-admin/boot-recovery-review/install-vps-boot-recovery.sh --apply
crontab -l | sed -n '/^# BLOXODES_BOOT_RECOVERY_START$/,/^# BLOXODES_BOOT_RECOVERY_END$/p'
/usr/bin/python3 /home/codex-admin/bloxodes-supabase/bin/boot-recovery.py --dry-run
```

The installer preserves all unrelated crontab lines, rejects duplicate or malformed recovery blocks, saves the original crontab as a private `crontab-before-boot-recovery-<UTC>.txt` file, and verifies crontab readback. Repeating installation refreshes only its own files and block. It does not run recovery or modify containers. Keep the backup for review. No change to the stats-worker blocks is needed.

`--dry-run` performs one read-only scan, prints planned starts and any provable network repairs, and creates no log, lock or journal files. A real manual run uses the same boot-time rules at any uptime:

```sh
/usr/bin/python3 /home/codex-admin/bloxodes-supabase/bin/boot-recovery.py
tail -n 80 /home/codex-admin/bloxodes-supabase/logs/boot-recovery.log
docker --host unix:///var/run/docker.sock inspect --format '{{.Name}} {{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{end}}' supabase-kong
docker --host unix:///var/run/docker.sock inspect --format '{{json (index .NetworkSettings.Networks "dokploy-network").Aliases}}' supabase-kong
docker --host unix:///var/run/docker.sock service ps bloxodes-web-ujegas
curl --fail --silent --show-error 'https://bloxodes.com/api/health?scope=deploy'
```

Real runs log to `logs/boot-recovery.log`, rotating at 1 MiB with three backups. Cron discards duplicate console output. Exit status is 0 for a completed scan without unresolved failures or an already-active job, 1 for readiness timeout or unresolved recovery, and 2 for invalid arguments. A successful start request does not prove application health; verify Kong, the web service and the deploy-health endpoint separately after an actual reboot. The job does not fix host downtime, arbitrary IP conflicts or failures after its retry window. Do not reboot the VPS or stop a live container merely to test installation.

The fixture suite (`npm run test:vps-boot-recovery`) covers decisions, Compose pin checks, aliases, interrupted reconnects, read-only planning, timeout bounds and crontab preservation without contacting Docker. The PR workflow runs it on GitHub. This implementation has not been exercised against a live reboot.

## Operational Risks

- The unrelated Umami GitHub collector was already restarting before the October 17 account change and remained so afterward. Public web/database health and all other inspected long-running containers stayed healthy or running.
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

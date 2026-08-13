# Homelab

Status: Automation healthy; checkout synchronization prepared locally
Last verified: 2026-08-13
Evidence: read-only SSH, systemd state/unit files, repository state, env name contract, and journal

## Host

- Hostname: `teja-homelab`.
- OS: Linux Mint 22.3, kernel 6.14.0-37.
- CPU: 4 logical CPUs.
- Memory: 7.7 GiB; 2 GiB swap nearly full at check time.
- Root disk: 117 GB, 41% used.
- Repository: `/home/teja/projects/Bloxodes`, clean `production` at `ef536f62` during the read-only audit. This is behind the current production checkout and has not been synchronized.

## Services

- `bloxodes-article-discovery.timer`: enabled, active, runs at 00:00/06:00/12:00/18:00 local time with persistence.
- `bloxodes-article-discovery.service`: runs readiness, discovery, and Groq curation; last run succeeded.
- `bloxodes-article-writer.service`: triggered after successful discovery; the latest audited run succeeded and completed all 6 claimed items.

Runtime env is `/etc/bloxodes/article-automation.env`, root-owned, group `teja`, mode 640. It contains managed-dev Supabase, media, production inventory, Groq, model, and writer controls.

## Synchronization

- `scripts/ops/sync-homelab-checkout.sh --expected-sha <full-sha>` performs a read-only preflight by default. It requires the clean `production` branch, stopped services, an exact remote SHA, matching installed units, and readiness before an apply can succeed.
- Adding `--apply` fetches and fast-forwards to that exact approved SHA, conditionally runs `npm ci`, verifies unit files/readiness, and restores the timer's prior state. This is a remote synchronization mutation and requires explicit approval.
- `scripts/ops/install-homelab-article-automation.sh --apply <full-sha>` installs reviewed units only from an exact clean approved checkout and preserves the timer state.
- Neither synchronization command has been applied as part of the local preparation change.

## Safety Boundary

- Article queue writes target the managed-dev Supabase project.
- Production is read only through the public editorial inventory endpoint during automated discovery/writing.
- Human review/import is required before production publication.
- Homelab operator access belongs in `.envs/infrastructure/homelab.env`; writer runtime values belong in `.envs/pipelines/articles.env` and the host env file.
- Never copy the production Supabase target into the homelab writer env; queue and media staging remain managed development.

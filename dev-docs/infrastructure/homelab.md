# Homelab

Status: Discovery healthy; writer degraded
Last verified: 2026-08-13
Evidence: read-only SSH, systemd state/unit files, repository state, env name contract, and journal

## Host

- Hostname: `teja-homelab`.
- OS: Linux Mint 22.3, kernel 6.14.0-37.
- CPU: 4 logical CPUs.
- Memory: 7.7 GiB; 2 GiB swap nearly full at check time.
- Root disk: 117 GB, 41% used.
- Repository: `/home/teja/projects/Bloxodes`, `production` at `ef536f62`.

## Services

- `bloxodes-article-discovery.timer`: enabled, active, runs at 00:00/06:00/12:00/18:00 local time with persistence.
- `bloxodes-article-discovery.service`: runs readiness, discovery, and Groq curation; last run succeeded.
- `bloxodes-article-writer.service`: triggered after successful discovery; last run failed.

Runtime env is `/etc/bloxodes/article-automation.env`, root-owned, group `teja`, mode 640. It contains managed-dev Supabase, media, production inventory, Groq, model, and writer controls.

## Current Failure

The writer readiness check passed, but Grok Build returned HTTP 402 because usage balance was exhausted. This is an external account/billing blocker, not a missing env variable. Discovery/curation queued topics successfully.

## Safety Boundary

- Article queue writes target the managed-dev Supabase project.
- Production is read only through the public editorial inventory endpoint during automated discovery/writing.
- Human review/import is required before production publication.
- Homelab operator access belongs in `.envs/infrastructure/homelab.env`; writer runtime values belong in `.envs/pipelines/articles.env` and the host env file.

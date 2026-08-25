# Homelab

Status: Full-capability checkout healthy; Codex/Pi Luna Max article writer change pending runtime verification
Last verified: 2026-08-19
Evidence: guarded exact-SHA synchronization, repository cleanliness, complete private env layout, GitHub read/push checks, systemd timer/service state, managed-development readiness, and article automation readiness

## Host

- Hostname: `teja-homelab`.
- OS: Linux Mint 22.3, kernel 6.14.0-37.
- CPU: 4 logical CPUs.
- Memory: 7.7 GiB; 2 GiB swap nearly full at check time.
- Root disk: 117 GB, 41% used.
- Repository: `/home/teja/projects/Bloxodes`, clean `production` synchronized to the approved `origin/production` SHA on 2026-08-19.

## Services

- `bloxodes-article-discovery.timer`: enabled, active, runs at 00:00/06:00/12:00/18:00 local time with persistence.
- `bloxodes-article-discovery.service`: runs readiness, discovery, and Groq curation; last run succeeded.
- `bloxodes-article-writer.service`: triggered after successful discovery; readiness requires authenticated Codex and Pi CLIs, both pinned to GPT-5.6 Luna at max reasoning, then a tiny live Pi exact-response canary must pass before the queue batch starts. Codex owns research/images/review, while Pi owns prose.

Runtime env is `/etc/bloxodes/article-automation.env`, root-owned, group `teja`, mode 640. It contains managed-dev Supabase, media, production inventory, Groq curation, Codex/Pi model settings, and writer controls. Codex and Pi authentication belong to protected homes under the `teja` account and never to the env file.

Codex resolves from `/home/teja/.local/bin/codex`. Pi must be installed at `/home/teja/.local/bin/pi` with `scripts/ops/install-homelab-pi-writer.sh`; version 0.84.3 is pinned as the first verified release with the required `max` thinking flag. Pi authentication is created interactively as `teja` with `/login` → ChatGPT Plus/Pro and stored in `/home/teja/.pi/agent/auth.json`. Credentials are never copied between hosts.

The interactive homelab checkout also contains the complete ignored private `.envs/` profile tree: managed development and production targets, shared application values, content/distribution integrations, article/indexing pipelines, analytics/Umami operations, infrastructure operator profiles, and the Google indexing service-account file. All project-private files are mode 600 with mode-700 parent directories. The systemd writer remains constrained to managed-development queue/media credentials through `/etc/bloxodes/article-automation.env`.

## Synchronization

- Execute the released `scripts/ops/sync-homelab-checkout.sh --expected-sha <full-sha>` on the homelab through configured operator access. It performs a read-only preflight by default and requires the clean `production` branch, stopped services, and an exact remote SHA before apply.
- Adding `--apply` fetches and fast-forwards to that exact approved SHA, conditionally runs `npm ci`, verifies unit files/readiness, and restores the timer's prior state. An explicit e2e/end-to-end release authorizes this guarded checkout synchronization for every release, including releases that do not change homelab-owned files.
- `scripts/ops/install-homelab-article-automation.sh --apply <full-sha>` installs reviewed units only from an exact clean approved checkout and preserves the timer state.
- `scripts/ops/install-homelab-pi-writer.sh --apply <full-sha>` installs the pinned Pi package into `/home/teja/.local` from an exact clean approved checkout without touching credentials.
- The checkout synchronization command was applied and verified on 2026-08-19. The installer remains available for reviewed unit-file changes; do not run it when synchronization alone proves the installed units already match.

## Safety Boundary

- Article queue writes target the managed-dev Supabase project.
- Production is read only through the public editorial inventory endpoint during automated discovery/writing.
- Human review/import is required before production publication.
- The active article workflow never falls back to Grok or another model. A model/provider failure leaves the item retryable rather than weakening the model contract.
- Homelab operator access belongs in `.envs/infrastructure/homelab.env`; writer runtime values belong in `.envs/pipelines/articles.env` and the host env file.
- Never copy the production Supabase target into the homelab writer env; queue and media staging remain managed development.
- E2e checkout-sync authority does not include env changes, unit installation, stopping active discovery/writer jobs, service restarts, or unrelated host mutations. If the production delta changes installed units, a service is active, or preflight fails, leave the checkout unchanged and report synchronization pending.

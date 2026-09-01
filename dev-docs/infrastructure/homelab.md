# Homelab

Status: Article automation browser/retry fix verified; Codex-primary readiness verified
Last verified: 2026-09-01
Evidence: managed-dev readiness, real headless Chrome smoke and six-article rendered-browser pass, exact-ID production release with six live 200 responses, queue recovery, and the 18:00 timer schedule

## Host

- Hostname: `teja-homelab`.
- OS: Linux Mint 22.3, kernel 6.14.0-37.
- CPU: 4 logical CPUs.
- Memory: 7.7 GiB; 2 GiB swap nearly full at check time.
- Root disk: 117 GB, 41% used.
- Repository: `/home/teja/projects/Bloxodes`, `production` synchronized through the guarded exact-SHA release flow on 2026-09-01.

## Services

- `bloxodes-article-discovery.timer`: enabled, active, runs at 00:00/06:00/12:00/18:00 local time with persistence.
- `bloxodes-article-discovery.service`: runs readiness, discovery, and Groq curation; last run succeeded.
- `bloxodes-article-writer.service`: triggered after successful discovery; readiness confirms authenticated Codex CLI as the primary with GPT-5.6 Luna at xhigh reasoning, its provider fallback, and a real Playwright/Chrome smoke test. The batch uses deterministic headless browser QA rather than the optional desktop browser bridge and releases unfinished claims to retryable `blocked` rows on failure.

Runtime env is `/etc/bloxodes/article-automation.env`, root-owned, group `teja`, mode 640. It contains managed-dev Supabase, media, production inventory, Groq curation/fallback, Codex model/reasoning, and writer controls. Codex CLI authentication belongs to the `teja` account's protected Codex home and is checked without starting a paid model run.

The homelab currently has Codex CLI at `/home/teja/.local/bin/codex` and Grok at `/home/teja/.grok/bin/grok`. A read-only `gpt-5.6-luna` `xhigh` access canary succeeded on 2026-08-17. The writer resolves these user-local paths directly because systemd does not inherit the interactive shell's user-local PATH.

The interactive homelab checkout also contains the complete ignored private `.envs/` profile tree: managed development and production targets, shared application values, content/distribution integrations, article/indexing pipelines, analytics/Umami operations, infrastructure operator profiles, and the Google indexing service-account file. All project-private files are mode 600 with mode-700 parent directories. The systemd writer remains constrained to managed-development queue/media credentials through `/etc/bloxodes/article-automation.env`.

## Synchronization

- Execute the released `scripts/ops/sync-homelab-checkout.sh --expected-sha <full-sha>` on the homelab through configured operator access. It performs a read-only preflight by default and requires the clean `production` branch, stopped services, and an exact remote SHA before apply.
- Adding `--apply` fetches and fast-forwards to that exact approved SHA, conditionally runs `npm ci`, verifies unit files/readiness, and restores the timer's prior state. An explicit e2e/end-to-end release authorizes this guarded checkout synchronization when the release changes homelab-owned article automation or the user explicitly requests homelab synchronization; ordinary web, collection, and editorial database releases do not require it.
- `scripts/ops/install-homelab-article-automation.sh --apply <full-sha>` installs reviewed units only from an exact clean approved checkout and preserves the timer state.
- The checkout synchronization command was applied and verified on 2026-08-19. The installer remains available for reviewed unit-file changes; do not run it when synchronization alone proves the installed units already match.

## Safety Boundary

- Article queue writes target the managed-dev Supabase project.
- Production is read only through the public editorial inventory endpoint during automated discovery/writing.
- The scheduled batch may publish only the exact managed-dev queue rows it completed in that run, through the guarded production import/release verifier. Manual review remains available for completed rows and is still required for any outside the unattended allowlist.
- Codex and Grok receive the same scrubbed managed-development child environment. A Codex failure may start Grok only once and only for queue slots not already touched by the Codex run.
- The batch sets an explicit nested-run guard so a provider cannot invoke another outer batch or self-lock. Browser, provider, verifier, and release failures clear selected processing claims immediately and apply a 180-minute retry backoff.
- Homelab operator access belongs in `.envs/infrastructure/homelab.env`; writer runtime values belong in `.envs/pipelines/articles.env` and the host env file.
- Never copy the production Supabase target into the homelab writer env; queue and media staging remain managed development.
- E2e checkout-sync authority does not include env changes, unit installation, stopping active discovery/writer jobs, service restarts, or unrelated host mutations. If the production delta changes installed units, a service is active, or preflight fails, leave the checkout unchanged and report synchronization pending.

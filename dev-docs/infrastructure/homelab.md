# Homelab

Status: Article automation active; top-100 wiki automation restored for managed-development review
Last verified: 2026-09-04
Evidence: managed-dev readiness, real headless Chrome smoke and six-article rendered-browser pass, exact-ID production release with six live 200 responses, queue recovery, the 18:00 timer schedule, and Tailscale-reachable managed-development preview route checks

## Host

- Hostname: `teja-homelab`.
- OS: Linux Mint 22.3, kernel 6.14.0-37.
- CPU: 4 logical CPUs.
- Memory: 7.7 GiB; 2 GiB swap nearly full at check time.
- Root disk: 117 GB, 41% used.
- Primary development repository: `/home/teja/projects/Bloxodes`. The user works directly on `teja-homelab` as the ongoing primary project host, confirmed September 7, 2026. Task branches and unrelated in-progress work may remain in this checkout after a release; local `production` is tracked separately.

## Tailscale and managed-development preview

- Current Tailscale hostname: `teja-homelab.tail13b5bd.ts.net`.
- Current Tailscale IPv4 fallback: `100.86.117.125`.
- User-facing preview base: `http://teja-homelab.tail13b5bd.ts.net:3000`.
- Direct-IP fallback: `http://100.86.117.125:3000`.
- Append the route to either base, for example `/gta/wiki/gta-online`; do not hand off `localhost` or `127.0.0.1` when the reviewer is on another tailnet device. The route's public canonical URL remains `https://bloxodes.com/...`.

For a remotely reviewable managed-development preview, use the homelab wiki env without printing it and bind Next to the Tailscale-reachable interface:

```bash
cd /home/teja/projects/Bloxodes/apps/web
set -a
source /etc/bloxodes/wiki-automation.env
set +a
BLOXODES_ENV_PROFILE=managed-dev BLOXODES_ENV_OVERLAYS=cloudflare ../../node_modules/.bin/next dev --webpack --hostname 0.0.0.0 --port 3000
```

Use the webpack preview for very large GTA collection pages. If the development Turbopack cache panics while writing a large response, stop the preview, move only the generated `apps/web/.next/dev` directory to `/tmp`, and restart; never remove source, workspace, database, or media files. Verify reachability with a bounded `curl` through both the Tailscale hostname and IP before sharing links.

## Tailscale and managed-development preview

- Current Tailscale hostname: `teja-homelab.tail13b5bd.ts.net`.
- Current Tailscale IPv4 fallback: `100.86.117.125`.
- User-facing preview base: `http://teja-homelab.tail13b5bd.ts.net:3000`.
- Direct-IP fallback: `http://100.86.117.125:3000`.
- Append the route to either base, for example `/gta/wiki/gta-online`; do not hand off `localhost` or `127.0.0.1` when the reviewer is on another tailnet device. The route's public canonical URL remains `https://bloxodes.com/...`.

For a remotely reviewable managed-development preview, use the homelab wiki env without printing it and bind Next to the Tailscale-reachable interface:

```bash
cd /home/teja/projects/Bloxodes/apps/web
set -a
source /etc/bloxodes/wiki-automation.env
set +a
BLOXODES_ENV_PROFILE=managed-dev BLOXODES_ENV_OVERLAYS=cloudflare ../../node_modules/.bin/next dev --webpack --hostname 0.0.0.0 --port 3000
```

Use the webpack preview for very large GTA collection pages. If the development Turbopack cache panics while writing a large response, stop the preview, move only the generated `apps/web/.next/dev` directory to `/tmp`, and restart; never remove source, workspace, database, or media files. Verify reachability with a bounded `curl` through both the Tailscale hostname and IP before sharing links.

## Services

- `bloxodes-article-discovery.timer`: enabled, active, runs at 00:00/06:00/12:00/18:00 local time with persistence.
- `bloxodes-article-discovery.service`: runs readiness, discovery, and Groq curation; last run succeeded.
- `bloxodes-article-writer.service`: triggered after successful discovery; readiness confirms authenticated Codex CLI, disabled native multi-agent tools for code-controlled stages, the configured Luna model/effort (max on September 6), stage-only fallback capability, and a real Playwright/Chrome smoke test. Code owns queue claims, stage transitions and technical QA. Exhausted evidence/editorial reviews require attention; operational claim failures retain bounded recovery. See the article pipeline owner for current execution details.
- `bloxodes-wiki-builder.timer`: enabled, active, runs daily at 01:00 local time with a bounded randomized delay and persistence.
- `bloxodes-wiki-builder.service`: selects the highest-ranked eligible game from the exact production top 100, runs collection suggestions and approved collection workflows before the wiki hub, publishes database-only runtime manifests and media to managed development, and stops at `managed_dev_ready` for review. Readiness retries transient Supabase, R2, and public API failures three times.

Runtime env is `/etc/bloxodes/article-automation.env`, root-owned, group `teja`, mode 640. It contains managed-dev Supabase, media, production inventory, Groq curation/fallback, Codex model/reasoning, and writer controls. Codex CLI authentication belongs to the `teja` account's protected Codex home and is checked without starting a paid model run.

Wiki runtime env is `/etc/bloxodes/wiki-automation.env`, root-owned and readable only by the restricted `bloxodes-wiki-model` account plus the operator ACL. It contains managed-development Supabase and shared wiki R2 values; the scheduled unit never receives production credentials.

The homelab currently has Codex CLI at `/home/teja/.local/bin/codex` and Grok at `/home/teja/.grok/bin/grok`. A read-only `gpt-5.6-luna` `xhigh` access canary succeeded on 2026-08-17. The writer resolves these user-local paths directly because systemd does not inherit the interactive shell's user-local PATH.

The interactive homelab checkout also contains the complete ignored private `.envs/` profile tree: managed development and production targets, shared application values, content/distribution integrations, article/indexing pipelines, analytics/Umami operations, infrastructure operator profiles, and the Google indexing service-account file. All project-private files are mode 600 with mode-700 parent directories. The systemd writer remains constrained to managed-development queue/media credentials through `/etc/bloxodes/article-automation.env`.

## Synchronization

- When releasing from another machine and remote synchronization is in scope, execute the released `scripts/ops/sync-homelab-checkout.sh --expected-sha <full-sha>` on the homelab through configured operator access. It performs a read-only preflight by default and requires the clean `production` branch, stopped services, and an exact remote SHA before apply.
- Adding `--apply` fetches and fast-forwards to that exact approved SHA, conditionally runs `npm ci`, verifies unit files/readiness, and restores the timer's prior state. An explicit e2e/end-to-end release from another machine authorizes this guarded remote checkout synchronization when the release changes homelab-owned article automation or the user explicitly requests it; ordinary web, collection, and editorial database releases do not require it.
- Releases already running on this host skip separate checkout synchronization and SSH-to-self checks, including article automation releases. Preserve the primary task checkout, synchronize local `production` independently, and report homelab synchronization as unnecessary rather than pending. This does not deploy env or installed service changes.
- `scripts/ops/install-homelab-article-automation.sh --apply <full-sha>` installs reviewed units only from an exact clean approved checkout and preserves the timer state.
- `scripts/ops/install-homelab-wiki-automation.sh --apply <full-sha>` replaces the same-named legacy wiki units from an exact clean approved checkout and enables the reviewed daily timer.
- The checkout synchronization command was applied and verified on 2026-08-19. The installer remains available for reviewed unit-file changes; do not run it when synchronization alone proves the installed units already match.

## Safety Boundary

- Article queue writes target the managed-dev Supabase project.
- Wiki queue, hub, collection page, immutable dataset, and item writes target managed development; collection media uses the shared wiki R2 bucket.
- Production is read only through the public editorial inventory endpoint during automated discovery/writing.
- The scheduled batch may publish only the exact managed-dev queue rows it completed in that run, through the guarded production import/release verifier. Manual review remains available for completed rows and is still required for any outside the unattended allowlist.
- Model workers receive no database/queue/release credentials through their environment; deterministic stages receive managed-development credentials. Code may invoke one Grok fallback for the current stage after a classified Codex provider failure. It never hands the article lifecycle to a fallback model.
- The batch sets an explicit nested-run guard so a provider cannot invoke another outer batch or self-lock. Browser, provider, verifier, and release failures clear selected processing claims immediately and apply a 180-minute retry backoff.
- Article and wiki agents share `tmp/article-writer/writer.lock`. Cross-user permission errors count as a live process, so the restricted wiki account cannot delete an active article lock. The wiki runner waits rather than overlapping.
- Scheduled wiki runs process at most one top-100 game, require a verified hub plus at least one evidence-backed collection, and stop at managed-development review. Production publication remains explicit.
- Scheduled wiki jobs require a clean checkout at startup and after the model returns. Artifact directories remain ignored; source changes must be reviewed and committed before a scheduled run proceeds.
- Homelab operator access belongs in `.envs/infrastructure/homelab.env`; writer runtime values belong in `.envs/pipelines/articles.env` and the host env file.
- Never copy the production Supabase target into either scheduled homelab env; queue and media staging remain managed development.
- E2e checkout-sync authority does not include env changes, unit installation, stopping active discovery/writer jobs, service restarts, or unrelated host mutations. For an in-scope remote synchronization, installed-unit changes, active services, or a failed preflight leave that remote checkout unchanged with synchronization pending. A release already running on this primary workspace skips that synchronization entirely.

September 6 runtime verification: installed discovery/writer/timer files match scripts/ops/systemd exactly. The enabled timer retains 00:00/06:00/12:00/18:00 IST and the writer invokes the stable articles:writer:batch alias, which now uses the code-controlled pipeline in this checkout. Writer readiness passed with Luna max and a real Chrome smoke check. A second batch was refused by the shared lock without queue mutation or interference. A real exact-ID Grand Blue canary completed research, independent reviews, images, writing, managed-dev import/readback and browser QA in 28.1 minutes, with production release explicitly disabled. The earlier quota-blocked canary is historical, not the result of this completed run. The revised reader-first reviewer subsequently caught copy defects in both Fisch and Grand Blue; focused Luna repairs, re-review and final managed-dev/browser QA completed. The queue points to the repaired Grand Blue artifact. See dev-docs/pipelines/articles.md for timing and evidence. The writer unit still displays its historical failed-run flag: clearing it noninteractively required a root password, so no flag change was made; the enabled timer can still trigger its next run. Units, timer cadence and protected env values were not changed; no installation is required for this entrypoint replacement. This scoped verification does not refresh the historical production health evidence above.

## Article runtime reliability rollout (September 7, 2026)

Implementation now provides `articles:runtime:prepare -- --sha <commit>`: an independent detached release checkout with its own npm installation, persistent state under `/home/teja/.local/share/bloxodes-article-runtime/state`, and existing protected env profiles linked read-only by convention. The manual article/wiki lease remains shared through the primary checkout's ignored article-writer directory. Preparing runs full dependency/provider/browser/database readiness before recording the prepared SHA. `sudo scripts/ops/install-homelab-article-automation.sh --apply <commit>` activates that checked release and installs units using `.../article-runtime/current`; it pauses timer triggers while refusing active jobs, reconciles newer primary-checkout state on first activation, and restores the discovery timer state. Installation still requires host sudo; preparation alone does not switch installed services.

Discovery retains 00:00/06:00/12:00/18:00 local time. The prepared units add independent publication recovery every 15 minutes. Exact authorization, retry limits, identity preparation, image inspection and editorial correction behavior are owned by [the article pipeline documentation](../pipelines/articles.md).

`articles:automation:audit` records recent blocked/failed work, stale processing claims, and discovery triggers older than seven hours. Its separate audit service runs after the publication service even on release failure, keeping monitoring findings separate from publication outcome; actionable findings return nonzero to systemd and are recorded in journal and `tmp/article-publication/automation-health.json`. Publication attempts have separate `health.json` and per-ID receipts. These are host monitoring signals, not configured external email/Slack notifications.

Validation: host pipeline and release suites, failure-injection reliability tests, and image readiness tests passed. Repository-wide TypeScript checking still reports existing errors; changed files are checked separately. Service activation and live recovery results must be recorded separately after actual verification.

Verified recovery on September 7: the Sky Crystals, Elemental Class, and Bonsai Tree articles all passed exact production readback, public URL/title, and sitemap verification and their managed queue rows are published. The isolated outbox also exercised already-published acknowledgement without content re-import. Official identity preflight created and verified the missing managed-development records for universes 1235188606 and 10577588270. The audit finds the eight retained blockers and correctly recognizes the installed timer trigger. Versioned runtime readiness passed with Luna max, headless Chrome, managed development, and the guarded production target. Installed services still require the host sudo activation step; no external notification channel was installed.

A real Luna max canary also completed editorial review and all managed-development technical/browser checks from the isolated release. Its state is under `state/article-pipeline/runtime-reliability-canary`. This verifies runtime execution, not installation of the root-owned service units, which remains pending sudo.

### Activation verified September 7, 2026

Installed runtime SHA: `cfadab0db53575c235535234185cea5120b56e0a`. Discovery, writer, and publication units now use `/home/teja/.local/share/bloxodes-article-runtime/current`. Discovery and publication timers are enabled and active; discovery retains midnight/06:00/12:00/18:00 and publication runs every 15 minutes. Earlier pending-sudo notes are superseded by this activation. Local Git info/exclude includes `/tmp` because a persistent-state symlink is not matched by a directory-only ignore rule.

Authorized homelab sudo operations can use `HOMELAB_SUDO_PASSWORD` from ignored `.envs/infrastructure/homelab.env`. Read it without displaying its value and pass it only through sudo stdin; never put it in command arguments, logs, or committed files. Check this configured credential before asking the user to perform an authorized sudo operation manually.

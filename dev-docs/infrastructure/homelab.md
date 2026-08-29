# Homelab

Status: Article automation active; one-at-a-time two-hour wiki automation implemented and awaiting exact-SHA installation
Last verified: 2026-08-29
Evidence: managed-dev wiki queue migration and concurrency canary, Luna Max runner/readiness code, shared article/wiki lock, reviewed systemd timer, and guarded exact-game post-model publication path

## Host

- Hostname: `teja-homelab`.
- OS: Linux Mint 22.3, kernel 6.14.0-37.
- CPU: 4 logical CPUs.
- Memory: 7.7 GiB; 2 GiB swap nearly full at check time.
- Root disk: 117 GB, 41% used.
- Repository: `/home/teja/projects/Bloxodes`, clean `production` synchronized through the guarded exact-SHA path on 2026-08-26.

## Services

- `bloxodes-article-discovery.timer`: enabled, active, runs at 00:00/06:00/12:00/18:00 local time with persistence.
- `bloxodes-article-discovery.service`: runs readiness, discovery, and Groq curation. A 2026-08-25 scheduled run discovered two rows but Groq rejected its 8,017-token curation request against an 8,000-token cap. The released retry reduced `max_tokens` to 2,707, completed the same 12-candidate curation at 7,679 total tokens, and left the service ready for the next timer run.
- `bloxodes-article-writer.service`: triggered after successful discovery; readiness requires authenticated Codex and Pi CLIs, both pinned to GPT-5.6 Luna at max reasoning, then a tiny live Pi exact-response canary must pass before the queue batch starts. Codex owns research/images/review, while Pi owns prose. After the model process exits, the wrapper releases only the exact queue rows completed by that batch and treats any release failure as a failed service run.
- `bloxodes-wiki-builder.timer`: scheduled every two hours at odd hours (`01:00`, `03:00`, …, `23:00`) with persistence. Each tick starts at most one game; an active oneshot or the shared article/wiki agent lock skips overlap without killing the running job.
- `bloxodes-wiki-builder.service`: selects the highest-ranked current top-100 game without a production wiki or durable queue row, runs collection suggestions, approved collection workflows, and the wiki workflow with Codex Luna Max, then releases the exact verified hub and successful collection manifests after the model exits. Evidence-blocked games become terminal queue rows so they cannot starve later ranks.

Runtime env is `/etc/bloxodes/article-automation.env`, root-owned, group `teja`, mode 640. It contains managed-dev Supabase, media, production inventory, Groq curation, Codex/Pi model settings, and writer controls. Codex and Pi authentication belong to protected homes under the `teja` account and never to the env file.

Wiki runtime env is `/etc/bloxodes/wiki-automation.env`, also root-owned, group `teja`, mode 640. It contains managed-dev Supabase, the bucket-scoped shared `bloxodes-wiki` R2 credential, fixed Luna Max settings, and the production target-file path. The model child receives managed-dev and R2 values only; the outer parent parses the production target after the model exits.

Codex resolves from `/home/teja/.local/bin/codex`. Pi is installed at `/home/teja/.local/bin/pi` with `scripts/ops/install-homelab-pi-writer.sh`; version 0.84.3 is pinned as the first verified release with the required `max` thinking flag. Pi authentication is created interactively as `teja` with `/login` → ChatGPT Plus/Pro and stored in `/home/teja/.pi/agent/auth.json`. Credentials are never copied between hosts. The authenticated Pi Luna Max exact-response canary passed on 2026-08-25.

The interactive homelab checkout also contains the complete ignored private `.envs/` profile tree: managed development and production targets, shared application values, content/distribution integrations, article/indexing pipelines, analytics/Umami operations, infrastructure operator profiles, and the Google indexing service-account file. All project-private files are mode 600 with mode-700 parent directories. The systemd env and every Codex/Pi child environment remain constrained to managed-development queue/media credentials. The post-model parent alone parses `.envs/targets/production.env` for the exact-ID release.

## Synchronization

- Execute the released `scripts/ops/sync-homelab-checkout.sh --expected-sha <full-sha>` on the homelab through configured operator access. It performs a read-only preflight by default and requires the clean `production` branch, stopped services, and an exact remote SHA before apply.
- Adding `--apply` fetches and fast-forwards to that exact approved SHA, conditionally runs `npm ci`, verifies unit files/readiness, and restores the timer's prior state. An explicit e2e/end-to-end release authorizes this guarded checkout synchronization for every release, including releases that do not change homelab-owned files.
- `scripts/ops/install-homelab-article-automation.sh --apply <full-sha>` installs reviewed units only from an exact clean approved checkout and preserves the timer state.
- `scripts/ops/install-homelab-wiki-automation.sh --apply <full-sha>` installs and enables the reviewed two-hour wiki units from an exact clean approved checkout. Start the first service explicitly after readiness rather than waiting for the first odd-hour tick.
- `scripts/ops/install-homelab-pi-writer.sh --apply <full-sha>` installs the pinned Pi package into `/home/teja/.local` from an exact clean approved checkout without touching credentials.
- The checkout synchronization command was applied and full readiness passed after automation commit `05b52b9e954abe6e02f7eb8137ca64fb329e82b7` on 2026-08-26. The timer state was not changed, and the installed discovery/writer units matched the approved checkout. The installer remains available for reviewed unit-file changes; do not run it when synchronization alone proves the installed units already match.

## Live Article Canary

The managed-development canary `grow-a-chicken-fighter-hot-egg-event-guide` completed on 2026-08-25. Codex Luna Max performed research, image collection, parent review, verification, and Chrome/Playwright preview. Pi `openai-codex/gpt-5.6-luna` at `max` wrote `final.json`. Both planned images were verified, uploaded, inserted, and rendered; the YouTube embed rendered as a real player; the queue row moved to `completed`. Production publication was intentionally not part of the canary.

## Safety Boundary

- Article queue writes target the managed-dev Supabase project.
- Wiki queue and all agent-stage content writes target managed development. Collection media uploads use only the shared, bucket-scoped R2 credential.
- Production is read only through the public editorial inventory endpoint during automated discovery/writing. Production credentials are never injected into the Codex or Pi process environment.
- After the model process exits, the guarded release parent may write only the exact queue IDs completed by that batch. It promotes verified media, imports the row, syncs provenance, and requires strict database and live-page checks before marking it published.
- The wiki release parent promotes only the claimed queue game's exact wiki final and runtime manifests, rechecks production identity, verifies existing R2 objects, publishes database pointers, and polls every live hub/collection URL before marking the queue row published.
- The active article workflow never falls back to Grok or another model. A model/provider failure leaves the item retryable rather than weakening the model contract.
- Homelab operator access belongs in `.envs/infrastructure/homelab.env`; writer runtime values belong in `.envs/pipelines/articles.env` and the host env file.
- Never copy the production Supabase target into the homelab systemd writer env; queue and media staging remain managed development. The release parent reads the ignored target file directly and sanitizes child environments.
- E2e checkout-sync authority does not include env changes, unit installation, stopping active discovery/writer jobs, service restarts, or unrelated host mutations. If the production delta changes installed units, a service is active, or preflight fails, leave the checkout unchanged and report synchronization pending.

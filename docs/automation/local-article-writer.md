# Homelab Article Automation

Article discovery, Groq curation, the writing queue, draft articles, and draft media all live in one managed development Supabase project. The homelab never receives a production Supabase service-role credential.

Production overlap checks use the public, GET-only endpoint at `/api/articles/editorial-inventory`. It returns only published page family, title, key, and optional universe ID. It cannot mutate production.

## Credentials

The homelab systemd services load `/etc/bloxodes/article-automation.env`. Start from `docs/automation/homelab-article-automation.env.example` and keep it owned by `root:teja` with mode `0640`. This lets the sole trusted worker user run the same queue commands interactively without copying the managed-dev service-role key into the repository.

Required environment:

- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE` for the managed development project. The `ARTICLE_DEV_*` aliases remain available when the article worker needs a dedicated override.
- `SUPABASE_MEDIA_BUCKET` and `SUPABASE_MEDIA_PUBLIC_URL` for draft article images.
- `GROQ_API_KEY` for discovery curation.
- Grok CLI authentication under the `teja` account.

The writer pins `grok-4.5` by default and passes Grok's `--always-approve` flag on
every invocation. This keeps unattended systemd runs non-interactive even if the
account-level Grok configuration changes. Override only the model with
`ARTICLE_WRITER_GROK_MODEL` or `--grok-model` when intentionally testing another
model; automatic approval is not optional for this scheduled worker.

Never add production `SUPABASE_SERVICE_ROLE` to this file. The scripts accept only localhost compatibility or an HTTPS `*.supabase.co` managed-dev project and explicitly reject the known Bloxodes production hosts.

## Data Boundary

- Discovery inserts only into managed-dev `article_discovery_candidates`.
- Curation reads live published production coverage through the read-only inventory endpoint and writes decisions/queue rows only to managed dev.
- After successful discovery and curation, one Grok parent run asks the article workflow runner to process at most six managed-dev `article_generation_queue` rows with its required research and writing subagents.
- Grok receives normal `SUPABASE_*` variables mapped to the managed-dev project only.
- Finished `final.json`, draft article rows, and draft Storage objects remain in managed dev until manual promotion.
- Manual promotion is the only workflow allowed to receive both dev and production credentials.

## Readiness

The readiness command is read-only:

```bash
npm run articles:homelab:check
npm run articles:homelab:check -- --component discovery
npm run articles:homelab:check -- --component writer
```

It checks the required managed-dev tables, production inventory endpoint, Groq key, Grok CLI, and Chrome/Chromium.

## Manual Commands

Discovery and curation:

```bash
npm run articles:discover -- --apply
npm run articles:curate -- --apply
```

Inspect production overlap without production credentials:

```bash
npm run articles:inventory:production -- --search "game topic"
npm run articles:inventory:production -- --family article --universe-id 123456 --json
```

Inspect or write one managed-dev queue item:

```bash
npm run articles:queue:list -- --status pending
npm run articles:writer:homelab
npm run articles:writer:homelab -- --apply
```

The writer is dry-run by default. Only one writer can run in the worktree; lock files and structured Grok outputs remain under `tmp/article-writer/`.

Preview or manually start the same capped batch used by systemd:

```bash
npm run articles:writer:batch
npm run articles:writer:batch -- --apply --limit 6
```

The batch checks the curated queue before invoking Grok, exits without model use
when it is empty, and refuses limits above six.

On the homelab, article queue commands automatically use the readable
`/etc/bloxodes/article-automation.env` file when no explicit article-dev
credentials or `ARTICLE_DEV_ENV_FILE` are present. Do not source or print this
file in Grok prompts or logs.

## Homelab systemd

The checked-in units live under `scripts/ops/systemd/` and expect:

- repository: `/srv/data/bloxodes-article-worker/current`
- Linux user/group: `teja`
- environment: `/etc/bloxodes/article-automation.env`

From the expected worker checkout, install the three unit files and placeholder environment in an intentionally inactive state:

```bash
sudo bash scripts/ops/install-homelab-article-automation.sh
```

Replace the placeholders in `/etc/bloxodes/article-automation.env`, authenticate Grok as `teja`, and leave the timer disabled until readiness passes. Once credentials and Grok authentication exist:

```bash
sudo systemctl start bloxodes-article-discovery.service
sudo systemctl enable --now bloxodes-article-discovery.timer
```

Discovery starts at 00:00, 06:00, 12:00, and 18:00 IST with no randomized delay. A successful discovery-and-curation service immediately starts the Grok batch writer. One Grok parent handles at most six queued articles with subagents; an empty queue skips Grok. The writer has reduced CPU/IO priority, a 5 GiB memory high-water mark, a 6 GiB hard memory limit, and no separate timer.

## Manual Publication

Review the localhost article, `brief.md`, `final.json`, sources, draft images, and managed-dev `articles` row. Promotion must copy approved Storage objects to production and rewrite their public URLs before importing the production article row.

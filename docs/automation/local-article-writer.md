# Local Grok Article Writer

The production database owns only article discovery and queue state. Finished article content remains in local Supabase until it is manually reviewed and promoted.

## Data Boundary

- `ARTICLE_QUEUE_ENV_FILE` points to an env file containing the production `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE` used by the wrapper.
- Normal `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE` must resolve to local Supabase through `.env.local`.
- The wrapper removes `ARTICLE_QUEUE_*` and the production env-file path before starting Grok. It also sets `ARTICLE_WRITER_LOCAL_ONLY=true`, which makes repository scripts load only `.env.local`-style files and skip the base production `.env`.
- Grok can research, edit the persistent worktree, run the local app, and import to local Supabase. Production queue credentials are not passed through its environment or loaded by repository scripts.
- The wrapper changes the production queue row to `completed` only after `final.json` exists and the matching slug is present in the local `articles` table.

The root `.env` currently represents production and `.env.local` represents local development, so local commands can use:

```bash
ARTICLE_QUEUE_ENV_FILE=.env npm run articles:writer:local
```

The command is a dry run by default. It prints the next eligible topic without claiming it or starting Grok.

## Run One Article

Confirm local Supabase is running, then execute:

```bash
ARTICLE_QUEUE_ENV_FILE=.env npm run articles:writer:local -- --apply
```

Useful targeted and safety options:

```bash
ARTICLE_QUEUE_ENV_FILE=.env npm run articles:writer:local -- --queue-id <uuid>
ARTICLE_QUEUE_ENV_FILE=.env npm run articles:writer:local -- --max-attempts 3 --timeout-minutes 120
```

Only one writer can run in a worktree. Its lock and logs live under `tmp/article-writer/`. A failed or blocked run returns the queue item to `pending` with exponential backoff until it reaches the attempt limit. Stale local claims are recovered by the next scheduled run.

## Install the macOS Schedule

Validate the launchd configuration without changing the machine:

```bash
npm run articles:writer:launchd -- --queue-env-file .env
```

Activate ten local checks per day:

```bash
npm run articles:writer:launchd -- --queue-env-file .env --install
```

The checks run at `00:30`, `03:00`, `05:30`, `08:00`, `10:30`, `13:00`, `15:30`, `18:00`, `20:30`, and `23:00` in the Mac's local timezone. Output goes to:

```text
tmp/article-writer/launchd.stdout.log
tmp/article-writer/launchd.stderr.log
```

Disable and remove the job with:

```bash
npm run articles:writer:launchd -- --uninstall
```

Install only after the article discovery/curation migration is deployed to production. The VPS discovery and Groq curation job runs three times daily at `00:22`, `08:22`, and `16:22` in the VPS cron timezone.

## Manual Publication

The local writer does not publish. Review the localhost article, `brief.md`, `final.json`, sources, images, and local `articles` row. Promote approved content through the normal controlled production import/release flow.

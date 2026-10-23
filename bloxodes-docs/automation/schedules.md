# Schedules

Last verified: 2026-10-21

Every recurring job, by where it runs. If you add, move or remove a schedule, update this file in the same change.

Time zones: homelab timers and T3 schedules use IST. VPS cron, Northflank and GitHub cron use UTC.

## T3 schedules (MacBook Pro)

Both run in the "Bloxodes Content Factory" project's root checkout on the MacBook Pro, with Codex `gpt-6.1-sol` high, full access, as the main agent. Both have standing permission to publish with `content:publish` and to commit and push the factory repo. Neither opens code PRs.

| Schedule | Time | Does |
| --- | --- | --- |
| Bloxodes nightly other games (Content Factory) | 02:00 IST | `franchise-wiki-main`: takes the lowest-Priority `Ready` row from the [Other Games Queue](notion-queues.md) and publishes its wiki hubs and collections. |
| Bloxodes nightly Roblox wiki (Content Factory) | 02:30 IST | `roblox-wiki-main`: claims the top-ranked uncovered Roblox game in the [Roblox Wiki Queue](notion-queues.md) and publishes its hub and collections. |

The prompts live in the T3 scheduler, not the repo. Keep them short: the selection rule, the skill and the publishing go-ahead. A T3 schedule copies its model, effort and runtime from the thread that creates it and can't change them later, so create these from a Codex `gpt-6.1-sol`, High, Full access thread. In a sandbox `content:publish` can't reach the database.

## Homelab (systemd)

Article units run from `/srv/data/bloxodes-automation-runtime/current` and read `/etc/bloxodes/article-automation.env`.

| Unit | When | Does |
| --- | --- | --- |
| `bloxodes-article-discovery.timer` | 00:00, 06:00, 12:00, 18:00 IST | `articles:discover`, then `articles:curate`. On success starts the writer. |
| `bloxodes-article-writer.service` | after discovery | `articles:writer:batch -- --apply --limit 6`, auto-publish on. |
| `bloxodes-article-publication.timer` | every 15 minutes | `articles:publication:drain -- --apply`. Then runs the audit. |
| `bloxodes-article-audit.service` | after publication | `articles:automation:audit`. |

The runtime is a separate release from the repo. Merging code doesn't change it. See [articles](../content/articles.md#runtime-releases).

`bloxodes-stats-chart-refresh.timer` is a separate **user** timer for `teja`. It starts at second 20 every five minutes, with persistent catch-up and no jitter. Its oneshot service runs the pinned package under `/srv/data/bloxodes-stats-chart-runtime/current`; it reads only the existing production HTTP database credentials. It does not use article runtime state or env. GitHub packages and authorizes each release; installation does not follow moving branch HEAD. See [release](../operations/release.md#prepared-chart-runtime).

The chart job checks for work, advances bounded preparation and records outcomes. A timer firing is not proof of a completed generation. Local locking, database coordination and deadlines prevent overlapping chart runs. Inspect runtime receipts and SQL health during bootstrap; the private web heartbeat monitor ships with the separate public-reader cutover. New deterministic chart processing runs on homelab. Existing VPS, Northflank and T3 schedules below are legacy owners, not permission to create more schedules there.

## VPS (cron, user `ravitejaknts`)

Jobs run in short-lived `bloxodes-stats-worker:production` containers through `bin/run-job.sh`, which handles locks, timeouts and logs. The checked-in copies are `scripts/ops/vps-universe-stats.crontab` and `scripts/ops/vps-scheduled-automation.crontab`.

| Group | Schedule (UTC) |
| --- | --- |
| Revalidation and cache warming | every minute |
| Worker image rebuild from the approved SHA | 00:05 daily |
| Universe NEW | :07 every 2 hours |
| Universe priority discovery | :22 hourly |
| Universe WARM | :32 every 6 hours |
| Universe COLD, then current index | :47 hourly |
| Hourly playing ranks | :30 hourly |
| Universe strict audit | :10 every 6 hours |
| Daily rollup, prune, audit | 00:02 |
| Worker ledger reconcile | 00:10 |
| Platform aggregates | 01:05 |
| Wiki game passes (`refresh:wiki-game-passes`; lock `roblox-universe-discovery`, 300 s lock wait, 600 s timeout) | 03:18 |
| Codes refresh | 00:00, 06:00, 12:00, 18:00 |
| Roblox virtual events collect | 00:15 |
| Puzzles | 04:10, 04:45, 05:00, 05:30, 07:10, 08:10, sweep 08:30, audit 08:45 |
| Music IDs | 06:20 |
| Decal IDs | 06:55 |
| Free item candidates, then verification | 07:00, 07:30 |
| Catalog item discovery | 03:05, 09:05, 15:05, 21:05 |
| Catalog item enrichment | :42 in hours 02–05, 08–11, 14–17, 20–22 |
| Item stats | tier 01:05; NEW :55 most hours; HOT :32; WARM 01:32/07:32/13:32/19:32; COLD 23:32; resale :17 every 3 hours |
| Item index, rollup, audit | index :45 hourly; rollup 01:25; audit :55 every 6 hours |
| Promo rewards | Wednesday 09:40 |
| Boot recovery | `@reboot` |

The same crontab also has two non-Bloxodes entries (Basebuddy demo reset, a GitHub analytics collector). Leave them alone.

## Northflank

| Job | Schedule (UTC) | Does |
| --- | --- | --- |
| `stats-hot-hourly` | :12 hourly | Universe HOT refresh. |

It's the only Northflank job. The env files keep tokens for accounts 1 to 5.

## GitHub Actions

Scheduled:

| Workflow | Schedule (UTC) | Does |
| --- | --- | --- |
| `discover-beebom-codes.yml` | :17 every 6 hours | Finds new codes pages from Beebom. |
| `generate-queue.yml` (Draft Code Page Generation) | 10 times a day | Writes and publishes draft codes pages. |
| `stats-health-monitor.yml` | every 5 minutes (GitHub runs it far less often) | Health check with Telegram alerts. |

Event-driven: `pull-request.yml`, `codex-review.yml`, `dokploy-production-deploy.yml`, `schema-release.yml` (called by the others), `managed-content-qa.yml`, `publish-content.yml`. See [release](../operations/release.md).

Manual only: `automation-runtime.yml` (packages the article runtime), `stats-chart-runtime.yml` (releases the dedicated prepared-chart runtime), `manual-web-audit.yml` and `google-indexing.yml` (Google Indexing is switched off).

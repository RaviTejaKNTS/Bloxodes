# Schedules

Last verified: 2026-10-30

Every recurring job, by where it runs. If you add, move or remove a schedule, update this file in the same change.

Time zones: homelab timers and T3 schedules use IST. VPS cron, Northflank and GitHub cron use UTC.

## T3 schedules (MacBook Pro)

All run in the "Bloxodes Content Factory" project's root checkout on the MacBook Pro. The article and Roblox wiki runs use Codex `gpt-6.1-sol` high, full access; the other games run uses Claude Opus 5.5. They have standing permission to publish (wikis with `content:publish`, articles through the publication drain) and to commit and push the factory repo. None opens code PRs.


| Schedule | Time | Does |
| --- | --- | --- |
| Bloxodes daily other games (Content Factory) | 02:00 IST daily | `franchise-wiki-main`: takes the lowest-Priority `Ready` row from the [Other Games Queue](notion-queues.md) and builds and publishes its wiki hubs and collections. One game per run. |
| Bloxodes Roblox wiki every 3 days (Content Factory) | Every 3 days | `roblox-wiki-main`: claims the top-ranked uncovered Roblox game in the [Roblox Wiki Queue](notion-queues.md) and builds and publishes its hub and collections. |
| Bloxodes articles every 6 hours (Content Factory) | Every 6 hours, about 00:00, 06:00, 12:00, 18:00 IST | `article-main`: takes 3 curated topics from `article_generation_queue` (or finds its own when fewer than 3 are good), has Luna research them and Haiku write them, and publishes them through the factory's `bin/article publish` (the publication drain on the MacBook Pro's Bloxodes checkout). |

The prompts live in the T3 scheduler, not the repo. Keep them short: the selection rule, the skill and the publishing go-ahead. A T3 schedule copies its model, effort and runtime from the thread that creates it and can't change them later, so create these from a Codex `gpt-6.1-sol`, High, Full access thread. In a sandbox `content:publish` can't reach the database.

## Homelab (systemd)

All units run from `/srv/data/bloxodes-automation-runtime/current`. Article discovery reads `/etc/bloxodes/article-automation.env`.

| Unit | When | Does |
| --- | --- | --- |
| `bloxodes-article-discovery.timer` | 00:00, 06:00, 12:00, 18:00 IST | `articles:discover`, then `articles:curate`. Fills the queue the Content Factory article run writes from. Starts nothing else. |
| `bloxodes-site-health.timer` | every 5 minutes | `node scripts/ops/site-health-monitor.mjs`: opens a `[site-health]` GitHub issue after two failed `/api/health` checks and closes it on recovery. Needs no env file; uses the `teja` `gh` login. The installer installs it but, like any new timer, it must be enabled once with `sudo systemctl enable --now bloxodes-site-health.timer`. |

Article writing and publication run in the Content Factory. The homelab writer, publication and audit units were removed on 2026-10-30; the installer removes them if it finds them, and restores the old units if activation fails.

The runtime is a separate release from the repo. Merging code doesn't change it. See [articles](../content/articles.md#runtime-releases).

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
| Platform hourly summary (3-hour window) | every 5 minutes |
| Platform daily summary | 01:05 |
| Game passes for wiki hubs and the top 100 HOT games (`refresh:wiki-game-passes -- --include-hot`; lock `roblox-universe-discovery`, 300 s lock wait, 600 s timeout) | 03:18 |
| Badges for wiki hubs and the top 100 HOT games (`refresh:stats-badges`; same lock, wait and timeout) | 03:38 |
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

Event-driven: `pull-request.yml`, `codex-review.yml`, `dokploy-production-deploy.yml`, `schema-release.yml` (called by the others), `managed-content-qa.yml`, `publish-content.yml`. See [release](../operations/release.md).

Manual only: `automation-runtime.yml` (packages the homelab runtime), `manual-web-audit.yml` and `google-indexing.yml` (Google Indexing is switched off).

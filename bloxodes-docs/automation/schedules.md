# Schedules

Last verified: 2026-10-24

Every recurring job, by where it runs. If you add, move or remove a schedule, update this file in the same change.

Time zones: homelab timers and T3 schedules use IST. VPS cron, Northflank and GitHub cron use UTC.

## T3 schedules (MacBook Pro)

All run in the "Bloxodes Content Factory" project's root checkout on the MacBook Pro, with Codex `gpt-6.1-sol` high as the main agent. They have standing permission to commit and push the factory repo. None opens code PRs.

The two wiki schedules run in **dev-only mode** while the owner is away: pages go to managed development only and queue rows close as `In dev`. Articles still publish to production. When the owner asks, the `In dev` games move to production in one release (factory `docs/publishing.md`, "Moving In dev games to production") and the prompts drop dev-only mode.

| Schedule | Time | Does |
| --- | --- | --- |
| Bloxodes other games loop (Content Factory) | every hour, and each run starts the next | `franchise-wiki-main` in dev-only and loop mode: builds the lowest-Priority `Ready` row from the [Other Games Queue](notion-queues.md). The factory's `bin/games-loop` keeps it to one run at a time and starts the next run only while `Ready` rows remain. A tick that finds a run active or nothing `Ready` ends at once. |
| Bloxodes nightly Roblox wiki (Content Factory) | 02:30 IST | `roblox-wiki-main` in dev-only mode: claims the top-ranked uncovered Roblox game in the [Roblox Wiki Queue](notion-queues.md) and builds its hub and collections. |
| Bloxodes articles every 6 hours (Content Factory) | every 6 hours | `article-main`: takes 3 curated topics from `article_generation_queue`, has Luna research them and Haiku write them, and publishes them through the factory's `bin/article publish` (the publication drain on the MacBook Pro's Bloxodes checkout). |

The loop's details (lock, stop switch, run hand-off) are in the factory's `docs/environment.md`, "Other Games loop". To stop it, run `bin/games-loop stop` in the factory checkout or turn the schedule off in T3.

The prompts live in the T3 scheduler, not the repo. Keep them short: the selection rule, the skill and the publishing go-ahead. A T3 schedule copies its model, effort and runtime from the thread that creates it and can't change them later, so create these from a Codex `gpt-6.1-sol`, High, Full access thread. In a sandbox `content:publish` can't reach the database.

## Homelab (systemd)

All units run from `/srv/data/bloxodes-automation-runtime/current` and read `/etc/bloxodes/article-automation.env`.

| Unit | When | Does |
| --- | --- | --- |
| `bloxodes-article-discovery.timer` | 00:00, 06:00, 12:00, 18:00 IST | `articles:discover`, then `articles:curate`. Fills the queue the T3 article run writes from. |
| `bloxodes-article-writer.service` | paused | `articles:writer:batch -- --apply --limit 6`. Writing moved to the T3 article run. Discovery still triggers it, but the drop-in `/etc/systemd/system/bloxodes-article-writer.service.d/paused.conf` (`ConditionPathExists=/etc/bloxodes/article-writer.enabled`) skips it cleanly. `sudo touch /etc/bloxodes/article-writer.enabled` brings it back. |
| `bloxodes-article-publication.timer` | every 15 minutes | `articles:publication:drain -- --apply` for articles the homelab wrote. Then runs the audit. |
| `bloxodes-article-audit.service` | after publication | `articles:automation:audit`. |

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

Manual only: `automation-runtime.yml` (packages the homelab runtime), `manual-web-audit.yml` and `google-indexing.yml` (Google Indexing is switched off).

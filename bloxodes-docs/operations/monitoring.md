# Monitoring

Last verified: 2026-10-19

## Automation Monitor

`https://monitor.ravitejaknts.com` (tailnet only, signed in) shows every automation for Bloxodes and Stack127 in one place: what each job does, when it runs, its last result, 90 days of run history and its log. It also shows the five machines, the production databases and the websites. It's read-only. Its code lives on the homelab at `/srv/data/projects/automation-dashboard`.

Its names and descriptions for Bloxodes come from [`automation/monitoring.json`](../automation/monitoring.json), read from the homelab main checkout. **Any change that adds, moves, renames or removes a scheduled job, workflow or service also updates that file.** One entry per job:

```json
{"key": "bloxodes-vps/stats-items-hot", "group": "Item stats", "name": "Hot item stats",
 "about": "Refreshes prices and sales for the most-viewed catalog items most hours of the day.",
 "impact": "Popular item pages show old prices.", "records": ["stats_items_refresh_hot"]}
```

- `key`: `bloxodes-vps/<run-job.sh name>`, `homelab/<systemd unit without .timer or .service>`, `macbook-pro/<T3 schedule title>`, `github/RaviTejaKNTS/Bloxodes/<workflow file>` or `northflank/<job>`.
- `name` and `about`: plain words for the owner. Say what it does, not how.
- `records`: the `stats_job_runs.job_name` values the job writes. The dashboard uses those rows for status, so skipped and partial runs show correctly.
- A job without an entry still appears, marked "No description yet". Job names in `stats_job_runs` that no entry claims are listed on the dashboard's Machines page.

## Health endpoints

| Endpoint | Checks |
| --- | --- |
| `/api/health?scope=deploy` | Live build SHA and database. Used by the Docker health check and deploys. Light and fast. |
| `/api/health` | Full operational health, including stats freshness (for example WARM refresh outcomes and overdue ratios). Can be unhealthy while the site is fine. |

## Alerts

- `stats-health-monitor.yml` checks operational health and sends Telegram alerts when the state changes. It's set to every 5 minutes, but GitHub runs it every couple of hours.
- The homelab article audit service reports blocked article jobs.

## Where to look

| Question | Look at |
| --- | --- |
| Did a VPS job really work? | `stats_job_runs` in production. Wrapper state files under the worker's `state/` can say "success" for a skipped job. |
| Is the cache draining? | `revalidation_events`, `cache_warm_events` and their `*_worker_runs` tables. |
| Did an article publish? | The homelab `tmp/article-publication/health.json` and the queue row in managed development. |
| What's deployed? | `/api/health?scope=deploy`, or the Dokploy service image. |
| Is a nightly T3 run done? | The T3 scheduler and the Notion queue row's status and Run report. |

## Known issues (2026-10-19)

Keep this list current: add failures when you find them, remove them when fixed.

- **New codes pages:** OpenAI credits exhausted, so no new pages since 2026-10-07. The workflow still shows green. See [codes](../content/codes.md#known-issues).
- **Events:** the job runs though it's meant to be disabled, then fails on a missing `TAVILY_API_KEY`.
- **Music IDs:** Roblox Creator Store returns HTTP 500.
- **Universe stats:** the daily rollup and platform refresh time out.
- **Item stats:** WARM fails on a duplicate canonical key; NEW, HOT and COLD were skipped; the audit is partial.
- **Health monitor:** runs far less often than configured.
- **Platform totals:** `stats-platform-refresh` exits 1 after printing only `[object Object]`, so its log doesn't say what failed.
- **Paid Codex PR review:** the `OPENAI_API_KEY` is out of quota, so `codex-review.yml` fails. Its `scope` job also fails on very large PRs when GitHub's file list doesn't match `changed_files`. Neither blocks merging.

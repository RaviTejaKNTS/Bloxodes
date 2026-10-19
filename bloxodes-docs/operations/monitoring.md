# Monitoring

Last verified: 2026-10-19

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

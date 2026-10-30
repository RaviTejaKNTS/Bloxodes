# Monitoring

Last verified: 2026-10-19

## Health endpoints

| Endpoint | Checks |
| --- | --- |
| `/api/health?scope=deploy` | Live build SHA and database. Used by the Docker health check and deploys. Light and fast. |
| `/api/health` | Full operational health, including stats freshness (for example WARM refresh outcomes and overdue ratios). Can be unhealthy while the site is fine. `warm_refresh_outcome_6h` looks back 7 hours, because WARM runs every 6 hours and can wait 30 minutes for its lock; COLD looks back 6 hours. |

## Alerts

Automation reports problems as GitHub issues labeled `incident`, not Telegram. Telegram reporting is retired.

- `bloxodes-site-health.timer` on the homelab checks `/api/health` every 5 minutes. After two failed checks in a row it opens one `[site-health]` issue (later failures don't add comments), and it closes that issue with a "Recovered" comment on the next healthy check.
- Jobs report through `scripts/ops/github-incident.mjs`: `openIncident({ key, title, body })` opens or comments on the one open `[key]` issue, and `resolveIncident({ key, body })` closes it. It uses the homelab `gh` login (user `teja`), so no token is stored. Hosts without that login need a GitHub token with issue write access before they can report.
- The homelab article audit service reports blocked article jobs.

## Where to look

| Question | Look at |
| --- | --- |
| Did a VPS job really work? | `stats_job_runs` in production. Wrapper state files under the worker's `state/` can say "success" for a skipped job. |
| Is the cache draining? | `revalidation_events`, `cache_warm_events` and their `*_worker_runs` tables. |
| Did an article publish? | The MacBook Pro checkout's `tmp/article-publication/health.json` and the queue row in managed development. |
| What's deployed? | `/api/health?scope=deploy`, or the Dokploy service image. |
| Is a nightly T3 run done? | The T3 scheduler and the Notion queue row's status and Run report. |

## Known issues (2026-10-19)

Keep this list current: add failures when you find them, remove them when fixed.

- **Music IDs:** Roblox Creator Store returns HTTP 500.
- **Universe stats:** the daily rollup falls back to universe chunks after its full pass times out. The hourly prune was fixed on 2026-10-24; watch for `partial` runs. See [stats](../content/stats.md#known-issues).
- **Item stats:** recovering from the bundle-key failures fixed on 2026-10-24; the audit is partial until overdue items drop under 5%. See [data refreshes](../content/data-refreshes.md#known-issues-2026-10-19).
- **Selective PR review:** its `scope` job fails on very large PRs when GitHub's file list doesn't match `changed_files`. It doesn't block merging.

# GitHub operational monitoring

Status: Deferred for a later task. The active VPS and homelab pipeline repairs are complete. This note records the remaining monitoring work; it does not authorize service activation or change the current monitor.

## What it does

The [Stats Operational Health Monitor](../.github/workflows/stats-health-monitor.yml) runs on GitHub Actions. It calls `https://bloxodes.com/api/health` and requires HTTP 200, `ok: true`, and the operational health scope.

The endpoint checks database readiness and game stats health. Its checks cover player-data freshness, current-index coverage, overdue refreshes, expired processing claims, stuck jobs, recent WARM/COLD refresh outcomes, and hourly statistics/ranking freshness.

When health changes to unhealthy, the workflow sends a Telegram alert. When a previously failing check recovers, it sends a recovery message. The workflow detects problems; it does not restart services, refresh content, or repair the database.

GitHub provides a check outside the VPS, so a VPS outage does not also stop the machine running the check. This monitor previously detected a stats-worker failure. Existing behavior and incident evidence are documented in the [stats pipeline owner](../dev-docs/pipelines/stats.md).

## What needs fixing later

The workflow is configured for every five minutes. The October 2 audit observed only 39 runs between September 25 and October 2, with a median gap of 4.65 hours and a maximum gap of 7.05 hours. Those are audit observations, not a new measurement. The cause of the missed or delayed triggers remains unverified.

Current monitoring mainly covers game stats. It does not yet provide complete coverage of the active codes, catalog, article/wiki, and cache-delivery pipelines. It also does not retain the full health response in the run log for diagnosis.

The later task should:

- Investigate the schedule gaps and establish a dependable external check with a missed-trigger alarm.
- Add checks for active codes and catalog freshness, homelab queue/lease health, and revalidation/cache delivery. Set thresholds using each pipeline's actual schedule.
- Retain a safe diagnostic health response with each run and keep failure/recovery alerts useful without repeated alerts for the same incident.
- Verify failure, recovery, unreachable VPS, stale data, and missing monitor executions. Use controlled tests that do not interrupt production jobs.

Keep the check outside the VPS. Monitor only active pipelines. Event runners, optional wiki recovery, Google Indexing, IndexNow, and other intentionally stopped services must remain closed.

## Evidence and completion criteria

The October 2 audit checked the workflow definition, GitHub run history, and alert logs. Representative runs include a [successful monitor run](https://github.com/RaviTejaKNTS/Bloxodes/actions/runs/36979027637) and an [unhealthy monitor run](https://github.com/RaviTejaKNTS/Bloxodes/actions/runs/36951948310).

Close this task when the monitor runs at its agreed interval, detects missing executions, covers the agreed active pipelines, and produces verified failure/recovery alerts with enough diagnostic evidence. Update the existing canonical pipeline documents when its behavior or ownership changes.

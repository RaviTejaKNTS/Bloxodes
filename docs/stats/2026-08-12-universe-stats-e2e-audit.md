# Universe Stats End-to-End Pipeline Audit — 2026-08-12

Status: **REPAIR IN PROGRESS — implementation and rollback-safe production validation passed; rollout/recurrence verification remains.**

Owner: Codex task started 2026-08-12 (Asia/Kolkata)

## Purpose

This is the persistent test ledger for the Bloxodes universe/game stats pipeline. It records every stage, the exact invariant being tested, commands or evidence used, the result, and any follow-up still required. The incident is not closed until the database, scheduler, read indexes, public APIs, rendered pages, and recurrence guard all pass together.

## Current incident baseline

Captured around 2026-08-12 22:40 IST:

- Public `/api/stats/games` total: **87,110**.
- Public `/api/health` reported database `ok`, even though stats coverage was degraded.
- Current read index timestamp: **2026-08-12 16:40:05 UTC**.
- Rows with stored player counts older than the public 24-hour cutoff: **7,409**.
- COLD tier: 83,693 eligible rows; 78,059 fresh; 5,631 stale; 6,637 due.
- WARM tier: 9,518 eligible rows; 9,172 fresh; 346 stale; 4,334 due.
- HOT tier: 5,474 eligible rows; 5,130 fresh; 344 stale; 5,421 due.
- NEW tier: 1,394 eligible rows; 0 fresh; 1,086 stale; 29 due.
- COLD refresh after the `:40` index build successfully refreshed roughly 5,000 rows, so the public index was also one worker run behind the database.

After a controlled serialized index rebuild at 2026-08-12 17:22 UTC, the public total rose from **87,110 to 92,106** without a population refresh. This independently proves that about 5,000 missing website rows were an index-order lag, while the remaining gap is raw freshness/trackability.

## Confirmed root-cause chain

1. On August 5, the collector changed from oldest-first batch selection to `next_stats_refresh_at` due-only atomic claims.
2. Successful rows schedule their next claim relative to the exact sample completion timestamp.
3. COLD runs at a fixed `:47` minute and public player counts expire at exactly 24 hours.
4. The later 23-hour cap still preserves the completion minute. A row refreshed yesterday at `:48`–`:56` becomes due today at `:48`–`:56`; the `:47` run cannot claim it, while the next run is almost an hour after its public value expires.
5. Manual repair runs concentrate many rows into the same completion window, creating large daily due-time cliffs.
6. The COLD worker is capped at 5,000 rows/run. Its nominal 120,000 rows/day equals the documented minimum with no headroom, and due-only claims make nominal capacity different from usable capacity.
7. Roblox omissions/transient failures and other due backlog consume capacity, so rows crossing the cutoff are not reliably recovered in the next run.
8. The read index runs at `:40`, before COLD at `:47`, adding a separate one-hour publication lag for the latest successful COLD batch.
9. The strict audit can fail inside cron, but there is no verified paging/notification path. `/api/health` remains green when stats coverage collapses, so the user-visible regression is not promoted to an operational health failure.
10. Unavailable NEW games enter an unintended tier loop: after three missing Roblox responses the refresh worker quarantines them as COLD with `game_details_unavailable`, but the scheduled `stats:tier -- --tier COLD` pass ignores that quarantine reason and assigns never-refreshed rows back to NEW. The visibility trigger then replaces the seven-day cooldown with an approximately one-hour due time. Recent NEW runs consequently claimed about 1,394 rows for only 0–1 successes.
11. The tier reassignment script pages with an offset while changing the filtered `stats_tier` column. Rows that leave the selected tier shrink the remaining result set, so later offsets can skip rows. This makes a full-looking tier pass potentially incomplete.
12. The local default env targets the retired managed project (`*.supabase.co`), not live `database.bloxodes.com`. A local strict audit could not find the production `v3` health RPC, and the local NEW audit saw 22 rows. Production operational tests must use the VPS worker environment; local output must never be presented as live production evidence.
13. The current-index growth baselines require an hourly sample within only plus/minus 90 minutes of exactly 24 hours or seven days ago. That does not match 12-hour WARM or 23-hour COLD sampling, and any outage near the exact comparison hour produces `Not tracked` even when the detail chart has history. Current visible-row 7-day coverage is only 41/77,809 COLD, 699/9,288 WARM, and 2,865/5,009 HOT. Brookhaven has chart history but its closest seven-day sample is three hours from the target, outside the index window.
14. Daily rank generation has timed out for three consecutive days (August 10–12) with PostgreSQL `57014`. Hourly ranks are current, but the daily rank stage is not healthy.
15. The production platform aggregate schema migration was skipped while its worker command was deployed. After applying the committed migration, a 90-day hourly scan still hit the self-hosted PostgREST eight-second statement budget; a two-day hourly/daily overlap completed in three seconds and exactly matched source totals.
16. Daily rank computation itself is fast (about two seconds for all rank windows). The 365K–550K-row monolithic upsert into a 3.6 GB table is the timeout source. The table had 1.48M dead rows and an unused duplicate ~1 GB index. The current web app reads hourly rank history only, so the daily writer is being paused rather than given a larger timeout.

This explains why removing cross-job lock starvation improved one bottleneck but did not stop recurrence: the August 5 due-time semantics and fixed-minute/capacity mismatch remained in place.

## Test ledger

Legend: `PASS`, `FAIL`, `PARTIAL`, `PENDING`, `BLOCKED`.

| # | Stage | Invariant | Status | Evidence / command | Follow-up |
|---|---|---|---|---|---|
| 1 | Repository/worktree safety | Audit does not overwrite unrelated user work | PASS | Initial `git status --short --branch`; existing catalog/component/doc changes identified and left untouched | Recheck before every code edit |
| 2 | Historical behavior | Pre-August 5 collector selected oldest rows without due-time gating | PASS | `git show da064469^:scripts/universes/update-universe-hourly-stats.ts` and commit diff | Preserve exact behavioral comparison in final findings |
| 3 | Claim RPC | Claims are atomic, lease-aware, tier-scoped, and ordered deterministically | PASS | Code/live migration inspection plus two simultaneous one-game workers: one succeeded, one persisted `pipeline_lease_busy`; same-hour rerun updated one row from sample count 1 to 2 | Observe normal lease expiry through recurrence |
| 4 | Due-time scheduling | Healthy rows are claimable early enough to remain visible through 24 hours | FAIL | 4,250 valid stale COLD rows had yesterday samples at `16:48`–`16:56` UTC and today due times at `15:48`–`15:56`; fixed worker begins at `:47` | Design/test schedule semantics with real headroom |
| 5 | COLD capacity | Scheduled usable capacity exceeds arrivals, retries, and one missed run | FAIL | Manifest has 5,000 rows hourly = exactly 120,000 nominal/day; actual 24-hour success was 77,941 | Measure real duration/rate and establish safety margin |
| 6 | HOT freshness | HOT worker keeps current values inside SLA | FAIL | 344 stored HOT counts stale; 4,622 failures in recent 24-hour HOT runs | Inspect Northflank schedule/logs and failure reasons |
| 7 | WARM freshness | WARM worker keeps current values inside SLA | FAIL | 346 stored WARM counts stale; current schedule is every six hours | Run controlled WARM test and inspect due distribution |
| 8 | NEW progression | NEW rows are enriched/refreshed and leave NEW | FAIL | Live logs: one run updated 1/1,394 and the next updated 0/1,392; almost every Roblox response omitted these IDs | Quantify invalid identity sources; preserve quarantine across tier passes |
| 9 | Tier assignment | Successful rows receive the correct tier without undoing quarantine or skipping rows | FAIL | COLD pass changed about 1,402 rows; code ignores `game_details_unavailable` and paginates by offset while mutating the filter column | Add quarantine-aware precedence and keyset/stable paging tests |
| 10 | Hourly samples | Successful latest-value updates create valid hourly history | PASS | Controlled universe 8977977335 refreshed twice in the same UTC hour; one hourly row remained and `sample_count` advanced 1 → 2 with correct first/last timestamps | Recheck after deployed build |
| 11 | Rank snapshots | Hourly and daily ranks represent the intended population on schedule | FAIL | Hourly latest was current; daily job timed out with `57014` on Aug 10, 11, and 12 | Profile/repair daily database rank RPC before rerun |
| 12 | Current indexes | Index reflects all fresh database rows without worker-order lag | FAIL | Manual serialized rebuild passed and raised public total 87,110 → 92,106; checked-in `:40` still precedes COLD `:47` | Correct ordering and prove it across a natural cycle |
| 13 | Revalidation queue | Aggregate invalidation drains promptly and detail backlog remains within capacity | PARTIAL | Controlled refresh queued two events; HOT refresh created ~999 pending detail events; queue fell to 840 and cache-warm queue was empty | Measure drain-to-zero time and verify aggregate paths were processed first |
| 14 | Public stats API | Total, pages, rows, and freshness match the current index | PASS | After index rebuild API returned total 92,106, 1,843 pages, and matching `lastUpdatedAt` | Repeat after next natural COLD + index cycle |
| 15 | Health endpoint | User-visible stats collapse makes operational health fail loudly | FAIL | `/api/health` returned database `ok` with 7,409 stale stored values | Define health threshold and alert target |
| 16 | Rendered pages | Stats listing, final page, and representative detail render the indexed state | PARTIAL | Browser showed page 1 of 1,843, final page 1,843 with ranks through 92,106, and the controlled detail with playing now 0 plus its hourly chart | Unavailable/NEW detail behavior still pending; widespread growth `Not tracked` is a data-index defect |
| 17 | Strict audit | Audit detects coverage, worker, lease, and index failures | PASS | Installed 12:10 UTC audit reported `unhealthy`, coverage 85.33%, and persisted its snapshot; strict command is present | Still must verify notification delivery and current rerun |
| 18 | Alert delivery | A strict audit failure reaches a human without manual log inspection | FAIL | No verified notification path from cron failure | Add and test alert transport before closure |
| 19 | Daily rollup | Yesterday finalization produces complete daily history | PASS | August 12: 168,107 hourly rows, 96,484 distinct universes, 96,484 finalized daily rows, zero missing universes | Observe next scheduled rollup |
| 20 | Platform aggregate | Platform totals use current, consistent inputs | PARTIAL | Missing committed migration repaired; two-day bounded test succeeded in 3 seconds with 47 hourly + 2 daily rows and exact latest-source equality | Deploy bounded recurring window and observe next 01:05 run |
| 21 | Scheduler parity | Checked-in manifest equals installed VPS crontab and wrapper/image revision | PARTIAL | Wrapper SHA matched exactly; worker repo/image source was production SHA 823adf3 and only two article-only commits behind | Install repaired manifests and rebuild image after release |
| 22 | Credential/network path | Worker uses Bitwarden SSH access and private Kong DB path successfully | PASS | Bitwarden-backed SSH reached `codex-admin@srv1432019`; live wrapper uses `supabase_default` and `http://supabase-kong:8000`; Kong and DB healthy | Note `supabase-rest` container is unhealthy and determine whether proxy masks an underlying issue |
| 23 | Recurrence test | Coverage remains above target through the next due-time cliff | PARTIAL | Natural overnight cycle raised public total 87,110 → 96,375 and drained the prior COLD cliff by 23:47 UTC; it proved recovery but also proved it takes hours under the old design | Observe 26 hours after 20h/7K/post-index rollout |
| 24 | Automated regression tests | Tests fail for cron-phase gaps, usable capacity, quarantine loops, and mutable pagination | FAIL | Existing 12 stats pipeline tests all pass against the currently failing design | Add time/schedule simulation and tier transition tests before any sign-off |
| 25 | Environment targeting | Every operator command identifies managed fallback vs live production before execution | FAIL | Local env resolved to managed `bbtcaurrtyoukvjbxbbj.supabase.co`; local audit lacked live RPC | Add an explicit remote-target guard or documented VPS-only command |
| 26 | Growth baselines | 24-hour and seven-day growth remain available whenever suitable history exists | FAIL | 7d present for only 41/77,809 visible COLD, 699/9,288 WARM, 2,865/5,009 HOT; Brookhaven nearest 7d sample was 3h away from a plus/minus-90m window | Use tier-compatible nearest/daily baselines and test sparse history |
| 27 | Daily ranks | Daily all-rank snapshot completes inside the production statement budget | FAIL / PAUSED | Aug 10–13 canceled at 240s; app has no daily-rank reader, compute is ~2s, bulk upsert is the failure | Remove recurring writer, drop redundant index, retain table read-only 7–14 days |
| 28 | Platform schema parity | Deployed worker RPCs exist in production migration history | PARTIAL | `20260918000007` was absent; applied transactionally and recorded; daily backfill produced 171 days | Release/verify bounded recurring job |
| 29 | Production build | Repaired web and operational code compiles as production | PASS | `npm run build` completed all 84 static routes and dynamic route compilation | Verify deployed SHA |
| 30 | Regression suite | Incident mechanisms fail tests before release | PASS | 14 universe pipeline tests + 6 growth/health behavior tests pass | Retain as release guard |

## August 13 recurrence checkpoint

Captured around 07:07 IST after the unattended overnight cycle:

- Public total: **96,375** games across 1,928 pages.
- Eligible universes: **100,079**; current index rows: **99,770**.
- Fresh raw player values: **96,631**; stored stale player values: **3,137**.
- COLD healthy rows: 82,313 fresh and one stale; quarantined unavailable rows: 1,384 with zero fresh.
- NEW: 1,382 rows, 1,185 never successfully refreshed, and scheduled runs still produced zero successes.
- Revalidation queue drained to zero; the cache-warm queue remained small and unattempted at the capture minute.
- The August 12 daily rollup finalized every universe with hourly history.
- The August 13 daily-rank job became the fourth consecutive 240-second timeout.

The count recovery proves the database and renderer can publish approximately the expected trackable population. It does not validate the old scheduling design: the COLD backlog required repeated 5K hourly batches and the quarantine/NEW loop remained active.

## Prepared repair set

1. Schedule healthy COLD rows at 20 hours and repair erased unavailable cooldowns.
2. Raise COLD nominal capacity to 7,000/hour, remove redundant post-refresh tier passes, and publish the index immediately after COLD.
3. Preserve unavailable quarantine in manual tier repair and replace mutable OFFSET pagination with universe-ID keyset pagination.
4. Apply the omitted platform aggregate migration and use a two-day recurring overlap; wider ranges become explicit backfills.
5. Pause the unused daily-rank writer, drop its duplicate index, lower autovacuum thresholds, and retain the table read-only during rollback observation.
6. Anchor growth baselines to each game's latest current observation and use HOT/WARM/COLD-compatible nearest-history windows.
7. Share one actionable health evaluator between strict audit and `/api/health`; keep `?scope=deploy` separate so a data incident cannot block its own repair deployment.
8. Poll operational health externally every five minutes and notify Telegram only on failure/recovery transitions.

Rollback-transaction production validation passed for all new functions/schema. The full tier-aware index rebuild returned 99,770 games, 26 genres, and 552 risers within its 240-second budget, then rolled back without leaving activity or schema changes.

## Controlled execution order

The live run will follow this order so each downstream result can be attributed to a known upstream state:

1. Capture DB/API/index/scheduler baseline.
2. Validate claim selection without overlapping production workers.
3. Run a narrow targeted universe refresh and verify raw + hourly writes.
4. Run/observe NEW, HOT, WARM, and COLD workers separately.
5. Run tier assignment.
6. Rebuild hourly ranks.
7. Rebuild current indexes after freshness workers.
8. Verify revalidation and cache-warm drainage.
9. Run the strict audit and capture its exit code/job row.
10. Verify API pagination and rendered listing/detail pages.
11. Check installed schedule/image parity.
12. Recheck after the next natural due boundary; only then assess recurrence.

## Controlled live test evidence

### One-game refresh — PASS

- Test universe: 8977977335 (`british-railways-future-btwf-8977977335`).
- Before: last player sample 2026-08-11 16:48:26 UTC, beyond the public cutoff.
- Command path: production VPS wrapper using `stats:refresh -- --tier ALL --universe-id 8977977335 --skip-index-refresh`.
- Result: 1 claimed, 1 succeeded, 0 failed.
- Latest row and hourly history both recorded 2026-08-12 17:20:57 UTC.
- Two aggregate revalidation events were queued.

### Serialized current-index rebuild — PASS as a command, FAIL as scheduled ordering

- Rebuild completed in about 37 seconds.
- Index rows: 99,769.
- Public fresh/visible total changed from 87,110 to 92,106.
- This repaired publication lag only; it did not repair stale source rows.

### Current strict audit — PASS as detection, FAIL as health design

- Current audit exited nonzero and persisted a `partial` job run.
- Raw fresh count: 92,362; stale stored player values: 7,406; public index fresh count before manual rebuild: 87,110.
- It reported 92.29% coverage, but the denominator includes unavailable and uninitialized rows, making the configured target unreachable.
- No external notification/paging path has been verified.

### Browser render — PARTIAL

- Listing rendered page 1 of 1,843 after the index rebuild.
- Final page 1,843 rendered six rows ending at rank 92,106.
- Controlled detail rendered current players and hourly history.
- `Not tracked` remains widespread in 24h/7d growth because the index baseline window is incompatible with sparse tier sampling.

## Safety notes

- Universe refresh, tier, rank, index, rollup, and revalidation commands mutate production data. Record before/after counts and job IDs for every live run.
- Do not run two same-tier refresh workers concurrently unless explicitly testing claim/lease behavior with a bounded scope.
- Do not expose Supabase service keys, Bitwarden material, SSH agent data, or environment contents in this document or command output.
- Do not close the incident merely because a manual catch-up temporarily restores the count.

## Next checkpoint

The next natural checkpoints are hourly ranks at `:30`, current index at `:40`, COLD refresh at `:47`, and then the following index at the next hour's `:40`. Because the current order publishes COLD one cycle late, the meaningful recurrence checkpoint is after the next COLD run has finished and the following index has completed. Do not launch a duplicate large COLD run while the scheduled worker or its group lock is active.

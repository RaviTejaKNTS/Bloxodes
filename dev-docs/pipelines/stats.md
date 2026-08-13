# Stats Pipelines

Status: Active; universe stats under active incident remediation
Last verified: 2026-08-13
Evidence: checked-in/installed cron, worker logs/files, production DB/API/health, and 2026-08-12 end-to-end audit ledger

## Universe Stats Flow

```text
Roblox discovery -> roblox_universes
tiers/claims -> NEW / HOT / WARM / COLD refresh workers
latest values + hourly samples
hourly/daily rank snapshots
current read indexes
/stats pages and APIs
revalidation events -> Cloudflare refresh
```

The VPS `codex-admin` crontab runs:

- image build daily at 00:05;
- NEW every two hours at `:07`;
- bounded priority discovery hourly at `:22`;
- WARM every six hours at `:32`;
- COLD hourly at `:47`;
- hourly ranks at `:30`;
- current indexes at `:40`;
- daily ranks at 00:50;
- strict audit every six hours at `:10`.

The schedule source is `scripts/ops/vps-universe-stats.crontab`. Jobs run through `vps-run-job.sh`, use explicit locks, private Kong, and worker logs under `/home/codex-admin/bloxodes-stats-worker/logs`.

## Item Stats Flow

Catalog item tiers drive NEW/HOT/WARM/COLD refreshes, resale history, current indexes, daily rollups, and strict audits. The installed schedule matches `scripts/ops/vps-scheduled-automation.crontab` and shares the `roblox-api` lock for Roblox-facing calls.

## Public Reads

Web/API readers use current index tables through `apps/web/src/lib/stats.ts` and route helpers. Health reports the latest stats index and fresh/stale player-value counts. On 2026-08-13 it reported a current index, 96,370 fresh values, and 3,140 stale stored values.

## Active Universe Incident

The 2026-08-12 live audit found multiple correctness/operability defects. Do not infer resolution from a green general health endpoint:

- COLD claim due-times and fixed `:47` schedule can miss the 24-hour public cutoff.
- Nominal COLD capacity lacks safe headroom.
- Current index at `:40` precedes COLD at `:47`, publishing COLD work one cycle late.
- NEW unavailable games can loop between quarantine and NEW tier.
- Tier mutation used offset pagination against the filtered column.
- Daily ranks had repeated statement-timeout failures.
- Growth baselines were too narrow for sparse tier sampling.
- Strict audit failure had no proven external notification path.

The newest audit ledger currently lives in the main checkout as `docs/stats/2026-08-12-universe-stats-e2e-audit.md`; it is an incident record, not canonical architecture. Update this file when remediation is actually verified through a natural recurrence window.

## Safety

- Never run overlapping same-tier workers outside a bounded lease/claim test.
- Production operator commands must identify the production target; local/managed-dev output is not production evidence.
- Rank/index/rollup/audit commands can mutate state; capture before/after and job IDs.
- Keep Roblox calls serialized through appropriate lock groups.

# Stats Pipelines

Status: Active; worker packaging recovery release in verification
Last verified: 2026-08-14
Evidence: checked-in/installed cron, worker and Northflank logs, production DB/API/health, container inspection, and worker packaging regression tests

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

Northflank owns HOT at `:12` every hour for separate Roblox API capacity. The
VPS `codex-admin` crontab runs:

- an exact-approved-SHA worker image rebuild daily at 00:05;
- NEW every two hours at `:07`;
- bounded priority discovery hourly at `:22`;
- WARM every six hours at `:32`;
- COLD hourly at `:47`;
- hourly ranks at `:30`;
- strict audit every six hours at `:10`.

The COLD command rebuilds current indexes after a successful refresh and before
revalidation. Daily rank writes remain intentionally unscheduled. The schedule
source is `scripts/ops/vps-universe-stats.crontab`. Jobs run through
`vps-run-job.sh`, use explicit locks, private Kong, and worker logs under
`/home/codex-admin/bloxodes-stats-worker/logs`.

## Worker Image Safety

`Dockerfile.stats-worker` deliberately packages the non-secret
`env/config.json` routing manifest and runs `npm run stats:worker:smoke` during
the image build. `scripts/ops/vps-build-stats-worker.sh` accepts only an exact
40-character approved commit SHA, builds a candidate tag, repeats the runtime
smoke, retains a healthy prior image as `last-known-good`, and promotes only a
passing candidate. Its installed approved SHA file pins nightly rebuilds; cron
must never reset the worker checkout to arbitrary `production` HEAD.

Before every scheduled command, `vps-run-job.sh` repeats the packaging smoke.
If the production tag fails but the retained image passes, the wrapper restores
the last-known-good tag before starting the job. Northflank uses an allowlist of
worker runtime paths so unrelated production commits do not rebuild HOT; the
same Dockerfile build smoke remains the final deployment gate.

## Item Stats Flow

Catalog item tiers drive NEW/HOT/WARM/COLD refreshes, resale history, current indexes, daily rollups, and strict audits. The installed schedule matches `scripts/ops/vps-scheduled-automation.crontab` and shares the `roblox-api` lock for Roblox-facing calls.

## Public Reads

Web/API readers use current index tables through `apps/web/src/lib/stats.ts` and route helpers. Health reports the latest stats index and fresh/stale player-value counts. On 2026-08-13 it reported a current index, 96,370 fresh values, and 3,140 stale stored values.

## August 14 Worker Packaging Incident

The August 13 environment-profile refactor made `env/config.json` a module-load
dependency of scripts, while the narrow stats-worker image still omitted that
file. Northflank HOT failed first after continuous deployment; the VPS failed
after its 00:05 daily image rebuild. Every affected container exited before its
first Roblox or database request. Stored rows and current-index membership
survived, but the public 24-hour freshness predicate reduced visible games as
observations aged.

This was not Roblox throttling, a lost database population, page rendering, or
VPS capacity. The operational health monitor detected the transition and sent
Telegram, but detection did not protect image promotion or roll back the worker.
The image manifest, candidate promotion, exact-SHA pin, last-known-good restore,
and CI regression tests now own that prevention path.

The older audit ledger at `docs/stats/2026-08-12-universe-stats-e2e-audit.md`
remains incident history rather than current architecture.

## Safety

- Never run overlapping same-tier workers outside a bounded lease/claim test.
- Production operator commands must identify the production target; managed-development output is not production evidence.
- Rank/index/rollup/audit commands can mutate state; capture before/after and job IDs.
- Keep Roblox calls serialized through appropriate lock groups.

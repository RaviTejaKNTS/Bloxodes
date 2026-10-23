#!/bin/bash
set -euo pipefail
umask 077
# Acquires the shared promotion/invocation lock BEFORE resolving the current JS file.
root=/srv/data/bloxodes-stats-chart-runtime
if [[ $# != 5 || $1 != --apply || $2 != --allow-prod || $3 != --expected-sha || ! $4 =~ ^[a-f0-9]{40}$ || $5 != run ]]; then
  echo 'stats-chart-wrapper-guards-required' >&2
  exit 1
fi
exec 9>"$root/state/runtime.lock"
if /usr/bin/flock --nonblock --conflict-exit-code 75 9; then
  :
else
  stats_lock_status=$?
  if [[ $stats_lock_status -eq 75 ]]; then
    /usr/bin/node "$root/current/scripts/ops/stats-chart-runtime.mjs" record-skip --expected-sha "$4"
    exit 75
  fi
  echo 'stats-chart-lock-failed' >&2
  exit 1
fi
export BLOXODES_STATS_CHART_LOCKED=1
exec /usr/bin/timeout --signal=TERM --kill-after=5s 240s \
  /usr/bin/node "$root/current/scripts/ops/stats-chart-runtime.mjs" run --apply --allow-prod --expected-sha "$4"

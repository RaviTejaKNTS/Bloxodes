#!/bin/sh
set -eu

if [ "$#" -lt 2 ]; then
  echo "usage: run-job.sh <job-name> <command>" >&2
  exit 2
fi

JOB="$1"
shift
COMMAND="$*"
BASE="$HOME/bloxodes-stats-worker"
ENV_FILE="$BASE/env.stats-worker"
LOG_DIR="$BASE/logs"
DOCKER_NETWORK="${STATS_WORKER_DOCKER_NETWORK:-supabase_default}"
SUPABASE_INTERNAL_URL="${STATS_WORKER_SUPABASE_INTERNAL_URL:-http://supabase-kong:8000}"
mkdir -p "$LOG_DIR"

exec 9>"$BASE/$JOB.lock"
flock -n 9 || {
  echo "$(date -Is) $JOB already running" >> "$LOG_DIR/$JOB.log"
  exit 0
}

# Jobs keep their own names/logs while optionally sharing a second lock for a
# rate-limited external API. This prevents independently scheduled Roblox
# collectors from exhausting the same VPS IP allowance.
if [ -n "${JOB_LOCK_GROUP:-}" ]; then
  case "$JOB_LOCK_GROUP" in
    *[!A-Za-z0-9._-]*)
      echo "invalid JOB_LOCK_GROUP: $JOB_LOCK_GROUP" >&2
      exit 2
      ;;
  esac
  exec 8>"$BASE/group-$JOB_LOCK_GROUP.lock"
  flock -n 8 || {
    echo "$(date -Is) $JOB skipped; lock group $JOB_LOCK_GROUP is busy" >> "$LOG_DIR/$JOB.log"
    exit 0
  }
fi

if ! docker image inspect bloxodes-stats-worker:production >/dev/null 2>&1; then
  "$BASE/bin/build-image.sh"
fi

echo "$(date -Is) starting $JOB" >> "$LOG_DIR/$JOB.log"
docker run --rm \
  --name "bloxodes-stats-$JOB-$(date +%s)" \
  --network "$DOCKER_NETWORK" \
  --env-file "$ENV_FILE" \
  -e SUPABASE_URL="$SUPABASE_INTERNAL_URL" \
  -e STATS_WORKER_COMMAND="$COMMAND" \
  bloxodes-stats-worker:production \
  >> "$LOG_DIR/$JOB.log" 2>&1
echo "$(date -Is) finished $JOB" >> "$LOG_DIR/$JOB.log"

#!/bin/sh
set -eu

if [ "$#" -lt 2 ]; then
  echo "usage: run-job.sh <job-name> <command>" >&2
  exit 2
fi

JOB="$1"
case "$JOB" in ''|*[!A-Za-z0-9._-]*) echo 'invalid job name' >&2; exit 2 ;; esac
shift
COMMAND="$*"
BASE="${STATS_WORKER_BASE:-$HOME/bloxodes-stats-worker}"
ENV_FILE="$BASE/env.stats-worker"
LOG_DIR="$BASE/logs"
DOCKER_NETWORK="${STATS_WORKER_DOCKER_NETWORK:-supabase_default}"
SUPABASE_INTERNAL_URL="${STATS_WORKER_SUPABASE_INTERNAL_URL:-http://supabase-kong:8000}"
IMAGE="bloxodes-stats-worker:production"
LAST_GOOD_IMAGE="bloxodes-stats-worker:last-known-good"
SMOKE_COMMAND="npm run stats:worker:smoke"
mkdir -p "$LOG_DIR"
STATE_DIR="$BASE/state"
mkdir -p "$STATE_DIR"
STATE=starting
STARTED_AT="$(date -Is)"
write_state() {
  state_tmp="$STATE_DIR/$JOB.$$.tmp"
  printf '{"job":"%s","state":"%s","started_at":"%s","updated_at":"%s","exit_code":%s}\n' \
    "$JOB" "$STATE" "$STARTED_AT" "$(date -Is)" "${1:-0}" > "$state_tmp"
  mv "$state_tmp" "$STATE_DIR/$JOB.json"
}
finish() {
  result=$?
  trap - EXIT
  if [ "$STATE" = running ] || [ "$STATE" = starting ] || [ "$STATE" = waiting ]; then STATE=failed; fi
  write_state "$result"
  if [ "$STATE" = success ]; then
    date -Is > "$STATE_DIR/$JOB.last-success.tmp"
    mv "$STATE_DIR/$JOB.last-success.tmp" "$STATE_DIR/$JOB.last-success"
  fi
  echo "$(date -Is) $JOB state=$STATE exit=$result" >> "$LOG_DIR/$JOB.log"
  exit "$result"
}

exec 9>"$BASE/$JOB.lock"
flock -n 9 || {
  echo "$(date -Is) $JOB already running" >> "$LOG_DIR/$JOB.log"
  # Leave the running owner's status intact, but expose the missed invocation.
  exit 75
}
trap finish EXIT
write_state
if ! docker network inspect "$DOCKER_NETWORK" >/dev/null 2>&1; then
  echo "stats worker Docker network not found: $DOCKER_NETWORK" >&2
  exit 1
fi

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
  LOCK_WAIT_SECONDS="${JOB_LOCK_WAIT_SECONDS:-7200}"
  case "$LOCK_WAIT_SECONDS" in
    ''|*[!0-9]*)
      echo "invalid JOB_LOCK_WAIT_SECONDS: $LOCK_WAIT_SECONDS" >&2
      exit 2
      ;;
  esac
  exec 8>"$BASE/group-$JOB_LOCK_GROUP.lock"
  if [ "$LOCK_WAIT_SECONDS" -gt 0 ]; then
    STATE=waiting
    write_state
    echo "$(date -Is) $JOB waiting up to ${LOCK_WAIT_SECONDS}s for lock group $JOB_LOCK_GROUP" >> "$LOG_DIR/$JOB.log"
    flock -w "$LOCK_WAIT_SECONDS" 8 || {
      echo "$(date -Is) $JOB timed out waiting for lock group $JOB_LOCK_GROUP" >> "$LOG_DIR/$JOB.log"
      exit 1
    }
  else
    flock -n 8 || {
      echo "$(date -Is) $JOB skipped; lock group $JOB_LOCK_GROUP is busy" >> "$LOG_DIR/$JOB.log"
      STATE=skipped
      exit 75
    }
  fi
fi

if ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
  "$BASE/bin/build-image.sh"
fi

if ! docker run --rm \
  --env BLOXODES_ENV_PROFILE=process-only \
  --entrypoint sh \
  "$IMAGE" \
  -lc "$SMOKE_COMMAND" >/dev/null 2>&1; then
  echo "$(date -Is) $JOB production image failed smoke" >> "$LOG_DIR/$JOB.log"
  if docker image inspect "$LAST_GOOD_IMAGE" >/dev/null 2>&1 \
    && docker run --rm \
      --env BLOXODES_ENV_PROFILE=process-only \
      --entrypoint sh \
      "$LAST_GOOD_IMAGE" \
      -lc "$SMOKE_COMMAND" >/dev/null 2>&1; then
    docker tag "$LAST_GOOD_IMAGE" "$IMAGE"
    echo "$(date -Is) $JOB restored last-known-good worker image" >> "$LOG_DIR/$JOB.log"
  else
    echo "$(date -Is) $JOB has no healthy last-known-good worker image" >> "$LOG_DIR/$JOB.log"
    exit 1
  fi
fi

echo "$(date -Is) starting $JOB" >> "$LOG_DIR/$JOB.log"
STATE=running
write_state
RUN_TIMEOUT="${JOB_TIMEOUT_SECONDS:-7200}"
case "$RUN_TIMEOUT" in ''|*[!0-9]*|0) echo 'invalid JOB_TIMEOUT_SECONDS' >&2; exit 2 ;; esac
CONTAINER="bloxodes-stats-$JOB-$(date +%s)"
ACTIVE_CONTAINER_IDS="$(docker ps --no-trunc --format '{{.ID}}')"
# Docker's CLI can exit before its container on a timeout. Remove this exact
# container before releasing the shared API lock.
stop_container() { docker rm -f "$CONTAINER" >/dev/null 2>&1 || true; }
trap 'stop_container; exit 143' TERM
trap 'stop_container; exit 130' INT
if timeout --signal=TERM --kill-after=30 "$RUN_TIMEOUT" docker run --rm \
  --name "$CONTAINER" \
  --network "$DOCKER_NETWORK" \
  --env-file "$ENV_FILE" \
  -e SUPABASE_URL="$SUPABASE_INTERNAL_URL" \
  -e STATS_WORKER_COMMAND="$COMMAND" \
  -e STATS_WORKER_ACTIVE_CONTAINER_IDS="$ACTIVE_CONTAINER_IDS" \
  "$IMAGE" \
  >> "$LOG_DIR/$JOB.log" 2>&1; then
  STATE=success
else
  result=$?
  stop_container
  exit "$result"
fi
echo "$(date -Is) finished $JOB" >> "$LOG_DIR/$JOB.log"

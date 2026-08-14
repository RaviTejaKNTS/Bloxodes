#!/bin/sh
set -eu

BASE="${STATS_WORKER_BASE:-$HOME/bloxodes-stats-worker}"
REPO="$BASE/repo"
APPROVED_SHA_FILE="$BASE/approved-worker-sha"
IMAGE="bloxodes-stats-worker:production"
LAST_GOOD_IMAGE="bloxodes-stats-worker:last-known-good"
REPO_URL="${STATS_WORKER_REPO_URL:-github-bloxodes-stats:RaviTejaKNTS/Bloxodes.git}"
APPROVED_SHA=""

usage() {
  echo "usage: vps-build-stats-worker.sh [--approved-sha <40-character-sha>]" >&2
}

if [ "$#" -gt 0 ]; then
  if [ "$#" -ne 2 ] || [ "$1" != "--approved-sha" ]; then
    usage
    exit 2
  fi
  APPROVED_SHA="$2"
elif [ -f "$APPROVED_SHA_FILE" ]; then
  APPROVED_SHA="$(tr -d '[:space:]' < "$APPROVED_SHA_FILE")"
else
  echo "No approved stats-worker SHA is installed. Release with --approved-sha first." >&2
  exit 1
fi

case "$APPROVED_SHA" in
  *[!0-9a-f]*)
    echo "Invalid approved stats-worker SHA: expected exactly 40 lowercase hex characters." >&2
    exit 2
    ;;
esac
if [ "${#APPROVED_SHA}" -ne 40 ]; then
  echo "Invalid approved stats-worker SHA: expected exactly 40 lowercase hex characters." >&2
  exit 2
fi

mkdir -p "$BASE/logs"
exec 9>"$BASE/build.lock"
flock -n 9 || {
  echo "Stats worker image build already running."
  exit 0
}

if [ ! -d "$REPO/.git" ]; then
  git clone --no-checkout "$REPO_URL" "$REPO"
fi

git -C "$REPO" fetch origin "$APPROVED_SHA" --depth 1
RESOLVED_SHA="$(git -C "$REPO" rev-parse FETCH_HEAD)"
if [ "$RESOLVED_SHA" != "$APPROVED_SHA" ]; then
  echo "Fetched worker SHA $RESOLVED_SHA does not match approved SHA $APPROVED_SHA." >&2
  exit 1
fi

git -C "$REPO" reset --hard "$APPROVED_SHA"
git -C "$REPO" clean -dffx

SHORT_SHA="$(printf '%s' "$APPROVED_SHA" | cut -c1-12)"
CANDIDATE_IMAGE="bloxodes-stats-worker:candidate-$SHORT_SHA"
SMOKE_COMMAND="npm run stats:worker:smoke"

docker build \
  --build-arg "BLOXODES_BUILD_SHA=$APPROVED_SHA" \
  --label "com.bloxodes.source-sha=$APPROVED_SHA" \
  --tag "$CANDIDATE_IMAGE" \
  --file "$REPO/Dockerfile.stats-worker" \
  "$REPO"

docker run --rm \
  --env BLOXODES_ENV_PROFILE=process-only \
  --entrypoint sh \
  "$CANDIDATE_IMAGE" \
  -lc "$SMOKE_COMMAND"

CANDIDATE_SHA="$(docker image inspect "$CANDIDATE_IMAGE" --format '{{ index .Config.Labels "com.bloxodes.source-sha" }}')"
if [ "$CANDIDATE_SHA" != "$APPROVED_SHA" ]; then
  echo "Candidate worker image reports unexpected SHA $CANDIDATE_SHA." >&2
  exit 1
fi

if docker image inspect "$IMAGE" >/dev/null 2>&1; then
  if docker run --rm \
    --env BLOXODES_ENV_PROFILE=process-only \
    --entrypoint sh \
    "$IMAGE" \
    -lc "$SMOKE_COMMAND" >/dev/null 2>&1; then
    docker tag "$IMAGE" "$LAST_GOOD_IMAGE"
  else
    echo "Current production worker image failed smoke; it was not saved as last-known-good."
  fi
fi

docker tag "$CANDIDATE_IMAGE" "$IMAGE"

APPROVED_SHA_TMP="$APPROVED_SHA_FILE.tmp"
printf '%s\n' "$APPROVED_SHA" > "$APPROVED_SHA_TMP"
chmod 600 "$APPROVED_SHA_TMP"
mv "$APPROVED_SHA_TMP" "$APPROVED_SHA_FILE"

PROMOTED_SHA="$(docker image inspect "$IMAGE" --format '{{ index .Config.Labels "com.bloxodes.source-sha" }}')"
if [ "$PROMOTED_SHA" != "$APPROVED_SHA" ]; then
  echo "Promoted worker image reports unexpected SHA $PROMOTED_SHA." >&2
  exit 1
fi

echo "Promoted stats worker image for approved SHA $APPROVED_SHA."

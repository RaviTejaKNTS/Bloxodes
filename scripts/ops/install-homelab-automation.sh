#!/usr/bin/env bash
set -euo pipefail
[[ "${1:-}" == --apply && "${2:-}" =~ ^[0-9a-f]{40}$ ]] || { echo 'Usage: sudo scripts/ops/install-homelab-automation.sh --apply <released-40-char-sha>' >&2; exit 2; }
SHA="$2"
SOURCE=/home/teja/projects/Bloxodes
ROOT=/home/teja/.local/share/bloxodes-automation-runtime
LEGACY=/home/teja/.local/share/bloxodes-article-runtime
RELEASE="$ROOT/releases/$SHA"
MODEL=bloxodes-wiki-model
[[ "$EUID" == 0 && "$(hostname)" == teja-homelab ]]
exec 9> /run/lock/bloxodes-automation-install.lock
flock -n 9 || { echo 'Another activation is running.' >&2; exit 1; }
[[ "$(git -C "$SOURCE" rev-parse origin/production)" == "$SHA" ]]
[[ "$(cat "$ROOT/prepared-sha")" == "$SHA" ]]
[[ "$(git -C "$RELEASE" rev-parse HEAD)" == "$SHA" ]]
[[ -z "$(git -C "$RELEASE" status --porcelain)" ]]
[[ -r /etc/bloxodes/article-automation.env && -r /etc/bloxodes/wiki-automation.env ]]
id "$MODEL" >/dev/null
command -v setfacl >/dev/null
SERVICES=(bloxodes-article-discovery.service bloxodes-article-writer.service bloxodes-article-publication.service bloxodes-article-audit.service bloxodes-wiki-builder.service bloxodes-wiki-publisher.service)
TIMERS=(bloxodes-article-discovery.timer bloxodes-article-publication.timer bloxodes-wiki-builder.timer bloxodes-wiki-publisher.timer)
idle() {
  local service state pid
  for service in "${SERVICES[@]}"; do
    state=$(systemctl show "$service" -p ActiveState --value)
    pid=$(systemctl show "$service" -p MainPID --value)
    if [[ "$state" != inactive && "$state" != failed ]] || [[ "$pid" != 0 ]]; then
      echo "$service is $state (PID $pid); retry after it finishes. No job will be stopped." >&2; return 1
    fi
  done
}
idle
BACKUP="$ROOT/activations/$(date -u +%Y%m%dT%H%M%SZ)-$SHA"
mkdir -p "$BACKUP/units"
for unit in "${SERVICES[@]}" "${TIMERS[@]}"; do cp -a "/etc/systemd/system/$unit" "$BACKUP/units/$unit"; done
readlink "$ROOT/current" > "$BACKUP/previous-current" || true
ACTIVE=()
for timer in "${TIMERS[@]}"; do
  systemctl is-enabled "$timer" >> "$BACKUP/enabled-states" || true
  if systemctl is-active --quiet "$timer"; then ACTIVE+=("$timer"); fi
done
printf '%s\n' "${ACTIVE[@]}" > "$BACKUP/active-timers"
CHANGED=0
SUCCESS=0
LOCKED=0
finish() {
  local status=$?
  trap - EXIT
  if [[ "$SUCCESS" == 0 && "$CHANGED" == 1 ]]; then
    cp -a "$BACKUP/units/." /etc/systemd/system/
    if [[ -s "$BACKUP/previous-current" ]]; then
      ln -sfn "$(cat "$BACKUP/previous-current")" "$ROOT/current.rollback"
      mv -Tf "$ROOT/current.rollback" "$ROOT/current"
    else rm -f "$ROOT/current"; fi
    systemctl daemon-reload
    echo "Activation failed; previous units and pointer restored. Backup: $BACKUP" >&2
  fi
  if [[ "$LOCKED" == 1 ]]; then rm "$SOURCE/tmp/article-writer/writer.lock"; fi
  if [[ ${#ACTIVE[@]} -gt 0 ]]; then systemctl start "${ACTIVE[@]}" || status=1; fi
  exit "$status"
}
trap finish EXIT
systemctl stop "${TIMERS[@]}"
# Catch a timer firing between the initial check and trigger suspension.
idle
# Exclude manual article/wiki workers too; the same lease is visible in all releases.
(set -o noclobber; printf '{"pid":%s,"token":"runtime-activation-%s","mode":"runtime-activation"}\n' "$$" "$$" > "$SOURCE/tmp/article-writer/writer.lock") || { echo 'Shared article/wiki lease exists; retry after its owner finishes.' >&2; exit 1; }
LOCKED=1
# Persist data once, retaining every old absolute artifact path for queued retries.
if [[ -L "$ROOT/state" ]]; then
  [[ "$(readlink -f "$ROOT/state")" == "$LEGACY/state" ]]
  unlink "$ROOT/state"
  mv "$LEGACY/state" "$ROOT/state"
  ln -s "$ROOT/state" "$LEGACY/state"
fi
if [[ ! -e "$ROOT/state/wiki-automation" ]]; then
  mv "$SOURCE/tmp/wiki-automation" "$ROOT/state/wiki-automation"
  ln -s "$ROOT/state/wiki-automation" "$SOURCE/tmp/wiki-automation"
fi
[[ "$(readlink -f "$SOURCE/tmp/wiki-automation")" == "$ROOT/state/wiki-automation" ]]
[[ "$(readlink -f "$RELEASE/tmp/article-writer")" == "$SOURCE/tmp/article-writer" ]]
# The model can traverse the runtime and read code, but only write artifacts/cache.
# Do not recurse through .envs or grant access to any credential directory.
setfacl -m "u:$MODEL:--x" /home/teja/.local/share
setfacl -m "u:$MODEL:r-x" "$ROOT" "$ROOT/releases" "$RELEASE" "$ROOT/state"
install -d -o teja -g teja -m 0770 "$RELEASE/apps/web/.next"
setfacl -m "u:$MODEL:rwx,d:u:$MODEL:rwx,d:u:teja:rwx" "$RELEASE/apps/web/.next"
setfacl -m "u:$MODEL:rwx" "$SOURCE/tmp/article-writer"
setfacl -R -m u:teja:rX "$ROOT/state/wiki-automation"
setfacl -m d:u:teja:rX "$ROOT/state/wiki-automation"
runuser -u "$MODEL" -- test ! -r "$RELEASE/.envs"
runuser -u "$MODEL" -- git -c "safe.directory=$RELEASE" -C "$RELEASE" status --porcelain > "$BACKUP/model-git-status"
[[ ! -s "$BACKUP/model-git-status" ]]
# Check the actual restricted service sandbox without claiming content or publishing.
systemd-run --quiet --wait --pipe --collect --unit=bloxodes-automation-readiness \
  --property="User=$MODEL" --property="Group=$MODEL" --property="WorkingDirectory=$RELEASE" \
  --property=EnvironmentFile=/etc/bloxodes/wiki-automation.env \
  --property=ProtectSystem=strict --property=ProtectHome=read-only --property=PrivateTmp=true \
  --property=NoNewPrivileges=true --property=CapabilityBoundingSet= \
  --property="ReadWritePaths=/var/lib/bloxodes/wiki-model $SOURCE/tmp/article-writer $ROOT/state/wiki-automation $RELEASE/apps/web/.next" \
  --setenv=NODE_ENV=development --setenv=BLOXODES_ENV_PROFILE=managed-dev --setenv=BLOXODES_ENV_OVERLAYS= \
  --setenv=BLOXODES_AUTOMATION_RUNTIME=1 --setenv="WIKI_AUTOMATION_WORKTREE=$RELEASE" \
  /bin/bash -euc 'npm run wiki:homelab:check; node --import tsx scripts/ops/check-automation-preview.ts'
CHANGED=1
for unit in "${SERVICES[@]}" "${TIMERS[@]}"; do install -m 0644 "$RELEASE/scripts/ops/systemd/$unit" "/etc/systemd/system/$unit"; done
ln -sfn "$RELEASE" "$ROOT/current.next"
mv -Tf "$ROOT/current.next" "$ROOT/current"
systemctl daemon-reload
for unit in "${SERVICES[@]}" "${TIMERS[@]}"; do cmp "$RELEASE/scripts/ops/systemd/$unit" "/etc/systemd/system/$unit"; done
[[ -z "$(git -C "$RELEASE" status --porcelain)" ]]
SUCCESS=1
echo "Activated articles and wiki/collections at $SHA. Prior timer enablement/cadence retained. Rollback units: $BACKUP"

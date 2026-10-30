#!/usr/bin/env bash
set -euo pipefail
[[ "${1:-}" == --apply && "${2:-}" =~ ^[0-9a-f]{40}$ ]] || { echo 'Usage: sudo scripts/ops/install-homelab-automation.sh --apply <released-40-char-sha>' >&2; exit 2; }
SHA="$2"
SOURCE=/srv/data/projects/Bloxodes
ROOT=/srv/data/bloxodes-automation-runtime
LEGACY=/home/teja/.local/share/bloxodes-automation-runtime
RELEASE="$ROOT/releases/$SHA"
[[ "$EUID" == 0 && "$(hostname)" == teja-homelab ]]
exec 9> /run/lock/bloxodes-automation-install.lock
flock -n 9 || { echo 'Another activation is running.' >&2; exit 1; }
[[ "$(git -C "$SOURCE" rev-parse origin/production)" == "$SHA" ]]
[[ "$(cat "$ROOT/prepared-sha")" == "$SHA" ]]
[[ "$(git -C "$RELEASE" rev-parse HEAD)" == "$SHA" ]]
[[ -z "$(git -C "$RELEASE" status --porcelain)" ]]
[[ -r /etc/bloxodes/article-automation.env ]]
SERVICES=(bloxodes-article-discovery.service bloxodes-site-health.service)
TIMERS=(bloxodes-article-discovery.timer bloxodes-site-health.timer)
# Writing and publication belong to the Content Factory on the MacBook Pro.
# Keep these names only for removal and failure rollback, never installation.
RETIRED=(bloxodes-article-publication.timer bloxodes-article-writer.service bloxodes-article-publication.service bloxodes-article-audit.service)
WRITER_DROPIN=/etc/systemd/system/bloxodes-article-writer.service.d
# /run/systemd/system can be absent; find fails on a missing path under set -e.
UNIT_DIRS=(/etc/systemd/system)
if [[ -d /run/systemd/system ]]; then UNIT_DIRS+=(/run/systemd/system); fi
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
mkdir -p "$BACKUP/units" "$BACKUP/enablement"
for unit in "${SERVICES[@]}" "${TIMERS[@]}" "${RETIRED[@]}"; do
  if [[ -e "/etc/systemd/system/$unit" || -L "/etc/systemd/system/$unit" ]]; then cp -a "/etc/systemd/system/$unit" "$BACKUP/units/$unit";
  else touch "$BACKUP/units/$unit.absent"; fi
done
if [[ -e "$WRITER_DROPIN" || -L "$WRITER_DROPIN" ]]; then
  cp -a "$WRITER_DROPIN" "$BACKUP/writer-dropin"
fi
# Save exact persistent and runtime enablement links, including nonstandard targets.
for unit in "${RETIRED[@]}"; do
  while IFS= read -r -d '' link; do
    cp -a --parents "$link" "$BACKUP/enablement/"
  done < <(find "${UNIT_DIRS[@]}" -mindepth 2 -type l -name "$unit" -print0)
done
RETIRED_ACTIVE=()
for unit in "${RETIRED[@]}"; do
  if systemctl is-active --quiet "$unit"; then RETIRED_ACTIVE+=("$unit"); fi
done
printf '%s\n' "${RETIRED_ACTIVE[@]}" > "$BACKUP/active-retired-units"
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
    for unit in "${SERVICES[@]}" "${TIMERS[@]}" "${RETIRED[@]}"; do
      rm -f "/etc/systemd/system/$unit"
      if [[ ! -f "$BACKUP/units/$unit.absent" ]]; then
        cp -a "$BACKUP/units/$unit" "/etc/systemd/system/$unit"
      fi
    done
    rm -rf "$WRITER_DROPIN"
    if [[ -e "$BACKUP/writer-dropin" || -L "$BACKUP/writer-dropin" ]]; then
      cp -a "$BACKUP/writer-dropin" "$WRITER_DROPIN"
    fi
    for unit in "${RETIRED[@]}"; do
      find "${UNIT_DIRS[@]}" -mindepth 2 -type l -name "$unit" -delete
    done
    while IFS= read -r -d '' link; do
      target="${link#"$BACKUP/enablement"}"
      mkdir -p "$(dirname "$target")"
      cp -a "$link" "$target"
    done < <(find "$BACKUP/enablement" -type l -print0)
    if [[ -s "$BACKUP/previous-current" ]]; then
      ln -sfn "$(cat "$BACKUP/previous-current")" "$ROOT/current.rollback"
      mv -Tf "$ROOT/current.rollback" "$ROOT/current"
    else rm -f "$ROOT/current"; fi
    systemctl daemon-reload
    echo "Activation failed; previous units and pointer restored. Backup: $BACKUP" >&2
  fi
  if [[ "$LOCKED" == 1 ]]; then rm "$SOURCE/tmp/article-writer/writer.lock"; fi
  if [[ "$SUCCESS" == 0 && "$CHANGED" == 1 && ${#RETIRED_ACTIVE[@]} -gt 0 ]]; then
    systemctl start "${RETIRED_ACTIVE[@]}" || status=1
  fi
  if [[ ${#ACTIVE[@]} -gt 0 ]]; then systemctl start "${ACTIVE[@]}" || status=1; fi
  exit "$status"
}
trap finish EXIT
# A new timer has no loaded unit on its first installation. Suspend only the
# timers that were actually active; rollback restores this exact same set.
if [[ ${#ACTIVE[@]} -gt 0 ]]; then systemctl stop "${ACTIVE[@]}"; fi
# Catch a timer firing between the initial check and trigger suspension.
idle
# Exclude manual article/wiki workers too; the same lease is visible in all releases.
(set -o noclobber; printf '{"pid":%s,"token":"runtime-activation-%s","mode":"runtime-activation"}\n' "$$" "$$" > "$SOURCE/tmp/article-writer/writer.lock") || { echo 'Shared automation lease exists; retry after its owner finishes.' >&2; exit 1; }
LOCKED=1
[[ -f "$ROOT/package-receipt-$SHA.json" ]]
CHANGED=1
# Stop the retired trigger first, then its workers. Missing units need no action.
for unit in "${RETIRED[@]}"; do
  if [[ "$(systemctl show "$unit" -p LoadState --value)" != not-found ]]; then
    systemctl stop "$unit"
    # Static units have no enablement links; disable also handles enabled units.
    systemctl disable "$unit"
  fi
  find "${UNIT_DIRS[@]}" -mindepth 2 -type l -name "$unit" -delete
  rm -f "/etc/systemd/system/$unit"
done
rm -rf "$WRITER_DROPIN"
# Persist data once, retaining every old absolute artifact path for queued retries.
if [[ -L "$ROOT/state" || -f "$ROOT/state-relocation.json" && ( ! -L "$LEGACY/state" || -d "$LEGACY/state.before-hdd" ) ]]; then
  python3 "$RELEASE/scripts/ops/relocate-automation-state.py" "$LEGACY" "$ROOT"
fi
[[ "$(readlink -f "$RELEASE/tmp/article-writer")" == "$(readlink -f "$SOURCE/tmp/article-writer")" ]]
# Wiki scheduling belongs to T3 on the MacBook Pro. Never recreate its retired
# homelab units, model permissions, artifact aliases or correction state.
# GitHub owns dependency installation, checks, builds and browser verification.
# This activation performs filesystem and service-state readback only.
for unit in "${SERVICES[@]}" "${TIMERS[@]}"; do install -m 0644 "$RELEASE/scripts/ops/systemd/$unit" "/etc/systemd/system/$unit"; done
ln -sfn "$RELEASE" "$ROOT/current.next"
mv -Tf "$ROOT/current.next" "$ROOT/current"
systemctl daemon-reload
for unit in "${SERVICES[@]}" "${TIMERS[@]}"; do cmp "$RELEASE/scripts/ops/systemd/$unit" "/etc/systemd/system/$unit"; done
[[ -z "$(git -C "$RELEASE" status --porcelain)" ]]
# Restore only retained timers that were active before activation.
# Retired units stay stopped and disabled on success.
SUCCESS=1
echo "Activated discovery and site-health automation at $SHA; retired article workers removed. Prior timer enablement/cadence retained. Rollback units: $BACKUP"

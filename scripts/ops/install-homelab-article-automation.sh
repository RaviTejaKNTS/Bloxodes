#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" != "--apply" || ! "${2:-}" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Usage: sudo scripts/ops/install-homelab-article-automation.sh --apply <approved-40-char-sha>" >&2
  exit 2
fi
APPROVED_SHA="$2"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run this installer with sudo." >&2
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RUNTIME_ROOT="/home/teja/.local/share/bloxodes-article-runtime"
RELEASE_DIR="${RUNTIME_ROOT}/releases/${APPROVED_SHA}"
UNIT_SOURCE="${RELEASE_DIR}/scripts/ops/systemd"
ENV_DIR="/etc/bloxodes"
ENV_PATH="${ENV_DIR}/article-automation.env"

if [[ "${REPO_ROOT}" != "/home/teja/projects/Bloxodes" ]]; then
  echo "Expected the worker checkout at /home/teja/projects/Bloxodes; found ${REPO_ROOT}." >&2
  exit 1
fi
if [[ "$(git -C "${REPO_ROOT}" rev-parse HEAD)" != "${APPROVED_SHA}" ]]; then
  echo "Checkout does not match approved SHA ${APPROVED_SHA}." >&2
  exit 1
fi
if [[ -n "$(git -C "${REPO_ROOT}" status --porcelain)" ]]; then
  echo "Checkout is dirty; refusing to install service units." >&2
  exit 1
fi
[[ "$(cat "${RUNTIME_ROOT}/prepared-sha")" == "${APPROVED_SHA}" ]] || { echo "Prepare and check this runtime first." >&2; exit 1; }
[[ "$(git -C "${RELEASE_DIR}" rev-parse HEAD)" == "${APPROVED_SHA}" ]]
[[ -z "$(git -C "${RELEASE_DIR}" status --porcelain)" ]]
# Stop triggers, not jobs, while reconciling state and switching units. Restore on failure.
DISCOVERY_WAS_ACTIVE=false
PUBLICATION_WAS_ACTIVE=false
systemctl is-active --quiet bloxodes-article-discovery.timer && DISCOVERY_WAS_ACTIVE=true
systemctl is-active --quiet bloxodes-article-publication.timer && PUBLICATION_WAS_ACTIVE=true
restore_timers() {
  if [[ "${DISCOVERY_WAS_ACTIVE}" == true ]]; then systemctl start bloxodes-article-discovery.timer; fi
  if [[ "${PUBLICATION_WAS_ACTIVE}" == true ]]; then systemctl start bloxodes-article-publication.timer; fi
}
trap restore_timers EXIT
systemctl stop bloxodes-article-discovery.timer
if [[ "${PUBLICATION_WAS_ACTIVE}" == true ]]; then systemctl stop bloxodes-article-publication.timer; fi
for service in bloxodes-article-discovery.service bloxodes-article-writer.service bloxodes-article-publication.service; do
  if systemctl is-active --quiet "${service}"; then
    echo "${service} is active; retry after it finishes." >&2
    exit 1
  fi
done

# First activation reconciles work completed since preparation. Keep newer runtime receipts.
if [[ ! -e "${RUNTIME_ROOT}/current" ]]; then
  for directory in article-pipeline content-workspace article-publication; do
    if [[ -d "${REPO_ROOT}/tmp/${directory}" ]]; then
      rsync -au "${REPO_ROOT}/tmp/${directory}/" "${RUNTIME_ROOT}/state/${directory}/"
    fi
  done
fi

install -d -m 0750 -o root -g teja "${ENV_DIR}"
if [[ ! -e "${ENV_PATH}" ]]; then
  install -m 0640 -o root -g teja \
    "${REPO_ROOT}/env/examples/pipelines/articles.env.example" \
    "${ENV_PATH}"
  echo "Created ${ENV_PATH} with placeholders; replace them before enabling timers."
fi
chown root:teja "${ENV_PATH}"
chmod 0640 "${ENV_PATH}"

for unit in \
  bloxodes-article-discovery.service \
  bloxodes-article-discovery.timer \
  bloxodes-article-writer.service \
  bloxodes-article-publication.service \
  bloxodes-article-publication.timer; do
  install -m 0644 "${UNIT_SOURCE}/${unit}" "/etc/systemd/system/${unit}"
done

if [[ -e /etc/systemd/system/bloxodes-article-writer.timer ]]; then
  systemctl disable --now bloxodes-article-writer.timer >/dev/null 2>&1 || true
  rm -f /etc/systemd/system/bloxodes-article-writer.timer
fi
ln -s "${RELEASE_DIR}" "${RUNTIME_ROOT}/current.next"
mv -Tf "${RUNTIME_ROOT}/current.next" "${RUNTIME_ROOT}/current"
systemctl daemon-reload
systemctl enable --now bloxodes-article-publication.timer

echo "Installed Bloxodes article units from ${APPROVED_SHA}."
echo "Existing discovery timer enablement and active state were preserved."

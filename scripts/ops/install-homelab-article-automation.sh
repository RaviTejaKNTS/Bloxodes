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
UNIT_SOURCE="${REPO_ROOT}/scripts/ops/systemd"
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
for service in bloxodes-article-discovery.service bloxodes-article-writer.service; do
  if systemctl is-active --quiet "${service}"; then
    echo "${service} is active; retry after it finishes." >&2
    exit 1
  fi
done

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
  bloxodes-article-writer.service; do
  install -m 0644 "${UNIT_SOURCE}/${unit}" "/etc/systemd/system/${unit}"
done

if [[ -e /etc/systemd/system/bloxodes-article-writer.timer ]]; then
  systemctl disable --now bloxodes-article-writer.timer >/dev/null 2>&1 || true
  rm -f /etc/systemd/system/bloxodes-article-writer.timer
fi
systemctl daemon-reload

echo "Installed Bloxodes article units from ${APPROVED_SHA}."
echo "Existing discovery timer enablement and active state were preserved."

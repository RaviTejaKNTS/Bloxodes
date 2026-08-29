#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" != "--apply" || ! "${2:-}" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Usage: sudo scripts/ops/install-homelab-wiki-automation.sh --apply <approved-40-char-sha>" >&2
  exit 2
fi
APPROVED_SHA="$2"
if [[ "${EUID}" -ne 0 ]]; then
  echo "Run this installer with sudo." >&2
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_DIR="/etc/bloxodes"
ENV_PATH="${ENV_DIR}/wiki-automation.env"
if [[ "${REPO_ROOT}" != "/home/teja/projects/Bloxodes" ]]; then
  echo "Expected /home/teja/projects/Bloxodes; found ${REPO_ROOT}." >&2
  exit 1
fi
if [[ "$(git -C "${REPO_ROOT}" rev-parse HEAD)" != "${APPROVED_SHA}" ]]; then
  echo "Checkout does not match approved SHA ${APPROVED_SHA}." >&2
  exit 1
fi
if [[ -n "$(git -C "${REPO_ROOT}" status --porcelain)" ]]; then
  echo "Checkout is dirty; refusing to install." >&2
  exit 1
fi
if systemctl is-active --quiet bloxodes-wiki-builder.service; then
  echo "bloxodes-wiki-builder.service is active; retry after it finishes." >&2
  exit 1
fi

install -d -m 0750 -o root -g teja "${ENV_DIR}"
if [[ ! -e "${ENV_PATH}" ]]; then
  install -m 0640 -o root -g teja "${REPO_ROOT}/env/examples/pipelines/wiki-automation.env.example" "${ENV_PATH}"
  echo "Created ${ENV_PATH}; populate its placeholders before starting the service."
fi
chown root:teja "${ENV_PATH}"
chmod 0640 "${ENV_PATH}"
install -m 0644 "${REPO_ROOT}/scripts/ops/systemd/bloxodes-wiki-builder.service" /etc/systemd/system/bloxodes-wiki-builder.service
install -m 0644 "${REPO_ROOT}/scripts/ops/systemd/bloxodes-wiki-builder.timer" /etc/systemd/system/bloxodes-wiki-builder.timer
systemctl daemon-reload
systemctl enable --now bloxodes-wiki-builder.timer
echo "Installed the continuous two-lane Bloxodes wiki service and its two-hour recovery timer from ${APPROVED_SHA}."
echo "Run once: systemctl start bloxodes-wiki-builder.service"

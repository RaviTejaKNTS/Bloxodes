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
MODEL_USER="bloxodes-wiki-model"
MODEL_HOME="/var/lib/bloxodes/wiki-model"
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

if ! command -v setfacl >/dev/null 2>&1; then
  echo "setfacl is required for the read-only model checkout." >&2
  exit 1
fi
if ! id "${MODEL_USER}" >/dev/null 2>&1; then
  useradd --system --home-dir "${MODEL_HOME}" --create-home --shell /usr/sbin/nologin "${MODEL_USER}"
fi
install -d -m 0751 -o root -g root "${ENV_DIR}"
if [[ ! -e "${ENV_PATH}" ]]; then
  install -m 0640 -o root -g "${MODEL_USER}" "${REPO_ROOT}/env/examples/pipelines/wiki-automation.env.example" "${ENV_PATH}"
  echo "Created ${ENV_PATH}; populate its placeholders before starting the service."
fi
install -d -m 0700 -o "${MODEL_USER}" -g "${MODEL_USER}" "${MODEL_HOME}" "${MODEL_HOME}/.codex"
chown root:"${MODEL_USER}" "${ENV_PATH}"
chmod 0640 "${ENV_PATH}"
setfacl -m "u:teja:r--" "${ENV_PATH}"
setfacl -m "u:${MODEL_USER}:--x" /home/teja /home/teja/projects /home/teja/.local /home/teja/.local/bin
setfacl -m "u:${MODEL_USER}:r-x" /home/teja/.local/bin/codex "${REPO_ROOT}"
install -d -m 0770 -o "${MODEL_USER}" -g "${MODEL_USER}" "${REPO_ROOT}/tmp/wiki-automation" "${REPO_ROOT}/apps/web/.next/wiki-automation"
chown -R "${MODEL_USER}":"${MODEL_USER}" "${REPO_ROOT}/tmp/wiki-automation" "${REPO_ROOT}/apps/web/.next/wiki-automation"
install -d -m 0750 -o teja -g teja "${REPO_ROOT}/tmp/agent-work"
setfacl -m "u:${MODEL_USER}:rwx" "${REPO_ROOT}/tmp/agent-work"
runuser --user "${MODEL_USER}" -- git config --global --replace-all safe.directory "${REPO_ROOT}"
install -m 0644 "${REPO_ROOT}/scripts/ops/systemd/bloxodes-wiki-builder.service" /etc/systemd/system/bloxodes-wiki-builder.service
install -m 0644 "${REPO_ROOT}/scripts/ops/systemd/bloxodes-wiki-builder.timer" /etc/systemd/system/bloxodes-wiki-builder.timer
systemctl daemon-reload
systemctl enable --now bloxodes-wiki-builder.timer
echo "Installed the one-game daily Bloxodes wiki service and timer from ${APPROVED_SHA}."
echo "The timer owns future starts; do not start the service manually unless an immediate game is intended."

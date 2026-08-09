#!/usr/bin/env bash
set -euo pipefail

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

install -d -m 0750 -o root -g teja "${ENV_DIR}"
if [[ ! -e "${ENV_PATH}" ]]; then
  install -m 0640 -o root -g teja \
    "${REPO_ROOT}/docs/automation/homelab-article-automation.env.example" \
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

systemctl disable --now bloxodes-article-writer.timer >/dev/null 2>&1 || true
rm -f /etc/systemd/system/bloxodes-article-writer.timer
systemctl daemon-reload
systemctl disable bloxodes-article-discovery.timer >/dev/null 2>&1 || true

echo "Installed Bloxodes article units in an inactive state."
echo "After credentials and Grok authentication are ready, run the readiness checks and enable the discovery timer."

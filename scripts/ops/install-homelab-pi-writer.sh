#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" != "--apply" || ! "${2:-}" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Usage: sudo scripts/ops/install-homelab-pi-writer.sh --apply <approved-40-char-sha>" >&2
  exit 2
fi
approved_sha="$2"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run this installer with sudo." >&2
  exit 1
fi

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
pi_version="0.84.3"
pi_package="@earendil-works/pi-coding-agent@${pi_version}"

if [[ "${repo_root}" != "/home/teja/projects/Bloxodes" ]]; then
  echo "Expected the worker checkout at /home/teja/projects/Bloxodes; found ${repo_root}." >&2
  exit 1
fi
if [[ "$(git -C "${repo_root}" rev-parse HEAD)" != "${approved_sha}" ]]; then
  echo "Checkout does not match approved SHA ${approved_sha}." >&2
  exit 1
fi
if [[ -n "$(git -C "${repo_root}" status --porcelain)" ]]; then
  echo "Checkout is dirty; refusing to install Pi." >&2
  exit 1
fi
for service in bloxodes-article-discovery.service bloxodes-article-writer.service; do
  if systemctl is-active --quiet "${service}"; then
    echo "${service} is active; retry after it finishes." >&2
    exit 1
  fi
done

install -d -m 0755 -o teja -g teja /home/teja/.local
runuser -u teja -- npm install --global --prefix /home/teja/.local --ignore-scripts "${pi_package}"
installed="$(runuser -u teja -- /home/teja/.local/bin/pi --version)"
if [[ "${installed}" != "${pi_version}" ]]; then
  echo "Expected Pi ${pi_version}; found ${installed}." >&2
  exit 1
fi

echo "Installed ${pi_package} for teja from approved checkout ${approved_sha}."
echo "Pi credentials were not copied or modified. Log in as teja with /login and choose ChatGPT Plus/Pro."

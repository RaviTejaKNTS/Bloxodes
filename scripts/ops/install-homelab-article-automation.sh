#!/usr/bin/env bash
set -euo pipefail
# Compatibility entrypoint for the article runtime installer.
exec bash "$(dirname "${BASH_SOURCE[0]}")/install-homelab-automation.sh" "$@"

#!/usr/bin/env bash
set -euo pipefail
# Compatibility entrypoint: article and wiki services are activated together.
exec bash "$(dirname "${BASH_SOURCE[0]}")/prepare-automation-runtime.sh" "$@"

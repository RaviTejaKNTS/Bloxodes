#!/usr/bin/env bash
set -euo pipefail
[[ "${1:-}" == --sha && "${2:-}" =~ ^[0-9a-f]{40}$ ]] || { echo 'Usage: automation:runtime:prepare -- --sha <40-char-sha>' >&2; exit 2; }
SHA="$2"
SOURCE=/home/teja/projects/Bloxodes
ROOT=/home/teja/.local/share/bloxodes-automation-runtime
LEGACY=/home/teja/.local/share/bloxodes-article-runtime
RELEASE="$ROOT/releases/$SHA"
[[ "$(id -un)" == teja && "$(hostname)" == teja-homelab ]]
git -C "$SOURCE" cat-file -e "$SHA^{commit}"
mkdir -p "$ROOT/releases"
# Preparation never touches the active checkout or copies live mutable state.
# Activation relocates this state while idle, retaining the legacy path as an alias.
if [[ ! -e "$ROOT/state" ]]; then ln -s "$LEGACY/state" "$ROOT/state"; fi
[[ -d "$ROOT/state" ]]
[[ -d "$RELEASE" ]] || git -C "$SOURCE" worktree add --detach "$RELEASE" "$SHA"
[[ "$(git -C "$RELEASE" rev-parse HEAD)" == "$SHA" ]]
[[ -z "$(git -C "$RELEASE" status --porcelain)" ]]
[[ -e "$RELEASE/tmp" ]] || ln -s "$ROOT/state" "$RELEASE/tmp"
[[ -e "$RELEASE/.envs" ]] || ln -s "$SOURCE/.envs" "$RELEASE/.envs"
[[ "$(readlink -f "$RELEASE/tmp")" == "$(readlink -f "$ROOT/state")" ]]
[[ "$(readlink -f "$RELEASE/.envs")" == "$SOURCE/.envs" ]]
cd "$RELEASE"
npm ci --workspace @bloxodes/web --include-workspace-root --no-audit --no-fund
BLOXODES_AUTOMATION_RUNTIME=1 node --env-file=/etc/bloxodes/article-automation.env --import tsx scripts/ops/check-homelab-article-automation.ts --component all
[[ -z "$(git status --porcelain)" ]]
printf '%s\n' "$SHA" > "$ROOT/prepared-sha"
echo "Prepared $RELEASE. Activation and restricted-user readiness are separate; running jobs are unchanged."

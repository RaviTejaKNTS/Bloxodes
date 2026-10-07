#!/usr/bin/env bash
set -euo pipefail
[[ "${1:-}" == --sha && "${2:-}" =~ ^[0-9a-f]{40}$ && "${3:-}" == --artifact-dir && -d "${4:-}" ]] || { echo 'Usage: automation:runtime:prepare -- --sha <40-char-sha> --artifact-dir <GitHub-package-directory>' >&2; exit 2; }
SHA="$2"
ARTIFACT=$(realpath "$4")
SOURCE=/srv/data/projects/Bloxodes
ROOT=/srv/data/bloxodes-automation-runtime
LEGACY=/home/teja/.local/share/bloxodes-automation-runtime
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
# Codex protects project .aws as a read-only mount. Its mountpoint must exist
# before the enclosing systemd filesystem becomes read-only.
mkdir -p "$RELEASE/.aws"
EXCLUDE=$(git -C "$RELEASE" rev-parse --git-path info/exclude)
[[ "$EXCLUDE" == /* ]] || EXCLUDE="$RELEASE/$EXCLUDE"
rg -qx '/.aws/' "$EXCLUDE" || printf '\n/.aws/\n' >> "$EXCLUDE"
[[ "$(readlink -f "$RELEASE/tmp")" == "$(readlink -f "$ROOT/state")" ]]
[[ "$(readlink -f "$RELEASE/.envs")" == "$(readlink -f "$SOURCE/.envs")" ]]
cd "$RELEASE"
node scripts/ops/verify-runtime-package.mjs "$SHA" "$RELEASE" "$ARTIFACT"
# Extract only the SHA-bound dependency artifact prepared on GitHub.
tar -tzf "$ARTIFACT/dependencies.tgz" > "$ROOT/package-paths-$SHA"
if rg '(^/|(^|/)\.\.(/|$))' "$ROOT/package-paths-$SHA"; then echo 'Unsafe dependency archive.' >&2; exit 1; fi
if rg -v '^(node_modules/|apps/web/node_modules/)' "$ROOT/package-paths-$SHA"; then echo 'Unexpected dependency archive path.' >&2; exit 1; fi
[[ ! -e node_modules ]] || { echo 'Runtime dependencies already exist; inspect the candidate instead of replacing it.' >&2; exit 1; }
tar -xzf "$ARTIFACT/dependencies.tgz" --no-same-owner
cp "$ARTIFACT/receipt.json" "$ROOT/package-receipt-$SHA.json"
[[ -z "$(git status --porcelain)" ]]
printf '%s\n' "$SHA" > "$ROOT/prepared-sha"
echo "Prepared $RELEASE. Activation and restricted-user readiness are separate; running jobs are unchanged."

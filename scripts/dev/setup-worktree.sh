#!/usr/bin/env bash

set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
main_checkout="$(git worktree list --porcelain | awk '/^worktree / { sub(/^worktree /, ""); print; exit }')"

if [[ -z "$main_checkout" || "$repo_root" == "$main_checkout" ]]; then
  exit 0
fi

linked_env_count=0
source_env_dir="$main_checkout/.envs"
destination_env_dir="$repo_root/.envs"
if [[ -d "$source_env_dir" && ! -e "$destination_env_dir" && ! -L "$destination_env_dir" ]]; then
  ln -s "$source_env_dir" "$destination_env_dir"
  linked_env_count=1
fi

mkdir -p "$repo_root/tmp" "$repo_root/tmp/test-reports"

lock_hash="$(git hash-object "$repo_root/package-lock.json")"
install_marker="$repo_root/node_modules/.bloxodes-package-lock.sha256"
installed_hash=""
if [[ -f "$install_marker" ]]; then
  installed_hash="$(<"$install_marker")"
fi

if [[ ! -d "$repo_root/node_modules" || "$installed_hash" != "$lock_hash" ]]; then
  (
    cd "$repo_root"
    npm ci
  )
  printf '%s\n' "$lock_hash" > "$install_marker"
fi

printf 'Worktree ready (%d env director%s linked).\n' \
  "$linked_env_count" \
  "$([[ "$linked_env_count" -eq 1 ]] && printf 'y' || printf 'ies')"

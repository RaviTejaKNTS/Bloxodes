#!/usr/bin/env bash

set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
main_checkout="$(git worktree list --porcelain | awk '/^worktree / { sub(/^worktree /, ""); print; exit }')"

if [[ -z "$main_checkout" || "$repo_root" == "$main_checkout" ]]; then
  exit 0
fi

linked_env_count=0
shopt -s nullglob
for source_path in "$main_checkout"/.env*; do
  [[ -e "$source_path" || -L "$source_path" ]] || continue

  filename="${source_path##*/}"
  git -C "$main_checkout" check-ignore -q -- "$filename" || continue

  destination_path="$repo_root/$filename"
  if [[ -e "$destination_path" || -L "$destination_path" ]]; then
    continue
  fi

  ln -s "$source_path" "$destination_path"
  linked_env_count=$((linked_env_count + 1))
done
shopt -u nullglob

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

printf 'Worktree ready (%d env item%s linked).\n' \
  "$linked_env_count" \
  "$([[ "$linked_env_count" -eq 1 ]] && printf '' || printf 's')"

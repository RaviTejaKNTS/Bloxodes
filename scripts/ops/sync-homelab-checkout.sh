#!/usr/bin/env bash
set -euo pipefail

apply=false
expected_sha=""
repo_root="${HOMELAB_REPO_ROOT:-/home/teja/projects/Bloxodes}"
env_path="${HOMELAB_ENV_PATH:-/etc/bloxodes/article-automation.env}"
wiki_env_path="${HOMELAB_WIKI_ENV_PATH:-/etc/bloxodes/wiki-automation.env}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --apply) apply=true ;;
    --expected-sha) expected_sha="${2:-}"; shift ;;
    --repo-root) repo_root="${2:-}"; shift ;;
    --help|-h)
      echo "Usage: sync-homelab-checkout.sh --expected-sha <40-char-sha> [--repo-root PATH] [--apply]"
      exit 0
      ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
  shift
done

if [[ ! "$expected_sha" =~ ^[0-9a-f]{40}$ ]]; then
  echo "--expected-sha must be a full 40-character Git SHA." >&2
  exit 2
fi
if [[ ! -d "$repo_root/.git" ]]; then
  echo "Homelab checkout not found at $repo_root." >&2
  exit 1
fi
if [[ ! -r "$env_path" ]]; then
  echo "Homelab runtime env is not readable at $env_path." >&2
  exit 1
fi
if [[ "$(git -C "$repo_root" branch --show-current)" != "production" ]]; then
  echo "Homelab checkout must be on production." >&2
  exit 1
fi
if [[ -n "$(git -C "$repo_root" status --porcelain)" ]]; then
  echo "Homelab checkout is dirty; refusing to synchronize." >&2
  exit 1
fi
for service in bloxodes-article-discovery.service bloxodes-article-writer.service; do
  if systemctl is-active --quiet "$service"; then
    echo "$service is active; retry after the current article run finishes." >&2
    exit 1
  fi
done
if systemctl list-unit-files bloxodes-wiki-builder.service --no-legend 2>/dev/null | grep -q '^bloxodes-wiki-builder.service'; then
  if systemctl is-active --quiet bloxodes-wiki-builder.service; then
    echo "bloxodes-wiki-builder.service is active; retry after the current wiki run finishes." >&2
    exit 1
  fi
fi

remote_sha="$(git -C "$repo_root" ls-remote origin refs/heads/production | awk '{print $1}')"
if [[ "$remote_sha" != "$expected_sha" ]]; then
  echo "origin/production is $remote_sha, not approved SHA $expected_sha." >&2
  exit 1
fi

current_sha="$(git -C "$repo_root" rev-parse HEAD)"
echo "Homelab checkout: $current_sha -> $expected_sha"
if [[ "$apply" != true ]]; then
  echo "Dry run only. Re-run with --apply after production synchronization is approved."
  exit 0
fi

lock_file="/tmp/bloxodes-homelab-checkout-sync.lock"
exec 9>"$lock_file"
flock -n 9 || { echo "Another homelab synchronization is active." >&2; exit 1; }

old_lock_hash="$(git -C "$repo_root" rev-parse HEAD:package-lock.json)"
git -C "$repo_root" fetch --no-tags origin production
git -C "$repo_root" merge --ff-only "$expected_sha"
new_lock_hash="$(git -C "$repo_root" rev-parse HEAD:package-lock.json)"
if [[ "$old_lock_hash" != "$new_lock_hash" ]]; then
  npm --prefix "$repo_root" ci
fi

for unit in bloxodes-article-discovery.service bloxodes-article-writer.service; do
  if ! cmp -s "$repo_root/scripts/ops/systemd/$unit" "/etc/systemd/system/$unit"; then
    echo "Installed $unit differs from the approved checkout." >&2
    echo "Run scripts/ops/install-homelab-article-automation.sh as root with the same approved SHA." >&2
    exit 1
  fi
done

if systemctl list-unit-files bloxodes-wiki-builder.service --no-legend 2>/dev/null | grep -q '^bloxodes-wiki-builder.service'; then
  if [[ ! -r "$wiki_env_path" ]]; then
    echo "Installed wiki automation is missing readable env at $wiki_env_path." >&2
    exit 1
  fi
  for unit in bloxodes-wiki-builder.service bloxodes-wiki-builder.timer; do
    if ! cmp -s "$repo_root/scripts/ops/systemd/$unit" "/etc/systemd/system/$unit"; then
      echo "Installed $unit differs from the approved checkout." >&2
      echo "Run scripts/ops/install-homelab-wiki-automation.sh as root with the same approved SHA." >&2
      exit 1
    fi
  done
  (
    cd "$repo_root"
    NODE_ENV=development node --env-file="$wiki_env_path" --import tsx \
      scripts/ops/check-homelab-wiki-automation.ts
  )
fi

(
  cd "$repo_root"
  NODE_ENV=development node --env-file="$env_path" --import tsx \
    scripts/ops/check-homelab-article-automation.ts --component all
)
echo "Homelab synchronized to $expected_sha; timer state was not changed."

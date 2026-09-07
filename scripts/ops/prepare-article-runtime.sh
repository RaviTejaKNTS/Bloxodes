#!/usr/bin/env bash
set -euo pipefail
if [[ "${1:-}" != "--sha" || ! "${2:-}" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Usage: scripts/ops/prepare-article-runtime.sh --sha <verified-commit>" >&2; exit 2
fi
ARTICLE_SHA="$2"
for service in bloxodes-article-discovery.service bloxodes-article-writer.service bloxodes-article-publication.service; do
  if systemctl is-active --quiet "${service}"; then echo "${service} is active; prepare after it finishes." >&2; exit 1; fi
done
SOURCE_ROOT="$(git rev-parse --show-toplevel)"
RUNTIME_ROOT=/home/teja/.local/share/bloxodes-article-runtime
RELEASE_DIR="${RUNTIME_ROOT}/releases/${ARTICLE_SHA}"
mkdir -p "${RUNTIME_ROOT}/releases" "${RUNTIME_ROOT}/state"
if [[ ! -d "${RELEASE_DIR}" ]]; then
  git worktree add --detach "${RELEASE_DIR}" "${ARTICLE_SHA}"
fi
[[ "$(git -C "${RELEASE_DIR}" rev-parse HEAD)" == "${ARTICLE_SHA}" ]]
[[ -z "$(git -C "${RELEASE_DIR}" status --porcelain)" ]]
# Runtime state survives release replacement. The article/wiki lease stays shared with manual work.
for directory in article-pipeline content-workspace article-publication; do
  if [[ ! -e "${RUNTIME_ROOT}/state/${directory}" ]]; then
    mkdir -p "${RUNTIME_ROOT}/state/${directory}"
    if [[ -d "${SOURCE_ROOT}/tmp/${directory}" ]]; then cp -a "${SOURCE_ROOT}/tmp/${directory}/." "${RUNTIME_ROOT}/state/${directory}/"; fi
  fi
done
mkdir -p "${SOURCE_ROOT}/tmp/article-writer"
[[ -e "${RUNTIME_ROOT}/state/article-writer" ]] || ln -s "${SOURCE_ROOT}/tmp/article-writer" "${RUNTIME_ROOT}/state/article-writer"
[[ -e "${RELEASE_DIR}/tmp" ]] || ln -s "${RUNTIME_ROOT}/state" "${RELEASE_DIR}/tmp"
[[ -e "${RELEASE_DIR}/.envs" ]] || ln -s "${SOURCE_ROOT}/.envs" "${RELEASE_DIR}/.envs"
cd "${RELEASE_DIR}"
npm ci --workspace @bloxodes/web --include-workspace-root --no-audit --no-fund
node --env-file=/etc/bloxodes/article-automation.env ./node_modules/tsx/dist/cli.mjs scripts/ops/check-homelab-article-automation.ts --component all
printf '%s\n' "${ARTICLE_SHA}" > "${RUNTIME_ROOT}/prepared-sha"
printf 'Prepared and checked %s\n' "${RELEASE_DIR}"

#!/usr/bin/env bash
# Bootstrap local Postgres schema when supabase start cannot apply migrations from scratch.
# Requires: Docker + supabase stack already running (supabase_db_* container).
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

MIGRATION_CUTOFF="20260915000001"

dbc="$(docker ps --format '{{.Names}}' | grep -E 'supabase_db_' | head -1 || true)"
if [[ -z "$dbc" ]]; then
  echo "No supabase_db container found. Run npm run supabase:start first." >&2
  exit 1
fi

if docker exec -i "$dbc" psql -U postgres -d postgres -tAc "select to_regclass('public.code_pages')" | grep -q code_pages; then
  echo "Local DB already bootstrapped (code_pages exists). Skipping schema load."
  exit 0
fi

echo "Loading supabase/schema.sql into $dbc ..."
docker exec -i "$dbc" psql -v ON_ERROR_STOP=0 -U postgres -d postgres < supabase/schema.sql >/tmp/schema-load.log 2>&1

docker exec -i "$dbc" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c \
  "create extension if not exists pg_trgm with schema extensions; create extension if not exists pg_cron;"

applied=0
for f in $(ls supabase/migrations | sort); do
  ver="${f%%_*}"
  if [[ "$ver" -ge "$MIGRATION_CUTOFF" ]]; then
    echo "Applying $f ..."
    docker exec -i "$dbc" psql -v ON_ERROR_STOP=0 -U postgres -d postgres < "supabase/migrations/$f" >/dev/null
    applied=$((applied + 1))
  fi
done

echo "Bootstrap complete ($applied overlay migrations)."

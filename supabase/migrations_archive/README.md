This folder stores archived Supabase migration files that are no longer active.

The active baseline migration now lives in `supabase/migrations/20260422_baseline_schema.sql`.
We keep the legacy files here for reference, but outside `supabase/migrations/` so the CLI
does not treat them as part of the current migration chain.

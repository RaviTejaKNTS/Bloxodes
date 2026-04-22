# Scripts Guide

Scope: `scripts/`.

These files are operational jobs, imports, backfills, collectors, and automation workers. Many are side-effectful.

## Default Rules

- Prefer the stable `package.json` alias when one exists.
- Keep shared helpers in `scripts/shared/`.
- Group new scripts by task area instead of adding everything at the top level.
- Document required env vars and downstream side effects when introducing a new script.
- For script env loading, prefer `scripts/shared/load-env.ts` instead of importing `dotenv/config` directly.

## Folder Map

- `ads/`: build-time ad and policy helpers.
- `articles/`: article generation and article refresh.
- `automation/`: queue runners, IndexNow/bootstrap helpers, cache warming, reporting.
- `backfill/`: repair jobs for existing content/data.
- `catalog/`: Roblox catalog and avatar item collection plus enrichment.
- `codes/`: code refresh and code-article rewrite jobs.
- `decal-ids/`: decal scraping and enrichment.
- `events/`: event ingestion, page seeding, event detail hydration, event guide generation.
- `games/`: import jobs and single-game article generation.
- `lists/`: curated and trending list refresh jobs.
- `music/`: music ID collection, import, enrichment, verification, thumbnails.
- `posts/`: outbound posting jobs.
- `shared/`: helpers reused by multiple scripts.
- `trading/`: trading-related collection.
- `universes/`: universe collection, enrichment, slugs, stats, playing counts, descriptions.

## Operational Expectations

- Treat scripts as data pipelines: know whether the job reads only, mutates Supabase, writes local files, calls external APIs, or triggers revalidation.
- If a script creates or updates publishable content, review `/api/revalidate` coverage and any relevant Supabase revalidation trigger flow.
- If a job becomes part of the normal workflow, add a package script and update `agents/scripts/agents.md`.

## Script Authoring Checklist

1. Put the file in the correct folder.
2. Reuse a helper from `scripts/shared/` or `src/lib/*` if one already exists.
3. Add a `package.json` command if people will run it regularly.
4. Document the script in `agents/scripts/agents.md`.

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
- `automation/`: queue runners, IndexNow/bootstrap helpers, Google Indexing API submitter, cache warming, reporting.
  - `google-indexing-submit.ts` is a guarded Google Indexing API job. It loads `.env.indexing*`, requires `--apply` plus `GOOGLE_INDEXING_API_ENABLED=true` before calling Google, and should use Supabase state in recurring production/GitHub runs so the daily cap and URL rotation persist.
- `backfill/`: repair jobs for existing content/data.
- `catalog/`: Roblox catalog and avatar item collection plus enrichment.
  - `collect-slime-rng-data.ts` collects Slime RNG wiki source data into `data/Slime RNG/` and downloads available source images into `apps/web/public/Slime RNG/`. It is a local dataset collector and does not mutate Supabase.
  - `seed-game-catalog-pages.ts` upserts local game dataset collection copy into `wiki_catalog_pages`; use `--dry-run` before writing and `--draft` when pages should stay unpublished. Pass `--final-json-root tmp/content-workspace/<date>/game-catalog` when approved per-page `final.json` files should override generated copy during local review/import.
  - `seed-game-wiki-pages.ts` upserts game hub rows into `wiki_pages` and links them to matching `roblox_universes`; use `--dry-run` before writing and `--draft` when pages should stay unpublished.
  - Both seed scripts accept `--game <slug>` for narrow production publishes. Catalog seeding also accepts `--collection <slug>` for single-page retries.
  - For production runs, use `NODE_ENV=production` plus `--allow-prod` only after a clean production dry-run. Confirm the scripts are targeting the production Supabase host, not local Supabase.
  - Scripts that match against `roblox_universes` must page through production rows explicitly; do not assume the default Supabase result limit is enough.
  - Keep reusable seed/upsert scripts for repeated wiki/catalog work. Delete temporary collector/import scripts after their data is stable and committed.
- `content/`: local content QA helpers.
  - `check-public-copy.ts` blocks self-referential public copy such as `Use the X catalog`, `this catalog`, `dataset`, and `Bloxodes`, weak field-command copy such as `Read category first`, and AI-ish contrast filler such as `not just`; run it against generated `final.json` files before local Supabase import.
- `codes/`: code refresh and code-article rewrite jobs.
  - Code rows must come from `scripts/codes/update-codes.ts`, not from manual JSON, SQL, Supabase edits, or hand-written script payloads.
  - For a code page, insert or update the `games` row first: `slug` is the game slug only, `roblox_link` is the Roblox experience URL, `source_url` is the RobloxDen codes page, `source_url_2` is the Beebom codes page, and `seo_title` stays empty or null unless the user explicitly asks otherwise.
  - After source URLs are set, run `npm run refresh:codes -- --slug <game-slug>` so the scraper reads RobloxDen and Beebom, upserts active codes, and expires missing codes.
  - Code-page article fields and metadata must be evergreen. Do not write active code names, current-code reward mappings, active counts, exact dates, month/year labels, or freshness claims such as `latest`, `current`, `fresh`, or `updated daily` into prose or metadata.
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
2. Reuse a helper from `scripts/shared/` or `apps/web/src/lib/*` if one already exists.
3. Add a `package.json` command if people will run it regularly.
4. Document the script in `agents/scripts/agents.md`.

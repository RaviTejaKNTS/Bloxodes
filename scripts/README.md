# Scripts Overview

The `scripts/` folder is organized by task area so it's easier to find the right tool quickly.

- `ads/`: build-time ad and site policy helpers
- `articles/`: article generation and article refresh jobs
- `automation/`: queue runners, deploy warmup, Google/IndexNow indexing helpers, and reporting utilities
- `backfill/`: one-off cleanup and repair scripts for existing data
- `catalog/`: Roblox catalog and avatar item ingestion/enrichment
- `codes/`: code-page import, source repair, refresh, and code-article jobs. Code rows come from `scripts/codes/update-codes.ts` using `code_pages.source_url` for RobloxDen and `code_pages.source_url_2` for Beebom; do not seed codes manually.
- `decal-ids/`: decal scraping and enrichment tooling
- `events/`: event ingestion, event page seeding, and event article generation
- `music/`: Roblox music ID collection, enrichment, verification, and imports
- `posts/`: outbound posting and distribution scripts
- `shared/`: shared helpers used by multiple scripts
- `trading/`: trading-specific data collection
- `universes/`: universe collection, enrichment, stats, slugs, and description jobs

Prefer the `package.json` scripts when available so command names stay stable even if file locations change again.

Local development note:

- shared script env loading lives in `scripts/shared/load-env.ts`
- scripts now prefer `.env.local` for local work, but they do not override real process env vars
- Google Indexing API jobs load `.env.indexing.local` / `.env.indexing` after the normal env files; keep indexing secrets separate from `.env.analytics`
- production jobs can keep injecting `SUPABASE_*` and other env vars the same way they do today

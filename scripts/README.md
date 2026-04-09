# Scripts Overview

The `scripts/` folder is organized by task area so it's easier to find the right tool quickly.

- `ads/`: build-time ad and site policy helpers
- `articles/`: article generation and article refresh jobs
- `automation/`: queue runners, deploy warmup, and reporting utilities
- `backfill/`: one-off cleanup and repair scripts for existing data
- `catalog/`: Roblox catalog and avatar item ingestion/enrichment
- `codes/`: code refresh and code-article rewrite jobs
- `decal-ids/`: decal scraping and enrichment tooling
- `events/`: event ingestion, event page seeding, and event article generation
- `games/`: game import and single-game article generation
- `lists/`: trending and curated list refresh jobs
- `music/`: Roblox music ID collection, enrichment, verification, and imports
- `posts/`: outbound posting and distribution scripts
- `shared/`: shared helpers used by multiple scripts
- `trading/`: trading-specific data collection
- `universes/`: universe collection, enrichment, stats, slugs, and description jobs

Prefer the `package.json` scripts when available so command names stay stable even if file locations change again.
